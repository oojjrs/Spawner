import test from "node:test";
import assert from "node:assert/strict";
import { generateBurrows } from "./burrows.mjs";
import { generateWorld } from "./world.mjs";

function flatWorld(sites) {
  return { seed: 731047, sites, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320), creatureDensity: new Uint8Array(320 * 320).fill(255), food: [] };
}

function fillDensity(world, x1, y1, x2, y2) {
  world.creatureDensity.fill(0);
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) world.creatureDensity[y * 320 + x] = 255;
}

function flatContactSeconds(burrow, site) {
  const entrance = burrow.entrance;
  const boundary = [[-3, -1], [-3, 0], [-3, 1], [-2, -2], [-2, 2],
    [-1, -3], [0, -3], [1, -3], [-1, 3], [0, 3], [1, 3],
    [2, -2], [2, 2], [3, -1], [3, 0], [3, 1]];
  let minimum = Infinity;
  for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) {
    if (dx * dx + dy * dy > 81) continue;
    for (const [ox, oy] of boundary) {
      const steps = Math.abs(entrance.x + dx - site[0] - ox) + Math.abs(entrance.y + dy - site[1] - oy);
      minimum = Math.min(minimum, steps * 2);
    }
  }
  return minimum;
}

test("굴 좌표는 시드로 재현되며 평지에서 두 크기의 거리와 목표 개수를 지킨다", () => {
  const world = flatWorld([[100, 100]]);
  const before = structuredClone(world);
  const burrows = generateBurrows(world);
  assert.deepEqual(world, before);
  assert.deepEqual(generateBurrows(world), burrows);
  assert.notDeepEqual(generateBurrows({ ...world, seed: 731048 }), burrows);
  assert.equal(burrows.filter(burrow => burrow.type === "small").length, 2);
  assert.equal(burrows.filter(burrow => burrow.type === "large").length, 1);
  for (const burrow of burrows) {
    const seconds = flatContactSeconds(burrow, world.sites[0]);
    assert.ok(seconds >= (burrow.type === "small" ? 60 : 120));
    assert.ok(seconds <= (burrow.type === "small" ? 120 : 240));
    assert.equal(burrow.width, burrow.type === "small" ? 1 : 3);
    assert.equal(burrow.height, 1);
  }
});

test("굴의 전체 크기와 입구는 안전권·먹이·위험 지형을 피하고 통로 여유와 간격을 확보한다", () => {
  const world = flatWorld([[100, 100], [220, 200]]);
  for (let y = 20; y < 300; y += 17) for (let x = 20; x < 300; x += 17) world.food.push([x, y, 10]);
  for (let y = 30; y < 290; y++) world.hazards[y * 320 + 170] = 1;
  for (let x = 30; x < 120; x++) world.terrain[200 * 320 + x] = 0;
  const burrows = generateBurrows(world);
  const food = new Set(world.food.map(([x, y]) => x + "," + y));
  assert.ok(burrows.length > 0);
  assert.equal(new Set(burrows.map(burrow => burrow.id)).size, burrows.length);
  for (const burrow of burrows) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= burrow.width; dx++) {
      const x = burrow.x + dx, y = burrow.y + dy, index = y * 320 + x;
      assert.ok(x >= 0 && y >= 0 && x < 320 && y < 320);
      assert.ok(world.terrain[index] >= 2 && world.terrain[index] <= 6);
      assert.equal(world.hazards[index], 0);
      assert.ok(!food.has(x + "," + y));
      if (dy === 0 && dx >= 0 && dx < burrow.width) {
        assert.ok(world.sites.every(([cx, cy]) => Math.hypot(x - cx, y - cy) >= 32));
      }
    }
    assert.ok(world.sites.every(([cx, cy]) => Math.hypot(burrow.entrance.x - cx, burrow.entrance.y - cy) >= 32));
    for (const other of burrows) {
      if (burrow === other) continue;
      const dx = Math.max(burrow.x - (other.x + other.width - 1), other.x - (burrow.x + burrow.width - 1), 0);
      const dy = Math.abs(burrow.y - other.y);
      assert.ok(Math.hypot(dx, dy) >= (burrow.type === "large" || other.type === "large" ? 22 : 12));
    }
  }
});

test("연결되지 않은 섬은 밀도가 높아도 굴 후보가 되지 않는다", () => {
  const world = flatWorld([[100, 100]]);
  world.terrain.fill(0);
  for (let y = 85; y <= 115; y++) for (let x = 85; x <= 115; x++) world.terrain[y * 320 + x] = 4;
  for (let y = 30; y <= 230; y++) for (let x = 150; x <= 280; x++) world.terrain[y * 320 + x] = 4;
  assert.deepEqual(generateBurrows(world), []);
});

test("겹치는 생활권의 굴은 양쪽 목표량에 반영해 중복으로 채우지 않는다", () => {
  const world = flatWorld([[100, 100], [116, 100]]);
  fillDensity(world, 86, 141, 130, 143);
  const burrows = generateBurrows(world);
  assert.equal(burrows.length, 2);
  assert.ok(burrows.every(burrow => burrow.type === "small"));
  for (const burrow of burrows) for (const site of world.sites) {
    const seconds = flatContactSeconds(burrow, site);
    assert.ok(seconds >= 60 && seconds <= 120);
  }
});

test("강을 돌아가는 경로는 직선 거리와 달리 먼 큰 굴 후보로 분류한다", () => {
  const world = flatWorld([[100, 100]]);
  for (let y = 0; y < 320; y++) if (y < 140 || y > 142) world.terrain[y * 320 + 119] = 0;
  fillDensity(world, 143, 99, 150, 105);
  const burrows = generateBurrows(world);
  assert.equal(burrows.length, 1);
  assert.equal(burrows[0].type, "large");
  assert.ok(flatContactSeconds(burrows[0], world.sites[0]) < 120);
});

test("실제 월드 생성 결과에 두 크기의 굴 좌표를 추가한다", () => {
  const world = generateWorld(731047);
  assert.ok(world.burrows.some(burrow => burrow.type === "small"));
  assert.ok(world.burrows.some(burrow => burrow.type === "large"));
});
