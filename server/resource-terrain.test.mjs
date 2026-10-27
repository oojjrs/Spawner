import test from "node:test";
import assert from "node:assert/strict";
import { RESOURCE_TYPES, REMOVED_RESOURCE_TYPES, clearResourceHazards, resourceTypeForCell } from "./resources.mjs";
import { RESOURCE_ECONOMY } from "./economy.mjs";
import { isTreeFood } from "./food.mjs";
import { createGame } from "./game.mjs";
import { createRoom, saveRoom, restoreRoom, snapshotRoom } from "../client/room.mjs";

test("자원과 겹친 위험 판정을 제거하고 수량·사체·주변 위험 지형을 보존한다", () => {
  const cells = [
    { x: 40, y: 40, amount: 17, terrain: "forest" },
    { x: 41, y: 40, amount: 0, terrain: "forest", resourceType: "grass-fiber", kind: "resource" },
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

test("나무·나무 열매·사체를 제외한 먹이·재료를 공터로 전달한다", () => {
  const cells = RESOURCE_TYPES.map((definition, index) => ({
    x: 40 + index, y: 40, amount: definition.key === "grass-fiber" ? 0 : 10,
    resourceType: definition.key, terrain: "forest",
    kind: definition.key === "meat" ? "corpse" : definition.category === "material" ? "resource" : undefined
  }));
  const room = {
    id: "test", title: "자원 공터", hostId: "test", seed: 13, simSeconds: 0, revision: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(5), hazards: new Uint8Array(320 * 320), burrows: [],
      camps: [{ tribe: "bean", x: 42, y: 42 }, { tribe: "spore", x: 102, y: 102 }, { tribe: "pebble", x: 162, y: 162 }, { tribe: "spring", x: 222, y: 222 }] },
    colonies: [{ id: 1, ownerId: "test", occupiedCells: new Set() }],
    games: new Map([["test", { prepare() {}, snapshot() { return {}; }, colonyKnown() { return true; }, nestLevel: 1,
      nest: { health: 1, maxHealth: 1 } }]]),
    food: new Map(cells.map(cell => [cell.x + "," + cell.y, cell]))
  };
  const clearings = new Set(snapshotRoom(room, true).world.resourceCells.map(([x, y]) => x + "," + y));
  assert.equal(clearings.size, cells.filter(cell => !["tree", "meat"].includes(cell.resourceType)).length);
  for (const cell of cells) assert.equal(clearings.has(cell.x + "," + cell.y),
    !["tree", "tree-fruit", "meat"].includes(cell.resourceType), cell.resourceType);
});

test("새 방과 저장 복원 모두 자원 위치·채집량을 유지하고 위험 지형과 겹치지 않는다", () => {
  const room = createRoom("자원 공터 저장 확인", 413);
  const node = [...room.food.values()].find(cell => cell.resourceType === "grass-fiber");
  assert.ok(node);
  node.amount = 0;
  const before = [...room.food].map(([key, cell]) => [key, { ...cell }]);
  const clearings = snapshotRoom(room, true).world.resourceCells;
  const restored = restoreRoom(saveRoom(room));
  assert.deepEqual([...restored.food], before);
  assert.deepEqual(snapshotRoom(restored, true).world.resourceCells, clearings);
  assert.deepEqual(restored.world.hazards, room.world.hazards);
  for (const current of [room, restored]) {
    for (const cell of current.food.values()) if (cell.kind !== "corpse" && RESOURCE_ECONOMY.some(policy => policy.key === cell.resourceType)) {
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

test("폐기한 낙엽은 저장 복원 시 지점·기억·운반·알림에서 제거하며 다른 자원은 보존한다", () => {
  const room = createRoom("낙엽 폐기 저장 확인", 413);
  const leaf = { x: 0, y: 0, amount: 12, initialAmount: 12, resourceType: "dry-leaves", kind: "resource", terrain: "forest" };
  room.food.set("0,0", leaf);
  const saved = saveRoom(room);
  const data = JSON.parse(saved.games[0][1]);
  data.state.knownFood.entries.push(["0,0", leaf]);
  data.state.resourceInventory = { "dry-leaves": 9, "grass-fiber": 7 };
  data.state.discoveries = [
    { key: "material:dry-leaves", kind: "material", name: "마른 잎" },
    { key: "material:grass-fiber", kind: "material", name: "풀섬유" },
    { key: "material:clay", kind: "material", name: "점토" }
  ];
  data.state.discoveryReadCount = 2;
  const id = data.state.agents[0].id;
  Object.assign(data.state.agents[0], { carrying: 3, carryingType: "dry-leaves",
    foodDelivery: { resourceType: "dry-leaves" },
    harvestResult: { sequence: 1, completedAt: room.simSeconds, resourceType: "dry-leaves" } });
  saved.games[0][1] = JSON.stringify(data);
  const restored = restoreRoom(saved);
  const snapshot = restored.games.get(saved.games[0][0]).snapshot();
  assert.deepEqual([...restored.food], saved.food.filter(([, cell]) => cell.resourceType !== "dry-leaves"));
  assert.ok(snapshot.food.every(cell => cell.resourceType !== "dry-leaves"));
  assert.deepEqual(snapshot.resourceInventory, { "grass-fiber": 7 });
  assert.ok(snapshot.discoveries.every(entry => entry.key !== "material:dry-leaves"));
  assert.equal(snapshot.discoveryReadCount, 1);
  assert.equal(snapshot.evolutionPoints, data.state.evolutionPoints);
  const agent = snapshot.agents.find(entry => entry.id === id);
  assert.equal(agent.carrying, 0);
  assert.equal(agent.carryingType, null);
  assert.equal(agent.foodDelivery, null);
  assert.equal(agent.harvestResult, null);
});

test("폐기 자원을 모든 저장 경로에서 제거하고 뿌리섬유는 풀섬유로 합친다", () => {
  const room = createRoom("자원 축소 복원", 413);
  const types = REMOVED_RESOURCE_TYPES;
  types.forEach((resourceType, x) => room.food.set(x + ",0", {
    x, y: 0, amount: 12, initialAmount: 12, resourceType, kind: "resource", terrain: "forest"
  }));
  const saved = saveRoom(room);
  const data = JSON.parse(saved.games[0][1]);
  data.state.knownFood.entries.push(...saved.food.filter(([, cell]) => types.includes(cell.resourceType)));
  data.state.resourceInventory = Object.fromEntries(types.map(type => [type, 9]));
  data.state.resourceInventory["grass-fiber"] = 7;
  data.state.discoveries = types.map(type => ({ key: "material:" + type, kind: "material", name: type }));
  data.state.discoveryReadCount = types.length;
  const original = data.state.agents[0];
  data.state.agents = types.map((type, index) => ({ ...structuredClone(original), id: "migration:" + index,
    carrying: 3, carryingType: type, foodDelivery: { resourceType: type },
    harvestResult: { sequence: 1, completedAt: room.simSeconds, resourceType: type } }));
  saved.games[0][1] = JSON.stringify(data);
  const restored = restoreRoom(saved);
  const snapshot = restored.games.get(saved.games[0][0]).snapshot();
  assert.deepEqual(snapshot.resourceInventory, { "grass-fiber": 16 });
  assert.ok(snapshot.discoveries.every(entry => !types.some(type => entry.key === "material:" + type)));
  assert.equal(snapshot.discoveries.filter(entry => entry.key === "material:grass-fiber").length, 1);
  for (const cell of restored.food.values()) assert.equal(types.includes(cell.resourceType), false);
  types.forEach((type, index) => {
    const agent = snapshot.agents.find(entry => entry.id === "migration:" + index);
    if (type === "root-fiber") {
      assert.equal(agent.carryingType, "grass-fiber");
      assert.equal(agent.carrying, 3);
      assert.equal(agent.foodDelivery.resourceType, "grass-fiber");
      assert.equal(restored.food.get(index + ",0").resourceType, "grass-fiber");
    } else {
      assert.equal(agent.carrying, 0);
      assert.equal(agent.carryingType, null);
      assert.equal(agent.foodDelivery, null);
      assert.equal(agent.harvestResult, null);
      assert.equal(restored.food.has(index + ",0"), false);
    }
  });
  for (const cell of restored.food.values()) if (isTreeFood(cell, restored.world)) {
    assert.equal(restored.world.treeCells[cell.y * 320 + cell.x], 1);
  }
});
