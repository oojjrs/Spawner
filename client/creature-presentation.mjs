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
  const mirrorX = animation.facing === "right" ? facing < 0 : facing > 0;
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
  descriptor.mirrorX = attack ? !mirrorX : mirrorX;
  descriptor.whole = true;
  return descriptor;
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
      animation.scale * (animation.registrationScale || 1), agent.facing > 0, "idle");
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
    const frame = reducedMotion ? pose.stage === "flight" ? 4 : 0 : pose.frame;
    const animation = model.imageFrameGeometry(pose.animation, frame);
    const size = (agent.species === "talon-owl" ? model.TALON_OWL_IDLE.scale : 1.4 * entry.scale) *
      animation.frameSize / (animation.viewSize || animation.frameSize);
    const descriptor = sheetDescriptor(model, agent, animation, frame, entry.sprite, size, agent.facing > 0, action);
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
      action === "attack" ? !!pose.mirrorX : agent.facing > 0, pose.action || action);
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
    1.4 * entry.scale * (animation.registrationScale || 1), agent.facing > 0, action);
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