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
  for (const [seconds, level] of [[0,1], [35,3], [120,6], [180,7], [240,9], [405,12]]) {
    const growth = agentGrowth(agent, seconds);
    assert.equal(growth.level, level);
    assert.deepEqual(growth.activeSlots, agent.slots);
  }
  agent.growthActivity = 100000;
  assert.equal(agentGrowth(agent, 0).level, 1);
  assert.equal(agentGrowth(agent, 180).level, 9);
  assert.equal(agentGrowth(agent, 180).experience, 252);
});

test("새 개체는 모든 속성을 즉시 적용하고 성장과 저장·복원 후에도 설계 순서를 보존한다", () => {
  const { game } = fixture();
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 2;
  saved.state.evolutionPoints = 100;
  game.restore(JSON.stringify(saved));
  const result = game.command({ type: "design", templateId: null, name: "성장 시험", slots: ["butchery", "strength", "feet"], birth: true });
  const agent = game.agents.find(candidate => candidate.id === result.agentId);
  assert.deepEqual(agent.activeSlots, ["butchery", "strength", "feet"]);
  assert.equal(agent.attributes.strength, 1);
  game.prepare(35);
  game.tick(0);
  assert.equal(agent.level, 3);
  assert.deepEqual(agent.activeSlots, ["butchery", "strength", "feet"]);
  assert.equal(agent.attributes.strength, 1);
  game.restore(game.save());
  const restored = game.agents.find(candidate => candidate.id === result.agentId);
  assert.deepEqual(restored.slots, ["butchery", "strength", "feet"]);
  assert.deepEqual(restored.activeSlots, ["butchery", "strength", "feet"]);
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

test("채집은 부패 시각을 연장하지 않고 완전히 채집한 사체는 목록에서도 사라진다", () => {
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
});

test("저장한 사체의 부패 시각은 복원 후에도 이어진다", () => {
  const original = fixture();
  original.game.prepare(180);
  original.game.tick(0);
  const saved = original.game.save();
  const restored = fixture();
  for (const [key, value] of original.environment.food) restored.environment.food.set(key, structuredClone(value));
  restored.game.restore(saved);
  restored.game.prepare(220);
  restored.game.tick(0);
  assert.equal(restored.game.snapshot().corpses[0].decaysAt, 480);
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
