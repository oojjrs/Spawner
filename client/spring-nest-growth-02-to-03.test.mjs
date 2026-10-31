import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { imageDimensions } from "./image-audit.mjs";
import { NEST_GROWTH_ASSETS, nestGrowthAnimation, createNestGrowthPlayback, syncNestGrowthPlayback,
  nestGrowthFrame, nestIdleFrame } from "./nest-growth.mjs";

const entry = { id: "spring-nest", tribe: "spring", nestLevel: 3, nestHealth: 100 };

test("샘방울 2→3은 확인한 시트를 그대로 쓰고 완전 잠수 뒤 두 프레임에서만 성장형을 바꾼다", () => {
  const animation = nestGrowthAnimation("spring", 2, 3);
  const source = new URL("../AnimationCandidates/SpringNestGrowth02To03QuantumV4/", import.meta.url);
  const metadata = JSON.parse(readFileSync(new URL("animation.json", source), "utf8"));
  assert.ok(readFileSync(new URL("../" + animation.image, import.meta.url)).equals(readFileSync(new URL("growth.png", source))));
  assert.deepEqual(imageDimensions(new URL("../" + animation.image, import.meta.url)), [4096, 4096]);
  assert.equal(animation.duration * 1000, metadata.durationMs);
  assert.ok(NEST_GROWTH_ASSETS.includes(animation.image));
  const playback = createNestGrowthPlayback();
  syncNestGrowthPlayback(playback, [{ ...entry, nestLevel: 2 }], 10, true);
  syncNestGrowthPlayback(playback, [entry], 11, false);
  for (const [elapsed, expected] of [[0, 0], [.499, 0], [.5, 1], [1.65, 24], [1.749, 25], [1.75, 26],
    [3.35, 58], [3.449, 59], [3.45, 60], [3.6, 63], [4.999, 63], [5, null]])
    assert.equal(nestGrowthFrame(playback, entry, 11 + elapsed, false), expected);
  assert.deepEqual(metadata.fullySubmergedMs, [1650, 3350]);
  assert.deepEqual(metadata.stageChangeMs, [1750, 3450]);
  assert.equal(metadata.bodyInterpolation, false);
  assert.equal(metadata.bodyCrossfade, false);
  assert.equal(metadata.bodyMaterialWipe, false);
  syncNestGrowthPlayback(playback, [entry], 13, false);
  assert.equal(playback.effects.get(entry.id).startedAt, 11);
  assert.equal(nestIdleFrame(playback, entry, 16, false), 0);
  assert.equal(nestIdleFrame(playback, entry, 17, false), 30);
  syncNestGrowthPlayback(playback, [entry], 16, false);
  assert.equal(playback.effects.size, 0);
});

test("샘방울 3레벨 첫 로드·건너뛰기에는 성장을 재생하지 않고 파괴·다음 레벨에서는 끝낸다", () => {
  for (const initial of [3, 1]) {
    const playback = createNestGrowthPlayback();
    syncNestGrowthPlayback(playback, [{ ...entry, nestLevel: initial }], 10, true);
    syncNestGrowthPlayback(playback, [entry], 11, false);
    assert.equal(nestGrowthFrame(playback, entry, 12, false), null);
  }
  for (const changed of [{ ...entry, nestHealth: 0 }, { ...entry, nestLevel: 4 }]) {
    const playback = createNestGrowthPlayback();
    syncNestGrowthPlayback(playback, [{ ...entry, nestLevel: 2 }], 10, true);
    syncNestGrowthPlayback(playback, [entry], 11, false);
    syncNestGrowthPlayback(playback, [changed], 12, false);
    assert.equal(playback.effects.size, 0);
  }
});
