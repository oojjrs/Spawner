import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { unitBaseResourcePose, unitBaseResourceFrame } from "./base-resource-motion.mjs";
import { UNIT_ANIMATIONS, unitAnimationPose } from "./unit-animation.mjs";
import { TRIBE_CANVAS_CACHE_BUDGET } from "./canvas-cache.mjs";
import { minorTraitWorkStrips } from "./minor-trait-resource-motion.mjs";
const tribes = ["spore", "pebble", "spring"];
const delivery = (duration = 1) => ({ startedAt: 10, arrivesAt: 10 + duration, amount: 2, receivedAt: null });
const agent = (tribe, patch = {}) => ({ tribe, health: 10, facing: 1, mode: "harvest", harvestStarted: 10,
  animationStartedAt: 9.6, hurtStartedAt: -Infinity, attributes: { gather: 1 }, ...patch });
function surface(width, height) {
  const canvas = { width, height, draws: [], transforms: [] };
  const context = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
    transform(...args) { canvas.transforms.push(args); }, drawImage(...args) { canvas.draws.push(args); } };
  canvas.getContext = () => context; return canvas;
}
const image = tribe => ({ width: UNIT_ANIMATIONS[tribe].idle.frameSize * 4,
  height: UNIT_ANIMATIONS[tribe].idle.frameSize * 16, naturalWidth: UNIT_ANIMATIONS[tribe].idle.frameSize * 4, complete: true });

