import { SPORE_GATHER_ART } from "./spore-gather-asset.mjs";
import { TRIBE_CANVAS_CACHE_BUDGET } from "./canvas-cache.mjs";

export const SPORE_GATHER_ASSETS = Object.freeze([SPORE_GATHER_ART.image]);

export function sporeGatherAppearance(tribe, attributes) {
  return tribe === "spore" && attributes?.strength > 0 && !["antenna", "feet", "legs", "blade", "secretion", "carapace", "piercing", "guard", "arms"].some(key => attributes[key] > 0);
}

export function createSporeGatherArt(createSurface, loadImage) {
  let image;
  const frames = TRIBE_CANVAS_CACHE_BUDGET.createCache();
  async function prepare(tribe) {
    if (tribe === "spore" && !image) image = await loadImage(SPORE_GATHER_ART.image);
  }
  function frame(tribe, attributes, animation, action, layer) {
    if (!image || !sporeGatherAppearance(tribe, attributes) || action !== "idle" || layer) return null;
    const key = [animation.frameSize, animation.pivotX, animation.pivotY].join(":");
    const cached = frames.get(key);
    if (cached) return cached;
    const size = animation.frameSize, surface = createSurface(size, size), context = surface?.getContext("2d");
    if (!context) return null;
    const scale = size / SPORE_GATHER_ART.frameSize;
    context.drawImage(image, animation.pivotX - SPORE_GATHER_ART.pivotX * scale, animation.pivotY - SPORE_GATHER_ART.pivotY * scale, size, size);
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
