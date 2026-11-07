import { UNIT_ACTION_ART } from "./unit-action-art-assets.mjs";
import { unitDisplayAttributes, UNIT_DISPLAY_PRIORITY } from "./unit-display-appearance.mjs";
import { unitDisplaySize, unitFrameMirror } from "./unit-size.mjs";
import { unitActionState } from "./unit-appearance-state.mjs";

export function unitActionArtDefinition(agent) {
  if (!agent || agent.species) return null;
  const attributes = unitDisplayAttributes(agent);
  const form = UNIT_DISPLAY_PRIORITY.find(key => attributes[key] > 0) ||
    (attributes.strength > 0 || attributes.arms > 0 || agent.dna?.pieces?.some(piece => piece.gene === "gather") ? "gather" : attributes.piercing > 0 ? "secretion" : "base");
  return UNIT_ACTION_ART[(agent.tribe || agent.key || "bean") + "/" + form] || null;
}

export function unitActionArtPose(agent, time) {
  const definition = unitActionArtDefinition(agent);
  if (!definition) return null;
  const state = unitActionState(agent, time, { animations: definition.actions });
  if (!state) return null;
  const requested = state.action === "carry" && !definition.actions.carry ? "walk" : state.action;
  const animation = definition.actions[requested];
  if (!animation) return { action: state.action, animation: definition.reference, frame: definition.reference.frames?.[0] || 0, reference: definition.reference, missing: true };
  let elapsed = state.elapsedMs;
  const duration = animation.durationsMs.reduce((sum, value) => sum + value, 0);
  if (animation.loop) elapsed %= duration;
  let index = 0;
  while (index < animation.durationsMs.length - 1 && elapsed >= animation.durationsMs[index]) elapsed -= animation.durationsMs[index++];
  return { action: state.action, animation, frame: animation.frames?.[index] ?? index, reference: definition.reference, missing: false };
}

export function createUnitActionArt(assetSource, createSurface, loadImage) {
  const images = new Map(), pending = new Map(), bounds = new Map(), retryAfter = new Map();
  function request(animation) {
    if (!animation || images.has(animation.image) || pending.has(animation.image) || Date.now() < (retryAfter.get(animation.image) || 0)) return;
    pending.set(animation.image, Promise.resolve().then(() => loadImage(animation.image)).then(image => {
      images.set(animation.image, image); return image;
    }).catch(() => { retryAfter.set(animation.image, Date.now() + 1000); return null; }).finally(() => pending.delete(animation.image)));
  }
  async function prepare(agent) {
    const definition = unitActionArtDefinition(agent);
    if (!definition) return;
    for (const animation of [definition.reference, ...Object.values(definition.actions)]) request(animation);
    await Promise.all([...pending.values()]);
  }
  function referenceBounds(animation) {
    if (bounds.has(animation)) return bounds.get(animation);
    const image = images.get(animation.image);
    if (!image) return null;
    const width = animation.frameSize, height = animation.frameHeight || width, frame = animation.frames?.[0] || 0;
    const surface = createSurface(width, height), context = surface.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, frame % animation.columns * width, Math.floor(frame / animation.columns) * height, width, height, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let left = width, top = height, right = 0, bottom = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3] >= 16) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
    const result = { width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
    result.length = Math.max(result.width, result.height); bounds.set(animation, result); return result;
  }
  function draw(context, agent, time, x, floor, cell, mirror, beforeDraw) {
    let pose = unitActionArtPose(agent, time);
    if (!pose) return false;
    request(pose.reference); request(pose.animation);
    const reference = referenceBounds(pose.reference);
    if (!reference) return true;
    if (!images.has(pose.animation.image)) pose = { ...pose, animation: pose.reference, frame: pose.reference.frames?.[0] || 0 };
    const animation = pose.animation, image = images.get(animation.image), width = animation.frameSize, height = animation.frameHeight || width;
    const cameraScale = (pose.reference.viewSize || pose.reference.frameSize) / (animation.viewSize || animation.frameSize);
    const scale = cell * unitDisplaySize(agent) / (animation.referenceLength || reference.length) * (animation.referenceLength ? 1 : cameraScale);
    const crop = { x: pose.frame % animation.columns * width, y: Math.floor(pose.frame / animation.columns) * height, width, height };
    const destination = { x: -animation.pivotX * scale, y: -animation.pivotY * scale, width: width * scale, height: height * scale };
    context.save(); context.translate(x, floor); context.scale(unitFrameMirror(animation.sourceFacing, mirror ? -1 : 1) ? -1 : 1, 1);
    if (beforeDraw) beforeDraw(context, image, crop, destination);
    context.drawImage(image, crop.x, crop.y, width, height, destination.x, destination.y, destination.width, destination.height);
    context.restore(); return true;
  }
  function frame(agent, time) {
    const surface = createSurface(512, 512);
    return draw(surface.getContext("2d"), agent, time, 256, 448, 256 / unitDisplaySize(agent), false, null) ? surface : null;
  }
  return { prepare, draw, frame, referenceBounds, readyAction: (agent, time) => { const pose = unitActionArtPose(agent, time); return !!pose && !pose.missing && images.has(pose.animation.image) && images.has(pose.reference.image); }, ready: agent => {
    const definition = unitActionArtDefinition(agent); return !!definition && images.has(definition.reference.image);
  } };
}
