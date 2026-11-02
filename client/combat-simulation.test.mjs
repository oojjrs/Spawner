import test from "node:test";
import assert from "node:assert/strict";
import { SIMULATION_STATS, DEFAULT_SIMULATION_RULES, deriveSimulationStats, createSimulationTrial } from "./combat-simulation.mjs";

function build(counts) {
  return { key: "bean", counts };
}

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-10, actual + " differs from " + expected);
}

test("log first point equals configured gain and later marginal gains diminish", () => {
  const zero = deriveSimulationStats(build({ power: 0 }));
  const one = deriveSimulationStats(build({ power: 1 }));
  const two = deriveSimulationStats(build({ power: 2 }));
  const three = deriveSimulationStats(build({ power: 3 }));
  close(one.attackPower - zero.attackPower, DEFAULT_SIMULATION_RULES.powerGain);
  assert.ok(two.attackPower - one.attackPower < one.attackPower - zero.attackPower);
  assert.ok(three.attackPower - two.attackPower < two.attackPower - one.attackPower);
  close(deriveSimulationStats(build({ power: 80 }), { powerCurve: "linear" }).attackPower, 162);
  close(deriveSimulationStats(build({ vitality: 3 })).health, 40);
});

test("saturating probabilities and defense approach their explicit caps without exceeding them", () => {
  const stats = deriveSimulationStats(build(Object.fromEntries(SIMULATION_STATS.map(stat => [stat.key, 80]))));
  for (const [field, rule] of [["critChance", "critCap"], ["armorPenetration", "percentPenCap"], ["evasion", "dodgeCap"],
    ["parry", "parryCap"], ["block", "blockCap"], ["counter", "counterCap"], ["tenacity", "tenacityCap"], ["drain", "drainCap"]]) {
    assert.ok(stats[field] > 0 && stats[field] < DEFAULT_SIMULATION_RULES[rule]);
  }
  assert.ok(stats.critMultiplier < 3);
  assert.ok(stats.followupMultiplier <= 1);
  const left = build({ power: 1 }), right = build({ armor: 1 });
  const trial = createSimulationTrial({ left, right, random: false, rules: { maxSeconds: 1 } }); trial.step();
  const hit = trial.history.find(row => row.attackerId === "left" && row.kind === "hit");
  close(hit.damage, 4 * (1 - .7 * 12 / (12 + 60)));
});

test("timing floors and multi-hit cycle budget prevent independent speed multipliers", () => {
  const stats = deriveSimulationStats(build({ focus: 80, hitSpeed: 80, multiHit: 80, haste: 80 }));
  close(stats.windup, .08); close(stats.hitGap, .06);
  assert.equal(stats.hitCount, 81);
  assert.ok(stats.attackInterval >= stats.windup + 80 * stats.hitGap + stats.recovery);
  assert.ok(stats.attackSpeed <= stats.targetAttackSpeed && stats.attackSpeed <= 4);
  assert.equal(stats.pieceCount, 323);
});

test("per-hit stun allocation preserves action-level probability and has one proc per action", () => {
  const stats = deriveSimulationStats(build({ stun: 4, multiHit: 7 }));
  close(1 - Math.pow(1 - stats.stunChancePerHit, stats.hitCount), stats.stunChance);
  const trial = createSimulationTrial({ left: build({ stun: 1, multiHit: 2, vitality: 80 }), right: build({ vitality: 80 }), random: false,
    rules: { stunCap: 1, stunKnee: 0, stunDurationBase: .2, stunDurationCap: .2, stunImmunity: 2, maxSeconds: 1 } });
  trial.finish();
  assert.equal(trial.history.filter(row => row.kind === "stun").length, 1);
  const stun = trial.history.find(row => row.kind === "stun"); close(stun.stunDuration, .2);
  assert.ok(trial.agents[1].combat.stunImmuneUntil >= 2.5);
});

