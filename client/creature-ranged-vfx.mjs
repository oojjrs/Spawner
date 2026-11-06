import { CREATURE_RANGED_ANIMATIONS, creatureRangedPose } from "./creature-ranged.mjs";
import { imageAnimation } from "./image-geometry.mjs";
import { UNIT_IMAGE_BOUNDS } from "./unit-image-bounds.mjs";
import { unitDisplaySize } from "./unit-size.mjs";

// Width of the original 512px canvas, not its opaque bounding box.
export function creatureRangedBodyCanvas(agent) {
  const animation = CREATURE_RANGED_ANIMATIONS[agent?.species];
  if (!animation) return 0;
  const idle = imageAnimation({ image: animation.idleImage, frameSize: 512, viewSize: 512 });
  const bounds = UNIT_IMAGE_BOUNDS[animation.idleImage];
  const length = Math.max(bounds.width, bounds.height) * idle.frameSize / bounds.frameSize;
  return 512 * unitDisplaySize(agent) * idle.viewSize /
    ((idle.registrationScale || 1) * length * animation.viewSize);
}
export function creatureRangedFlightPoint(effect, start, end, progress, bodyCanvas) {
  const u = Math.max(0, Math.min(1, progress)), h = (effect?.arcScale || 0) * bodyCanvas;
  const dx = end.x-start.x, dy = end.y-start.y;
  return { x: start.x+dx*u, y: start.y+dy*u-4*h*u*(1-u), angle: Math.atan2(dy-4*h*(1-2*u),dx) };
}
// Approved 2026-11-06. Artwork only: the journal remains the owner of launch,
// arrival, cancellation, damage and defense. Native cells face left.
const root = "DesignAssets/Animations/CreatureRangedV1/";
export const CREATURE_RANGED_EFFECTS = Object.freeze({
  "lantern-keeper": Object.freeze({ image: root + "lantern-keeper/projectile-atlas.webp", bodyCanvas: true,
    stages: Object.freeze({
      flight: { image: root + "lantern-keeper/projectile-atlas.webp", frameWidth: 384, frameHeight: 192, columns: 4, count: 12, step: 32, anchor: [286/384,.5] },
      charge: { image: root + "lantern-keeper/charge-atlas.webp", frameWidth: 192, frameHeight: 192, columns: 4, count: 12, step: 25, anchor: [.5,.5] },
      release: { image: root + "lantern-keeper/muzzle-atlas.webp", frameWidth: 256, frameHeight: 256, columns: 4, count: 12, step: 15, anchor: [.5,.5] },
      impact: { image: root + "lantern-keeper/impact-atlas.webp", frameWidth: 320, frameHeight: 320, columns: 6, count: 24, step: 20, anchor: [.5,.5] }
    }), frames: Array.from({ length: 23 }, (_, i) => i), durations: Array(23).fill(20),
    flightAnchor: [286/384,.5], impactDuration: .46 }),
  "bubble-toad": Object.freeze({ image: root + "bubble-toad/effects.webp", bodyCanvas: true,
    frames: [4,5,6,7], durations: [70,100,140,170], flightScale: 180/512, impactScale: 250/512,
    arcScale: 112/512, flightAnchor: [218/512,.5], flightFrames: 4, impactDuration: .48 }),
  "vine-turtle": Object.freeze({ image: root + "vine-turtle/projectile.png", bodyCanvas: true,
    frames: [], durations: [], flightScale: 125/512, flightAnchor: [.35,.5], columns: 1, aspect: 139/512 }),
  "spiny-back-beetle": Object.freeze({ image: root + "spiny-back-beetle/effects.png",
    frames: [2,3,4,5], durations: [80,80,80,80], flightScale: .60, impactScale: .75,
    flightAnchor: [133/512,268/512], impactAnchors: [[244,272],[170,258],[170,258],[170,258]] }),
  "spiny-back-leader": Object.freeze({ image: root + "spiny-back-leader/effects.png",
    frames: [2,3,4,5], durations: [80,80,80,80], flightScale: .60, impactScale: .84,
    flightAnchor: [62/512,245.5/512], impactAnchors: [[252,264],[128,255],[128,255],[128,255]] })
});
export const CREATURE_RANGED_EFFECT_ASSETS = Object.freeze([...new Set(Object.values(CREATURE_RANGED_EFFECTS).flatMap(effect => effect.stages ? Object.values(effect.stages).map(stage => stage.image) : [effect.image]))]);

