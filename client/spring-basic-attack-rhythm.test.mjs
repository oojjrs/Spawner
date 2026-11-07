import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { UNIT_ANIMATIONS, unitAnimationPose, unitAnimationFrame } from "./unit-animation.mjs";
import { unitAppearanceAnimation, unitAppearancePose, unitAppearanceReadiness, unitAppearanceDefinition } from "./unit-appearance.mjs";
import { unitActionState, createUnitAppearanceEventPlayback } from "./unit-appearance-state.mjs";

const durations = [60,70,60,80,30,60,16,16,16,16,32,40,52,76,100,276];
const source = "DesignAssets/Tribes/spring/AnimationStudies/attack-directions-v3/right/attack.webp";
const base = { id: "spring-basic", tribe: "spring", health: 10, bornAt: 0, attributes: {}, attack: { startedAt: 0, speed: 1 } };
const readJson = path => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));

test("approved spring basic rhythm keeps every source pose, camera and pixel unchanged", () => {
  const candidate = readJson("client/test-support/spring-basic-approved.json");
  assert.deepEqual(durations, candidate.singleAttack.durationsMs);
  const clip = unitAnimationPose(base, .3).animation;
  assert.deepEqual(clip.durationsMs, durations);
  assert.deepEqual({ ...clip, durationsMs: UNIT_ANIMATIONS.spring.attack.durationsMs }, UNIT_ANIMATIONS.spring.attack);
  assert.equal(clip.image, source);
  assert.equal(clip.frameCount, 16);
  assert.equal(clip.frameSize, 516);
  assert.equal(clip.durationMs, 1000);
  assert.equal(durations.slice(0, 5).reduce((sum, ms) => sum + ms, 0), 300);
  assert.equal(createHash("sha256").update(readFileSync(new URL("../" + source, import.meta.url))).digest("hex"), candidate.sourceSha256);
  let start = 0;
  for (const [frame, ms] of durations.entries()) {
    assert.equal(unitAnimationPose(base, (start + ms / 2) / 1000).frame, frame);
    assert.equal(unitAppearancePose("spring", 0, "attack", start + ms / 2).frame, frame);
    start += ms;
  }
});

test("contact is 300ms, contact hold ends at 360ms and the attack ends at 1000ms", () => {
  for (const [ms, frame] of [[299, 4], [300, 5], [359, 5], [360, 6], [424, 10], [724, 15], [999, 15]])
    assert.equal(unitAnimationPose(base, ms / 1000).frame, frame);
  assert.equal(unitAnimationPose(base, 1).action, "idle");
  assert.equal(unitAnimationPose(base, 1.65).action, "idle");
  const second = { ...base, attack: { startedAt: .65, speed: 1 } };
  assert.equal(unitAnimationPose(second, .95).frame, 5);
  assert.equal(unitAnimationPose({ ...base, attack: null }, .95).action, "idle");
});

test("other tribes, spring attachment masks and ranged modes keep the existing timing", () => {
  const cases = [
    ...["bean", "spore", "pebble"].map(tribe => ({ ...base, tribe })),
    ...["blade", "carapace", "secretion", "antenna", "strength", "arms"].map(key => ({ ...base, attributes: { [key]: 1 } })),
    ...[{ dnaRanged: true }, { mode: "ranged" }, { attackMode: "ranged" }].map(flags => ({ ...base, attack: { ...base.attack, ...flags } }))
  ];
  for (const attributes of [{ feet: 1 }, { legs: 1 }])
    assert.equal(unitAnimationPose({ ...base, attributes }, .45).animation, unitAnimationPose(base, .45).animation);
  for (const agent of cases) {
    const pose = unitAnimationPose(agent, .45), clip = UNIT_ANIMATIONS[agent.tribe].attack;
    assert.equal(pose.animation, clip);
    assert.equal(pose.frame, unitAnimationFrame(clip, 450));
  }
  for (const [agent, action] of [
    [{ ...base, attack: null }, "idle"],
    [{ ...base, attack: null, hurtStartedAt: 0 }, "hurt"],
    [{ ...base, attack: null, moveStartedAt: 0, moveDuration: 1, stepCount: 1 }, "walk"],
    [{ ...base, attack: null, mode: "jump", jumpStartedAt: 0 }, "jump"]
  ]) assert.equal(unitAnimationPose(agent, .1).animation, UNIT_ANIMATIONS.spring[action]);
});

test("registered mask 00 timing agrees without fabricating hit events or readiness", () => {
  const clip = unitAppearanceAnimation("spring", 0, "attack");
  const motions = readJson("DesignAssets/Animations/UnitAppearanceV1/spring/00/motions.json");
  const manifest = readJson("DesignAssets/Animations/UnitAppearanceV1/manifest.json");
  for (const entry of [clip, motions.actions.attack, manifest.forms["spring/00"].actions.attack]) {
    assert.deepEqual(entry.durationsMs, durations);
    assert.deepEqual(entry.events, []);
    assert.equal(entry.loop, false);
    assert.equal(entry.image, source);
  }
  assert.equal(unitAppearanceReadiness(unitAppearanceDefinition("spring", 0), 0).ready, false);
  const playback = createUnitAppearanceEventPlayback(), animations = { ...UNIT_ANIMATIONS.spring, attack: clip };
  for (let ms = 0; ms <= 1000; ms += 10)
    assert.deepEqual(playback.update(unitActionState(base, ms / 1000, { animations }), clip, ms / 1000), []);
});

test("actual combat contact and end anchors are preserved at non-default speeds", () => {
  const agent = { ...base, combat: { version: 2 }, attack: { combatId: "one", startedAt: 10, hitAt: 10.15, endsAt: 10.5, speed: 2 } };
  assert.equal(unitAnimationPose(agent, 10.15).frame, 5);
  assert.equal(unitAnimationPose(agent, 10.18).frame, 6);
  assert.equal(unitAnimationPose(agent, 10.5).action, "idle");
});
