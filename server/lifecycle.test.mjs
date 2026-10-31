import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { agentGrowth } from "./growth.mjs";
import { expireCorpses } from "./lifespan.mjs";

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
  const agent = { bornAt: 0, slots: ["butchery", "strength", "feet", "lifespan", "antenna"], growthActivity: 0 };
  for (const [experience, level] of [[0,1], [15,2], [33,3], [105,6], [135,7], [204,9], [285,11]]) {
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
  const result = game.command({ type: "design", templateId: null, name: "성장 시험", slots: ["butchery", "strength", "feet"], birth: true });
  const agent = game.agents.find(candidate => candidate.id === result.agentId);
  assert.deepEqual(agent.activeSlots, ["butchery", "strength", "feet"]);
  assert.equal(agent.attributes.strength, 1);
  agent.growthActivity = 33;
  game.prepare(35);
  game.tick(0);
  assert.equal(agent.level, 3);
  assert.deepEqual(agent.activeSlots, ["butchery", "strength", "feet"]);
  assert.equal(agent.attributes.strength, 1);
  game.restore(game.save());
  const restored = game.agents.find(candidate => candidate.id === result.agentId);
  assert.deepEqual(restored.slots, ["butchery", "strength", "feet"]);
  assert.deepEqual(restored.activeSlots, ["butchery", "strength", "feet"]);
  restored.growthActivity = 105;
  game.prepare(120);
  game.tick(0);
  assert.equal(restored.level, 6);
  assert.deepEqual(restored.activeSlots, restored.slots);
});

test("자연사한 개체는 이름과 원래 ID를 가진 사체로 보존되고 5분 뒤 부패한다", () => {
  const { game, environment, agent } = fixture();
  const name = agent.name;
  game.prepare(180);
  game.tick(0);
  assert.equal(game.agents.length, 0);
  const corpse = game.snapshot().corpses.find(cell => cell.agentId === agent.id);
  assert.equal(corpse.name, name);
  assert.equal(corpse.colonyId, 1);
  assert.equal(corpse.diedAt, 180);
  assert.equal(corpse.decaysAt, 480);
  const key = corpse.x + "," + corpse.y;
  game.prepare(479.999);
  game.tick(0);
  assert.equal(game.snapshot().corpses.length, 1);
  game.prepare(480);
  game.tick(0);
  assert.equal(environment.food.has(key), false);
  assert.equal(game.snapshot().corpses.length, 0);
});

test("일부 양분은 사체와 함께 남고 모두 회수하면 사체도 사라진다", () => {
  const { game, environment } = fixture();
  game.prepare(180);
  game.tick(0);
  const corpse = [...environment.food.values()].find(cell => cell.kind === "corpse");
  corpse.amount = 2;
  game.prepare(200);
  game.tick(0);
  assert.equal(game.snapshot().corpses[0].amount, 2);
  assert.equal(game.snapshot().corpses[0].decaysAt, 480);
  corpse.amount = 0;
  game.prepare(201);
  game.tick(0);
  assert.equal(game.snapshot().corpses.length, 0);
  assert.ok(![...environment.food.values()].some(cell => cell.id === corpse.id));
});

test("회수 완료한 사체는 저장과 복원 후에도 다시 나타나지 않는다", () => {
  const original = fixture();
  original.game.prepare(180);
  original.game.tick(0);
  [...original.environment.food.values()].find(cell => cell.kind === "corpse").amount = 0;
  const saved = original.game.save();
  const restored = fixture();
  for (const [key, value] of original.environment.food) restored.environment.food.set(key, structuredClone(value));
  restored.game.restore(saved);
  restored.game.prepare(220);
  restored.game.tick(0);
  assert.equal(restored.game.snapshot().corpses.length, 0);
  restored.game.prepare(480);
  restored.game.tick(0);
  assert.equal(restored.game.snapshot().corpses.length, 0);
});

test("이전 사체 저장은 최초 적용 시점부터 한 번만 부패 시간을 부여한다", () => {
  const food = new Map([["1,1", { kind: "corpse", x: 1, y: 1, amount: 4 }]]);
  expireCorpses(food, 100);
  assert.equal(food.get("1,1").decaysAt, 400);
  expireCorpses(food, 399);
  assert.equal(food.get("1,1").decaysAt, 400);
  expireCorpses(food, 400);
  assert.equal(food.size, 0);
});


test("기존 1분 사체도 사망부터 5분을 보장하고 더 긴 부패 시각은 유지한다", () => {
  const food = new Map([
    ["1,1", { kind: "corpse", x: 1, y: 1, amount: 4, diedAt: 10, decaysAt: 70 }],
    ["2,2", { kind: "corpse", x: 2, y: 2, amount: 4, diedAt: 10, decaysAt: 610 }]
  ]);
  expireCorpses(food, 80);
  assert.equal(food.get("1,1").decaysAt, 310);
  assert.equal(food.get("2,2").decaysAt, 610);
  expireCorpses(food, 309.999);
  assert.equal(food.size, 2);
  expireCorpses(food, 310);
  assert.equal(food.has("1,1"), false);
  assert.equal(food.has("2,2"), true);
});
