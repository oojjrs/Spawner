import { COMBAT_LAB_UNITS } from "./combat-lab.mjs";
import { AGENT_DEATH_ANIMATION } from "./agent-death.mjs";
import { imageAnimation, imageFrameGeometry } from "./image-geometry.mjs";
import { UNIT_ANIMATIONS, CREATURE_IDLE_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, CREATURE_DEATH_ANIMATIONS, unitAnimationPose, unitAnimationFrame, creatureHurtPose, creatureAttackPose } from "./unit-animation.mjs";
import { TALON_OWL_IDLE, talonOwlIdleFrame } from "./talon-owl-idle.mjs";
import { BEETLE_SPRITE, BEETLE_ATTACK_SPRITE, BEETLE_ANIMATIONS, BEETLE_NEUTRAL_ASSET, beetleAnimationFrame, beetleAnimationPose } from "../server/beetle-animation.mjs";

const colors = ["#c4e19c", "#efba90"];
const reactionLabels = { dodge: "회피", parry: "패링", block: "블록", stun: "기절", counter: "반격" };
const beetleCorpse = imageAnimation({ image: "DesignAssets/Animations/BeetleDeath/dead-v2.png", frameSize: 185, columns: 1, pivotX: 95.5, pivotY: 163 });

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function poseFor(agent, time, deathAge) {
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
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const deathStarted = new Map();
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
    const light = context.createRadialGradient(width * .5, height * .48, 10, width * .5, height * .5, width * .65);
    light.addColorStop(0, "#879c67"); light.addColorStop(.48, "#546746"); light.addColorStop(1, "#273d31");
    context.fillStyle = light; context.fillRect(0, 0, width, height);
    const ground = image("DesignAssets/Terrain/grassland-ground.png");
    if (ground) {
      context.save(); context.globalAlpha = .16;
      const pattern = context.createPattern(ground, "repeat");
      context.fillStyle = pattern; context.fillRect(0, 0, width, height); context.restore();
    }
    context.save(); context.translate(width / 2, height * .76); context.scale(width / 1040, height / 400);
    const floor = context.createRadialGradient(0, 0, 20, 0, 0, 400);
    floor.addColorStop(0, "#b0ac7b8c"); floor.addColorStop(.65, "#aaa5774d"); floor.addColorStop(1, "#a6a17100");
    context.fillStyle = floor; context.beginPath(); context.ellipse(0, 0, 440, 84, 0, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "#dae7b92b"; context.lineWidth = 1;
    context.beginPath(); context.ellipse(0, 0, 360, 62, 0, 0, Math.PI * 2); context.stroke(); context.restore();
    if (!reducedMotion.matches) for (let i = 0; i < 14; i++) {
      const x = ((i * .173 + clock * .006) % 1) * width;
      const y = height * (.12 + (i * .137 % .64)) + Math.sin(clock * .65 + i * 2) * 7;
      context.globalAlpha = .2 + Math.sin(clock + i) * .08; context.fillStyle = "#e7ebbd";
      context.beginPath(); context.arc(x, y, i % 3 === 0 ? 2 : 1, 0, Math.PI * 2); context.fill();
    }
    context.globalAlpha = 1;
  }

  function position(agent, index, width, height, time) {
    const direction = index === 0 ? 1 : -1;
    const attack = agent.attack;
    let lunge = 0;
    if (attack && !reducedMotion.matches) {
      const windup = clamp((time - attack.startedAt) / Math.max(.001, attack.hitAt - attack.startedAt));
      const recovery = clamp((time - attack.hitAt) / Math.max(.001, attack.endsAt - attack.hitAt));
      lunge = time < attack.hitAt ? -8 * Math.sin(windup * Math.PI) + 45 * windup ** 4 : 45 * (1 - recovery) ** 2;
    }
    const recent = effects.filter(effect => effect.event.targetId === agent.id && clock - effect.born < .22);
    const impact = recent.find(effect => effect.event.damage > 0);
    const dodge = recent.find(effect => effect.event.kind === "dodge");
    const age = impact ? (clock - impact.born) / .22 : 1;
    const recoil = reducedMotion.matches ? 0 : impact ? Math.sin(age * Math.PI) * 16 : dodge ? 26 * Math.sin((clock - dodge.born) / .22 * Math.PI) : 0;
    return { x: width * (index === 0 ? .4 : .6) + direction * (lunge - recoil) * width / 1040, y: height * .79, direction };
  }

  function fighter(agent, index, width, height, time, ended) {
    const point = position(agent, index, width, height, time), alive = agent.health > 0;
    if (!alive && !deathStarted.has(agent.id)) deathStarted.set(agent.id, clock);
    const deathAge = alive ? 0 : clock - deathStarted.get(agent.id);
    const pose = poseFor(agent, time, deathAge);
    const animations = UNIT_ANIMATIONS[agent.tribe];
    for (const animation of [animations?.idle, animations?.attack, animations?.hurt, animations?.death,
      agent.tribe === "bean" ? AGENT_DEATH_ANIMATION : null, agent.species === "spiny-back-beetle" ? beetleCorpse : null,
      CREATURE_IDLE_ANIMATIONS[agent.species], CREATURE_ATTACK_ANIMATIONS[agent.species], CREATURE_DEATH_ANIMATIONS[agent.species]]) if (animation) image(animation.image);
    const source = pose?.animation.image || COMBAT_LAB_UNITS.find(unit => unit.key === agent.key)?.image || BEETLE_NEUTRAL_ASSET;
    const asset = image(source);
    const geometry = pose && imageFrameGeometry(pose.animation, pose.frame);
    const size = Math.min(width * .34, height * .72, 290);
    const radiusX = geometry?.groundRadiusX ? geometry.groundRadiusX * size : width * .054;
    const radiusY = geometry?.groundRadiusY ? geometry.groundRadiusY * size : height * .023;
    context.save(); context.translate(point.x, point.y);
    context.fillStyle = "#15261c55"; context.beginPath(); context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2); context.fill();
    context.strokeStyle = colors[index] + (alive ? "a6" : "45"); context.lineWidth = 2;
    context.beginPath(); context.ellipse(0, 0, geometry?.groundRadiusX ? radiusX * 1.12 : width * .065,
      geometry?.groundRadiusY ? radiusY * 1.12 : height * .03, 0, 0, Math.PI * 2); context.stroke();
    if (ended && alive) {
      context.fillStyle = colors[index] + "24";
      context.beginPath(); context.ellipse(0, -height * .18, width * .09, height * .3, 0, 0, Math.PI * 2); context.fill();
    }
    if (asset) {
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
    return point;
  }

  function effectArt(effect, points, width, height) {
    const event = effect.event, age = clock - effect.born, progress = clamp(age / .85);
    const index = event.kind === "counter" ? event.attackerId === "left" ? 0 : 1 : event.targetId === "left" ? 0 : 1;
    const point = points[index], x = point.x, y = point.y - height * .25;
    context.save(); context.globalAlpha = 1 - progress ** 2;
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
    context.textAlign = "center"; context.textBaseline = "middle"; context.lineJoin = "round";
    context.font = (event.critical ? "800 " : "700 ") + Math.max(17, Math.min(30, width / 30)) + 'px "Malgun Gothic", sans-serif';
    context.lineWidth = 4; context.strokeStyle = "#203125";
    let label = event.damage > 0 ? "−" + event.damage.toFixed(1) : reactionLabels[event.kind];
    if (event.kind === "stun" || event.kind === "counter") context.font = '700 16px "Malgun Gothic", sans-serif';
    if (label) {
      context.fillStyle = event.critical ? "#ffda8a" : ["parry", "block", "dodge"].includes(event.kind) ? "#d3f1ff" : event.kind === "counter" ? "#ffe0ae" : "#fff9df";
      context.strokeText(label, x, y - height * .28 - lift - lane); context.fillText(label, x, y - height * .28 - lift - lane);
    }
    if (event.critical && event.damage > 0) {
      context.font = '800 13px "Malgun Gothic", sans-serif'; context.fillStyle = "#ffda8a";
      context.fillText("치명", x, y - height * .28 - lift - lane - 27);
    }
    context.restore();
  }

  function render(trial, now, playing) {
    const delta = lastNow ? Math.min(.1, (now - lastNow) / 1000) : 0; lastNow = now;
    if (trial !== currentTrial) { currentTrial = trial; seen = 0; effects = []; clock = 0; deathStarted.clear(); }
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
    const width = Math.max(280, canvas.clientWidth), height = Math.max(240, canvas.clientHeight), ratio = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
    context.setTransform(ratio, 0, 0, ratio, 0, 0); background(width, height);
    if (!trial) return;
    const ended = !!trial.result()?.reason;
    const time = trial.time || clock;
    const impact = effects.findLast(effect => effect.event.damage > 0 && clock - effect.born < .11);
    context.save();
    if (impact && !reducedMotion.matches && playing) {
      const fade = 1 - (clock - impact.born) / .11;
      context.translate(Math.sin(clock * 150) * fade * (impact.event.critical ? 3 : 1.5), 0);
    }
    const points = trial.agents.map((agent, index) => fighter(agent, index, width, height, time, ended));
    for (const effect of effects) if (clock - effect.born < .85) effectArt(effect, points, width, height);
    context.restore();
  }

  return { render };
}
