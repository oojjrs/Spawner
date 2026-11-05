import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { unitRangedPose, unitRangedResourceFrame, unitRangedDisplaySize, UNIT_RANGED_FORMS } from "./unit-ranged.mjs";
import { secretionResourceMotion } from "./secretion-resource-motion.mjs";
import { workPoint, workTriangles } from "./dominant-resource-motion.mjs";
import { unitAnimationPose } from "./unit-animation.mjs";

const tribes = ["bean", "spore", "pebble", "spring"];
const agent = (tribe, patch = {}) => ({ id: "worker", tribe, health: 10, facing: 1, attributes: { secretion: 1, gather: 1 },
  mode: "harvest", harvestStarted: 10, hurtStartedAt: -Infinity, ...patch });
const delivery = (startedAt = 10, arrivesAt = 11) => ({ startedAt, arrivesAt, receivedAt: null, amount: 2, resourceType: "clay" });
const image = { width: 512, height: 512, complete: true };
function surface(width, height) {
  const canvas = { width, height, draws: [] }, ctx = { canvas, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
    closePath() {}, clip() {}, transform() {}, rect() {}, drawImage(...args) { canvas.draws.push(args); } };
  canvas.getContext = () => ctx; return canvas;
}

test("four selected secretion forms keep their own work source, clocks and state", () => {
  for (const tribe of tribes) {
    const unit = agent(tribe), before = structuredClone(unit);
    for (const age of [0, .12, .36, .72, 4, 14.4]) {
      const pose = unitRangedPose(unit, 10 + age);
      assert.equal(pose.action, "harvest"); assert.equal(pose.animation, UNIT_RANGED_FORMS[tribe].idle);
      assert.equal(pose.resource.tribe, tribe); assert.equal(pose.frame, 0);
    }
    assert.equal(unitRangedPose(unit, 10).resource.compression, 0);
    assert.deepEqual(unit, before);
    assert.equal(unitRangedPose(agent(tribe, { attributes: { blade: 1, secretion: 1 } }), 10.2), null);
    for (const patch of [{ harvestStarted: undefined }, { harvestStarted: Infinity }, { harvestStarted: 11 }, { birth: {} },
      { moveStartedAt: 10, moveDuration: 1 }, { mode: "idle" }]) assert.equal(unitRangedPose(agent(tribe, patch), 10.2).resource, undefined);
  }
});

test("delivery follows each actual interval and existing release, without adding/replaying cargo", () => {
  for (const tribe of tribes) for (const duration of [.2, 1, 2.4]) {
    const unit = agent(tribe, { mode: "unload", carrying: 2, foodDelivery: delivery(10, 10 + duration) }), before = structuredClone(unit);
    for (const progress of [0, .16, .239, .24, .4, .66, .99]) {
      const pose = unitRangedPose(unit, 10 + duration * progress);
      assert.equal(pose.action, "throw"); assert.equal(pose.resource.releaseProgress, .24);
      assert.equal(pose.animation, UNIT_RANGED_FORMS[tribe].idle);
    }
    const release = unitRangedPose(unit, 10 + duration * .24).resource;
    assert.equal(release.progress, .24); assert.ok(release.sweep > 0); assert.ok(release.compression < 0);
    assert.equal(unitRangedPose(unit, 10 + duration).resource, undefined);
    assert.equal(unitRangedPose(unit, 10 + duration).resourceRest, true);
    assert.deepEqual(unit, before);
    for (const patch of [{ foodDelivery: null }, { mode: "idle" }, { foodDelivery: { ...unit.foodDelivery, receivedAt: 10.1 } },
      { foodDelivery: { ...unit.foodDelivery, amount: 0 } }, { foodDelivery: delivery(11, 12) }, { foodDelivery: delivery(10, 10) }])
      assert.equal(unitRangedPose({ ...unit, ...patch }, 10.1).resource, undefined);
    assert.equal(unitRangedPose(unit, 9).resource, undefined);
  }
});

test("work/throw remain subordinate to actual hurt, shooting and lifecycle", () => {
  for (const tribe of tribes) for (const mode of ["harvest", "unload"]) {
    const unit = agent(tribe, { mode, foodDelivery: delivery() });
    assert.equal(unitRangedPose({ ...unit, hurtStartedAt: 10.1 }, 10.2).action, "hurt");
    assert.equal(unitRangedPose({ ...unit, attack: { mode: "ranged", startedAt: 10, launchedAt: 10.2, endsAt: 10.8 } }, 10.2).action, "shoot");
    assert.equal(unitRangedPose({ ...unit, health: 0 }, 10.2), null);
    assert.equal(unitRangedPose({ ...unit, birth: {} }, 10.2).resource, undefined);
  }
});

