import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { unitDisplaySize } from "./unit-size.mjs";
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from "../server/unit-appearance.mjs";
import { BEAN_HURT_HOLD_SECONDS, BEAN_HURT_TOTAL_SECONDS, beanHeldHurtAmount } from "./bean-held-hurt.mjs";
import { SPECIES_HELD_HURT_SOURCES } from "./species-held-hurt-assets.mjs";

// Same approved visual hold as bean, with species-owned source pixels and
// material-specific motion. This never changes simulation or action clocks.
export const SPECIES_HELD_HURT_ASSETS = Object.freeze(Object.values(SPECIES_HELD_HURT_SOURCES).flatMap(forms => Object.values(forms).map(source => source.image)));
export function speciesHeldHurtSource(agent) {
  if (!agent || agent.species) return null;
  const forms = SPECIES_HELD_HURT_SOURCES[agent.tribe || agent.key];
  if (!forms) return null;
  const attributes = unitDisplayAttributes(agent);
  if (UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => attributes[key] > 0)) return null;
  const stats = agent.stats?.dna || agent.stats;
  // The shared projection chooses one current live silhouette. A missing
  // source must fall through, never silently borrow another form's body.
  const key = ["blade", "secretion", "carapace", "antenna", "feet"].find(key => attributes[key] > 0) ||
    (stats?.ranged && !stats?.melee ? "secretion" : "base");
  return forms[key] || null;
}
export function speciesHeldHurtPose(agent, time) {
  const source = speciesHeldHurtSource(agent);
  if (!source || agent.health <= 0 || agent.kind === "corpse" || agent.birth || !Number.isFinite(time) || !Number.isFinite(agent.hurtStartedAt)) return null;
  const age = time - agent.hurtStartedAt;
  if (age < 0 || age >= BEAN_HURT_TOTAL_SECONDS) return null;
  let frame = 0;
  while (frame + 1 < source.times.length && age + 1e-9 >= source.times[frame + 1]) frame++;
  return { action: "hurt", source, age, frame, amount: beanHeldHurtAmount(age), hold: age <= BEAN_HURT_HOLD_SECONDS };
}
export function drawSpeciesHeldHurt(context, agent, time, imageFor, options = {}) {
  const source = speciesHeldHurtSource(agent);
  if (!source || agent.health <= 0 || agent.kind === "corpse" || agent.birth) return false;
  const image = imageFor(source.image);
  const pose = speciesHeldHurtPose(agent, time);
  if (!pose || !image || image.complete === false || !(image.naturalWidth || image.width) || !(image.naturalHeight || image.height)) return false;
  const mirror = !!options.mirror;
  const screenSide = Number.isFinite(options.hitSide) && options.hitSide !== 0 ? Math.sign(options.hitSide) : (mirror ? -1 : 1);
  const sourceSide = screenSide * (mirror ? -1 : 1);
  const index = pose.frame + (sourceSide > 0 ? source.times.length : 0);
  const crop = { x: index % source.columns * source.frameWidth, y: Math.floor(index / source.columns) * source.frameHeight,
    width: source.frameWidth, height: source.frameHeight };
  if (crop.x + crop.width > (image.naturalWidth || image.width) || crop.y + crop.height > (image.naturalHeight || image.height)) return false;
  const scale = options.sourceScale ?? (options.cell || 1) * unitDisplaySize(agent) / source.referenceLength;
  if (!(scale > 0) || !Number.isFinite(scale)) return false;
  const destination = { x: -source.pivotX * scale, y: -source.pivotY * scale, width: source.frameWidth * scale, height: source.frameHeight * scale };
  context.save();
  try {
    context.translate(options.x || 0, options.y || 0); context.scale(mirror ? -1 : 1, 1);
    options.beforeDraw?.(context, image, crop, destination);
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, destination.x, destination.y, destination.width, destination.height);
  } finally { context.restore(); }
  return true;
}
