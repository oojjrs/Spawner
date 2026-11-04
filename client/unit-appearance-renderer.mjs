import { createUnitAppearanceCache, unitAppearanceLodRatio, unitAppearanceSourceScale } from "./unit-appearance.mjs";

export function createUnitAppearanceRenderer(loadSource, makeBitmap, pixelBudget) {
  const cache = createUnitAppearanceCache(loadSource, makeBitmap, pixelBudget);
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
  async function draw(context, agent, pose, anchor, worldPixels, mirror, pixelRatio, stillCurrent) {
    if (!pose || pose.animation.sourceId !== pose.source.sourceId || !stillCurrent()) return false;
    const shape = pose.geometry, animation = pose.animation;
    const width = animation.frameWidth || animation.frameSize, height = animation.frameHeight || animation.frameSize;
    const scale = unitAppearanceSourceScale(agent, worldPixels, pose.source, animation);
    const ratio = samplingRatio(context, agent, pose, worldPixels, pixelRatio);
    let drawn = false;
    await cache.withImage(animation, ratio, raster => {
      if (!stillCurrent()) return;
      context.save(); context.translate(anchor.x, anchor.y); context.scale(mirror ? -1 : 1, 1);
      context.imageSmoothingEnabled = true;
      context.drawImage(raster.image, pose.frame % animation.columns * width * raster.rasterScaleX,
        Math.floor(pose.frame / animation.columns) * height * raster.rasterScaleY,
        width * raster.rasterScaleX, height * raster.rasterScaleY,
        -shape.pivotX * scale, -shape.pivotY * scale, width * scale, height * scale);
      context.restore(); drawn = true;
    });
    return drawn;
  }
  return { beginFrame, draw, clear: cache.clear, stats: cache.stats };
}