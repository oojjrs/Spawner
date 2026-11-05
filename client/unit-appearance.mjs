import { UNIT_DISPLAY_MASKS, unitDominantAppearanceMask, unitDisplayAbilityMask } from "./unit-display-appearance.mjs";
import { UNIT_DISPLAY_SIZES, unitDisplaySize } from "./unit-size.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { UNIT_APPEARANCE_ASSETS } from "./unit-appearance-assets.mjs";
import { UNIT_APPEARANCE_BITS, UNIT_APPEARANCE_TRIBES, UNIT_APPEARANCE_LEGACY_VISUAL_KEYS, unitAppearanceKey, unitAppearanceMaskFromDna } from "../server/unit-appearance.mjs";

export function unitAppearanceRequiredWorldActions(mask) {
  const actions = ["idle", "walk", "hurt", "birth", "death", "harvest", "carry", "throw"];
  if (mask & UNIT_APPEARANCE_BITS.blade) actions.push("attack");
  if (mask & UNIT_APPEARANCE_BITS.secretion) actions.push("ranged");
  return actions;
}

export function unitAppearanceRequiredActions(mask) { return unitAppearanceRequiredWorldActions(mask); }
export const UNIT_APPEARANCE_OPTIONAL_PREVIEW_ACTIONS = Object.freeze(["jump"]);

export function unitAppearanceDefinition(tribe, mask) {
  const key = unitAppearanceKey(tribe, mask);
  const definition = key ? UNIT_APPEARANCE_ASSETS[key] || null : null;
  return definition && definition.source?.tribe === tribe && definition.source.mask === mask ? definition : null;
}

function sourceApproved(source) {
  return source?.approvalState === "approved" && !!(source.approvalRef?.callId || source.approvalRef?.messageId) && !!source.approvalRef?.sourceThread ||
    source?.approvalState === "existing-reference" && source.mask === 0 && source.provenance?.kind === "existing-original" &&
    !!source.provenance.sourceHash && !!source.provenance.transform &&
    (!!source.provenance.sourceImage && !!source.provenance.reuseDirective || source.provenance.referenceVerified === true && source.provenance.reuseAuthorized === true);
}

function cameraVerified(source) {
  return !!source?.sourceId && !!source.sourceHash && !!source.image && source.frameWidth === 512 && source.frameHeight === 512 &&
    source.camera?.pixelsPerWorld === 512 && source.cameraVerified === true && Number.isFinite(source.pivot?.x) && Number.isFinite(source.pivot?.y) &&
    source.coreReference?.verified === true && !!source.coreReference.landmarks;
}

function clipValid(source, clip) {
  const width = clip?.frameWidth || clip?.frameSize, height = clip?.frameHeight || clip?.frameSize, mapping = clip?.cameraMapping;
  const canonical = width === source?.frameWidth && height === source?.frameHeight && !mapping;
  const mapped = source?.mask === 0 && source.provenance?.kind === "existing-original" && !!source.provenance.sourceHash && !!source.provenance.transform && mapping?.verified === true &&
    !!mapping.sourceHash && Number.isFinite(mapping.pixelsPerWorld) && mapping.pixelsPerWorld > 0 &&
    Math.abs(mapping.scale - source.camera.pixelsPerWorld / mapping.pixelsPerWorld) < .000001 &&
    Math.abs(clip.pivotX * mapping.scale + mapping.offsetX - source.pivot.x) <= 1 &&
    Math.abs(clip.pivotY * mapping.scale + mapping.offsetY - source.pivot.y) <= 1;
  return !!source?.sourceId && clip?.sourceId === source.sourceId && !!clip.image && (canonical || mapped) &&
    Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0 && Number.isInteger(clip.columns) && clip.columns > 0 &&
    Number.isInteger(clip.frameCount) && clip.frameCount > 0 && typeof clip.loop === "boolean" &&
    Number.isFinite(clip.pivotX) && Number.isFinite(clip.pivotY) && Array.isArray(clip.durationsMs) &&
    clip.durationsMs.length > 0 && clip.durationsMs.every(value => Number.isFinite(value) && value > 0) &&
    (clip.frames ? clip.frames.length === clip.durationsMs.length && clip.frames.every(value => Number.isInteger(value) && value >= 0 && value < clip.frameCount) :
      clip.durationsMs.length === clip.frameCount);
}

