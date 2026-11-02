import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { hasTribeAttributes } from "./attribute-animation.mjs";
import { UNIT_ANIMATIONS, unitAnimationPose } from "./unit-animation.mjs";
import { EXCAVATION_ASSETS } from "./excavation.mjs";

test("굴착 외형은 기본 외형과 캐시를 공유하지 않고 종족 속성 합성을 사용한다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const declaration = source.match(/^    function agentAppearanceKey\([^]*?^    }/m)[0];
  const key = runInNewContext("(" + declaration + ")");
  for (const attributes of [{}, { strength: 1, feet: 1 }, { antenna: 1 }])
    assert.notEqual(key(attributes), key({ ...attributes, excavation: 1 }));
  assert.equal(hasTribeAttributes({ excavation: 1 }), true);
});

test("굴착을 장착하면 굴착 부위가 없는 전용 그림을 선택하지 않는다", () => {
  for (const antenna of [0, 1]) {
    const agent = { tribe: "bean", health: 10, mode: "idle", bornAt: 0,
      attributes: { excavation: 1, antenna } };
    const pose = unitAnimationPose(agent, 1.25);
    assert.equal(pose.decomposition, undefined);
    assert.equal(pose.animation, UNIT_ANIMATIONS.bean.idle);
  }
});

test("네 종족의 굴착은 승인된 전면 원화와 몸통 연결점을 사용한다", () => {
  const rig = JSON.parse(readFileSync(new URL("../DesignAssets/Attributes/ExcavationV2/rig.json", import.meta.url), "utf8"));
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const part = rig.parts[tribe];
    assert.equal(part.parent, "body");
    assert.ok(EXCAVATION_ASSETS.includes(part.image));
    const image = readFileSync(new URL("../" + part.image, import.meta.url));
    assert.equal(image.toString("ascii", 1, 4), "PNG");
    assert.ok(part.guides.left[0] < part.guides.right[0]);
    assert.ok(part.guides.bottom[1] > part.guides.left[1]);
    assert.ok(part.box[1] > part.guides.left[1] - 30);
  }
});
