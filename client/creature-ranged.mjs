import { imageAnimation } from "./image-geometry.mjs";
import { UNIT_IMAGE_BOUNDS } from "./unit-image-bounds.mjs";
import { unitDisplaySize } from "./unit-size.mjs";

// Approved 2026-11-06. Native cels are unchanged; registration is the exact
// inverse of the approved melee seed's lossless resize-and-padding transform.
export const CREATURE_RANGED_ANIMATIONS = Object.freeze({
  "flower-tail-bird": Object.freeze({
    image: "DesignAssets/Animations/CreatureRangedV1/flower-tail-bird/shoot.webp",
    frameSize: 512, viewSize: 500.7396226415094, columns: 4,
    pivotX: 228.86883742756186, pivotY: 422.2344753074205,
    durationsMs: Object.freeze([100,120,120,60,100,120,160,220]),
    frameCount: 8, durationMs: 1000, launchAtMs: 400, launchFrame: 4,
    outletX: 92, outletY: 234, registrationScale: 1, facing: "left", loop: false,
    idleImage: "DesignAssets/Animations/CreatureIdleV3/flower-tail-bird/idle.webp"
  }),
  "soil-mole": Object.freeze({
    image: "DesignAssets/Animations/CreatureRangedV1/soil-mole/shoot.png",
    frameSize: 512, viewSize: 445.3180212014134, columns: 4,
    pivotX: 256.16421403663, pivotY: 377.90245216117216,
    durationsMs: Object.freeze([140,110,140,160,70,100,140,180]),
    frameCount: 8, durationMs: 1040, launchAtMs: 550, launchFrame: 4,
    outletX: 99, outletY: 291, registrationScale: 1, facing: "left", loop: false,
    idleImage: "DesignAssets/Animations/CreatureIdleV3/soil-mole/idle.webp"
  })
});
export const CREATURE_RANGED_ASSETS = Object.freeze(Object.values(CREATURE_RANGED_ANIMATIONS).map(animation => animation.image));

export function creatureRangedPose(agent, time) {
  const animation = CREATURE_RANGED_ANIMATIONS[agent.species], attack = agent.attack;
  if (!animation || !(agent.health > 0) || agent.birth || !Number.isFinite(time) ||
      !attack || !(attack.dnaRanged || attack.mode === "ranged" || attack.attackMode === "ranged") ||
      !Number.isFinite(attack.startedAt) || !Number.isFinite(attack.launchedAt) ||
      !Number.isFinite(attack.endsAt) || attack.launchedAt < attack.startedAt ||
      attack.endsAt < attack.launchedAt || attack.endsAt <= attack.startedAt || time < attack.startedAt) return null;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(attack.startedAt), Math.abs(attack.endsAt)) * 4;
  if (time > attack.endsAt + epsilon) return null;
  const recorded = attack.shotLaunches;
  const launches = Array.isArray(recorded) && recorded.length && recorded[0] === attack.launchedAt &&
    recorded.every((at, index) => Number.isFinite(at) && at <= attack.endsAt + epsilon &&
      (!index || at > recorded[index - 1])) ? recorded : [attack.launchedAt];
  if (time > attack.endsAt && time !== launches.at(-1) ||
      time === attack.endsAt && Math.abs(launches.at(-1) - attack.endsAt) > epsilon) return null;
  const recoveryShare = (animation.durationMs - animation.launchAtMs) / animation.durationMs;
  const startFor = index => index ? launches[index-1] +
    (launches[index] - launches[index-1]) * recoveryShare : attack.startedAt;
  let shotIndex = 0;
  while (shotIndex < launches.length - 1 && time >= startFor(shotIndex + 1)) shotIndex++;
  const start = startFor(shotIndex), launch = launches[shotIndex];
  const end = shotIndex + 1 < launches.length ? startFor(shotIndex + 1) : attack.endsAt;
  let elapsed = time < launch ? animation.launchAtMs * (time-start) / Math.max(.001, launch-start) :
    animation.launchAtMs + (animation.durationMs-animation.launchAtMs) * (time-launch) / Math.max(.001, end-launch);
  if (Math.abs(time-launch) <= epsilon) elapsed = animation.launchAtMs;
  let frame = 0;
  while (frame < animation.frameCount-1 && elapsed >= animation.durationsMs[frame]) elapsed -= animation.durationsMs[frame++];
  return { action: "ranged", animation, frame, shotIndex, launchAt: launch,
    mirrorX: (attack.directionX || agent.facing || -1) > 0 };
}

// Offsets are in world cells relative to the same idle-normalized body pivot
// used by the world, detail and laboratory renderers. The journal owns timing.
export function creatureRangedOutlet(agent, facing = agent.attack?.directionX || agent.facing || -1) {
  const animation = CREATURE_RANGED_ANIMATIONS[agent.species];
  if (!animation) return null;
  const idle = imageAnimation({ image: animation.idleImage, frameSize: 512, viewSize: 512 });
  const bounds = UNIT_IMAGE_BOUNDS[animation.idleImage];
  const length = Math.max(bounds.width, bounds.height) * idle.frameSize / bounds.frameSize;
  const scale = unitDisplaySize(agent) * idle.viewSize /
    ((idle.registrationScale || 1) * length * animation.viewSize);
  return { x: -Math.sign(facing || -1) * (animation.outletX-animation.pivotX) * scale,
    y: (animation.outletY-animation.pivotY) * scale };
}
