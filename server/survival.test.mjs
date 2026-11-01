import test from "node:test";
import assert from "node:assert/strict";
import { survivalState, beginRetreat, updateRetreat, combatSurvival, retreatEscapeChance } from "./survival.mjs";

function unit(health) {
  return { health, stats: { health: 100, speed: 1, combatStrength: 20 } };
}

test("같은 체력에서도 다음 행동까지의 예상 피해에 따라 위급도를 나눈다", () => {
  const agent = unit(50);
  assert.equal(survivalState(agent, 0), "caution");
  assert.equal(survivalState(agent, 45), "critical");
  assert.equal(survivalState(unit(100), 0), "stable");
  assert.equal(survivalState(unit(20), 0), "caution");
  assert.equal(survivalState(unit(20), 1), "critical");
});

test("성향·생산비·짐이 달라도 즉사 위험에 대한 후퇴 결정은 같다", () => {
  const enemy = unit(100);
  for (const boldness of [0, 1]) {
    const agent = { ...unit(30), cost: boldness * 100, carrying: boldness * 20,
      personality: { boldness, aggression: boldness, curiosity: boldness } };
    assert.equal(combatSurvival(agent, [enemy], [agent]).retreat, true);
  }
});

test("일반 유닛의 탈출은 기본 15%이며 속도 보정도 5~25%로 제한한다", () => {
  const agent = unit(100), enemy = unit(100);
  assert.equal(retreatEscapeChance(agent, [enemy]), .15);
  agent.stats.speed = 2;
  assert.equal(retreatEscapeChance(agent, [enemy]), .25);
  agent.stats.speed = 100;
  assert.equal(retreatEscapeChance(agent, [enemy]), .25);
  agent.stats.speed = 0;
  assert.equal(retreatEscapeChance(agent, [enemy]), .05);
  agent.stats.speed = 1;
  enemy.stats.escapeSuppression = .5;
  assert.equal(retreatEscapeChance(agent, [enemy]), .075);
  enemy.stats.escapeSuppression = 1;
  assert.equal(retreatEscapeChance(agent, [enemy]), 0);
});

test("회복·안전 조건이 함께 충족되어야 후퇴를 해제하고 위험이 돌아오면 대기를 초기화한다", () => {
  const agent = unit(30);
  beginRetreat(agent, 0);
  updateRetreat(agent, 100, false);
  assert.ok(agent.retreat);
  agent.health = 70;
  updateRetreat(agent, 101, false);
  updateRetreat(agent, 105, true);
  assert.equal(agent.retreat.safeSince, null);
  updateRetreat(agent, 106, false);
  assert.equal(updateRetreat(agent, 110, false), false);
  assert.equal(updateRetreat(agent, 111, false), true);
  assert.equal(agent.retreat, null);
});