test("seeded outcomes replay exactly with jitter disabled while chance rolls remain active", () => {
  const settings = { left: build({ crit: 3, stun: 2, multiHit: 3, vitality: 4 }), right: build({ armor: 2, block: 3, vitality: 4 }), seed: "replay", random: false };
  const first = createSimulationTrial(settings), second = createSimulationTrial(settings), stepped = createSimulationTrial(settings);
  first.finish(); second.finish();
  while (!stepped.reason) stepped.step();
  assert.deepEqual(first.history, second.history);
  assert.deepEqual(first.history, stepped.history);
  assert.deepEqual(first.result(), second.result());
  const forced = createSimulationTrial({ left: build({ crit: 1 }), right: build({}), random: false,
    rules: { critCap: 1, critKnee: 0, maxSeconds: 1 } }); forced.step();
  assert.equal(forced.history.find(row => row.attackerId === "left").critical, true);
});

test("exact simultaneous lethal hits apply to the same alive snapshot", () => {
  const trial = createSimulationTrial({ left: build({}), right: build({}), random: false, first: "simultaneous", rules: { healthBase: 2 } });
  assert.equal(trial.finish().winner, "draw"); assert.equal(trial.reason, "death");
  assert.equal(trial.agents[0].health, 0); assert.equal(trial.agents[1].health, 0);
  assert.equal(trial.history.filter(row => row.kind === "hit").length, 2);
  close(trial.time, .3);
});

test("death cancels later hits and finish cannot produce postmortem attacks", () => {
  const trial = createSimulationTrial({ left: build({ power: 80, multiHit: 4 }), right: build({ power: 80 }), random: false, first: "left", rules: { powerCurve: "linear" } });
  const outcome = trial.finish(); assert.equal(outcome.winner, "left");
  assert.equal(trial.history.filter(row => row.kind === "hit").length, 1);
  assert.ok(trial.history.every(row => row.time <= outcome.time));
  const previous = trial.history.length; trial.advance(100); trial.step(); trial.finish();
  assert.equal(trial.history.length, previous);
  assert.ok(trial.agents.every(agent => agent.attack === null));
});

test("defensive counter replaces a prepared action and cannot chain or repeat for the same incoming action", () => {
  const left = { ...build({ vitality: 80, multiHit: 3, focus: 1 }), organs: { attack: true, armor: false, legs: false } };
  const right = build({ vitality: 80, parry: 1, counter: 1 });
  const trial = createSimulationTrial({ left, right, random: false,
    rules: { parryCap: 1, parryKnee: 0, counterCap: 1, counterKnee: 0, reactionCooldown: 0, counterCooldown: 0, maxSeconds: 1 } });
  trial.advance(.28);
  assert.equal(trial.agents[1].attack.counter, true);
  assert.equal(trial.agents[1].attack.hitCount, 1);
  close(trial.agents[1].combat.nextAttackAt, 2.28);
  trial.finish();
  assert.equal(trial.history.filter(row => row.kind === "counter").length, 1);
  assert.ok(trial.history.filter(row => row.attackerId === "right" && row.damage > 0).every(row => row.counter));
  const both = createSimulationTrial({ left: right, right, random: false,
    rules: { parryCap: 1, parryKnee: 0, counterCap: 1, counterKnee: 0, reactionCooldown: 0, counterCooldown: 0, maxSeconds: 1 } });
  both.finish(); assert.equal(both.history.filter(row => row.kind === "counter").length, 2);
});

