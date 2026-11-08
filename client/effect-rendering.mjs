import { createCanvasCacheBudget } from "./canvas-cache.mjs";

export function createEffectRendering(createSurface, pixelBudget) {
  const budget = createCanvasCacheBudget(pixelBudget), frames = budget.createCache();
  const sources = new WeakMap();
  let nextSource = 0;
  function frame(image, x, y, width, height, filter) {
    if (!filter || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
        width <= 0 || height <= 0 || width * height > pixelBudget) return null;
    const source = image.currentSrc || image.src || "";
    const sourceWidth = image.naturalWidth || image.width, sourceHeight = image.naturalHeight || image.height;
    let entry = sources.get(image);
    if (!entry || entry.source !== source || entry.width !== sourceWidth || entry.height !== sourceHeight) {
      entry = { id: ++nextSource, source, width: sourceWidth, height: sourceHeight };
      sources.set(image, entry);
    }
    const key = [entry.id, x, y, width, height, filter].join(":");
    let surface = frames.get(key);
    if (!surface) {
      surface = createSurface(width, height);
      const context = surface.getContext("2d");
      context.filter = filter;
      context.drawImage(image, x, y, width, height, 0, 0, width, height);
      frames.set(key, surface);
    }
    return surface;
  }
  return { frame, clear: frames.clear, stats: budget.stats };
}
