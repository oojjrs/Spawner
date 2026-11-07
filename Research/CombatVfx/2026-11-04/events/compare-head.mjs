import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const baselineRoot = resolve(process.argv[2]), candidateRoot = resolve(process.argv[3]);
const output = process.argv[4] && resolve(process.argv[4]);
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const scratch = mkdtempSync(join(tmpdir(), "spawner-vfx-regression-"));
const drawKey = "SpawnerVfxRegressionRandomDraws";
async function load(root, label) {
  const url = name => pathToFileURL(join(root, name)).href;
  const [{ createCombat }, { ATTRIBUTE_DNA }, { createCombatTrial }] = await Promise.all([
    import(url("server/combat.mjs")), import(url("server/dna.mjs")), import(url("client/combat-lab.mjs"))
  ]);
  // Count keyed samples in a temporary copy; the seed function and RNG output stay identical.
  let source = readFileSync(join(root, "client/combat-simulation.mjs"), "utf8");
  assert.ok(source.includes("function keyedRandom(seed, actor, action, hit, channel) {"));
  source = source.replace("function keyedRandom(seed, actor, action, hit, channel) {",
    "function keyedRandom(seed, actor, action, hit, channel) { globalThis[Symbol.for(" + JSON.stringify(drawKey) + ")]++;")
    .replace(/from (["'])(\.\.?\/[^"']+)\1/g, (_, quote, name) => "from " + JSON.stringify(new URL(name, url("client/combat-simulation.mjs")).href));
  const path = join(scratch, label + ".mjs"); writeFileSync(path, source);
  const { createSimulationTrial } = await import(pathToFileURL(path).href);
  return { createCombat, ATTRIBUTE_DNA, createSimulationTrial, createCombatTrial };
}
function generator(seed) {
  let value = seed >>> 0, draws = 0;
  return { next() { draws++; value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; },
    get draws() { return draws; } };
}
const observed = new Set();
function serverScenario(engine, scenario, seed, observe) {
  const dna = ids => engine.ATTRIBUTE_DNA.stats(ids.map(id => {
    const gene = engine.ATTRIBUTE_DNA.lookup.get(id); return { gene: id, grade: gene.grade, shape: [...gene.steps], rotation: 0 };
  }));
  const unit = (id, ownerId, genes, x) => ({ id, ownerId, tribe: "bean", x, y: 100, health: 80,
    moveStartedAt: 0, moveDuration: 0, attributes: {}, combatDisposition: "aggressive",
    stats: { health: 100, speed: 1, vision: 4, dna: dna(genes) } });
  const source = unit("source", "a", scenario.regen ? ["regeneration"] :
    ["blade", "secretion", "combo", "critical", "stun", "bleed", "area", "lifesteal"], 100);
  const target = unit("target", "b", ["blade", "reflection"], scenario.regen ? 110 : scenario.ranged ? 102 : 100);
  const ally = unit("ally", "a", [], 100), collateral = unit("collateral", "b", [], target.x);
  ally.health = 99.75; collateral.health = scenario.lethal ? .1 : 60;
  if (scenario.force) Object.assign(source.stats.dna, { critical: 100, stun: 100, bleed: 100, lifesteal: 100, areaPower: 100 });
  if (scenario.defense) Object.assign(target.stats.dna, { [scenario.defense]: 100, counter: 100 });
  const chance = generator(seed), damage = generator(seed + 17), history = [];
  const game = agents => ({ agents, receiveDamage(agent, amount) {
    const before = agent.health; agent.health = Math.max(0, agent.health - amount);
    history.push({ at: environment.simSeconds, targetId: agent.id, amount, before, after: agent.health });
  } });
  const environment = { simSeconds: 0, world: { terrain: new Uint8Array(320 * 320) },
    games: new Map([["a", game([source, ally])], ["b", game([target, collateral])]]),
    combatRandom: () => chance.next(), damageRandom: () => damage.next(), onCombatEvent(event) {
      if (!observe) return;
      observed.add(event.kind); if (event.critical) observed.add("critical"); if (event.hitIndex > 0) observed.add("followup");
    } };
  const combat = engine.createCombat(environment);
  if (!scenario.ranged && !scenario.regen) { combat.engage(source, target, 0); source.combat.targetId = target.id; }
  const checkpoints = [];
  for (let step = 0; step <= 180; step++) {
    const time = step / 30; environment.simSeconds = time;
    for (const agent of [source, target, ally, collateral]) if (agent.health > 0) combat.update(agent, time);
    if ([9, 20, 90, 180].includes(step)) checkpoints.push(JSON.parse(JSON.stringify([source, target, ally, collateral])));
  }
  return { history, agents: JSON.parse(JSON.stringify([source, target, ally, collateral])), checkpoints,
    chanceDraws: chance.draws, damageDraws: damage.draws };
}
function simulationScenario(engine, seed, ranged) {
  globalThis[Symbol.for(drawKey)] = 0;
  const trial = engine.createSimulationTrial({ seed, random: true, support: true, distance: ranged ? 2 : 1,
    left: { key: "bean", organs: { attack: ranged ? 0 : 1, ranged: ranged ? 1 : 0 },
      counts: { crit: 3, multiHit: 2, stun: 2, drain: 3, vitality: 5 } },
    right: { key: "spore", organs: {}, counts: { parry: 3, block: 3, counter: 3, evasion: 2, vitality: 5 } },
    rules: { maxSeconds: 8 } });
  const checkpoints = [];
  for (const duration of [.31, .4, 1, 1]) {
    trial.advance(duration); checkpoints.push(JSON.parse(JSON.stringify({ time: trial.time, agents: trial.agents, history: trial.history })));
  }
  trial.finish();
  return { result: trial.result(), history: trial.history, agents: trial.agents, support: trial.supportAgents,
    checkpoints, randomDraws: globalThis[Symbol.for(drawKey)] };
}

try {
  const baseline = await load(baselineRoot, "head"), candidate = await load(candidateRoot, "candidate"), comparisons = [];
  const scenarios = [{ name: "melee-effects", force: true }, { name: "ranged-effects", ranged: true, force: true },
    ...["evasion", "parry", "block"].map(defense => ({ name: defense, defense })),
    { name: "lethal-area", force: true, lethal: true }, { name: "regeneration", regen: true }];
  for (const scenario of scenarios) for (const seed of [1, 7, 42, 20261104]) {
    const before = serverScenario(baseline, scenario, seed, false), after = serverScenario(candidate, scenario, seed, true);
    assert.deepEqual(after, before, "Server outcome/RNG regression: " + scenario.name + "/" + seed);
    comparisons.push({ engine: "server", scenario: scenario.name, seed, sha256: hash(before),
      damageEvents: before.history.length, chanceDraws: before.chanceDraws, damageDraws: before.damageDraws });
  }
  for (const ranged of [false, true]) for (const seed of [1, 7, 42, 20261104]) {
    const before = simulationScenario(baseline, seed, ranged), after = simulationScenario(candidate, seed, ranged);
    assert.deepEqual(after, before, "Simulation outcome/history/RNG regression: " + seed + "/" + ranged);
    comparisons.push({ engine: "simulation", scenario: ranged ? "ranged" : "melee", seed,
      sha256: hash(before), historyRows: before.history.length, randomDraws: before.randomDraws });
  }
  for (const seed of [1, 42]) {
    const settings = { seed, random: true, left: { key: "bean", combatStrength: 20, health: 100 },
      right: { key: "spore", combatStrength: 18, health: 100 } };
    const run = engine => { const trial = engine.createCombatTrial(settings); trial.finish();
      return { result: trial.result(), time: trial.time, history: trial.history, agents: trial.agents }; };
    const before = run(baseline), after = run(candidate); assert.deepEqual(after, before);
    comparisons.push({ engine: "legacy-lab", seed, sha256: hash(before), historyRows: before.history.length });
  }
  for (const kind of ["hit", "critical", "followup", "miss", "parry", "block", "counter", "stun", "bleed-apply", "bleed",
    "area", "drain", "reflect", "regeneration", "death", "shoot"])
    assert.ok(observed.has(kind), "Missing real-server coverage: " + kind);
  const report = { baseline: "HEAD core source in isolated copy", compared: comparisons.length,
    equality: "exact result + HP/state checkpoints + damage/history rows + random sample counts",
    imageChanges: false, observedServerKinds: [...observed].sort(), comparisons };
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ compared: comparisons.length, observedServerKinds: report.observedServerKinds }));
} finally { rmSync(scratch, { recursive: true, force: true }); }
