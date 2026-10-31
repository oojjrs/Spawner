import test from "node:test";
import assert from "node:assert/strict";
import { COMBAT_LAB_UNITS, createCombatTrial } from "./combat-lab.mjs";

function settings(left, right, first, random, seed) {
  return { left: { key: left, combatStrength: COMBAT_LAB_UNITS.find(unit => unit.key === left).combatStrength, health: 100 },
    right: { key: right, combatStrength: COMBAT_LAB_UNITS.find(unit => unit.key === right).combatStrength, health: 100 }, first, random, seed };
}

test("23종의 양쪽 피해를 교전 시작에 고정하고 명중마다 한쪽 체력만 차감한다", () => {
  assert.equal(COMBAT_LAB_UNITS.length, 23);
  const trial = createCombatTrial(settings("bean", "bean", "left", false, 1));
  trial.step();
  assert.deepEqual(trial.agents.map(agent => agent.health), [100, 85]);
  assert.equal(trial.history.length, 1);
  assert.equal(trial.history[0].attackerId, "left");
  assert.equal(trial.history[0].counter, false);
  trial.step();
  assert.deepEqual(trial.agents.map(agent => agent.health), [85, 85]);
  assert.equal(trial.history[1].counter, true);
  assert.deepEqual([trial.history[1].leftStrength, trial.history[1].rightStrength], [20, 20]);
});

test("동일 전투력은 양쪽의 일곱 번째 확정 피해까지 명중한 뒤 동시 사망한다", () => {
  for (const first of ["left", "right"]) {
    const trial = createCombatTrial(settings("bean", "bean", first, false, 1));
    assert.equal(trial.finish(), "draw");
    assert.equal(trial.history.length, 14);
    assert.deepEqual(trial.history.map(hit => hit.counter), [false, true, false, true, false, true, false, true, false, true, false, true, false, true]);
    assert.deepEqual(trial.agents.map(agent => agent.health), [0, 0]);
    trial.step();
    assert.equal(trial.history.length, 14);
  }
});

test("부엉이와의 세 교전은 각 교전 시작 전투력으로 피해를 고정한다", () => {
  const trial = createCombatTrial(settings("bean", "talon-owl", "left", false, 1));
  assert.equal(trial.finish(), "right");
  assert.equal(trial.history.length, 6);
  assert.deepEqual(trial.agents.map(agent => agent.health), [0, 85]);
  assert.deepEqual(trial.history.map(row => [row.leftStrength, row.rightStrength]), [[20, 44], [20, 44], [16, 43], [16, 43], [12, 43], [12, 43]]);
  assert.deepEqual(trial.history.map(row => [row.leftDamage, row.rightDamage]), [[0, 6], [39, 0], [44, 0], [0, 5], [0, 4], [52, 0]]);
});

test("체력 50과 100인 새싹콩은 첫 공격 방향과 무관하게 시작 전투력 15와 20을 쓴다", () => {
  for (const first of ["left", "right"]) {
    const config = settings("bean", "bean", first, false, 1);
    config.left.health = 50;
    const trial = createCombatTrial(config);
    trial.step();
    assert.deepEqual([trial.history[0].leftStrength, trial.history[0].rightStrength], [15, 20]);
    assert.deepEqual(trial.agents.map(agent => agent.health), first === "left" ? [50, 88] : [32, 100]);
    trial.step();
    assert.deepEqual(trial.agents.map(agent => agent.health), [32, 88]);
    assert.deepEqual([trial.history[1].leftStrength, trial.history[1].rightStrength], [15, 20]);
    assert.equal(trial.agents[0].stats.combatStrength, 20);
  }
});

test("생물끼리도 강제 대결할 수 있고 같은 시드는 같은 결과를 낸다", () => {
  const config = settings("shadow-weasel", "vine-turtle", "right", true, 73);
  const first = createCombatTrial(config), second = createCombatTrial(config);
  assert.equal(first.finish(), "left");
  second.finish();
  assert.deepEqual(first.history, second.history);
  assert.equal(first.history[0].attackerId, "right");
});

test("자동 진행과 한 교전씩 진행은 피해를 중복 적용하지 않는다", () => {
  const config = settings("bean", "pebble", "left", true, 17);
  const stepped = createCombatTrial(config), continuous = createCombatTrial(config);
  stepped.finish();
  for (let index = 0; index < 3000 && !continuous.result(); index++) continuous.advance(1 / 60);
  assert.equal(continuous.result(), stepped.result());
  assert.deepEqual(continuous.agents.map(agent => agent.health), stepped.agents.map(agent => agent.health));
  assert.deepEqual(continuous.history.map(row => [row.leftDamage, row.rightDamage]), stepped.history.map(row => [row.leftDamage, row.rightDamage]));
});

test("첫 타격에 죽어도 확정 반격 명중까지 결과를 기다리고 원본 수치는 보존한다", () => {
  const config = settings("bean", "bean", "left", false, 1);
  config.left.health = config.right.health = 1;
  const trial = createCombatTrial(config);
  trial.step();
  assert.equal(trial.result(), null);
  assert.deepEqual(trial.agents.map(agent => agent.health), [1, 0]);
  assert.equal(trial.history.length, 1);
  assert.equal(trial.finish(), "draw");
  assert.deepEqual(trial.agents.map(agent => agent.health), [0, 0]);
  assert.equal(trial.history.length, 2);
  assert.equal(COMBAT_LAB_UNITS.find(unit => unit.key === "bean").health, 100);
});
