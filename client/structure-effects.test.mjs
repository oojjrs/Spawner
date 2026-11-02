import test from "node:test";
import assert from "node:assert/strict";
import { NEST_GROWTH_ANIMATIONS } from "./nest-growth.mjs";
import { createStructureEffectPlayback, syncStructureEffectPlayback, structureEffectPose } from "./structure-effects.mjs";

const nest = (tribe, level, health) => ({ id: "nest", tribe, nestLevel: level, nestHealth: health, x: 10, y: 10 });

test("둥지 완료 효과는 각 부족의 실제 변신이 끝난 다음 한 번 재생한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const playback = createStructureEffectPlayback();
    syncStructureEffectPlayback(playback, [nest(tribe, 1, 100)], [], 10, true, 10);
    syncStructureEffectPlayback(playback, [nest(tribe, 2, 200)], [], 11, false, 11);
    const finish = 11 + NEST_GROWTH_ANIMATIONS[tribe].duration;
    const effect = playback.effects.get("colony:nest:complete");
    assert.equal(structureEffectPose(effect, finish - .001, false), null);
    assert.equal(structureEffectPose(effect, finish + .1, false).type, "complete");
    syncStructureEffectPlayback(playback, [nest(tribe, 2, 200)], [], finish + .1, false, finish + .1);
    assert.equal(playback.effects.get("colony:nest:complete").startedAt, finish);
    syncStructureEffectPlayback(playback, [nest(tribe, 2, 200)], [], finish + 2, false, finish + 2);
    assert.equal(playback.effects.size, 0);
  }
});

test("모든 상위 변신과 전용 애니메이션이 없는 성장에도 완료 효과를 붙인다", () => {
  for (const [tribe, definition] of Object.entries(NEST_GROWTH_ANIMATIONS)) {
    for (const level of [3, 4]) {
      const playback = createStructureEffectPlayback();
      syncStructureEffectPlayback(playback, [nest(tribe, level - 1, 200)], [], 1, true, 1);
      syncStructureEffectPlayback(playback, [nest(tribe, level, 400)], [], 2, false, 2);
      const effect = playback.effects.get("colony:nest:complete");
      assert.equal(effect.startedAt, 2 + (definition.upgrades[level]?.duration || 0));
      assert.ok(structureEffectPose(effect, effect.startedAt + .2, true).reducedMotion);
    }
  }
});

test("저장·재접속·새 발견·시간 되감기에는 완료나 피격 효과를 재생하지 않는다", () => {
  const playback = createStructureEffectPlayback();
  syncStructureEffectPlayback(playback, [nest("bean", 3, 400)], [], 10, true, 10);
  assert.equal(playback.effects.size, 0);
  syncStructureEffectPlayback(playback, [nest("bean", 3, 400), { ...nest("spring", 4, 800), id: "new" }], [], 11, false, 11);
  syncStructureEffectPlayback(playback, [nest("bean", 3, 400)], [], 12, false, 12);
  assert.equal(playback.effects.size, 0);
  syncStructureEffectPlayback(playback, [nest("bean", 4, 800)], [], 13, false, 13);
  syncStructureEffectPlayback(playback, [nest("bean", 4, 800)], [], 13.1, true, 13.1);
  assert.equal(playback.effects.size, 0);
  syncStructureEffectPlayback(playback, [nest("bean", 2, 100)], [], 5, false, 5);
  assert.equal(playback.effects.size, 0);
});

test("둥지·굴 파괴는 완료 효과를 취소하고 파괴 효과를 한 번만 재생한다", () => {
  const playback = createStructureEffectPlayback();
  const burrow = health => ({ id: "den", health, x: 30, y: 30, width: 3, height: 3 });
  syncStructureEffectPlayback(playback, [nest("bean", 1, 100)], [burrow(100)], 1, true, 1);
  syncStructureEffectPlayback(playback, [nest("bean", 2, 200)], [burrow(80)], 2, false, 2);
  assert.equal(playback.effects.get("burrow:den:damage").type, "damage");
  syncStructureEffectPlayback(playback, [nest("bean", 2, 0)], [burrow(0)], 3, false, 3);
  assert.equal(playback.effects.size, 2);
  for (const effect of playback.effects.values()) assert.equal(effect.type, "destroy");
  syncStructureEffectPlayback(playback, [nest("bean", 2, 0)], [burrow(0)], 3.1, false, 3.1);
  for (const effect of playback.effects.values()) assert.equal(effect.startedAt, 3);
  syncStructureEffectPlayback(playback, [], [], 3.2, false, 3.2);
  assert.equal(playback.effects.size, 0);
  assert.equal(playback.structures.size, 0);
});

test("변신 중 부족 교체나 레벨 하락은 예약된 완료 효과를 취소한다", () => {
  for (const changed of [nest("spring", 2, 200), nest("bean", 1, 100)]) {
    const playback = createStructureEffectPlayback();
    syncStructureEffectPlayback(playback, [nest("bean", 1, 100)], [], 1, true, 1);
    syncStructureEffectPlayback(playback, [nest("bean", 2, 200)], [], 2, false, 2);
    syncStructureEffectPlayback(playback, [changed], [], 3, false, 3);
    assert.equal(playback.effects.has("colony:nest:complete"), false);
  }
});
