import test from "node:test";
import assert from "node:assert/strict";
import { RESOURCE_TYPES, clearResourceHazards, resourceTypeForCell } from "./resources.mjs";
import { isTreeFood } from "./food.mjs";
import { createGame } from "./game.mjs";
import { createRoom, saveRoom, restoreRoom, snapshotRoom } from "../client/room.mjs";

test("자원과 겹친 위험 판정을 제거하고 수량·사체·주변 위험 지형을 보존한다", () => {
  const cells = [
    { x: 40, y: 40, amount: 17, terrain: "forest" },
    { x: 41, y: 40, amount: 0, terrain: "forest", resourceType: "twigs", kind: "resource" },
    { x: 42, y: 40, amount: 8, terrain: "forest", resourceType: "tree-fruit" },
    { x: 43, y: 40, amount: 4, terrain: "forest", resourceType: "meat", kind: "corpse" }
  ];
  const hazards = new Uint8Array(320 * 320);
  for (let x = 40; x <= 44; x++) hazards[40 * 320 + x] = x % 2 + 1;
  const room = { world: { hazards }, food: new Map(cells.map(cell => [cell.x + "," + cell.y, cell])) };
  const type = resourceTypeForCell(cells[0], room.world);
  clearResourceHazards(room);
  assert.deepEqual(cells.map(cell => cell.amount), [17, 0, 8, 4]);
  assert.deepEqual([...hazards.slice(40 * 320 + 40, 40 * 320 + 45)], [0, 0, 0, 2, 1]);
  assert.equal(resourceTypeForCell(cells[0], room.world), type);
  assert.equal(type, "honey-mushrooms");
  assert.equal(isTreeFood(cells[2], room.world), true);
});

test("나무 열매와 사체를 제외한 먹이·재료 23종을 공터로 전달한다", () => {
  const cells = RESOURCE_TYPES.map((definition, index) => ({
    x: 40 + index, y: 40, amount: definition.key === "bark" ? 0 : 10,
    resourceType: definition.key, terrain: "forest",
    kind: definition.key === "meat" ? "corpse" : definition.category === "material" ? "resource" : undefined
  }));
  const room = {
    id: "test", title: "자원 공터", hostId: "test", seed: 13, simSeconds: 0, revision: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(5), hazards: new Uint8Array(320 * 320), burrows: [] },
    colonies: [{ id: 1, ownerId: "test", occupiedCells: new Set() }],
    games: new Map([["test", { prepare() {}, snapshot() { return {}; }, colonyKnown() { return true; }, nestLevel: 1 }]]),
    food: new Map(cells.map(cell => [cell.x + "," + cell.y, cell]))
  };
  const clearings = new Set(snapshotRoom(room, true).world.resourceCells.map(([x, y]) => x + "," + y));
  assert.equal(clearings.size, 23);
  for (const cell of cells) assert.equal(clearings.has(cell.x + "," + cell.y),
    !["tree-fruit", "meat"].includes(cell.resourceType), cell.resourceType);
});

test("새 방과 저장 복원 모두 자원 위치·채집량을 유지하고 위험 지형과 겹치지 않는다", () => {
  const room = createRoom("자원 공터 저장 확인", 413);
  const node = [...room.food.values()].find(cell => cell.resourceType === "twigs");
  assert.ok(node);
  node.amount = 0;
  const before = [...room.food].map(([key, cell]) => [key, { ...cell }]);
  const clearings = snapshotRoom(room, true).world.resourceCells;
  const restored = restoreRoom(saveRoom(room));
  assert.deepEqual([...restored.food], before);
  assert.deepEqual(snapshotRoom(restored, true).world.resourceCells, clearings);
  for (const current of [room, restored]) {
    for (const cell of current.food.values()) if (cell.kind !== "corpse") {
      assert.equal(current.world.hazards[cell.y * 320 + cell.x], 0, cell.resourceType);
    }
  }
});

test("사망한 운반자가 떨어뜨리는 재료는 위험 칸을 피하고 사체 위치는 유지한다", () => {
  const colony = { id: 1, ownerId: "test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const room = { simSeconds: 0, world: { seed: 13,
    terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(room, colony);
  room.games.set("test", game);
  const agent = game.agents[0];
  Object.assign(agent, { x: 10, y: 10, carrying: 3, carryingType: "iron-ore" });
  for (let y = 9; y <= 11; y++) for (let x = 9; x <= 11; x++) room.world.hazards[y * 320 + x] = 1;
  room.world.hazards[11 * 320 + 11] = 0;
  game.receiveDamage(agent, agent.health + 100);
  const material = [...room.food.values()].find(cell => cell.resourceType === "iron-ore");
  assert.ok(material);
  assert.deepEqual([material.x, material.y, material.amount], [11, 11, 3]);
  assert.equal(room.food.get("10,10").kind, "corpse");
  assert.equal(room.world.hazards[10 * 320 + 10], 1);
});
