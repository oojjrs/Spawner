import { drawUnitLoading } from "./unit-loading.mjs";
import { UNIT_ACTION_ART } from "./unit-action-art-assets.mjs";
import { UNIT_BIRTH_ART } from "./unit-birth-art-assets.mjs";
import { unitDisplayAttributes, UNIT_DISPLAY_PRIORITY, unitCombinationAppearance } from "./unit-display-appearance.mjs";
import { unitDisplaySize, unitFrameMirror } from "./unit-size.mjs";
import { unitActionState } from "./unit-appearance-state.mjs";
import { unitAppearanceForm } from "../server/unit-appearance.mjs";

function unitActionArtFallbackKey(agent) {
  if (!agent || agent.species) return null;
  const attributes = unitDisplayAttributes(agent);
  const form = unitCombinationAppearance(agent) || UNIT_DISPLAY_PRIORITY.find(key => attributes[key] > 0) ||
    (attributes.strength > 0 || attributes.arms > 0 || agent.dna?.pieces?.some(piece => piece.gene === "gather") ? "gather" : attributes.piercing > 0 ? "secretion" : "base");
  return (agent.tribe || agent.key || "bean") + "/" + form;
}

export function unitActionArtSelection(agent, catalog) {
  const form = unitAppearanceForm(agent);
  if (!form) return null;
  const requestedKey = (agent.tribe || agent.key || "bean") + "/" + form;
  const key = catalog[requestedKey] ? requestedKey : unitActionArtFallbackKey(agent);
  const definition = catalog[key];
  return definition ? { requestedKey, key, definition } : null;
}

export function unitActionArtDefinition(agent) {
  return unitActionArtSelection(agent, UNIT_ACTION_ART)?.definition || null;
}

// Work reuses this same body's authored attack, never another form's rig.
// These visual aliases do not emit combat events or change harvesting/cargo.
const combinationWorkActions = new WeakMap();
function actionsFor(agent, definition) {
  if (!unitCombinationAppearance(agent)) return definition.actions;
  if (!combinationWorkActions.has(definition)) {
    const attack = definition.actions.attack || definition.actions.ranged;
    combinationWorkActions.set(definition, attack ? { ...definition.actions,
      harvest: { ...attack, loop: true },
      throw: { ...attack, loop: false, releaseAtMs: attack.hitTimeMs ?? attack.launchAtMs ?? 300 },
    } : definition.actions);
  }
  return combinationWorkActions.get(definition);
}

export function unitActionArtPose(agent, time) {
  const selection = unitActionArtSelection(agent, UNIT_ACTION_ART);
  if (!selection) return null;
  const { definition, key } = selection;
  const birth = agent.birth && UNIT_BIRTH_ART[key];
  const authored = actionsFor(agent, definition);
  const actions = birth ? { ...authored, birth } : authored;
  const state = unitActionState(agent, time, { animations: actions });
  if (!state) return null;
  const requested = state.action === "carry" && !definition.actions.carry ? "walk" : state.action;
  const animation = actions[requested];
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
    if (!animation || images.has(animation.image) || Date.now() < (retryAfter.get(animation.image) || 0)) return;
    if (pending.has(animation.image)) return pending.get(animation.image);
    const loading = Promise.resolve().then(() => loadImage(animation.image)).then(image => {
      images.set(animation.image, image); return image;
    }).catch(() => { retryAfter.set(animation.image, Date.now() + 1000); return null; }).finally(() => pending.delete(animation.image));
    pending.set(animation.image, loading); return loading;
  }
  async function prepare(agent, time) {
    const definition = unitActionArtDefinition(agent);
    if (!definition) return;
    const pose = unitActionArtPose(agent, time ?? 0);
    await Promise.all([request(definition.reference), request(pose?.animation)]);
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
    const loading = !images.has(pose.animation.image);
    if (!reference) {
      drawUnitLoading(context, x, floor - cell * unitDisplaySize(agent) * .4, Math.max(5, cell * .07), time);
      return true;
    }
    if (loading) pose = { ...pose, animation: pose.reference, frame: pose.reference.frames?.[0] || 0 };
    const animation = pose.animation, image = images.get(animation.image), width = animation.frameSize, height = animation.frameHeight || width;
    const cameraScale = (pose.reference.viewSize || pose.reference.frameSize) / (animation.viewSize || animation.frameSize);
    const scale = cell * unitDisplaySize(agent) / (animation.referenceLength || reference.length) * (animation.referenceLength ? 1 : cameraScale);
    const crop = { x: pose.frame % animation.columns * width, y: Math.floor(pose.frame / animation.columns) * height, width, height };
    const destination = { x: -animation.pivotX * scale, y: -animation.pivotY * scale, width: width * scale, height: height * scale };
    context.save(); context.translate(x, floor); context.scale(unitFrameMirror(animation.sourceFacing, mirror ? -1 : 1) ? -1 : 1, 1);
    if (beforeDraw) beforeDraw(context, image, crop, destination);
    context.drawImage(image, crop.x, crop.y, width, height, destination.x, destination.y, destination.width, destination.height);
    context.restore();
    if (loading) drawUnitLoading(context, x, floor - cell * unitDisplaySize(agent) * .4, Math.max(5, cell * .07), time);
    return true;
  }
  function frame(agent, time) {
    const pose = unitActionArtPose(agent, time);
    if (!pose) return null;
    request(pose.reference); request(pose.animation);
    if (!images.has(pose.reference.image) || !images.has(pose.animation.image)) return null;
    const surface = createSurface(512, 512);
    return draw(surface.getContext("2d"), agent, time, 256, 448, 256 / unitDisplaySize(agent), false, null) ? surface : null;
  }
  return { prepare, draw, frame, referenceBounds, readyFrame: (agent, time) => { const pose = unitActionArtPose(agent, time); return !!pose && images.has(pose.animation.image) && images.has(pose.reference.image); }, readyAction: (agent, time) => { const pose = unitActionArtPose(agent, time); return !!pose && !pose.missing && images.has(pose.animation.image) && images.has(pose.reference.image); }, ready: agent => {
    const definition = unitActionArtDefinition(agent); return !!definition && images.has(definition.reference.image);
  } };
}
