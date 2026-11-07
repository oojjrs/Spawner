import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { unitDisplaySize, unitFrameMirror } from "./unit-size.mjs";
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from "../server/unit-appearance.mjs";
import { BEAN_HELD_HURT_SOURCES } from "./bean-held-hurt-assets.mjs";

// Approved visual-only impact hold. The source body owns this interval while
// attack clocks, launched projectiles, movement and all combat state continue.
export const BEAN_HURT_HOLD_SECONDS = .5;
export const BEAN_HURT_TOTAL_SECONDS = .88;
export const BEAN_HELD_HURT_ASSETS = Object.freeze(Object.values(BEAN_HELD_HURT_SOURCES).map(source => source.image));

// World-only direction for an already active visual hurt. Arena positions are
// synthetic, so combat-attached actors must keep their existing facing rule.
// Frozen visible flight endpoints remain correct if either actor moves later.
export function heldHurtProjectileSide(agent, frame, time) {
  if (!agent || agent.combat || agent.birth || agent.kind === "corpse" || !(agent.health > 0) || !Number.isFinite(time) ||
      !Number.isFinite(agent.hurtStartedAt) || time < agent.hurtStartedAt || time - agent.hurtStartedAt >= BEAN_HURT_TOTAL_SECONDS) return null;
  const events = frame?.retainedEvents || [], same = (a, b) => a != null && b != null && String(a) === String(b);
  if (events.some(event => ["bleed", "area", "reflect"].includes(event.kind) && event.amount > 0 &&
    same(event.toId ?? event.targetId, agent.id) && Math.abs(event.at - agent.hurtStartedAt) < 1e-6)) return null;
  const hits = events.filter(event => ["hit", "critical", "block"].includes(event.kind) &&
    Number.isFinite(event.amount) && event.amount > 0 && same(event.targetId, agent.id) &&
    Number.isFinite(event.at) && Math.abs(event.at - agent.hurtStartedAt) < 1e-6 && event.at <= time);
  if (!hits.length) return null;
  const sides = new Set();
  for (const hit of hits) {
    // Do not discard an unidentified same-epoch strike before checking agreement.
    if (hit.mode !== "ranged" || hit.sourceId == null || hit.projectileId == null) return null;
    if (events.some(event => event.kind === "projectile-cancel" && same(event.projectileId, hit.projectileId) && event.at <= hit.at)) return null;
    const shots = events.filter(event => event.kind === "shoot" && event.mode === "ranged" &&
      same(event.projectileId, hit.projectileId) && same(event.sourceId, hit.sourceId) && same(event.targetId, agent.id) &&
      Number.isFinite(event.at) && event.at <= hit.at && Number.isFinite(event.arrivesAt) && Math.abs(event.arrivesAt - hit.at) < 1e-6);
    if (!shots.length) return null;
    for (const shot of shots) {
      if (![shot.from?.x, shot.from?.y, shot.to?.x, shot.to?.y, hit.to?.x, hit.to?.y].every(Number.isFinite) ||
          shot.to.x !== hit.to.x || shot.to.y !== hit.to.y) return null;
      const side = Math.sign(shot.from.x - shot.to.x);
      if (!side) return null; // A vertical path does not establish left/right.
      sides.add(side);
    }
  }
  // Simultaneous strikes from opposite sides have no single supported pose.
  return sides.size === 1 ? [...sides][0] : null;
}
const recovery = [[.5,1],[.66,0],[.72,-.22],[.8,.07],[.88,0]];
export function beanHeldHurtAmount(age) {
  if (!Number.isFinite(age) || age < 0 || age >= BEAN_HURT_TOTAL_SECONDS) return 0;
  if (age <= BEAN_HURT_HOLD_SECONDS) return 1;
  for (let i=1;i<recovery.length;i++) if (age <= recovery[i][0]) {
    const [a,x]=recovery[i-1],[b,y]=recovery[i],t=(age-a)/(b-a),smooth=t*t*(3-2*t);
    return x+(y-x)*smooth;
  }
  return 0;
}
export function beanHeldHurtSource(agent) {
  if (!agent || agent.species || (agent.tribe || agent.key || "bean") !== "bean") return null;
  const attributes=unitDisplayAttributes(agent);
  if (UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key=>attributes[key]>0)) return null;
  const key=["blade","secretion","carapace","antenna","feet"].find(key=>attributes[key]>0) ||
    (agent.stats?.ranged && !agent.stats?.melee ? "secretion" : "base");
  return BEAN_HELD_HURT_SOURCES[key] || null;
}
export function beanHeldHurtPose(agent,time) {
  const source=beanHeldHurtSource(agent);
  if (!source || agent.health<=0 || agent.birth || !Number.isFinite(time) || !Number.isFinite(agent.hurtStartedAt)) return null;
  const age=time-agent.hurtStartedAt;
  if (age<0 || age>=BEAN_HURT_TOTAL_SECONDS) return null;
  let frame=0;
  while (frame+1<source.times.length && age+1e-9>=source.times[frame+1]) frame++;
  return {action:"hurt",source,age,frame,amount:beanHeldHurtAmount(age),hold:age<=BEAN_HURT_HOLD_SECONDS};
}

// Mirror the pose relative to the current facing, preserving the source's own
// asymmetric organs. Native atlas has both struck sides, not mirrored artwork.
// hitSide is the incoming source's side (-1 left/+1 right), when it is known.
export function drawBeanHeldHurt(context,agent,time,imageFor,options={}) {
  const source=beanHeldHurtSource(agent);
  if (!source || agent.health<=0 || agent.birth) return false;
  const image=imageFor(source.image); // Preload on the normal living draw path.
  const pose=beanHeldHurtPose(agent,time);
  if (!pose || !image || image.complete===false || !(image.naturalWidth || image.width) || !(image.naturalHeight || image.height)) return false;
  const mirror=unitFrameMirror(source.sourceFacing, options.mirror ? -1 : 1);
  const screenSide=Number.isFinite(options.hitSide) && options.hitSide!==0 ? Math.sign(options.hitSide) : (options.mirror?-1:1);
  const sourceSide=screenSide*(mirror?-1:1);
  const index=pose.frame+(sourceSide>0?source.times.length:0);
  const crop={x:index%source.columns*source.frameWidth,y:Math.floor(index/source.columns)*source.frameHeight,width:source.frameWidth,height:source.frameHeight};
  if (crop.x+crop.width>(image.naturalWidth || image.width) || crop.y+crop.height>(image.naturalHeight || image.height)) return false;
  const scale=options.sourceScale ?? (options.cell || 1)*unitDisplaySize(agent)/source.referenceLength;
  if (!(scale>0) || !Number.isFinite(scale)) return false;
  const sx=options.sourceScaleX ?? scale,sy=options.sourceScaleY ?? scale;
  if (!(sx>0) || !(sy>0) || !Number.isFinite(sx) || !Number.isFinite(sy)) return false;
  const px=source.pivotX+(options.nativePivotX===undefined?0:options.nativePivotX-256);
  const nativeY=source.worldScale==="composed"?481.28:448;
  const py=source.pivotY+(options.nativePivotY===undefined?0:options.nativePivotY-nativeY);
  const destination={x:-px*sx,y:-py*sy,width:source.frameWidth*sx,height:source.frameHeight*sy};
  context.save();
  try {
    context.translate(options.x || 0,options.y || 0);context.scale(mirror?-1:1,1);
    options.beforeDraw?.(context,image,crop,destination);
    context.drawImage(image,crop.x,crop.y,crop.width,crop.height,destination.x,destination.y,destination.width,destination.height);
  } finally { context.restore(); }
  return true;
}
