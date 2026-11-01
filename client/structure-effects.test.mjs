import test from "node:test";
import assert from "node:assert/strict";
import { NEST_GROWTH_ANIMATIONS } from "./nest-growth.mjs";
import { createStructureEffectPlayback, syncStructureEffectPlayback, structureEffectPose } from "./structure-effects.mjs";

const nest = (tribe, level, health) => ({ id: "nest", tribe, nestLevel: level, nestHealth: health, x: 10, y: 10 });
const building = (health, completedAt) => ({ id: "store", key: "storage", health, completedAt, x: 20, y: 20, width: 2, height: 2 });

test("둥지 완료 효과는 각 부족의 실제 변신이 끝난 다음 한 번 재생한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const playback = createStructureEffectPlayback();
    syncStructureEffectPlayback(playback, [nest(tribe, 1, 100)], [], [], 10, true, 10);
    syncStructureEffectPlayback(playback, [nest(tribe, 2, 200)], [], [], 11, false, 11);
    const finish = 11 + NEST_GROWTH_ANIMATIONS[tribe].duration;
    const effect = playback.effects.get("colony:nest:complete");
    assert.equal(structureEffectPose(effect, finish - .001, false), null);
    assert.equal(structureEffectPose(effect, finish + .1, false).type, "complete");
    syncStructureEffectPlayback(playback, [nest(tribe, 2, 200)], [], [], finish + .1, false, finish + .1);
    assert.equal(playback.effects.get("colony:nest:complete").startedAt, finish);
    syncStructureEffectPlayback(playback, [nest(tribe, 2, 200)], [], [], finish + 2, false, finish + 2);
    assert.equal(playback.effects.size, 0);
  }
});

test("모든 상위 변신과 전용 애니메이션이 없는 성장에도 완료 효과를 붙인다", () => {
  for (const [tribe, definition] of Object.entries(NEST_GROWTH_ANIMATIONS)) {
    for (const level of [3, 4]) {
      const playback = createStructureEffectPlayback();
      syncStructureEffectPlayback(playback, [nest(tribe, level - 1, 200)], [], [], 1, true, 1);
      syncStructureEffectPlayback(playback, [nest(tribe, level, 400)], [], [], 2, false, 2);
      const effect = playback.effects.get("colony:nest:complete");
      assert.equal(effect.startedAt, 2 + (definition.upgrades[level]?.duration || 0));
      assert.ok(structureEffectPose(effect, effect.startedAt + .2, true).reducedMotion);
    }
  }
});

test("저장·재접속·새 발견·시간 되감기에는 완료나 피격 효과를 재생하지 않는다", () => {
  const playback = createStructureEffectPlayback();
  syncStructureEffectPlayback(playback, [nest("bean", 3, 400)], [building(120, 10)], [], 10, true, 10);
  assert.equal(playback.effects.size, 0);
  syncStructureEffectPlayback(playback, [nest("bean", 3, 400), { ...nest("spring", 4, 800), id: "new" }], [], [], 11, false, 11);
  syncStructureEffectPlayback(playback, [nest("bean", 3, 400)], [building(120, 10)], [], 12, false, 12);
  assert.equal(playback.effects.size, 0);
  syncStructureEffectPlayback(playback, [nest("bean", 4, 800)], [], [], 13, false, 13);
  syncStructureEffectPlayback(playback, [nest("bean", 4, 800)], [], [], 13.1, true, 13.1);
  assert.equal(playback.effects.size, 0);
  syncStructureEffectPlayback(playback, [nest("bean", 2, 100)], [], [], 5, false, 5);
  assert.equal(playback.effects.size, 0);
});

test("완공은 최근에 생긴 건물에만 적용하고 연속 피격은 효과를 계속 되감지 않는다", () => {
  const playback = createStructureEffectPlayback();
  syncStructureEffectPlayback(playback, [], [], [], 10, true, 10);
  syncStructureEffectPlayback(playback, [], [building(120, 10.05)], [], 10.1, false, 10.1);
  assert.equal(playback.effects.get("building:store:complete").startedAt, 10.05);
  syncStructureEffectPlayback(playback, [], [building(110, 10.05)], [], 10.15, false, 10.15);
  syncStructureEffectPlayback(playback, [], [building(100, 10.05)], [], 10.2, false, 10.2);
  assert.equal(playback.effects.get("building:store:damage").startedAt, 10.15);
  syncStructureEffectPlayback(playback, [], [building(90, 10.05)], [], 10.6, false, 10.6);
  assert.equal(playback.effects.get("building:store:damage").startedAt, 10.6);
});

test("건물 완공이 보간 중인 화면보다 앞서 도착해도 실제 완료 시각에 효과를 재생한다", () => {
  const playback = createStructureEffectPlayback();
  syncStructureEffectPlayback(playback, [], [], [], 10, true, 10.2);
  syncStructureEffectPlayback(playback, [], [building(120, 10.3)], [], 10.1, false, 10.4);
  const effect = playback.effects.get("building:store:complete");
  assert.ok(effect);
  assert.equal(structureEffectPose(effect, 10.2, false), null);
  assert.equal(structureEffectPose(effect, 10.4, false).type, "complete");
});

test("둥지·건물·굴 파괴는 완료 효과를 취소하고 파괴 효과를 한 번만 재생한다", () => {
  const playback = createStructureEffectPlayback();
  const burrow = health => ({ id: "den", health, x: 30, y: 30, width: 3, height: 3 });
  syncStructureEffectPlayback(playback, [nest("bean", 1, 100)], [building(120, 0)], [burrow(100)], 1, true, 1);
  syncStructureEffectPlayback(playback, [nest("bean", 2, 200)], [building(110, 0)], [burrow(80)], 2, false, 2);
  assert.equal(playback.effects.get("burrow:den:damage").type, "damage");
  syncStructureEffectPlayback(playback, [nest("bean", 2, 0)], [building(0, 0)], [burrow(0)], 3, false, 3);
  assert.equal(playback.effects.size, 3);
  for (const effect of playback.effects.values()) assert.equal(effect.type, "destroy");
  syncStructureEffectPlayback(playback, [nest("bean", 2, 0)], [building(0, 0)], [burrow(0)], 3.1, false, 3.1);
  for (const effect of playback.effects.values()) assert.equal(effect.startedAt, 3);
  syncStructureEffectPlayback(playback, [], [], [], 3.2, false, 3.2);
  assert.equal(playback.effects.size, 0);
  assert.equal(playback.structures.size, 0);
});

test("변신 중 부족 교체나 레벨 하락은 예약된 완료 효과를 취소한다", () => {
  for (const changed of [nest("spring", 2, 200), nest("bean", 1, 100)]) {
    const playback = createStructureEffectPlayback();
    syncStructureEffectPlayback(playback, [nest("bean", 1, 100)], [], [], 1, true, 1);
    syncStructureEffectPlayback(playback, [nest("bean", 2, 200)], [], [], 2, false, 2);
    syncStructureEffectPlayback(playback, [changed], [], [], 3, false, 3);
    assert.equal(playback.effects.has("colony:nest:complete"), false);
  }
});
