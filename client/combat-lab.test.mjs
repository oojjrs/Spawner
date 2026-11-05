import test from "node:test";
import assert from "node:assert/strict";
import { canPursueCombat } from "../server/combat.mjs";
import { COMBAT_LAB_UNITS, createCombatTrial } from "./combat-lab.mjs";

function settings(left, right, first, random, seed) {
  return { left: { key: left, combatStrength: COMBAT_LAB_UNITS.find(unit => unit.key === left).combatStrength, health: 100 },
    right: { key: right, combatStrength: COMBAT_LAB_UNITS.find(unit => unit.key === right).combatStrength, health: 100 }, first, random, seed };
}

test("23종의 독립 공격은 명중마다 한쪽 체력만 차감한다", () => {
  assert.equal(COMBAT_LAB_UNITS.length, 23);
  const trial = createCombatTrial(settings("bean", "bean", "left", false, 1));
  trial.step();
  assert.deepEqual(trial.agents.map(agent => agent.health), [100, 84]);
  assert.equal(trial.history.length, 1);
  assert.equal(trial.history[0].attackerId, "left");
  assert.equal(trial.history[0].counter, false);
  trial.step();
  assert.deepEqual(trial.agents.map(agent => agent.health), [84, 84]);
  assert.equal(trial.history[1].counter, false);
  assert.ok(trial.history[1].time > trial.history[0].time);
  assert.deepEqual([trial.history[1].leftStrength, trial.history[1].rightStrength], [20, 20]);
});

test("동일 전투력은 선공의 일곱 번째 명중으로 종료하고 사망자의 예약 공격은 취소한다", () => {
  for (const first of ["left", "right"]) {
    const trial = createCombatTrial(settings("bean", "bean", first, false, 1));
    assert.equal(trial.finish(), first);
    assert.equal(trial.history.length, 13);
    assert.ok(trial.history.every(hit => hit.counter === false));
    assert.deepEqual(trial.agents.map(agent => agent.health), first === "left" ? [4, 0] : [0, 4]);
    assert.ok(trial.agents.every(agent => !agent.attack));
    trial.step();
    trial.advance(100);
    assert.equal(trial.history.length, 13);
  }
});

test("부엉이와의 독립 공격은 부상으로 기본 공격력과 피해를 낮추지 않는다", () => {
  const trial = createCombatTrial(settings("bean", "talon-owl", "left", false, 1));
  assert.equal(trial.finish(), "right");
  assert.equal(trial.history.length, 10);
  assert.deepEqual(trial.agents.map(agent => agent.health), [0, 25]);
  for (const hit of trial.history) {
    assert.deepEqual([hit.leftStrength, hit.rightStrength], [20, 44]);
    assert.deepEqual([hit.leftDamage, hit.rightDamage], hit.attackerId === "left" ? [0, 15] : [24, 0]);
  }
});

test("체력 50과 100인 새싹콩은 첫 공격 방향과 무관하게 같은 공격력을 쓴다", () => {
  for (const first of ["left", "right"]) {
    const config = settings("bean", "bean", first, false, 1);
    config.left.health = 50;
    const trial = createCombatTrial(config);
    trial.step();
    assert.deepEqual([trial.history[0].leftStrength, trial.history[0].rightStrength], [20, 20]);
    assert.deepEqual(trial.agents.map(agent => agent.health), first === "left" ? [50, 84] : [34, 100]);
    trial.step();
    assert.deepEqual(trial.agents.map(agent => agent.health), [34, 84]);
    assert.deepEqual([trial.history[1].leftStrength, trial.history[1].rightStrength], [20, 20]);
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

test("자동 진행과 한 명중씩 진행은 피해를 중복 적용하지 않는다", () => {
  const config = settings("bean", "pebble", "left", true, 17);
  const stepped = createCombatTrial(config), continuous = createCombatTrial(config);
  stepped.finish();
  for (let index = 0; index < 3000 && !continuous.result(); index++) continuous.advance(1 / 60);
  assert.equal(continuous.result(), stepped.result());
  assert.deepEqual(continuous.agents.map(agent => agent.health), stepped.agents.map(agent => agent.health));
  assert.deepEqual(continuous.history.map(row => [row.leftDamage, row.rightDamage]), stepped.history.map(row => [row.leftDamage, row.rightDamage]));
});

test("첫 타격에 사망하면 반격 없이 끝나고 원본 수치는 보존한다", () => {
  for (const first of ["left", "right"]) {
    const config = settings("bean", "bean", first, false, 1);
    config.left.health = config.right.health = 1;
    const original = structuredClone(config);
    const trial = createCombatTrial(config);
    trial.step();
    assert.equal(trial.result(), first);
    assert.deepEqual(trial.agents.map(agent => agent.health), first === "left" ? [1, 0] : [0, 1]);
    assert.equal(trial.finish(), first);
    assert.equal(trial.history.length, 1);
    assert.deepEqual(config, original);
    assert.equal(COMBAT_LAB_UNITS.find(unit => unit.key === "bean").health, 100);
  }
});

test("실험실에서만 모든 생물 조합을 강제 대결하고 실제 종과 필드의 추격 제한을 보존한다", () => {
  const creatures = COMBAT_LAB_UNITS.filter(unit => unit.group !== "4종족");
  for (const left of creatures) for (const right of creatures) {
    const trial = createCombatTrial(settings(left.key, right.key, "right", false, 1));
    assert.deepEqual(trial.agents.map(agent => agent.species), [left.key, right.key]);
    assert.ok(trial.agents.every(agent => agent.combat));
    assert.equal(canPursueCombat(trial.agents[0], trial.agents[1], 0, false), false);
    assert.ok(["left", "right", "draw"].includes(trial.finish()));
    assert.equal(trial.history[0].attackerId, "right");
  }
});
