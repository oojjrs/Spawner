export function createUnitPresentation(options) {
  const Spawner = options.model;
  const AGENT_HEIGHT = options.height;
  const AGENT_FOOTSTEPS_PER_CELL = options.footsteps;
  const state = { get simSeconds() { return options.time(); } };
  const idleMotion = { get matches() { return options.reducedMotion(); } };
  const tribeArt = options.tribeArt;
  const unitAnimationSheets = options.sheets;
  const agentMovementSheets = options.movementSheets;
  const combatSheets = options.combatSheets;
  const agentParts = options.parts;
  const agentBaseParts = options.baseParts;
  const sproutRoots = options.roots;
  const agentHeadMotions = options.headMotions;
  const sproutCombatMounts = options.combatMounts;
  const foodDeliveries = { get(id) { return options.foodDelivery(id); } };
  const agentAttackFrame = Spawner.agentAttackFrame;
  const hasSynergy = Spawner.hasSynergy;
  const drawSelectionOutline = options.drawOutline;
  const agentSprite = options.sprite;
  const agentBirthPose = options.birthPose;
  const foodDeliveryPose = options.deliveryPose;
  const interpolatedAgentPosition = options.position;
  const unitDisplayScale = options.displayScale;
  const agentRangedImage = options.rangedImage;
  const drawAgentBirth = options.drawBirth;
  const createSurface = options.createSurface;
  const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));

  function agentIdlePose(agent, now) {
    let motion = agentHeadMotions.get(agent.id);
    const end = agent.moveStartedAt + (agent.moveDuration || 0);
    if (["harvest", "unload", "fight"].includes(agent.mode) ||
      agent.moveDuration && state.simSeconds < end + 0.36) {
      if (motion) motion.idleStartedAt = null;
      return null;
    }
    if (!motion) {
      motion = { step: agent.moveStartedAt + ":" + agent.stepCount, end,
        duration: agent.moveDuration, landedAt: -Infinity, time: state.simSeconds };
      agentHeadMotions.set(agent.id, motion);
    }
    if (motion.idleStartedAt == null || now < motion.idleStartedAt) motion.idleStartedAt = now;
    return Spawner.sproutIdlePose(now - motion.idleStartedAt, AGENT_HEIGHT);
  }

  function agentBobOffset(agent, now) {
    if (idleMotion.matches) return 0;
    const idle = agentIdlePose(agent, now);
    if (idle) return idle.bodyOffset;
    return Spawner.sproutBobOffset(agent.id, now, AGENT_HEIGHT);
  }

  function agentWalkPose(agent) {
    const appearance = Spawner.unitDisplayAttributes(agent);
    if ((agent.tribe || "bean") === "bean" && appearance.feet && !idleMotion.matches) {
      const roots = sproutRoots.pose(agent, interpolatedAgentPosition(agent), state.simSeconds);
      return roots.moving || roots.settling ? { ...roots, roots } : null;
    }
    const progress = agent.moveDuration ? (state.simSeconds - agent.moveStartedAt) / agent.moveDuration : 1;
    if (!appearance.feet || progress < 0 || progress >= 1 || idleMotion.matches) return null;
    const phase = (agent.stepCount - 1 + progress) * Math.PI * AGENT_FOOTSTEPS_PER_CELL;
    const sprint = hasSynergy(agent.attributes, ["feet", "feet"]) && agent.straightSteps > 4;
    const load = Math.min(1, agent.carrying / agent.stats.capacity);
    const dx = agent.x - agent.renderFromX;
    return { phase, stride: (appearance.feet > 1 ? 1.25 : 1) * (sprint ? 1.3 : 1),
      rotation: Math.sin(phase) * (appearance.feet > 1 ? 0.025 : 0.045) * (1 + load * 0.2) + dx * (sprint ? 0.085 : 0.018),
      bob: (1 - Math.cos(phase * 2)) * (appearance.feet > 1 ? 0.006 : 0.009), load, sprint };
  }

  function drawAgentFeet(ctx, agent, x, y, width, height, walk, outlineColor) {
    const appearance = Spawner.unitDisplayAttributes(agent);
    if (!appearance.feet || (agent.tribe || "bean") !== "bean") return;
    const roots = walk?.roots || (idleMotion.matches ? null : sproutRoots.pose(agent, interpolatedAgentPosition(agent), state.simSeconds));
    ctx.save(); ctx.translate(x, y); ctx.scale(width / 512, height / 512);
    sproutRoots.drawRig(ctx, agentParts.get("root-rig"), appearance.feet, roots,
      { rotation: walk?.rotation || 0, bob: walk?.bob || 0, pivot: 460 - agentBodyLift(appearance) },
      outlineColor ? (sprite, x, y, w, h) => drawSelectionOutline(sprite, x, y, w, h, null, outlineColor) : null);
    ctx.restore();
  }

  function agentJumpOffset(agent, position) {
    const appearance = Spawner.unitDisplayAttributes(agent);
    return Spawner.sproutJumpOffset(agent, appearance, position, AGENT_HEIGHT);
  }

  function agentAppearanceBodyPose(agent, now) {
    const pose = agentBodyPose(agent, now, foodDeliveryPose(agent));
    const attributes = Spawner.unitDisplayAttributes(agent);
    return !agent.species && (agent.tribe || "bean") === "bean" && !attributes.feet ?
      { ...pose, scaleX: 1, scaleY: 1 } : pose;
  }

  function agentBodyPose(agent, now, deliveryPose) {
    const appearance = Spawner.unitDisplayAttributes(agent);
    const lift = agentBodyLift(appearance);
    const walk = agentWalkPose(agent);
    return Spawner.sproutBodyPose(agent, appearance, state.simSeconds, AGENT_HEIGHT, deliveryPose, lift,
      walk, walk ? 0 : agentBobOffset(agent, now), idleMotion.matches);
  }

  function agentHeadPose(agent, now) {
    if (idleMotion.matches) return { leftRotation: 0, rightRotation: 0, leftScaleY: 1, rightScaleY: 1 };
    const time = state.simSeconds;
    const step = agent.moveStartedAt + ":" + agent.stepCount;
    const end = agent.moveStartedAt + (agent.moveDuration || 0);
    let motion = agentHeadMotions.get(agent.id);
    if (!motion || time < motion.time) {
      motion = { step, end, duration: agent.moveDuration, landedAt: -Infinity, time,
        idleStartedAt: motion?.idleStartedAt };
      agentHeadMotions.set(agent.id, motion);
    } else if (motion.step !== step) {
      if (motion.duration && time >= motion.end) motion.landedAt = motion.end;
      motion.step = step;
    }
    motion.end = end;
    motion.duration = agent.moveDuration;
    motion.time = time;
    const landedAt = agent.moveDuration && time >= end ? end : motion.landedAt;
    const appearance = Spawner.unitDisplayAttributes(agent);
    let actionAge = -1;
    if (agent.mode === "unload") {
      const delivery = foodDeliveries.get(agent.id) || agent.foodDelivery;
      if (delivery) actionAge = time - delivery.startedAt - (delivery.arrivesAt - delivery.startedAt) * 0.24;
    } else if (agent.attack) {
      actionAge = (time - agent.attack.hitAt) * agent.attack.speed;
    }
    return Spawner.sproutHeadPose(agent, appearance, time, landedAt, agentWalkPose(agent),
      agentIdlePose(agent, now), actionAge, idleMotion.matches);
  }

  function drawAgentHead(ctx, agent, x, y, width, height, now, outlineColor) {
    const appearance = Spawner.unitDisplayAttributes(agent);
    const antenna = appearance.antenna || 0;
    if (antenna) {
      const sprite = agentSprite(agent, "antenna");
      if (!sprite || sprite.complete === false || !(sprite.naturalWidth || sprite.width)) return;
      const lift = agentBodyLift(appearance);
      const root = (260 - lift) / 512;
      const pose = agentBirthPose(agent, true)?.head || agentHeadPose(agent, now);
      ctx.save();
      ctx.translate(x + width / 2, y + height * root);
      ctx.rotate(pose.leftRotation);
      ctx.scale(pose.leftScaleX ?? 1, pose.leftScaleY);
      if (outlineColor) drawSelectionOutline(sprite, -width / 2, -height * root, width, height, null, outlineColor);
      else ctx.drawImage(sprite, -width / 2, -height * root, width, height);
      ctx.restore();
      return;
    }
    const left = agentSprite(agent, "sprout-left");
    const right = agentSprite(agent, "sprout-right");
    const stem = agentSprite(agent, "sprout-stem");
    if (![left, right, ...(stem ? [stem] : [])].every(sprite => sprite && sprite.complete !== false && (sprite.naturalWidth || sprite.width))) return;
    const lift = agentBodyLift(appearance);
    const root = (110 - lift + 350 * 148.15 / 417) / 512;
    const pivots = [136 + 240 * 133.75 / 286, 136 + 240 * 151.95 / 286];
    const pose = agentBirthPose(agent, true)?.head || agentHeadPose(agent, now);
    for (const [sprite, sourceX, rotation, scaleX, scaleY] of [
      [left, pivots[0], pose.leftRotation, pose.leftScaleX ?? 1, pose.leftScaleY],
      [right, pivots[1], pose.rightRotation, pose.rightScaleX ?? 1, pose.rightScaleY]
    ]) {
      const pivot = sourceX / 512;
      ctx.save();
      ctx.translate(x + width * pivot, y + height * root);
      ctx.rotate(rotation);
      ctx.scale(scaleX, scaleY);
      if (outlineColor) drawSelectionOutline(sprite, -width * pivot, -height * root, width, height, null, outlineColor);
      else ctx.drawImage(sprite, -width * pivot, -height * root, width, height);
      ctx.restore();
    }
    if (stem) {
      if (outlineColor) drawSelectionOutline(stem, x, y, width, height, null, outlineColor);
      else ctx.drawImage(stem, x, y, width, height);
    }
  }

  function prepareSproutCombatFrames(entry, frameCount) {
    const animation = entry.animation, size = animation.frameSize;
    entry.bodyBounds = [];
    entry.bodyFrames = [];
    entry.floors = [];
    entry.attributeFrames = new Map();
    const surface = createSurface(1, 1);
    surface.width = surface.height = size;
    const context = surface.getContext("2d", { willReadFrequently: true });
    for (let index = 0; index < frameCount; index++) {
      context.clearRect(0, 0, size, size);
      context.drawImage(entry.sprite, index % animation.columns * size, Math.floor(index / animation.columns) * size,
        size, size, 0, 0, size, size);
      const data = context.getImageData(0, 0, size, size), pixels = data.data, mask = new Uint8Array(size * size);
      for (let pixel = 0; pixel < mask.length; pixel++) {
        const offset = pixel * 4;
        mask[pixel] = pixels[offset + 3] > 100 && pixels[offset] > 130 &&
          pixels[offset + 2] > pixels[offset] * .78 && pixels[offset + 1] - pixels[offset] < 35 ? 1 : 0;
      }
      let largest = 0, silhouette = [], bounds = { x: size * .25, y: size * .43, width: size * .5, height: size * .4 };
      for (let pixel = 0; pixel < mask.length; pixel++) {
        if (!mask[pixel]) continue;
        const queue = [pixel]; mask[pixel] = 0;
        let left = size, top = size, right = 0, bottom = 0;
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const current = queue[cursor], x = current % size, y = Math.floor(current / size);
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
          for (const next of [x > 0 ? current - 1 : -1, x + 1 < size ? current + 1 : -1, current - size, current + size]) {
            if (next < 0 || next >= mask.length || !mask[next]) continue;
            mask[next] = 0; queue.push(next);
          }
        }
        if (queue.length > largest) { largest = queue.length; silhouette = queue; bounds = { x: left, y: top, width: right - left, height: bottom - top }; }
      }
      entry.bodyBounds.push(bounds);
      let floor = bounds.y + bounds.height;
      for (let y = size - 1; y >= bounds.y + bounds.height / 2; y--) {
        let found = false;
        for (let x = Math.max(0, bounds.x - 2); x < Math.min(size, bounds.x + bounds.width + 2); x++)
          if (pixels[(y * size + x) * 4 + 3] > 100) { found = true; break; }
        if (found) { floor = y + 1; break; }
      }
      entry.floors.push(floor);
      const rows = Array.from({ length: size }, () => ({ left: size, right: 0 }));
      for (const pixel of silhouette) {
        const x = pixel % size, row = rows[Math.floor(pixel / size)];
        row.left = Math.min(row.left, x); row.right = Math.max(row.right, x + 1);
      }
      const margin = Math.max(1, Math.round(size * .008));
      for (let y = 0; y < bounds.y + bounds.height * .7; y++) {
        let left = size, right = 0;
        for (let row = Math.max(0, y - margin); row <= Math.min(size - 1, y + margin); row++) {
          left = Math.min(left, rows[row].left); right = Math.max(right, rows[row].right);
        }
        for (let x = 0; x < size; x++) if (x < left - margin || x >= right + margin) pixels[(y * size + x) * 4 + 3] = 0;
      }
      const body = createSurface(1, 1); body.width = body.height = size;
      body.getContext("2d").putImageData(data, 0, 0);
      entry.bodyFrames.push(body);
    }
  }

  function sproutCombatFrame(agent, entry, index) {
    if (!entry?.bodyBounds?.[index] || !entry.bodyFrames?.[index] || !entry.attributeFrames) return null;
    const attributes = Spawner.unitDisplayAttributes(agent);
    const deathRoots = agent.kind === "corpse" && attributes.feet > 0;
    if (deathRoots && [agentParts.get("feet-1"), agentBaseParts.get("body")].some(sprite =>
      !sprite || sprite.complete === false || !(sprite.naturalWidth || sprite.width))) return null;
    const key = agentAppearanceKey(attributes) + (deathRoots ? ":death-roots" : "");
    if (!entry.attributeFrames.has(key)) entry.attributeFrames.set(key, new Map());
    const frames = entry.attributeFrames.get(key);
    if (frames.has(index)) return frames.get(index);
    const feet = attributes.feet || 0;
    if (!sproutCombatMounts.has(feet)) {
      const body = agentSprite({ attributes: { feet } }, "body"), bounds = tribeArt.bounds(body, false);
      const scale = 512 / (body.naturalWidth || body.width);
      sproutCombatMounts.set(feet, { x: bounds.x * scale, y: bounds.y * scale, width: bounds.width * scale, height: bounds.height * scale });
    }
    const animation = entry.animation, size = animation.frameSize, mount = sproutCombatMounts.get(feet), body = entry.bodyBounds[index];
    const padding = feet ? Math.ceil(size / 4) : 0;
    const surface = createSurface(1, 1); surface.width = surface.height = size + padding * 2;
    const context = surface.getContext("2d"), scaleX = body.width / mount.width, scaleY = body.height / mount.height;
    const left = body.x - mount.x * scaleX, top = body.y - mount.y * scaleY;
    const roots = feet ? Spawner.sproutRootGeometry(feet) : null;
    const rootHeight = roots ? roots.height * scaleY : 0, rootWidth = roots ? roots.width * scaleX : 0;
    const cut = body.y + body.height + size * (deathRoots ? .02 : -.04);
    const rootTop = cut - rootHeight * .12;
    const lift = feet ? Math.max(0, rootTop + rootHeight - entry.floors[index]) : 0;
    context.translate(padding, padding - lift);
    if (feet) context.drawImage(agentParts.get("feet-1"),
      body.x + body.width / 2 - rootWidth / 2, rootTop, rootWidth, rootHeight);
    context.save();
    if (attributes.feet && !deathRoots) {
      context.beginPath(); context.rect(0, 0, size, cut); context.clip();
    }
    if (attributes.antenna) context.drawImage(entry.bodyFrames[index], 0, 0);
    else context.drawImage(entry.sprite, index % animation.columns * size, Math.floor(index / animation.columns) * size,
      size, size, 0, 0, size, size);
    context.restore();
    context.drawImage(agentSprite(agent, feet ? "attributes-no-feet" : "attributes"), left, top, 512 * scaleX, 512 * scaleY);
    frames.set(index, surface);
    return surface;
  }

  function drawAgentRanged(ctx, agent, centerX, floor, height, outlineColor) {
    if (agent.birth) return false;
    let pose = Spawner.unitRangedPose(agent, state.simSeconds);
    const lifecycle = pose && Spawner.unitRangedAppearance?.(agent)?.lifecycle;
    if (lifecycle) for (const clip of Object.values(lifecycle)) agentRangedImage(clip.image);
    if (!pose || ["harvest", "unload"].includes(agent.mode) && !pose.resourceRest && !["shoot", "hurt", "harvest", "throw"].includes(pose.action)) return false;
    const bodyPose = Spawner.unitAnimationPose(agent, state.simSeconds);
    const moving = agent.moveDuration > 0 && state.simSeconds >= agent.moveStartedAt &&
      state.simSeconds < agent.moveStartedAt + agent.moveDuration;
    if (bodyPose?.action === "hurt" && pose.action !== "hurt" ||
        !pose.resourceRest && !["shoot", "hurt", "walk", "harvest", "throw"].includes(pose.action) && (moving || bodyPose && bodyPose.action !== "idle")) return false;
    let sprite = agentRangedImage(pose.animation.image);
    if (!sprite && pose.idleFallback) {
      pose = { ...pose, animation: pose.idleFallback, frame: 0 };
      sprite = agentRangedImage(pose.animation.image);
    }
    if (!sprite) return false;
    if (pose.resource) {
      sprite = Spawner.unitRangedResourceFrame(sprite, pose, (width, height) => {
        const surface = createSurface(1, 1); surface.width = width; surface.height = height; return surface;
      }, idleMotion.matches);
      if (!sprite) return false;
    }
    const animation = pose.animation, frame = idleMotion.matches ? 0 : pose.frame;
    const size = Spawner.unitRangedDisplaySize(agent) / 100 * height / AGENT_HEIGHT / unitDisplayScale(agent) *
      (animation.secretionIdle ? animation.frameSize / animation.viewSize : 1);
    const left = -size * animation.pivotX / animation.frameSize, top = -size * animation.pivotY / animation.frameSize;
    const crop = { owner: sprite, index: frame, size: animation.frameSize,
      x: frame % animation.columns * animation.frameSize, y: Math.floor(frame / animation.columns) * animation.frameSize };
    ctx.save(); ctx.translate(centerX, floor);
    const facing = agent.combat ? agent.combat.side === 0 ? -1 : 1 :
      pose.action === "shoot" ? agent.attack?.directionX || agent.facing || 1 : agent.facing || 1;
    ctx.scale(facing < 0 ? -1 : 1, 1);
    if (outlineColor) drawSelectionOutline(sprite, left, top, size, size, crop, outlineColor);
    ctx.drawImage(sprite, crop.x, crop.y, animation.frameSize, animation.frameSize, left, top, size, size);
    ctx.restore(); return true;
  }

  function drawAgentBaseResource(ctx, agent, centerX, floor, height, outlineColor) {
    const pose = Spawner.unitBaseResourcePose(agent, state.simSeconds);
    if (!pose) return false;
    const entry = unitAnimationSheets.get(agent.tribe)?.get("idle");
    if (!entry?.sprite.complete || !entry.sprite.naturalWidth || !(entry.scale > 0)) return false;
    const sprite = Spawner.unitBaseResourceFrame(entry.sprite, pose, (width, height) => {
      const surface = createSurface(1, 1); surface.width = width; surface.height = height; return surface;
    }, idleMotion.matches);
    if (!sprite) return false;
    const animation = pose.animation, size = height * entry.scale;
    const left = -size * animation.pivotX / animation.frameSize, top = -size * animation.pivotY / animation.frameSize;
    const crop = { owner: sprite, index: 0, size: sprite.width, x: 0, y: 0 };
    const facing = agent.combat ? agent.combat.side === 0 ? -1 : 1 : agent.facing || 1;
    ctx.save(); ctx.translate(centerX, floor); ctx.scale(facing < 0 ? -1 : 1, 1);
    if (outlineColor) drawSelectionOutline(sprite, left, top, size, size, crop, outlineColor);
    ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, left, top, size, size);
    ctx.restore();
    return pose;
  }

  function drawAgentAnimation(ctx, agent, centerX, floor, height, outlineColor) {
    if (drawAgentRanged(ctx, agent, centerX, floor, height, outlineColor)) return true;
    const resourcePose = drawAgentBaseResource(ctx, agent, centerX, floor, height, outlineColor);
    if (resourcePose) return resourcePose;
    const attributes = Spawner.unitDisplayAttributes(agent);
    let pose = Spawner.unitAnimationPose(agent, state.simSeconds);
    if (!pose) return false;
    if ((agent.tribe || "bean") !== "bean") pose = tribeArt.animationPose(agent, pose, state.simSeconds);
    const customized = (agent.tribe || "bean") === "bean" && ["strength", "arms", "feet", "antenna"].some(key => attributes[key] > 0);
    const combat = ["attack", "hurt"].includes(pose.action);
    if (customized && !combat) return false;
    const sheets = unitAnimationSheets.get(agent.tribe || "bean");
    const entry = sheets?.get(pose.sourceAction || pose.action) || (["harvest", "throw"].includes(pose.action) ? sheets?.get("idle") : null);
    if (!entry?.sprite.complete || !entry.sprite.naturalWidth) return false;
    let animation = pose.sourceAnimation || pose.animation;
    const index = idleMotion.matches ? 0 : pose.sourceFrame ?? pose.frame;
    const attributeAction = pose.action === "walk" && agent.carrying > 0 ? "carry" : pose.action;
    const motionTime = pose.action === "harvest" ? state.simSeconds - agent.harvestStarted :
      pose.action === "throw" ? state.simSeconds - agent.foodDelivery.startedAt : state.simSeconds;
    const attributeFrame = (agent.tribe || "bean") === "bean" ||
      !["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0) ? null :
      tribeArt.animationFrame(agent, entry.sprite, animation, index, attributeAction, motionTime, pose);
    const composedFrame = attributeFrame || (customized && combat ? sproutCombatFrame(agent, entry, index) : null);
    const sprite = composedFrame || entry.frames?.get(index) || entry.sprite;
    if (!sprite) return false;
    animation = Spawner.imageFrameGeometry(animation, index);
    const frameSize = composedFrame ? sprite.width : animation.frameSize;
    const padding = (frameSize - animation.frameSize) / 2;
    const size = height * entry.scale * frameSize / animation.frameSize;
    const left = -size * (animation.pivotX + padding) / frameSize;
    const top = -size * (animation.pivotY + padding) / frameSize;
    const frame = { owner: sprite, size: frameSize, index: sprite === entry.sprite ? index : 0,
      x: sprite === entry.sprite ? index % animation.columns * animation.frameSize : 0,
      y: sprite === entry.sprite ? Math.floor(index / animation.columns) * animation.frameSize : 0 };
    const facing = agent.tribe === "pebble" && pose.action === "walk" ? 1 : agent.combat ? agent.combat.side === 0 ? -1 : 1 :
      pose.action === "attack" ? agent.attack?.directionX || agent.facing || 1 : agent.facing || 1;
    ctx.save();
    ctx.translate(centerX, floor);
    ctx.scale(facing < 0 ? -1 : 1, 1);
    if (outlineColor) drawSelectionOutline(sprite, left, top, size, size, frame, outlineColor);
    ctx.drawImage(sprite, frame.x, frame.y, frameSize, frameSize, left, top, size, size);
    ctx.restore();
    return pose;
  }

  function drawAgentMovement(ctx, agent, centerX, footY, height, outlineColor) {
    const animation = agentMovementSheets.get(agent.tribe);
    const elapsed = state.simSeconds - agent.moveStartedAt;
    if (!animation || !agent.moveDuration || elapsed < 0 || elapsed >= agent.moveDuration ||
      !animation.sprite.complete || !animation.sprite.naturalWidth) return false;
    const pose = Spawner.unitAnimationPose(agent, state.simSeconds);
    const index = idleMotion.matches || pose?.action !== "walk" ? 0 : pose.frame;
    const sprite = animation.sprite;
    const size = height * animation.scale;
    const frameSize = animation.frameSize;
    const frame = { owner: sprite, size: frameSize, index, x: index % animation.columns * frameSize, y: Math.floor(index / animation.columns) * frameSize };
    ctx.save();
    ctx.translate(centerX, footY);
    ctx.scale(agent.tribe === "pebble" ? 1 : agent.facing < 0 ? -1 : 1, 1);
    if (outlineColor) drawSelectionOutline(sprite, -size * animation.pivotX / frameSize, -size * animation.pivotY / frameSize, size, size, frame, outlineColor);
    ctx.drawImage(sprite, frame.x, frame.y, frameSize, frameSize, -size * animation.pivotX / frameSize, -size * animation.pivotY / frameSize, size, size);
    ctx.restore();
    return true;
  }

  function drawAgentAttack(ctx, agent, centerX, footY, height, outlineColor) {
    const appearance = Spawner.unitDisplayAttributes(agent);
    const attackFrame = agentAttackFrame(agent.attack, state.simSeconds);
    const hurtFrame = Spawner.combatHurtFrame(agent, state.simSeconds);
    const action = attackFrame >= 0 ? "attack" : "hurt";
    const index = attackFrame >= 0 ? attackFrame : hurtFrame;
    if (index < 0) return false;
    const customized = (agent.tribe || "bean") === "bean" && ["strength", "arms", "feet", "antenna"].some(key => appearance[key] > 0);
    const sprite = customized ? sproutCombatFrame(agent, unitAnimationSheets.get("bean")?.get(action), index) : combatSheets.get(agent.tribe || "bean")?.[action];
    if (!sprite || sprite.complete === false || !(sprite.naturalWidth || sprite.width)) return false;
    const size = height * .94;
    const frameSize = customized ? sprite.width : sprite.naturalWidth / 4;
    const frame = { owner: sprite, size: frameSize, index: customized ? 0 : index,
      x: customized ? 0 : index % 4 * frameSize, y: customized ? 0 : Math.floor(index / 4) * frameSize };
    ctx.save();
    ctx.translate(centerX, footY - height * .054);
    ctx.scale(agent.combat ? agent.combat.side === 0 ? -1 : 1 : agent.attack?.directionX || agent.facing || 1, 1);
    const pivot = 448 / 512;
    if (outlineColor) drawSelectionOutline(sprite, -size / 2, -size * pivot, size, size, frame, outlineColor);
    ctx.drawImage(sprite, frame.x, frame.y, frameSize, frameSize, -size / 2, -size * pivot, size, size);
    ctx.restore();
    return true;
  }

  function drawAgentAppearanceBody(ctx, now, agent, cell, topLeft, renderPosition, birth, outlineColor) {
    if (birth) {
      drawAgentBirth(ctx, now, agent, birth, topLeft, cell, outlineColor);
      return;
    }
    const spriteHeight = cell * AGENT_HEIGHT;
    const centerX = topLeft.x + cell / 2;
    const centerY = topLeft.y + cell / 2;
    const appearance = Spawner.unitDisplayAttributes(agent);
    const bodyPose = agentAppearanceBodyPose(agent, now);
    const walk = agentWalkPose(agent);

    if (cell < 8) {
      if (outlineColor) {
        drawSelectionOutline(options.selectionShape(),
          Math.floor(centerX - 1), Math.floor(centerY - 1), 3, 3, null, outlineColor);
      }
      ctx.fillStyle = agent.carrying > 0 ? "#d6b26b" : "#75c4b6";
      ctx.fillRect(
        Math.floor(centerX - 1),
        Math.floor(centerY - 1),
        3,
        3
      );
      return;
    }

    const spriteY = centerY - spriteHeight / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      topLeft.x - cell * 0.1,
      topLeft.y - cell * 0.6,
      cell * 1.2,
      cell * 1.7
    );
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const animated = drawAgentAnimation(ctx, agent, centerX, spriteY + spriteHeight * .94, spriteHeight, outlineColor);
    const attacking = !animated && drawAgentAttack(ctx, agent, centerX, spriteY + spriteHeight * .94, spriteHeight, outlineColor);
    const moving = !animated && !attacking && drawAgentMovement(ctx, agent, centerX, spriteY + spriteHeight * .94, spriteHeight, outlineColor);
    const sprite = !animated && !attacking && !moving ? agentSprite(agent, "body") : null;
    if (!animated && !attacking && !moving && sprite && sprite.complete !== false && (sprite.naturalWidth || sprite.width) > 0) {
      const spriteWidth = spriteHeight * (sprite.naturalWidth || sprite.width) / (sprite.naturalHeight || sprite.height);
      const spriteX = topLeft.x + (cell - spriteWidth) / 2;
      const footY = spriteY + spriteHeight * 0.94;
      const bodyOffset = spriteHeight * (bodyPose.pivot - 0.94);
      ctx.translate(centerX, footY);
      drawAgentFeet(ctx, agent, spriteX - centerX, spriteY - footY, spriteWidth, spriteHeight, walk, outlineColor);
      ctx.translate(0, bodyOffset - (walk ? walk.bob * spriteHeight : 0));
      ctx.rotate(walk ? walk.rotation : 0);
      if (outlineColor) {
        ctx.save();
        ctx.scale(bodyPose.scaleX, bodyPose.scaleY);
        drawAgentHead(ctx, agent, spriteX - centerX, -spriteHeight * bodyPose.pivot,
          spriteWidth, spriteHeight, now, outlineColor);
        drawSelectionOutline(sprite, spriteX - centerX, -spriteHeight * bodyPose.pivot,
          spriteWidth, spriteHeight, null, outlineColor);
        ctx.restore();
      }
      ctx.scale(bodyPose.scaleX, bodyPose.scaleY);
      drawAgentHead(ctx, agent, spriteX - centerX, -spriteHeight * bodyPose.pivot,
        spriteWidth, spriteHeight, now, null);
      ctx.drawImage(sprite, spriteX - centerX, -spriteHeight * bodyPose.pivot,
        spriteWidth, spriteHeight);
    }
    ctx.restore();
  }

  function agentAppearanceKey(attributes) {
    return [attributes.strength ?? attributes.arms ?? 0, attributes.feet || 0,
      attributes.antenna || 0].join(":");
  }

  function agentBodyLift(attributes) {
    if (!attributes.feet) return 0;
    const height = Spawner.sproutRootGeometry(attributes.feet).height;
    const lift = 426 - 512 * .94 + height * .88;
    return lift;
  }

  function composeAgentAntennae(context, attributes) {
    const count = attributes.antenna;
    if (!count) return;
    const lift = agentBodyLift(attributes);
    const part = agentParts.get("antenna-" + (count === 1 ? 1 : 2));
    const width = count === 1 ? 196 : 344 + (count - 2) * 16;
    const height = width * part.naturalHeight / part.naturalWidth;
    context.drawImage(part, 256 - width / 2, 260 - lift - height, width, height);
  }

  function composeAgentBaseFeet(context, attributes, layer) {
    if (attributes.feet) return;
    const sourceHeight = 153;
    const top = 110, height = 350, y = 136;
    const part = agentBaseParts.get("green-foot");
    for (const [index, x] of [16.5, 66.5].entries()) {
      if (layer === "feet-left" && index || layer === "feet-right" && !index) continue;
      context.drawImage(part, 136 + x * 240 / 104, top + y * height / sourceHeight,
        20 * 240 / 104, 16 * height / sourceHeight);
    }
  }

  function composeAgentSprite(attributes, layer) {
    const expression = layer === "body-half" ? "half" : layer === "body-closed" ? "closed" : "open";
    if (layer === "body-half" || layer === "body-closed") layer = "body";
    const portraitPadding = 0;
    const sprite = createSurface(1, 1);
    const resolution = Math.max(512, Math.ceil(options.maxZoom() * AGENT_HEIGHT * options.pixelRatio() * 2 / 256) * 256);
    sprite.width = sprite.height = resolution * (512 + portraitPadding * 2) / 512;
    const context = sprite.getContext("2d");
    context.scale(resolution / 512, resolution / 512);
    context.translate(portraitPadding, portraitPadding);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const lift = agentBodyLift(attributes);
    if (layer === "sprout-left" || layer === "sprout-right" || layer === "sprout-stem") {
      if (!attributes.antenna) context.drawImage(agentBaseParts.get(layer), 136, 110 - lift, 240, 350);
      return sprite;
    }
    if (layer === "antenna") {
      composeAgentAntennae(context, attributes);
      return sprite;
    }
    if (attributes.feet && layer !== "body" && layer !== "attributes-no-feet") {
      const { width, height } = Spawner.sproutRootGeometry(attributes.feet);
      const part = agentParts.get("feet-1");
      if (layer === "feet-left" || layer === "feet-right") {
        const right = layer === "feet-right" ? 1 : 0;
        context.drawImage(part, right * part.naturalWidth / 2, 0, part.naturalWidth / 2, part.naturalHeight,
          256 - width / 2 + right * width / 2, 512 * 0.94 - height, width / 2, height);
      } else sproutRoots.drawRig(context, agentParts.get("root-rig"), attributes.feet, null,
        { rotation: 0, bob: 0, pivot: 460 - lift }, null);
    }
    if (["feet", "feet-left", "feet-right"].includes(layer)) {
      if (!attributes.feet) composeAgentBaseFeet(context, attributes, layer);
      return sprite;
    }
    if (attributes.antenna && layer !== "body") composeAgentAntennae(context, attributes);
    if (layer !== "attributes" && layer !== "attributes-no-feet") {
      context.save();
        if (layer !== "body" && !attributes.antenna)
          for (const name of ["sprout-left", "sprout-right", "sprout-stem"])
            context.drawImage(agentBaseParts.get(name), 136, 110 - lift, 240, 350);
        context.drawImage(agentBaseParts.get("body"),
          136, 110 - lift, 240, 350);
      context.restore();
      composeAgentBaseFeet(context, attributes, layer);
    }
    if (attributes.strength) {
      const width = (344 + (attributes.strength - 1) * 24) * 0.78;
      const height = (142 + (attributes.strength - 1) * 12) * 0.78;
      context.drawImage(agentParts.get("strength-" + (attributes.strength === 1 ? 1 : 2)),
        256 - width / 2, 460 - lift - height, width, height);
    }
    return sprite;
  }

  function drawRootMotion(ctx, now, agent, cell, topLeft, renderPosition, birth, drawBody) {
    const attributes = Spawner.unitDisplayAttributes(agent);
    const jumping = !birth && !agent.species && (agent.tribe || "bean") === "bean" && !attributes.feet;
    ctx.save();
    if (jumping) {
      const centerX = topLeft.x + cell / 2, floor = topLeft.y + cell * (.5 + AGENT_HEIGHT * .44);
      const pose = agentBodyPose(agent, now, foodDeliveryPose(agent));
      ctx.translate(centerX, floor - agentJumpOffset(agent, renderPosition) * cell);
      ctx.scale(pose.scaleX, pose.scaleY);
      ctx.translate(-centerX, -floor);
    }
    drawBody();
    ctx.restore();
  }

  return { agentIdlePose, agentBobOffset, agentWalkPose, drawAgentFeet, agentJumpOffset, agentAppearanceBodyPose, agentBodyPose, agentHeadPose, drawAgentHead, prepareSproutCombatFrames, sproutCombatFrame, drawAgentRanged, drawAgentBaseResource, drawAgentAnimation, drawAgentMovement, drawAgentAttack, drawAgentAppearanceBody, agentAppearanceKey, agentBodyLift, composeAgentAntennae, composeAgentBaseFeet, composeAgentSprite, drawRootMotion };
}
