import { SPORE_GATHER_ANIMATIONS } from "./spore-gather-motion-assets.mjs";
import { SPORE_GATHER_ART } from "./spore-gather-asset.mjs";
import { TRIBE_CANVAS_CACHE_BUDGET } from "./canvas-cache.mjs";

export const SPORE_GATHER_ASSETS = Object.freeze([SPORE_GATHER_ART.image, ...Object.values(SPORE_GATHER_ANIMATIONS).map(clip => clip.image)]);

export function sporeGatherAppearance(tribe, attributes) {
  return tribe === "spore" && attributes?.strength > 0 && !["antenna", "feet", "legs", "blade", "secretion", "carapace", "piercing", "guard", "arms"].some(key => attributes[key] > 0);
}

export function createSporeGatherArt(createSurface, loadImage) {
  let image;
  const frames = TRIBE_CANVAS_CACHE_BUDGET.createCache(), motionImages = new Map();
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  async function prepare(tribe) {
    if (tribe !== "spore") return;
    if (!image) image = await loadImage(SPORE_GATHER_ART.image);
    await Promise.all(Object.values(SPORE_GATHER_ANIMATIONS).map(async clip => {
      if (!motionImages.has(clip.image)) motionImages.set(clip.image, await loadImage(clip.image));
    }));
  }
  function frame(tribe, attributes, animation, action, layer, index, motion) {
    if (!sporeGatherAppearance(tribe, attributes) || layer) return null;
    const clip = SPORE_GATHER_ANIMATIONS[action === "carry" ? "walk" : action];
    if (!clip) return null;
    const source = motionImages.get(clip.image);
    if (!source && (action !== "idle" || !image)) return null;
    const metadata = source ? clip : SPORE_GATHER_ART;
    const sample = reducedMotion?.matches ? 0 : Number.isFinite(motion?.motionPhase) ?
      Math.floor(Math.max(0, motion.motionPhase) * clip.frameCount) % clip.frameCount : Number.isInteger(index) ? Math.max(0, index) % clip.frameCount : 0;
    const selected = source ? sample : 0;
    const key = [metadata.image, selected, animation.frameSize, animation.pivotX, animation.pivotY].join(":");
    const cached = frames.get(key);
    if (cached) return cached;
    const size = animation.frameSize, surface = createSurface(size, size), context = surface?.getContext("2d");
    if (!context) return null;
    const scale = size / metadata.frameSize, left = animation.pivotX - metadata.pivotX * scale, top = animation.pivotY - metadata.pivotY * scale;
    if (source) context.drawImage(source, selected % clip.columns * clip.frameSize, Math.floor(selected / clip.columns) * clip.frameSize,
      clip.frameSize, clip.frameSize, left, top, size, size);
    else context.drawImage(image, left, top, size, size);
    frames.set(key, surface);
    return surface;
  }
  function portrait(tribe, attributes, width, height, box, layer) {
    if (!image || !sporeGatherAppearance(tribe, attributes)) return null;
    const surface = createSurface(width, height), context = surface?.getContext("2d");
    if (!context) return null;
    if (layer && !["full", "body", "combat-body"].includes(layer)) return surface;
    const bounds = SPORE_GATHER_ART.bounds, scale = Math.min(box.width / bounds.width, box.height / bounds.height);
    context.drawImage(image, width / 2 - (bounds.x + bounds.width / 2) * scale,
      box.y + box.height - (bounds.y + bounds.height) * scale, SPORE_GATHER_ART.frameSize * scale, SPORE_GATHER_ART.frameSize * scale);
    return surface;
  }
  return { prepare, frame, portrait };
}
