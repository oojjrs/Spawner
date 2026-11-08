import test from "node:test";
import assert from "node:assert/strict";
import { createEffectRendering } from "./effect-rendering.mjs";

test("effect filters reuse the same source frame and remain inside their pixel budget", () => {
  const draws = [];
  const rendering = createEffectRendering((width, height) => ({ width, height,
    getContext: () => ({ drawImage: (...args) => draws.push(args) }) }), 128);
  const image = { src: "effects.png", naturalWidth: 32, naturalHeight: 16 };
  const first = rendering.frame(image, 0, 0, 8, 8, "brightness(.5)");
  assert.equal(rendering.frame(image, 0, 0, 8, 8, "brightness(.5)"), first);
  assert.equal(draws.length, 1);
  assert.deepEqual(draws[0].slice(1), [0, 0, 8, 8, 0, 0, 8, 8]);
  rendering.frame(image, 8, 0, 8, 8, "brightness(.5)");
  rendering.frame(image, 16, 0, 8, 8, "brightness(.5)");
  assert.equal(rendering.stats().pixels, 128);
  assert.equal(rendering.stats().evictions, 1);
  assert.equal(rendering.frame(image, 0, 0, 32, 16, "brightness(.5)"), null);
  assert.equal(draws.length, 3);
  rendering.clear();
  assert.equal(rendering.stats().pixels, 0);
});

test("changed effect sources and different filters cannot reuse stale tinted pixels", () => {
  const filters = [];
  const rendering = createEffectRendering((width, height) => ({ width, height,
    getContext: () => ({ set filter(value) { filters.push(value); }, drawImage() {} }) }), 256);
  const image = { src: "first.png", naturalWidth: 8, naturalHeight: 8 };
  const first = rendering.frame(image, 0, 0, 8, 8, "brightness(.5)");
  const second = rendering.frame(image, 0, 0, 8, 8, "sepia(1)");
  image.src = "second.png";
  const third = rendering.frame(image, 0, 0, 8, 8, "brightness(.5)");
  assert.notEqual(first, second);
  assert.notEqual(first, third);
  assert.deepEqual(filters, ["brightness(.5)", "sepia(1)", "brightness(.5)"]);
});