test("shared work mesh remains positive, exact at entry/recovery and planted at support", () => {
  for (const tribe of tribes) for (const [action, clocks] of [["harvest", Array.from({ length: 145 }, (_, i) => i * 10)],
    ["throw", Array.from({ length: 101 }, (_, i) => i / 100)]]) for (const clock of clocks) {
    const pose = secretionResourceMotion(tribe, action, clock);
    assert.ok(workTriangles(pose).every(triangle => triangle.ratio > .1));
    for (const x of [0, 200, 256, 400, 512]) for (const y of [432, 438, 448, 512]) assert.deepEqual(workPoint(pose, x, y), [x, y]);
  }
  for (const tribe of tribes) {
    for (const clock of [0, .66, 1]) {
      const pose = secretionResourceMotion(tribe, "throw", clock);
      assert.equal(pose.compression, 0); assert.equal(pose.sweep, 0);
    }
  }
});

test("rendering caches only successful own-source frames, bounds memory, reduced motion and recovery", () => {
  for (const tribe of tribes) {
    const source = { ...image }, pose = unitRangedPose(agent(tribe), 10.36);
    const frame = unitRangedResourceFrame(source, pose, surface);
    assert.equal(frame.width, 512); assert.ok(frame.draws.length > 20);
    assert.ok(frame.draws.every(call => call[0] === source));
    assert.equal(unitRangedResourceFrame(source, pose, () => assert.fail("shared cache")), frame);
    assert.equal(unitRangedResourceFrame(source, pose, surface, true), source);
    assert.equal(unitRangedResourceFrame({ ...source, complete: false }, pose, surface), null);
    const retry = { ...image };
    assert.equal(unitRangedResourceFrame(retry, pose, () => { throw Error("unavailable canvas"); }), null);
    assert.ok(unitRangedResourceFrame(retry, pose, surface));
    for (let i = 1; i < 12; i++) unitRangedResourceFrame(source, unitRangedPose(agent(tribe), 10 + i * .02), surface);
    assert.notEqual(unitRangedResourceFrame(source, pose, surface), frame, "old frame evicted");
  }
});

test("actual world/detail body function renders both actions/facings and keeps source-load fallback", () => {
  const code = readFileSync(new URL("./game.js", import.meta.url), "utf8").match(/^    function drawAgentRanged\([^]*?^    }/m)[0];
  const state = { simSeconds: 10.24 }, draws = [], scales = [], idleMotion = { matches: false };
  let available = true;
  const scope = createContext({ Spawner: { unitRangedPose, unitRangedResourceFrame, unitRangedDisplaySize, unitAnimationPose },
    state, AGENT_HEIGHT: .7, idleMotion, unitDisplayScale: () => 1, document: { createElement: () => surface(512, 512) },
    agentRangedImage: path => available ? { ...image, path } : null });
  runInContext(code, scope);
  const context = { save() {}, restore() {}, translate() {}, scale(...args) { scales.push(args); }, drawImage(...args) { draws.push(args); } };
  for (const tribe of tribes) for (const facing of [-1, 1]) for (const mode of ["harvest", "unload"]) {
    const unit = agent(tribe, { mode, facing, foodDelivery: delivery() }), before = structuredClone(unit);
    assert.equal(scope.drawAgentRanged(context, unit, 50, 80, 70, null), true);
    assert.ok(draws.at(-1)[0].draws.length > 20); assert.deepEqual(scales.at(-1), [facing, 1]);
    idleMotion.matches = true; scope.drawAgentRanged(context, unit, 50, 80, 70, null);
    assert.equal(draws.at(-1)[0].path, UNIT_RANGED_FORMS[tribe].idle.image); idleMotion.matches = false;
    available = false; assert.equal(scope.drawAgentRanged(context, unit, 50, 80, 70, null), false); available = true;
    assert.deepEqual(unit, before);
  }
  for (const tribe of tribes) for (const receivedAt of [null, 11]) {
    state.simSeconds = 11.15;
    const unit = agent(tribe, { mode: "unload", foodDelivery: { ...delivery(), receivedAt } });
    assert.equal(scope.drawAgentRanged(context, unit, 50, 80, 70, null), true);
    assert.equal(draws.at(-1)[0].path, UNIT_RANGED_FORMS[tribe].idle.image, "late unload snapshot stays on neutral own source");
    assert.equal(unitRangedPose(unit, state.simSeconds).action, "idle");
  }
});
