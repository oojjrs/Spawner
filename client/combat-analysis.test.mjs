import test from "node:test";
import assert from "node:assert/strict";
import { runSimulationBatch, compareSimulationSwap } from "./combat-analysis.mjs";
import { deriveSimulationStats } from "./combat-simulation.mjs";

function settings() {
  return { left: { key: "left", organs: { attack: true, armor: true, legs: true }, counts: { power: 2, vitality: 3, crit: 2, evasion: 1 } },
    right: { key: "right", organs: { attack: true, armor: true, legs: true }, counts: { power: 3, vitality: 2, armor: 1, parry: 1 } },
    rules: {}, random: true, first: "simultaneous" };
}

test("같은 설정과 시드의 반복 분석은 완전히 같고 입력을 보존한다", () => {
  const input = settings(), before = structuredClone(input);
  const first = runSimulationBatch(input, 8, 4294967293);
  assert.deepEqual(runSimulationBatch(input, 8, 4294967293), first);
  assert.deepEqual(input, before);
  assert.deepEqual(first.samples.map(sample => sample.seed), [4294967293, 4294967294, 4294967295, 0, 1, 2, 3, 4]);
});

test("승패와 평균의 분모는 실제 반복 수이며 무공격과 시간 제한은 별도로 집계한다", () => {
  const input = settings();
  input.right.organs.attack = false;
  const wins = runSimulationBatch(input, 3, 0);
  assert.equal(wins.leftWins, 3);
  assert.equal(wins.leftWinRate, 1);
  assert.equal(wins.leftWins + wins.rightWins + wins.draws, wins.count);
  assert.ok(Math.abs(wins.meanDuration - wins.samples.reduce((sum, sample) => sum + sample.time, 0) / 3) < 1e-10);
  assert.ok(Math.abs(wins.meanLeftHealthRatio - wins.samples.reduce((sum, sample) => sum + sample.leftHealthRatio, 0) / 3) < 1e-10);
  input.left.organs.attack = false;
  const idle = runSimulationBatch(input, 3, 0);
  assert.equal(idle.draws, 3);
  assert.equal(idle.noOffense, 3);
  assert.equal(idle.timeouts, 0);
  assert.ok(idle.samples.every(sample => sample.leftHealth > 0 && sample.rightHealth > 0));
  const eventLimited = settings();
  eventLimited.rules.maxEvents = 1;
  assert.throws(() => runSimulationBatch(eventLimited, 3, 0), /event limit/i);
  const limited = settings();
  limited.rules.maxSeconds = .01;
  const timeout = runSimulationBatch(limited, 3, 0);
  assert.equal(timeout.draws, 3);
  assert.equal(timeout.timeouts, 3);
  assert.equal(timeout.noOffense, 0);
  assert.ok(timeout.samples.every(sample => sample.leftHealth > 0 && sample.rightHealth > 0));
});

test("한 조각 교체는 원본과 기관을 보존하고 같은 시드로 실제 변경된 설계를 비교한다", () => {
  const input = settings(), before = structuredClone(input);
  const report = compareSimulationSwap(input, "left", "power", "vitality", 8, 37);
  assert.deepEqual(input, before);
  assert.deepEqual(report.variantBuild.organs, input.left.organs);
  assert.equal(report.variantBuild.counts.power, input.left.counts.power - 1);
  assert.equal(report.variantBuild.counts.vitality, input.left.counts.vitality + 1);
  assert.equal(report.baselinePieces, report.variantPieces);
  assert.equal(report.baselinePieces, Object.values(input.left.counts).reduce((sum, value) => sum + value, 0) + 3);
  const oldProfile = deriveSimulationStats(input.left, input.rules), newProfile = deriveSimulationStats(report.variantBuild, input.rules);
  assert.ok(newProfile.health > oldProfile.health);
  assert.ok(newProfile.attackPower < oldProfile.attackPower);
  assert.deepEqual(report.baseline, runSimulationBatch(input, 8, 37));
  assert.deepEqual(report.variant, runSimulationBatch({ ...input, left: report.variantBuild }, 8, 37));
  assert.deepEqual(report.baseline.samples.map(sample => sample.seed), report.variant.samples.map(sample => sample.seed));
  assert.equal(report.deltaWinRate, report.variant.leftWinRate - report.baseline.leftWinRate);
  const score = sample => sample.winner === "left" ? 1 : sample.winner === "draw" ? .5 : 0;
  const differences = report.variant.samples.map((sample, index) => score(sample) - score(report.baseline.samples[index]));
  assert.equal(report.pairedImproved, differences.filter(value => value > 0).length);
  assert.equal(report.pairedWorsened, differences.filter(value => value < 0).length);
  assert.equal(report.pairedUnchanged, differences.filter(value => value === 0).length);
  assert.equal(report.pairedImproved + report.pairedWorsened + report.pairedUnchanged, report.count);
});

test("반복 수·시드·교체 속성·남은 수량의 잘못된 지정을 거절한다", () => {
  const input = settings();
  for (const count of [0, 2001, 1.5, NaN]) assert.throws(() => runSimulationBatch(input, count, 0));
  for (const seed of [-1, 4294967296, .5, NaN]) assert.throws(() => runSimulationBatch(input, 1, seed));
  for (const [side, remove, add] of [["middle", "power", "armor"], ["left", "attack", "power"],
    ["left", "power", "attack"], ["left", "power", "power"], ["left", "drain", "power"]])
    assert.throws(() => compareSimulationSwap(input, side, remove, add, 1, 0));
  input.left.counts.armor = 80;
  const expanded = compareSimulationSwap(input, "left", "power", "armor", 1, 0);
  assert.equal(expanded.variantBuild.counts.armor, 81);
  assert.equal(expanded.baselinePieces, expanded.variantPieces);
});
