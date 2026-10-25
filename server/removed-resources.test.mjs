import test from "node:test";
import assert from "node:assert/strict";
import { attributeCounts } from "./attributes.mjs";
import { REMOVED_RESOURCE_TYPES, RESOURCE_TYPES, FOOD_HABITATS, resourceDefinition, populateResourceNodes, canHarvestResource } from "./resources.mjs";
import { RESOURCE_HARVEST_ANIMATIONS } from "../client/harvest-assets.mjs";
import { generateWorld } from "./world.mjs";
import { createRoom, saveRoom, restoreRoom } from "../client/room.mjs";

const retired = ["tree-fruit", "berry-bush", "seed-pods", "root-bulbs", "nutrient-moss"];

test("기획서에서 삭제한 식물 자원은 목록·채집·애니메이션에서 제외한다", () => {
  for (const key of retired) {
    assert.ok(REMOVED_RESOURCE_TYPES.includes(key));
    assert.equal(resourceDefinition(key), undefined);
    assert.ok(FOOD_HABITATS.every(habitat => habitat.key !== key));
    assert.ok(RESOURCE_HARVEST_ANIMATIONS.every(animation => animation.resourceType !== key));
    assert.equal(canHarvestResource({ resourceType: key }, {}, attributeCounts(["strength", "strength"])), false);
  }
  for (const definition of RESOURCE_TYPES) {
    assert.ok(definition.requirements.every(key => ["antenna", "strength", "butchery", "lifespan", "feet"].includes(key)));
  }
});

test("자원 저장 버전과 관계없이 삭제 자원을 제거하고 나머지 수량은 보존한다", () => {
  const room = { resourceVersion: 1, world: { resources: retired.map((key, index) => [index, 0, 10, key]) },
    food: new Map([...retired.map((resourceType, x) => [x + ",0", { x, y: 0, resourceType, amount: 10 }]),
      ["10,0", { x: 10, y: 0, resourceType: "clay", amount: 17 }]]) };
  populateResourceNodes(room);
  assert.deepEqual([...room.food.keys()], ["10,0"]);
  assert.equal(room.food.get("10,0").amount, 17);
  assert.deepEqual(room.world.resources, []);
});

test("새 맵에는 삭제 자원을 배치하지 않고 기존 맵의 지형·둥지 위치를 보존한다", () => {
  const world = generateWorld(1669442258);
  assert.ok(world.food.every(([, , , key]) => !retired.includes(key)));
  const legacy = createRoom("기존 맵", 1669442258, "bean");
  const saved = saveRoom(legacy);
  saved.food.push(["0,0", { x: 0, y: 0, resourceType: "seed-pods", amount: 12 }]);
  const restored = restoreRoom(saved);
  assert.deepEqual(restored.world.terrain, legacy.world.terrain);
  assert.deepEqual(restored.world.camps, legacy.world.camps);
  assert.ok([...restored.food.values()].every(cell => !retired.includes(cell.resourceType)));
  const original = generateWorld(saved.seed, 8);
  const camp = original.camps.find(entry => entry.tribe === "bean");
  assert.deepEqual([camp.x, camp.y], [219, 232]);
});
