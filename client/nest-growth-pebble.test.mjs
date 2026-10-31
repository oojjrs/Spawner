import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nestGrowthAnimation, NEST_GROWTH_ASSETS, createNestGrowthPlayback, syncNestGrowthPlayback,
  nestGrowthFrame, nestGrowthSounds, nestIdleFrame } from "./nest-growth.mjs";

const colony = level => ({ id: "pebble", tribe: "pebble", nestLevel: level, nestHealth: 100 });

test("몽돌 3→4는 승인한 v5 시트와 6.32초 타이밍을 사용한다", () => {
  const animation = nestGrowthAnimation("pebble", 3, 4);
  const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/Nests/Growth03To04-v5/pebble/animation.json", import.meta.url), "utf8"));
  assert.equal(animation.image, "DesignAssets/Animations/Nests/Growth03To04-v5/pebble/Runtime/growth.png");
  assert.ok(NEST_GROWTH_ASSETS.includes(animation.image));
  assert.equal(animation.frameCount, metadata.frameCount);
  assert.equal(animation.columns, metadata.columns);
  assert.equal(animation.duration * 1000, metadata.durationsMs.reduce((sum, ms) => sum + ms, 0));
  const playback = createNestGrowthPlayback(), grown = colony(4);
  syncNestGrowthPlayback(playback, [colony(3)], 10, true);
  syncNestGrowthPlayback(playback, [grown], 11, false);
  let start = 0;
  for (let frame = 0; frame < metadata.frameCount; frame++) {
    assert.equal(nestGrowthFrame(playback, grown, 11 + (start + .01) / 1000, false), frame);
    start += metadata.durationsMs[frame];
  }
  syncNestGrowthPlayback(playback, [grown], 14, false);
  assert.equal(playback.effects.get(grown.id).startedAt, 11);
  assert.equal(nestGrowthFrame(playback, grown, 17.319, false), 141);
  assert.equal(nestGrowthFrame(playback, grown, 17.321, false), null);
  assert.equal(nestIdleFrame(playback, grown, 17.321, false), 0);
  assert.equal(nestIdleFrame(playback, grown, 17.371, false), 1);
  assert.deepEqual(nestGrowthSounds(playback, 12), []);
});

test("몽돌 3→4는 실제 연속 승급에서만 시작하고 초기 접속·건너뛰기·파괴를 제외한다", () => {
  assert.equal(nestGrowthAnimation("pebble", 2, 4), null);
  assert.equal(nestGrowthAnimation("spring", 3, 4), null);
  for (const level of [1, 2, 4]) {
    const playback = createNestGrowthPlayback();
    syncNestGrowthPlayback(playback, [colony(level)], 10, true);
    syncNestGrowthPlayback(playback, [colony(4)], 11, false);
    assert.equal(playback.effects.size, 0);
  }
  for (const changed of [{ ...colony(4), nestHealth: 0 }, { ...colony(4), tribe: "spring" }]) {
    const playback = createNestGrowthPlayback();
    syncNestGrowthPlayback(playback, [colony(3)], 10, true);
    syncNestGrowthPlayback(playback, [changed], 11, false);
    assert.equal(playback.effects.size, 0);
  }
  const playback = createNestGrowthPlayback();
  syncNestGrowthPlayback(playback, [colony(3)], 10, true);
  syncNestGrowthPlayback(playback, [colony(4)], 11, false);
  assert.equal(nestGrowthFrame(playback, colony(4), 12, true), 0);
  assert.equal(nestGrowthFrame(playback, colony(4), 15, true), 141);
  syncNestGrowthPlayback(playback, [colony(4)], 12, true);
  assert.equal(playback.effects.size, 0);
});
