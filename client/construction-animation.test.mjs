import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { constructionUnitPose, constructionMorphPose, constructionApproachOffset, createConstructionAnimation, CONSTRUCTION_ANIMATION_ASSETS } from "./construction-animation.mjs";
import { constructionApproachCell, constructionSiteCenter } from "../server/buildings.mjs";
import { attributeCounts, unitStats, unitMovementSpeed } from "../server/attributes.mjs";
import { organicConstructionPose, organicShellVertices, organicBedPose } from "./construction-organic.mjs";

test("변태 속성이 있는 네 종족만 전용 체형을 쓰며 실제 이동 시간이 30% 감속된다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    for (const feet of [false, true]) {
      const base = attributeCounts(feet ? ["feet"] : []), heavy = attributeCounts(feet ? ["feet", "construction"] : ["construction"]);
      assert.equal(unitMovementSpeed(unitStats(heavy, tribe)), unitMovementSpeed(unitStats(base, tribe)) * .7);
      assert.equal(constructionUnitPose({ tribe, attributes: base }, 0), null);
      assert.equal(constructionUnitPose({ tribe, attributes: heavy }, 0).frame, 0);
      const agent = { tribe, attributes: heavy, health: 10, moveStartedAt: 1, moveDuration: 4, stepCount: 1 };
      assert.equal(constructionUnitPose(agent, 2).action, "walk");
      assert.equal(constructionUnitPose(agent, 2).frame, feet ? 8 : 6);
      assert.equal(constructionUnitPose({ ...agent, birth: { readyAt: 10 } }, 2), null);
    }
  }
});

test("변태 애니메이션은 저장된 시작·완료 시각을 따라 재생하며 취소 즉시 해제된다", () => {
  const agent = { health: 10, attributes: { construction: 1 }, construction: {
    buildingKey: "storage", state: "transforming", startedAt: 10, readyAt: 25 } };
  assert.equal(constructionMorphPose(agent, 10).progress, 0);
  for (const [time, stage, extent] of [[12, 1, 1], [12.5, 1, 1], [16.5, 2, 2], [17.5, 2, 2], [22, 3, 3], [23, 3, 3]]) {
    const pose = constructionMorphPose(agent, time);
    assert.equal(pose.stage, stage); assert.equal(pose.extent, extent); assert.equal(pose.opening, 0);
  }
  assert.ok(constructionMorphPose(agent, 24).opening > 0);
  assert.equal(constructionMorphPose(agent, 25).opening, 1);
  const restored = JSON.parse(JSON.stringify(agent));
  assert.deepEqual(constructionMorphPose(restored, 12), constructionMorphPose(agent, 12));
  assert.equal(constructionMorphPose({ ...agent, construction: null }, 12), null);
  assert.equal(constructionMorphPose({ ...agent, attributes: {} }, 12), null);
  assert.equal(constructionMorphPose({ ...agent, health: 0 }, 12), null);
});

test("변태 유닛의 이동 위상은 화면 보간과 상하좌우 진행 방향을 따른다", () => {
  const agent = { health: 10, attributes: { construction: 1 }, x: 2, y: 3, renderFromX: 1, renderFromY: 3,
    facing: 1, moveStartedAt: 1, moveDuration: 4, stepCount: 1 };
  assert.equal(constructionUnitPose(agent, 2).phase, .3125);
  assert.deepEqual(constructionUnitPose(agent, 2).direction, { x: 1, y: 0 });
  assert.deepEqual(constructionUnitPose({ ...agent, x: 0, facing: -1 }, 2).direction, { x: 1, y: 0 });
  assert.deepEqual(constructionUnitPose({ ...agent, x: 1, y: 4 }, 2).direction, { x: 0, y: 1 });
  assert.deepEqual(constructionUnitPose({ ...agent, x: 1, y: 2 }, 2).direction, { x: 0, y: -1 });
  assert.equal(constructionUnitPose({ ...agent, attributes: { construction: 1, feet: 1 } }, 2).phase, .5);
});

test("네 종족·네 건물은 고정 원화 파츠와 부지 중심을 공유하며 방벽을 포함하지 않는다", () => {
  const manifest = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/Construction/v9/manifest.json", import.meta.url), "utf8"));
  assert.equal(Object.keys(manifest.sequences).length, 16);
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    assert.equal(manifest.units[tribe].hasBuiltInFeet, false);
    assert.ok(CONSTRUCTION_ANIMATION_ASSETS.includes(manifest.units[tribe].image));
    assert.ok(CONSTRUCTION_ANIMATION_ASSETS.includes(manifest.units[tribe].sheet));
    assert.ok(CONSTRUCTION_ANIMATION_ASSETS.includes(manifest.units[tribe].growth.image));
    for (const building of ["storage", "evolution-lab", "outpost", "watchpost"]) {
      const sequence = manifest.sequences[tribe + ":" + building];
      assert.ok(CONSTRUCTION_ANIMATION_ASSETS.includes(sequence.image));
      assert.ok(CONSTRUCTION_ANIMATION_ASSETS.includes(sequence.completeImage));
      assert.deepEqual(sequence.center, [sequence.width / 2, sequence.height / 2]);
      assert.deepEqual([sequence.width, sequence.height], [3, 3]);
      for (const [name, rect] of Object.entries(sequence.parts)) {
        assert.ok(rect[0] >= 0 && rect[1] >= 0 && rect[2] > 0 && rect[3] > 0);
        assert.ok(rect[0] + rect[2] <= 432 * sequence.sheetGrid[0] && rect[1] + rect[3] <= 432 * sequence.sheetGrid[1]);
        if (!sequence.organism) {
          assert.equal(sequence.bones[name].parent, "center");
          assert.deepEqual(sequence.bones[name].source, rect);
        }
      }
    }
  }
});

