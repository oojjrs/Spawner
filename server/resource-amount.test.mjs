import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWorldResourceAmounts } from "./economy.mjs";
import { populateResourceNodes } from "./resources.mjs";

function fixture() {
  return { resourceVersion: 3, food: new Map(), world: { size: 8, generationVersion: 41,
    terrain: new Uint8Array(64).fill(4), resources: [[1, 1, 960000, "clay"], [2, 1, 1460, "tree"],
      [3, 1, 80, "dew"], [4, 1, 200, "pebbles"]] } };
}

test("모든 지도 자원량과 배치 수량 지도를 5000개로 통일한다", () => {
  const { world } = fixture();
  const total = new Float32Array(64), clay = new Float32Array(64);
  world.hydrology = { placementMaps: [{ id: "resource:amount", values: total },
    { id: "resource:clay:amount", values: clay }] };
  normalizeWorldResourceAmounts(world);
  assert.deepEqual(world.resources.map(point => point[2]), [5000, 5000, 5000, 5000]);
  assert.deepEqual(Array.from(total.slice(9, 13)), [5000, 5000, 5000, 5000]);
  assert.equal(clay[9], 5000);
  assert.equal(clay[10], 0);
});

test("새 방의 네 자원 모두 현재량과 초기량을 5000개로 생성한다", () => {
  const room = fixture();
  delete room.resourceVersion;
  populateResourceNodes(room);
  assert.equal(room.food.size, 4);
  for (const cell of room.food.values()) assert.deepEqual([cell.amount, cell.initialAmount], [5000, 5000]);
});

test("기존 채집원은 5000개로 한 번 이관하고 소진·운반물·사체를 보존한다", () => {
  const room = fixture();
  for (const [x, y, amount, resourceType] of room.world.resources)
    room.food.set(x + "," + y, { x, y, amount, initialAmount: amount + 2, resourceType, kind: "resource" });
  room.food.set("5,1", { x: 5, y: 1, amount: 0, initialAmount: 30, resourceType: "tree", kind: "resource" });
  const dropped = { x: 1, y: 1, amount: 2, initialAmount: 2, resourceType: "clay", kind: "resource", dropped: true };
  const corpse = { x: 1, y: 1, kind: "corpse", amount: 3, initialAmount: 3 };
  room.food.set("drop:clay:1,1", dropped);
  room.food.set("corpse:test", corpse);
  populateResourceNodes(room);
  for (const [x, y] of room.world.resources) {
    const cell = room.food.get(x + "," + y);
    assert.deepEqual([cell.amount, cell.initialAmount], [5000, 5000]);
  }
  assert.equal(room.food.get("5,1").amount, 0);
  assert.deepEqual([dropped.amount, dropped.initialAmount, corpse.amount, corpse.initialAmount], [2, 2, 3, 3]);
  room.food.get("1,1").amount = 4999;
  populateResourceNodes(room);
  assert.equal(room.food.get("1,1").amount, 4999);
  assert.equal(room.resourceVersion, 4);
});
