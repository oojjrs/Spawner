import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { imageDimensions } from "./image-audit.mjs";
import { NEST_GROWTH_ANIMATIONS, NEST_GROWTH_ASSETS, createNestGrowthPlayback, syncNestGrowthPlayback, nestGrowthFrame, nestGrowthSounds, nestIdleAnimation, nestIdleFrame } from "./nest-growth.mjs";

const colony = (tribe, level) => ({ id: "nest", tribe, nestLevel: level, nestHealth: 100, x: 12, y: 8 });

test("기존 세 부족의 1→2 성장과 효과음을 유지한다", () => {
  for (const tribe of ["bean", "pebble", "spring"]) {
    const playback = createNestGrowthPlayback();
    syncNestGrowthPlayback(playback, [colony(tribe, 1)], 10, true);
    assert.equal(playback.effects.size, 0);
    const grown = colony(tribe, 2);
    syncNestGrowthPlayback(playback, [grown], 11, false);
    assert.equal(nestGrowthFrame(playback, grown, 11, false), 0);
    assert.equal(nestGrowthFrame(playback, grown, 11.599, false), 0);
    assert.deepEqual(nestGrowthSounds(playback, 11.599), []);
    assert.equal(nestGrowthFrame(playback, grown, 11.6, false), 1);
    assert.deepEqual(nestGrowthSounds(playback, 11.6).map(event => event.name), ["nest-growth-" + tribe]);
    syncNestGrowthPlayback(playback, [grown], 11.6, false);
    assert.equal(playback.effects.get("nest").startedAt, 11);
    assert.deepEqual(nestGrowthSounds(playback, 11.7), []);
    assert.equal(nestGrowthFrame(playback, grown, 12.96, false), 18);
    assert.equal(nestGrowthFrame(playback, grown, 13.36, false), 23);
    assert.equal(nestGrowthFrame(playback, grown, 14.24, false), 34);
    assert.equal(nestGrowthFrame(playback, grown, 16.32, false), 60);
    assert.equal(nestGrowthFrame(playback, grown, 17.33, false), null);
    const spec = NEST_GROWTH_ANIMATIONS[tribe];
    const metadata = JSON.parse(readFileSync(new URL("../" + spec.image.slice(0, spec.image.lastIndexOf("/")) + "/animation.json", import.meta.url), "utf8"));
    assert.equal(metadata.durationsMs.reduce((sum, value) => sum + value, 0), spec.duration * 1000);
    assert.equal(metadata.audio.src, spec.audio);
    assert.ok(readFileSync(new URL("../" + spec.resting, import.meta.url)).length > 1000);
  }
});

test("저장된 2레벨·처음 발견한 둥지·재접속은 성장 효과를 재생하지 않는다", () => {
  const playback = createNestGrowthPlayback();
  const grown = colony("bean", 2);
  syncNestGrowthPlayback(playback, [grown], 0, true);
  assert.equal(nestGrowthFrame(playback, grown, .6, false), null);
  assert.deepEqual(nestGrowthSounds(playback, .6), []);
  syncNestGrowthPlayback(playback, [{ ...grown, id: "new" }], 1, false);
  assert.equal(playback.effects.size, 0);
  syncNestGrowthPlayback(playback, [colony("bean", 1)], 2, true);
  syncNestGrowthPlayback(playback, [grown], 3, false);
  syncNestGrowthPlayback(playback, [grown], 3.1, true);
  assert.equal(playback.effects.size, 0);
});

test("레벨 건너뛰기·부족 변경·파괴·시간 되감기와 늦은 효과음을 처리한다", () => {
  for (const change of [{ ...colony("bean", 2), nestHealth: 0 }, colony("spring", 2), colony("bean", 3)]) {
    const playback = createNestGrowthPlayback();
    syncNestGrowthPlayback(playback, [colony("bean", 1)], 1, true);
    syncNestGrowthPlayback(playback, [change], 2, false);
    assert.equal(playback.effects.size, 0);
  }
  const playback = createNestGrowthPlayback(), grown = colony("bean", 2);
  syncNestGrowthPlayback(playback, [colony("bean", 1)], 1, true);
  syncNestGrowthPlayback(playback, [grown], 2, false);
  assert.deepEqual(nestGrowthSounds(playback, 3), []);
  assert.deepEqual(nestGrowthSounds(playback, 3.1), []);
  assert.equal(nestGrowthFrame(playback, grown, 3, true), 0);
  assert.equal(nestGrowthFrame(playback, grown, 5.2, true), 60);
  syncNestGrowthPlayback(playback, [grown], 1, false);
  assert.equal(playback.effects.size, 0);
  syncNestGrowthPlayback(playback, [], 4, false);
  assert.equal(playback.levels.size, 0);
});

