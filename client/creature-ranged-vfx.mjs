// Approved 2026-11-06. Artwork only: the journal remains the owner of launch,
// arrival, cancellation, damage and defense. Native cells face left.
const root = "DesignAssets/Animations/CreatureRangedV1/";
export const CREATURE_RANGED_EFFECTS = Object.freeze({
  "spiny-back-beetle": Object.freeze({ image: root + "spiny-back-beetle/effects.png",
    frames: [2,3,4,5], durations: [80,80,80,80], flightScale: .60, impactScale: .75,
    flightAnchor: [133/512,268/512], impactAnchors: [[244,272],[170,258],[170,258],[170,258]] }),
  "spiny-back-leader": Object.freeze({ image: root + "spiny-back-leader/effects.png",
    frames: [2,3,4,5], durations: [80,80,80,80], flightScale: .60, impactScale: .84,
    flightAnchor: [62/512,245.5/512], impactAnchors: [[252,264],[128,255],[128,255],[128,255]] })
});
export const CREATURE_RANGED_EFFECT_ASSETS = Object.freeze(Object.values(CREATURE_RANGED_EFFECTS).map(effect => effect.image));

// x/y identify the physical projectile tip, mouth or contact, not the image's
// bounding centre. Rotating around that point preserves both facing directions.
export function creatureRangedEffectCommand(effect, kind, { x, y, size, angle = 0, age = 0, muzzle }) {
  if (!effect || !Number.isFinite(age) || age < 0) return null;
  let frame, anchor;
  if (kind === "flight") { frame = 0; anchor = effect.flightAnchor; size *= effect.flightScale; }
  else if (kind === "release") { if (age >= .1) return null; frame = 1; anchor = [432/512,.5]; size *= .45; }
  else if (kind === "impact") {
    const index = Math.floor(age * 1000 / 80);
    if (index >= effect.frames.length) return null;
    frame = effect.frames[index]; anchor = effect.impactAnchors[index].map(v => v/512); size *= effect.impactScale;
  } else return null;
  const rotation = angle + Math.PI, dx = (anchor[0]-.5)*size, dy = (anchor[1]-.5)*size;
  return { image: effect.image, frame, x: x - Math.cos(rotation)*dx + Math.sin(rotation)*dy,
    y: y - Math.sin(rotation)*dx - Math.cos(rotation)*dy, size, angle: rotation, kind,
    ...(kind === "flight" ? { headX: x, headY: y, pathAngle: angle, ...(muzzle ? { muzzleClip: { ...muzzle, angle } } : {}) } : { contactX: x, contactY: y }) };
}
