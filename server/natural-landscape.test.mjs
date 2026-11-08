import test from "node:test";
import assert from "node:assert/strict";
import { erodeLandscapeHeight } from "./landscape-processes.mjs";
import { createLandscapeHabitats } from "./landscape-ecology.mjs";
import { generateWorld } from "./world.mjs";
import { measureCampExpansion } from "./resource-camps.mjs";
import { hydrologyResourceSuitability } from "./hydrology.mjs";
import { populateResourceNodes, populateForestResources } from "./resources.mjs";

for (const seed of [1, 13, 4294967295, 3546955617, 82146103]) test("자연 산맥·구릉·해안·생태와 확장: " + seed, () => {
  const world = generateWorld(seed, 32, undefined, seed === 1), { size, terrain, hydrology: h } = world;
  assert.equal(world.generationVersion, 32); assert.equal(h.continent.natural, true);
  assert.ok(h.uplifts.filter(feature => feature.type === "range").length >= 2);
  assert.ok(h.uplifts.filter(feature => feature.type === "branch").length >= 4);
  assert.ok(h.uplifts.filter(feature => feature.type === "hill").length >= 6);
  const visited = new Set(), patches = [], sectors = new Set();
  for (let first = 0; first < terrain.length; first++) {
    if (terrain[first] < 6 || terrain[first] > 8 || visited.has(first)) continue;
    const cells = [first]; visited.add(first);
    for (let cursor = 0; cursor < cells.length; cursor++) {
      const index = cells[cursor], x = index % size, y = Math.floor(index / size);
      sectors.add(Math.floor(x / 80) + "," + Math.floor(y / 80));
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;
        const next = (y + dy) * size + x + dx;
        if (visited.has(next) || terrain[next] < 6 || terrain[next] > 8) continue;
        visited.add(next); cells.push(next);
      }
    }
    if (cells.length >= 6) patches.push(cells.length);
  }
  assert.ok(Math.max(...patches) >= 1000, "길게 연결된 산맥");
  assert.ok(patches.filter(count => count <= 180).length >= 3, "작은 구릉과 산줄기");
  assert.ok(Math.max(...patches) / Math.min(...patches) >= 8, "크기가 다양한 산지");
  assert.ok(sectors.size >= 6, "여러 지역의 산지와 넓은 간격");
  const major = patches.filter(count => count >= 250).sort((left, right) => right - left);
  assert.ok(major.length >= 3, "서로 분리된 중대형 산계");
  assert.ok(major[1] >= major[0] * .2, "큰 산맥 이외에도 뚜렷한 산계");
  assert.ok(major[0] < visited.size * .65, "한 산괴로 합쳐지지 않는 산지");
  assert.ok(h.headwaters.length <= 8 && h.headwaters.length >= h.riverBasins.length, "발달한 지류와 합류 위주인 수계");
  assert.ok(h.riverBasins.length >= 3, "서로 다른 하구로 흐르는 독립 수계");
  assert.ok(world.frontierSites.filter(site => site.contenders.length >= 2).length >= 2, "여러 종족이 접근하는 확장 거점");
  assert.equal(new Set(world.frontierSites.filter(site => site.contenders.length >= 2).flatMap(site => site.contenders.map(entry => entry.tribe))).size, 4, "모든 종족의 확장 경로가 다른 종족과 접촉");
  assert.ok(world.resources.some(([x, y, amount, key]) => key === "dew" && amount >= 24 && terrain[y * size + x] === 9), "습지의 큰 이슬 군락");
  assert.equal(world.food.length, 0, "버섯 자원 배치 제거");
  assert.equal(world.hazards.includes(1), false, "독 포자 배치 제거");
  for (const index of h.headwaters) assert.ok(h.uplift[index] >= .06 && h.resourceHabitats.mountainDistance[index] <= 6, "산지와 연결된 수원");
  if (seed === 1) {
    const inputs = h.placementMaps.filter(field => field.stage === "original" && !/:draw$|:priority$|sector-priority/.test(field.id));
    assert.deepEqual(inputs.map(field => field.id).sort(), ["geology:bedrock-noise", "terrain:roughness"]);
    assert.equal(h.placementMaps.some(field => field.id === "relief:coast-shelf" || field.id.startsWith("biome:forest-broad")), false);
    const initial = h.placementMaps.find(field => field.id === "relief:height").values;
    for (let index = 0; index < terrain.length; index++) {
      assert.ok(Math.abs(initial[index] - h.basement[index] - h.uplift[index]) < .000001);
      assert.equal(h.resourceHabitats.parentRock[index], h.bedrock[index]);
      assert.ok(Math.abs(h.height[index] - h.ground[index]) < .000001);
      if (h.water[index] === 3) assert.ok(h.ground[index] <= h.seaLevel);
    }
  }
  const pebbles = world.resources.filter(point => point[3] === "pebbles");
  assert.ok(pebbles.filter(([x, y]) => h.gravel[y * size + x] > 0).length > pebbles.length / 2, "강변 퇴적지가 주된 자갈 산지");
  for (let coordinate = 0; coordinate < size; coordinate++) for (const index of [coordinate, (size - 1) * size + coordinate, coordinate * size, coordinate * size + size - 1]) assert.equal(h.water[index], 3, "네 면의 바다 연결");
  for (let index = 0; index < terrain.length; index++) {
    assert.equal(Boolean(h.river[index]), h.water[index] === 1, "강과 바다 분류 일치");
    assert.equal(Boolean(h.lake[index]), h.water[index] === 2, "호수 분류 일치");
    if (h.water[index] === 3) assert.ok(h.surface[index] <= h.seaLevel, "해수면 아래로 연결된 바다");
    if (terrain[index] === 9) assert.ok(h.slope[index] < .025 && h.resourceHabitats.soilMoisture[index] > .42, "완만하고 습한 저지대의 늪");
    if (world.hazards[index] === 1) assert.equal(terrain[index], 9, "늪에 형성되는 독 포자 군락");
    assert.notEqual(world.hazards[index], 2, "가시 뿌리 배치 제거");
  }
  let seaDepth = 0;
  for (let index = 0; index < terrain.length; index++) if (h.water[index] === 3) {
    const x = index % size, y = Math.floor(index / size);
    seaDepth = Math.max(seaDepth, Math.min(x, y, size - 1 - x, size - 1 - y));
  }
  assert.ok(seaDepth >= size * .1, "낮은 육지로 들어오는 바다");
  assert.ok(h.riverMouths.length && h.fords.length);
  for (const mouth of h.riverMouths) assert.ok(mouth.surface <= h.seaLevel + .00001);
  for (let index = 0; index < h.downstream.length; index++) {
    const next = h.downstream[index];
    if (next >= 0) {assert.ok(h.surface[next] < h.surface[index]); assert.ok(h.flow[next] >= h.flow[index]);}
  }
  const occupied = new Set(), trees = new Set(), totals = {};
  for (const [x, y, amount, key] of [...world.food, ...world.resources]) {
    const index = y * size + x;
    assert.equal(occupied.has(index), false); occupied.add(index);
    assert.ok(Number.isInteger(amount) && amount > 0);
    assert.ok(hydrologyResourceSuitability(key, index, terrain, world) > 0);
    if (key === "tree") trees.add(index);
    totals[key] = (totals[key] || 0) + amount;
    for (const camp of world.camps) assert.ok(Math.abs(x - camp.x) > 2 || Math.abs(y - camp.y) > 2);
  }
  for (let index = 0; index < terrain.length; index++) assert.equal(trees.has(index), Boolean(h.forestMask[index]));
  assert.ok(occupied.size < terrain.filter(type => type >= 2 && type !== 10).length / 2);
  const blocked = new Set(), connected = new Uint8Array(terrain.length), route = new Int32Array(terrain.length);
  for (const camp of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) blocked.add((camp.y + dy) * size + camp.x + dx);
  }
  for (const burrow of world.burrows) for (let dx = 0; dx < burrow.width; dx++) blocked.add(burrow.y * size + burrow.x + dx);
  let end = 0;
  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    const index = (world.camps[0].y + dy) * size + world.camps[0].x + dx;
    connected[index] = 1; route[end++] = index;
  }
  for (let cursor = 0; cursor < end; cursor++) {
    const index = route[cursor], x = index % size, y = Math.floor(index / size);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const next = ny * size + nx;
      if (connected[next] || blocked.has(next) || terrain[next] < 2 || world.hazards[next]) continue;
      connected[next] = 1; route[end++] = next;
    }
  }
  const keys = ["clay", "tree", "pebbles", "dew"], minimum = [6, 48, 6, 10];
  for (const [order, camp] of world.camps.entries()) {
    const expansion = measureCampExpansion(world, camp, keys[order]);
    assert.ok(expansion.directions >= 2);
    for (const band of expansion.bands) assert.ok(band.nodes >= minimum[order]);
    if (order) assert.ok([[-2, -2], [2, -2], [-2, 2], [2, 2]].some(([dx, dy]) => connected[(camp.y + dy) * size + camp.x + dx]));
  }
  const expected = {};
  for (const [, , , type] of world.resources) {
    if (["clay", "tree", "pebbles", "dew"].includes(type)) expected[type] = (expected[type] || 0) + 5000;
  }
  const room = { world, food: new Map(world.food.map(([x, y, amount, resourceType]) => [x + "," + y, { x, y, amount, initialAmount: amount, resourceType }])) };
  populateResourceNodes(room); populateForestResources(room);
  const actual = {};
  for (const cell of room.food.values()) actual[cell.resourceType] = (actual[cell.resourceType] || 0) + cell.amount;
  assert.deepEqual(actual, expected); assert.equal(world.treeCells.filter(Boolean).length, trees.size);
});

