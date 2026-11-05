import { createSproutRoots, sproutRootGeometry } from "./sprout-roots.mjs";

const bodyPath = "DesignAssets/Units/BaseParts/body.png";
const footPath = "DesignAssets/Units/BaseParts/green-foot.png";
const foliagePaths = ["sprout-left", "sprout-right", "sprout-stem"].map(name => `DesignAssets/Units/BaseParts/${name}.png`);
const MAX_SOURCE_FRAMES = 12;
const partPath = name => `DesignAssets/Units/Parts/${name}.png`;
export const BEAN_COMBAT_ART_ASSETS = Object.freeze([
  bodyPath, footPath, partPath("feet-1"), partPath("antenna-1"), partPath("antenna-2"),
  partPath("bean-root-rig"), ...foliagePaths,
]);

// Canonical game.js sprout combat composition, restricted to projected single
// attributes. No new timing: every attachment follows the source frame's body.
export function createBeanCombatArt({ createSurface, imageFor }) {
  const sources = new WeakMap(), mounts = new Map();
  const sproutRoots = createSproutRoots(createSurface);
  function surface(size) {
    const result = createSurface(size, size);
    result.width = result.height = size;
    return result;
  }
  function ready(path) {
    const image = imageFor(path);
    return image && image.complete !== false && (image.naturalWidth || image.width) > 0 &&
      (image.naturalHeight || image.height) > 0 ? image : null;
  }
  function pixelsFor(context, size) {
    const data = context.getImageData(0, 0, size, size);
    return data?.data?.length === size * size * 4 ? data : null;
  }
  function mountFor(feet) {
    if (mounts.has(feet)) return mounts.get(feet);
    const body = ready(bodyPath), foot = feet ? null : ready(footPath);
    if (!body || !feet && !foot) return null;
    const canvas = surface(512), context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    const lift = feet ? 426 - 512 * .94 + sproutRootGeometry(feet).height * .88 : 0;
    context.drawImage(body, 136, 110 - lift, 240, 350);
    if (!feet) for (const x of [16.5, 66.5])
      context.drawImage(foot, 136 + x * 240 / 104, 110 + 136 * 350 / 153, 20 * 240 / 104, 16 * 350 / 153);
    const data = pixelsFor(context, 512);
    if (!data) return null;
    let left = 512, top = 512, right = 0, bottom = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      if (data.data[(y * 512 + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
    if (right <= left || bottom <= top) return null;
    const bounds = { x: left, y: top, width: right - left, height: bottom - top };
    mounts.set(feet, bounds);
    return bounds;
  }
  function prepare(sprite, animation, index) {
    const size = animation.frameSize, canvas = surface(size);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(sprite, index % animation.columns * size, Math.floor(index / animation.columns) * size,
      size, size, 0, 0, size, size);
    const data = pixelsFor(context, size);
    if (!data) return null;
    const pixels = data.data, mask = new Uint8Array(size * size);
    for (let pixel = 0; pixel < mask.length; pixel++) {
      const offset = pixel * 4;
      mask[pixel] = pixels[offset + 3] > 100 && pixels[offset] > 130 &&
        pixels[offset + 2] > pixels[offset] * .78 && pixels[offset + 1] - pixels[offset] < 35 ? 1 : 0;
    }
    let largest = 0, silhouette = [], bounds;
    for (let pixel = 0; pixel < mask.length; pixel++) {
      if (!mask[pixel]) continue;
      const queue = [pixel]; mask[pixel] = 0;
      let left = size, top = size, right = 0, bottom = 0;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const current = queue[cursor], x = current % size, y = Math.floor(current / size);
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
        for (const next of [x > 0 ? current - 1 : -1, x + 1 < size ? current + 1 : -1, current - size, current + size]) {
          if (next < 0 || next >= mask.length || !mask[next]) continue;
          mask[next] = 0; queue.push(next);
        }
      }
      if (queue.length > largest) { largest = queue.length; silhouette = queue; bounds = { x: left, y: top, width: right - left, height: bottom - top }; }
    }
    // Unlike the legacy guessed bounds, fail open to the unmodified source.
    if (!largest) return null;
    let floor = bounds.y + bounds.height;
    for (let y = size - 1; y >= bounds.y + bounds.height / 2; y--) {
      let found = false;
      for (let x = Math.max(0, bounds.x - 2); x < Math.min(size, bounds.x + bounds.width + 2); x++)
        if (pixels[(y * size + x) * 4 + 3] > 100) { found = true; break; }
      if (found) { floor = y + 1; break; }
    }
    const rows = Array.from({ length: size }, () => ({ left: size, right: 0 }));
    for (const pixel of silhouette) {
      const x = pixel % size, row = rows[Math.floor(pixel / size)];
      row.left = Math.min(row.left, x); row.right = Math.max(row.right, x + 1);
    }
    const margin = Math.max(1, Math.round(size * .008));
    for (let y = 0; y < bounds.y + bounds.height * .7; y++) {
      let left = size, right = 0;
      for (let row = Math.max(0, y - margin); row <= Math.min(size - 1, y + margin); row++) {
        left = Math.min(left, rows[row].left); right = Math.max(right, rows[row].right);
      }
      for (let x = 0; x < size; x++) if (x < left - margin || x >= right + margin) pixels[(y * size + x) * 4 + 3] = 0;
    }
    context.putImageData(data, 0, 0);
    return { body: canvas, bounds, floor, frames: new Map() };
  }
  function frame(sprite, animation, index, attributes = {}, action) {
    const feet = attributes.feet || 0, antenna = attributes.antenna || 0;
    if ((!feet && !antenna) || feet && antenna || Object.entries(attributes).some(([key, value]) =>
      value > 0 && key !== "feet" && key !== "antenna")) return null;
    const level = feet || antenna;
    if (!Number.isInteger(level) || level < 1 || level > 4 || !sprite || typeof sprite !== "object" ||
      sprite.complete === false || !Number.isInteger(animation?.frameSize) || animation.frameSize <= 0 ||
      !Number.isInteger(animation.columns) || animation.columns <= 0 || !Number.isInteger(index) || index < 0 ||
      index >= (animation.frameCount ?? Infinity)) return null;
    try {
      const size = animation.frameSize;
      const width = sprite.naturalWidth || sprite.width, height = sprite.naturalHeight || sprite.height;
      if (!(width >= (index % animation.columns + 1) * size && height >= (Math.floor(index / animation.columns) + 1) * size)) return null;
      const part = ready(partPath(feet ? "feet-1" : `antenna-${antenna === 1 ? 1 : 2}`));
      const mount = mountFor(feet);
      if (!part || !mount) return null;
      if (!sources.has(sprite)) sources.set(sprite, new Map());
      const cache = sources.get(sprite), key = `${size}:${animation.columns}:${index}`;
      let source = cache.get(key);
      if (!source) {
        source = prepare(sprite, animation, index);
        if (!source) return null;
        cache.set(key, source);
        if (cache.size > MAX_SOURCE_FRAMES) cache.delete(cache.keys().next().value);
      } else {
        // Keep recently rendered poses without retaining an entire idle sheet.
        cache.delete(key);
        cache.set(key, source);
      }
      const appearanceKey = `${feet}:${antenna}:${action === "idle" ? "idle" : "combat"}`;
      if (source.frames.has(appearanceKey)) return source.frames.get(appearanceKey);
      const body = source.bounds, padding = feet ? Math.ceil(size / 4) : 0;
      const canvas = surface(size + padding * 2), context = canvas.getContext("2d");
      if (!context) return null;
      const scaleX = body.width / mount.width, scaleY = body.height / mount.height;
      const left = body.x - mount.x * scaleX, top = body.y - mount.y * scaleY;
      const roots = feet ? sproutRootGeometry(feet) : null;
      if (action === "idle") {
        const whiteBody = ready(bodyPath), greenFoot = feet ? null : ready(footPath);
        const rootRig = feet ? ready(partPath("bean-root-rig")) : null;
        const foliage = feet ? foliagePaths.map(ready) : [];
        if (!whiteBody || feet && (!rootRig || foliage.some(image => !image)) || !feet && !greenFoot) return null;
        // composeAgentSprite's intact idle body and neutral root rig. Keep the
        // authored 512-space placement, then register it to the source camera.
        const bodyLift = feet ? 426 - 512 * .94 + roots.height * .88 : 0;
        const floorLift = feet ? Math.max(0, top + roots.floor * scaleY - source.floor) : 0;
        context.translate(padding + left, padding + top - floorLift);
        context.scale(scaleX, scaleY);
        if (feet) sproutRoots.drawRig(context, rootRig, feet, null,
          { rotation: 0, bob: 0, pivot: 460 - bodyLift }, null);
        if (antenna) {
          const width = antenna === 1 ? 196 : 344 + (antenna - 2) * 16;
          const height = width * (part.naturalHeight || part.height) / (part.naturalWidth || part.width);
          context.drawImage(part, 256 - width / 2, 260 - bodyLift - height, width, height);
        } else for (const image of foliage) context.drawImage(image, 136, 110 - bodyLift, 240, 350);
        context.drawImage(whiteBody, 136, 110 - bodyLift, 240, 350);
        if (!feet) for (const x of [16.5, 66.5])
          context.drawImage(greenFoot, 136 + x * 240 / 104, 110 + 136 * 350 / 153, 20 * 240 / 104, 16 * 350 / 153);
        source.frames.set(appearanceKey, canvas);
        return canvas;
      }
      const rootHeight = roots ? roots.height * scaleY : 0, rootWidth = roots ? roots.width * scaleX : 0;
      const cut = body.y + body.height - size * .04, rootTop = cut - rootHeight * .12;
      const lift = feet ? Math.max(0, rootTop + rootHeight - source.floor) : 0;
      context.translate(padding, padding - lift);
      if (feet) context.drawImage(part, body.x + body.width / 2 - rootWidth / 2, rootTop, rootWidth, rootHeight);
      context.save();
      if (feet) { context.beginPath(); context.rect(0, 0, size, cut); context.clip(); }
      if (antenna) context.drawImage(source.body, 0, 0);
      else context.drawImage(sprite, index % animation.columns * size, Math.floor(index / animation.columns) * size,
        size, size, 0, 0, size, size);
      context.restore();
      if (antenna) {
        const partWidth = antenna === 1 ? 196 : 344 + (antenna - 2) * 16;
        const partHeight = partWidth * (part.naturalHeight || part.height) / (part.naturalWidth || part.width);
        context.drawImage(part, left + (256 - partWidth / 2) * scaleX, top + (260 - partHeight) * scaleY,
          partWidth * scaleX, partHeight * scaleY);
      }
      source.frames.set(appearanceKey, canvas);
      return canvas;
    } catch { return null; }
  }
  return { frame };
}
