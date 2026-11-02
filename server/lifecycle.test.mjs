import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { agentGrowth } from "./growth.mjs";
import { expireCorpses } from "./corpses.mjs";

function fixture() {
  const colony = { id: 1, ownerId: "lifecycle-test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  return { game, environment, agent: game.agents[0] };
}

test("성장 레벨과 관계없이 생성할 때 넣은 모든 속성을 유지한다", () => {
  const agent = { bornAt: 0, slots: ["strength", "feet", "antenna"], growthActivity: 0 };
  for (const [experience, level] of [[0,1], [15,2], [33,3], [105,6], [135,7], [204,9], [285,10]]) {
    agent.growthActivity = experience;
    const growth = agentGrowth(agent, 0);
    assert.equal(growth.level, level);
    assert.deepEqual(growth.activeSlots, agent.slots);
  }
  agent.growthActivity = 0;
  assert.equal(agentGrowth(agent, 405).level, 1);
  agent.growthActivity = 100000;
  assert.deepEqual(agentGrowth(agent, 0), agentGrowth(agent, 180));
  assert.equal(agentGrowth(agent, 180).experience, 100000);
});

test("새 개체는 모든 속성을 즉시 적용하고 성장과 저장·복원 후에도 설계 순서를 보존한다", () => {
  const { game } = fixture();
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 3;
  saved.state.evolutionPoints = 100;
  game.restore(JSON.stringify(saved));
  const result = game.command({ type: "design", templateId: null, name: "성장 시험", slots: ["strength", "feet"], birth: true });
  const agent = game.agents.find(candidate => candidate.id === result.agentId);
  assert.deepEqual(agent.activeSlots, ["strength", "feet"]);
  assert.equal(agent.attributes.strength, 1);
  agent.growthActivity = 33;
  game.prepare(35);
  game.tick(0);
  assert.equal(agent.level, 3);
  assert.deepEqual(agent.activeSlots, ["strength", "feet"]);
  assert.equal(agent.attributes.strength, 1);
  game.restore(game.save());
  const restored = game.agents.find(candidate => candidate.id === result.agentId);
  assert.deepEqual(restored.slots, ["strength", "feet"]);
  assert.deepEqual(restored.activeSlots, ["strength", "feet"]);
  restored.growthActivity = 105;
  game.prepare(120);
  game.tick(0);
  assert.equal(restored.level, 6);
  assert.deepEqual(restored.activeSlots, restored.slots);
});

test("사망 시각 없는 저장과 이미 3초 지난 사체는 다시 수명을 부여하지 않는다", () => {
  const food = new Map([
    ["1,1", { kind: "corpse", x: 1, y: 1, amount: 4 }],
    ["2,2", { kind: "corpse", agentId: "old", x: 2, y: 2, amount: 4, diedAt: 10, decaysAt: 610 }]
  ]);
  expireCorpses(food, 100); assert.equal(food.size, 0);
});