test("organ gates remove unavailable actions and zero-offense trials terminate immediately", () => {
  const full = Object.fromEntries(SIMULATION_STATS.map(stat => [stat.key, 80]));
  const gated = { key: "bean", counts: full, organs: { attack: false, armor: false, legs: false } };
  const stats = deriveSimulationStats(gated);
  assert.equal(stats.attackPower, 0); assert.equal(stats.defense, 0); assert.equal(stats.parry, 0);
  assert.equal(stats.block, 0); assert.equal(stats.evasion, 0); assert.equal(stats.canAttack, false);
  const trial = createSimulationTrial({ left: gated, right: gated });
  assert.deepEqual(trial.finish(), { winner: "draw", reason: "no-offense", time: 0, leftHealth: 810, rightHealth: 810 });
  assert.equal(trial.history.length, 0);
  assert.equal(deriveSimulationStats({ key: "bean" }).pieceCount, 3);
});

test("invalid counts, organs, probabilities, rule names, clocks and settings fail clearly", () => {
  for (const count of [-1, .5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "1"]) assert.throws(() => deriveSimulationStats(build({ power: count })), /count/);
  assert.throws(() => deriveSimulationStats(build({ unknown: 1 })), /Unknown count/);
  assert.throws(() => deriveSimulationStats({ key: "bean", organs: { armor: 1 } }), /boolean/);
  assert.throws(() => deriveSimulationStats(build({}), { dodgeCap: 1.1 }), /between 0 and 1/);
  assert.throws(() => deriveSimulationStats(build({}), { jitter: .21 }), /jitter/);
  assert.throws(() => deriveSimulationStats(build({}), { powerKnee: 0 }), /positive/);
  assert.throws(() => deriveSimulationStats(build({}), { invented: 1 }), /Unknown rule/);
  assert.throws(() => createSimulationTrial({ left: build({}), right: build({}), first: "random" }), /first/);
  const trial = createSimulationTrial({ left: build({}), right: build({}) });
  assert.throws(() => trial.advance(-1), /nonnegative/);
});

test("fractional armor and follow-up damage have no artificial one-damage floor", () => {
  const trial = createSimulationTrial({ left: build({ multiHit: 1 }), right: build({ armor: 80, vitality: 80 }), random: false,
    rules: { maxSeconds: 1, followupBase: .01, followupCap: .01 } }); trial.finish();
  const hits = trial.history.filter(row => row.attackerId === "left" && row.kind === "hit");
  assert.equal(hits.length, 2); assert.ok(hits[1].damage > 0 && hits[1].damage < .02);
  close(hits[1].damage / hits[0].damage, .01);
});


test("DNA piece counts accept 81 and 160 while guarding JS safe totals and finite derived values", () => {
  for (const count of [81, 160]) {
    const stats = deriveSimulationStats(build({ power: count, multiHit: count }));
    assert.equal(stats.pieceCount, count * 2 + 3);
    assert.equal(stats.hitCount, count + 1);
    assert.ok(Number.isFinite(stats.attackPower));
    assert.ok(Number.isFinite(stats.attackInterval));
    assert.equal(Object.hasOwn(stats, "slotCount"), false);
  }
  const maximum = Number.MAX_SAFE_INTEGER;
  assert.equal(deriveSimulationStats(build({ power: maximum - 3 })).pieceCount, maximum);
  const manyHits = deriveSimulationStats(build({ multiHit: maximum - 4, stun: 1 }));
  assert.ok(manyHits.stunChancePerHit > 0);
  assert.throws(() => deriveSimulationStats(build({ power: maximum + 1 })), /safe integer/);
  assert.throws(() => deriveSimulationStats(build({ power: maximum })), /Total piece count/);
  assert.throws(() => deriveSimulationStats(build({ power: maximum - 5, vitality: 4 })), /Total piece count/);
  assert.throws(() => deriveSimulationStats(build({ power: 160 }), { powerKnee: Number.MIN_VALUE }), /Derived attackPower must be finite/);
  assert.throws(() => deriveSimulationStats(build({}), { attackRateBase: Number.MIN_VALUE }), /Derived attackInterval must be finite/);
  const noRate = deriveSimulationStats(build({}), { attackRateBase: 0 });
  assert.equal(noRate.attackInterval, Infinity); assert.equal(noRate.canAttack, false);
});
