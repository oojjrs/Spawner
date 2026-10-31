import test from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "./world.mjs";
import { measureCampExpansion, campResourceTravel } from "./resource-camps.mjs";
import { populateResourceNodes, populateForestResources, isFoodHabitat } from "./resources.mjs";
import { hydrologyResourceSuitability } from "./hydrology.mjs";

function totals(world) {
  const result = {};
  for (const [, , amount, key] of [...world.food, ...world.resources]) result[key] = (result[key] || 0) + amount;
  return result;
}

for (const seed of [1, 13, 4294967295]) test("섬·자연 자원·숲과 목재·시작과 확장: " + seed, () => {
  const previous = generateWorld(seed, 19), world = generateWorld(seed, 24), { size, terrain, hydrology: h } = world;
  assert.equal(world.generationVersion, 24);
  assert.deepEqual(totals(world), totals(previous));
  assert.equal(terrain.filter(type => type < 2 || type === 10).length, previous.terrain.filter(type => type < 2).length);
  for (let position = 0; position < size; position++) for (const index of [position, (size - 1) * size + position, position * size, position * size + size - 1]) {
    assert.equal(h.water[index], 3, "외곽 바다"); assert.ok(terrain[index] < 2);
  }
  const seen = new Set([0]), queue = [0];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor], x = index % size, y = Math.floor(index / size);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const next = ny * size + nx;
      if (h.water[next] !== 3 || seen.has(next)) continue;
      seen.add(next); queue.push(next);
    }
  }
  assert.equal(seen.size, h.water.filter(type => type === 3).length, "외해의 연결");
  const shorelines = Array.from({ length: 4 }, () => []);
  for (let position = 8; position < size - 8; position++) for (let side = 0; side < 4; side++) {
    let depth = 0;
    for (; depth < size; depth++) {
      const index = side === 0 ? depth * size + position : side === 1 ? (size - 1 - depth) * size + position :
        side === 2 ? position * size + depth : position * size + size - 1 - depth;
      if (h.water[index] !== 3) break;
    }
    shorelines[side].push(depth);
  }
  assert.ok(shorelines.filter(line => Math.max(...line) - Math.min(...line) >= 12).length >= 3, "여러 해안의 만과 돌출부");
  assert.ok(Math.max(...shorelines.flat()) >= 20, "안쪽으로 들어오는 만");
  assert.ok(h.channels.length > 1 && h.fords.length > 0 && h.lakeCount > 0);
  const occupied = new Set(), treeCells = new Set();
  for (const [x, y, amount, key] of [...world.food, ...world.resources]) {
    const index = y * size + x;
    assert.equal(occupied.has(index), false); occupied.add(index);
    assert.ok(Number.isInteger(amount) && amount > 0);
    assert.ok(hydrologyResourceSuitability(key, index, terrain, world) > 0, key + " 자연 서식지");
    if (key === "tree") treeCells.add(index);
    for (const camp of world.camps) assert.ok(Math.abs(x - camp.x) > 2 || Math.abs(y - camp.y) > 2, "둥지 부지에 자원을 덮지 않음");
  }
  for (let index = 0; index < terrain.length; index++) assert.equal(treeCells.has(index), terrain[index] === 5, "숲과 목재의 일치");
  for (const [x, y] of world.food) assert.equal(isFoodHabitat("honey-mushrooms", world, x, y), true);
  assert.ok(occupied.size < terrain.filter(type => type >= 2 && type !== 10).length / 2, "대부분은 채집 지점 없는 필드");
  const keys = ["clay", "tree", "pebbles", "dew"], minimum = [6, 48, 6, 10];
  const firstTravel = campResourceTravel(world, world.camps[0], 1800);
  for (const [order, camp] of world.camps.entries()) {
    const expansion = measureCampExpansion(world, camp, keys[order]);
    assert.ok(expansion.directions >= 2, "여러 방향의 확장");
    for (const band of expansion.bands) assert.ok(band.nodes >= minimum[order], camp.tribe + " 단계별 안전한 자원 접근");
    if (order) assert.ok([[-2, -2], [2, -2], [-2, 2], [2, 2]].some(([dx, dy]) => firstTravel[(camp.y + dy) * size + camp.x + dx] >= 0), "종족 간 육상 연결");
  }
  const room = { world, food: new Map(world.food.map(([x, y, amount, resourceType]) => [x + "," + y, {x, y, amount, initialAmount: amount, resourceType}])) };
  populateResourceNodes(room); populateForestResources(room);
  const actual = {};
  for (const cell of room.food.values()) actual[cell.resourceType] = (actual[cell.resourceType] || 0) + cell.amount;
  assert.deepEqual(actual, totals(previous));
  assert.equal(world.treeCells.filter(Boolean).length, treeCells.size);
  for (const burrow of world.burrows) for (let dx = 0; dx < burrow.width; dx++) assert.equal(occupied.has(burrow.y * size + burrow.x + dx), false);
});
