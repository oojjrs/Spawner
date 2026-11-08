import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTribeAttributeAnimation } from "./attribute-animation.mjs";
import { UNIT_ANIMATIONS } from "./unit-animation.mjs";
import { createCombatEvolutionArt } from "./combat-evolution.mjs";

function surface(width, height) {
  const calls = [], pixels = new Uint8ClampedArray(width * height * 4).fill(255), stack = [];
  let matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const canvas = { width, height, calls };
  const ctx = { canvas, globalAlpha: 1, globalCompositeOperation: "source-over",
    save() { stack.push({ matrix: { ...matrix }, alpha: this.globalAlpha }); },
    restore() { const prior = stack.pop(); matrix = prior.matrix; this.globalAlpha = prior.alpha; },
    transform() {}, translate() {}, scale() {}, rotate() {},
    getTransform() { return matrix; }, setTransform() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, rect() {},
    drawImage(image, ...args) { calls.push({ image, args, alpha: this.globalAlpha }); },
    getImageData() { return { width, height, data: new Uint8ClampedArray(pixels) }; },
    putImageData(image) { canvas.pixels = image.data; }
  };
  canvas.getContext = () => ctx;
  return canvas;
}
const asset = path => "data:application/json;base64," + readFileSync(new URL("../" + path, import.meta.url)).toString("base64");
const image = async file => ({ file, width: 512, height: 512 });
function leaves(canvas, alpha = 1) {
  return canvas.calls.flatMap(call => call.image.calls ? leaves(call.image, alpha * call.alpha) :
    [{ image: call.image, alpha: alpha * call.alpha }]);
}
const feet = canvas => leaves(canvas).filter(call => /Attributes\/v2\/Parts\/feet-(left|right)\.png$/.test(call.image.file));
