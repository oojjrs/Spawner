import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { combatEvolutionPose, createCombatEvolutionArt } from "./combat-evolution.mjs";
import { COMBAT_EVOLUTION_CATALOG } from "./combat-evolution-assets.mjs";
import { dominantDeliveryMotion, dominantDeliveryPose, dominantDeliverySample } from "./dominant-delivery-motion.mjs";
import { workPoint, workTriangles } from "./dominant-resource-motion.mjs";
import { unitAnimationFrame } from "./unit-animation.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";

const tribes = ["bean", "spore", "pebble", "spring"], forms = ["blade", "carapace"];
const definition = (tribe, form) => COMBAT_EVOLUTION_CATALOG[`${tribe === "bean" ? "sprout" : tribe}/${form}`];
const delivery = (start = 10, duration = 1) => ({ startedAt: start, arrivesAt: start + duration, receivedAt: null, amount: 2, resourceType: "clay" });
const unit = (tribe, form, extra = {}) => ({ id: "delivery", tribe, attributes: { [form]: 1, gather: 1 }, health: 10,
  mode: "unload", foodDelivery: delivery(), carrying: 3, carryingType: "clay", hurtStartedAt: -Infinity, animationStartedAt: 1, ...extra });
const read = file => readFileSync(new URL("../" + file, import.meta.url));

test("eight forms use actual delivery intervals, current own idle clocks and no gameplay writes", () => {
  for (const tribe of tribes) for (const form of forms) for (const duration of [.2, 1, 2.4]) {
    const agent = unit(tribe, form, { foodDelivery: delivery(10, duration) }), before = structuredClone(agent);
    const animations = definition(tribe, form).animations;
    for (const progress of [0, .16, .239, .24, .4, .66, .99]) {
      const time = 10 + duration * progress, pose = combatEvolutionPose(agent, time, animations);
      assert.equal(pose.action, "throw"); assert.equal(pose.animation, animations.idle);
      assert.equal(pose.frame, unitAnimationFrame(animations.idle, (time - 1) * 1000));
      assert.equal(pose.dominantDelivery.releaseProgress, .24);
    }
    const release = combatEvolutionPose(agent, 10 + duration * .24, animations).dominantDelivery;
    assert.equal(release.progress, .24); assert.ok(release.sweep > 0);
    assert.equal(tribe === "bean" ? release.compression === 0 : release.compression < 0, true);
    assert.equal(combatEvolutionPose(agent, 10 + duration, animations).action, "idle");
    assert.deepEqual(agent, before);
  }
});

test("delivery respects combat and lifecycle priority and rejects invalid, cancelled or late work", () => {
  for (const tribe of tribes) for (const form of forms) {
    const agent = unit(tribe, form), animations = definition(tribe, form).animations;
    for (const [patch, action] of [[{ health: 0, diedAt: 10 }, "death"], [{ birth: { startedAt: 10, readyAt: 11 } }, "birth"],
      [{ hurtStartedAt: 10.1 }, "hurt"], [{ attack: { startedAt: 10, speed: 1 } }, "attack"],
      [{ attributes: { blade: 1, secretion: 1 }, attack: { mode: "ranged", startedAt: 10, launchedAt: 10.3, endsAt: 11 } }, "ranged"]])
      assert.equal(combatEvolutionPose({ ...agent, ...patch }, 10.18, animations).action, action);
    for (const patch of [{ mode: "idle" }, { mode: "return" }, { species: "beetle" }, { attributes: { [form]: 1, strength: 1 } },
      { foodDelivery: null }, { foodDelivery: delivery(11) }, { foodDelivery: delivery(10, 0) },
      { foodDelivery: { ...delivery(), amount: 0 } }, { foodDelivery: { ...delivery(), amount: Infinity } },
      { foodDelivery: { ...delivery(), receivedAt: 10.1 } }, { foodDelivery: { ...delivery(), startedAt: NaN } },
      { foodDelivery: { ...delivery(), arrivesAt: Infinity } }, { moveStartedAt: 10, moveDuration: 1 }]) {
      assert.equal(dominantDeliveryPose({ ...agent, ...patch }, 10.18, animations), null);
      assert.equal(combatEvolutionPose({ ...agent, ...patch }, 10.18, animations).dominantDelivery, undefined);
    }
    assert.equal(dominantDeliveryPose(agent, Infinity, animations), null);
    assert.equal(combatEvolutionPose(agent, 10.18, animations, true).action, "idle");
    const projected = unit(tribe, "blade", { attributes: { blade: 1, carapace: 1, secretion: 1, antenna: 1, feet: 1 } });
    assert.ok(combatEvolutionPose(projected, 10.18, definition(tribe, "blade").animations).dominantDelivery);
  }
});

