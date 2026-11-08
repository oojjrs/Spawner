import { unitFrameMirror } from "./unit-size.mjs";
function ready(image) {
  return image?.complete !== false && (image?.naturalWidth || image?.width) > 0;
}

function sheetDescriptor(model, agent, animation, frame, sprite, sizePerCell, mirrorX, action) {
  const source = { owner: sprite, size: animation.frameSize, index: frame,
    x: frame % animation.columns * animation.frameSize,
    y: Math.floor(frame / animation.columns) * animation.frameSize };
  return { species: agent.species, action, animation, frame, sprite, source,
    selection: source, sizePerCell, mirrorX,
    groundOffset: agent.species === "talon-owl" || agent.species === "spiny-back-beetle" ? .86 : 1,
    left: -animation.pivotX / animation.frameSize, top: -animation.pivotY / animation.frameSize,
    whole: false, smoothing: false, hop: null };
}

export function beetlePresentationFrame(model, index, facing, action, resources) {
  const attack = action === "attack";
  const animation = model.imageFrameGeometry(attack ? model.BEETLE_ATTACK_SPRITE : model.BEETLE_SPRITE, index);
  const sheet = attack ? resources.beetleAttackSheet : resources.beetleSheet;
  const prepared = attack ? null : resources.beetleFrames?.get(index);
  const sprite = prepared || sheet;
  const mirrorX = unitFrameMirror(animation.sourceFacing || animation.facing || "left", facing);
  const descriptor = sheetDescriptor(model, { species: "spiny-back-beetle" }, animation, index, sprite,
    animation.scale * (animation.registrationScale || 1), mirrorX, action);
  descriptor.smoothing = true;
  descriptor.source = { owner: sheet, size: animation.frameSize, index,
    x: prepared ? 0 : index % animation.columns * animation.frameSize,
    y: prepared ? 0 : Math.floor(index / animation.columns) * animation.frameSize };
  descriptor.selection = descriptor.source;
  if (ready(sprite)) return descriptor;
  if (!resources.beetleSprite?.complete || !resources.beetleSprite.naturalWidth) return null;
  descriptor.sprite = resources.beetleSprite;
  descriptor.source = null;
  descriptor.selection = null;
  descriptor.left = -model.BEETLE_SPRITE.pivotX / model.BEETLE_SPRITE.frameSize;
  descriptor.mirrorX = unitFrameMirror(model.BEETLE_SPRITE.sourceFacing || model.BEETLE_SPRITE.facing || "left", facing);
  descriptor.whole = true;
  return descriptor;
}

// Phase follows distance traveled by the root, measured in the same cell units
// as the displayed body. This changes only the visible gait, never movement.
export function creatureStrideFrame(model, agent, time, animation, displayedSizePerCell) {
  const stride = animation?.strideFrameRatio * displayedSizePerCell;
  if (!(stride > 0) || !Number.isFinite(stride) || agent.combat?.position?.moving ||
      !(agent.moveDuration > 0)) return null;
  const elapsed = time - agent.moveStartedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0 || time >= agent.moveStartedAt + agent.moveDuration) return null;
  const distance = Math.hypot(agent.x - agent.renderFromX, agent.y - agent.renderFromY);
  if (!(distance > 0) || !Number.isFinite(distance)) return null;
  const steps = Math.max(0, (agent.stepCount || 1) - 1) + elapsed / agent.moveDuration;
  return model.unitAnimationFrame(animation, steps * distance / stride * animation.durationMs);
}

// Combat snapshots can pause, retreat or advance by unequal distances. Keep a
// render-local phase tied to their projected root rather than a wall-time loop.
export function createCreatureStrideClock() {
  const phases = new Map();
  return {
    frame(model, agent, time, animation, stride, point, scope = "") {
      if (!(animation?.strideFrameRatio > 0) || !(stride > 0) || !Number.isFinite(stride) ||
          !Number.isFinite(point?.x) || !Number.isFinite(point?.y) || !Number.isFinite(time)) return null;
      const key = scope + ":" + (agent.id ?? agent.species), segment = agent.combat?.position?.moveStartedAt;
      const previous = phases.get(key);
      let phase = previous?.phase || 0;
      if (!previous || previous.segment !== segment || time < previous.time) phase = 0;
      else if (time > previous.time) {
        const dx = point.x - previous.x, dy = point.y - previous.y;
        const direction = Math.abs(dx) > 1e-9 ? Math.sign(dx * (agent.facing || 1)) : 1;
        phase += Math.hypot(dx, dy) / stride * direction;
      }
      phase = (phase % 1 + 1) % 1;
      phases.set(key, { ...point, time, segment, phase });
      if (phases.size > 512) phases.delete(phases.keys().next().value);
      return model.unitAnimationFrame(animation, phase * animation.durationMs);
    },
    clear() { phases.clear(); }
  };
}

