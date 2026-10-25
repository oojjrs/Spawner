import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isFoodHabitat } from "./resources.mjs";
import { createCreatures } from "./creatures.mjs";
import { generateWorld, generateStartingFood, STARTING_FOOD_RADIUS, STARTING_FOOD_CAP } from "./world.mjs";
import { createRoom, saveRoom, restoreRoom } from "../client/room.mjs";

test("새 시작 먹이는 시드별로 재현되고 모든 후보 주변에 소량으로 분산된다", () => {
  for (const seed of [0, 731047, 731048, 4294967295]) {
    const world = generateWorld(seed);
    assert.equal(new Set(world.food.map(([x, y]) => x + "," + y)).size, world.food.length);
    assert.ok(world.food.some(([, , , type]) => type === "tree-fruit"));
    const terrains = { "honey-mushrooms": [5], "tree-fruit": [5], "berry-bush": [4], "seed-pods": [3, 4], "root-bulbs": [4], "nutrient-moss": [5] };
    for (const [x, y, , resourceType] of world.food) {
      assert.ok(terrains[resourceType]?.includes(world.terrain[y * 320 + x]), resourceType + ": " + x + "," + y);
      if (resourceType === "berry-bush") assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < 320 && y + dy < 320 &&
          world.terrain[(y + dy) * 320 + x + dx] === 5));
    }
    for (const [cx, cy] of world.sites) {
      const food = world.food.filter(([x, y]) => Math.hypot(x - cx, y - cy) <= STARTING_FOOD_RADIUS);
      const total = food.reduce((sum, point) => sum + point[2], 0);
      assert.ok(total >= 200 && total <= 400, seed + ": " + total);
      assert.ok(food.length >= 20);
      assert.ok(food.some(([x, y]) => Math.hypot(x - cx, y - cy) <= 6));
      for (const [x, y, amount, resourceType] of food) {
        assert.equal(resourceType, "honey-mushrooms");
        assert.ok(Number.isInteger(amount) && amount > 0 && amount <= STARTING_FOOD_CAP);
        assert.equal(world.hazards[y * 320 + x], 0);
        assert.equal(world.terrain[y * 320 + x], 5);
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

test("먹이 서식지는 지형과 숲 인접 여부로 구분하며 숲이 없으면 시작 버섯을 억지로 놓지 않는다", () => {
  const world = { seed: 13, sites: [[100, 100]], terrain: new Uint8Array(320 * 320).fill(3),
    hazards: new Uint8Array(320 * 320) };
  assert.equal(isFoodHabitat("honey-mushrooms", world, 100, 100), false);
  assert.equal(isFoodHabitat("seed-pods", world, 100, 100), true);
  assert.equal(isFoodHabitat("root-bulbs", world, 100, 100), false);
  assert.deepEqual(generateStartingFood(world, 10), []);
  world.terrain[100 * 320 + 100] = 4;
  assert.equal(isFoodHabitat("root-bulbs", world, 100, 100), true);
  assert.equal(isFoodHabitat("berry-bush", world, 100, 100), false);
  world.terrain[100 * 320 + 101] = 5;
  assert.equal(isFoodHabitat("berry-bush", world, 100, 100), true);
  assert.equal(isFoodHabitat("honey-mushrooms", world, 101, 100), true);
  assert.equal(isFoodHabitat("nutrient-moss", world, 101, 100), true);
  assert.equal(isFoodHabitat("meat", world, 101, 100), false);
  assert.equal(isFoodHabitat("berry-bush", world, -1, 100), false);
});

test("이전 월드 생성은 저장된 지형과 먹이 배치를 그대로 재현한다", () => {
  const world = generateWorld(731047, 1);
  assert.equal(createHash("sha256").update(world.terrain).digest("hex"),
    "b6efeab31d349aa21d02bd9fd8cd9bfa9e7a31530079d130a2c7e57af364d78a");
  assert.equal(createHash("sha256").update(JSON.stringify(world.food)).digest("hex"),
    "284bf31911165f11a456dbf4d2cf37e3cfcb877454c90b362d0af46bed137bc3");
  assert.throws(() => generateWorld(731047, 6), /지원하지 않는 월드 생성 버전/);
});

test("겹치는 시작권의 먹이는 한 번 생성하고 양쪽 총량을 과다 증가시키지 않는다", () => {
  const world = { seed: 731047, sites: [[100, 100], [130, 100]],
    terrain: new Uint8Array(320 * 320).fill(5), hazards: new Uint8Array(320 * 320) };
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
  assert.equal(saved.worldGenerationVersion, 5);
  assert.deepEqual(restored.world.terrain, room.world.terrain);
  assert.equal(restored.food.get(x + "," + y).amount, amount - 1);
  const legacy = structuredClone(saved);
  legacy.food = [["1,1", { x: 1, y: 1, amount: 37, terrain: "land" }]];
  delete legacy.worldGenerationVersion;
  legacy.creatures = createCreatures({ ...room, world: generateWorld(731047, 1),
    food: new Map(legacy.food), games: new Map() }, null).save();
  const restoredLegacy = restoreRoom(legacy);
  assert.deepEqual([...restoredLegacy.food], legacy.food);
  assert.equal(restoredLegacy.world.generationVersion, 1);
  assert.equal(createHash("sha256").update(restoredLegacy.world.terrain).digest("hex"),
    "b6efeab31d349aa21d02bd9fd8cd9bfa9e7a31530079d130a2c7e57af364d78a");
});
