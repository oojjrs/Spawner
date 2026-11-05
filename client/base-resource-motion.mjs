import { UNIT_ANIMATIONS, unitAnimationFrame, unitAnimationPose } from "./unit-animation.mjs";
import { UNIT_DISPLAY_PRIORITY, unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from "../server/unit-appearance.mjs";
import { secretionResourceMotion } from "./secretion-resource-motion.mjs";
import { minorTraitWorkStrips } from "./minor-trait-resource-motion.mjs";
import { TRIBE_CANVAS_CACHE_BUDGET } from "./canvas-cache.mjs";

// Six missing base-body work motions reuse the actual authored idle cels at
// their native camera. No source redraw, idle alias registration or ready flag.
export function unitBaseResourcePose(agent, time) {
  if (!agent || agent.species || !["spore", "pebble", "spring"].includes(agent.tribe) ||
      agent.birth || !(agent.health > 0) || !Number.isFinite(time) ||
      agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration) return null;
  const attributes = unitDisplayAttributes(agent), stats = agent.stats?.dna || agent.stats;
  if ([...UNIT_DISPLAY_PRIORITY, ...UNIT_APPEARANCE_LEGACY_VISUAL_KEYS, "legs"].some(key => attributes[key] > 0) ||
      stats?.ranged && !stats?.melee) return null;
  const current = unitAnimationPose(agent, time);
  if (current && !["idle", "harvest", "throw"].includes(current.action)) return null;
  let action, clock, rest = false;
  if (agent.mode === "harvest") {
    action = "harvest"; clock = (time - agent.harvestStarted) * 1000;
  } else if (agent.mode === "unload") {
    const delivery = agent.foodDelivery;
    if (!delivery || !(delivery.amount > 0) || !Number.isFinite(delivery.startedAt) ||
        !Number.isFinite(delivery.arrivesAt) || delivery.arrivesAt <= delivery.startedAt || time < delivery.startedAt) return null;
    rest = time >= delivery.arrivesAt || delivery.receivedAt != null;
    action = "throw"; clock = rest ? 1 : (time - delivery.startedAt) / (delivery.arrivesAt - delivery.startedAt);
  } else return null;
  const motion = secretionResourceMotion(agent.tribe, action, clock);
  if (!motion) return null;
  const animation = UNIT_ANIMATIONS[agent.tribe].idle;
  // Use the ordinary idle epoch throughout work, recovery and cancellation.
  // Resetting it at harvest start would replace the visible authored body cel.
  const elapsed = (time - (agent.animationStartedAt ?? agent.bornAt ?? 0)) * 1000;
  return { action: rest ? "idle" : action, animation, frame: unitAnimationFrame(animation, elapsed), motion, resourceRest: rest };
}

const frames = TRIBE_CANVAS_CACHE_BUDGET.createCache();
const imageIds = new WeakMap();
let nextImageId = 0;
export function unitBaseResourceFrame(image, pose, createSurface, reducedMotion = false) {
  const animation = pose?.animation, size = animation?.frameSize, frame = reducedMotion ? 0 : pose?.frame;
  if (!image || image.complete === false || !Number.isInteger(size) || size <= 0 ||
      !Number.isInteger(frame) || frame < 0 || frame >= animation.frameCount ||
      !pose?.motion || !Number.isFinite(animation.pivotY)) return null;
  const x = frame % animation.columns * size, y = Math.floor(frame / animation.columns) * size;
  if (x + size > (image.naturalWidth || image.width) || y + size > (image.naturalHeight || image.height)) return null;
  const motion = reducedMotion ? { ...pose.motion, compression: 0, sweep: 0 } : pose.motion;
  if (!Number.isFinite(motion.compression) || !Number.isFinite(motion.sweep)) return null;
  const plain = !motion.compression && !motion.sweep;
  if (!imageIds.has(image)) imageIds.set(image, ++nextImageId);
  const key = [imageIds.get(image), size, animation.pivotY, frame, plain ? "neutral" : motion.key].join(":");
  const cached = frames.get(key);
  if (cached) return cached;
  const geometry = { size, floor: animation.pivotY, support: Math.floor(animation.pivotY - size * .10) };
  const strips = plain ? null : minorTraitWorkStrips(motion, geometry);
  if (!plain && !strips || geometry.support <= 0 || geometry.support > size) return null;
  try {
    const surface = createSurface(size, size), context = surface?.getContext("2d");
    if (!context) return null;
    const paint = () => context.drawImage(image, x, y, size, size, 0, 0, size, size);
    if (plain) paint();
    else {
      // Integer destination strips partition each pixel once: no diagonal
      // triangle seams and no overlapping alpha. The full foot band is exact.
      for (const strip of strips) {
        context.save();
        try {
          context.beginPath(); context.rect(0, strip.top, size, strip.end - strip.top); context.clip();
          context.transform(1, 0, strip.shear, strip.scale, strip.left - strip.shear * strip.y, strip.top - strip.scale * strip.y);
          paint();
        } finally { context.restore(); }
      }
      context.drawImage(image, x, y + geometry.support, size, size - geometry.support,
        0, geometry.support, size, size - geometry.support);
    }
    frames.set(key, surface);
    // Also cap this motion family, within the shared desktop/mobile budget.
    if (frames.size > 8) frames.delete(frames.keys().next().value);
    return surface;
  } catch { return null; }
}
