import { CREATURE_RANGED_ANIMATIONS } from "./creature-ranged.mjs";
import { drawCombatStun } from "./combat-stun-vfx.mjs";
import { drawSpeciesHeldHurt } from "./species-held-hurt.mjs";
import { beanHeldHurtSource, drawBeanHeldHurt } from "./bean-held-hurt.mjs";
import { combatDodgePose, drawCombatDodgeTrails, drawCombatDodgeGhosts, drawCombatDodgeLabel } from "./combat-dodge-vfx.mjs";
import { drawUnitHealthRing } from "./unit-health-ring.mjs";
import { createCombatStageAppearance } from "./combat-stage-appearance.mjs";
import { attackAnimationElapsed } from "../server/attack.mjs";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect, detailDefenseImageReady, drawDetailDefenseEffect, drawDetailDefenseFallback, drawDetailDefenseLabels } from "./combat-detail-vfx.mjs";
import { COMBAT_LAB_UNITS } from "./combat-lab.mjs";
import { createUnitAppearanceWorld } from "./unit-appearance-world.mjs";
import { AGENT_DEATH_ANIMATION } from "./agent-death.mjs";
import { imageAnimation, imageFrameGeometry } from "./image-geometry.mjs";
import { unitDisplaySize } from "./unit-size.mjs";
import { unitRangedAppearance, unitRangedPose, unitRangedDisplaySize, unitRangedProjectile, unitRangedLifecycleAnimation } from "./unit-ranged.mjs";
import { UNIT_IMAGE_BOUNDS } from "./unit-image-bounds.mjs";
import { UNIT_ANIMATIONS, CREATURE_IDLE_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, CREATURE_HURT_ANIMATIONS, CREATURE_DEATH_ANIMATIONS, unitAnimationPose, unitAnimationFrame, creatureHurtPose, creatureAttackPose } from "./unit-animation.mjs";
import { TALON_OWL_IDLE, talonOwlIdleFrame } from "./talon-owl-idle.mjs";
import { BEETLE_SPRITE, BEETLE_ATTACK_SPRITE, BEETLE_ANIMATIONS, BEETLE_NEUTRAL_ASSET, beetleAnimationFrame, beetleAnimationPose } from "../server/beetle-animation.mjs";

const colors = ["#c4e19c", "#efba90"];
const reactionLabels = { dodge: "회피", parry: "패링", block: "방어", stun: "기절", counter: "반격", heal: "치유", shoot: "사격" };
const beetleCorpse = imageAnimation({ image: "DesignAssets/Animations/BeetleDeath/dead-v2.png", frameSize: 185, columns: 1, pivotX: 95.5, pivotY: 163 });

function stageAgent(agent) {
  if (agent.labAppearance) agent = { ...agent, tribe: UNIT_ANIMATIONS[agent.key] ? agent.key : undefined,
    species: UNIT_ANIMATIONS[agent.key] ? undefined : agent.key };
  if (!agent.species && !agent.tribe && agent.key) agent = UNIT_ANIMATIONS[agent.key] ? { ...agent, tribe: agent.key } : { ...agent, species: agent.key };
  // Laboratory builds have capability flags rather than DNA appearance traits.
  // Keep this inference on a render-local copy, never on the simulation agent.
  if (!agent.species && agent.combat?.id === "simulation" && !agent.dna && !agent.appearanceAttributes &&
      !Object.keys(agent.attributes || {}).length && (agent.stats?.melee || agent.stats?.ranged))
    return { ...agent, appearanceAttributes: { ...(agent.stats.melee ? { blade: 1 } : {}), ...(agent.stats.ranged ? { secretion: 1 } : {}) } };
  return agent;
}

function bodyDimensions(agent) {
  agent = stageAgent(agent);
  const key = agent.species || agent.tribe || agent.key;
  const idle = UNIT_ANIMATIONS[key]?.idle || CREATURE_IDLE_ANIMATIONS[key] ||
    (key === "talon-owl" ? TALON_OWL_IDLE : BEETLE_SPRITE);
  const reference = UNIT_IMAGE_BOUNDS[idle.image], scale = unitDisplaySize(agent) / Math.max(reference.width, reference.height);
  return { width: reference.width * scale, height: reference.height * scale };
}

function impactKey(source, target, at, amount) {
  return JSON.stringify([String(source), String(target), at, amount]);
}

function flightKey(source, target, launch, arrival) {
  return JSON.stringify([String(source), String(target), launch, arrival]);
}