test("사면 수분은 같은 지형의 여러 내리막으로 나뉜다", () => {
  const size = 3, terrain = new Uint8Array(9).fill(4), h = { size, ground: new Float64Array(9), water: new Uint8Array(9),
    rainfall: new Float64Array(9).fill(1), slope: new Float32Array(9).fill(.01), bedrock: new Float32Array(9).fill(.5),
    uplift: new Float32Array(9), wetness: new Float32Array(9), fertility: new Float32Array(9), sand: new Float32Array(9) };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h.ground[y * size + x] = 9 - x - y;
  h.seaLevel = 0;
  const eroded = erodeLandscapeHeight(h.ground, h.rainfall, size, h);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    assert.ok(eroded[y * size + x] <= h.ground[y * size + x]);
    assert.ok(Math.abs(eroded[y * size + x] - eroded[x * size + y]) < .000001);
  }
  assert.ok(eroded[0] < h.ground[0]);
  const fields = createLandscapeHabitats({ size, terrain, hydrology: h }), flow = fields.hillslopeFlow;
  for (const index of [1, 3, 4]) assert.ok(flow[index] > h.rainfall[index]);
  assert.ok(Math.abs(flow[8] - 9) < .000001);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) assert.ok(Math.abs(flow[y * size + x] - flow[x * size + y]) < .000001);
});
