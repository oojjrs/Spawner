import { unitFrameMirror } from "./unit-size.mjs";
import { createUnitAppearanceCache, unitAppearanceLodRatio, unitAppearanceSourceScale } from "./unit-appearance.mjs";

export function createUnitAppearanceRenderer(loadSource, makeBitmap, pixelBudget) {
  const cache = createUnitAppearanceCache(loadSource, makeBitmap, pixelBudget);
  const pending = new Map(), failures = new Map();
  function samplingRatio(context, agent, pose, worldPixels, pixelRatio) {
    const animation = pose.animation, size = Math.max(animation.frameWidth || animation.frameSize, animation.frameHeight || animation.frameSize);
    const scale = unitAppearanceSourceScale(agent, worldPixels, pose.source, animation), matrix = context.getTransform();
    const deviceRatio = Math.max(Number.isFinite(pixelRatio) ? pixelRatio : 1, Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
    return unitAppearanceLodRatio(size, size * scale, deviceRatio);
  }
  function beginFrame(context, requests, pixelRatio) {
    return cache.setWorkingSet(requests.filter(request => request.pose && request.pose.animation.sourceId === request.pose.source.sourceId).map(request => ({
      animation: request.pose.animation, ratio: samplingRatio(context, request.agent, request.pose, request.worldPixels, pixelRatio)
    })));
  }
  function paint(context, agent, pose, anchor, worldPixels, mirror, raster, beforeDraw) {
    const shape = pose.geometry, animation = pose.animation;
    const width = animation.frameWidth || animation.frameSize, height = animation.frameHeight || animation.frameSize;
    const scale = unitAppearanceSourceScale(agent, worldPixels, pose.source, animation);
    const crop = { x: pose.frame % animation.columns * width * raster.rasterScaleX,
      y: Math.floor(pose.frame / animation.columns) * height * raster.rasterScaleY,
      width: width * raster.rasterScaleX, height: height * raster.rasterScaleY };
    const destination = { x: -shape.pivotX * scale, y: -shape.pivotY * scale, width: width * scale, height: height * scale };
    context.save();
    try {
      context.translate(anchor.x, anchor.y); context.scale(unitFrameMirror(animation.sourceFacing || pose.source.sourceFacing, mirror ? -1 : 1) ? -1 : 1, 1);
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
      beforeDraw?.(context, raster.image, crop, destination);
      context.drawImage(raster.image, crop.x, crop.y, crop.width, crop.height,
        destination.x, destination.y, destination.width, destination.height);
    } finally { context.restore(); }
  }
  function prepareFrame(context, requests, pixelRatio) {
    const working = beginFrame(context, requests, pixelRatio);
    for (const request of requests) {
      const { pose, agent, worldPixels } = request;
      if (!pose || pose.animation.sourceId !== pose.source.sourceId) continue;
      const ratio = samplingRatio(context, agent, pose, worldPixels, pixelRatio), key = pose.animation.image + ":" + working.ratios[pose.animation.image];
      if (pending.has(key) || (failures.get(key) || 0) > Date.now()) continue;
      const promise = cache.prepare(pose.animation, ratio); pending.set(key, promise);
      promise.then(() => { pending.delete(key); failures.delete(key); }, () => {
        pending.delete(key); failures.set(key, Date.now() + 5000);
        while (failures.size > 128) failures.delete(failures.keys().next().value);
      });
    }
    return working;
  }
  function drawReady(context, agent, pose, anchor, worldPixels, mirror, pixelRatio, beforeDraw) {
    if (!pose || pose.animation.sourceId !== pose.source.sourceId) return false;
    return cache.withReadyImage(pose.animation, samplingRatio(context, agent, pose, worldPixels, pixelRatio),
      raster => paint(context, agent, pose, anchor, worldPixels, mirror, raster, beforeDraw));
  }
  function isReady(context, agent, pose, worldPixels, pixelRatio) {
    return !!pose && cache.withReadyImage(pose.animation, samplingRatio(context, agent, pose, worldPixels, pixelRatio), () => {});
  }
  async function draw(context, agent, pose, anchor, worldPixels, mirror, pixelRatio, stillCurrent) {
    if (!pose || pose.animation.sourceId !== pose.source.sourceId || !stillCurrent()) return false;
    const animation = pose.animation;
    const ratio = samplingRatio(context, agent, pose, worldPixels, pixelRatio);
    let drawn = false;
    await cache.withImage(animation, ratio, raster => {
      if (!stillCurrent()) return;
      paint(context, agent, pose, anchor, worldPixels, mirror, raster); drawn = true;
    });
    return drawn;
  }
  return { beginFrame, prepareFrame, drawReady, isReady, draw, clear() { failures.clear(); cache.clear(); }, stats: cache.stats };
}
