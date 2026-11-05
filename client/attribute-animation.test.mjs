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

test("속성 rig는 현재 등록된 시트 셀과 피벗으로 원본을 자른다", async () => {
  for (const tribe of ["spore", "pebble", "spring"]) {
    const art = await animator(tribe), animations = UNIT_ANIMATIONS[tribe];
    const agent = { id: "registered-" + tribe, tribe, attributes: { feet: 1 } };
    for (const action of ["idle", "walk", "attack", "hurt"]) {
      const pose = art.pose(agent, { action, animation: animations[action], frame: 0 }, 100);
      const expected = animations[pose.sourceAction];
      assert.equal(pose.sourceAnimation.frameSize, expected.frameSize);
      assert.equal(pose.sourceAnimation.pivotX, expected.pivotX);
      assert.equal(pose.sourceAnimation.pivotY, expected.pivotY);
    }
  }
});

test("낮아진 버섯 대기 자세를 이동 첫 순간까지 유지하고 작화 프레임으로 중립 자세에 연결한다", async () => {
  const art = await animator("spore"), animations = UNIT_ANIMATIONS.spore;
  const agent = { id: "transition", tribe: "spore", attributes: { antenna: 1, strength: 1, feet: 1 } };
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
    const agent = { id: tribe, tribe, attributes: { antenna: 1, strength: 1, feet: 1 } };
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
    assert.equal(combat.sourceAction, "attack");
    assert.equal(combat.sourceFrame, 5);
  }
});

test("부착물이 많은 유닛도 공격·피격이 시작되면 이전 보간 대신 현재 전투 프레임을 그린다", async () => {
  for (const tribe of ["spore", "pebble", "spring"]) {
    const art = await animator(tribe), animations = UNIT_ANIMATIONS[tribe];
    for (const action of ["attack", "hurt"]) {
      const agent = { id: tribe + action, tribe, attributes: { antenna: 1, strength: 1, feet: 1 } };
      art.pose(agent, { action: "idle", animation: animations.idle, frame: 30 }, 10);
      const walking = art.pose(agent, { action: "walk", animation: animations.walk, frame: 0 }, 10.01);
      assert.equal(walking.sourceAction, "idle", tribe + " keeps its walking transition");
      for (const [time, frame] of [[10.02, 0], [10.03, 5], [10.04, 10]]) {
        const current = { action, animation: animations[action], frame };
        const pose = art.pose(agent, current, time);
        assert.equal(pose.sourceAction, action, tribe + " " + action);
        assert.equal(pose.sourceFrame, frame, tribe + " " + action);
        assert.equal(pose.sourceAnimation.image, animations[action].image);
        assert.equal(pose.motionPhase, frame / animations[action].frameCount);
        assert.deepEqual(current, { action, animation: animations[action], frame });
      }
    }
  }
});

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

test("부착물 유닛은 취소된 공격·피격 프레임을 대기·이동 중에 다시 재생하지 않는다", async () => {
  for (const tribe of ["spore", "pebble", "spring"]) {
    const art = await animator(tribe), animations = UNIT_ANIMATIONS[tribe];
    for (const action of ["attack", "hurt"]) for (const next of ["idle", "walk"]) {
      for (let frame = 0; frame < animations[action].frameCount; frame++) {
        const agent = { id: [tribe, action, next, frame].join("-"), tribe,
          attributes: { antenna: 1, strength: 1, feet: 1 } };
        art.pose(agent, { action, animation: animations[action], frame }, 10);
        for (const time of [10.01, 10.04, 10.09, 10.21]) {
          const current = { action: next, animation: animations[next], frame: 0 };
          const pose = art.pose(agent, current, time);
          assert.equal(pose.sourceAction, next, [tribe, action, frame, next, time].join(" "));
          assert.equal(pose.sourceAnimation.image, animations[next].image);
          if (next === "walk") assert.equal(pose.sourceFrame, current.frame);
        }
        const retriggered = art.pose(agent, { action, animation: animations[action], frame: 2 }, 10.22);
        assert.equal(retriggered.sourceAction, action);
        assert.equal(retriggered.sourceFrame, 2);
      }
    }
  }
});

test("실제 시뮬레이션 공격 취소와 짧은 RPG 피격 종료는 부착물에 남지 않는다", async () => {
  for (const tribe of ["spore", "pebble", "spring"]) {
    const art = await animator(tribe), animations = UNIT_ANIMATIONS[tribe];
    const agent = { id: "cancel-" + tribe, tribe, health: 10, mode: "idle", bornAt: 0,
      attributes: { antenna: 1, strength: 1, feet: 1 }, combat: { version: 2 },
      attack: { combatId: "fight", startedAt: 10, hitAt: 10.15, endsAt: 10.5 } };
    const attacking = unitAnimationPose(agent, 10.15);
    assert.equal(art.pose(agent, attacking, 10.15).sourceAction, "attack");
    agent.attack = null;
    assert.equal(art.pose(agent, unitAnimationPose(agent, 10.16), 10.16).sourceAction, "idle");
    agent.hurtStartedAt = 10.2;
    assert.equal(art.pose(agent, unitAnimationPose(agent, 10.22), 10.22).sourceAction, "hurt");
    const finished = art.pose(agent, unitAnimationPose(agent, 10.33), 10.33);
    assert.equal(finished.sourceAction, "idle");
    assert.equal(finished.sourceAnimation.image, animations.idle.image);
  }
});
