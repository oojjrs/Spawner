import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from "../server/unit-appearance.mjs";

export const BEAN_DOMINANT_HOP_ANIMATIONS = Object.freeze(Object.fromEntries(["blade", "carapace"].map(form => [form,
  Object.freeze({ action: "walk", image: `DesignAssets/Animations/BeanDominantHopV1/${form}/hop.webp`,
    frameSize: 512, columns: 4, frameCount: 11, pivotX: 256, pivotY: 448,
    frames: Object.freeze([0,1,2,3,4,5,5,5,5,5,5,5,5,5,5,5,5,6,3,7,8,9,10,0]),
    durationMs: 960, durationsMs: Object.freeze(Array(24).fill(40)), loop: false, leafOnlyHop: true })])));
export const BEAN_DOMINANT_HOP_ASSETS = Object.freeze(Object.values(BEAN_DOMINANT_HOP_ANIMATIONS).map(clip => clip.image));

// Own-source leaf response only. The existing world renderer owns the full
// jump/lift/body stretch and cargo, so these clips contain no second hop.
export function beanDominantHopPose(agent, time) {
  if (!agent || agent.species || (agent.tribe || "bean") !== "bean" || !(agent.health > 0) || agent.birth ||
      !Number.isFinite(time) || !Number.isFinite(agent.moveStartedAt) || !Number.isFinite(agent.moveDuration) ||
      !(agent.moveDuration > 0) || time < agent.moveStartedAt || time >= agent.moveStartedAt + agent.moveDuration ||
      ["harvest", "unload", "jump"].includes(agent.mode)) return null;
  const attributes = unitDisplayAttributes(agent);
  if (UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => attributes[key] > 0)) return null;
  const form = attributes.blade > 0 ? "blade" : attributes.carapace > 0 ? "carapace" : null;
  const animation = BEAN_DOMINANT_HOP_ANIMATIONS[form];
  if (!animation) return null;
  const progress = (time - agent.moveStartedAt) / agent.moveDuration;
  const index = Math.min(animation.frames.length - 1, Math.floor(progress * animation.frames.length + 1e-9));
  const frame = animation.frames[index];
  return { action: "walk", frame, elapsed: progress * animation.durationMs, sampleTime: index * 40, animation,
    beanDominantHop: true, progress };
}

const hopFrames = new WeakMap();
export function beanDominantHopFrame(image, pose, createSurface) {
  const animation = pose?.beanDominantHop && pose.animation, size = animation?.frameSize, frame = pose?.frame;
  if (!image || image.complete === false || !animation || !Number.isInteger(frame) || frame < 0 || frame >= animation.frameCount) return null;
  const x = frame % animation.columns * size, y = Math.floor(frame / animation.columns) * size;
  if (x + size > (image.naturalWidth || image.width) || y + size > (image.naturalHeight || image.height)) return null;
  let frames = hopFrames.get(image);
  if (!frames) hopFrames.set(image, frames = new Map());
  if (frames.has(frame)) return frames.get(frame);
  try {
    const surface = createSurface(size, size), context = surface?.getContext("2d");
    if (!context) return null;
    context.drawImage(image, x, y, size, size, 0, 0, size, size);
    frames.set(frame, surface); if (frames.size > 4) frames.delete(frames.keys().next().value);
    return surface;
  } catch { return null; }
}