test("샘방울 3레벨은 채택한 120프레임 시트를 4초마다 반복하고 정지 상태를 지킨다", () => {
  const animation = nestIdleAnimation("spring", 3);
  const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/Nests/Idle03-v2/spring/animation.json", import.meta.url), "utf8"));
  assert.equal(animation.image, "DesignAssets/Animations/Nests/Idle03-v2/spring/" + metadata.image);
  assert.equal(animation.frameCount, metadata.frameCount);
  assert.equal(animation.columns, metadata.columns);
  assert.equal(animation.frameSize, metadata.frameSize[0]);
  assert.ok(Math.abs(animation.frameMs * animation.frameCount - metadata.periodMs) < .001);
  assert.ok(NEST_GROWTH_ASSETS.includes(animation.image));
  assert.ok(NEST_GROWTH_ASSETS.includes(NEST_GROWTH_ANIMATIONS.spring.levels[3]));
  const playback = createNestGrowthPlayback(), entry = colony("spring", 3);
  syncNestGrowthPlayback(playback, [entry], 12, true);
  for (const [elapsed, frame] of [[0, 0], [1 / 30, 1], [1, 30], [2, 60], [3.999, 119], [4, 0]])
    assert.equal(nestIdleFrame(playback, entry, 12 + elapsed, false), frame);
  assert.equal(playback.effects.size, 0);
  assert.equal(nestIdleFrame(playback, entry, 14, true), 0);
  assert.equal(nestIdleFrame(playback, { ...entry, nestHealth: 0 }, 14, false), 0);
  syncNestGrowthPlayback(playback, [entry], 50, true);
  assert.equal(nestIdleFrame(playback, entry, 50, false), 0);
  assert.equal(nestIdleFrame(playback, entry, 51, false), 30);
});

test("포자버섯 3레벨은 승인한 80프레임을 4초마다 반복하고 정지 상태를 지킨다", () => {
  const animation = nestIdleAnimation("spore", 3);
  const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/Nests/Idle03-v1/spore/animation.json", import.meta.url), "utf8"));
  assert.equal(animation.image, "DesignAssets/Animations/Nests/Idle03-v1/spore/" + metadata.animation);
  assert.equal(animation.frameCount, 80);
  assert.equal(animation.frameMs * animation.frameCount, 4000);
  assert.equal(metadata.durationsMs.reduce((sum, duration) => sum + duration, 0), 4000);
  assert.ok(NEST_GROWTH_ASSETS.includes(animation.image));
  assert.ok(NEST_GROWTH_ASSETS.includes(NEST_GROWTH_ANIMATIONS.spore.levels[3]));
  const playback = createNestGrowthPlayback(), entry = colony("spore", 3);
  syncNestGrowthPlayback(playback, [entry], 12, true);
  for (const [elapsed, frame] of [[0, 0], [.05, 1], [1.7, 34], [3.95, 79], [4, 0]])
    assert.equal(nestIdleFrame(playback, entry, 12 + elapsed, false), frame);
  assert.equal(playback.effects.size, 0);
  assert.equal(nestIdleFrame(playback, entry, 14, true), 0);
  assert.equal(nestIdleFrame(playback, { ...entry, nestHealth: 0 }, 14, false), 0);
  syncNestGrowthPlayback(playback, [entry], 50, true);
  assert.equal(nestIdleFrame(playback, entry, 50, false), 0);
  assert.equal(nestIdleFrame(playback, entry, 51, false), 20);
});


test("2레벨 대기 설정과 다른 종족·레벨의 정적 외형 선택을 유지한다", () => {
  const playback = createNestGrowthPlayback();
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    assert.equal(nestIdleAnimation(tribe, 2), NEST_GROWTH_ANIMATIONS[tribe].idle);
    assert.equal(nestIdleFrame(playback, colony(tribe, 1), 1, false), null);
    assert.ok(nestIdleAnimation(tribe, 3));
  }
});


