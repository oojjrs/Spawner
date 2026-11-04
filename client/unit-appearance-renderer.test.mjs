import test from "node:test";
import assert from "node:assert/strict";
import { createUnitAppearanceRenderer } from "./unit-appearance-renderer.mjs";
import { createUnitAppearanceCache } from "./unit-appearance.mjs";

const animation = { sourceId: "own-source", image: "own-sheet", frameSize: 512, columns: 2, frameCount: 2 };
const pose = { animation, source: { sourceId: "own-source", camera: { pixelsPerWorld: 512 } }, frame: 1,
  geometry: { pivotX: 256, pivotY: 448 } };
const agent = { id: "one", tribe: "bean", dna: { pieces: Array(5).fill({}) }, stats: { pieceCount: 100 } };
function context() {
  const draws = [], transforms = [];
  return { draws, transforms, getTransform: () => ({ a: 2, b: 0, c: 0, d: 2 }),
    save() {}, restore() {}, translate(...args) { transforms.push(args); }, scale() {}, drawImage(...args) { draws.push(args); } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("world decode prepares a later frame without painting into the current canvas", async () => {
  let resolveLoad, decodes = 0;
  const renderer = createUnitAppearanceRenderer(() => new Promise(resolve => { resolveLoad = resolve; }),
    async (source, settings) => { decodes++; return { width: settings.resizeWidth, height: settings.resizeHeight }; }, 1024 * 1024);
  const ctx = context(), requests = [{ agent, pose, worldPixels: 128 }];
  renderer.prepareFrame(ctx, requests, 2);
  for (let i = 0; i < 30; i++) {
    renderer.prepareFrame(ctx, requests, 2);
    assert.equal(renderer.drawReady(ctx, agent, pose, { x: 10, y: 20 }, 128, false, 2), false);
  }
  await flush(); resolveLoad({ width: 1024, height: 512 }); await flush();
  assert.equal(decodes, 1); assert.equal(ctx.draws.length, 0);
  assert.equal(renderer.drawReady(ctx, agent, pose, { x: 30, y: 40 }, 128, false, 2), true);
  assert.deepEqual(ctx.transforms[0], [30, 40]);
  const draw = ctx.draws[0];
  assert.equal(draw[1], 512); // raster is full resolution for this DPR/growth
  assert.equal(draw[7], 128 * 1.05); // actual DNA wins; growth is applied once
  assert.equal(draw[5], -256 / 512 * 128 * 1.05);
});

test("a cleared in-flight decode is discarded before synchronous painting", async () => {
  let resolveLoad, closed = 0;
  const cache = createUnitAppearanceCache(() => new Promise(resolve => { resolveLoad = resolve; }),
    async () => ({ width: 512, height: 256, close() { closed++; } }), 1024 * 1024);
  const pending = cache.prepare(animation, .5); await flush(); cache.clear();
  resolveLoad({ width: 1024, height: 512 }); await pending;
  assert.equal(cache.withReadyImage(animation, .5, () => assert.fail("stale draw")), false);
  assert.equal(cache.stats().residentPixels, 0); assert.equal(closed, 1);
});

test("source mismatch and failed decode retain legacy rendering without repeated requests", async () => {
  let loads = 0;
  const renderer = createUnitAppearanceRenderer(async () => { loads++; throw new Error("offline"); }, async () => {}, 1024 * 1024);
  const ctx = context(), requests = [{ agent, pose, worldPixels: 128 }];
  renderer.prepareFrame(ctx, requests, 2); await flush();
  for (let i = 0; i < 60; i++) renderer.prepareFrame(ctx, requests, 2);
  await flush(); assert.equal(loads, 1);
  assert.equal(renderer.drawReady(ctx, agent, { ...pose, source: { ...pose.source, sourceId: "another-mask" } }, { x: 0, y: 0 }, 128), false);
  assert.equal(ctx.draws.length, 0);
});

test("all visible atlas requests share one decoded budget and release source leases", async () => {
  let leases = 0;
  const cache = createUnitAppearanceCache(async () => { leases++; return { blob: new Blob(["pixels"]), release() { leases--; } }; },
    async (blob, settings) => ({ width: settings.resizeWidth, height: settings.resizeHeight, close() {} }), 65536);
  const clips = Array.from({ length: 32 }, (_, i) => ({ ...animation, image: "mask-" + i }));
  const working = cache.setWorkingSet(clips.map(animation => ({ animation, ratio: 1 })));
  assert.ok(working.pixels <= 65536);
  for (const clip of clips) await cache.prepare(clip, 1);
  assert.ok(cache.stats().residentPixels <= 65536); assert.equal(leases, 0);
  cache.clear(); assert.equal(cache.stats().residentPixels, 0);
});

test("a rectangular atlas keeps both raster axes nonzero at the smallest LOD", async () => {
  const clip = { ...animation, frameWidth: 512, frameHeight: 32, columns: 1, frameCount: 1 };
  const cache = createUnitAppearanceCache(async () => ({ width: 512, height: 32 }), async (source, settings) => {
    assert.equal(settings.resizeWidth, 1); assert.equal(settings.resizeHeight, 1);
    return { width: 1, height: 1 };
  }, 1);
  assert.equal(cache.setWorkingSet([{ animation: clip, ratio: 1 }]).pixels, 1);
  await cache.prepare(clip, 1);
  assert.equal(cache.stats().residentPixels, 1);
});
