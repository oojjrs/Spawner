import { COMBAT_LAB_UNITS } from "./combat-lab.mjs";
import { createUnitAppearanceWorld } from "./unit-appearance-world.mjs";
import { AGENT_DEATH_ANIMATION } from "./agent-death.mjs";
import { imageAnimation, imageFrameGeometry } from "./image-geometry.mjs";
import { unitDisplaySize } from "./unit-size.mjs";
import { unitRangedAppearance, unitRangedPose, unitRangedDisplaySize, unitRangedProjectile } from "./unit-ranged.mjs";
import { UNIT_IMAGE_BOUNDS } from "./unit-image-bounds.mjs";
import { UNIT_ANIMATIONS, CREATURE_IDLE_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, CREATURE_HURT_ANIMATIONS, CREATURE_DEATH_ANIMATIONS, unitAnimationPose, unitAnimationFrame, creatureHurtPose, creatureAttackPose } from "./unit-animation.mjs";
import { TALON_OWL_IDLE, talonOwlIdleFrame } from "./talon-owl-idle.mjs";
import { BEETLE_SPRITE, BEETLE_ATTACK_SPRITE, BEETLE_ANIMATIONS, BEETLE_NEUTRAL_ASSET, beetleAnimationFrame, beetleAnimationPose } from "../server/beetle-animation.mjs";

const colors = ["#c4e19c", "#efba90"];
const reactionLabels = { dodge: "회피", parry: "패링", block: "블록", stun: "기절", counter: "반격", heal: "치유", shoot: "사격" };
const beetleCorpse = imageAnimation({ image: "DesignAssets/Animations/BeetleDeath/dead-v2.png", frameSize: 185, columns: 1, pivotX: 95.5, pivotY: 163 });

function stageAgent(agent) {
  if (agent.species || agent.tribe || !agent.key) return agent;
  return UNIT_ANIMATIONS[agent.key] ? { ...agent, tribe: agent.key } : { ...agent, species: agent.key };
}

