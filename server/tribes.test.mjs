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
  assert.equal(tribes.length, 1); assert.equal(tribes[0].pathDistance, 230);
  assert.ok(tribes[0].contactSeconds >= 300);
  world.terrain[160 * 320 + 155] = 0;
  assert.deepEqual(generateTribes(world), []);
});

test("둥지 경로가 길어도 강 너머 활동 개체가 5분 전에 보이는 후보는 제외한다", () => {
  const world = flatWorld([[100, 100], [140, 100]]);
  for (let y = 0; y < 320; y++) if (y !== 180) world.terrain[y * 320 + 120] = 0;
  assert.deepEqual(generateTribes(world), []);
});

test("가까운 쌍·거리 구간 밖·위험하거나 막힌 둥지 후보를 끼워 넣지 않는다", () => {
  const world = flatWorld([[160, 160], [190, 160], [60, 60], [35, 35], [300, 300], [10, 60]]);
  world.hazards[60 * 320 + 60] = 1;
  world.burrows.push({ x: 299, y: 300, width: 3, height: 1 });
  assert.deepEqual(generateTribes(world), []);
  assert.deepEqual(generateTribes(flatWorld([[160, 160]])), []);
});

test("세 부족을 함께 선택해 가까운 후보 하나가 먼 두 후보의 배치를 막지 않게 한다", () => {
  const world = flatWorld([[160, 160], [260, 280], [50, 50], [300, 20], [300, 300]]);
  const tribes = generateTribes(world);
  assert.equal(tribes.length, 3); assert.equal(tribes[0].siteIndex, 2);
  assert.deepEqual(new Set(tribes.slice(1).map(tribe => tribe.siteIndex)), new Set([3, 4]));
});

test("같은 방향의 부족을 중복으로 채우지 않고 조건 부족 시 배치 수를 줄인다", () => {
  const world = flatWorld([[160, 160], [50, 50], [290, 290], [300, 300]]);
  const tribes = generateTribes(world);
  assert.equal(tribes.length, 2); assert.equal(tribes[0].siteIndex, 1);
  const [first, second] = tribes;
  assert.ok(Math.abs(first.x - second.x) + Math.abs(first.y - second.y) >= 120);
  assert.ok(tribes.every(tribe => tribe.contactSeconds >= 300));
});

test("우리에게는 둘 다 멀어도 서로 120칸 안쪽인 부족은 함께 배치하지 않는다", () => {
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
  assert.equal(tribes.length, 1); assert.equal(tribes[0].siteIndex, 1);
});

test("굴을 통과하는 지름길을 사용하지 않고 파괴 후 열린 길은 다음 배치 계산에 반영한다", () => {
  const world = flatWorld([[100, 100], [210, 100]]);
  for (let y = 0; y < 320; y++) if (y !== 100 && y !== 160) world.terrain[y * 320 + 155] = 0;
  world.burrows.push({ x: 155, y: 100, width: 1, height: 1 });
  assert.equal(generateTribes(world)[0].pathDistance, 230);
  world.burrows.length = 0;
  assert.deepEqual(generateTribes(world), []);
});

test("실제 월드는 시드로 재현되는 부족 좌표를 추가하고 모든 거리·방향 기준을 지킨다", () => {
  const world = generateWorld(731047), tribes = world.tribes;
  assert.deepEqual(generateTribes(world), tribes);
  assert.ok(tribes.length > 0 && tribes.length <= 3);
  for (const tribe of tribes) {
    assert.ok(tribe.contactSeconds >= 300);
    assert.ok(tribe.pathDistance >= (tribe.distanceBand === "near" ? 200 : 260));
    assert.ok(tribe.pathDistance <= (tribe.distanceBand === "near" ? 240 : 320));
    assert.notEqual(tribe.siteIndex, 0);
    for (const other of tribes) {
      if (tribe === other) continue;
      const ax = tribe.x - world.origin.x, ay = tribe.y - world.origin.y;
      const bx = other.x - world.origin.x, by = other.y - world.origin.y;
      assert.ok((ax * bx + ay * by) / Math.hypot(ax, ay) / Math.hypot(bx, by) <= Math.SQRT1_2 + 1e-10);
    }
  }
});
