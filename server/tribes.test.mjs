import test from "node:test";
import assert from "node:assert/strict";
import { generateTribes } from "./tribes.mjs";
import { generateWorld } from "./world.mjs";

function flatWorld(sites) {
  return { seed: 731047, sites, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), burrows: [] };
}

test("다른 부족 3개를 실제 거리 200~240칸·260~320칸 두 곳으로 재현하며 원본 후보를 보존한다", () => {
  const world = flatWorld([[160, 160], [50, 50], [300, 20], [300, 300]]), before = structuredClone(world);
  const tribes = generateTribes(world);
  assert.equal(tribes.length, 3);
  assert.equal(tribes.filter(tribe => tribe.distanceBand === "near").length, 1);
  assert.equal(tribes.filter(tribe => tribe.distanceBand === "far").length, 2);
  assert.deepEqual(tribes.map(tribe => tribe.pathDistance), [220, 280, 280]);
  assert.deepEqual(tribes.map(tribe => tribe.contactSeconds), [374, 494, 494]);
  assert.ok(tribes.every(tribe => tribe.activityRadius === 25));
  assert.deepEqual(generateTribes(world), tribes); assert.deepEqual(world, before);
  assert.equal(new Set(tribes.map(tribe => tribe.siteIndex)).size, 3);
  for (const tribe of tribes) assert.deepEqual([tribe.x, tribe.y], world.sites[tribe.siteIndex]);
});

test("강을 우회하는 실제 경로로 거리 구간을 판정하고 고립된 후보는 배치하지 않는다", () => {
  const world = flatWorld([[100, 100], [210, 100]]);
  for (let y = 0; y < 320; y++) if (y !== 160) world.terrain[y * 320 + 155] = 0;
  const tribes = generateTribes(world);
  assert.equal(tribes.length, 3); assert.equal(tribes[0].pathDistance, 230);
  assert.ok(tribes[0].contactSeconds >= 300);
  world.terrain[160 * 320 + 155] = 0;
  const isolated = generateTribes(world);
  assert.equal(isolated.length, 3); assert.ok(isolated.every(tribe => tribe.x < 155));
});

test("5분 이후 조우 조건을 만족할 후보가 없으면 실제 접촉 시간을 유지하며 세 곳을 보완한다", () => {
  const world = flatWorld([[100, 100], [140, 100]]);
  for (let y = 0; y < 320; y++) if (y !== 180) world.terrain[y * 320 + 120] = 0;
  const tribes = generateTribes(world);
  assert.equal(tribes.length, 3);
  assert.ok(tribes.some(tribe => tribe.contactSeconds < 300));
});

test("거리 조건을 완화해도 위험하거나 막힌 둥지 후보는 사용하지 않는다", () => {
  const world = flatWorld([[160, 160], [190, 160], [60, 60], [35, 35], [300, 300], [10, 60]]);
  world.hazards[60 * 320 + 60] = 1;
  world.burrows.push({ x: 299, y: 300, width: 3, height: 1 });
  const tribes = generateTribes(world);
  assert.equal(tribes.length, 3);
  assert.ok(tribes.every(tribe => tribe.siteIndex !== 2 && tribe.siteIndex !== 4));
  assert.equal(generateTribes(flatWorld([[160, 160]])).length, 3);
});

test("세 부족을 함께 선택해 가까운 후보 하나가 먼 두 후보의 배치를 막지 않게 한다", () => {
  const world = flatWorld([[160, 160], [260, 280], [50, 50], [300, 20], [300, 300]]);
  const tribes = generateTribes(world);
  assert.equal(tribes.length, 3); assert.equal(tribes[0].siteIndex, 2);
  assert.deepEqual(new Set(tribes.slice(1).map(tribe => tribe.siteIndex)), new Set([3, 4]));
});

test("방향 조건을 만족할 후보가 부족하면 안전한 위치로 세 부족을 채운다", () => {
  const world = flatWorld([[160, 160], [50, 50], [290, 290], [300, 300]]);
  const tribes = generateTribes(world);
  assert.equal(tribes.length, 3); assert.equal(tribes[0].siteIndex, 1);
  const [first, second] = tribes;
  assert.ok(Math.abs(first.x - second.x) + Math.abs(first.y - second.y) >= 120);
  assert.ok(tribes.every(tribe => tribe.contactSeconds >= 300));
});

