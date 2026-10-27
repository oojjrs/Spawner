import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { RESOURCE_TYPES, RESOURCE_HABITATS, isResourceHabitat, migrateResourceType, populateResourceNodes, populateForestResources } from "./resources.mjs";
import { generateWorld, generateResources } from "./world.mjs";

const terrains = {
  pebbles: [2, 3, 6], clay: [2, 4, 9], sand: [2],
  "grass-fiber": [4, 5], "iron-ore": [6], "copper-ore": [6], quartz: [6]
};
const rareDistances = { "iron-ore": 48, "copper-ore": 48, quartz: 56 };

function fixture() {
  const world = { seed: 13, sites: [[160, 160]], terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320), food: [[145, 160, 10, "honey-mushrooms"]],
    burrows: [{ x: 135, y: 180, width: 3, height: 3 }] };
  for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) {
    if (x < 148) world.terrain[y * 320 + x] = 5;
    if (x >= 220) world.terrain[y * 320 + x] = 6;
    if (x >= 168 && x <= 176 && y >= 150 && y <= 154) world.terrain[y * 320 + x] = 3;
    if (y === 127) world.terrain[y * 320 + x] = 1;
    if (y === 128) world.terrain[y * 320 + x] = 2;
  }
  return world;
}

function checkDistribution(world, resources) {
  assert.equal(new Set(resources.map(([x, y]) => x + "," + y)).size, resources.length);
  const food = new Set(world.food.map(([x, y]) => x + "," + y));
  const counts = new Map();
  for (const [x, y, amount, key] of resources) {
    assert.ok(terrains[key]?.includes(world.terrain[y * 320 + x]), key);
    assert.equal(isResourceHabitat(key, world, x, y), true, key);
    assert.equal(world.hazards[y * 320 + x], 0);
    assert.equal(food.has(x + "," + y), false);
    assert.ok(Number.isInteger(amount) && amount > 0);
    const gap = Math.min(...world.sites.map(([cx, cy]) => Math.hypot(x - cx, y - cy)));
    if (rareDistances[key]) assert.ok(gap >= rareDistances[key], key + ": " + gap);
    const habitat = RESOURCE_HABITATS.find(entry => entry.key === key);
    assert.ok(gap >= habitat.minDistance, key);
    if (gap <= 22) assert.ok(amount <= 14);
    for (const burrow of world.burrows || []) assert.ok(x < burrow.x - 1 || x > burrow.x + burrow.width ||
      y < burrow.y - 1 || y > burrow.y + burrow.height);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const habitat of RESOURCE_HABITATS) assert.ok((counts.get(habitat.key) || 0) <= habitat.nodes);
  for (const [cx, cy] of world.sites) {
    const nearby = new Map();
    for (const [x, y, , key] of resources) if (Math.hypot(x - cx, y - cy) <= 22) {
      nearby.set(key, (nearby.get(key) || 0) + 1);
    }
    assert.ok(nearby.size <= 3);
    assert.ok([...nearby.values()].every(count => count <= 2));
  }
  return counts;
}

test("지면 재료 7종은 서식 지형에 배치하고 나무는 숲에서 관리한다", () => {
  assert.equal(RESOURCE_HABITATS.length, 7);
  assert.deepEqual(RESOURCE_HABITATS.map(entry => entry.key).sort(),
    RESOURCE_TYPES.filter(entry => entry.category === "material" && !entry.harvestLocked &&
      !["tree", "dew", "carapace"].includes(entry.key)).map(entry => entry.key).sort());
  const world = fixture();
  assert.equal(isResourceHabitat("grass-fiber", world, 160, 160), true);
  assert.equal(isResourceHabitat("grass-fiber", world, 140, 160), true);
  assert.equal(isResourceHabitat("iron-ore", world, 170, 152), false);
  assert.equal(isResourceHabitat("iron-ore", world, 240, 160), true);
  assert.equal(isResourceHabitat("clay", world, 160, 160), false);
  assert.equal(isResourceHabitat("clay", world, 160, 129), true);
});

