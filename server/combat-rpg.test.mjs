import test from "node:test";
import assert from "node:assert/strict";
import { createCombat } from "./combat.mjs";
import { combatPrimary, combatProfile, combatDamage } from "./combat-stats.mjs";
import { applyAgentGrowth } from "./growth.mjs";

function unit(id, ownerId, primary) {
  return { id, ownerId, tribe: "bean", combatDisposition: "aggressive", combatPrimary: primary,
    attributes: primary ? { [primary]: 1 } : {}, x: 100, y: 100, health: 10000,
    stats: { health: 10000, speed: 1, vision: 3 }, moveDuration: 0, moveStartedAt: 0 };
}

function fixture(units) {
  const environment = { games: new Map(), colonies: [], simSeconds: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(4) }, combatRandom: () => .99, damageRandom: () => .5 };
  for (const owner of new Set(units.map(agent => agent.ownerId))) environment.games.set(owner, {
    agents: units.filter(agent => agent.ownerId === owner),
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); }
  });
  const combat = createCombat(environment);
  function tick(time, reverse) {
    environment.simSeconds = time;
    for (const agent of reverse ? [...units].reverse() : units) combat.update(agent, time);
  }
  return { combat, tick, environment };
}

test("primary migration and equipped fallback preserve explicit choices", () => {
  assert.equal(combatPrimary({ slots: ["carapace", "blade"] }), "blade");
  assert.equal(combatPrimary({ slots: ["piercing"], combatPrimary: undefined }), "piercing");
  assert.equal(combatPrimary({ slots: [], attributes: { blade: 1 }, combatPrimary: "blade" }), null);
  assert.equal(combatPrimary({ attributes: { blade: 1 }, combatPrimary: null }), null);
  const attacker = unit("a", "a", "blade"), target = unit("b", "b", "carapace");
  const fullDamage = combatDamage(attacker, target, .5);
  attacker.health = 1;
  assert.equal(combatDamage(attacker, target, .5), fullDamage);
  assert.ok(combatProfile(attacker).attackSpeed > combatProfile(target).attackSpeed);
});

test("all units attack independently and repeated same-time calls do not advance combat", () => {
  const a = unit("a", "left", null), b = unit("b", "right", null), c = unit("c", "left", null);
  const f = fixture([a, b, c]); f.tick(0);
  assert.ok(a.attack && b.attack && c.attack);
  f.tick(.4);
  assert.ok(a.health < 10000 && b.health < 10000);
  const health = [a.health, b.health, c.health];
  f.tick(.4, true); assert.deepEqual([a.health, b.health, c.health], health);
});

test("block consumes the defender attack and counter cannot trigger another counter", () => {
  const a = unit("a", "left", "carapace"), b = unit("b", "right", "carapace");
  const f = fixture([a, b]); f.tick(0); f.tick(.4);
  assert.equal(b.attack.counter, true);
  assert.equal(b.combat.attackCount, 1);
  assert.equal(b.combat.nextAttackAt, .4 + combatProfile(b).attackInterval);
  f.tick(.52);
  assert.equal(a.combat.blockReadyAt, 0);
  assert.equal(b.combat.blockReadyAt, 2.9);
  assert.equal(b.combat.attackCount, 1);
});

test("parry nullifies one hit and starts its independent cooldown", () => {
  const a = unit("a", "left", null), b = unit("b", "right", "blade");
  const f = fixture([a, b]); f.tick(0);
  a.attack.hitAt = .1; f.tick(.1);
  assert.equal(b.health, 10000);
  assert.equal(b.attack.counter, true);
  assert.equal(b.combat.parryReadyAt, 3.1);
  assert.equal(b.combat.nextAttackAt, .1 + combatProfile(b).attackInterval);
});

