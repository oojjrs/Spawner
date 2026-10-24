import test from "node:test";
import assert from "node:assert/strict";
import { isTreeFood } from "./food.mjs";
import { RESOURCE_TYPES, canHarvestResource } from "./resources.mjs";
import { createGame } from "./game.mjs";

function fixture(terrain, kind, slots) {
  const colony = { id: 1, ownerId: "test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const food = { x: 43, y: 42, amount: 20, initialAmount: 20, terrain, kind };
  const world = { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) };
  world.terrain[42 * 320 + 43] = terrain === "forest" ? 5 : 4;
  const environment = { simSeconds: 0, world, colonies: [colony], games: new Map(),
    food: new Map([["43,42", food]]), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set("test", game);
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 4;
  saved.state.evolutionPoints = 20;
  game.restore(JSON.stringify(saved));
  game.command({ type: "design", name: "채집 확인", templateId: null, slots, birth: true });
  return { game, environment, food };
}

function advance(fixture, seconds) {
  for (let step = 0; step < Math.round(seconds * 10); step++) {
    fixture.environment.simSeconds += 0.1;
    fixture.game.prepare(fixture.environment.simSeconds);
    fixture.game.tick(0.1);
  }
}

test("나무가 없는 위험 지형과 사체는 나무 열매로 분류하지 않는다", () => {
  const world = { hazards: new Uint8Array(320 * 320) };
  const food = { x: 43, y: 42, terrain: "forest" };
  assert.equal(isTreeFood(food, world), true);
  assert.equal(isTreeFood({ ...food, kind: "corpse" }, world), false);
  assert.equal(isTreeFood({ ...food, terrain: "grassland" }, world), false);
  world.hazards[42 * 320 + 43] = 1;
  assert.equal(isTreeFood(food, world), false);
});

test("새싹콩과 기존 속성은 열매를 채집 대상으로 선택하거나 수확하지 않는다", () => {
  for (const slots of [[], ["strength", "antenna"]]) {
    const f = fixture("forest", undefined, slots);
    assert.ok(f.game.snapshot().food.some(food => food.x === 43 && food.y === 42));
    advance(f, 25);
    assert.equal(f.food.amount, 20);
    assert.ok(f.game.agents.every(agent => agent.carrying === 0 &&
      !agent.utility?.scores.some(score => score.action === "collect" && score.key === "43,42")));
  }
});

test("빈 땅의 기존 버섯은 계속 수확한다", () => {
  for (const [terrain, kind] of [["grassland", undefined]]) {
    const f = fixture(terrain, kind, ["strength", "antenna"]);
    advance(f, 20);
    assert.ok(f.food.amount < 20);
    assert.ok(f.game.snapshot().colonyFood > 0);
  }
});

test("무속성 개체는 버섯만 채집하고 다른 먹이·재료·사체는 선택하지 않는다", () => {
  const world = { hazards: new Uint8Array(320 * 320) };
  assert.equal(canHarvestResource(null, world), false);
  assert.equal(canHarvestResource({ x: 43, y: 42, terrain: "grassland", resourceType: "unknown" }, world), false);
  assert.equal(canHarvestResource({ x: 43, y: 42, terrain: "forest", resourceType: "honey-mushrooms" }, world), true);
  for (const definition of RESOURCE_TYPES) {
    assert.equal(canHarvestResource({ x: 43, y: 42, terrain: "grassland", resourceType: definition.key }, world),
      definition.key === "honey-mushrooms");
    if (definition.key === "honey-mushrooms") continue;
    const f = fixture("grassland", undefined, []);
    f.food.resourceType = definition.key;
    f.food.kind = definition.key === "meat" ? "corpse" : "resource";
    f.game.restore(f.game.save());
    advance(f, 10);
    assert.equal(f.food.amount, 20, definition.key);
    assert.ok(f.game.agents.every(agent => agent.carrying === 0 &&
      !agent.utility?.scores.some(score => score.action === "collect" && score.key === "43,42")), definition.key);
  }
  assert.equal(canHarvestResource({ x: 43, y: 42, terrain: "forest", kind: "corpse" }, world), false);
});

test("기존 저장의 열매 채집 명령은 복원 후 수확 전에 취소한다", () => {
  const f = fixture("grassland", undefined, ["strength", "antenna"]);
  for (let step = 0; step < 300 && !f.game.agents.some(agent => agent.mode === "harvest"); step++) advance(f, 0.1);
  assert.ok(f.game.agents.some(agent => agent.mode === "harvest"));
  f.food.terrain = "forest";
  f.environment.world.terrain[42 * 320 + 43] = 5;
  const amount = f.food.amount;
  const saved = f.game.save();
  f.game.restore(saved);
  advance(f, 5);
  assert.equal(f.food.amount, amount);
  assert.ok(f.game.agents.every(agent => agent.utility?.action !== "collect" || agent.utility.target.key !== "43,42"));
});
