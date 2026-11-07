import test from "node:test";
import assert from "node:assert/strict";
import { unitAttackCooldown } from "./unit-attack-ring.mjs";
import { createCombat } from "../server/combat.mjs";
import { combatPositionRadius } from "../server/combat-position.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";

const dna = { ...ATTRIBUTE_DNA.stats([]), melee: true, ranged: true, meleePower: 10, rangedPower: 10,
  meleeSpeed: .5, rangedSpeed: 2, power: 10, hits: 1, focus: .3, movement: .25 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, actual + " != " + expected);

test("cooldown stays empty through the attack and fills from zero to ready using simulation time", () => {
  const agent = Object.freeze({ health: 100, stats: Object.freeze({ dna }), attackReady: 4, attackInterval: 2,
    attack: Object.freeze({ startedAt: 1, endsAt: 2, interval: 2 }) });
  for (const time of [1, 1.5, 1.99, 2]) assert.equal(unitAttackCooldown(agent, time), 0);
  assert.equal(unitAttackCooldown(agent, 3), .5); assert.equal(unitAttackCooldown(agent, 4), 1);
  assert.equal(unitAttackCooldown(agent, 9), 1); assert.equal(unitAttackCooldown(agent, 3), .5);
  assert.equal(unitAttackCooldown({ ...agent, attack: null }, 3), .5);
});

test("dead and non-attacking units have no attack ring", () => {
  for (const agent of [null, { health: 0 }, { health: 10, stats: { dna: ATTRIBUTE_DNA.stats([]) } },
    { health: 10, stats: { dna: { ...dna, meleeSpeed: 0, rangedSpeed: 0 } } },
    { health: 10, stats: { canAttack: false } }]) assert.equal(unitAttackCooldown(agent, 1), null);
  assert.equal(unitAttackCooldown({ health: 10, species: "vine-turtle", stats: {}, attackReady: 0 }, 0), 1);
});

test("defense reset is ready immediately and a new action empties the ring again", () => {
  const agent = { health: 100, stats: { dna }, attackReady: 2, attackInterval: 2,
    attack: { startedAt: 1, endsAt: 2, interval: 2, defenseResetAt: 1.2 } };
  assert.equal(unitAttackCooldown(agent, 1.2), 1);
  const next = { ...agent, attackReady: 5, attack: { startedAt: 2, endsAt: 3, interval: 2 } };
  assert.equal(unitAttackCooldown(next, 2), 0); assert.equal(unitAttackCooldown(next, 4), .5);
  assert.equal(unitAttackCooldown({ ...agent, attack: null, attackReady: 1.2 }, 1.2), 1);
});

for (const world of [false, true]) test((world ? "world" : "battlefield") + " hybrid ranged attacks retain their selected interval after the action clears", () => {
  const source = { id: "a", ownerId: "left", tribe: "bean", x: 100, y: 100, health: 10000,
    attributes: {}, stats: { health: 10000, speed: 1, vision: 3, dna: { ...dna } }, combatDisposition: "aggressive", moveDuration: 0 };
  const target = { id: "b", ownerId: "right", tribe: "bean", x: world ? 102 : 100, y: 100, health: 10000,
    attributes: {}, stats: { health: 10000, speed: 1, vision: 3, dna: ATTRIBUTE_DNA.stats([]) }, combatDisposition: "aggressive", moveDuration: 0, attackReady: 100 };
  const environment = { games: new Map(), colonies: [], combatSimulation: true, simSeconds: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(4) }, combatRandom: () => .99, damageRandom: () => .5 };
  for (const unit of [source, target]) environment.games.set(unit.ownerId, { agents: [unit], receiveDamage(agent, amount) { agent.health -= amount; } });
  const combat = createCombat(environment);
  if (!world) {
    combat.engage(source, target, 0);
    const separation = combatPositionRadius(source) + combatPositionRadius(target) + 2;
    for (const [index, unit] of [source, target].entries()) Object.assign(unit.combat.position,
      { x: index ? separation : 0, y: 0, fromX: index ? separation : 0, fromY: 0 });
  }
  combat.update(source, 0);
  assert.equal(source.attack.attackMode, "ranged"); assert.equal(source.attackInterval, .5);
  const endsAt = source.attack.endsAt, readyAt = source.attackReady;
  assert.equal(unitAttackCooldown(source, endsAt - .001), 0);
  combat.update(source, endsAt); assert.equal(source.attack, null); close(unitAttackCooldown(source, endsAt), 0);
  close(unitAttackCooldown(source, (endsAt + readyAt) / 2), .5);
  close(unitAttackCooldown(JSON.parse(JSON.stringify(source)), (endsAt + readyAt) / 2), .5);
  close(unitAttackCooldown(source, readyAt), 1);
});

test("building attack snapshots use their real post-animation interval", () => {
  const agent = { health: 100, stats: { dna }, attackInterval: .5, attackReady: 4,
    attack: { startedAt: 1, endsAt: 2, targetKind: "nest" } };
  assert.equal(unitAttackCooldown(agent, 2), 0); assert.equal(unitAttackCooldown(agent, 3), .5);
});