test("둥지 주변은 일부 기본 재료만 제한 배치하고 희귀 자원은 먼 서식지에 적게 배치한다", () => {
  const world = fixture(), resources = generateResources(world);
  const counts = checkDistribution(world, resources);
  assert.equal(counts.size, 7);
  assert.ok(resources.some(([x, y]) => Math.hypot(x - 160, y - 160) <= 22));
  assert.ok(counts.get("quartz") < counts.get("grass-fiber"));
  assert.deepEqual(generateResources(world), resources);
});

test("먼 서식지가 없거나 물로 단절되어 있으면 가까운 곳에 희귀 자원을 대신 놓지 않는다", () => {
  const world = { seed: 13, sites: [[160, 160]], terrain: new Uint8Array(320 * 320),
    hazards: new Uint8Array(320 * 320), food: [], burrows: [] };
  for (let y = 153; y <= 167; y++) for (let x = 153; x <= 167; x++) world.terrain[y * 320 + x] = 4;
  for (let y = 40; y <= 70; y++) for (let x = 40; x <= 70; x++) world.terrain[y * 320 + x] = 6;
  const resources = generateResources(world);
  assert.ok(resources.length > 0);
  assert.ok(resources.every(([, , , key]) => key === "grass-fiber"));
  checkDistribution(world, resources);
});

test("5세대 월드는 둥지 주변의 종류 상한과 희귀 자원의 원정 거리를 지킨다", () => {
  for (const seed of [0, 731047]) {
    const world = generateWorld(seed, 5);
    const counts = checkDistribution(world, world.resources);
    assert.ok(Object.keys(rareDistances).some(key => counts.has(key)), String(seed));
  }
});

test("저장된 2세대 월드의 자원·굴·부족 배치는 바꾸지 않는다", () => {
  const world = generateWorld(731047, 2);
  const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  assert.equal(digest(world.resources), "4e78be66eb772d97f18dd5c2655e91f6f9693394987d14b3757dd13a975f1163");
  assert.equal(digest(world.burrows), "004d7cbff3d53c72e90ce98d219591f51f04ddb47e2fda7c073642ffe929e305");
  assert.equal(digest(world.tribes), "49f16aacc73040601831a7393ef09a5685b2b5081b7ba5d8f777003e26a0fcb4");
  const surviving = world.resources.flatMap(([x, y, amount, key]) => {
    const type = migrateResourceType(key);
    return type === null ? [] : [[x, y, amount, type]];
  });
  const room = { world, food: new Map() };
  populateResourceNodes(room);
  assert.deepEqual(world.resources, surviving);
  assert.deepEqual([...room.food.values()].filter(cell => !["tree", "dew"].includes(cell.resourceType))
    .map(cell => [cell.x, cell.y, cell.amount, cell.resourceType]), surviving);
  for (const type of ["tree", "dew"]) {
    const added = [...room.food.values()].filter(cell => cell.resourceType === type);
    assert.ok(added.length > 0, type);
    assert.ok(added.every(cell => world.terrain[cell.y * 320 + cell.x] === (type === "tree" ? 5 : 4)), type);
  }
});

test("숲 나무와 열매는 같은 칸에 존재하고 지면 자원·굴·위험 칸에는 나무가 없다", () => {
  const world = { terrain: new Uint8Array(320 * 320).fill(5), hazards: new Uint8Array(320 * 320),
    burrows: [{ x: 4, y: 4, width: 2, height: 2 }] };
  world.hazards[2 * 320 + 2] = 1;
  const fruit = { x: 1, y: 1, amount: 10, resourceType: "tree-fruit", terrain: "forest" };
  const grass = { x: 3, y: 3, amount: 10, resourceType: "grass-fiber", kind: "resource" };
  const room = { world, food: new Map([["1,1", fruit], ["3,3", grass]]) };
  populateForestResources(room);
  assert.equal(world.treeCells[1 * 320 + 1], 1);
  for (const [x, y] of [[2, 2], [3, 3], [4, 4], [5, 5]]) assert.equal(world.treeCells[y * 320 + x], 0);
  assert.equal(room.food.get("1,1"), fruit);
});
