import { unitAnimationPose } from "./unit-animation.mjs";
import { workTriangles } from "./dominant-resource-motion.mjs";

// Body-only work/delivery cues. The host alone owns resources, cargo, the
// 24%-of-delivery release, flight, yield, sound and deposit events.
const profiles = Object.freeze({ bean: [.12, .10], spore: [.15, .09], pebble: [.065, .08], spring: [.14, .11] });
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };

export function secretionResourceMotion(tribe, action, clock) {
  const profile = profiles[tribe];
  if (!profile || !Number.isFinite(clock) || clock < 0) return null;
  if (action === "harvest") {
    const elapsed = Math.floor((clock + 1e-7) / 20) * 20;
    const cycle = elapsed % 720, phase = cycle / 720 * Math.PI * 2, entry = smooth(elapsed / 120);
    const press = (1 - Math.cos(phase)) * .5 * entry;
    return { tribe, action, time: elapsed, compression: press * profile[0], sweep: Math.sin(phase) * entry * profile[1],
      key: `harvest:${elapsed < 120 ? "entry" : "loop"}:${cycle}` };
  }
  if (action !== "throw" || clock > 1) return null;
  // Normalize to the real delivery interval, never to an assumed one second.
  const progress = Math.floor((clock + 1e-9) * 50) / 50;
  let compression = 0, sweep = 0;
  if (progress < .16) { const p = smooth(progress / .16); compression = .045 * p; sweep = -.05 * p; }
  else if (progress < .24) { const p = smooth((progress - .16) / .08); compression = .045 - .085 * p; sweep = -.05 + .15 * p; }
  else { const settle = 1 - smooth((progress - .24) / .42); compression = -.04 * settle; sweep = .10 * settle; }
  const strength = tribe === "pebble" ? .7 : 1;
  return { tribe, action, time: progress, progress, releaseProgress: .24,
    compression: compression * strength || 0, sweep: sweep * strength || 0, key: `throw:${progress}` };
}

export function unitSecretionResourcePose(agent, time, appearance) {
  const tribe = agent.tribe || agent.key || "bean", animation = appearance?.idle;
  if (!profiles[tribe] || !animation || animation.image !== `DesignAssets/Animations/UnitRangedV1/${tribe}/Source/neutral.png` && !animation.nativeSecretionIdle ||
      agent.species || agent.birth || !(agent.health > 0) || !Number.isFinite(time) ||
      agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration) return null;
  const body = unitAnimationPose(agent, time);
  if (body && !["idle", "harvest", "throw"].includes(body.action)) return null;
  let action, clock;
  if (agent.mode === "harvest") {
    action = "harvest"; clock = (time - agent.harvestStarted) * 1000;
  } else if (agent.mode === "unload") {
    const delivery = agent.foodDelivery;
    if (!delivery || !(delivery.amount > 0) || !Number.isFinite(delivery.startedAt) ||
        !Number.isFinite(delivery.arrivesAt) || !(delivery.arrivesAt > delivery.startedAt) ||
        time < delivery.startedAt) return null;
    // Extrapolated display time may reach arrival before the next snapshot
    // changes mode. Stay on the same neutral source, without replaying throw.
    if (time >= delivery.arrivesAt || delivery.receivedAt != null)
      return { action: "idle", animation, frame: 0, mirrorX: agent.facing < 0, resourceRest: true };
    action = "throw"; clock = (time - delivery.startedAt) / (delivery.arrivesAt - delivery.startedAt);
  } else return null;
  const resource = secretionResourceMotion(tribe, action, clock);
  return resource ? { action, animation, frame: 0, mirrorX: agent.facing < 0, resource } : null;
}

// Cache by source object, so failed loads/replacements never poison the next
// frame. Bound each form to eight frames (8 MiB) rather than an unbounded clock.
const frames = new WeakMap();
function drawResourceBody(context, image, motion) {
  const triangles = workTriangles(motion);
  if (!triangles) return false;
  for (const { uv: [a, b, c], points } of triangles) {
    const [p, q, r] = points, determinant = (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
    const xx = ((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/determinant;
    const xy = ((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/determinant;
    const yx = ((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/determinant;
    const yy = ((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/determinant;
    context.save();
    try {
      context.beginPath();
      // Pad by perpendicular edge distance. Radial vertex padding underfills
      // the short sides of a 512-by-16 strip, leaving antialiased scan lines.
      points.forEach((v, index) => {
        const previous = points[(index+2)%3], next = points[(index+1)%3];
        const edgeA = [v[0]-previous[0], v[1]-previous[1]], edgeB = [next[0]-v[0], next[1]-v[1]];
        const lengthA = Math.hypot(...edgeA), lengthB = Math.hypot(...edgeB);
        const normalA = [edgeA[1]/lengthA, -edgeA[0]/lengthA], normalB = [edgeB[1]/lengthB, -edgeB[0]/lengthB];
        const factor = .75 / (1 + normalA[0]*normalB[0] + normalA[1]*normalB[1]);
        const x = v[0] + (normalA[0]+normalB[0])*factor;
        const y = Math.min(432, v[1] + (normalA[1]+normalB[1])*factor);
        if (index) context.lineTo(x,y); else context.moveTo(x,y);
      });
      context.closePath(); context.clip();
      context.transform(xx,yx,xy,yy,p[0]-xx*a[0]-xy*a[1],p[1]-yx*a[0]-yy*a[1]);
      context.drawImage(image,0,0,512,512);
    } finally { context.restore(); }
  }
  context.save();
  try { context.beginPath(); context.rect(0,432,512,80); context.clip(); context.drawImage(image,0,0,512,512); }
  finally { context.restore(); }
  return true;
}

export function secretionResourceFrame(image, pose, createSurface, reducedMotion = false) {
  const size = image?.naturalWidth || image?.width;
  if (!pose?.resource || !image || image.complete === false || !Number.isInteger(size) || size <= 0 ||
      size !== (image.naturalHeight || image.height) || size !== 512 && !pose.animation?.nativeSecretionIdle) return null;
  if (reducedMotion || !pose.resource.compression && !pose.resource.sweep) return image;
  let cache = frames.get(image);
  if (!cache) frames.set(image, cache = new Map());
  if (cache.has(pose.resource.key)) return cache.get(pose.resource.key);
  try {
    const surface = createSurface(size, size), context = surface?.getContext("2d");
    if (!context) return null;
    context.scale(size / 512, size / 512);
    if (!drawResourceBody(context, image, pose.resource)) return null;
    cache.set(pose.resource.key, surface);
    if (cache.size > 8) cache.delete(cache.keys().next().value);
    return surface;
  } catch { return null; }
}
