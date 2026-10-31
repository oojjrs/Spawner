import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTribeAttributeAnimation } from "./attribute-animation.mjs";
import { UNIT_ANIMATIONS } from "./unit-animation.mjs";

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

test("낮아진 버섯 대기 자세를 이동 첫 순간까지 유지하고 작화 프레임으로 중립 자세에 연결한다", async () => {
  const art = await animator("spore"), animations = UNIT_ANIMATIONS.spore;
  const agent = { id: "transition", tribe: "spore", attributes: { antenna: 1, strength: 1, feet: 1, lifespan: 1 } };
  const idle = { action: "idle", animation: animations.idle, frame: 30 };
  const previous = art.pose(agent, idle, 10);
  const walk = { action: "walk", animation: animations.walk, frame: 0 };
  const first = art.pose(agent, walk, 10.01);
  assert.equal(first.sourceAction, previous.sourceAction);
  assert.equal(first.sourceFrame, previous.sourceFrame);
  assert.equal(first.motionBlend, 0);
  const later = art.pose(agent, { ...walk, frame: 4 }, 10.27);
  assert.equal(later.sourceAction, "walk");
  assert.equal(later.sourceFrame, 4);
  assert.equal(later.frame, 4);
  assert.equal(later.motionBlend, 1);
  assert.deepEqual(walk, { action: "walk", animation: animations.walk, frame: 0 });
});

test("채집·투척·대기를 오갈 때 몸체 시간을 유지하고 전투 프레임의 시간은 바꾸지 않는다", async () => {
  for (const tribe of ["spore", "pebble", "spring"]) {
    const art = await animator(tribe), animations = UNIT_ANIMATIONS[tribe];
    const agent = { id: tribe, tribe, attributes: { antenna: 1, strength: 1, feet: 1, butchery: 1 } };
    art.pose(agent, { action: "idle", animation: animations.idle, frame: 23 }, 20);
    const harvest = art.pose(agent, { action: "harvest", animation: animations.idle, frame: 0 }, 20.02);
    assert.equal(harvest.sourceAction, "idle");
    assert.equal(harvest.sourceFrame, 23);
    const throwing = art.pose(agent, { action: "throw", animation: animations.idle, frame: 0 }, 20.12);
    assert.equal(throwing.sourceFrame, 24);
    const idle = art.pose(agent, { action: "idle", animation: animations.idle, frame: 59 }, 20.22);
    assert.equal(idle.sourceFrame, 25);
    const attack = { action: "attack", animation: animations.attack, frame: 5 };
    const combat = art.pose(agent, attack, 20.24);
    assert.equal(combat.action, "attack");
    assert.equal(combat.frame, 5);
    assert.equal(combat.animation, animations.attack);
  }
});
