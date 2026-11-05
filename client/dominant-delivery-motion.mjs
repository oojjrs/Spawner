import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from "../server/unit-appearance.mjs";
import { unitAnimationFrame } from "./unit-animation.mjs";
import { drawHarvestWork } from "./dominant-resource-motion.mjs";

const tribes = ["bean", "spore", "pebble", "spring"];
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };

// A local body cue only. The world still owns cargo, the actual 24% release,
// flight, receipt and sounds. Bean already receives the host delivery stretch,
// so its local cue has no compression or additional whole-body scale.
export function dominantDeliveryMotion(tribe, clock) {
  if (!tribes.includes(tribe) || !Number.isFinite(clock) || clock < 0 || clock > 1) return null;
  const progress = Math.floor((clock + 1e-9) * 50) / 50;
  let compression = 0, sweep = 0;
  if (progress < .16) {
    const p = smooth(progress / .16); compression = .045 * p; sweep = -.05 * p;
  } else if (progress < .24) {
    const p = smooth((progress - .16) / .08); compression = .045 - .085 * p; sweep = -.05 + .15 * p;
  } else {
    const settle = 1 - smooth((progress - .24) / .42); compression = -.04 * settle; sweep = .10 * settle;
  }
  const strength = tribe === "pebble" ? .7 : 1;
  return { tribe, time: progress, progress, releaseProgress: .24, edgePadding: true,
    compression: tribe === "bean" ? 0 : compression * strength || 0,
    sweep: sweep * strength || 0, key: `delivery:${progress}` };
}

export function dominantDeliveryPose(agent, time, animations) {
  const tribe = agent.tribe || "bean", attributes = unitDisplayAttributes(agent);
  const form = attributes.blade > 0 ? "blade" : attributes.carapace > 0 ? "carapace" : null;
  const name = tribe === "bean" ? "sprout" : tribe, animation = animations?.idle, delivery = agent.foodDelivery;
  if (!tribes.includes(tribe) || !form || agent.species || !(agent.health > 0) || agent.birth ||
      agent.mode !== "unload" || UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => attributes[key] > 0) ||
      !Number.isFinite(time) || !delivery || !Number.isFinite(delivery.amount) || !(delivery.amount > 0) ||
      !Number.isFinite(delivery.startedAt) || !Number.isFinite(delivery.arrivesAt) ||
      !(delivery.arrivesAt > delivery.startedAt) || time < delivery.startedAt || time >= delivery.arrivesAt ||
      delivery.receivedAt != null ||
      agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration ||
      animation?.image !== `DesignAssets/Animations/CombatAttributesV7/${name}/Sheets/${form}/idle.webp` ||
      !(animation.durationMs > 0) || !animation.durationsMs?.length) return null;
  const motion = dominantDeliveryMotion(tribe, (time - delivery.startedAt) / (delivery.arrivesAt - delivery.startedAt));
  const elapsed = (time - (agent.animationStartedAt ?? agent.bornAt ?? 0)) * 1000;
  if (!motion || !Number.isFinite(elapsed)) return null;
  // Preserve the existing idle clock instead of restarting breathing/blink at
  // delivery start. Its source frame and delivery phase both participate in cache.
  const frame = unitAnimationFrame(animation, elapsed);
  const sampleTime = animation.durationsMs.slice(0, frame).reduce((sum, value) => sum + value, 0);
  return { action: "throw", frame, elapsed, sampleTime, animation, dominantDelivery: motion };
}

export function dominantDeliverySample(source, requested) {
  const { rig, definition, sheets } = source || {}, pose = requested?.dominantDelivery;
  const animation = definition?.animations?.idle, image = sheets?.get("idle");
  const tribe = rig?.tribe === "sprout" ? "bean" : rig?.tribe;
  if (!pose || !tribes.includes(tribe) || !["blade", "carapace"].includes(rig?.variant) ||
      pose.tribe !== tribe || rig.approvedSource !== `DesignAssets/Concepts/CombatEvolutionV1/${rig.tribe}.png` ||
      animation !== requested.animation || !image || image.complete === false ||
      !(animation.frameSize > 0) || !(animation.columns > 0)) return null;
  const frame = requested.frame, size = animation.frameSize;
  if (!Number.isInteger(frame) || frame < 0 || frame >= animation.durationsMs.length ||
      (image.naturalWidth || image.width) < (frame % animation.columns + 1) * size ||
      (image.naturalHeight || image.height) < (Math.floor(frame / animation.columns) + 1) * size) return null;
  return { image, animation, frame, pose };
}

export function renderDominantDelivery(context, sample) {
  return sample ? drawHarvestWork(context, sample.image, sample.animation, sample.frame, sample.pose) : false;
}
