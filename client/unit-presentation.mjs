import { unitFacing, unitDisplaySize, unitFrameMirror } from "./unit-size.mjs";
import { createUnitActionArt, unitActionArtPose } from "./unit-action-art.mjs";
import { agentBirthMotion } from "../server/birth.mjs";

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
  const actionArt = createUnitActionArt(path => globalThis.SpawnerAssets?.source(path) || path, createSurface, async path => {
    const source = await globalThis.SpawnerAssets?.load?.(path) || globalThis.SpawnerAssets?.source(path) || path;
    const image = globalThis.SpawnerAssets?.image?.() || new Image(); image.src = source; await image.decode(); return image;
  });
  function hasEmbeddedCargo(agent) { const pose = unitActionArtPose(agent, options.time()); return !!pose?.animation.embeddedCargo && actionArt.readyAction(agent, options.time()); }
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

  function drawAgentFeet() {}

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

  function drawAgentHead() {}

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

  function sproutCombatFrame() { return null; }

  function drawAgentRanged() { return false; }

  function drawAgentBaseResource() { return false; }

  function drawAgentAnimation(ctx, agent, centerX, floor, height, outlineColor) {
    const pose = unitActionArtPose(agent, state.simSeconds);
    if (!pose) return false;
    const scale = options.displayScale(agent) || 1;
    const facing = unitFacing(agent);
    if (pose.action === "birth" && options.drawPackedPebbleBirth) {
      const result = options.drawPackedPebbleBirth(ctx, agent, state.simSeconds, centerX, floor,
        height / AGENT_HEIGHT / scale, facing < 0, outlineColor, options.birthSurface?.());
      if (result?.handled) return pose;
    }
    actionArt.draw(ctx, agent, state.simSeconds, centerX, floor, height / AGENT_HEIGHT / scale, facing < 0,
      outlineColor ? (context, image, crop, destination) => drawSelectionOutline(image,
        destination.x, destination.y, destination.width, destination.height,
        { owner: image, x: crop.x, y: crop.y, size: crop.width, height: crop.height, index: pose.frame }, outlineColor) : null);
    return pose;
  }

  function drawAgentMovement(ctx, agent, centerX, floor, height, outlineColor) {
    return drawAgentAnimation(ctx, agent, centerX, floor, height, outlineColor);
  }

  function drawAgentAttack(ctx, agent, centerX, floor, height, outlineColor) {
    return drawAgentAnimation(ctx, agent, centerX, floor, height, outlineColor);
  }

  function drawAgentAppearanceBody(ctx, now, agent, cell, topLeft, renderPosition, birth, outlineColor) {
    let x = topLeft.x + cell / 2, floor = topLeft.y + cell * (.5 + AGENT_HEIGHT * .44);
    const animation = unitActionArtPose(agent, state.simSeconds)?.animation;
    const scene = animation?.scene;
    if (birth && animation?.worldTravelIncludedInPixels) {
      // The complete scene already travels from its nest to the final body.
      // Anchor that endpoint once instead of adding legacy root travel again.
      const scale = options.displayScale(agent) || 1;
      x += (birth.targetX - (renderPosition?.x ?? birth.x)) * cell / scale;
      floor += (birth.targetY - (renderPosition?.y ?? birth.y)) * cell / scale;
    } else if (birth?.outlet && scene) {
      const size = unitDisplaySize(agent) / animation.referenceLength;
      const scale = options.displayScale(agent) || 1;
      const facing = unitFrameMirror(animation.sourceFacing, unitFacing(agent)) ? -1 : 1;
      const elapsed = Math.max(0, (state.simSeconds - agent.birth.startedAt) * 1000);
      const age = clamp((elapsed - scene.travelStartMs) / (scene.travelEndMs - scene.travelStartMs), 0, 1);
      let progressX = age * age * (3 - 2 * age), progressY = progressX;
      if (agent.tribe === "bean") progressX = progressY = agentBirthMotion(elapsed / 1000, 0, 0)?.progress ?? 1;
      if (agent.tribe === "spring") { progressX = age; progressY = age * age; }
      if (agent.tribe === "spore") progressY = age < .25 ? 0 : ((age - .25) / .75) ** 2;
      const sourceX = (scene.outletX - animation.pivotX) * size * facing;
      const sourceY = (scene.outletY - animation.pivotY) * size;
      const targetX = birth.targetX + .5, targetY = birth.targetY + .5 + AGENT_HEIGHT * .44;
      x += (birth.targetX - (renderPosition?.x ?? birth.x) + (birth.outlet.x - targetX - sourceX) * (1 - progressX)) * cell / scale;
      floor += (birth.targetY - (renderPosition?.y ?? birth.y) + (birth.outlet.y - targetY - sourceY) * (1 - progressY)) * cell / scale;
    }
    return drawAgentAnimation(ctx, agent, x, floor, cell * AGENT_HEIGHT, outlineColor);
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
    drawBody();
  }

  return { hasEmbeddedCargo, animationReady: actionArt.readyFrame, prepareAnimation: actionArt.prepare, agentIdlePose, agentBobOffset, agentWalkPose, drawAgentFeet, agentJumpOffset, agentAppearanceBodyPose, agentBodyPose, agentHeadPose, drawAgentHead, prepareSproutCombatFrames, sproutCombatFrame, drawAgentRanged, drawAgentBaseResource, drawAgentAnimation, drawAgentMovement, drawAgentAttack, drawAgentAppearanceBody, agentAppearanceKey, agentBodyLift, composeAgentAntennae, composeAgentBaseFeet, composeAgentSprite, drawRootMotion };
}