test("초기 준비 이후 생긴 종족의 건설 계획도 이동 중 미리 불러온다", async () => {
  const manifest = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/Construction/v9/manifest.json", import.meta.url), "utf8"));
  const originalFetch = globalThis.fetch, loaded = [], calls = [], errors = [];
  globalThis.fetch = async () => ({ ok: true, json: async () => manifest });
  const translations = [];
  const context = { drawImage: (...args) => calls.push(args), save() {}, restore() {}, scale() {}, rotate() {},
    beginPath() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {}, closePath() {}, transform() {}, ellipse() {}, bezierCurveTo() {},
    setTransform() {}, clearRect() {}, fillRect() {}, globalAlpha: 1,
    translate: (x, y) => translations.push([x, y]) };
  const animation = createConstructionAnimation(path => path, () => ({ getContext: () => context }),
    async path => { loaded.push(path); return { path }; }, error => errors.push(error));
  try {
    await animation.prepare("bean");
    const agent = { tribe: "bean", health: 10, attributes: { construction: 1 },
      construction: { buildingKey: "outpost", state: "moving" } };
    assert.ok(animation.frame(agent, 0));
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(loaded.includes(manifest.sequences["bean:outpost"].image));
    const transforming = { ...agent, construction: { ...agent.construction, state: "transforming", startedAt: 1, readyAt: 16 } };
    for (const progress of [.05, .3, .7]) {
      translations.length = 0;
      assert.equal(animation.drawMorph(context, transforming, null, 1 + progress * 15, { x: 20, y: 30 }, 100, true), true);
      assert.deepEqual(translations[0], [170, 180]);
    }
    assert.equal(animation.drawMorph(context, transforming, null, 16, { x: 0, y: 0 }, 100, true), true);
    assert.equal(calls.at(-1)[0].path, "DesignAssets/Animations/Construction/v9/bean/outpost-complete.png");
    assert.deepEqual(calls.at(-1).slice(1), [0, 0, 300, 300]);
    const geometry = manifest.sequences['bean:outpost'], bed = geometry.parts.bed;
    const floors = calls.filter(call => call.length === 9 && call[0].path === geometry.image && bed.every((value,index) => call[index+1] === value));
    assert.equal(floors.length, 3);
    for (const floor of floors) assert.deepEqual(floor.slice(5), [-1.4,.308-1.85/2,2.8,1.85]);
    assert.deepEqual(errors, []);
  } finally { globalThis.fetch = originalFetch; }
});

test("부지 중앙 진입은 마지막 이동과 이어지고 변태 중에는 추가 이동을 만들지 않는다", () => {
  for (const buildingKey of ["storage", "outpost", "watchpost"]) {
    const construction = { buildingKey, x: 10, y: 20, state: "moving" };
    const cell = constructionApproachCell(construction), center = constructionSiteCenter(construction);
    const agent = { ...cell, attributes: { construction: 1, feet: 1 }, construction, moveStartedAt: 1, moveDuration: 2 };
    const start = constructionApproachOffset(agent, 1), finish = constructionApproachOffset(agent, 3);
    assert.deepEqual(start, { x: 0, y: 0 });
    assert.equal(cell.x + .5 + finish.x, center.x);
    assert.equal(cell.y + .5 + finish.y, center.y);
    assert.deepEqual(constructionApproachOffset({ ...agent, construction: { ...construction, state: "transforming" } }, 3), { x: 0, y: 0 });
  }
});

test("새싹콩 바닥은 1단계에서 완성되고 몸체는 단계 경계에서 연속된다", () => {
  const manifest = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/Construction/v9/manifest.json", import.meta.url), "utf8"));
  for (const kind of ["storage", "evolution-lab", "outpost", "watchpost"]) {
    const sequence = manifest.sequences["bean:" + kind];
    assert.deepEqual(sequence.organism.ground, [0, .308]);
    let previous = 0;
    for (let frame = 0; frame <= 360; frame++) {
      const progress = frame / 360, pose = organicConstructionPose(progress);
      const geometry = organicShellVertices(sequence, pose, frame / 24);
      assert.ok(geometry.width >= previous); previous = geometry.width;
      assert.equal(geometry.floor, .308);
      const bed = organicBedPose(progress);
      assert.deepEqual([bed.width,bed.height], [2.8,1.85]);
      assert.deepEqual(bed.ground,[0,.308]);
      if (progress >= .075) assert.equal(bed.spread,1);
    }
    for (const boundary of [.18, .29, .40, .53, .65, .77, .90]) {
      const before = organicShellVertices(sequence, organicConstructionPose(boundary - .000001), 0);
      const after = organicShellVertices(sequence, organicConstructionPose(boundary + .000001), 0);
      for (const name of Object.keys(before.shells)) {
        for (let index = 0; index < before.shells[name].length; index++) {
          const a = before.shells[name][index], b = after.shells[name][index];
          assert.deepEqual(a.uv, b.uv);
          assert.ok(Math.hypot(a.point[0] - b.point[0], a.point[1] - b.point[1]) < .0001);
        }
      }
    }
  }
});