function displaySize(agent, pose) {
  if (pose?.animation.rangedBody || !pose && unitRangedAppearance(agent)) return unitRangedDisplaySize(agent);
  const key = agent.species || agent.tribe || agent.key;
  const idle = UNIT_ANIMATIONS[key]?.idle || CREATURE_IDLE_ANIMATIONS[key] ||
    (key === "talon-owl" ? TALON_OWL_IDLE : BEETLE_SPRITE);
  if (UNIT_ANIMATIONS[key] && pose) {
    const reference = UNIT_IMAGE_BOUNDS[idle.image], action = UNIT_IMAGE_BOUNDS[pose.animation.image];
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
  const death = agent.tribe === "bean" ? AGENT_DEATH_ANIMATION : UNIT_ANIMATIONS[agent.tribe]?.death || CREATURE_DEATH_ANIMATIONS[agent.species];
  if (agent.health <= 0 && death) return { action: "death", animation: death, frame: unitAnimationFrame(death, deathAge * 1000) };
  if (agent.species === "spiny-back-beetle") {
    if (agent.health <= 0) return deathAge * 1000 < BEETLE_ANIMATIONS.death.durationMs ?
      { action: "death", animation: BEETLE_SPRITE, frame: beetleAnimationFrame("death", deathAge * 1000) } :
      { action: "dead", animation: beetleCorpse, frame: 0 };
    const beetle = beetleAnimationPose(agent, time);
    if (beetle.action === "hurt") return { ...beetle, animation: BEETLE_SPRITE };
    const attack = agent.attack;
    return { action: attack ? "attack" : "idle", animation: attack ? BEETLE_ATTACK_SPRITE : BEETLE_SPRITE,
      frame: beetleAnimationFrame(attack ? "attack" : "idle", Math.max(0, time - (attack?.startedAt || 0)) * 1000) };
  }
  const pose = creatureHurtPose(agent, time) || creatureAttackPose(agent, time) || unitAnimationPose(agent, time);
  if (pose) return pose;
  const idle = UNIT_ANIMATIONS[agent.tribe]?.idle || CREATURE_IDLE_ANIMATIONS[agent.species];
  if (idle) return { action: "idle", animation: idle, frame: unitAnimationFrame(idle, time * 1000) };
  if (agent.species === "talon-owl") return { animation: TALON_OWL_IDLE, frame: talonOwlIdleFrame(time * 1000) };
  return pose;
}

export function createCombatStage(canvas) {
  const context = canvas.getContext("2d"), images = new Map();
  const appearanceWorld = createUnitAppearanceWorld();
  let appearancePoses = new Map();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const deathStarted = new Map(), readyPoses = new Map();
  let currentTrial, seen = 0, effects = [], clock = 0, lastNow = 0;

  function image(source) {
    if (!source) return null;
    if (!images.has(source)) {
      const asset = new Image();
      asset.src = source;
      images.set(source, asset);
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
    let lunge = 0;
    if (attack && attack.mode !== "ranged" && !reducedMotion.matches) {
      const windup = clamp((time - attack.startedAt) / Math.max(.001, attack.hitAt - attack.startedAt));
      const recovery = clamp((time - attack.hitAt) / Math.max(.001, attack.endsAt - attack.hitAt));
      lunge = time < attack.hitAt ? -8 * Math.sin(windup * Math.PI) + 45 * windup ** 4 : 45 * (1 - recovery) ** 2;
    }
    const recent = effects.filter(effect => effect.event.targetId === agent.id && clock - effect.born < .22);
    const impact = recent.find(effect => effect.event.damage > 0);
    const dodge = recent.find(effect => effect.event.kind === "dodge");
    const age = impact ? (clock - impact.born) / .22 : 1;
    const recoil = reducedMotion.matches ? 0 : impact ? Math.sin(age * Math.PI) * 16 : dodge ? 26 * Math.sin((clock - dodge.born) / .22 * Math.PI) : 0;
    const distance = currentTrial?.agents.every(entry => Number.isFinite(entry.x)) ? Math.abs(currentTrial.agents[1].x - currentTrial.agents[0].x) : 1;
    const gap = Math.min(.64, .2 * Math.max(1, distance));
    const members = currentTrial.agents.filter(other => other.combat.side === index);
    if (currentTrial.agents.length > 2) {
      const slot = members.indexOf(agent), columns = Math.ceil(Math.sqrt(members.length)), rows = Math.ceil(members.length / columns);
      return { x: width * (index === 0 ? .12 + .28 * ((slot % columns + .5) / columns) : .88 - .28 * ((slot % columns + .5) / columns)) + direction * (lunge - recoil) * width / 1040,
        y: height * (.35 + .43 * ((Math.floor(slot / columns) + 1) / rows)), direction };
    }
    return { x: width * (.5 - direction * gap / 2) + direction * (lunge - recoil) * width / 1040, y: Math.round(height * .79), direction };
  }

  function formationScale(width, height) {
    const bounds = currentTrial.agents.map(agent => {
      agent = stageAgent(agent);
      const key = agent.species || agent.tribe || agent.key;
      const idle = UNIT_ANIMATIONS[key]?.idle || CREATURE_IDLE_ANIMATIONS[key] ||
        (key === "talon-owl" ? TALON_OWL_IDLE : BEETLE_SPRITE);
      const reference = UNIT_IMAGE_BOUNDS[idle.image], length = Math.max(reference.width, reference.height);
      const scale = unitDisplaySize(agent) / length;
      return { width: reference.width * scale, height: reference.height * scale };
    });
    const maxWidth = Math.max(.4, ...bounds.map(bound => bound.width));
    const maxHeight = Math.max(.4, ...bounds.map(bound => bound.height));
    return Math.min(width * .31, width * .22 / maxWidth, height * .43 / maxHeight) / 100;
  }

  function readyPose(agent, requested, time) {
    const ranged = unitRangedAppearance(agent);
    if (ranged) { image(ranged.idle.image); image(ranged.animation.image); image(unitRangedProjectile(agent).image); }
    const animations = UNIT_ANIMATIONS[agent.tribe];
    for (const animation of [animations?.idle, animations?.attack, animations?.hurt, animations?.death,
      agent.tribe === "bean" ? AGENT_DEATH_ANIMATION : null, agent.species === "spiny-back-beetle" ? beetleCorpse : null,
      CREATURE_IDLE_ANIMATIONS[agent.species], CREATURE_ATTACK_ANIMATIONS[agent.species], CREATURE_HURT_ANIMATIONS[agent.species], CREATURE_DEATH_ANIMATIONS[agent.species]]) if (animation) image(animation.image);
    let pose = requested;
    let source = pose?.animation.image || COMBAT_LAB_UNITS.find(unit => unit.key === agent.key)?.image || BEETLE_NEUTRAL_ASSET;
    let asset = image(source);
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
    const point = position(agent, index, width, height, time), alive = agent.health > 0;
    agent = stageAgent(agent);
    if (!alive && !deathStarted.has(agent.id)) deathStarted.set(agent.id, clock);
    const deathAge = alive ? 0 : clock - deathStarted.get(agent.id);
    const requested = poseFor(agent, time, deathAge);
    const { pose, source, asset } = readyPose(agent, requested, time);
    const geometry = pose && imageFrameGeometry(pose.animation, pose.frame);
    const size = displaySize(agent, pose) * formationScale(width, height), shadowScale = size / Math.min(width * .34, height * .72, 290);
    const radiusX = geometry?.groundRadiusX ? geometry.groundRadiusX * size : width * .054 * shadowScale;
    const radiusY = geometry?.groundRadiusY ? geometry.groundRadiusY * size : height * .023 * shadowScale;
    context.save(); context.translate(point.x, point.y);
    context.fillStyle = "#15261c55"; context.beginPath(); context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2); context.fill();
    context.strokeStyle = colors[index] + (alive ? "a6" : "45"); context.lineWidth = 2;
    context.beginPath(); context.ellipse(0, 0, geometry?.groundRadiusX ? radiusX * 1.12 : width * .065 * shadowScale,
      geometry?.groundRadiusY ? radiusY * 1.12 : height * .03 * shadowScale, 0, 0, Math.PI * 2); context.stroke();
    if (ended && alive) {
      context.fillStyle = colors[index] + "24";
      context.beginPath(); context.ellipse(0, -height * .18, width * .09, height * .3, 0, 0, Math.PI * 2); context.fill();
    }
    const appearancePose = appearancePoses.get(String(agent.id));
    const appearanceDrawn = appearancePose && appearanceWorld.draw(context, agent, appearancePose, { x: 0, y: 0 },
      100 * formationScale(width, height), index === 1, window.devicePixelRatio || 1);
    if (!appearanceDrawn && asset) {
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
    if (alive && agent.combat.stunnedUntil > currentTrial.time) {
      context.save(); context.strokeStyle = "#f6d983"; context.lineWidth = 2;
      context.beginPath(); context.ellipse(point.x, point.y - height * .47, width * .035, 8, 0, 0, Math.PI * 2); context.stroke();
      for (let i = 0; i < 3; i++) {
        const angle = clock * 3 + i * Math.PI * 2 / 3;
        context.fillStyle = "#ffe9a7"; context.fillRect(point.x + Math.cos(angle) * width * .035 - 2, point.y - height * .47 + Math.sin(angle) * 8 - 2, 4, 4);
      }
      context.restore();
    }
    if (currentTrial.agents.length > 2) {
      context.save(); context.font = '600 11px "Malgun Gothic", sans-serif'; context.textAlign = "center";
      context.fillStyle = colors[index]; context.fillText(agent.name, point.x, point.y + 16);
      context.fillStyle = "#15261c"; context.fillRect(point.x - 22, point.y + 21, 44, 4);
      context.fillStyle = colors[index]; context.fillRect(point.x - 22, point.y + 21, 44 * agent.health / agent.stats.health, 4);
      context.restore();
    }
    return point;
  }

  function effectArt(effect, points, width, height) {
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
    if (age < .28 && !reducedMotion.matches && (event.damage > 0 || ["parry", "block"].includes(event.kind))) {
      const strength = clamp(age / .28), color = event.kind === "parry" ? "#b9e8f0" : event.kind === "block" ? "#c2dce8" : event.critical ? "#ffe1a0" : "#f7e9b4";
      context.strokeStyle = color; context.lineWidth = (1 - strength) * 3 + 1;
      for (let i = 0; i < 7; i++) {
        const angle = i * Math.PI * 2 / 7 + event.index * .7;
        const radius = (8 + strength * 45) * width / 1040;
        context.beginPath(); context.moveTo(x + Math.cos(angle) * radius * .45, y + Math.sin(angle) * radius * .45);
        context.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius); context.stroke();
      }
      if (event.damage > 0) {
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
    const point = supportPoint(agent, points, width, height), requested = poseFor(agent, time, 0);
    const { pose, source, asset } = readyPose(agent, requested, time);
    const geometry = pose && imageFrameGeometry(pose.animation, pose.frame);
    const size = displaySize(agent, pose) * formationScale(width, height), shadowScale = size / Math.min(width * .34, height * .72, 290);
    context.save(); context.translate(point.x, point.y);
    context.strokeStyle = colors[agent.combat.side]; context.lineWidth = 2;
    context.beginPath(); context.ellipse(0, 0, geometry?.groundRadiusX ? geometry.groundRadiusX * size * 1.12 : width * .065 * shadowScale,
      geometry?.groundRadiusY ? geometry.groundRadiusY * size * 1.12 : height * .03 * shadowScale, 0, 0, Math.PI * 2); context.stroke();
    const appearancePose = appearancePoses.get(String(agent.id));
    const appearanceDrawn = appearancePose && appearanceWorld.draw(context, agent, appearancePose, { x: 0, y: 0 },
      100 * formationScale(width, height), agent.combat.side === 1, window.devicePixelRatio || 1);
    if (!appearanceDrawn && asset) {
      const mirror = pose?.mirrorX !== undefined ? pose.mirrorX : agent.species === "spiny-back-beetle" ? pose?.action === "attack" ? agent.combat.side === 1 : agent.combat.side === 0 :
        agent.species && CREATURE_ATTACK_ANIMATIONS[agent.species] ? agent.combat.side === 0 : agent.combat.side === 1;
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
  }

  function projectileArt(projectile, points, time, height) {
    const source = points[projectile.source.id], target = points[projectile.target.id];
    const progress = clamp((time - projectile.launchedAt) / Math.max(.001, projectile.at - projectile.launchedAt));
    const sprite = unitRangedProjectile(stageAgent(projectile.source)), asset = sprite && image(sprite.image);
    if (sprite && asset) {
      const scale = sprite.sourceScale * formationScale(canvas.clientWidth, canvas.clientHeight);
      const startX = source.x + source.direction * (sprite.outletX - 256) * scale;
      const startY = source.y + (sprite.outletY - 448) * scale;
      const x = startX + (target.x - startX) * progress, y = startY + (target.y - height * .04 - startY) * progress;
      context.save(); context.translate(x, y); context.rotate(Math.atan2(target.y - height * .04 - startY, target.x - startX));
      context.drawImage(asset, -sprite.width * scale / 2, -sprite.height * scale / 2, sprite.width * scale, sprite.height * scale);
      context.restore(); return;
    }
    context.save(); context.fillStyle = "#e5e9a4"; context.shadowColor = "#e5e9a4"; context.shadowBlur = 8;
    context.beginPath(); context.arc(source.x + (target.x - source.x) * progress, source.y - height * .3, 5, 0, Math.PI * 2); context.fill(); context.restore();
  }

  function render(trial, now, playing) {
    const delta = lastNow ? Math.min(.1, (now - lastNow) / 1000) : 0; lastNow = now;
    if (trial !== currentTrial) { currentTrial = trial; seen = 0; effects = []; clock = 0; deathStarted.clear(); readyPoses.clear(); appearanceWorld.clear(); }
    if (playing || !trial?.time || trial?.result()?.reason || effects.some(effect => clock - effect.born < .85)) clock += delta;
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
    const ended = !!trial.result()?.reason;
    const time = trial.time || clock;
    appearancePoses = appearanceWorld.prepare(context, [...trial.agents, ...(trial.supportAgents || [])].map(entry => {
      const agent = stageAgent(entry), deathAt = deathStarted.get(agent.id);
      return agent.health <= 0 ? { ...agent, deathStartedAt: time - (clock - (deathAt ?? clock)) } : agent;
    }), time, 100 * formationScale(width, height), ratio, { attackClock: "lab" });
    const impact = effects.findLast(effect => effect.event.damage > 0 && clock - effect.born < .11);
    context.save();
    if (impact && !reducedMotion.matches && playing) {
      const fade = 1 - (clock - impact.born) / .11;
      context.translate(Math.sin(clock * 150) * fade * (impact.event.critical ? 3 : 1.5), 0);
    }
    const points = Object.fromEntries(trial.agents.map(agent => [agent.id, fighter(agent, agent.combat.side, width, height, time, ended)]));
    for (const agent of trial.supportAgents || []) supportArt(agent, points, width, height, time);
    for (const projectile of trial.projectiles || []) projectileArt(projectile, points, time, height);
    for (const effect of effects) if (clock - effect.born < .85) effectArt(effect, points, width, height);
    context.restore();
  }

  return { render, clear: appearanceWorld.clear, appearanceStats: appearanceWorld.stats };
}