test("heavy thrust cancels preparation while shared immunity prevents repeated cancellation", () => {
  const a = unit("a", "left", "piercing"), b = unit("b", "right", null), c = unit("c", "left", "piercing");
  const f = fixture([a, b, c]); f.tick(0);
  a.attack.heavy = true; a.attack.hitAt = .1;
  c.attack.heavy = true; c.attack.hitAt = .2;
  f.tick(.1);
  assert.equal(b.combat.stunnedUntil, .6);
  assert.equal(b.combat.stunImmuneUntil, 2.6);
  assert.equal(b.attack, null);
  f.tick(.2);
  assert.equal(b.combat.stunnedUntil, .6);
  assert.equal(b.combat.nextAttackAt, 1.25);
  f.tick(.6); assert.equal(b.attack, null);
  f.tick(1.25); assert.ok(b.attack);
});

test("lethal hit deletes an unresolved victim attack without a postmortem counter", () => {
  const a = unit("a", "left", null), b = unit("b", "right", null);
  const f = fixture([a, b]); f.tick(0); b.health = 1;
  f.tick(.4);
  assert.equal(b.health, 0); assert.equal(b.attack, null);
  assert.equal(a.health, 10000); assert.equal(a.combat, null);
});

test("chronological combat is independent of update order and step subdivision", () => {
  const first = [unit("a", "left", "blade"), unit("b", "right", "piercing")];
  const second = structuredClone(first), coarse = fixture(first), fine = fixture(second);
  coarse.tick(0); coarse.tick(5, true);
  for (let i = 0; i <= 100; i++) fine.tick(i / 20, i % 2 === 0);
  assert.deepEqual(first.map(agent => agent.health), second.map(agent => agent.health));
  assert.deepEqual(first.map(agent => agent.combat.attackCount), second.map(agent => agent.combat.attackCount));
});


test("growth increases RPG attack without injury penalty or attribute double counting", () => {
  const agent = unit("a", "left", "blade"), target = unit("b", "right", null);
  agent.slots = ["blade"]; agent.attributeLevels = { blade: 1 };
  applyAgentGrowth(agent, 0);
  const before = combatProfile(agent), damage = combatDamage(agent, target, .5);
  assert.equal(before.attackPower, 12 + 20 * .35 + 12);
  agent.growthActivity = 243; applyAgentGrowth(agent, 0);
  assert.ok(combatProfile(agent).attackPower > before.attackPower);
  assert.ok(combatDamage(agent, target, .5) > damage);
  const grownDamage = combatDamage(agent, target, .5); agent.health = 1;
  assert.equal(combatDamage(agent, target, .5), grownDamage);
  agent.stats.attackSpeed = 100; assert.equal(combatProfile(agent).attackSpeed, 4);
  agent.stats.attackSpeed = -1; assert.ok(Math.abs(combatProfile(agent).attackInterval - .95) < 1e-12);
});

test("combat events affect only source and target while block reaction survives counter", () => {
  const a = unit("a", "left", null), b = unit("b", "right", "carapace"), c = unit("c", "left", null);
  const f = fixture([a, b, c]); f.tick(0);
  a.attack.hitAt = .1; f.tick(.1);
  assert.equal(b.combat.lastReaction.kind, "block");
  assert.equal(b.combat.lastEvent.kind, "counter");
  assert.equal(c.combat.lastEvent, undefined);
  const previousId = b.combat.lastEvent.id, sequence = b.combat.eventSequence;
  const restored = fixture([a, b, c]);
  a.attack.resolved = false; a.attack.hitAt = .15;
  b.combat.blockReadyAt = 0;
  restored.tick(.15);
  assert.ok(b.combat.eventSequence > sequence);
  assert.notEqual(b.combat.lastEvent.id, previousId);
  assert.equal(c.combat.lastEvent, undefined);
});