test("새싹콩 3레벨은 채택한 정적 시트에서 120프레임을 4초마다 반복한다", () => {
  const animation = nestIdleAnimation("bean", 3);
  const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/Nests/Idle03-v1/sprout/animation.json", import.meta.url), "utf8"));
  assert.equal(animation.image, "DesignAssets/Animations/Nests/Idle03-v1/sprout/" + metadata.image);
  assert.equal(animation.frameCount, 120);
  assert.equal(animation.columns, 8);
  assert.equal(metadata.durationsMs.reduce((sum, duration) => sum + duration, 0), 4000);
  assert.deepEqual(imageDimensions(new URL("../" + animation.image, import.meta.url)), [4096, 7680]);
  assert.ok(NEST_GROWTH_ASSETS.includes(animation.image));
  assert.ok(NEST_GROWTH_ASSETS.includes(NEST_GROWTH_ANIMATIONS.bean.levels[3]));
  const playback = createNestGrowthPlayback(), entry = colony("bean", 3);
  syncNestGrowthPlayback(playback, [colony("bean", 2)], 10, true);
  syncNestGrowthPlayback(playback, [entry], 12, false);
  const idleStart = 12 + NEST_GROWTH_ANIMATIONS.bean.upgrades[3].duration;
  syncNestGrowthPlayback(playback, [entry], idleStart + .001, false);
  for (const [elapsed, frame] of [[0, 0], [1 / 30, 1], [.5, 15], [2, 60], [3.999, 119], [4, 0]])
    assert.equal(nestIdleFrame(playback, entry, idleStart + elapsed, false), frame);
  assert.equal(playback.effects.size, 0);
  assert.equal(nestIdleFrame(playback, entry, 14, true), 0);
  assert.equal(nestIdleFrame(playback, { ...entry, nestHealth: 0 }, 14, false), 0);
});

test("몽돌 4레벨은 승인한 발광을 4초마다 반복하고 정지 설정을 따른다", () => {
  const animation = nestIdleAnimation("pebble", 4);
  const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/Nests/Idle04-v1/pebble/animation.json", import.meta.url), "utf8"));
  assert.equal(animation.image, "DesignAssets/Animations/Nests/Idle04-v1/pebble/" + metadata.runtimeAnimation);
  assert.deepEqual(imageDimensions(new URL("../" + animation.image, import.meta.url)), [5120, 4096]);
  assert.equal(animation.frameMs * animation.frameCount, metadata.durationMs);
  assert.ok(NEST_GROWTH_ASSETS.includes(animation.image));
  const playback = createNestGrowthPlayback(), entry = colony("pebble", 4);
  syncNestGrowthPlayback(playback, [entry], 10, true);
  for (const [elapsed, frame] of [[0, 0], [.05, 1], [1.4, 28], [2.2, 44], [3.95, 79], [4, 0]])
    assert.equal(nestIdleFrame(playback, entry, 10 + elapsed, false), frame);
  assert.equal(nestIdleFrame(playback, entry, 12, true), 0);
  assert.equal(nestIdleFrame(playback, { ...entry, nestHealth: 0 }, 12, false), 0);
});

test("샘방울 4레벨은 수차 없는 시트를 4초마다 반복하고 정지 상태를 지킨다", () => {
  const animation = nestIdleAnimation("spring", 4);
  const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/Nests/Idle04-v2/spring/animation.json", import.meta.url), "utf8"));
  assert.equal(animation.image, "DesignAssets/Animations/Nests/Idle04-v2/spring/" + metadata.image);
  assert.equal(animation.frameCount, metadata.frameCount);
  assert.equal(animation.columns, metadata.columns);
  assert.equal(animation.frameSize, metadata.frameSize[0]);
  assert.ok(Math.abs(animation.frameMs * animation.frameCount - metadata.periodMs) < .001);
  assert.deepEqual(imageDimensions(new URL("../" + animation.image, import.meta.url)), [6144, 5120]);
  assert.deepEqual(imageDimensions(new URL("../" + NEST_GROWTH_ANIMATIONS.spring.levels[4], import.meta.url)), [512, 512]);
  assert.ok(NEST_GROWTH_ASSETS.includes(animation.image));
  assert.ok(NEST_GROWTH_ASSETS.includes(NEST_GROWTH_ANIMATIONS.spring.levels[4]));
  const playback = createNestGrowthPlayback(), entry = colony("spring", 4);
  syncNestGrowthPlayback(playback, [entry], 10, true);
  for (const [elapsed, frame] of [[0, 0], [1 / 30, 1], [1, 30], [2, 60], [3.999, 119], [4, 0]])
    assert.equal(nestIdleFrame(playback, entry, 10 + elapsed, false), frame);
  assert.equal(nestIdleFrame(playback, entry, 12, true), 0);
  assert.equal(nestIdleFrame(playback, { ...entry, nestHealth: 0 }, 12, false), 0);
});

