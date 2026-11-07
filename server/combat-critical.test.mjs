import test from "node:test";
import assert from "node:assert/strict";
import { createCombat } from "./combat.mjs";
import { combatProfile, unitCombatStats } from "./combat-stats.mjs";
import { combatPositionRadius } from "./combat-position.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";

function fixture(options) {
  const dna = { ...ATTRIBUTE_DNA.stats([]), melee: options.mode === "melee", ranged: options.mode === "ranged",
    meleePower: 20, rangedPower: 20, meleeSpeed: .5, rangedSpeed: .5, power: 20,
    focus: .3, hits: 1, accuracy: 0, critical: 20, criticalPower: 250 };
  const source = { id: "source", ownerId: "left", tribe: "bean", x: 100, y: 100, health: 10000,
    stats: { health: 10000, speed: 1, vision: 3 }, attributes: {}, combatDisposition: "aggressive", moveDuration: 0 };
  if (options.source === "dna") source.stats.dna = { ...dna, ...options.offense };
  else { source.species = options.mode === "ranged" ? "lantern-keeper" : "shadow-weasel"; source.stats = { ...unitCombatStats(source.species), ...source.stats }; }
  const target = { id: "target", ownerId: "right", tribe: "bean", x: options.world ? 102 : 100, y: 100,
    health: options.health || 10000, stats: { health: options.health || 10000, speed: 1, vision: 3 },
    attributes: {}, combatDisposition: "aggressive", moveDuration: 0, attackReady: Infinity };
  if (options.target === "dna") target.stats.dna = { ...ATTRIBUTE_DNA.stats([]), ...options.defense };
  else { target.species = "vine-turtle"; target.stats = { ...unitCombatStats(target.species), ...target.stats, ...options.defense }; }
  const events = [], queue = [...options.rolls];
  let draws = 0;
  const environment = { games: new Map(), colonies: [], simSeconds: 0, combatSimulation: true,
    world: { terrain: new Uint8Array(320 * 320).fill(4) }, damageRandom: () => .5,
    combatRandom() { draws++; return queue.length ? queue.shift() : .99; },
    onCombatEvent(event) { events.push(event); } };
  for (const agent of [source, target]) environment.games.set(agent.ownerId, { agents: [agent],
    receiveDamage(unit, amount) { unit.health = Math.max(0, unit.health - amount); } });
  const combat = createCombat(environment);
  if (!options.world) {
    assert.ok(combat.engage(source, target, 0));
    const separation = combatPositionRadius(source) + combatPositionRadius(target) + (options.mode === "ranged" ? 2.3 : .5);
    for (const [index, agent] of [source, target].entries()) Object.assign(agent.combat.position,
      { x: index ? separation : 0, y: 0, fromX: index ? separation : 0, fromY: 0 });
  }
  const tick = time => { environment.simSeconds = time; combat.update(source, time); };
  let outcome;
  for (let frame = 0; frame < 200 && !outcome; frame++) {
    tick(frame / 100);
    outcome = events.find(event => event.sourceId === source.id && event.targetId === target.id && ["hit", "miss", "parry", "block"].includes(event.kind));
  }
  assert.ok(outcome, "the authoritative attack reaches its target");
  return { source, target, events, outcome, tick, time: environment.simSeconds, draws: () => draws };
}

const paths = [
  { name: "native melee against native", source: "native", target: "native", mode: "melee" },
  { name: "native melee against DNA", source: "native", target: "dna", mode: "melee" },
  { name: "DNA melee against native", source: "dna", target: "native", mode: "melee" },
  { name: "DNA melee against DNA", source: "dna", target: "dna", mode: "melee" },
  { name: "native battlefield projectile", source: "native", target: "native", mode: "ranged" },
  { name: "native world projectile", source: "native", target: "dna", mode: "ranged", world: true },
  { name: "DNA projectile against native", source: "dna", target: "native", mode: "ranged" }
];

