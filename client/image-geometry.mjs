import { IMAGE_SCALES } from "./image-scales.mjs";

export function imageScale(source) {
  return IMAGE_SCALES[source]?.[0] || 1;
}

export function imageFrameSize(source, size) {
  return Math.round(size * imageScale(source));
}

export function imageRegion(source, region) {
  const scale = IMAGE_SCALES[source] || [1, 1];
  return { x: region.x * scale[0], y: region.y * scale[1],
    width: region.width * scale[0], height: region.height * scale[1] };
}

export function imageAnimation(animation) {
  const scale = imageScale(animation.image);
  const result = { ...animation };
  for (const key of ["frameSize", "pivotX", "pivotY", "outletX", "outletY", "height", "viewSize"])
    if (Number.isFinite(result[key])) result[key] *= scale;
  if (Number.isFinite(result.frameSize)) result.frameSize = Math.round(result.frameSize);
  if (result.nestBounds) result.nestBounds = Object.freeze(imageRegion(animation.image, result.nestBounds));
  return result;
}
