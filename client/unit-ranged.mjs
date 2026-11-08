import { UNIT_SECRETION_IDLE_ASSETS, unitSecretionIdlePose } from "./secretion-idle.mjs";
import { BEAN_SECRETION_IDLE_ANIMATION } from "./bean-secretion-idle-assets.mjs";
import { drawBeanSecretionBirth } from "./bean-secretion-birth.mjs";
import { UNIT_SECRETION_WALK_ANIMATIONS, unitSecretionWalkPose } from "./secretion-walk.mjs";
import { UNIT_SECRETION_LIFECYCLE_ANIMATIONS, UNIT_SECRETION_LIFECYCLE_ASSETS } from "./secretion-lifecycle.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { UNIT_RANGED_ASSETS } from "./unit-ranged-assets.mjs";
import { unitDisplaySize, unitFrameMirror, unitFacing } from "./unit-size.mjs";
import { unitSecretionResourcePose, secretionResourceFrame } from "./secretion-resource-motion.mjs";

const root = "DesignAssets/Animations/UnitRangedV1/bean/";
// Source-owned deformation preserves each approved secretion silhouette during
// hurt. These clips do not register a complete world-ready action set.
export const UNIT_RANGED_HURT_ANIMATIONS = Object.freeze(Object.fromEntries(
  ["bean", "spore", "pebble", "spring"].map(tribe => [tribe, Object.freeze({
    image: "DesignAssets/Animations/UnitRangedV1/" + tribe + "/hurt.png", frameSize: 512, viewSize: 512, columns: 4,
    pivotX: 256, pivotY: 448, frameCount: 16, durationMs: 760,
    ...(["bean", "spore", "pebble"].includes(tribe) ? { sourceFacing: "left" } : {}),
    durationsMs: [20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20], loop: false, rangedBody: true
  })])));
export const UNIT_RANGED_FORMS = Object.freeze({
  ...Object.fromEntries(Object.entries(UNIT_RANGED_ASSETS).map(([tribe, form]) =>
    [tribe, Object.freeze({ ...form, hurt: UNIT_RANGED_HURT_ANIMATIONS[tribe], walk: UNIT_SECRETION_WALK_ANIMATIONS[tribe],
      lifecycle: UNIT_SECRETION_LIFECYCLE_ANIMATIONS[tribe] || null })])),
  bean: Object.freeze({ idleAnimation: BEAN_SECRETION_IDLE_ANIMATION, birthBody: drawBeanSecretionBirth, lifecycle: UNIT_SECRETION_LIFECYCLE_ANIMATIONS.bean, hurt: UNIT_RANGED_HURT_ANIMATIONS.bean, walk: UNIT_SECRETION_WALK_ANIMATIONS.bean,
  idle: { image: root + "Source/neutral.png", sourceFacing: "left", frameSize: 512, viewSize: 512, columns: 1,
    pivotX: 256, pivotY: 448, frameCount: 1, durationMs: 600, durationsMs: [600], loop: true, rangedBody: true },
  animation: { image: root + "shoot.webp", sourceFacing: "left", frameSize: 512, viewSize: 512, columns: 6,
    pivotX: 256, pivotY: 448, frameCount: 24, durationMs: 600, durationsMs: Array(24).fill(25),
    loop: false, launchAtMs: 200, rangedBody: true },
  reference: { width: 202, height: 206 },
  projectile: { image: root + "projectile.png", width: 62, height: 36, outletX: 368, outletY: 322 }
}) });
export const UNIT_RANGED_IMAGE_ASSETS = Object.freeze([...new Set([...UNIT_SECRETION_IDLE_ASSETS, ...UNIT_SECRETION_LIFECYCLE_ASSETS, ...Object.values(UNIT_RANGED_FORMS).flatMap(form => [form.idle.image, form.animation.image, form.projectile.image, ...(form.hurt ? [form.hurt.image] : []), ...(form.walk ? [form.walk.image] : [])])])]);
export const UNIT_RANGED_ANIMATIONS = Object.freeze(Object.fromEntries(Object.entries(UNIT_RANGED_FORMS).map(([key, form]) => [key, form.animation])));

export function unitRangedAppearance(agent) {
  const form = UNIT_RANGED_FORMS[agent.tribe || agent.key || "bean"];
  if (agent.species || !form) return null;
  const stats = agent.stats?.dna || agent.stats;
  const attributes = unitDisplayAttributes(agent);
  // Current DNA selects the secretion silhouette even when lower-priority
  // traits are mechanically present. Stat-only legacy fixtures retain support.
  if (!(attributes.secretion > 0) && (!stats?.ranged || stats.melee)) return null;
  if (["blade", "carapace", "antenna", "feet", "strength", "arms"].some(key => attributes[key] > 0)) return null;
  return form;
}

export function unitRangedAttack(agent) {
  if (!unitRangedAppearance(agent) || agent.health <= 0) return null;
  const attack = agent.attack;
  if (!attack || !(attack.dnaRanged || attack.mode === "ranged" || attack.attackMode === "ranged")) return null;
  const launch = Number.isFinite(attack.launchedAt) ? attack.launchedAt : attack.hitAt;
  return Number.isFinite(attack.startedAt) && Number.isFinite(launch) && launch >= attack.startedAt &&
    Number.isFinite(attack.endsAt) && attack.endsAt >= launch && attack.endsAt > attack.startedAt ? { attack, launch } : null;
}

