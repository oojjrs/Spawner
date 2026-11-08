import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minorTraitResourcePose, minorTraitResourceFrame, minorTraitWorkPoint, minorTraitWorkStrips } from "./minor-trait-resource-motion.mjs";
import { createTribeAttributeAnimation } from "./attribute-animation.mjs";
import { unitAnimationPose, UNIT_ANIMATIONS } from "./unit-animation.mjs";

const unit = (tribe = "spore", form = "antenna") => ({ id: `${tribe}-${form}`, tribe, health: 10, attributes: { [form]: 1 },
  mode: "harvest", harvestStarted: 10, bornAt: 0, hurtStartedAt: -Infinity });
function surface(width, height) {
  const calls = [], value = { width, height, calls };
  value.getContext = () => ({ save() {}, restore() {}, beginPath() {}, clip() {},
    rect(...args) { calls.push(["rect", ...args]); }, transform(...args) { calls.push(["transform", ...args]); },
    drawImage(...args) { calls.push(["draw", ...args]); },
    getImageData() { return { data: new Uint8ClampedArray(width * height * 4).fill(255) }; } });
  return value;
}

test("three antenna forms share source-owned work and the actual delivery clock without mutating agents", () => {
  for (const tribe of ["spore", "pebble", "spring"]) for (const form of ["antenna"]) {
    const agent = unit(tribe, form), before = structuredClone(agent);
    assert.equal(minorTraitResourcePose(agent, "harvest", 10).compression, 0);
    assert.ok(minorTraitResourcePose(agent, "harvest", 10.36).compression > 0);
    assert.deepEqual(agent, before);
    agent.mode = "unload"; agent.foodDelivery = { startedAt: 10, arrivesAt: 12.5, amount: 2 };
    const delivery = structuredClone(agent), release = minorTraitResourcePose(agent, "throw", 10.6);
    assert.equal(release.progress, .24); assert.equal(release.releaseProgress, .24);
    assert.ok(release.sweep > 0); assert.ok(release.compression < 0);
    assert.equal(minorTraitResourcePose(agent, "throw", 12.5), null);
    assert.equal(minorTraitResourcePose(agent, "throw", 9.9), null);
    agent.foodDelivery.receivedAt = 10.7; assert.equal(minorTraitResourcePose(agent, "throw", 10.7), null);
    delete agent.foodDelivery.receivedAt; assert.deepEqual(agent, delivery);
  }
});



test("native support remains exact, strips cannot fold, and neutral/failure frames are not cached as motion", () => {
  const image = surface(1024, 1024), animation = { frameSize: 512 }, track = { floor: 126 };
  const geometry = { size: 512, floor: 704, support: Math.floor(704 - 51.2) };
  for (const tribe of ["spore", "pebble", "spring"]) for (const action of ["harvest", "throw"]) {
    const agent = unit(tribe);
    if (action === "throw") Object.assign(agent, { mode: "unload", foodDelivery: { startedAt: 10, arrivesAt: 11, amount: 1 } });
    for (const seconds of [0, .08, .16, .24, .36, .52, .7]) {
      const motion = minorTraitResourcePose(agent, action, 10 + seconds), strips = minorTraitWorkStrips(motion, geometry);
      assert.ok(strips.every(s => s.scale > .5));
      for (let i = 1; i < strips.length; i++) assert.equal(strips[i - 1].end, strips[i].top);
      for (const y of [geometry.support, geometry.floor, 1023])
        assert.deepEqual(minorTraitWorkPoint(motion, geometry, 456, y), [456, y]);
      const frame = minorTraitResourceFrame(image, animation, track, motion, surface);
      if (!motion.compression && !motion.sweep) assert.equal(frame, image);
      else {
        assert.equal(frame.width, image.width); assert.equal(frame.height, image.height);
        const draw = frame.calls.at(-1); assert.deepEqual(draw.slice(2), [0, geometry.support, 1024, 1024 - geometry.support, 0, geometry.support, 1024, 1024 - geometry.support]);
        assert.equal(minorTraitResourceFrame(image, animation, track, motion, surface), frame);
      }
    }
  }
  const motion = minorTraitResourcePose(unit(), "harvest", 10.36);
  assert.equal(minorTraitResourceFrame({ ...image, complete: false }, animation, track, motion, surface), null);
  assert.equal(minorTraitResourceFrame(image, animation, track, motion, () => { throw new Error("no canvas"); }), null);
  assert.ok(minorTraitResourceFrame(image, animation, track, motion, surface));
});