test("delivery geometry never moves lower support or adds bean compression", () => {
  for (const tribe of tribes) for (let index = 0; index <= 100; index++) {
    const motion = dominantDeliveryMotion(tribe, index / 100);
    assert.ok(workTriangles(motion).every(triangle => triangle.ratio > .5));
    for (const x of [0, 128, 256, 384, 512]) for (const y of [432, 438, 448, 452, 512]) assert.deepEqual(workPoint(motion, x, y), [x, y]);
    if (tribe === "bean") for (const y of [0, 160, 320, 432]) assert.equal(workPoint(motion, 256, y)[1], y);
    if (index === 0 || index >= 66) { assert.equal(motion.compression, 0); assert.equal(motion.sweep, 0); }
  }
  for (const clock of [-1, NaN, Infinity, 1.1]) assert.equal(dominantDeliveryMotion("bean", clock), null);
  assert.equal(dominantDeliveryMotion("unknown", .24), null);
});

test("samples require valid own-source sheet metadata and loaded pixels", () => {
  for (const tribe of tribes) for (const form of forms) {
    const def = definition(tribe, form), rig = JSON.parse(read(def.rig)), image = { width: 2048, height: 2048, complete: true };
    const source = { rig, definition: def, sheets: new Map([["idle", image]]) }, requested = dominantDeliveryPose(unit(tribe, form), 10.24, def.animations);
    assert.ok(dominantDeliverySample(source, requested));
    for (const patch of [{ complete: false }, { width: 1 }, { height: 1 }])
      assert.equal(dominantDeliverySample({ ...source, sheets: new Map([["idle", { ...image, ...patch }]]) }, requested), null);
    assert.equal(dominantDeliverySample({ ...source, rig: { ...rig, approvedSource: "wrong.png" } }, requested), null);
    assert.equal(dominantDeliverySample(source, { ...requested, frame: 1000 }), null);
    assert.equal(dominantDeliverySample(source, { ...requested, animation: { ...requested.animation } }), null);
  }
});

async function fixture(tribe) {
  const state = { missing: false, failOnce: false, failAll: false }, images = new Map();
  const surface = (width, height) => {
    const canvas = { width, height, calls: [], scales: [] };
    const context = { canvas, save() {}, restore() {}, translate() {}, scale(...args) { canvas.scales.push(args); }, rotate() {}, transform() {},
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, rect() {}, clip() {},
      drawImage(image, ...args) {
        if ((state.failOnce || state.failAll) && image.file?.endsWith("/idle.webp")) { state.failOnce = false; throw Error("temporary draw"); }
        canvas.calls.push({ image, args });
      }, getImageData() { return { data: new Uint8ClampedArray(width * height * 4) }; } };
    canvas.getContext = () => context; return canvas;
  };
  const load = async file => {
    const bytes = read(file), png = file.endsWith(".png"), image = { file, width: png ? bytes.readUInt32BE(16) : 2048,
      height: png ? bytes.readUInt32BE(20) : 2048, get complete() { return !(state.missing && file.endsWith("/idle.webp")); } };
    images.set(file, image); return image;
  };
  const art = createCombatEvolutionArt(file => "data:application/json;base64," + read(file).toString("base64"), surface, load);
  await art.prepare(tribe); return { art, state, images };
}