// x/y identify the physical projectile tip, mouth or contact, not the image's
// bounding centre. Rotating around that point preserves both facing directions.
export function creatureRangedEffectCommand(effect, kind, { x, y, size, angle = 0, age = 0, muzzle }) {
  if (!effect || !Number.isFinite(age) || age < 0) return null;
  if (effect.stages) {
    const stage = effect.stages[kind], milliseconds = age * 1000;
    if (!stage || kind !== "flight" && milliseconds >= (kind === "impact" ? 460 : stage.count * stage.step)) return null;
    const frame = Math.floor((milliseconds + 1e-9) / stage.step) % stage.count;
    const ease = kind === "flight" ? 1 - (1 - Math.min(1, milliseconds / 55)) ** 3 : 1;
    const scale = size / 512 * (kind === "flight" ? .35 + .65 * ease : 1);
    const width = stage.frameWidth * scale, height = stage.frameHeight * scale;
    const rotation = kind === "impact" || kind === "charge" ? 0 : angle;
    const dx = (stage.anchor[0] - .5) * width, dy = (stage.anchor[1] - .5) * height;
    return { image: stage.image, frame, frameWidth: stage.frameWidth, frameHeight: stage.frameHeight,
      columns: stage.columns, x: x - Math.cos(rotation)*dx + Math.sin(rotation)*dy,
      y: y - Math.sin(rotation)*dx - Math.cos(rotation)*dy, size: width, width, height,
      alpha: ease, angle: rotation, kind,
      ...(kind === "flight" ? { headX: x, headY: y, pathAngle: angle } : { contactX: x, contactY: y }) };
  }
  let frame, anchor, alpha = 1, scaleX = 1, scaleY = effect.aspect || 1;
  if (kind === "flight") {
    frame = effect.flightFrames ? Math.floor(age*1000/70)%effect.flightFrames : 0;
    anchor = effect.flightAnchor; size *= effect.flightScale;
    if (effect.flightFrames) {
      const ease = 1-Math.pow(1-Math.min(1,age/.09),3);
      scaleX = .55+.45*ease; scaleY = .72+.28*ease;
    }
  }
  else if (kind === "release") {
    if (effect.bodyCanvas || age >= .1) return null;
    frame = 1; anchor = [432/512,.5]; size *= .45;
  }
  else if (kind === "impact") {
    let milliseconds = age*1000, index = 0;
    while (index < effect.durations.length && milliseconds >= effect.durations[index]) milliseconds -= effect.durations[index++];
    if (index >= effect.frames.length) return null;
    frame = effect.frames[index]; anchor = effect.impactAnchors?.[index].map(v => v/512) || [.5,.5]; size *= effect.impactScale;
    if (effect.flightFrames) { angle = -Math.PI; if (index === 3) alpha = 1-milliseconds/170; }
  } else return null;
  const width = size*scaleX, height = size*scaleY;
  const rotation = angle + Math.PI, dx = (anchor[0]-.5)*width, dy = (anchor[1]-.5)*height;
  return { image: effect.image, frame, x: x - Math.cos(rotation)*dx + Math.sin(rotation)*dy,
    y: y - Math.sin(rotation)*dx - Math.cos(rotation)*dy, size, width, height, columns: effect.columns || 4, alpha, angle: rotation, kind,
    ...(kind === "flight" ? { headX: x, headY: y, pathAngle: angle, ...(muzzle && !effect.arcScale ? { muzzleClip: { ...muzzle, angle } } : {}) } : { contactX: x, contactY: y }) };
}

// The moving ear midpoint is measured in the approved original body cells.
// Derive charge progress from the same per-shot body timeline, never spawn a shot.
export function creatureRangedChargeCommand(agent, time, { x, y, cell = 1 }) {
  const effect = CREATURE_RANGED_EFFECTS[agent?.species];
  if (!effect?.stages?.charge) return null;
  const pose = creatureRangedPose(agent, time);
  if (!pose || time >= pose.launchAt) return null;
  const attack = agent.attack, animation = pose.animation;
  const previous = pose.shotIndex ? attack.shotLaunches[pose.shotIndex - 1] : null;
  const start = previous === null ? attack.startedAt : previous +
    (pose.launchAt - previous) * (animation.durationMs - animation.launchAtMs) / animation.durationMs;
  const elapsed = animation.launchAtMs * (time - start) / Math.max(.001, pose.launchAt - start);
  if (elapsed < 120) return null;
  const points = [[123,165],[85,292],[75,309],[53,304],[80,236],[80,236],[80,236],[80,236]];
  const point = points[pose.frame], size = creatureRangedBodyCanvas(agent) * cell;
  const command = creatureRangedEffectCommand(effect, "charge", {
    x: x + (pose.mirrorX ? -1 : 1) * (point[0] - animation.pivotX) * size / 512,
    y: y + (point[1] - animation.pivotY) * size / 512, size, age: (elapsed - 120) / 1000 });
  return command && { ...command, mirrorX: pose.mirrorX, sourceId: agent.id, shotIndex: pose.shotIndex, launchedAt: pose.launchAt };
}