for (const path of paths) test(path.name + " applies one profile critical roll before HP mutation", () => {
  const normal = fixture({ ...path, rolls: [.99, .99, .99, .99] });
  const critical = fixture({ ...path, rolls: [.99, .99, .99, 0] });
  assert.equal(normal.outcome.critical, false); assert.equal(critical.outcome.critical, true);
  const multiplier = combatProfile(critical.source).criticalMultiplier;
  assert.ok(Math.abs(critical.outcome.amount - normal.outcome.amount * multiplier) < 1e-8);
  assert.ok(Math.abs(critical.target.stats.health - critical.target.health - critical.outcome.amount) < 1e-8);
  assert.equal(critical.draws(), path.source === "dna" || path.mode === "ranged" ? 6 : 4);
  const health = critical.target.health, draws = critical.draws();
  critical.tick(critical.time);
  assert.equal(critical.target.health, health); assert.equal(critical.draws(), draws);
  assert.equal(critical.events.filter(event => event.kind === "hit").length, 1);
  assert.ok(critical.outcome.causeId);
  if (path.mode === "ranged") {
    const shot = critical.events.find(event => event.kind === "shoot");
    assert.equal(critical.outcome.projectileId, shot.projectileId);
    assert.equal(critical.outcome.causeId, shot.causeId);
    assert.ok(critical.outcome.at > shot.at);
  }
});

for (const path of [paths[0], paths[1], paths[4], paths[5]]) test(path.name + " rolls after defense and never marks avoided damage critical", () => {
  const defense = path.target === "dna" ? { evasion: 10, parry: 10, block: 50, blockPower: 65 } : {};
  const normal = fixture({ ...path, defense, rolls: [.99, .99, .99, .99] });
  const block = fixture({ ...path, defense, rolls: [.99, .99, 0, 0] });
  assert.equal(block.outcome.kind, "block"); assert.equal(block.outcome.critical, true);
  assert.ok(Math.abs(block.outcome.amount - normal.outcome.amount * .35 * 1.5) < 1e-8);
  for (const [kind, rolls] of [["miss", [0]], ["parry", [.99, 0]]]) {
    const avoided = fixture({ ...path, defense, rolls });
    assert.equal(avoided.outcome.kind, kind); assert.equal(avoided.outcome.critical, false);
    assert.equal(avoided.outcome.amount, 0); assert.equal(avoided.target.health, avoided.target.stats.health);
    assert.equal(avoided.draws(), rolls.length);
  }
  const zeroDefense = path.target === "dna" ? { ...defense, blockPower: 100 } : { blockReduction: 1 };
  const zero = fixture({ ...path, defense: zeroDefense, rolls: [.99, .99, 0] });
  assert.equal(zero.outcome.kind, "block"); assert.equal(zero.outcome.critical, false);
  assert.equal(zero.outcome.amount, 0); assert.equal(zero.draws(), 3);
});

test("native critical probability uses the exact shared profile boundary", () => {
  const chance = unitCombatStats("shadow-weasel").criticalChance;
  const below = fixture({ ...paths[0], rolls: [.99, .99, .99, chance - 1e-8] });
  const boundary = fixture({ ...paths[0], rolls: [.99, .99, .99, chance] });
  assert.equal(below.outcome.critical, true); assert.equal(boundary.outcome.critical, false);
});

test("DNA critical chance and multiplier retain their existing percent contract", () => {
  const normal = fixture({ ...paths[2], offense: { critical: 0, criticalPower: 300 }, rolls: [.99, .99, .99, 0] });
  const critical = fixture({ ...paths[2], offense: { critical: 100, criticalPower: 300 }, rolls: [.99, .99, .99, .99] });
  assert.equal(normal.outcome.critical, false); assert.equal(critical.outcome.critical, true);
  assert.ok(Math.abs(critical.outcome.amount - normal.outcome.amount * 3) < 1e-8);
});

test("a lethal native critical retains the attack and death causal evidence", () => {
  const result = fixture({ ...paths[0], health: 1, rolls: [.99, .99, .99, 0] });
  assert.equal(result.outcome.critical, true); assert.equal(result.target.health, 0);
  assert.equal(result.events.find(event => event.kind === "death").causeId, result.outcome.id);
});
