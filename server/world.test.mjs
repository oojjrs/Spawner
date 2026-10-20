import test from "node:test";
import assert from "node:assert/strict";
import { generateWorld, generateStartingFood, STARTING_FOOD_RADIUS, STARTING_FOOD_CAP } from "./world.mjs";
import { createRoom, saveRoom, restoreRoom } from "../client/room.mjs";

test("새 시작 먹이는 시드별로 재현되고 모든 후보 주변에 소량으로 분산된다", () => {
  for (const seed of [0, 731047, 731048, 4294967295]) {
    const world = generateWorld(seed);
    assert.equal(new Set(world.food.map(([x, y]) => x + "," + y)).size, world.food.length);
    for (const [cx, cy] of world.sites) {
      const food = world.food.filter(([x, y]) => Math.hypot(x - cx, y - cy) <= STARTING_FOOD_RADIUS);
      const total = food.reduce((sum, point) => sum + point[2], 0);
      assert.ok(total >= 200 && total <= 400, seed + ": " + total);
      assert.ok(food.length >= 20);
      assert.ok(food.some(([x, y]) => Math.hypot(x - cx, y - cy) <= 6));
      for (const [x, y, amount] of food) {
        assert.ok(Number.isInteger(amount) && amount > 0 && amount <= STARTING_FOOD_CAP);
        assert.equal(world.hazards[y * 320 + x], 0);
        assert.ok(world.terrain[y * 320 + x] >= 3 && world.terrain[y * 320 + x] <= 6);
      }
    }
    assert.deepEqual(generateWorld(seed).food, world.food);
    const alternative = generateStartingFood(world, 15);
    for (const [cx, cy] of world.sites) {
      const sum = entries => entries.filter(([x, y]) => Math.hypot(x - cx, y - cy) <= STARTING_FOOD_RADIUS).reduce((value, point) => value + point[2], 0);
      assert.equal(sum(alternative), sum(world.food));
    }
  }
});

test("겹치는 시작권의 먹이는 한 번 생성하고 양쪽 총량을 과다 증가시키지 않는다", () => {
  const world = { seed: 731047, sites: [[100, 100], [130, 100]],
    terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) };
  const food = generateStartingFood(world, 10);
  const shared = food.filter(([x, y]) => world.sites.every(([cx, cy]) => Math.hypot(x - cx, y - cy) <= STARTING_FOOD_RADIUS));
  assert.ok(shared.length > 0);
  assert.equal(new Set(food.map(([x, y]) => x + "," + y)).size, food.length);
  for (const [cx, cy] of world.sites) {
    const total = food.filter(([x, y]) => Math.hypot(x - cx, y - cy) <= STARTING_FOOD_RADIUS).reduce((sum, point) => sum + point[2], 0);
    assert.ok(total >= 200 && total <= 400);
  }
});

test("방은 생성된 먹이량을 사용하고 저장된 채집 진행과 이전 먹이를 보존한다", () => {
  const room = createRoom("먹이 시험", 731047);
  for (const [x, y, amount] of room.world.food) {
    assert.equal(room.food.get(x + "," + y).amount, amount);
    assert.equal(room.food.get(x + "," + y).initialAmount, amount);
  }
  const [x, y, amount] = room.world.food.find(([px, py]) => Math.hypot(px - room.world.origin.x, py - room.world.origin.y) < 6);
  room.food.get(x + "," + y).amount = amount - 1;
  const saved = saveRoom(room);
  const restored = restoreRoom(saved);
  assert.equal(restored.food.get(x + "," + y).amount, amount - 1);
  const legacy = structuredClone(saved);
  legacy.food = [["1,1", { x: 1, y: 1, amount: 37, terrain: "land" }]];
  assert.deepEqual([...restoreRoom(legacy).food], legacy.food);
});
