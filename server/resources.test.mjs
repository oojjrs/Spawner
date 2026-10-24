import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { RESOURCE_TYPES, RESOURCE_HABITATS, isResourceHabitat } from "./resources.mjs";
import { generateWorld, generateResources } from "./world.mjs";

const terrains = {
  twigs: [5], bark: [5], pebbles: [2, 3, 6], clay: [2, 4], sand: [2],
  "dry-leaves": [5], "grass-fiber": [4], "root-fiber": [4, 5], "spider-silk": [5, 6],
  water: [2], "tree-sap": [5], "leaf-mold": [5], resin: [5], beeswax: [5],
  carapace: [4, 5, 6], "iron-ore": [6], "copper-ore": [6], quartz: [6]
};
const rareDistances = { resin: 42, beeswax: 42, "iron-ore": 48, "copper-ore": 48, quartz: 56 };

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

test("재료 18종의 서식 지형과 물가·나무 인접 조건이 정해져 있다", () => {
  assert.equal(RESOURCE_HABITATS.length, 18);
  assert.deepEqual(RESOURCE_HABITATS.map(entry => entry.key).sort(),
    RESOURCE_TYPES.filter(entry => entry.category === "material").map(entry => entry.key).sort());
  const world = fixture();
  assert.equal(isResourceHabitat("twigs", world, 160, 160), false);
  assert.equal(isResourceHabitat("twigs", world, 140, 160), true);
  assert.equal(isResourceHabitat("iron-ore", world, 170, 152), false);
  assert.equal(isResourceHabitat("iron-ore", world, 240, 160), true);
  assert.equal(isResourceHabitat("water", world, 160, 160), false);
  assert.equal(isResourceHabitat("water", world, 160, 128), true);
  assert.equal(isResourceHabitat("clay", world, 160, 160), false);
  assert.equal(isResourceHabitat("clay", world, 160, 129), true);
  assert.equal(isResourceHabitat("root-fiber", world, 160, 160), false);
  assert.equal(isResourceHabitat("root-fiber", world, 148, 160), true);
});

test("둥지 주변은 일부 기본 재료만 제한 배치하고 희귀 자원은 먼 서식지에 적게 배치한다", () => {
  const world = fixture(), resources = generateResources(world);
  const counts = checkDistribution(world, resources);
  assert.equal(counts.size, 18);
  assert.ok(resources.some(([x, y]) => Math.hypot(x - 160, y - 160) <= 22));
  assert.ok(counts.get("quartz") < counts.get("grass-fiber"));
  assert.ok(counts.get("beeswax") < counts.get("twigs"));
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

test("실제 월드에서도 모든 둥지 주변의 종류 상한과 희귀 자원의 원정 거리를 지킨다", () => {
  for (const seed of [0, 731047]) {
    const world = generateWorld(seed);
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
});
