import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from "../server/unit-appearance.mjs";
import { drawHarvestWork } from "./dominant-resource-motion.mjs";

// A render-only action for the approved blade silhouettes. Hidden secretion
// retains its actual combat ability without exchanging the body for shoot art.
export const BLADE_RANGED_DURATION_MS = 600;
export const BLADE_RANGED_LAUNCH_MS = 200;

export function isBladeRangedAction(agent) {
  const visual = unitDisplayAttributes(agent), attack = agent?.attack;
  return !agent?.species && visual.blade > 0 &&
    !UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => visual[key] > 0) &&
    !!(attack?.dnaRanged || attack?.mode === "ranged" || attack?.attackMode === "ranged");
}

export function bladeRangedPose(agent, time) {
  if (!isBladeRangedAction(agent) || !(agent.health > 0) || agent.birth || !Number.isFinite(time)) return null;
  const attack = agent.attack, start = attack.startedAt, end = attack.endsAt;
  // hitAt is projectile arrival in the world. Never use it as a launch cue.
  const launch = attack.launchedAt;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(start), Math.abs(end)) * 4;
  if (![start, launch, end].every(Number.isFinite) || launch < start || end < launch || !(end > start) ||
      time < start || time > end + epsilon) return null;
  const recorded = attack.shotLaunches;
  const launches = Array.isArray(recorded) && recorded.length && recorded[0] === launch &&
    recorded.every((at, i) => Number.isFinite(at) && at <= end + epsilon && (!i || at > recorded[i - 1])) ? recorded : [launch];
  // Very fast world attacks can end exactly at the final launch. Keep the
  // earlier shots valid; if that final snapshot still exists, show its release.
  if (time > end && time !== launches.at(-1) ||
      time === end && Math.abs(launches.at(-1) - end) > epsilon) return null;
  const recoveryShare = (BLADE_RANGED_DURATION_MS - BLADE_RANGED_LAUNCH_MS) / BLADE_RANGED_DURATION_MS;
  const startFor = i => i ? launches[i - 1] + (launches[i] - launches[i - 1]) * recoveryShare : start;
  let shotIndex = 0;
  while (shotIndex < launches.length - 1 && time >= startFor(shotIndex + 1)) shotIndex++;
  const shotStart = startFor(shotIndex), shotLaunch = launches[shotIndex];
  const shotEnd = shotIndex + 1 < launches.length ? startFor(shotIndex + 1) : end;
  let elapsed = time < shotLaunch ? BLADE_RANGED_LAUNCH_MS * (time - shotStart) / Math.max(.001, shotLaunch - shotStart) :
    BLADE_RANGED_LAUNCH_MS + (BLADE_RANGED_DURATION_MS - BLADE_RANGED_LAUNCH_MS) * (time - shotLaunch) / Math.max(.001, shotEnd - shotLaunch);
  if (Math.abs(time - shotLaunch) <= epsilon) elapsed = BLADE_RANGED_LAUNCH_MS;
  // 50 Hz sampling bounds the compositor cache, independent of render FPS.
  const frame = Math.max(0, Math.min(30, Math.floor((elapsed + 1e-6) / 20)));
  return { action: "ranged", elapsed, frame, sampleTime: frame * 20, shotIndex, launchAt: shotLaunch };
}

export function bladeRangedShear(elapsed) {
  // Small anticipation, backwards firing recoil, then settle. Shearing around
  // the ground leaves the support line fixed and never rotates the feet under it.
  const keys = [[0, 0], [120, -.012], [170, -.018], [200, .045], [240, .055], [320, .015], [420, -.008], [600, 0]];
  const time = Math.max(0, Math.min(600, elapsed));
  for (let i = 1; i < keys.length; i++) if (time <= keys[i][0]) {
    const a = keys[i - 1], b = keys[i], p = (time - a[0]) / (b[0] - a[0]), smooth = p * p * (3 - 2 * p);
    return a[1] + (b[1] - a[1]) * smooth;
  }
  return 0;
}

export function applyBladeRangedRecoil(context, pose) {
  context.translate(256, 448);
  context.transform(1, 0, bladeRangedShear(pose.sampleTime), 1, 0, 0);
  context.translate(-256, -448);
}

// Reuse the planted-support mesh already shared by work/delivery. The actual
// blade pixels remain one source-owned silhouette, with no invented outlet,
// melee attachment swing, hidden-organ replacement or new projectile effect.
const expressionKeys = [[0, 0, 0], [100, .06, .035], [160, .12, .07],
  [200, -.045, -.09], [240, -.02, -.12], [320, .035, .025], [440, -.012, -.018], [600, 0, 0]];
const expressionStrength = { bean: [1, 1], spore: [.7, .85], pebble: [.35, .65], spring: [1.25, 1.05] };

export function bladeRangedExpression(tribe, time) {
  const strength = expressionStrength[tribe];
  if (!Object.hasOwn(expressionStrength, tribe) || !Number.isFinite(time) || time < 0 || time > BLADE_RANGED_DURATION_MS) return null;
  for (let i = 1; i < expressionKeys.length; i++) if (time <= expressionKeys[i][0]) {
    const a = expressionKeys[i - 1], b = expressionKeys[i];
    const p = (time - a[0]) / (b[0] - a[0]), smooth = p * p * (3 - 2 * p);
    return { tribe, time, edgePadding: true,
      compression: (a[1] + (b[1] - a[1]) * smooth) * strength[0] || 0,
      sweep: (a[2] + (b[2] - a[2]) * smooth) * strength[1] || 0 };
  }
  return null;
}

export function bladeRangedSample(source, requested) {
  const { rig, definition, sheets } = source || {}, animation = definition?.animations?.idle;
  const tribe = rig?.tribe === "sprout" ? "bean" : rig?.tribe, image = sheets?.get("idle");
  const pose = requested?.ranged && bladeRangedExpression(tribe, requested.ranged.sampleTime);
  if (!pose || rig.variant !== "blade" ||
      rig.approvedSource !== `DesignAssets/Concepts/CombatEvolutionV1/${rig.tribe}.png` ||
      !animation || animation !== requested.animation || animation.image !== `DesignAssets/Animations/CombatAttributesV7/${rig.tribe}/Sheets/blade/idle.webp` ||
      !(animation.frameSize > 0) || !(animation.columns > 0) || !image || image.complete === false ||
      (image.naturalWidth || image.width) < animation.frameSize || (image.naturalHeight || image.height) < animation.frameSize) return null;
  return { image, animation, frame: 0, pose };
}

export function renderBladeRanged(context, sample) {
  return sample ? drawHarvestWork(context, sample.image, sample.animation, sample.frame, sample.pose) : false;
}
