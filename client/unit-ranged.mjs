import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { UNIT_RANGED_ASSETS } from "./unit-ranged-assets.mjs";
import { unitDisplaySize } from "./unit-size.mjs";

const root = "DesignAssets/Animations/UnitRangedV1/bean/";
export const UNIT_RANGED_FORMS = Object.freeze({ ...UNIT_RANGED_ASSETS, bean: Object.freeze({
  idle: { image: root + "Source/neutral.png", frameSize: 512, viewSize: 512, columns: 1,
    pivotX: 256, pivotY: 448, frameCount: 1, durationMs: 600, durationsMs: [600], loop: true, rangedBody: true },
  animation: { image: root + "shoot.webp", frameSize: 512, viewSize: 512, columns: 6,
    pivotX: 256, pivotY: 448, frameCount: 24, durationMs: 600, durationsMs: Array(24).fill(25),
    loop: false, launchAtMs: 200, rangedBody: true },
  reference: { width: 202, height: 206 },
  projectile: { image: root + "projectile.png", width: 62, height: 36, outletX: 368, outletY: 322 }
}) });
export const UNIT_RANGED_IMAGE_ASSETS = Object.freeze([...new Set(Object.values(UNIT_RANGED_FORMS).flatMap(form => [form.idle.image, form.animation.image, form.projectile.image]))]);
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
    Number.isFinite(attack.endsAt) && attack.endsAt > launch ? { attack, launch } : null;
}

export function unitRangedPose(agent, time) {
  const appearance = unitRangedAppearance(agent);
  if (!appearance || agent.health <= 0) return null;
  const active = unitRangedAttack(agent), animation = appearance.animation;
  if (!active || time < active.attack.startedAt || time >= active.attack.endsAt)
    return { action: "idle", animation: appearance.idle, frame: 0, mirrorX: agent.facing < 0 };
  const launchAt = animation.launchAtMs;
  let elapsed = time < active.launch ? launchAt * (time - active.attack.startedAt) / Math.max(.001, active.launch - active.attack.startedAt) :
    launchAt + (animation.durationMs - launchAt) * (time - active.launch) / Math.max(.001, active.attack.endsAt - active.launch);
  let frame = 0;
  while (frame < animation.frameCount - 1 && elapsed >= animation.durationsMs[frame]) elapsed -= animation.durationsMs[frame++];
  return { action: "shoot", animation, frame, mirrorX: (active.attack.directionX || agent.facing) < 0 };
}

export function unitRangedDisplaySize(agent) {
  const form = unitRangedAppearance(agent);
  return form ? 100 * unitDisplaySize({ ...agent, tribe: agent.tribe || agent.key }) * form.animation.frameSize / Math.max(form.reference.width, form.reference.height) : null;
}

export function unitRangedProjectile(agent) {
  const form = unitRangedAppearance(agent);
  return form ? { ...form.projectile, sourceScale: 100 * unitDisplaySize({ ...agent, tribe: agent.tribe || agent.key }) / Math.max(form.reference.width, form.reference.height) } : null;
}
