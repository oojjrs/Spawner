import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTribeAttributeAnimation } from "./attribute-animation.mjs";
import { UNIT_ANIMATIONS, unitAnimationPose } from "./unit-animation.mjs";

function surface(width, height) {
  return { getContext() { return {
    drawImage() {},
    getImageData() { return { data: new Uint8ClampedArray(width * height * 4).fill(255) }; }
  }; } };
}

async function animator(tribe) {
  const art = createTribeAttributeAnimation(path => "data:application/json;base64," +
    readFileSync(new URL("../" + path, import.meta.url)).toString("base64"), surface, async () => ({}));
  await art.prepare(tribe);
  return art;
}





test("기본 유닛의 공격·피격 자세는 부착물 보간을 거치지 않는다", async () => {
  for (const tribe of ["spore", "pebble", "spring"]) {
    const art = await animator(tribe), animations = UNIT_ANIMATIONS[tribe];
    const agent = { id: "basic-" + tribe, tribe, attributes: {} };
    for (const action of ["attack", "hurt"]) {
      const current = { action, animation: animations[action], frame: 5 };
      assert.equal(art.pose(agent, current, 10), current);
    }
  }
});