export function unitAppearanceReadiness(definition, mask) {
  const approved = sourceApproved(definition?.source), verified = cameraVerified(definition?.source);
  const complete = !!definition && unitAppearanceRequiredActions(mask).every(action => clipValid(definition.source, definition.actions?.[action]));
  return { sourceApproved: approved === true, cameraVerified: verified === true, actionSetComplete: complete,
    worldReady: approved === true && verified === true && complete, ready: approved === true && verified === true && complete };
}

export function unitAppearanceAnimation(tribe, mask, action) {
  const definition = unitAppearanceDefinition(tribe, mask), clip = definition?.actions?.[action];
  return sourceApproved(definition?.source) && cameraVerified(definition?.source) && clipValid(definition?.source, clip) ? clip : null;
}

export function unitAppearanceMissingActions(tribe, mask) {
  const definition = unitAppearanceDefinition(tribe, mask);
  return unitAppearanceRequiredActions(mask).filter(action => !clipValid(definition?.source, definition?.actions?.[action]));
}

export function unitAppearanceReady(tribe, mask) {
  return unitAppearanceReadiness(unitAppearanceDefinition(tribe, mask), mask).ready;
}

export function unitAppearanceForAgent(agent) {
  if (agent.species || agent.dna?.version !== 3 || !Array.isArray(agent.dna.pieces) ||
      [agent.attributes, agent.appearanceAttributes].some(attributes => UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => attributes?.[key] > 0))) return null;
  const tribe = agent.tribe || "bean", actualMask = unitAppearanceMaskFromDna(agent.dna), mask = unitDominantAppearanceMask(actualMask);
  const definition = unitAppearanceDefinition(tribe, mask);
  return mask !== null && unitAppearanceReadiness(definition, actualMask).ready && ATTRIBUTE_DNA.validate(agent.dna) ?
    { tribe, mask, actualMask, definition } : null;
}

export function unitAppearanceBirthSceneForAgent(agent) {
  if (agent.species || agent.dna?.version !== 3 || unitAppearanceMaskFromDna(agent.dna) !== 0 ||
      !ATTRIBUTE_DNA.validate(agent.dna) || [agent.attributes, agent.appearanceAttributes].some(attributes =>
        [...Object.keys(UNIT_APPEARANCE_BITS), ...UNIT_APPEARANCE_LEGACY_VISUAL_KEYS].some(key => attributes?.[key] > 0))) return null;
  const definition = unitAppearanceDefinition(agent.tribe || "bean", 0), scene = definition?.sceneActions?.birth;
  return sourceApproved(definition?.source) && cameraVerified(definition?.source) && scene?.runtimeEnabled === true &&
    scene.sourceId === definition.source.sourceId && scene.mask === 0 && scene.ownership?.bodyOnly === true &&
    scene.validation?.cameraVerified === true && scene.validation?.runtimeRendererConnected === true ? scene : null;
}

export function unitAppearancePose(tribe, mask, action, elapsedMs) {
  const definition = unitAppearanceDefinition(tribe, mask), animation = unitAppearanceAnimation(tribe, mask, action);
  if (!animation) return null;
  const durationMs = animation.durationsMs.reduce((sum, value) => sum + value, 0);
  let elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0, index = 0;
  if (animation.loop) elapsed %= durationMs;
  while (index < animation.durationsMs.length - 1 && elapsed >= animation.durationsMs[index]) elapsed -= animation.durationsMs[index++];
  const frame = animation.frames?.[index] ?? index;
  return { action, animation, frame, geometry: { ...animation, ...animation.frameGeometry?.[frame] }, source: definition.source };
}

export function unitAppearanceWorldPose(agent, action, elapsedMs) {
  const appearance = unitAppearanceForAgent(agent);
  return appearance ? unitAppearancePose(appearance.tribe, appearance.mask, action, elapsedMs) : null;
}

export function unitAppearanceSourceScale(agent, worldPixels, source, animation) {
  const base = UNIT_DISPLAY_SIZES[agent.species || agent.tribe || "bean"] || UNIT_DISPLAY_SIZES.bean;
  const growth = unitDisplaySize(agent) / base;
  return worldPixels * growth / (animation.cameraMapping?.pixelsPerWorld || source.camera.pixelsPerWorld);
}