export function creaturePresentationPose(model, agent, time, reducedMotion, resources, action) {
  if (!action) {
    if (agent.species === "spiny-back-beetle") return creaturePresentationPose(model, agent, time, reducedMotion, resources, "beetle");
    for (const candidate of ["hurt", "attack", "walk", agent.species === "talon-owl" ? "owl-idle" : "idle"]) {
      const descriptor = creaturePresentationPose(model, agent, time, reducedMotion, resources, candidate);
      if (descriptor) return descriptor;
    }
    return null;
  }
  if (action === "beetle") {
    const pose = model.beetleAnimationPose(agent, time);
    const index = reducedMotion && (pose.action === "idle" || pose.action === "walk") ? model.BEETLE_ANIMATIONS.idle.frames[0] : pose.frame;
    const facing = pose.action === "attack" ? agent.attack?.directionX || agent.facing || 1 : agent.facing;
    return beetlePresentationFrame(model, index, facing, pose.action, resources);
  }
  if (action === "owl-idle") {
    const elapsed = (time - (agent.animationStartedAt ?? 0)) * 1000;
    const index = reducedMotion || agent.mode !== "idle" ? 0 : model.talonOwlIdleFrame(elapsed);
    const animation = model.imageFrameGeometry(model.TALON_OWL_IDLE, index);
    const sprite = resources.owlFrames?.get(index);
    if (!sprite) return null;
    const descriptor = sheetDescriptor(model, agent, animation, index, sprite,
      animation.scale * (animation.registrationScale || 1), unitFrameMirror(animation.sourceFacing || animation.facing || "left", agent.facing || 1), "idle");
    descriptor.source = null;
    descriptor.selection = null;
    descriptor.whole = true;
    descriptor.smoothing = true;
    return descriptor;
  }
  if (action === "walk") {
    const pose = agent.species === "spring-keeper" ? model.springKeeperFlightPose(agent, time) : model.creatureWalkPose(agent, time);
    const entry = resources.walk.get(agent.species);
    if (!pose || !entry?.sprite.complete || !entry.sprite.naturalWidth) return null;
    const nativeFrame = reducedMotion ? pose.stage === "flight" ? 4 : 0 : pose.frame;
    const nativeAnimation = model.imageFrameGeometry(pose.animation, nativeFrame);
    const size = (agent.species === "talon-owl" ? model.TALON_OWL_IDLE.scale : 1.4 * entry.scale) *
      nativeAnimation.frameSize / (nativeAnimation.viewSize || nativeAnimation.frameSize);
    const displayScale = resources.walkDisplayScale?.(agent);
    const strideFrame = !reducedMotion && Number.isFinite(displayScale) ?
      creatureStrideFrame(model, agent, time, pose.animation, size * displayScale) : null;
    const frame = strideFrame ?? nativeFrame;
    const animation = frame === nativeFrame ? nativeAnimation : model.imageFrameGeometry(pose.animation, frame);
    const descriptor = sheetDescriptor(model, agent, animation, frame, entry.sprite, size, unitFrameMirror(animation.sourceFacing || animation.facing || "left", agent.facing || 1), action);
    descriptor.hop = !reducedMotion ? pose.hop || null : null;
    return descriptor;
  }
  if (action === "attack" || action === "hurt") {
    const pose = action === "attack" ? model.creatureAttackPose(agent, time) : model.creatureHurtPose(agent, time);
    const entry = pose && (action === "hurt" ? resources.hurt : pose.action === "ranged" ? resources.ranged : resources.attack).get(agent.species);
    if (!entry?.sprite.complete || !entry.sprite.naturalWidth) return null;
    const animation = model.imageFrameGeometry(pose.animation, pose.frame);
    let size = agent.species === "talon-owl" ? model.TALON_OWL_IDLE.scale : 1.4 * entry.scale;
    if (action === "attack") size *= animation.frameSize / animation.viewSize;
    size *= animation.registrationScale || 1;
    return sheetDescriptor(model, agent, animation, pose.frame, entry.sprite, size,
      action === "attack" ? !!pose.mirrorX : unitFrameMirror(animation.sourceFacing || animation.facing || "left", agent.facing || 1), pose.action || action);
  }
  if (action !== "idle") return null;
  const entry = resources.idle.get(agent.species);
  const movementEndedAt = agent.moveStartedAt + agent.moveDuration;
  const settledWalk = agent.mode === "walk" && agent.moveDuration > 0 &&
    Number.isFinite(movementEndedAt) && time >= movementEndedAt;
  if (!entry || !["idle", "fight"].includes(agent.mode) && !settledWalk || !entry.sprite.complete || !entry.sprite.naturalWidth) return null;
  const startedAt = settledWalk ? movementEndedAt : agent.animationStartedAt ?? agent.moveStartedAt ?? 0;
  const frame = reducedMotion ? 0 : model.unitAnimationFrame(entry.animation, (time - startedAt) * 1000);
  const animation = model.imageFrameGeometry(entry.animation, frame);
  const descriptor = sheetDescriptor(model, agent, animation, frame, entry.sprite,
    1.4 * entry.scale * (animation.registrationScale || 1), unitFrameMirror(animation.sourceFacing || animation.facing || "left", agent.facing || 1), action);
  descriptor.groundOffset = 1;
  return descriptor;
}

export function drawCreaturePresentation(context, descriptor, anchorX, anchorY, cell, outlineColor, drawOutline) {
  if (!descriptor) return false;
  const size = cell * descriptor.sizePerCell;
  const left = size * descriptor.left, top = size * descriptor.top;
  context.save();
  if (descriptor.smoothing) {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
  }
  context.translate(anchorX, anchorY);
  if (descriptor.mirrorX) context.scale(-1, 1);
  if (descriptor.hop) {
    const hop = descriptor.hop, pixel = size / 288, animation = descriptor.animation;
    context.translate(hop.targetX * pixel - size * animation.pivotX / animation.frameSize,
      hop.targetY * pixel - size * animation.pivotY / animation.frameSize);
    context.rotate(hop.rotation);
    context.translate(-hop.sourceX * pixel + size * animation.pivotX / animation.frameSize,
      -hop.sourceY * pixel + size * animation.pivotY / animation.frameSize);
  }
  if (outlineColor) drawOutline(descriptor.sprite, left, top, size, size, descriptor.selection, outlineColor);
  if (descriptor.whole) context.drawImage(descriptor.sprite, left, top, size, size);
  else {
    const source = descriptor.source;
    context.drawImage(descriptor.sprite, source.x, source.y, source.size, source.size, left, top, size, size);
  }
  context.restore();
  return true;
}