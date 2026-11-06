import { TRIBE_MINOR_ANIMATIONS } from "./tribe-minor-animations.mjs";
import { TRIBE_CANVAS_CACHE_BUDGET } from "./canvas-cache.mjs";
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from "../server/unit-appearance.mjs";

export const TRIBE_MINOR_ANIMATION_ASSETS = Object.freeze(Object.values(TRIBE_MINOR_ANIMATIONS).flatMap(forms => Object.values(forms).flatMap(actions => Object.values(actions).map(clip => clip.image))));

function minorForm(agent, attributes) {
  if (!agent || agent.species || agent.kind !== "corpse" && (agent.dna?.version !== 3 || !Array.isArray(agent.dna.pieces))) return null;
  if ([agent.attributes, agent.appearanceAttributes].some(values => UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => values?.[key] > 0))) return null;
  if (["blade", "secretion", "carapace", "piercing", "guard", "arms"].some(key => attributes?.[key] > 0)) return null;
  return attributes?.antenna > 0 ? "antenna" : attributes?.feet > 0 ? "feet" : null;
}

export function tribeMinorAnimation(agent, attributes, action) {
  const form = minorForm(agent, attributes), actions = TRIBE_MINOR_ANIMATIONS[agent?.tribe]?.[form];
  return actions?.[action === "carry" || action === "idle" ? "walk" : action] || null;
}

export function tribeMinorAnimationFrame(clip, elapsed) {
  let clock = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  if (clip.loop) clock %= clip.durationMs;
  for (let frame = 0; frame < clip.frameCount - 1; frame++) {
    if (clock < clip.durationsMs[frame]) return frame;
    clock -= clip.durationsMs[frame];
  }
  return clip.frameCount - 1;
}

export function createTribeMinorAnimation(createSurface, loadImage) {
  const images = new Map(), frames = TRIBE_CANVAS_CACHE_BUDGET.createCache();
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  async function prepare(tribe) {
    const forms = TRIBE_MINOR_ANIMATIONS[tribe];
    if (!forms) return;
    await Promise.all(Object.values(forms).flatMap(actions => Object.values(actions)).map(async clip => {
      if (!images.has(clip.image)) images.set(clip.image, await loadImage(clip.image));
    }));
  }
  function frame(agent, attributes, animation, index, action, time, motion, layer) {
    const clip = tribeMinorAnimation(agent, attributes, action), image = clip && images.get(clip.image);
    if (!image || layer || image.complete === false || !(image.naturalWidth || image.width)) return null;
    let elapsed;
    if (action === "idle") elapsed = 0;
    else if (action === "walk" || action === "carry") elapsed = (motion?.motionPhase ?? index / Math.max(1, animation.frameCount)) * clip.durationMs;
    else if (action === "birth") elapsed = time * 1000 * clip.durationMs / (animation.duration ? animation.duration * 1000 : animation.durationsMs.reduce((sum, value) => sum + value, 0));
    else if (Number.isFinite(agent.diedAt)) elapsed = Math.max(0, time - agent.diedAt) * 1000;
    else elapsed = index / Math.max(1, animation.frameCount - 1) * clip.durationMs;
    const selected = reducedMotion?.matches ? clip.loop ? 0 : clip.frameCount - 1 : tribeMinorAnimationFrame(clip, elapsed);
    const direct = action === "birth" && Number.isFinite(clip.worldPerPixelBeforeDisplay);
    const size = direct ? clip.frameSize : animation.frameSize;
    const key = [clip.image, selected, size, animation.pivotX, animation.pivotY].join(":");
    const cached = frames.get(key);
    if (cached) return cached;
    const surface = createSurface(size, size), context = surface?.getContext("2d");
    if (!context) return null;
    const scale = size / clip.frameSize, x = direct ? 0 : animation.pivotX - clip.pivotX * scale, y = direct ? 0 : animation.pivotY - clip.pivotY * scale;
    context.drawImage(image, selected % clip.columns * clip.frameSize, Math.floor(selected / clip.columns) * clip.frameSize, clip.frameSize, clip.frameSize, x, y, size, size);
    if (direct) {
      surface.minorWorldPerPixel = clip.worldPerPixelBeforeDisplay;
      surface.minorPivotX = clip.pivotX;
      surface.minorPivotY = clip.pivotY;
    }
    frames.set(key, surface);
    return surface;
  }
  return { prepare, frame };
}