export function unitAppearanceInventory({ includeLegacyCombinations = false } = {}) {
  const masks = includeLegacyCombinations ? Array.from({ length: 32 }, (_, mask) => mask) : UNIT_DISPLAY_MASKS;
  return UNIT_APPEARANCE_TRIBES.flatMap(tribe => masks.map(mask => {
    const definition = unitAppearanceDefinition(tribe, mask);
    return { key: unitAppearanceKey(tribe, mask), tribe, mask, sourceId: definition?.source?.sourceId || null,
      ...unitAppearanceReadiness(definition, includeLegacyCombinations ? mask : unitDisplayAbilityMask(mask)),
      missingActions: unitAppearanceRequiredActions(includeLegacyCombinations ? mask : unitDisplayAbilityMask(mask))
        .filter(action => !clipValid(definition?.source, definition?.actions?.[action])),
      previewStatus: Object.fromEntries(UNIT_APPEARANCE_OPTIONAL_PREVIEW_ACTIONS.map(action => [action,
        definition?.previewStatus?.[action] === "unsupported" ? "unsupported" : unitAppearanceAnimation(tribe, mask, action) ? "ready" : "pending"])) };
  }));
}

export const UNIT_APPEARANCE_PIXEL_BUDGETS = Object.freeze({ mobile: 8 * 1024 * 1024, desktop: 32 * 1024 * 1024 });

export function unitAppearanceLodRatio(frameSize, screenPixels, devicePixelRatio) {
  const ratio = Math.min(1, screenPixels * devicePixelRatio / frameSize);
  return ratio > 0 ? Math.max(1 / frameSize, 2 ** Math.ceil(Math.log2(ratio))) : 0;
}

