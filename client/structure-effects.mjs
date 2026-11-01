import { nestGrowthAnimation } from "./nest-growth.mjs";

const durations = { complete: 1.35, damage: .32, destroy: 1.05 };

export function createStructureEffectPlayback() {
  return { structures: new Map(), effects: new Map(), time: null, snapshotTime: null };
}

export function syncStructureEffectPlayback(playback, colonies, buildings, burrows, time, firstSnapshot, snapshotTime) {
  const reset = firstSnapshot || playback.time === null || time < playback.time || snapshotTime < playback.snapshotTime;
  const previousTime = playback.snapshotTime;
  if (reset) {
    playback.structures.clear();
    playback.effects.clear();
  }
  playback.time = time;
  playback.snapshotTime = snapshotTime;
  for (const [key, effect] of playback.effects) {
    if (time >= effect.startedAt + durations[effect.type]) playback.effects.delete(key);
  }
  const structures = [
    ...colonies.map(colony => ({ id: colony.id, kind: "colony", tribe: colony.tribe || "bean", ownerId: colony.ownerId,
      x: colony.x, y: colony.y, width: 5, height: 5, health: colony.nestHealth, level: colony.nestLevel || 1 })),
    ...buildings.map(building => ({ ...building, kind: "building" })),
    ...burrows.map(burrow => ({ ...burrow, kind: "burrow" }))
  ];
  const present = new Set();
  for (const structure of structures) {
    const key = structure.kind + ":" + structure.id;
    const completeKey = key + ":complete", damageKey = key + ":damage";
    present.add(key);
    const previous = playback.structures.get(key);
    playback.structures.set(key, structure);
    if (reset || previous && (previous.tribe !== structure.tribe || previous.ownerId !== structure.ownerId)) {
      playback.effects.delete(completeKey);
      playback.effects.delete(damageKey);
      continue;
    }
    if (!(structure.health > 0)) {
      playback.effects.delete(completeKey);
      if (previous?.health > 0) playback.effects.set(damageKey,
        { structure, type: "destroy", startedAt: time });
      continue;
    }
    if (previous && structure.health < previous.health) {
      if (!playback.effects.has(damageKey)) playback.effects.set(damageKey,
        { structure, type: "damage", startedAt: time });
    }
    if (structure.kind === "colony" && previous && structure.level !== previous.level) {
      playback.effects.delete(completeKey);
      if (structure.level > previous.level) {
        const growth = nestGrowthAnimation(structure.tribe, previous.level, structure.level);
        playback.effects.set(completeKey, { structure, type: "complete", startedAt: time + (growth?.duration || 0) });
      }
    } else if (structure.kind === "building" && !previous && Number.isFinite(structure.completedAt) &&
        structure.completedAt >= previousTime - 1e-7 && structure.completedAt <= snapshotTime && snapshotTime - structure.completedAt < .5) {
      playback.effects.set(completeKey, { structure, type: "complete", startedAt: structure.completedAt });
    }
  }
  for (const key of playback.structures.keys()) if (!present.has(key)) playback.structures.delete(key);
  for (const [key, effect] of playback.effects) {
    const current = playback.structures.get(effect.structure.kind + ":" + effect.structure.id);
    if (!current) playback.effects.delete(key);
    else effect.structure = current;
  }
}

export function structureEffectPose(effect, time, reducedMotion) {
  const elapsed = time - effect.startedAt, duration = durations[effect.type];
  if (elapsed < 0 || elapsed >= duration || effect.type === "complete" && !(effect.structure.health > 0)) return null;
  const progress = elapsed / duration;
  return { type: effect.type, progress, reducedMotion,
    opacity: Math.min(1, elapsed / .045) * Math.min(1, (1 - progress) / .4) };
}

