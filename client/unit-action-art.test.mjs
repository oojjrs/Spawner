import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { UNIT_ACTION_ART } from "./unit-action-art-assets.mjs";
import { createUnitActionArt, unitActionArtDefinition, unitActionArtPose } from "./unit-action-art.mjs";
import { createCombatEvolutionArt } from "./combat-evolution.mjs";
import { createUnitPresentation } from "./unit-presentation.mjs";
import { startingWorkerDna } from "../server/tribe-start.mjs";

function surface(width, height) {
  const calls = [], context = { calls, save() {}, restore() {}, translate() {}, scale(x, y) {
    assert.equal(Math.abs(x), Math.abs(y));
  }, drawImage(...args) { calls.push(args); }, getImageData() {
    const data = new Uint8ClampedArray(width * height * 4); data.fill(255); return { data };
  } };
  return { width, height, getContext: () => context };
}

test("채집형은 전투 클립이 없으면 자기 원화를 고정해 유지한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const agent = { tribe, dna: startingWorkerDna(tribe), health: 10, mode: "fight", attack: { startedAt: 100 } };
    const definition = unitActionArtDefinition(agent);
    assert.equal(definition, UNIT_ACTION_ART[tribe + "/gather"]);
    for (const time of [100.02, 100.3, 100.7]) {
      const pose = unitActionArtPose(agent, time);
      assert.equal(pose.animation, definition.reference); assert.equal(pose.frame, 0); assert.equal(pose.missing, true);
    }
    const hurt = unitActionArtPose({ ...agent, attack: null, hurtStartedAt: 100 }, 100.04);
    assert.equal(hurt.animation, definition.reference); assert.equal(hurt.frame, 0);
  }
});

test("안테나와 발의 기준 원화는 해당 외형의 마스크를 사용한다", () => {
  assert.match(UNIT_ACTION_ART["bean/antenna"].reference.image, /bean\/04\/Source/);
  assert.match(UNIT_ACTION_ART["bean/feet"].reference.image, /bean\/08\/Source/);
  for (const tribe of ["spore", "pebble", "spring"]) for (const form of ["antenna", "feet"]) {
    assert.match(UNIT_ACTION_ART[tribe + "/" + form].reference.image, new RegExp("/" + tribe + "/" + form + "/"));
  }
});

test("모든 전용 클립은 존재하는 단일 시트와 유효한 프레임을 가리킨다", () => {
  for (const [key, definition] of Object.entries(UNIT_ACTION_ART)) for (const animation of [definition.reference, ...Object.values(definition.actions)]) {
    assert.ok(existsSync(animation.image), key + ":" + animation.image);
    assert.ok(animation.frameSize > 0 && animation.columns > 0);
    assert.ok(animation.durationsMs.every(value => value > 0));
    if (animation.frames) {
      assert.equal(animation.frames.length, animation.durationsMs.length);
      assert.ok(animation.frames.every(value => value >= 0 && value < animation.frameCount));
    } else assert.equal(animation.frameCount, animation.durationsMs.length);
  }
});

test("완성 프레임 하나만 그리며 다른 몸체나 기관을 합성하지 않는다", async () => {
  const art = createUnitActionArt(value => value, surface, async image => ({ image }));
  const agent = { tribe: "bean", attributes: { blade: 1, antenna: 1 }, health: 10, mode: "fight", attack: { startedAt: 0 } };
  await art.prepare(agent);
  const canvas = surface(512, 512), context = canvas.getContext("2d");
  assert.equal(art.draw(context, agent, .3, 256, 448, 100, false, null), true);
  assert.equal(context.calls.length, 1);
  assert.match(context.calls[0][0].image, /sprout\/Sheets\/blade\/attack/);
});

test("전투 외형은 기존 파츠 콜백을 호출하지 않고 전용 시트를 재생한다", async () => {
  const art = createCombatEvolutionArt(value => value, surface, async image => ({ image }));
  await art.prepare("bean");
  const rejectParts = () => { throw new Error("폐기한 파츠 합성 호출"); };
  const frame = art.frame({ tribe: "bean", attributes: { blade: 1 }, health: 10, attack: { startedAt: 0 } }, .3, rejectParts, rejectParts);
  assert.equal(frame.getContext("2d").calls.length, 1);
  assert.match(frame.getContext("2d").calls[0][0].image, /sprout\/Sheets\/blade\/attack/);
});

test("몸체와 잎 및 부속지의 런타임 합성 API는 동작하지 않는다", () => {
  const presentation = createUnitPresentation({ model: {}, createSurface: surface });
  assert.equal(presentation.sproutCombatFrame(), null);
  const rejectTransforms = new Proxy({}, { get() { throw new Error("파츠 변형 호출"); } });
  let drawn = 0;
  presentation.drawRootMotion(rejectTransforms, 0, { tribe: "bean" }, 100, {}, {}, null, () => drawn++);
  presentation.drawAgentFeet(rejectTransforms); presentation.drawAgentHead(rejectTransforms);
  assert.equal(drawn, 1);
});