test("six base-body work motions preserve each native source, camera and continuous idle cel", () => {
  for (const tribe of tribes) for (const mode of ["harvest", "unload"]) {
    const unit = agent(tribe, { mode, foodDelivery: delivery() }), before = structuredClone(unit);
    for (const age of [0, .12, .24, .36, .66, .99]) {
      const pose = unitBaseResourcePose(unit, 10 + age);
      const idle = unitAnimationPose({ ...unit, mode: "idle" }, 10 + age);
      assert.equal(pose.animation, UNIT_ANIMATIONS[tribe].idle);
      assert.equal(pose.frame, idle.frame); assert.equal(pose.action, mode === "unload" ? "throw" : mode);
      assert.equal(pose.motion.tribe, tribe);
    }
    assert.deepEqual(unit, before);
  }
});
test("work preserves event precedence and excludes every other current or legacy silhouette", () => {
  for (const tribe of tribes) {
    const base = agent(tribe);
    for (const patch of [{ species: "soil-boar" }, { tribe: "bean" }, { health: 0 }, { birth: {} }, { mode: "idle" },
      { mode: "jump" }, { harvestStarted: 11 }, { harvestStarted: NaN }, { harvestStarted: undefined },
      { hurtStartedAt: 10.1 }, { attack: { startedAt: 10, hitAt: 10.3, endsAt: 11 } },
      { moveStartedAt: 10, moveDuration: 1 }, { stats: { ranged: true, melee: false } },
      ...["blade", "secretion", "carapace", "antenna", "feet", "legs", "strength", "arms"].map(key => ({ attributes: { [key]: 1 } }))])
      assert.equal(unitBaseResourcePose({ ...base, ...patch }, 10.2), null, JSON.stringify(patch));
    assert.equal(unitBaseResourcePose(base, NaN), null);
    assert.equal(unitBaseResourcePose(base, Infinity), null);
    assert.ok(unitBaseResourcePose({ ...base, moveStartedAt: 9, moveDuration: .5 }, 10.2));
  }
});
test("throw release remains at 24% of the actual interval and cannot replay on a late snapshot", () => {
  for (const tribe of tribes) for (const duration of [.2, 1, 2.4]) {
    const unit = agent(tribe, { mode: "unload", foodDelivery: delivery(duration) }), before = structuredClone(unit);
    const release = unitBaseResourcePose(unit, 10 + duration * .24);
    assert.equal(release.motion.releaseProgress, .24); assert.equal(release.motion.progress, .24);
    assert.ok(release.motion.sweep > 0); assert.ok(release.motion.compression < 0);
    for (const at of [10 + duration, 10 + duration + .5]) {
      const pose = unitBaseResourcePose(unit, at);
      assert.equal(pose.action, "idle"); assert.equal(pose.resourceRest, true);
      assert.equal(pose.motion.compression, 0); assert.equal(pose.motion.sweep, 0);
      assert.equal(pose.frame, unitAnimationPose({ ...unit, mode: "idle" }, at).frame);
    }
    assert.equal(unitBaseResourcePose({ ...unit, foodDelivery: { ...unit.foodDelivery, receivedAt: 10.1 } }, 10.2).resourceRest, true);
    for (const foodDelivery of [null, {}, { ...delivery(), amount: 0 }, { ...delivery(), arrivesAt: 10 },
      { ...delivery(), startedAt: 12 }, { ...delivery(), arrivesAt: Infinity }])
      assert.equal(unitBaseResourcePose({ ...unit, foodDelivery }, 10.2), null);
    assert.deepEqual(unit, before);
  }
});
test("all source strip maps remain positive and stop before the untouched foot band", () => {
  for (const tribe of tribes) for (const mode of ["harvest", "unload"]) for (let i = 0; i < 101; i++) {
    const pose = unitBaseResourcePose(agent(tribe, { mode, foodDelivery: delivery() }), 10 + i / 100);
    const size = pose.animation.frameSize;
    const geometry = { size, floor: pose.animation.pivotY, support: Math.floor(pose.animation.pivotY - size * .1) };
    const strips = minorTraitWorkStrips(pose.motion, geometry);
    assert.ok(strips.every(s => s.end > s.top && s.scale > .5));
    assert.equal(strips.at(-1).end, geometry.support);
    for (let j = 1; j < strips.length; j++) assert.equal(strips[j].top, strips[j - 1].end);
  }
});
test("native crops, exact support strip, neutral entry and reduced motion use only the authored cel", () => {
  for (const tribe of tribes) {
    const unit = agent(tribe), source = image(tribe), pose = unitBaseResourcePose(unit, 10.36), s = pose.animation.frameSize;
    const frame = unitBaseResourceFrame(source, pose, surface), support = Math.floor(pose.animation.pivotY - s * .1);
    assert.equal(frame.width, s); assert.equal(frame.height, s); assert.ok(frame.draws.length > 20);
    assert.ok(frame.draws.every(draw => draw[0] === source));
    assert.deepEqual(frame.draws.at(-1).slice(1), [pose.frame % 4 * s, Math.floor(pose.frame / 4) * s + support,
      s, s - support, 0, support, s, s - support]);
    const entry = unitBaseResourceFrame(source, unitBaseResourcePose(unit, 10), surface);
    assert.equal(entry.draws.length, 1);
    const reduced = unitBaseResourceFrame(source, pose, surface, true);
    assert.deepEqual(reduced.draws[0].slice(1), [0, 0, s, s, 0, 0, s, s]);
  }
});
test("failed decode, partial source and canvas failure fall back without poisoning retry", () => {
  for (const tribe of tribes) {
    const pose = unitBaseResourcePose(agent(tribe), 10.36), source = image(tribe);
    assert.equal(unitBaseResourceFrame({ ...source, complete: false }, pose, surface), null);
    assert.equal(unitBaseResourceFrame({ ...source, naturalWidth: 1, width: 1 }, pose, surface), null);
    assert.equal(unitBaseResourceFrame(source, pose, () => { throw Error("canvas unavailable"); }), null);
    const frame = unitBaseResourceFrame(source, pose, surface);
    assert.ok(frame); assert.equal(unitBaseResourceFrame(source, pose, () => assert.fail("cache hit")), frame);
    assert.notEqual(unitBaseResourceFrame({ ...source }, pose, surface), frame, "replacement image owns a new cache key");
    assert.equal(unitBaseResourceFrame(source, { ...pose, frame: -1 }, surface), null);
  }
});
test("motion cache is bounded and participates in the shared desktop/mobile budget", () => {
  const source = image("spore"), unit = agent("spore"), pose = unitBaseResourcePose(unit, 10.36);
  const first = unitBaseResourceFrame(source, pose, surface);
  for (let i = 1; i < 30; i++) unitBaseResourceFrame(source, unitBaseResourcePose(unit, 11 + i * .02), surface);
  assert.notEqual(unitBaseResourceFrame(source, pose, surface), first);
  const budget = TRIBE_CANVAS_CACHE_BUDGET.stats(); assert.ok(budget.pixels <= budget.pixelBudget);
});
test("actual world body dispatch renders both actions, scales/facings/outlines and load fallback", () => {
  const code = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  assert.ok(code.indexOf("const resourcePose = drawAgentBaseResource(") > code.indexOf("if (drawAgentRanged(ctx"));
  const state = { simSeconds: 10.24 }, idleMotion = { matches: false }, draws = [], scales = [], outlines = [];
  const unitAnimationSheets = new Map(tribes.map(t => [t, new Map([["idle", { sprite: image(t), scale: 1.3 }]])]));
  const scope = createContext({ Spawner: { unitBaseResourcePose, unitBaseResourceFrame }, state, idleMotion, unitAnimationSheets,
    document: { createElement: () => surface(0, 0) }, drawSelectionOutline: (...args) => outlines.push(args) });
  runInContext(code.match(/^    function drawAgentBaseResource\([^]*?^    }/m)[0], scope);
  const ctx = { save() {}, restore() {}, translate() {}, scale: (...args) => scales.push(args), drawImage: (...args) => draws.push(args) };
  for (const tribe of tribes) for (const facing of [-1, 1]) for (const mode of ["harvest", "unload"]) {
    const unit = agent(tribe, { facing, mode, foodDelivery: delivery() });
    assert.ok(scope.drawAgentBaseResource(ctx, unit, 20, 50, 70, "#fff"));
    assert.deepEqual(scales.at(-1), [facing, 1]); assert.equal(draws.at(-1).at(-1), 91);
    assert.equal(outlines.at(-1)[0], draws.at(-1)[0]);
    const entry = unitAnimationSheets.get(tribe).get("idle");
    entry.sprite.complete = false; assert.equal(scope.drawAgentBaseResource(ctx, unit, 20, 50, 70, null), false); entry.sprite.complete = true;
  }
});
