import { unitPresentationTestSource } from "./unit-presentation-fixture.mjs";
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
