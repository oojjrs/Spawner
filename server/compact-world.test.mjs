import test from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "./world.mjs";

test("160칸 실패 시드는 네 부족과 통행 가능한 균형 지형을 생성한다", () => {
  const world = generateWorld(1165626204), h = world.hydrology;
  assert.equal(world.size, 160);
  assert.equal(world.camps.length, 4);
  const counts = Array(11).fill(0);
  for (const type of world.terrain) counts[type]++;
  const land = world.terrain.length - counts[0] - counts[1] - counts[10];
  assert.ok(h.continent.landFraction >= .7 && h.continent.landFraction <= .85);
  assert.ok((counts[6] + counts[7] + counts[8]) / land <= .21);
  assert.ok(counts[5] / land >= .18 && counts[5] / land <= .25);
  assert.ok(counts[9] / land >= .04 && counts[9] / land <= .09);
  assert.ok(h.fords.length > 0);
  assert.ok(h.channels.length > 0);
  for (const point of h.channels.flatMap(channel => channel.points)) assert.ok(Number.isFinite(point.radius) && point.radius > 0 && point.radius < world.size * .01);
  for (const type of ["clay", "tree", "pebbles", "dew"]) assert.ok(world.resources.some(point => point[3] === type));
  for (let grain = 0; grain < 3; grain++) {
    const { produced, stored, exported } = h.sedimentBudget;
    assert.ok(Math.abs(produced[grain] - stored[grain] - exported[grain]) <= Math.max(1, produced[grain]) * 1e-8);
  }
});

test("이전 160칸 생성 버전은 기존 시드의 지형을 유지한다", () => {
  const world = generateWorld(7, 35), counts = Array(11).fill(0);
  for (const type of world.terrain) counts[type]++;
  assert.equal(world.size, 160);
  assert.deepEqual(counts, [5234,82,694,45,5605,1179,6897,1662,1110,3085,7]);
  assert.deepEqual(world.camps.map(camp => [camp.x, camp.y]), [[130,139],[89,115],[127,98],[20,95]]);
});
