import test from "node:test";
import assert from "node:assert/strict";
import { corpseRenderer } from "./corpse-test-fixture.mjs";
import { unitActionArtPose } from "./unit-action-art.mjs";
import { AGENT_DEATH_ANIMATION } from "./agent-death.mjs";

test("퇴역한 발 속성은 새싹콩의 승인 사망 프레임을 자르거나 별도 뿌리로 덮지 않는다", async t => {
  const render = corpseRenderer(t), corpse = { kind: "corpse", tribe: "bean", health: 0, attributes: { feet: 1 }, diedAt: 10 };
  const before = structuredClone(corpse), animation = AGENT_DEATH_ANIMATION;
  let elapsed = 0;
  for (let frame = 0; frame < animation.frameCount; frame++) {
    const time = 10 + (elapsed + .01) / 1000;
    const pose = unitActionArtPose(corpse, time);
    assert.equal(pose.action, "death");
    assert.equal(pose.frame, frame);
    await render.presentation.prepareAnimation(corpse, time);
    render.draw(corpse, time, 1);
    assert.equal(render.draws.length, 1);
    assert.equal(render.draws[0][0].src, animation.image);
    assert.deepEqual(render.draws[0].slice(1, 5), [frame % animation.columns * animation.frameSize,
      Math.floor(frame / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize]);
    elapsed += animation.durationsMs[frame];
  }
  assert.deepEqual(corpse, before);
});

test("살아 있는 동작과 사망 동작은 원본 프레임을 공유하지 않고 사망 종료 셀을 유지한다", async t => {
  const render = corpseRenderer(t), living = { tribe: "bean", health: 1, attributes: { feet: 1 }, attack: { startedAt: 10, speed: 1 } };
  const dead = { ...living, kind: "corpse", health: 0, attack: null, diedAt: 10 };
  const attack = unitActionArtPose(living, 10.1), death = unitActionArtPose(dead, 10.1);
  assert.equal(attack.action, "attack");
  assert.equal(death.action, "death");
  assert.notEqual(attack.animation.image, death.animation.image);
  await render.presentation.prepareAnimation(dead, 30);
  assert.equal(render.draw(dead, 30, 1).frame, death.animation.frameCount - 1);
  assert.equal(render.draws.length, 1);
});