test("RPG animation maps the exact hit and end boundaries to native metadata", async () => {
  const { attackAnimationElapsed, agentAttackFrame, AGENT_ATTACK_HIT_FRAME, AGENT_ATTACK_HIT_TIME, AGENT_ATTACK_DURATION } = await import("./attack.mjs");
  const { beetleAnimationPose, beetleAnimationFrame, BEETLE_ANIMATIONS } = await import("./beetle-animation.mjs");
  const { unitAnimationPose, creatureAttackPose, unitAnimationFrame, CREATURE_ATTACK_ANIMATIONS } = await import("../client/unit-animation.mjs");
  const { CREATURE_ATTACK_TIMINGS } = await import("./creature-attack.mjs");
  const { combatEvolutionPose } = await import("../client/combat-evolution.mjs");
  const { COMBAT_EVOLUTION_CATALOG } = await import("../client/combat-evolution-assets.mjs");
  const attack = { combatId: "test", startedAt: 1, hitAt: 1.12, endsAt: 1.57, speed: 2 };
  assert.equal(attackAnimationElapsed(attack, attack.hitAt, AGENT_ATTACK_HIT_TIME, AGENT_ATTACK_DURATION), AGENT_ATTACK_HIT_TIME);
  assert.equal(agentAttackFrame(attack, attack.hitAt), AGENT_ATTACK_HIT_FRAME);
  assert.equal(agentAttackFrame(attack, attack.endsAt), -1);
  assert.equal(attackAnimationElapsed({ ...attack, exchange: {} }, 1.2, .3, 1), (1.2 - 1) * 2);
  const agent = { health: 100, tribe: "bean", attack, combat: { version: 2 }, hurtStartedAt: attack.hitAt };
  assert.equal(unitAnimationPose(agent, attack.hitAt).action, "attack");
  assert.equal(unitAnimationPose(agent, attack.hitAt).frame, AGENT_ATTACK_HIT_FRAME);
  assert.notEqual(unitAnimationPose(agent, attack.endsAt).action, "attack");
  const animations = COMBAT_EVOLUTION_CATALOG["sprout/blade"].animations;
  assert.equal(combatEvolutionPose(agent, attack.hitAt, animations).elapsed, AGENT_ATTACK_HIT_TIME * 1000);
  agent.species = "flower-tail-bird";
  const native = CREATURE_ATTACK_TIMINGS[agent.species], animation = CREATURE_ATTACK_ANIMATIONS[agent.species];
  assert.equal(creatureAttackPose(agent, attack.hitAt).frame, unitAnimationFrame(animation, native.hitTimeMs));
  assert.equal(creatureAttackPose(agent, attack.endsAt), null);
  agent.species = "spiny-back-beetle"; agent.mode = "attack";
  assert.deepEqual(beetleAnimationPose(agent, attack.hitAt), { action: "attack", frame: beetleAnimationFrame("attack", BEETLE_ANIMATIONS.attack.hitTimeMs) });
  assert.notEqual(beetleAnimationPose(agent, attack.endsAt).action, "attack");
});


test("captured peaceful creatures defend themselves and escape without losing work or movement handoff", () => {
  const a = unit("a", "left", null), b = unit("b", null, null);
  a.combatDisposition = "peaceful";
  a.productionRole = "military";
  a.utility = { action: "collect", target: { x: 102, y: 100 }, plannedCargo: 2 };
  b.species = "flower-tail-bird"; b.combatDisposition = "peaceful";
  const f = fixture([a, b]); f.tick(0);
  assert.equal(a.combat, undefined); assert.equal(b.combat, undefined);
  assert.equal(a.attack, undefined); assert.equal(b.attack, undefined);
  a.combatDisposition = "aggressive"; f.tick(.1); f.tick(.5);
  assert.ok(a.health < 10000); assert.ok(b.health < 10000);
  assert.deepEqual(a.suspendedWork, { action: "collect", target: { x: 102, y: 100 }, plannedCargo: 2 });
  f.environment.combatRandom = () => 0; f.tick(1.6);
  assert.equal(a.combat, null); assert.equal(b.combat, null);
  assert.equal(a.decisionPending, "combatEnded");
  assert.equal(a.nextDecisionAt, 1.6);
  assert.equal(a.suspendedWork.action, "collect");
  assert.equal(Math.abs(b.x - 100) + Math.abs(b.y - 100), 1);
  assert.equal(b.renderFromX, 100); assert.equal(b.renderFromY, 100);
  assert.equal(b.mode, "walk"); assert.equal(b.attack, null);
  assert.equal(b.nextActionAt, b.moveStartedAt + b.moveDuration);
  assert.ok(b.escapeUntil > b.nextActionAt);
});