// Bean birth reuses its own source at the exact idle registration, while the
// existing scene still owns the seed, root trajectory, impacts and body keys.
export function unitRangedBirthAppearance(agent) {
  const form = unitRangedAppearance(agent);
  return form?.birthBody && agent.health > 0 && agent.birth ? form : null;
}

export function unitRangedLifecycleAnimation(agent, action) {
  if (!unitRangedAppearance(agent) || action === "birth" && (!(agent.health > 0) || !agent.birth) ||
      action === "death" && !(agent.health <= 0 || agent.kind === "corpse")) return null;
  return UNIT_SECRETION_LIFECYCLE_ANIMATIONS[agent.tribe || agent.key || "bean"]?.[action] || null;
}

function unitRangedAttackOrIdlePose(agent, time) {
  const appearance = unitRangedAppearance(agent);
  if (!appearance || agent.health <= 0) return null;
  const active = unitRangedAttack(agent), animation = appearance.animation;
  const idle = () => ({ action: "idle", animation: appearance.idle, frame: 0, mirrorX: unitFrameMirror(appearance.idle.sourceFacing, unitFacing(agent)) });
  if (!active || !Number.isFinite(time) || time < active.attack.startedAt) return idle();
  // The world computes readyAt and the final launch with differently grouped
  // additions. Permit only floating-point roundoff, not a delayed recovery.
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(active.attack.startedAt), Math.abs(active.attack.endsAt)) * 4;
  if (time > active.attack.endsAt + epsilon) return idle();
  const launchAt = animation.launchAtMs;
  // One approved shoot clip per actual server launch. Do not infer extra shots
  // from current stats or the transient projectile list (both may change).
  const recorded = active.attack.shotLaunches;
  const launches = Array.isArray(recorded) && recorded.length && recorded[0] === active.launch &&
    recorded.every((at, index) => Number.isFinite(at) && at <= active.attack.endsAt + epsilon &&
      (!index || at > recorded[index - 1])) ? recorded : [active.launch];
  // A fast world combo can end exactly at its last launch. Keep its earlier
  // shot clocks valid and show that final release only while its exact snapshot
  // still exists. Never hold/replay the shot after the action ends or is cleared.
  if (time > active.attack.endsAt && time !== launches.at(-1) ||
      time === active.attack.endsAt && Math.abs(launches.at(-1) - active.attack.endsAt) > epsilon) return idle();
  const recoveryShare = (animation.durationMs - launchAt) / animation.durationMs;
  const startFor = index => index ? launches[index - 1] +
    (launches[index] - launches[index - 1]) * recoveryShare : active.attack.startedAt;
  let shot = 0;
  while (shot < launches.length - 1 && time >= startFor(shot + 1)) shot++;
  const start = startFor(shot), launch = launches[shot];
  const end = shot + 1 < launches.length ? startFor(shot + 1) : active.attack.endsAt;
  let elapsed = time < launch ? launchAt * (time - start) / Math.max(.001, launch - start) :
    launchAt + (animation.durationMs - launchAt) * (time - launch) / Math.max(.001, end - launch);
  if (Math.abs(time - launch) <= epsilon) elapsed = launchAt;
  let frame = 0;
  while (frame < animation.frameCount - 1 && elapsed >= animation.durationsMs[frame]) elapsed -= animation.durationsMs[frame++];
  return { action: "shoot", animation, frame, mirrorX: unitFrameMirror(animation.sourceFacing, active.attack.directionX || unitFacing(agent)) };
}

function unitRangedCombatPose(agent, time) {
  const pose = unitRangedAttackOrIdlePose(agent, time);
  if (!pose) return null;
  const animation = unitRangedAppearance(agent).hurt;
  const rpg = agent.combat?.version === 2;
  // Follow the existing hurt clock and attack precedence. Rendering never
  // interrupts a server shot, emits another event, or changes recovery time.
  if (!animation || agent.birth || !Number.isFinite(time) || !Number.isFinite(agent.hurtStartedAt) ||
      rpg && pose.action === "shoot") return pose;
  const age = time - agent.hurtStartedAt, duration = rpg ? .12 : animation.durationMs / 1000;
  if (age < 0 || age >= duration) return pose;
  let elapsed = age / duration * animation.durationMs, frame = 0;
  while (frame < animation.frameCount - 1 && elapsed >= animation.durationsMs[frame]) elapsed -= animation.durationsMs[frame++];
  return { action: "hurt", animation, frame, mirrorX: unitFrameMirror(animation.sourceFacing, unitFacing(agent)) };
}

export function unitRangedPose(agent, time) {
  const pose = unitRangedCombatPose(agent, time);
  const appearance = pose?.action === "idle" && unitRangedAppearance(agent);
  return appearance ? unitSecretionResourcePose(agent, time, appearance) || unitSecretionWalkPose(agent, time, appearance) || unitSecretionIdlePose(agent, time, appearance) || pose : pose;
}

export function unitRangedResourceFrame(image, pose, createSurface, reducedMotion = false) {
  return secretionResourceFrame(image, pose, createSurface, reducedMotion);
}

export function unitRangedDisplaySize(agent) {
  const form = unitRangedAppearance(agent);
  return form ? 100 * unitDisplaySize({ ...agent, tribe: agent.tribe || agent.key }) * form.animation.frameSize / Math.max(form.reference.width, form.reference.height) : null;
}

export function unitRangedProjectile(agent) {
  const form = unitRangedAppearance(agent);
  return form ? { ...form.projectile, sourceScale: 100 * unitDisplaySize({ ...agent, tribe: agent.tribe || agent.key }) / Math.max(form.reference.width, form.reference.height) } : null;
}
