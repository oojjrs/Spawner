import { UNIT_ANIMATIONS, unitAnimationPose, unitAnimationFrame, unitMovementElapsedMs } from "./unit-animation.mjs";

// Source-owned surfaces share one gait-transfer recipe. These are individual
// action clips, not a claim that a complete dominant-form world rig is ready.
export const UNIT_SECRETION_WALK_ANIMATIONS = Object.freeze(Object.fromEntries(
  ["bean", "spore", "pebble", "spring"].map(tribe => {
    const base = UNIT_ANIMATIONS[tribe].walk;
    const durationsMs = Object.freeze(base ? [...base.durationsMs] : Array(24).fill(40));
    return [tribe, Object.freeze({
      image: `DesignAssets/Animations/UnitRangedV1/${tribe}/walk.webp`,
      frameSize: 512, viewSize: 512, pivotX: 256, pivotY: 448, columns: 4,
      frameCount: durationsMs.length, durationsMs,
      durationMs: durationsMs.reduce((sum, duration) => sum + duration, 0),
      cyclesPerCell: base?.cyclesPerCell || 1, loop: true, rangedBody: true
    })];
  })
));

export function unitSecretionWalkPose(agent, time, appearance) {
  const animation = UNIT_SECRETION_WALK_ANIMATIONS[agent.tribe || agent.key || "bean"];
  const elapsed = time - agent.moveStartedAt;
  if (!animation || appearance?.walk !== animation || agent.species || agent.birth || !(agent.health > 0) ||
      !Number.isFinite(time) || !(agent.moveDuration > 0) || !Number.isFinite(agent.moveDuration) || !Number.isFinite(elapsed) ||
      elapsed < 0 || time >= agent.moveStartedAt + agent.moveDuration || ["harvest", "unload", "jump"].includes(agent.mode)) return null;
  // The parent ranged resolver has already handled shoot/hurt precedence. Also
  // retain any other active body action rather than hiding it with locomotion.
  const body = unitAnimationPose(agent, time);
  if (body && body.action !== "walk") return null;
  return { action: "walk", animation,
    frame: unitAnimationFrame(animation, unitMovementElapsedMs(agent, time)),
    mirrorX: agent.facing < 0 };
}
