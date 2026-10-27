import test from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "./world.mjs";
import { canHarvestResource, isResourceHabitat, isTribeFood, resourceHarvestSeconds } from "./resources.mjs";
import { startingTravel } from "./start-economy.mjs";

test("네 종족의 기본 먹이와 기존 자갈 채집 조건·시간을 적용한다", () => {
  for (const [tribe, resourceType] of [["bean", "clay"], ["spore", "tree"], ["pebble", "pebbles"], ["spring", "dew"]]) {
    assert.equal(isTribeFood(resourceType, tribe, 11), true);
    assert.equal(canHarvestResource({ resourceType }, { generationVersion: 11 }, {}, tribe), true);
    for (const other of ["clay", "tree", "pebbles", "dew"].filter(key => key !== resourceType)) assert.equal(isTribeFood(other, tribe, 11), false);
  }
  assert.equal(canHarvestResource({ resourceType: "pebbles" }, { generationVersion: 10 }, {}, "pebble"), true);
  assert.equal(resourceHarvestSeconds("pebbles", { generationVersion: 10 }), 2);
  assert.equal(resourceHarvestSeconds("clay", { generationVersion: 10 }), 2);
  assert.equal(resourceHarvestSeconds("pebbles", { generationVersion: 11 }), 3.5);
  assert.equal(resourceHarvestSeconds("pebbles", { generationVersion: 15 }), 2.5);
});

test("시작 접근성은 산지 이동 비용·물·둥지 점유 칸을 반영한다", () => {
  const size = 32, camp = { x: 16, y: 16 }, terrain = new Uint8Array(size * size).fill(4);
  const world = { size, camps: [camp], burrows: [], terrain, hazards: new Uint8Array(size * size) };
  const plain = startingTravel(world, camp);
  assert.equal(plain[13 * size + 14], 3);
  assert.equal(plain[12 * size + 14], 6);
  assert.equal(plain[16 * size + 16], -1);
  terrain[13 * size + 14] = 6;
  const mountain = startingTravel(world, camp);
  assert.equal(mountain[13 * size + 14], 5);
  assert.equal(mountain[12 * size + 14], 8);
  for (let x = 0; x < size; x++) terrain[10 * size + x] = 0;
  assert.equal(startingTravel(world, camp)[8 * size + 14], -1);
});

test("시작 자원 보정은 전역 자원 점유율과 생물의 빈 등장 칸을 유지한다", () => {
  const previous = generateWorld(1401181143, 11), corrected = generateWorld(1401181143, 15);
  assert.deepEqual(corrected.camps, previous.camps);
  assert.deepEqual(corrected.terrain, previous.terrain);
  for (const current of corrected.economy.resources) {
    const before = previous.economy.resources.find(entry => entry.key === current.key);
    assert.equal(current.cells, before.cells);
    assert.equal(current.coverage, before.coverage);
    assert.ok(Math.abs(current.amount - before.amount) < before.amount * .02);
  }
  const pebble = corrected.economy.starts.find(entry => entry.tribe === "pebble");
  assert.ok(pebble.cells > pebble.before.cells);
  assert.ok(pebble.cells >= 16);
  assert.ok(pebble.nearestSeconds <= 4);
  assert.ok(Math.abs(pebble.weightedAmount - pebble.targetWeightedAmount) < Math.abs(pebble.before.weightedAmount - pebble.targetWeightedAmount));
  const occupied = new Set(corrected.resources.map(([x, y]) => y * 320 + x));
  for (const plan of corrected.encounters) for (const index of plan.spawnPoints) assert.equal(occupied.has(index), false);
});

test("전체 맵의 실제 자원 칸·매장량을 집계하고 비옥토·자갈을 지형에 맞춰 전역에 분산한다", () => {
  const world = generateWorld(13), occupied = new Set();
  for (const [x, y, amount, type] of world.resources) {
    assert.equal(occupied.has(y * 320 + x), false);
    occupied.add(y * 320 + x);
    if (!["clay", "tree", "pebbles", "dew"].includes(type)) continue;
    assert.ok(amount > 0);
    assert.equal(isResourceHabitat(type, world, x, y), true);
  }
  for (const metric of world.economy.resources) {
    const nodes = world.resources.filter(point => point[3] === metric.key);
    assert.equal(metric.cells, nodes.length);
    assert.equal(metric.coverage, nodes.length / (320 * 320));
    assert.equal(metric.amount, nodes.reduce((sum, point) => sum + point[2], 0));
    if (["clay", "pebbles"].includes(metric.key)) {
      assert.ok(metric.cells > 3000);
      assert.ok(metric.sectors > 80);
    }
  }
  for (const plan of world.encounters) for (const index of plan.spawnPoints) assert.equal(occupied.has(index), false);
});

test("다른 종족 시작권의 이슬은 일부 남기고 줄이며 샘방울 먹이와 기존 배치를 보존한다", () => {
  const previous = generateWorld(13, 15), current = generateWorld(13);
  assert.equal(previous.generationVersion, 15);
  assert.equal(current.generationVersion, 16);
  assert.deepEqual(current.terrain, previous.terrain);
  assert.deepEqual(current.camps, previous.camps);
  assert.deepEqual(current.food, previous.food);
  assert.deepEqual(current.resources.filter(point => point[3] !== "dew"), previous.resources.filter(point => point[3] !== "dew"));
  assert.deepEqual(current.economy.starts, previous.economy.starts);
  const dew = world => world.resources.filter(point => point[3] === "dew");
  const near = (points, camp, radius) => points.filter(([x, y]) => Math.hypot(x - camp.x, y - camp.y) <= radius);
  for (const camp of current.camps) {
    const before = near(dew(previous), camp, 22), after = near(dew(current), camp, 22);
    if (camp.tribe === "spring") {
      assert.deepEqual(near(dew(current), camp, 32), near(dew(previous), camp, 32));
    } else if (before.length) {
      assert.ok(after.length > 0, camp.tribe + " 이슬 잔존");
      if (before.length >= 20) assert.ok(after.length < before.length * .4, camp.tribe + " 이슬 감소");
    }
  }
  const outside = point => current.camps.every(camp => camp.tribe === "spring" || Math.hypot(point[0] - camp.x, point[1] - camp.y) >= 32);
  assert.deepEqual(dew(current).filter(outside), dew(previous).filter(outside));
  assert.ok(dew(current).length < dew(previous).length);
});
