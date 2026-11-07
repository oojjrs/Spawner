import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { unitDisplaySize } from "./unit-size.mjs";
import { unitActionState } from "./unit-appearance-state.mjs";
import { GATHER_WORK_ANIMATIONS } from "./gather-work-assets.mjs";

export { GATHER_WORK_ANIMATIONS };
export const GATHER_WORK_ASSETS = Object.freeze(Object.values(GATHER_WORK_ANIMATIONS).flatMap(actions => Object.values(actions).map(clip => clip.image)));

export function gatherWorkPose(agent, time) {
  if (!agent || agent.species || !Number.isFinite(time)) return null;
  const appearance = unitDisplayAttributes(agent);
  if (["blade", "secretion", "carapace", "antenna", "feet", "legs", "piercing", "guard"].some(key => appearance[key] > 0)) return null;
  const capable = agent.dna ? agent.dna.pieces?.some(piece => piece.gene === "gather") : appearance.strength > 0 || appearance.arms > 0;
  const actions = capable && GATHER_WORK_ANIMATIONS[agent.tribe || "bean"];
  if (!actions) return null;
  const state = unitActionState(agent, time, { animations: actions }), animation = state && actions[state.action];
  if (!animation) return null;
  const duration = animation.durationsMs.reduce((sum, value) => sum + value, 0);
  let elapsed = state.elapsedMs;
  if (state.action === "throw") {
    const delivery = agent.foodDelivery, span = delivery.arrivesAt - delivery.startedAt;
    if (!(span > 0) || time < delivery.startedAt || time >= delivery.arrivesAt || delivery.receivedAt != null) return null;
    const progress = (time - delivery.startedAt) / span, release = animation.releaseAtMs;
    elapsed = progress < .24 ? release * progress / .24 : release + (duration - release) * (progress - .24) / .76;
  } else elapsed %= duration;
  let index = 0;
  while (index < animation.durationsMs.length - 1 && elapsed >= animation.durationsMs[index]) elapsed -= animation.durationsMs[index++];
  return { action: state.action, animation, frame: index };
}

export function createGatherWorkAnimation(loadImage) {
  const images = new Map(), pending = new Map();
  function request(animation) {
    if (images.has(animation.image) || pending.has(animation.image)) return;
    pending.set(animation.image, Promise.resolve().then(() => loadImage(animation.image)).then(image => images.set(animation.image, image)).catch(() => {}).finally(() => pending.delete(animation.image)));
  }
  function ready(agent, time) {
    const pose = gatherWorkPose(agent, time);
    return !!pose && images.has(pose.animation.image);
  }
  function draw(context, agent, time, x, floor, cell, mirror, beforeDraw) {
    const pose = gatherWorkPose(agent, time);
    if (!pose) return false;
    request(pose.animation);
    const image = images.get(pose.animation.image);
    if (!image) return false;
    const clip = pose.animation, scale = cell * unitDisplaySize(agent) / clip.referenceLength;
    const crop = { x: pose.frame % clip.columns * clip.frameSize, y: Math.floor(pose.frame / clip.columns) * clip.frameSize, width: clip.frameSize, height: clip.frameSize };
    const destination = { x: -clip.pivotX * scale, y: -clip.pivotY * scale, width: clip.frameSize * scale, height: clip.frameSize * scale };
    context.save(); context.translate(x, floor); context.scale(mirror ? -1 : 1, 1);
    if (beforeDraw) beforeDraw(context, image, crop, destination, pose);
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, destination.x, destination.y, destination.width, destination.height);
    context.restore();
    return true;
  }
  async function prepare(tribe) {
    for (const clip of Object.values(GATHER_WORK_ANIMATIONS[tribe] || {})) request(clip);
    await Promise.all([...pending.values()]);
  }
  return { draw, ready, prepare };
}