test("통로뿐인 인공 지형에서는 가능한 둥지 두 곳을 사용하고 겹치는 세 번째는 만들지 않는다", () => {
  const world = flatWorld([[160, 160], [170, 170], [150, 170]]);
  world.terrain.fill(0);
  for (let x = 160; x <= 240; x++) world.terrain[160 * 320 + x] = 4;
  for (let y = 160; y <= 190; y++) world.terrain[y * 320 + 240] = 4;
  for (let x = 130; x <= 240; x++) world.terrain[190 * 320 + x] = 4;
  for (let y = 170; y <= 190; y++) for (const x of [130, 170]) world.terrain[y * 320 + x] = 4;
  for (let x = 130; x <= 150; x++) world.terrain[170 * 320 + x] = 4;
  for (const [x, y] of world.sites) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) world.terrain[(y + dy) * 320 + x + dx] = 4;
  }
  assert.equal(generateTribes({ ...world, sites: [world.sites[0], world.sites[1]] })[0].pathDistance, 200);
  assert.equal(generateTribes({ ...world, sites: [world.sites[0], world.sites[2]] })[0].pathDistance, 260);
  const tribes = generateTribes(world);
  assert.equal(tribes.length, 2); assert.equal(tribes[0].siteIndex, 1);
});

test("굴을 통과하는 지름길을 사용하지 않고 파괴 후 열린 길은 다음 배치 계산에 반영한다", () => {
  const world = flatWorld([[100, 100], [210, 100]]);
  for (let y = 0; y < 320; y++) if (y !== 100 && y !== 160) world.terrain[y * 320 + 155] = 0;
  world.burrows.push({ x: 155, y: 100, width: 1, height: 1 });
  assert.equal(generateTribes(world)[0].pathDistance, 230);
  world.burrows.length = 0;
  const open = generateTribes(world);
  assert.equal(open.length, 3);
  assert.ok(open.some(tribe => tribe.siteIndex === 1 && tribe.pathDistance === 110));
});

test("다른 후보가 없는 고립된 시작 생활권에서도 안전하고 재현 가능한 세 부족을 배치한다", () => {
  const world = flatWorld([[160, 160]]);
  world.terrain.fill(0);
  for (let y = 148; y <= 172; y++) for (let x = 148; x <= 172; x++) world.terrain[y * 320 + x] = 4;
  const before = structuredClone(world), tribes = generateTribes(world);
  assert.equal(tribes.length, 3);
  assert.ok(tribes.every(tribe => tribe.siteIndex === null));
  assert.deepEqual(generateTribes(world), tribes);
  assert.deepEqual(world, before);
  for (const tribe of tribes) for (const other of [{ x: 160, y: 160 }, ...tribes.filter(item => item !== tribe)]) {
    assert.ok(Math.max(Math.abs(tribe.x - other.x), Math.abs(tribe.y - other.y)) >= 5);
  }
});

test("기본·예시·양 끝 시드 모두 세 부족이 재현되며 실제 경로와 둥지 안전을 지킨다", () => {
  for (const seed of [0, 397, 731047, 4294967295]) {
    const world = generateWorld(seed), tribes = world.tribes;
    assert.equal(tribes.length, 3, "시드 " + seed);
    assert.equal(new Set(tribes.map(tribe => tribe.id)).size, 3);
    assert.deepEqual(generateTribes(world), tribes);
    const blocked = new Uint8Array(320 * 320);
    for (const burrow of world.burrows) for (let dy = 0; dy < burrow.height; dy++) for (let dx = 0; dx < burrow.width; dx++) {
      blocked[(burrow.y + dy) * 320 + burrow.x + dx] = 1;
    }
    const distances = new Int32Array(320 * 320).fill(-1), queue = [world.origin.y * 320 + world.origin.x];
    distances[queue[0]] = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor], x = index % 320, y = Math.floor(index / 320);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, next = ny * 320 + nx;
        if (nx < 0 || ny < 0 || nx >= 320 || ny >= 320 || distances[next] >= 0 || blocked[next] ||
            world.terrain[next] < 2 || world.terrain[next] > 6) continue;
        distances[next] = distances[index] + 1; queue.push(next);
      }
    }
    for (const tribe of tribes) {
      assert.notEqual(tribe.siteIndex, 0);
      assert.equal(tribe.pathDistance, distances[tribe.y * 320 + tribe.x]);
      assert.ok(tribe.contactSeconds >= 0 && tribe.contactSeconds < 4294967295);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
        const index = (tribe.y + dy) * 320 + tribe.x + dx;
        assert.ok(world.terrain[index] >= 2 && world.terrain[index] <= 6);
        assert.equal(world.hazards[index], 0);
        assert.equal(blocked[index], 0);
      }
      for (const other of [world.origin, ...tribes.filter(item => item !== tribe)]) {
        assert.ok(Math.max(Math.abs(tribe.x - other.x), Math.abs(tribe.y - other.y)) >= 5);
      }
    }
  }
});
