import test from "node:test";
import assert from "node:assert/strict";
import { createCombat } from "./combat.mjs";
import { combatProfile, migrateCombatStats, UNIT_COMBAT_STATS, unitCombatStats } from "./combat-stats.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { deriveSimulationStats } from "../client/combat-simulation.mjs";

function fixture(mode, rolls, accuracy) {
  const dna = { ...ATTRIBUTE_DNA.stats([]), melee: true, meleePower: 20, meleeSpeed: .5, power: 20,
    focus: .3, hits: 1, accuracy, critical: 0, stun: 0, bleed: 0, area: 0, lifesteal: 0 };
  const source = { id: "a", ownerId: "left", tribe: "bean", x: 100, y: 100, health: 1000,
    stats: { health: 1000, speed: 1, vision: 3, ...(mode === "dna" ? { dna } : {}) },
    attributes: {}, combatDisposition: "aggressive", moveDuration: 0 };
  if (mode === "ranged") { source.species = "lantern-keeper"; source.tribe = undefined; }
  const target = { id: "b", ownerId: "right", species: "vine-turtle", x: 100, y: 100, health: 1000,
    stats: { ...unitCombatStats("vine-turtle"), health: 1000, speed: 1, vision: 3 },
    attributes: {}, combatDisposition: "aggressive", moveDuration: 0, attackReady: 100 };
  const events = [], queue = [...rolls];
  const environment = { games: new Map(), colonies: [], simSeconds: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(4) },
    combatRandom: () => queue.length ? queue.shift() : .99, damageRandom: () => .5,
    onCombatEvent(event) { events.push(event); } };
  for (const unit of [source, target]) environment.games.set(unit.ownerId, { agents: [unit],
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const combat = createCombat(environment);
  const species = source.species;
  source.species = undefined; combat.engage(source, target, 0); source.species = species;
  for (let frame = 0; frame <= 2000; frame++) {
    environment.simSeconds = frame / 100;
    combat.update(source, environment.simSeconds);
    if (events.some(event => event.sourceId === source.id && event.targetId === target.id && ["hit", "miss", "parry", "block"].includes(event.kind))) break;
  }
  return { source, target, events, outcome: events.find(event => event.sourceId === source.id && event.targetId === target.id && ["hit", "miss", "parry", "block"].includes(event.kind)) };
}

test("every native creature receives bounded defensive chances in both runtime and laboratory", () => {
  const keys = Object.keys(UNIT_COMBAT_STATS).filter(key => !["bean", "spore", "pebble", "spring"].includes(key));
  assert.equal(keys.length, 19);
  for (const species of keys) {
    const runtime = combatProfile({ species, stats: {} }), laboratory = deriveSimulationStats({ key: species });
    for (const key of ["evasion", "parry", "block", "blockReduction"]) {
      assert.ok(runtime[key] >= 0 && runtime[key] < 1, species + ":" + key);
      assert.equal(runtime[key], laboratory[key]);
    }
  }
  assert.ok(unitCombatStats("dew-rabbit").evasion > unitCombatStats("vine-turtle").evasion);
  assert.ok(unitCombatStats("vine-turtle").block > unitCombatStats("dew-rabbit").block);
  assert.ok(unitCombatStats("spring-keeper").parry > unitCombatStats("bundle-snail").parry);
});

for (const mode of ["native", "dna", "ranged"]) {
  test(mode + " attacks resolve each neutral defense in the authoritative engine", () => {
    const normal = fixture(mode, [.99, .99, .99], 0);
    assert.equal(normal.outcome.kind, "hit");
    const reactions = mode === "ranged" ? [["miss", [0]], ["block", [.99, 0]]] :
      [["miss", [0]], ["parry", [.99, 0]], ["block", [.99, .99, 0]]];
    for (const [kind, rolls] of reactions) {
      const defended = fixture(mode, rolls, 0);
      assert.equal(defended.outcome.kind, kind);
      if (kind === "block") assert.ok(Math.abs(defended.outcome.amount - normal.outcome.amount * .5) < 1e-9);
      else assert.equal(defended.target.health, 1000);
      assert.equal(defended.events.some(event => event.kind === "counter" && event.sourceId === "b"), false);
      assert.equal(defended.source.attack.hit, kind === "block");
    }
  });
}

test("accuracy cancels neutral evasion without disabling parry or block", () => {
  const result = fixture("dna", [0, .99, .99], 100);
  assert.equal(result.outcome.kind, "hit");
});

test("old neutral saves gain defense while preserving health and the action clock", () => {
  const agent = { species: "vine-turtle", health: 37, attackReady: 9, stats: { health: 100, combatStrength: 28 } };
  migrateCombatStats(agent);
  assert.equal(agent.health, unitCombatStats(agent.species).health * .37); assert.equal(agent.attackReady, 9);
  for (const key of ["evasion", "parry", "block", "blockReduction"]) assert.equal(agent.stats[key], unitCombatStats(agent.species)[key]);
});