export function createStructureEffectRendering(createSurface) {
  const surface = createSurface(512, 512), layer = surface.getContext("2d", { willReadFrequently: true });
  const measurements = new WeakMap();

  function measure(sprite, frame) {
    const spriteWidth = sprite?.naturalWidth || sprite?.width, spriteHeight = sprite?.naturalHeight || sprite?.height;
    if (sprite?.complete === false || !spriteWidth || !spriteHeight) return null;
    const source = frame || { x: 0, y: 0, width: spriteWidth, height: spriteHeight };
    const sourceWidth = source.width || source.size, sourceHeight = source.height || source.size;
    const key = [source.x, source.y, sourceWidth, sourceHeight, frame?.index].join(":");
    let cached = measurements.get(sprite);
    if (!cached) { cached = new Map(); measurements.set(sprite, cached); }
    if (cached.has(key)) return cached.get(key);
    const scale = Math.min(1, 512 / Math.max(sourceWidth, sourceHeight));
    const maskWidth = Math.max(1, Math.round(sourceWidth * scale)), maskHeight = Math.max(1, Math.round(sourceHeight * scale));
    if (surface.width !== maskWidth || surface.height !== maskHeight) {
      surface.width = maskWidth; surface.height = maskHeight;
    }
    layer.clearRect(0, 0, maskWidth, maskHeight);
    layer.drawImage(sprite, source.x, source.y, sourceWidth, sourceHeight, 0, 0, maskWidth, maskHeight);
    const pixels = layer.getImageData(0, 0, maskWidth, maskHeight).data;
    let left = maskWidth, top = maskHeight, right = -1, bottom = -1;
    for (let row = 0; row < maskHeight; row++) for (let column = 0; column < maskWidth; column++) {
      if (pixels[(row * maskWidth + column) * 4 + 3] < 16) continue;
      left = Math.min(left, column); right = Math.max(right, column);
      top = Math.min(top, row); bottom = Math.max(bottom, row);
    }
    const bounds = right < left ? null : { x: left / maskWidth, y: top / maskHeight,
      width: (right - left + 1) / maskWidth, height: (bottom - top + 1) / maskHeight };
    cached.set(key, bounds);
    if (cached.size > 128) cached.delete(cached.keys().next().value);
    return bounds;
  }

  function draw(context, sprites, pose, sprite, frame, x, y, width, height, foreground) {
    if (!pose || width <= 0 || height <= 0) return;
    const bounds = measure(sprite, frame);
    if (!bounds) return;
    const bodyWidth = width * bounds.width, bodyHeight = height * bounds.height;
    const left = x + width * bounds.x, top = y + height * bounds.y;
    const centerX = left + bodyWidth / 2, floor = top + bodyHeight * .95;
    const motion = pose.reducedMotion ? .4 : 1 - (1 - pose.progress) ** 3;
    const ringWidth = bodyWidth * (1.02 + motion * .18);
    const ringHeight = Math.min(ringWidth * .32, bodyHeight * .4);
    context.save();
    context.globalAlpha *= pose.opacity;
    context.imageSmoothingEnabled = true;
    if (pose.type !== "complete") context.filter = pose.type === "destroy" ?
      "brightness(.42) sepia(1) saturate(2)" : "brightness(.55) sepia(1) saturate(12) hue-rotate(320deg)";
    if (sprites.ring?.complete && sprites.ring.naturalWidth) {
      context.save();
      context.globalAlpha *= .85;
      context.beginPath();
      context.rect(centerX - ringWidth / 2, foreground ? floor : floor - ringHeight / 2, ringWidth, ringHeight / 2);
      context.clip();
      context.drawImage(sprites.ring, centerX - ringWidth / 2, floor - ringHeight / 2, ringWidth, ringHeight);
      context.restore();
    }
    if (foreground && sprites.sparkle?.complete && sprites.sparkle.naturalWidth) {
      const count = pose.type === "damage" ? 4 : 8;
      for (let index = 0; index < count; index++) {
        const delay = pose.reducedMotion ? 0 : index % 3 * .045;
        const phase = pose.reducedMotion ? .4 : (pose.progress - delay) / (1 - delay);
        if (phase <= 0 || phase >= 1) continue;
        const angle = index * Math.PI * 2 / count - Math.PI / 2;
        const px = centerX + Math.cos(angle) * bodyWidth * (.48 + phase * .04);
        const py = top + bodyHeight * (.48 + Math.sin(angle) * (.45 + phase * .04) - phase * .05);
        const size = Math.max(3, Math.min(bodyWidth, bodyHeight) * (.055 + .04 * Math.sin(phase * Math.PI)));
        context.save();
        context.globalAlpha *= Math.sin(phase * Math.PI);
        context.drawImage(sprites.sparkle, px - size / 2, py - size / 2, size, size);
        context.restore();
      }
    }
    context.restore();
  }

  return { draw };
}
