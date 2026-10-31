import test from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "./world.mjs";
import { hydrologyResourceSuitability } from "./hydrology.mjs";
import { unitTerrainSpeedMultiplier } from "./attributes.mjs";
import { startingTravel } from "./start-economy.mjs";
import { populateResourceNodes, populateForestResources } from "./resources.mjs";

function amounts(world) {
  const result = {};
  for (const [, , amount, key] of [...world.food, ...world.resources]) result[key] = (result[key] || 0) + amount;
  return result;
}

for (const seed of [1, 13, 4294967295]) test("수계·자원 총량·도하·빈 필드 보존: " + seed, () => {
  const previous = generateWorld(seed, 19), world = generateWorld(seed, 22), h = world.hydrology;
  assert.deepEqual(amounts(world), amounts(previous));
  assert.equal(world.terrain.filter(type => type < 2 || type === 10).length, previous.terrain.filter(type => type < 2).length);
  assert.equal(world.generationVersion, 22);
  if (seed === 1) {
    const riverWorld = generateWorld(seed, 21);
    assert.deepEqual(world.terrain, riverWorld.terrain);
    assert.deepEqual(h.water, riverWorld.hydrology.water);
    assert.deepEqual(h.fords, riverWorld.hydrology.fords);
    assert.deepEqual(world.camps, riverWorld.camps);
  }
  assert.ok(h.fords.length > 0);
  assert.ok(h.lakeCount > 0);
  assert.ok(h.water.some(type => type === 1));
  assert.ok(h.riverBasins.length >= 3, "여러 유역의 강줄기");
  assert.ok(h.headwaters.length >= 8, "분산된 발원 지류");
  assert.ok(h.confluences.length >= 2, "지류의 합류");
  let bends = 0;
  for (const channel of h.channels) {
    if (channel.points.length < 40) continue;
    let distance = 0;
    for (let index = 1; index < channel.points.length; index++) {
      const a = channel.points[index - 1], b = channel.points[index]; distance += Math.hypot(b.x - a.x, b.y - a.y);
    }
    const first = channel.points[0], last = channel.points.at(-1), direct = Math.hypot(last.x - first.x, last.y - first.y);
    if (distance > direct * 1.05) bends++;
  }
  assert.ok(bends >= 3, "굴곡이 있는 여러 강 구간");
  const occupied = new Set();
  for (const [x, y, amount, key] of [...world.food, ...world.resources]) {
    const index = y * world.size + x;
    assert.ok(Number.isInteger(amount) && amount > 0);
    assert.equal(occupied.has(index), false);
    assert.ok(hydrologyResourceSuitability(key, index, world.terrain, world) > 0, key + " habitat");
    assert.equal(world.hazards[index], 0);
    occupied.add(index);
  }
  for (const plan of world.encounters) for (const index of plan.spawnPoints || []) assert.equal(occupied.has(index), false);
  const room = { world, food: new Map(world.food.map(([x, y, amount, resourceType]) => [x + "," + y, {x, y, amount, initialAmount: amount, resourceType}])) };
  populateResourceNodes(room); populateForestResources(room);
  const actual = {};
  for (const cell of room.food.values()) actual[cell.resourceType] = (actual[cell.resourceType] || 0) + cell.amount;
  assert.deepEqual(actual, amounts(previous));
  assert.equal(world.treeCells.filter(Boolean).length, world.resources.filter(point => point[3] === "tree").length);
  const dryLand = world.terrain.filter(type => type >= 2 && type !== 10).length;
  assert.ok(occupied.size < dryLand / 4);
  assert.equal(world.resourceHotspots.length, 0);
  for (const key of ["tree", "dew", "clay", "grass-fiber", "honey-mushrooms"]) {
    const points = [...world.food, ...world.resources].filter(point => point[3] === key);
    const inland = points.filter(([x, y]) => h.waterDistance[y * world.size + x] > 10);
    assert.ok(inland.length > points.length * .1, key + " inland habitat");
  }
  for (let index = 0; index < h.downstream.length; index++) {
    const next = h.downstream[index];
    if (next < 0) continue;
    assert.ok(h.surface[next] < h.surface[index]);
    assert.ok(h.flow[next] >= h.flow[index]);
  }
  for (const ford of h.fords) for (const index of ford.cells) {
    assert.equal(world.terrain[index], 10);
    assert.equal(h.water[index], 1);
  }
  for (const camp of world.camps) assert.ok(world.economy.starts.find(entry => entry.tribe === camp.tribe).amount > 0);
  for (const [order, metric] of world.economy.starts.entries()) {
    assert.ok(Math.abs(metric.weightedAmount - previous.economy.starts[order].weightedAmount) <= 1);
  }
  assert.equal(unitTerrainSpeedMultiplier({}, 10), .5);
});

test("여울은 도하 비용을 지불해 건너고 일반 수면은 길을 차단한다", () => {
  const size = 28, camp = {x: 14, y: 14}, terrain = new Uint8Array(size * size).fill(1);
  for (let x = 16; x <= 20; x++) terrain[12 * size + x] = 3;
  const world = {size, terrain, hazards: new Uint8Array(size * size), camps: [camp], burrows: []};
  terrain[12 * size + 17] = 10;
  const travel = startingTravel(world, camp);
  assert.equal(travel[12 * size + 17], 6);
  assert.equal(travel[12 * size + 18], 9);
  terrain[12 * size + 17] = 1;
  assert.equal(startingTravel(world, camp)[12 * size + 18], -1);
});
