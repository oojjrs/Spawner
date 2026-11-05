import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from "../server/unit-appearance.mjs";
import { secretionResourceMotion } from "./secretion-resource-motion.mjs";
import { TRIBE_CANVAS_CACHE_BUDGET } from "./canvas-cache.mjs";

const tribes = ["spore", "pebble", "spring"];
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };

// Six ordinary dominant forms keep their existing morphology/idle clock. Only
// the body cue is new; cargo, harvest yields and the 24% release stay scene-owned.
export function minorTraitResourcePose(agent, action, time) {
  const attributes = unitDisplayAttributes(agent), tribe = agent.tribe;
  if (!tribes.includes(tribe) || !(attributes.antenna > 0 || attributes.feet > 0) ||
      UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => attributes[key] > 0) ||
      agent.species || agent.birth || !(agent.health > 0) || !Number.isFinite(time) ||
      agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration) return null;
  if (action === "harvest" && agent.mode === "harvest")
    return secretionResourceMotion(tribe, action, (time - agent.harvestStarted) * 1000);
  if (action !== "throw" || agent.mode !== "unload") return null;
  const delivery = agent.foodDelivery;
  if (!delivery || !(delivery.amount > 0) || !Number.isFinite(delivery.startedAt) ||
      !Number.isFinite(delivery.arrivesAt) || !(delivery.arrivesAt > delivery.startedAt) ||
      time < delivery.startedAt || time >= delivery.arrivesAt || delivery.receivedAt != null) return null;
  return secretionResourceMotion(tribe, action, (time - delivery.startedAt) / (delivery.arrivesAt - delivery.startedAt));
}

export function minorTraitWorkPoint(motion, geometry, x, y) {
  const weight = smooth((geometry.support - y) / (geometry.size * .28));
  const height = geometry.floor - y;
  return [x + weight * height * motion.sweep, y + weight * height * motion.compression];
}

// A horizontal strip is affine (vertical compression plus shear), avoiding
// internal triangle seams. Integer destination boundaries partition the image
// exactly once. The full native lower support band is copied pixel-for-pixel.
export function minorTraitWorkStrips(motion, geometry) {
  const result = [], step = Math.max(1, geometry.size / 32);
  for (let y = 0; y < geometry.support; y += step) {
    const bottom = Math.min(geometry.support, y + step);
    const topPoint = minorTraitWorkPoint(motion, geometry, 0, y);
    const bottomPoint = minorTraitWorkPoint(motion, geometry, 0, bottom);
    const top = Math.round(topPoint[1]), end = Math.round(bottomPoint[1]);
    if (!(end > top)) return null;
    result.push({ y, bottom, top, end, shear: (bottomPoint[0] - topPoint[0]) / (bottom - y),
      scale: (end - top) / (bottom - y), left: topPoint[0] });
  }
  return result;
}

const frames = TRIBE_CANVAS_CACHE_BUDGET.createCache(value => value.surface.width * value.surface.height * 2);
export function minorTraitResourceFrame(image, animation, track, motion, createSurface) {
  const size = animation?.frameSize;
  if (!image || image.complete === false || !tribes.includes(motion?.tribe) ||
      !["harvest", "throw"].includes(motion.action) || !(size > 0) ||
      !Number.isFinite(track?.floor) || image.width !== image.height || image.width < size ||
      !Number.isFinite(motion.compression) || !Number.isFinite(motion.sweep)) return null;
  if (!motion.compression && !motion.sweep) return image;
  const padding = (image.height - size) / 2, floor = padding + track.floor * size / 144;
  const geometry = { size, floor, support: Math.floor(floor - size * .10) };
  if (!(geometry.support > 0) || geometry.support > image.height) return null;
  const key = [motion.key, size, track.floor].join(":"), previous = frames.get(image);
  if (previous?.key === key) return previous.surface;
  const strips = minorTraitWorkStrips(motion, geometry);
  if (!strips) return null;
  try {
    const surface = createSurface(image.width, image.height), context = surface.getContext("2d");
    for (const strip of strips) {
      context.save();
      try {
        context.beginPath(); context.rect(0, strip.top, image.width, strip.end - strip.top); context.clip();
        context.transform(1, 0, strip.shear, strip.scale, strip.left - strip.shear * strip.y, strip.top - strip.scale * strip.y);
        context.drawImage(image, 0, 0);
      } finally { context.restore(); }
    }
    context.drawImage(image, 0, geometry.support, image.width, image.height - geometry.support,
      0, geometry.support, image.width, image.height - geometry.support);
    frames.set(image, { key, surface });
    if (frames.size > 8) frames.delete(frames.keys().next().value);
    return surface;
  } catch { return null; }
}