function displaySize(agent, pose) {
  if (pose?.animation.rangedBody || !pose && unitRangedAppearance(agent)) return unitRangedDisplaySize(agent);
  const key = agent.species || agent.tribe || agent.key;
  const idle = UNIT_ANIMATIONS[key]?.idle || CREATURE_IDLE_ANIMATIONS[key] ||
    (key === "talon-owl" ? TALON_OWL_IDLE : BEETLE_SPRITE);
  if (UNIT_ANIMATIONS[key] && pose) {
    const reference = UNIT_IMAGE_BOUNDS[idle.image], action = UNIT_IMAGE_BOUNDS[pose.animation.bodyReferenceImage || pose.animation.image];
    const idleRatio = idle.frameSize / reference.frameSize, actionRatio = pose.animation.frameSize / action.frameSize;
    const fit = Math.min(reference.bodyWidth / (action.width * actionRatio), reference.bodyHeight / (action.height * actionRatio));
    const idleFit = Math.min(reference.bodyWidth / (reference.width * idleRatio), reference.bodyHeight / (reference.height * idleRatio));
    const scale = 100 * unitDisplaySize(agent) * fit / (idleFit * Math.max(reference.width, reference.height) * idleRatio);
    return scale * (pose.animation.viewSize || pose.animation.frameSize) / (pose.animation.registrationScale || 1);
  }
  const reference = pose && ["death", "dead"].includes(pose.action) ? pose.animation : idle;
  const bounds = UNIT_IMAGE_BOUNDS[reference.image];
  const length = Math.max(bounds.width, bounds.height) * reference.frameSize / bounds.frameSize;
  return 100 * unitDisplaySize(agent) * (reference.viewSize || reference.frameSize) /
    ((reference.registrationScale || 1) * length);
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function poseFor(agent, time, deathAge) {
  const ranged = unitRangedPose(agent, time);
  if (ranged) return ranged;
  const death = unitRangedLifecycleAnimation(agent, "death") || (agent.tribe === "bean" ? AGENT_DEATH_ANIMATION : UNIT_ANIMATIONS[agent.tribe]?.death || CREATURE_DEATH_ANIMATIONS[agent.species]);
  if (agent.health <= 0 && death) return { action: "death", animation: death, frame: unitAnimationFrame(death, deathAge * 1000) };
  if (agent.species === "spiny-back-beetle") {
    if (agent.health <= 0) return deathAge * 1000 < BEETLE_ANIMATIONS.death.durationMs ?
      { action: "death", animation: BEETLE_SPRITE, frame: beetleAnimationFrame("death", deathAge * 1000) } :
      { action: "dead", animation: beetleCorpse, frame: 0 };
    const beetle = beetleAnimationPose(agent, time);
    // Keep the shared pose's hitAt/endsAt mapping. Sampling raw wall time here
    // made fast attacks land during windup and slow attacks finish before contact.
    return { ...beetle, animation: beetle.action === "attack" ? BEETLE_ATTACK_SPRITE : BEETLE_SPRITE };
  }
  const pose = creatureHurtPose(agent, time) || creatureAttackPose(agent, time) || unitAnimationPose(agent, time);
  if (pose) return pose;
  const idle = UNIT_ANIMATIONS[agent.tribe]?.idle || CREATURE_IDLE_ANIMATIONS[agent.species];
  if (idle) return { action: "idle", animation: idle, frame: unitAnimationFrame(idle, time * 1000) };
  if (agent.species === "talon-owl") return { animation: TALON_OWL_IDLE, frame: talonOwlIdleFrame(time * 1000) };
  return pose;
}

export function createCombatStage(canvas) {
  const context = canvas.getContext("2d"), images = new Map(), imageRetryAt = new Map();
  const appearanceWorld = createUnitAppearanceWorld();
  const representativeArt = createCombatStageAppearance(image);
  const vfxCursor = createCombatVfxCursor(), detailVfx = createDetailCombatVfx();
  let appearancePoses = new Map(), dodgePositions = new Map(), dodgeCues = [];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const deathStarted = new Map(), readyPoses = new Map();
  let currentTrial, previousTime = null, seen = 0, effects = [], clock = 0, lastNow = 0;

  function image(source) {
    if (!source) return null;
    const previous = images.get(source);
    if (!previous || previous.complete && !previous.naturalWidth && Date.now() >= (imageRetryAt.get(source) || 0)) {
      const asset = globalThis.SpawnerAssets?.image?.() || new Image();
      asset.src = globalThis.SpawnerAssets?.source(source) || source;
      images.set(source, asset); imageRetryAt.set(source, Date.now() + 2000);
    }
    const asset = images.get(source);
    return asset.complete && asset.naturalWidth ? asset : null;
  }

  function background(width, height) {
    context.fillStyle = "#273d31";
    context.fillRect(0, 0, width, height);
    const ground = image("DesignAssets/Combat/grassland.webp");
    if (!ground) return;
    const scale = Math.max(width / ground.naturalWidth, height / ground.naturalHeight);
    const drawnWidth = ground.naturalWidth * scale, drawnHeight = ground.naturalHeight * scale;
    context.drawImage(ground, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
  }
  function position(agent, index, width, height, time) {
    const direction = index === 0 ? 1 : -1;
    const attack = agent.attack;
    // Registered support-locked attacks already move the body around a planted
    // foot. A second arena lunge would drag that contact across the ground.
    const fixedSupport = CREATURE_ATTACK_ANIMATIONS[stageAgent(agent).species]?.fixedSupport;
    let lunge = 0;
    if (attack && attack.mode !== "ranged" && attack.attackMode !== "ranged" && !attack.dnaRanged && !fixedSupport && !reducedMotion.matches) {
      if (attack.meleeContacts?.length > 1) {
        const elapsed = attackAnimationElapsed(attack, time, .3, 1);
        const windup = clamp(elapsed / .3), recovery = clamp((elapsed - .3) / .7);
        lunge = elapsed < .3 ? -8 * Math.sin(windup * Math.PI) + 45 * windup ** 4 : 45 * (1 - recovery) ** 2;
      } else {
        const windup = clamp((time - attack.startedAt) / Math.max(.001, attack.hitAt - attack.startedAt));
        const recovery = clamp((time - attack.hitAt) / Math.max(.001, attack.endsAt - attack.hitAt));
        lunge = time < attack.hitAt ? -8 * Math.sin(windup * Math.PI) + 45 * windup ** 4 : 45 * (1 - recovery) ** 2;
      }
    }
    const recent = effects.filter(effect => effect.event.targetId === agent.id && clock - effect.born < .22);
    const impact = recent.find(effect => effect.event.damage > 0 && effect.event.kind !== "bleed");
    const dodge = currentTrial?.vfx?.version !== 1 && recent.find(effect => effect.event.kind === "dodge");
    const age = impact ? (clock - impact.born) / .22 : 1;
    const recoil = reducedMotion.matches ? 0 : impact ? Math.sin(age * Math.PI) * 16 : dodge ? 26 * Math.sin((clock - dodge.born) / .22 * Math.PI) : 0;
    const distance = currentTrial?.agents.every(entry => Number.isFinite(entry.x)) ? Math.abs(currentTrial.agents[1].x - currentTrial.agents[0].x) : 1;
    const gap = Math.min(.64, .2 * Math.max(1, distance));
    const members = currentTrial.agents.filter(other => (other.combat?.side ?? other.side) === index);
    if (currentTrial.agents.length > 2) {
      const slot = members.indexOf(agent), columns = Math.ceil(Math.sqrt(members.length)), rows = Math.ceil(members.length / columns);
      return { x: width * (index === 0 ? .12 + .28 * ((slot % columns + .5) / columns) : .88 - .28 * ((slot % columns + .5) / columns)) + direction * (lunge - recoil) * width / 1040,
        y: height * (.35 + .43 * ((Math.floor(slot / columns) + 1) / rows)), direction };
    }
    return { x: width * (.5 - direction * gap / 2) + direction * (lunge - recoil) * width / 1040, y: Math.round(height * .79), direction };
  }

  function formationScale(width, height) {
    const bounds = currentTrial.agents.map(bodyDimensions);
    const maxWidth = Math.max(.4, ...bounds.map(bound => bound.width));
    const maxHeight = Math.max(.4, ...bounds.map(bound => bound.height));
    return Math.min(width * .31, width * .22 / maxWidth, height * .43 / maxHeight) / 100;
  }

  function readyPose(agent, requested, time) {
    const ranged = unitRangedAppearance(agent);
    if (ranged) { image(ranged.idle.image); image(ranged.animation.image); if (ranged.hurt) image(ranged.hurt.image); image(unitRangedProjectile(agent).image); }
    if (ranged?.lifecycle) for (const clip of Object.values(ranged.lifecycle)) image(clip.image);
    const animations = UNIT_ANIMATIONS[agent.tribe];
    for (const animation of [animations?.idle, animations?.attack, animations?.hurt, animations?.death,
      agent.tribe === "bean" ? AGENT_DEATH_ANIMATION : null, agent.species === "spiny-back-beetle" ? beetleCorpse : null,
      CREATURE_IDLE_ANIMATIONS[agent.species], CREATURE_RANGED_ANIMATIONS[agent.species], CREATURE_ATTACK_ANIMATIONS[agent.species], CREATURE_HURT_ANIMATIONS[agent.species], CREATURE_DEATH_ANIMATIONS[agent.species]]) if (animation) image(animation.image);
    let pose = requested?.idleFallback && reducedMotion.matches ? { ...requested, frame: 0 } : requested;
    let source = pose?.animation.image || COMBAT_LAB_UNITS.find(unit => unit.key === agent.key)?.image || BEETLE_NEUTRAL_ASSET;
    let asset = image(source);
    if (!asset && requested?.animation.secretionLifecycle) {
      // A missing lifecycle sheet falls back to the same authored death frame,
      // never a cached living idle, hurt, or shot. Retry remains image-owned.
      pose = { ...requested, animation: agent.tribe === "bean" ? AGENT_DEATH_ANIMATION : UNIT_ANIMATIONS[agent.tribe].death };
      source = pose.animation.image; asset = image(source);
      if (asset) readyPoses.set(agent.id, { pose, source });
      return { pose, source, asset };
    }
    if (!asset && requested?.idleFallback) {
      // Optional idle loading must not retain the last shot/hurt pose.
      pose = { ...requested, animation: requested.idleFallback, frame: 0 };
      source = pose.animation.image; asset = image(source);
      if (asset) readyPoses.set(agent.id, { pose, source });
      return { pose, source, asset };
    }
    if (!asset && ranged) {
      const previous = readyPoses.get(agent.id);
      if (previous?.pose?.animation.rangedBody) { pose = previous.pose; source = previous.source; asset = image(source); }
      if (!asset) { pose = { action: "idle", animation: ranged.idle, frame: 0, mirrorX: agent.facing < 0 }; source = ranged.idle.image; asset = image(source); }
      if (asset) readyPoses.set(agent.id, { pose, source });
      return { pose, source, asset };
    }
    if (!asset) {
      const previous = readyPoses.get(agent.id);
      if (previous) { pose = previous.pose; source = previous.source; asset = image(source); }
      if (!asset) {
        const idle = UNIT_ANIMATIONS[agent.tribe]?.idle || CREATURE_IDLE_ANIMATIONS[agent.species] ||
          (agent.species === "talon-owl" ? TALON_OWL_IDLE : agent.species === "spiny-back-beetle" ? BEETLE_SPRITE : null);
        const ready = idle && image(idle.image);
        if (ready) { pose = { action: "idle", animation: idle, frame: agent.species === "spiny-back-beetle" ? beetleAnimationFrame("idle", time * 1000) : agent.species === "talon-owl" ? talonOwlIdleFrame(time * 1000) : unitAnimationFrame(idle, time * 1000) }; source = idle.image; asset = ready; }
      }
    }
    if (asset) readyPoses.set(agent.id, { pose, source });
    return { pose, source, asset };
  }

  function fighter(agent, index, width, height, time, ended) {
    const originalPoint = position(agent, index, width, height, time), alive = agent.health > 0;
    const evade = alive && combatDodgePose({ active: dodgeCues }, dodgePositions, agent.id, clock, reducedMotion.matches);
    const point = { ...originalPoint, x: originalPoint.x + (evade?.dx || 0), y: originalPoint.y + (evade?.dy || 0) };
    agent = stageAgent(agent);
    if (!alive && !deathStarted.has(agent.id)) deathStarted.set(agent.id, clock);
    const deathAge = alive ? 0 : clock - deathStarted.get(agent.id);
    const requested = poseFor(agent, time, deathAge);
    const { pose, source, asset } = readyPose(agent, requested, time);
    const geometry = pose && imageFrameGeometry(pose.animation, pose.frame);
    const size = displaySize(agent, pose) * formationScale(width, height), shadowScale = size / Math.min(width * .34, height * .72, 290);
    const radiusX = geometry?.groundRadiusX ? geometry.groundRadiusX * size : width * .054 * shadowScale;
    const radiusY = geometry?.groundRadiusY ? geometry.groundRadiusY * size : height * .023 * shadowScale;
    if (evade) drawCombatDodgeTrails(context, evade);
    context.save(); context.translate(point.x, point.y);
    context.fillStyle = "#15261c55"; context.beginPath(); context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2); context.fill();
    drawUnitHealthRing(context, agent.health, agent.stats?.health, 0, 0,
      Math.max(7, bodyDimensions(agent).width * 100 * formationScale(width, height) * .55), colors[index]);
    if (ended && alive) {
      context.fillStyle = colors[index] + "24";
      context.beginPath(); context.ellipse(0, -height * .18, width * .09, height * .3, 0, 0, Math.PI * 2); context.fill();
    }
    const drawBody = (dx = 0, dy = 0) => {
      context.save(); context.translate(dx, dy);
    const appearancePose = appearancePoses.get(String(agent.id));
    const heldSource = beanHeldHurtSource(agent), heldCell = 100 * formationScale(width, height);
    const composed = heldSource?.worldScale === "composed", antenna = heldSource?.image.endsWith("antenna.webp");
    const heldK = heldCell * unitDisplaySize(agent) / 247;
    const heldDrawn = drawBeanHeldHurt(context, agent, time, image, { cell: heldCell, mirror: index === 1,
      ...(composed ? { sourceScaleX: heldK * 194 / 239, sourceScaleY: heldK * 154 / (antenna ? 214 : 203),
        nativePivotX: 256.1159793814433, nativePivotY: antenna ? 486.3336156597027 : 481.6334255599474 } : {}) }) ||
      drawSpeciesHeldHurt(context, agent, time, image, { cell: heldCell, mirror: index === 1 });
    const appearanceDrawn = heldDrawn || appearancePose && appearanceWorld.draw(context, agent, appearancePose, { x: 0, y: 0 },
      100 * formationScale(width, height), index === 1, window.devicePixelRatio || 1);
    const representativeDrawn = !appearanceDrawn && representativeArt.draw(context, agent, time, deathAge,
      { pose, asset, geometry, size, sizeFor: current => displaySize(agent, current) * formationScale(width, height) }, 100 * formationScale(width, height), index === 1);
    if (!appearanceDrawn && !representativeDrawn && asset) {
      const mirror = pose?.mirrorX !== undefined ? pose.mirrorX : agent.species === "spiny-back-beetle" ? pose?.action === "attack" ? index === 1 : index === 0 :
        agent.species && CREATURE_ATTACK_ANIMATIONS[agent.species] ? index === 0 : index === 1;
      context.scale(mirror ? -1 : 1, 1);
      if (!alive && pose?.action !== "death" && pose?.action !== "dead") { context.globalAlpha = .38; context.rotate(-point.direction * .9); context.scale(.85, .85); }
      if (pose) {
        const { frameSize, columns, pivotX, pivotY, viewSize, registrationScale } = geometry;
        const scale = size * (registrationScale || 1) / (viewSize || frameSize);
        context.drawImage(asset, pose.frame % columns * frameSize, Math.floor(pose.frame / columns) * frameSize,
          frameSize, frameSize, -pivotX * scale, -pivotY * scale, frameSize * scale, frameSize * scale);
      } else {
        const scale = Math.min(size / asset.naturalWidth, size / asset.naturalHeight);
        context.drawImage(asset, -asset.naturalWidth * scale / 2, -asset.naturalHeight * .875 * scale,
          asset.naturalWidth * scale, asset.naturalHeight * scale);
      }
    }
      context.restore();
    };
    if (evade) drawCombatDodgeGhosts(context, evade, (dx, dy) => drawBody(dx - evade.dx, dy - evade.dy));
    drawBody();
    context.restore();
    if (currentTrial.agents.length > 2) {
      context.save(); context.font = '600 11px "Malgun Gothic", sans-serif'; context.textAlign = "center";
      context.fillStyle = colors[index]; context.fillText(agent.name, point.x, point.y + 16);
      context.restore();
    }
    const dimensions = bodyDimensions(agent), cell = 100 * formationScale(width, height);
    const bodyPoint = { ...point, width: dimensions.width * cell, height: dimensions.height * cell };
    drawCombatStun(context, agent, bodyPoint, currentTrial.time, { width, height, reducedMotion: reducedMotion.matches });
    return bodyPoint;
  }

  function effectArt(effect, points, width, height, impactCovered = false) {
    const event = effect.event, age = clock - effect.born, progress = clamp(age / .85);
    const id = ["counter", "shoot"].includes(event.kind) ? event.attackerId : event.targetId;
    const support = currentTrial.supportAgents?.find(agent => agent.id === event.targetId);
    const point = support ? supportPoint(support, points, width, height) : points[id], x = point.x, y = point.y - height * (support ? .1 : .25);
    context.save(); context.globalAlpha = 1 - progress ** 2;
    if (event.kind === "heal") {
      context.strokeStyle = "#c1ffc4"; context.lineWidth = 3;
      context.beginPath(); context.arc(x, y, 15 + progress * 30, 0, Math.PI * 2); context.stroke();
      context.beginPath(); context.moveTo(x - 8, y); context.lineTo(x + 8, y); context.moveTo(x, y - 8); context.lineTo(x, y + 8); context.stroke();
    }
    if (age < .28 && !reducedMotion.matches && (event.damage > 0 && !impactCovered || ["parry", "block"].includes(event.kind))) {
      const strength = clamp(age / .28), color = event.kind === "parry" ? "#b9e8f0" : event.kind === "block" ? "#c2dce8" : event.critical ? "#ffe1a0" : "#f7e9b4";
      context.strokeStyle = color; context.lineWidth = (1 - strength) * 3 + 1;
      for (let i = 0; i < 7; i++) {
        const angle = i * Math.PI * 2 / 7 + event.index * .7;
        const radius = (8 + strength * 45) * width / 1040;
        context.beginPath(); context.moveTo(x + Math.cos(angle) * radius * .45, y + Math.sin(angle) * radius * .45);
        context.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius); context.stroke();
      }
      if (event.damage > 0 && !impactCovered) {
        context.lineWidth = event.critical ? 5 : 3;
        context.beginPath(); context.moveTo(x - 20, y + 20); context.lineTo(x + 20, y - 20); context.stroke();
      }
    }
    if (["parry", "block"].includes(event.kind) && age < .45) {
      context.strokeStyle = event.kind === "parry" ? "#c3f1ff" : "#c5dfef"; context.lineWidth = 3;
      context.beginPath(); context.ellipse(x - point.direction * width * .035, y, width * .025, height * .11, 0, -.5 * Math.PI, .5 * Math.PI); context.stroke();
    }
    const lift = reducedMotion.matches ? 0 : progress * 45;
    const lane = effect.lane * 24;
    const labelY = Math.max(20, Math.min(height - 20, y - height * .28 - lift - lane));
    context.textAlign = "center"; context.textBaseline = "middle"; context.lineJoin = "round";
    context.font = (event.critical ? "800 " : "700 ") + Math.max(17, Math.min(30, width / 30)) + 'px "Malgun Gothic", sans-serif';
    context.lineWidth = 4; context.strokeStyle = "#203125";
    let label = event.kind === "heal" ? "+" + (-event.damage).toFixed(1) : event.damage > 0 ? "−" + event.damage.toFixed(1) : reactionLabels[event.kind];
    if (event.kind === "stun" || event.kind === "counter") context.font = '700 16px "Malgun Gothic", sans-serif';
    if (label) {
      context.fillStyle = event.critical ? "#ffda8a" : ["parry", "block", "dodge"].includes(event.kind) ? "#d3f1ff" : event.kind === "counter" ? "#ffe0ae" : "#fff9df";
      context.strokeText(label, x, labelY); context.fillText(label, x, labelY);
    }
    if (event.critical && event.damage > 0) {
      context.font = '800 13px "Malgun Gothic", sans-serif'; context.fillStyle = "#ffda8a";
      context.fillText("치명", x, Math.max(12, labelY - 27));
    }
    context.restore();
  }

  function supportPoint(agent, points, width, height) {
    const point = points[agent.id.replace(/-support$/, "")];
    return { x: point.x - point.direction * width * .13, y: height * .88, direction: point.direction };
  }

  function supportArt(agent, points, width, height, time) {
    agent = stageAgent(agent);
    if (agent.health <= 0 && !deathStarted.has(agent.id)) deathStarted.set(agent.id, clock);
    const deathAge = agent.health > 0 ? 0 : clock - deathStarted.get(agent.id);
    const point = supportPoint(agent, points, width, height), requested = poseFor(agent, time, deathAge);
    const { pose, source, asset } = readyPose(agent, requested, time);
    const geometry = pose && imageFrameGeometry(pose.animation, pose.frame);
    const size = displaySize(agent, pose) * formationScale(width, height), shadowScale = size / Math.min(width * .34, height * .72, 290);
    context.save(); context.translate(point.x, point.y);
    drawUnitHealthRing(context, agent.health, agent.stats?.health, 0, 0,
      Math.max(7, bodyDimensions(agent).width * 100 * formationScale(width, height) * .55), colors[(agent.combat?.side ?? agent.side)]);
    const appearancePose = appearancePoses.get(String(agent.id));
    const appearanceDrawn = appearancePose && appearanceWorld.draw(context, agent, appearancePose, { x: 0, y: 0 },
      100 * formationScale(width, height), (agent.combat?.side ?? agent.side) === 1, window.devicePixelRatio || 1);
    const representativeDrawn = !appearanceDrawn && representativeArt.draw(context, agent, time, deathAge,
      { pose, asset, geometry, size, sizeFor: current => displaySize(agent, current) * formationScale(width, height) }, 100 * formationScale(width, height), (agent.combat?.side ?? agent.side) === 1);
    if (!appearanceDrawn && !representativeDrawn && asset) {
      const mirror = pose?.mirrorX !== undefined ? pose.mirrorX : agent.species === "spiny-back-beetle" ? pose?.action === "attack" ? (agent.combat?.side ?? agent.side) === 1 : (agent.combat?.side ?? agent.side) === 0 :
        agent.species && CREATURE_ATTACK_ANIMATIONS[agent.species] ? (agent.combat?.side ?? agent.side) === 0 : (agent.combat?.side ?? agent.side) === 1;
      context.save(); context.scale(mirror ? -1 : 1, 1);
      if (pose) { const { frameSize, columns, pivotX, pivotY, viewSize, registrationScale } = geometry;
        const scale = size * (registrationScale || 1) / (viewSize || frameSize);
        context.drawImage(asset, pose.frame % columns * frameSize, Math.floor(pose.frame / columns) * frameSize,
          frameSize, frameSize, -pivotX * scale, -pivotY * scale, frameSize * scale, frameSize * scale);
      } else {
        const scale = Math.min(size / asset.naturalWidth, size / asset.naturalHeight);
        context.drawImage(asset, -asset.naturalWidth * scale / 2, -asset.naturalHeight * .875 * scale,
          asset.naturalWidth * scale, asset.naturalHeight * scale);
      }
      context.restore();
    }
    context.fillStyle = "#eef6dc"; context.font = '700 12px "Malgun Gothic", sans-serif'; context.textAlign = "center"; context.fillText("아군", 0, 29);
    context.fillStyle = "#203125"; context.fillRect(-30, 7, 60, 5);
    context.fillStyle = "#b8ef98"; context.fillRect(-30, 7, 60 * agent.health / agent.stats.health, 5);
    context.restore();
    const dimensions = bodyDimensions(agent), cell = 100 * formationScale(width, height);
    return { ...point, width: dimensions.width * cell, height: dimensions.height * cell };
  }

  function projectileArt(projectile, points, time, height, flight) {
    const source = points[projectile.source.id], target = points[projectile.target.id];
    const progress = clamp((time - projectile.launchedAt) / Math.max(.001, projectile.at - projectile.launchedAt));
    // A loading fallback must share the V4 shot's frozen origin and body-centre
    // destination. Recomputing from the recoiling shooter makes recovery jump.
    const head = flight && { x: flight.x + Math.cos(flight.angle) * flight.size * .25,
      y: flight.y + Math.sin(flight.angle) * flight.size * .25, angle: flight.angle };
    const sprite = unitRangedProjectile(stageAgent(projectile.source)), asset = sprite && image(sprite.image);
    if (sprite && asset) {
      const scale = sprite.sourceScale * formationScale(canvas.clientWidth, canvas.clientHeight);
      const startX = source.x + source.direction * (sprite.outletX - 256) * scale;
      const startY = source.y + (sprite.outletY - 448) * scale;
      const x = head ? head.x : startX + (target.x - startX) * progress;
      const y = head ? head.y : startY + (target.y - height * .04 - startY) * progress;
      context.save(); context.translate(x, y); context.rotate(head ? head.angle : Math.atan2(target.y - height * .04 - startY, target.x - startX));
      context.drawImage(asset, -sprite.width * scale / 2, -sprite.height * scale / 2, sprite.width * scale, sprite.height * scale);
      context.restore(); return;
    }
    context.save(); context.fillStyle = "#e5e9a4"; context.shadowColor = "#e5e9a4"; context.shadowBlur = 8;
    context.beginPath(); context.arc(head ? head.x : source.x + (target.x - source.x) * progress,
      head ? head.y : source.y - height * .3, 5, 0, Math.PI * 2); context.fill(); context.restore();
  }

  function clear() {
    appearanceWorld.clear(); vfxCursor.reset(); detailVfx.consume({ reset: true }, 0);
    currentTrial = undefined; previousTime = null; seen = 0; effects = []; clock = 0; lastNow = 0;
    deathStarted.clear(); readyPoses.clear(); appearancePoses = new Map(); dodgePositions = new Map(); dodgeCues = [];
  }

  function render(trial, now, playing) {
    const delta = lastNow ? Math.min(.1, (now - lastNow) / 1000) : 0; lastNow = now;
    if (trial !== currentTrial || trial && previousTime !== null && trial.time < previousTime) {
      clear(); currentTrial = trial; lastNow = now;
    }
    previousTime = trial?.time ?? null;
    if (playing || !trial?.time || trial?.result()?.reason || effects.some(effect => clock - effect.born < .85) || detailVfx.vitalActive(clock) || dodgeCues.length) clock += delta;
    if (trial) {
      const unseen = trial.history.slice(seen);
      for (const event of unseen) if (event.kind === "death" && !deathStarted.has(event.targetId))
        deathStarted.set(event.targetId, clock);
      const fresh = unseen.filter(event => trial.time - event.time < .35).slice(-16);
      for (const event of fresh) {
        const lane = effects.filter(effect => effect.event.targetId === event.targetId && clock - effect.born < .3).length % 3;
        effects.push({ event, born: clock, lane });
      }
      seen = trial.history.length;
      effects = effects.filter(effect => clock - effect.born < 1.8 && trial.time - effect.event.time < .85).slice(-32);
    }
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight), ratio = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
    context.setTransform(ratio, 0, 0, ratio, 0, 0); background(width, height);
    if (!trial) return;
    const vfx = trial.vfx, liveFlightKeys = new Set();
    let liveFlights = [];
    if (vfx?.version === 1) {
      const frame = vfxCursor.consume(vfx, trial.time);
      liveFlights = frame.projectiles;
      if (frame.reset) dodgeCues = [];
      for (const shot of frame.projectiles) liveFlightKeys.add(flightKey(shot.sourceId, shot.targetId, shot.launchedAt, shot.arrivesAt));
      for (const cue of frame.started) if (cue.kind === "dodge" && cue.channel === "defense") {
        const at = clock - Math.max(0, trial.time - cue.at);
        dodgeCues.push({ ...cue, at, endsAt: at + Math.min(.4, cue.endsAt - cue.at) });
      }
      dodgeCues = dodgeCues.filter(cue => clock >= cue.at && clock < cue.endsAt);
      // Flights follow simulation time; authored impact tails use the stage clock,
      // so stepping, pausing or lethal resolution does not freeze the last cell.
      detailVfx.consume({ ...frame, started: frame.started.map(cue => ({ ...cue, eventAt: cue.at,
        at: clock - Math.max(0, trial.time - cue.at) })) }, clock);
      if (!reducedMotion.matches) for (const path of DETAIL_COMBAT_VFX_ASSETS) image(path);
    }
    if (vfx?.version !== 1) dodgeCues = [];
    const ended = !!trial.result()?.reason;
    const time = trial.time || clock;
    appearancePoses = appearanceWorld.prepare(context, [...trial.agents, ...(trial.supportAgents || [])].map(entry => {
      const agent = stageAgent(entry), deathAt = deathStarted.get(agent.id);
      return agent.health <= 0 ? { ...agent, deathStartedAt: time - (clock - (deathAt ?? clock)) } : agent;
    }), time, 100 * formationScale(width, height), ratio, { attackClock: "lab" });
    const impact = effects.findLast(effect => effect.event.damage > 0 && effect.event.kind !== "bleed" && clock - effect.born < .11);
    context.save();
    if (impact && !reducedMotion.matches && playing) {
      const fade = 1 - (clock - impact.born) / .11;
      context.translate(Math.sin(clock * 150) * fade * (impact.event.critical ? 3 : 1.5), 0);
    }
    dodgePositions = new Map(trial.agents.map(agent => {
      const point = position(agent, (agent.combat?.side ?? agent.side), width, height, time), bounds = bodyDimensions(agent), cell = 100 * formationScale(width, height);
      return [String(agent.id), { ...point, width: bounds.width * cell, height: bounds.height * cell }];
    }));
    const points = Object.fromEntries(trial.agents.map(agent => [agent.id, fighter(agent, (agent.combat?.side ?? agent.side), width, height, time, ended)]));
    for (const agent of trial.supportAgents || []) points[agent.id] = supportArt(agent, points, width, height, time);
    const defenseCommands = vfx?.version === 1 ? detailVfx.defenseCommands(new Map(Object.entries(points)), clock) : [];
    const replacedDefenseIds = new Set(defenseCommands.filter(command => detailDefenseImageReady(image(command.image), command)).map(command => command.eventId));
    const drawnFlights = new Set(), drawnImpacts = new Set(), flightCommands = new Map();
    if (vfx?.version === 1 && !reducedMotion.matches) {
      const commands = detailVfx.commands(trial.agents.map(stageAgent), new Map(Object.entries(points)), clock,
        100 * formationScale(width, height), { scope: trial, width, height });
      for (const command of commands) {
        if (command.kind === "impact" && replacedDefenseIds.has(command.eventId)) continue;
        const key = command.kind === "flight" && flightKey(command.sourceId, command.targetId, command.launchedAt, command.arrivesAt);
        if (key) flightCommands.set(key, command);
        if (drawDetailVfxCell(context, image(command.image), command)) {
          if (key) drawnFlights.add(key);
          else drawnImpacts.add(impactKey(command.sourceId, command.targetId, command.eventAt, command.amount));
        }
      }
    }
    // The observed journal owns flight lifetime, including loading fallback.
    // A legacy transport list may have removed its object at ETA before the
    // terminal packet arrived. Reuse only currently visible actual actors.
    const fallbackProjectiles = vfx?.version === 1 ? liveFlights.flatMap(shot => {
      const source = trial.agents.find(agent => String(agent.id) === String(shot.sourceId));
      const target = trial.agents.find(agent => String(agent.id) === String(shot.targetId));
      return source && target && points[source.id] && points[target.id] ?
        [{ source, target, launchedAt: shot.launchedAt, at: shot.arrivesAt }] : [];
    }) : trial.projectiles || [];
    for (const projectile of fallbackProjectiles) {
      const key = flightKey(projectile.source.id, projectile.target.id, projectile.launchedAt, projectile.at);
      // A stale legacy transport object must not resurrect a journal-closed
      // miss, hit or cancellation. Before resolution the real flight remains.
      if (vfx?.version === 1 && !liveFlightKeys.has(key)) continue;
      if (!drawnFlights.has(key)) projectileArt(projectile, points, time, height, flightCommands.get(key));
    }
    for (const effect of effects) if (clock - effect.born < .85) {
      const event = effect.event;
      if (vfx?.version === 1 && ["heal", "drain", "regeneration", "bleed", "block", "parry", "dodge", "miss", "evasion"].includes(event.kind)) continue;
      const covered = ["hit", "critical", "block", "area", "reflect"].includes(event.kind) &&
        drawnImpacts.has(impactKey(event.attackerId, event.targetId, event.time, event.damage));
      effectArt(effect, points, width, height, covered);
    }
    for (const command of defenseCommands) if (!drawDetailDefenseEffect(context, command, image(command.image), { reducedMotion: reducedMotion.matches }))
      drawDetailDefenseFallback(context, command);
    // Use actual HP changes, including drain (which has no history entry).
    // Support recipients use the same displayed position as their own sprite.
    const vitalCommands = detailVfx.vitalCommands([...trial.agents, ...(trial.supportAgents || [])].map(stageAgent),
      new Map(Object.entries(points)), clock, { scope: trial, width, height });
    for (const command of vitalCommands) drawDetailVitalEffect(context, command, { width, height, reducedMotion: reducedMotion.matches });
    drawDetailDefenseLabels(context, defenseCommands, { width, height, reducedMotion: reducedMotion.matches, vitals: vitalCommands });
    for (const agent of trial.agents) if (agent.health > 0) {
      const evade = combatDodgePose({ active: dodgeCues }, dodgePositions, agent.id, clock, reducedMotion.matches);
      if (evade) drawCombatDodgeLabel(context, evade, points[agent.id], { width, height, vitals: vitalCommands });
    }
    context.restore();
  }

  return { render, clear, appearanceStats: appearanceWorld.stats };
}
