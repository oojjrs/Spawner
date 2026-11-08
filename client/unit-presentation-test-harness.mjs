import { createUnitPresentation } from "./unit-presentation.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { sproutJumpOffset } from "./sprout-roots.mjs";

export function presentationSurface(width, height) {
  const calls = [], translations = [], scales = [], alphas = [], saved = [];
  const context = { calls, translations, scales, alphas, globalAlpha: 1,
    save() { saved.push(this.globalAlpha); }, restore() { this.globalAlpha = saved.pop(); },
    translate: (...values) => translations.push(values), scale: (...values) => scales.push(values),
    beginPath() {}, arc() {}, stroke() {}, setTransform() {}, clearRect() {}, drawImage(...values) { calls.push(values); alphas.push(this.globalAlpha); },
    getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4).fill(255) }) };
  return { width, height, getContext: () => context };
}

export function presentationRenderer(testContext) {
  const previous = globalThis.SpawnerAssets, unavailable = new Set(), outlines = [];
  globalThis.SpawnerAssets = { source: path => path, load: async path => path,
    image: () => ({ complete: true, naturalWidth: 2048, naturalHeight: 2048, get path() { return this.src; }, async decode() { if (unavailable.has(this.src)) throw new Error("Unavailable test image: " + this.src); } }) };
  testContext.after(() => {
    if (previous === undefined) delete globalThis.SpawnerAssets;
    else globalThis.SpawnerAssets = previous;
  });
  const state = { simSeconds: 0 };
  const presentation = createUnitPresentation({ model: { unitDisplayAttributes, sproutJumpOffset },
    height: .7, time: () => state.simSeconds, reducedMotion: () => false, displayScale: () => 1,
    createSurface: presentationSurface, drawOutline: (...args) => outlines.push(args) });
  const context = presentationSurface(512, 512).getContext("2d");
  return { state, presentation, context, unavailable, outlines, draws: context.calls, translations: context.translations, scales: context.scales };
}