test("포자버섯 1→2는 124프레임을 6.2초 동안 재생한다", () => {
  const spec = NEST_GROWTH_ANIMATIONS.spore;
  const metadata = JSON.parse(readFileSync(new URL("../" + spec.image.slice(0, spec.image.lastIndexOf("/")) + "/animation.json", import.meta.url), "utf8"));
  assert.equal(spec.frameCount, 124);
  assert.equal(spec.frameSize, 512);
  assert.equal(spec.columns, 12);
  assert.equal(spec.duration, 6.2);
  assert.equal(spec.firstFrameMs, 50);
  assert.equal(spec.frameMs, 50);
  assert.deepEqual(imageDimensions(new URL("../" + spec.image, import.meta.url)), [6144, 5632]);
  assert.equal(metadata.durationsMs.reduce((sum, value) => sum + value, 0), 6200);
  assert.equal(metadata.audio.src, spec.audio);
  const playback = createNestGrowthPlayback(), grown = colony("spore", 2);
  syncNestGrowthPlayback(playback, [colony("spore", 1)], 0, true);
  syncNestGrowthPlayback(playback, [grown], 1, false);
  for (const [elapsed, frame] of [[0, 0], [.05, 1], [.6, 12], [1, 20], [1.8, 36], [2.25, 45], [3.05, 61], [3.5, 70], [4.3, 86], [5.7, 114], [6.199, 123], [6.201, null]])
    assert.equal(nestGrowthFrame(playback, grown, 1 + elapsed, false), frame);
  assert.deepEqual(nestGrowthSounds(playback, 1.599), []);
  assert.deepEqual(nestGrowthSounds(playback, 1.6).map(event => event.name), ["nest-growth-spore"]);
  assert.deepEqual(nestGrowthSounds(playback, 1.7), []);
});

test("새싹콩 2→3은 V5의 109프레임과 정지 구간을 5.45초 동안 재생한다", () => {
  const animation = NEST_GROWTH_ANIMATIONS.bean.upgrades[3];
  const metadata = JSON.parse(readFileSync(new URL("../" + animation.image.replace("growth.png", "animation.json"), import.meta.url), "utf8"));
  assert.equal(animation.image, "DesignAssets/Animations/Nests/Growth02To03-v5/sprout/growth.png");
  assert.equal(animation.fromLevel, 2);
  assert.equal(animation.frameCount, 109);
  assert.equal(animation.duration, 5.45);
  assert.equal(animation.firstFrameMs, 50);
  assert.equal(animation.frameMs, 50);
  assert.equal(metadata.durationMs, 5450);
  assert.deepEqual(metadata.holdIntervalsFrames, [[15, 31], [35, 51], [55, 71]]);
  assert.deepEqual(imageDimensions(new URL("../" + animation.image, import.meta.url)), [4096, 7168]);
  assert.ok(NEST_GROWTH_ASSETS.includes(animation.image));
  const playback = createNestGrowthPlayback(), grown = colony("bean", 3);
  syncNestGrowthPlayback(playback, [colony("bean", 2)], -1, true);
  syncNestGrowthPlayback(playback, [grown], 0, false);
  for (const [elapsed, frame] of [[0, 0], [.05, 1], [.75, 15], [1.5, 30], [1.55, 31], [1.75, 35], [2.5, 50], [2.55, 51], [2.75, 55], [3.5, 70], [3.55, 71], [5.449, 108], [5.45, null]])
    assert.equal(nestGrowthFrame(playback, grown, elapsed, false), frame);
  syncNestGrowthPlayback(playback, [grown], 5.45, false);
  assert.equal(playback.effects.size, 0);
  assert.equal(nestIdleFrame(playback, grown, 5.45, false), 0);
  assert.equal(nestIdleFrame(playback, grown, 6.45, false), 30);
});

test("포자버섯 2→3 팝 성장은 채택한 시트를 끝까지 재생하고 3레벨 대기로 이어진다", () => {
  const animation = NEST_GROWTH_ANIMATIONS.spore.upgrades[3];
  const metadata = JSON.parse(readFileSync(new URL("../" + animation.image.replace("growth.png", "animation.json"), import.meta.url), "utf8"));
  assert.equal(animation.fromLevel, 2);
  assert.equal(animation.frameCount, metadata.frameCount);
  assert.equal(animation.columns, metadata.columns);
  assert.equal(animation.duration * 1000, metadata.durationMs);
  assert.deepEqual(imageDimensions(new URL("../" + animation.image, import.meta.url)),
    [metadata.columns * metadata.frameSize[0], metadata.rows * metadata.frameSize[1]]);
  assert.ok(NEST_GROWTH_ASSETS.includes(animation.image));
  const playback = createNestGrowthPlayback(), grown = colony("spore", 3);
  syncNestGrowthPlayback(playback, [colony("spore", 2)], 9, true);
  syncNestGrowthPlayback(playback, [grown], 10, false);
  assert.equal(playback.effects.get("nest").animation, animation);
  for (const frame of [0, ...metadata.growthCutFrames, metadata.frameCount - 1])
    assert.equal(nestGrowthFrame(playback, grown, 10 + frame / metadata.fps, false), frame);
  assert.deepEqual(nestGrowthSounds(playback, 10.6), []);
  const finish = 10 + animation.duration;
  syncNestGrowthPlayback(playback, [grown], finish, false);
  assert.equal(nestGrowthFrame(playback, grown, finish, false), null);
  assert.equal(nestIdleFrame(playback, grown, finish, false), 0);
});