export function createUnitAppearanceCache(loadSource, makeBitmap, pixelBudget) {
  if (!Number.isSafeInteger(pixelBudget) || pixelBudget <= 0) throw new RangeError("INVALID APPEARANCE PIXEL BUDGET");
  const entries = new Map(), workingSet = new Map(), workingKeys = new Set(), preparing = new Map();
  let residentPixels = 0, decodes = 0, cacheHits = 0, queue = Promise.resolve();
  function dimensions(animation) {
    const width = animation.frameWidth || animation.frameSize, height = animation.frameHeight || animation.frameSize;
    return { width: width * animation.columns, height: height * Math.ceil(animation.frameCount / animation.columns), minimum: 1 / Math.max(width, height) };
  }
  function pixelsAt(animation, ratio) {
    const size = dimensions(animation);
    return Math.max(1, Math.round(size.width * ratio)) * Math.max(1, Math.round(size.height * ratio));
  }
  function setWorkingSet(requests) {
    workingSet.clear(); workingKeys.clear();
    for (const request of requests) {
      if (!(request.ratio > 0)) continue;
      const image = request.animation.image, ratio = Math.max(dimensions(request.animation).minimum, Math.min(1, 2 ** Math.floor(Math.log2(request.ratio))));
      const previous = workingSet.get(image);
      if (!previous || previous.ratio < ratio) workingSet.set(image, { animation: request.animation, ratio });
    }
    let pixels = [...workingSet.values()].reduce((sum, request) => sum + pixelsAt(request.animation, request.ratio), 0);
    while (pixels > pixelBudget) {
      let changed = false;
      for (const request of workingSet.values()) {
        const ratio = Math.max(dimensions(request.animation).minimum, request.ratio / 2);
        if (ratio < request.ratio) { request.ratio = ratio; changed = true; }
      }
      if (!changed) break;
      pixels = [...workingSet.values()].reduce((sum, request) => sum + pixelsAt(request.animation, request.ratio), 0);
    }
    for (const [image, request] of workingSet) workingKeys.add(image + ":" + request.ratio);
    return { atlases: workingSet.size, pixels, ratios: Object.fromEntries([...workingSet].map(([image, request]) => [image, request.ratio])) };
  }
  function remove(key, entry) {
    if (entry.bitmap) { entry.bitmap.close?.(); residentPixels -= entry.pixels; entry.bitmap = null; }
    if (entries.get(key) === entry) entries.delete(key);
  }
  function evict(required) {
    for (const [key, entry] of entries) {
      if (residentPixels + required <= pixelBudget) break;
      if (!entry.pins && !workingKeys.has(key)) remove(key, entry);
    }
  }
  function imageKey(animation, requestedRatio) {
    const ratio = workingSet.get(animation.image)?.ratio || Math.min(1, 2 ** Math.floor(Math.log2(requestedRatio)));
    return animation.image + ":" + ratio;
  }
  // The world paints synchronously. A decode must never draw onto a later
  // frame after terrain, another unit, or the camera has changed.
  function withReadyImage(animation, requestedRatio, draw) {
    if (!(requestedRatio > 0)) return false;
    const key = imageKey(animation, requestedRatio), entry = entries.get(key);
    if (!entry?.bitmap || entry.discard) return false;
    entries.delete(key); entries.set(key, entry); entry.pins++; cacheHits++;
    try {
      draw({ image: entry.bitmap, sourceRatio: entry.ratio, rasterScaleX: entry.rasterScaleX, rasterScaleY: entry.rasterScaleY });
      return true;
    } finally { entry.pins--; if (entry.discard && !entry.pins) remove(key, entry); }
  }
  function prepare(animation, requestedRatio) {
    if (!(requestedRatio > 0)) return Promise.resolve(false);
    const key = imageKey(animation, requestedRatio);
    if (entries.get(key)?.bitmap && !entries.get(key).discard) return Promise.resolve(true);
    if (!preparing.has(key)) {
      const pending = withImage(animation, requestedRatio, () => {});
      preparing.set(key, pending);
      pending.then(() => { if (preparing.get(key) === pending) preparing.delete(key); },
        () => { if (preparing.get(key) === pending) preparing.delete(key); });
    }
    return preparing.get(key);
  }
  async function withImage(animation, requestedRatio, draw) {
    if (!(requestedRatio > 0)) return false;
    const ratio = workingSet.get(animation.image)?.ratio || Math.min(1, 2 ** Math.floor(Math.log2(requestedRatio))), key = animation.image + ":" + ratio;
    let entry = entries.get(key);
    if (entry) { entries.delete(key); entries.set(key, entry); entry.pins++; cacheHits++; }
    else {
      entry = { pins: 1, bitmap: null, pixels: 0, discard: false };
      entries.set(key, entry);
      const current = entry;
      current.pending = queue.then(async () => {
        const frameWidth = animation.frameWidth || animation.frameSize, frameHeight = animation.frameHeight || animation.frameSize;
        const width = frameWidth * animation.columns;
        const height = frameHeight * Math.ceil(animation.frameCount / animation.columns);
        const minimumRatio = 1 / Math.max(frameWidth, frameHeight);
        let selected = Math.max(minimumRatio, ratio), pixels = pixelsAt(animation, selected);
        evict(pixels);
        while (pixels + residentPixels > pixelBudget && selected > minimumRatio) {
          selected = Math.max(minimumRatio, selected / 2); pixels = pixelsAt(animation, selected);
        }
        if (pixels + residentPixels > pixelBudget) return null;
        const acquired = await loadSource(animation.image);
        const lease = acquired && typeof acquired.release === "function" && acquired.blob ? acquired : null;
        const source = lease?.blob || acquired;
        let bitmap;
        try {
          const blob = typeof Blob !== "undefined" && source instanceof Blob;
          const sourceWidth = blob ? width : source.naturalWidth || source.width, sourceHeight = blob ? height : source.naturalHeight || source.height;
          if (sourceWidth !== width || sourceHeight !== height) throw new Error(`APPEARANCE ATLAS GEOMETRY MISMATCH : ${animation.image}`);
          bitmap = await makeBitmap(source, { resizeWidth: Math.max(1, Math.round(width * selected)), resizeHeight: Math.max(1, Math.round(height * selected)), resizeQuality: "high" });
        } finally { lease?.release(); }
        const actualPixels = bitmap.width * bitmap.height;
        if (actualPixels + residentPixels > pixelBudget) { bitmap.close?.(); throw new Error("APPEARANCE DECODED BUDGET EXCEEDED"); }
        decodes++; current.bitmap = bitmap; current.pixels = actualPixels; current.ratio = selected; current.rasterScaleX = bitmap.width / width; current.rasterScaleY = bitmap.height / height; residentPixels += actualPixels;
        return current;
      });
      queue = current.pending.then(() => undefined, () => undefined);
    }
    try {
      const ready = await entry.pending;
      if (!ready) return false;
      await draw({ image: ready.bitmap, sourceRatio: ready.ratio, rasterScaleX: ready.rasterScaleX, rasterScaleY: ready.rasterScaleY });
      return true;
    } finally {
      entry.pins--;
      if (!entry.bitmap || entry.discard && !entry.pins) remove(key, entry);
      for (const [oldKey, oldEntry] of entries) {
        if (entries.size <= Math.max(128, workingKeys.size)) break;
        if (!oldEntry.pins && !workingKeys.has(oldKey)) remove(oldKey, oldEntry);
      }
    }
  }
  function clear() {
    workingSet.clear(); workingKeys.clear();
    for (const [key, entry] of entries) {
      if (entry.pins) entry.discard = true; else remove(key, entry);
    }
  }
  return { withImage, withReadyImage, prepare, setWorkingSet, clear, stats: () => ({ entries: entries.size, residentPixels, pixelBudget, decodes, cacheHits, workingAtlases: workingSet.size, pending: preparing.size }) };
}
