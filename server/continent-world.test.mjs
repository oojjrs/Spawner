import test from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "./world.mjs";
import { measureCampExpansion, campResourceTravel } from "./resource-camps.mjs";
import { populateResourceNodes, populateForestResources, isFoodHabitat, REMOVED_RESOURCE_TYPES } from "./resources.mjs";
import { hydrologyResourceSuitability } from "./hydrology.mjs";

function totals(world) {
  const result = {};
  for (const [, , amount, key] of [...world.food, ...world.resources]) result[key] = (result[key] || 0) + amount;
  return result;
}

for (const seed of [1, 13, 4294967295]) test("대륙·분산 산지·하구·자원과 확장: " + seed, () => {
  const previous = generateWorld(seed, 19), world = generateWorld(seed, 25), { size, terrain, hydrology: h } = world;
  assert.equal(world.generationVersion, 25);
  assert.equal(h.island, false); assert.ok(h.continent);
  assert.deepEqual(totals(world), totals(previous));
  assert.equal(terrain.filter(type => type < 2 || type === 10).length, previous.terrain.filter(type => type < 2).length);
  const boundary = new Set();
  for (let position = 0; position < size; position++) for (const index of [position, (size - 1) * size + position, position * size, position * size + size - 1]) boundary.add(index);
  assert.ok([...boundary].filter(index => terrain[index] >= 2 && terrain[index] !== 10).length > boundary.size * .4, "지도 경계까지 이어지는 대륙");
  assert.ok([...boundary].some(index => h.water[index] === 3), "열린 해안");
  const mountain = type => type >= 6 && type <= 8, visited = new Set(), patches = [], quadrants = [0, 0, 0, 0];
  for (const type of [6, 7, 8]) assert.equal(terrain.filter(value => value === type).length, previous.terrain.filter(value => value === type).length);
  for (let first = 0; first < terrain.length; first++) {
    if (!mountain(terrain[first]) || visited.has(first)) continue;
    const cells = [first]; visited.add(first);
    for (let cursor = 0; cursor < cells.length; cursor++) {
      const index = cells[cursor], x = index % size, y = Math.floor(index / size);
      quadrants[(x >= size / 2 ? 1 : 0) + (y >= size / 2 ? 2 : 0)]++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;
        const next = (y + dy) * size + x + dx;
        if (visited.has(next) || !mountain(terrain[next])) continue;
        visited.add(next); cells.push(next);
      }
    }
    if (cells.length >= 12) patches.push(cells.length);
  }
  assert.ok(patches.length >= 12, "분산된 여러 산지");
  assert.ok(Math.max(...patches) < visited.size * .18, "중앙의 한 산괴로 몰리지 않음");
  assert.ok(quadrants.every(count => count > visited.size * .08), "여러 지역의 산지");
  assert.ok(h.riverMouths.length > 0 && h.fords.length > 0 && h.lakeCount > 0);
  for (const mouth of h.riverMouths) {
    assert.equal(h.water[Math.floor(mouth.y) * size + Math.floor(mouth.x)], 3);
    assert.ok(mouth.surface <= h.seaLevel + .00001);
  }
  for (let index = 0; index < h.downstream.length; index++) {
    const next = h.downstream[index];
    if (next >= 0) {assert.ok(h.surface[next] < h.surface[index]); assert.ok(h.flow[next] >= h.flow[index]);}
  }
  const occupied = new Set(), trees = new Set();
  for (const [x, y, amount, key] of [...world.food, ...world.resources]) {
    const index = y * size + x;
    assert.equal(occupied.has(index), false); occupied.add(index);
    assert.ok(Number.isInteger(amount) && amount > 0);
    assert.ok(hydrologyResourceSuitability(key, index, terrain, world) > 0);
    if (key === "tree") trees.add(index);
    for (const camp of world.camps) assert.ok(Math.abs(x - camp.x) > 2 || Math.abs(y - camp.y) > 2);
  }
  for (let index = 0; index < terrain.length; index++) assert.equal(trees.has(index), terrain[index] === 5);
  for (const [x, y] of world.food) assert.equal(isFoodHabitat("honey-mushrooms", world, x, y), true);
  assert.ok(occupied.size < terrain.filter(type => type >= 2 && type !== 10).length / 2);
  const keys = ["clay", "tree", "pebbles", "dew"], minimum = [6, 48, 6, 10], travel = campResourceTravel(world, world.camps[0], 1800);
  for (const [order, camp] of world.camps.entries()) {
    const expansion = measureCampExpansion(world, camp, keys[order]);
    assert.ok(expansion.directions >= 2);
    for (const band of expansion.bands) assert.ok(band.nodes >= minimum[order]);
    if (order) assert.ok([[-2, -2], [2, -2], [-2, 2], [2, 2]].some(([dx, dy]) => travel[(camp.y + dy) * size + camp.x + dx] >= 0));
  }
  const expected = {};
  for (const [, , , type] of world.resources) {
    if (["clay", "tree", "pebbles", "dew"].includes(type)) expected[type] = (expected[type] || 0) + 5000;
  }
  const room = { world, food: new Map(world.food.map(([x, y, amount, resourceType]) => [x + "," + y, {x, y, amount, initialAmount: amount, resourceType}])) };
  populateResourceNodes(room); populateForestResources(room);
  const actual = {};
  for (const cell of room.food.values()) actual[cell.resourceType] = (actual[cell.resourceType] || 0) + cell.amount;
  assert.deepEqual(actual, expected);
  assert.ok([...room.food.values()].every(cell => !REMOVED_RESOURCE_TYPES.includes(cell.resourceType)));
  assert.equal(world.treeCells.filter(Boolean).length, trees.size);
});
