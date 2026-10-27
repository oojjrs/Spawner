import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { isTribeFood, resourceDefinition, canHarvestResource, populateColonyFood } from "./resources.mjs";
import { createRoom, chooseRoomTribe, saveRoom, restoreRoom } from "../client/room.mjs";
import { RESOURCE_HARVEST_ANIMATIONS } from "../client/harvest-assets.mjs";
import { createHarvestPlayback, syncHarvestPlayback, harvestPlaybackPose } from "../client/harvest.mjs";

function fixture(tribe) {
  const colony = { id: 1, ownerId: "food-test", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 120, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  return { game, environment };
}

function deliver(resourceType, points, tribe) {
  const result = fixture(tribe);
  const saved = JSON.parse(result.game.save());
  saved.state.agents.splice(1);
  saved.state.evolutionPoints = points;
  Object.assign(saved.state.agents[0], { x: 40, y: 40, renderFromX: 40, renderFromY: 40,
    carrying: 2, carryingType: resourceType, mode: "unload", unloadReady: 120, birth: null, bornAt: 0,
    moveDuration: 0, moveStartedAt: 0, decisionPending: null, nextDecisionAt: 1000,
    returnPath: [], utility: { action: "return", target: { x: 40, y: 40, key: "home" }, route: [{ x: 40, y: 40 }] } });
  result.game.restore(JSON.stringify(saved));
  result.environment.simSeconds = 120.1;
  result.game.prepare(120.1);
  result.game.tick(0.1);
  return result.game;
}

test("새싹콩의 유일한 먹이는 기본 채집 가능한 비옥토이며 버섯은 누구도 채집하지 못한다", () => {
  assert.equal(resourceDefinition("clay").name, "비옥토");
  assert.equal(canHarvestResource({ resourceType: "clay" }, {}, {}), true);
  for (const type of ["honey-mushrooms", "berry-bush", "meat", "pebbles"]) assert.equal(isTribeFood(type, "bean"), false);
  assert.equal(isTribeFood("clay", "bean"), true);
  assert.equal(isTribeFood("clay", "spore"), false);
  assert.equal(isTribeFood("berry-bush", "spore"), false);
  assert.equal(canHarvestResource({ resourceType: "honey-mushrooms" }, {}, { harvest: 2, digging: 2, strength: 2 }), false);
});

test("비옥토 납품은 먹이와 진화 포인트가 되고 한도를 넘는 적재물은 남는다", () => {
  const game = deliver("clay", 99, "bean");
  assert.equal(game.snapshot().evolutionPoints, 100);
  assert.equal(game.snapshot().colonyFood, 1);
  assert.equal(game.agents[0].carrying, 1);
  assert.equal(game.agents[0].carryingType, "clay");
  assert.equal(game.snapshot().resourceInventory.clay, undefined);
});

test("다른 종족의 기본 먹이는 포인트가 가득 차도 재료로 납품하고 저장 후에도 유지한다", () => {
  const game = deliver("dew", 100, "bean");
  assert.equal(game.snapshot().evolutionPoints, 100);
  assert.equal(game.snapshot().colonyFood, 0);
  assert.equal(game.snapshot().resourceInventory.dew, 2);
  game.restore(game.save());
  assert.equal(game.snapshot().resourceInventory.dew, 2);
  const other = deliver("clay", 0, "spore");
  assert.equal(other.snapshot().evolutionPoints, 0);
  assert.equal(other.snapshot().resourceInventory.clay, 2);
});

test("새싹콩의 시작 먹이 전환은 위치와 잔량을 보존하고 먼 버섯과 다른 부족을 유지한다", () => {
  const room = { colonies: [{ x: 40, y: 40, tribe: "bean" }, { x: 100, y: 100, tribe: "spore" }], food: new Map() };
  for (const [key, x, amount] of [["46,42", 46, 3], ["47,42", 47, 0], ["80,42", 80, 8], ["104,102", 104, 5]]) {
    const y = Number(key.split(",")[1]);
    room.food.set(key, { x, y, amount, initialAmount: 10, resourceType: "honey-mushrooms" });
  }
  populateColonyFood(room);
  assert.equal(room.food.get("46,42").resourceType, "clay");
  assert.equal(room.food.get("46,42").amount, 3);
  assert.equal(room.food.get("47,42").amount, 0);
  assert.equal(room.food.get("80,42").resourceType, "honey-mushrooms");
  assert.equal(room.food.get("104,102").resourceType, "honey-mushrooms");
});

test("부족 선택과 방 복원에서도 시작 비옥토를 유지하며 고갈된 지점을 재보충하지 않는다", () => {
  const room = createRoom("비옥토 확인", 13, null);
  chooseRoomTribe(room, "bean");
  const colony = room.colonies[0];
  const food = [...room.food.values()].find(cell => cell.resourceType === "clay" && Math.hypot(cell.x - colony.x - 2, cell.y - colony.y - 2) < 10);
  assert.ok(food);
  food.amount = 0;
  const restored = restoreRoom(saveRoom(room));
  assert.equal(restored.food.get(food.x + "," + food.y).resourceType, "clay");
  assert.equal(restored.food.get(food.x + "," + food.y).amount, 0);
});

test("비옥토의 13프레임 시퀀스는 실제 수확 성공 후 접촉부터 정착까지 진행한다", () => {
  const definition = { ...RESOURCE_HARVEST_ANIMATIONS.find(entry => entry.resourceType === "clay"), harvestSeconds: 2 };
  const cell = { x: 10, y: 20, resourceType: "clay", amount: 2 };
  const agent = { id: "bean:1", health: 1, x: 10, y: 20, mode: "harvest", harvestResourceType: "clay", harvestPrepared: true, harvestReady: 4 };
  const playback = createHarvestPlayback();
  assert.equal(harvestPlaybackPose(playback, cell, [agent], 3.7, definition).frame, 2);
  assert.ok(harvestPlaybackPose(playback, cell, [agent], 3.99, definition).frame < 3);
  agent.harvestResult = { sequence: 1, resourceType: "clay", x: 10, y: 20, completedAt: 4, amount: 1, remaining: 1 };
  syncHarvestPlayback(playback, [agent], 4, false);
  assert.equal(harvestPlaybackPose(playback, { ...cell, amount: 1 }, [], 4, definition).frame, 3);
  assert.equal(harvestPlaybackPose(playback, { ...cell, amount: 1 }, [], 4.2, definition).frame, 6);
  assert.equal(harvestPlaybackPose(playback, { ...cell, amount: 1 }, [], 4.24, definition).frame, 7);
  assert.equal(harvestPlaybackPose(playback, { ...cell, amount: 1 }, [], 4.295, definition).frame, 9);
  assert.equal(harvestPlaybackPose(playback, { ...cell, amount: 1 }, [], 4.33, definition).frame, 11);
  assert.equal(harvestPlaybackPose(playback, { ...cell, amount: 1 }, [], 4.35, definition).frame, 12);
});
