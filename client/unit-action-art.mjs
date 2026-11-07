import { drawUnitLoading } from "./unit-loading.mjs";
import { UNIT_ACTION_ART } from "./unit-action-art-assets.mjs";
import { UNIT_BIRTH_ART } from "./unit-birth-art-assets.mjs";
import { unitDisplayAttributes, UNIT_DISPLAY_PRIORITY } from "./unit-display-appearance.mjs";
import { unitDisplaySize, unitFrameMirror } from "./unit-size.mjs";
import { unitActionState } from "./unit-appearance-state.mjs";
import { UNIT_COMBINATION_FORMS } from "./unit-combination-forms.mjs";
import { unitAppearanceForm } from "../server/unit-appearance.mjs";

function unitActionArtFallbackKey(agent) {
  if (!agent || agent.species) return null;
  const attributes = unitDisplayAttributes(agent);
  const form = UNIT_DISPLAY_PRIORITY.find(key => attributes[key] > 0) ||
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
function actionsFor(definition, key) {
  if (!UNIT_COMBINATION_FORMS.some(form => key.endsWith("/" + form.key))) return definition.actions;
  if (!combinationWorkActions.has(definition)) {
    const attack = definition.actions.attack || definition.actions.ranged || definition.actions.walk;
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
  const authored = actionsFor(definition, key);
  const actions = birth ? { ...authored, birth } : authored;
  const state = unitActionState(agent, time, { animations: actions });
  if (!state) return null;
  const requested = state.action === "carry" && !definition.actions.carry ? "walk" : state.action;
  const animation = actions[requested];
  if (!animation) return { action: state.action, animation: definition.reference, frame: definition.reference.frames?.[0] || 0, reference: definition.reference, missing: true };
  let elapsed = state.elapsedMs;
  const duration = animation.durationsMs.reduce((sum, value) => sum + value, 0);
  // Absolute simulation timestamps can put an exact authored cue a fraction
  // of a nanosecond before its frame boundary after subtraction.
  const frameEpsilonMs = 1e-7;
  if (animation.loop) {
    elapsed %= duration;
    if (duration - elapsed <= frameEpsilonMs) elapsed = 0;
  }
  let index = 0;
  while (index < animation.durationsMs.length - 1 && elapsed + frameEpsilonMs >= animation.durationsMs[index]) elapsed -= animation.durationsMs[index++];
  return { action: state.action, animation, frame: animation.frames?.[index] ?? index, reference: definition.reference, missing: false };
}

export function createUnitActionArt(assetSource, createSurface, loadImage) {
  const images = new Map(), pending = new Map(), bounds = new Map(), retryAfter = new Map();
  // Only opt-in birth scenes may composite an environment and one intact body.
  // Weak keys avoid retaining decoded scene metadata after catalogs are replaced.
  const sceneDefinitions = new WeakMap(), layerRecency = new Map();
  const maxLayerImages = 64;
  function sceneLayers(animation) {
    if (!animation?.sceneLayers) return null;
    if (sceneDefinitions.has(animation)) return sceneDefinitions.get(animation);
    const scene = animation.sceneLayers, layers = scene.layers;
    const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
    const valid = positiveInteger(animation.frameCount) && Number.isFinite(animation.pivotX) && Number.isFinite(animation.pivotY) && scene.version === 1 && Array.isArray(layers) && layers.length === 2 &&
      layers[0]?.role === "environment" && layers[1]?.role === "body" && layers[1].wholeBody === true && layers[0].wholeBody !== true &&
      layers[0].image !== layers[1].image && layers.every(layer => layer.image !== animation.image) &&
      layers.every(layer => typeof layer.image === "string" && layer.image.length > 0 &&
        positiveInteger(layer.frameSize) && positiveInteger(layer.frameHeight) &&
        positiveInteger(layer.columns) && positiveInteger(layer.frameCount) &&
        Array.isArray(layer.samples) && layer.samples.length === animation.frameCount &&
        layer.samples.every(sample => sample === null || (sample && Number.isSafeInteger(sample.frame) &&
          sample.frame >= 0 && sample.frame < layer.frameCount && Array.isArray(sample.destination) &&
          sample.destination.length === 4 && sample.destination.every(Number.isFinite) &&
          sample.destination[2] > 0 && sample.destination[3] > 0)));
    sceneDefinitions.set(animation, valid ? layers : null);
    return valid ? layers : null;
  }
  function touchLayer(layer) {
    layerRecency.delete(layer.image); layerRecency.set(layer.image, true);
    while (layerRecency.size > maxLayerImages) {
      const oldest = layerRecency.keys().next().value;
      layerRecency.delete(oldest); images.delete(oldest); retryAfter.delete(oldest);
    }
  }
  function layersFor(pose) {
    return pose?.action === "birth" && Number.isSafeInteger(pose.frame) && pose.frame >= 0 &&
      pose.frame < pose.animation.frameCount ? sceneLayers(pose.animation) : null;
  }
  function independentScene(pose) {
    return !!layersFor(pose) && Number.isFinite(pose.animation.referenceLength) && pose.animation.referenceLength > 0;
  }
  function requestReference(pose) {
    if (pose && !independentScene(pose)) return request(pose.reference);
  }
  function layersReady(layers) { return !!layers && layers.every(layer => images.has(layer.image)); }
  function poseReady(pose) {
    return !!pose && (independentScene(pose) || images.has(pose.reference.image)) &&
      (layersReady(layersFor(pose)) || images.has(pose.animation.image));
  }
  function releaseSceneFallback(animation) {
    images.delete(animation.image); retryAfter.delete(animation.image);
    layerRecency.delete(animation.image);
  }
  function requestPose(pose) {
    if (!pose) return;
    const layers = layersFor(pose);
    if (!layers) return request(pose.animation);
    if (layersReady(layers)) {
      // This is the hot draw path. Do not create promises or retry closures for
      // already decoded scenes (including frame() followed by draw()).
      for (const layer of layers) touchLayer(layer);
      releaseSceneFallback(pose.animation);
      return;
    }
    const loads = layers.map(layer => { touchLayer(layer); return request(layer, true); });
    // Never download the large baked scene just because layers are still loading.
    function fallback() {
      touchLayer(pose.animation);
      return Promise.resolve(request(pose.animation)).then(() => {
        if (layersReady(layers)) releaseSceneFallback(pose.animation);
      });
    }
    if (layers.some(layer => retryAfter.has(layer.image))) fallback();
    return Promise.all(loads).then(() => {
      if (layersReady(layers)) {
        // Release a decoded baked scene after successful recovery; never keep
        // duplicate body pixels around for an otherwise healthy layered scene.
        releaseSceneFallback(pose.animation);
      } else if (layers.some(layer => retryAfter.has(layer.image))) return fallback();
    });
  }
  function request(animation, layer = false) {
    if (!animation || images.has(animation.image) || Date.now() < (retryAfter.get(animation.image) || 0)) return;
    if (pending.has(animation.image)) return pending.get(animation.image);
    const trackedScene = layer || layerRecency.has(animation.image);
    const loading = Promise.resolve().then(() => loadImage(animation.image)).then(image => {
      if (layer) {
        const width = image?.naturalWidth ?? image?.width, height = image?.naturalHeight ?? image?.height;
        if (!image || (width !== undefined && width !== animation.columns * animation.frameSize) ||
          (height !== undefined && height !== Math.ceil(animation.frameCount / animation.columns) * animation.frameHeight)) {
          throw new Error("Invalid birth scene atlas");
        }
      }
      if (trackedScene) touchLayer(animation);
      retryAfter.delete(animation.image);
      images.set(animation.image, image); return image;
    }).catch(() => {
      if (trackedScene) touchLayer(animation);
      retryAfter.set(animation.image, Date.now() + 1000); return null;
    }).finally(() => pending.delete(animation.image));
    pending.set(animation.image, loading); return loading;
  }
  async function prepare(agent, time) {
    const definition = unitActionArtDefinition(agent);
    if (!definition) return;
    const pose = unitActionArtPose(agent, time ?? 0);
    await Promise.all([pose ? requestReference(pose) : request(definition.reference), requestPose(pose)]);
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
    requestReference(pose); requestPose(pose);
    const reference = independentScene(pose) ? { length: pose.animation.referenceLength } : referenceBounds(pose.reference);
    const layers = layersFor(pose), layered = layersReady(layers);
    const loading = !layered && !images.has(pose.animation.image);
    if (!reference) {
      drawUnitLoading(context, x, floor - cell * unitDisplaySize(agent) * .4, Math.max(5, cell * .07), time);
      return true;
    }
    if (loading && (layers || !images.has(pose.reference.image))) {
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
    if (layered) {
      for (const layer of layers) {
        touchLayer(layer);
        const sample = layer.samples[pose.frame];
        if (!sample) continue;
        const layerImage = images.get(layer.image);
        const layerCrop = { x: sample.frame % layer.columns * layer.frameSize,
          y: Math.floor(sample.frame / layer.columns) * layer.frameHeight,
          width: layer.frameSize, height: layer.frameHeight };
        const [left, top, width, height] = sample.destination;
        const layerDestination = { x: (left - animation.pivotX) * scale,
          y: (top - animation.pivotY) * scale, width: width * scale, height: height * scale };
        if (beforeDraw && layer.role === "body") beforeDraw(context, layerImage, layerCrop, layerDestination);
        context.drawImage(layerImage, layerCrop.x, layerCrop.y, layerCrop.width, layerCrop.height,
          layerDestination.x, layerDestination.y, layerDestination.width, layerDestination.height);
      }
    } else {
      if (beforeDraw) beforeDraw(context, image, crop, destination);
      context.drawImage(image, crop.x, crop.y, width, height, destination.x, destination.y, destination.width, destination.height);
    }
    context.restore();
    if (loading) drawUnitLoading(context, x, floor - cell * unitDisplaySize(agent) * .4, Math.max(5, cell * .07), time);
    return true;
  }
  function frame(agent, time) {
    const pose = unitActionArtPose(agent, time);
    if (!pose) return null;
    requestReference(pose); requestPose(pose);
    if (!poseReady(pose)) return null;
    const surface = createSurface(512, 512);
    return draw(surface.getContext("2d"), agent, time, 256, 448, 256 / unitDisplaySize(agent), false, null) ? surface : null;
  }
  // ready(agent) intentionally remains the timeless reference/portrait contract.
  // Scene playback callers use readyFrame/readyAction with simulation time.
  return { prepare, draw, frame, referenceBounds, readyFrame: (agent, time) => { const pose = unitActionArtPose(agent, time); return poseReady(pose); }, readyAction: (agent, time) => { const pose = unitActionArtPose(agent, time); return !!pose && !pose.missing && poseReady(pose); }, ready: agent => {
    const definition = unitActionArtDefinition(agent); return !!definition && images.has(definition.reference.image);
  } };
}