test("production art uses one own body, distinct idle/phase caches and safe retry without poisoned frames", async () => {
  for (const tribe of tribes) {
    const { art, state } = await fixture(tribe);
    for (const form of forms) {
      const agent = unit(tribe, form), idle = definition(tribe, form).animations.idle.image;
      const sprite = art.frame(agent, 10.24, () => assert.fail("no extra organs"));
      assert.equal(sprite.width, 512); assert.equal(sprite.calls.length, 55);
      assert.ok(sprite.calls.every(call => call.image.file === idle)); assert.deepEqual(sprite.scales, []);
      assert.equal(art.frame({ ...agent, id: "other" }, 10.24, () => {}), sprite);
      assert.notEqual(art.frame(agent, 10.22, () => {}), sprite, "phase participates in cache");
      assert.notEqual(art.frame({ ...agent, animationStartedAt: 1.4 }, 10.24, () => {}), sprite, "idle frame participates in cache");
      state.missing = true; assert.equal(art.frame(agent, 10.36).calls.length, 1); state.missing = false;
      state.failOnce = true; assert.equal(art.frame(agent, 10.36).calls.length, 1);
      state.failAll = true; assert.equal(art.frame(agent, 10.36).calls.length, 1, "permanent idle-sheet draw failure uses own source rig"); state.failAll = false;
      assert.equal(art.frame(agent, 10.36).calls.length, 55, "ready source gets retried");
      for (const time of [10, 10.66, 10.99, 11]) assert.equal(art.frame(agent, time).calls.length, 1, "neutral uses exact direct own pixels");
      assert.equal(art.portrait(agent).calls.length, 1);
    }
  }
});

test("existing world wrapper applies bean delivery scale once and keeps exact partial cargo release", () => {
  const code = readFileSync(new URL("./game.js", import.meta.url), "utf8"), draws = [], scales = [], cargo = [];
  const context = createContext({ state: { simSeconds: 10.23 }, canvas: {}, appearanceWorldPoses: new Map(),
    Spawner: { unitDisplayAttributes }, displayedAgent: value => value, AGENT_HEIGHT: .7, performance: { now: () => 0 },
    agentBodyPose: () => ({ scaleX: .98, scaleY: 1.07 }), foodDeliveryPose: () => ({}), agentJumpOffset: () => 0,
    drawAgentAppearanceSurface: () => draws.push("body"), agentAppearanceBodyPose: () => ({ pivot: .94, scaleX: 1, scaleY: 1 }),
    agentWalkPose: () => null, foodCarryPlacement: () => ({ x: 0, y: 0, width: .2, height: .2, pivotY: 1,
      crop: { x: 0, y: 0, width: 512, height: 512 } }), resourceCarrySprites: new Map([["clay", { complete: true, naturalWidth: 512 }]]),
    drawing: { canvas: {}, save() {}, restore() {}, translate() {}, scale(...args) { scales.push(args); },
      getTransform: () => ({ a: 1, b: 0 }), drawImage() { cargo.push("cargo"); } } });
  for (const name of ["drawAgentAppearance", "drawAgentCarrying"]) runInContext(code.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0], context);
  for (const tribe of tribes) for (const form of forms) {
    const agent = unit(tribe, form); scales.length = 0;
    context.drawAgentAppearance(context.drawing, 0, agent, 50, { x: 0, y: 0 }, { progress: 1 }, null, null);
    assert.deepEqual(scales, tribe === "bean" ? [[.98, 1.07]] : []);
    for (const [time, amount, expected] of [[10.239, 2, 1], [10.24, 2, 0], [10.24, 3, 1]]) {
      cargo.length = 0; context.state.simSeconds = time;
      context.drawAgentCarrying(context.drawing, { ...agent, carrying: amount }, 50, { x: 0, y: 0 }, { progress: 1 });
      assert.equal(cargo.length, expected, "release removes exactly delivery.amount, no duplicate prop");
    }
  }
});
