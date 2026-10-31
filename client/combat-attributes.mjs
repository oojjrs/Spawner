import { createCombatEvolutionArt, combatEvolutionKeys } from "./combat-evolution.mjs";
import { COMBAT_ATTRIBUTE_KEYS } from "../server/attributes.mjs";
import { unitAnimationPose, unitAnimationFrame } from "./unit-animation.mjs";
import { renderCombatFrame } from "../DesignAssets/Animations/CombatAttributesV4/compositor.mjs";

export function combatAttributeKeys(attributes) {
  return COMBAT_ATTRIBUTE_KEYS.filter(key => attributes?.[key] > 0);
}

export function combatAttributePose(agent, time, rig) {
  const pose = unitAnimationPose(agent, time);
  let action = pose?.action || "idle", elapsed = time - (agent.animationStartedAt ?? agent.bornAt ?? 0);
  if (agent.birth) {
    action = "birth";
    const start = agent.birth.startedAt ?? agent.bornAt ?? time;
    elapsed = Math.max(0, time - start) / Math.max(.001, agent.birth.readyAt - start) *
      rig.animations.birth.durationsMs.reduce((sum, value) => sum + value, 0) / 1000;
  } else if (agent.health <= 0) action = "death";
  else if (!pose && agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration) {
    action = "walk";
    elapsed = (agent.stepCount || 0) + (time - agent.moveStartedAt) / agent.moveDuration;
  }
  const sourceAction = rig.animations[action] ? action : "idle";
  const animation = rig.animations[sourceAction];
  const durationMs = animation.durationsMs.reduce((sum, value) => sum + value, 0);
  const definition = { ...animation, durationMs, frameCount: animation.durationsMs.length, loop: ["idle", "walk"].includes(sourceAction) };
  const index = pose && sourceAction === pose.action ? Math.min(definition.frameCount - 1,
    Math.floor(pose.frame / pose.animation.frameCount * definition.frameCount)) : unitAnimationFrame(definition, elapsed * 1000);
  const support = agent.support;
  if (support && time >= support.startedAt && time < support.endsAt && !["attack", "hurt"].includes(action)) {
    return { action: support.kind, index, track: animation.tracks[index], elapsed: (time - support.startedAt) * 1000,
      duration: (support.endsAt - support.startedAt) * 1000 };
  }
  const started = action === "attack" ? agent.attack?.startedAt : action === "hurt" ? agent.hurtStartedAt : null;
  return { action: sourceAction, index, track: animation.tracks[index], elapsed: started === null ? elapsed * 1000 : (time - started) * 1000, duration: durationMs };
}

function createRegenerationArt(assetSource, createSurface, loadImage) {
  const rigs = new Map(), pending = new Map(), frames = new Map();
  const empty = createSurface(256, 256);

  function ready(tribe) {
    return rigs.has(tribe || "bean");
  }

  function prepare(tribe) {
    const key = tribe || "bean", folder = key === "bean" ? "sprout" : key;
    if (!["sprout", "spore", "pebble", "spring"].includes(folder)) return Promise.resolve(null);
    if (!pending.has(key)) pending.set(key, (async () => {
      const root = "DesignAssets/Animations/CombatAttributesRuntimeV1/" + folder + "/";
      const response = await fetch(assetSource(root + "rig.json"));
      if (!response.ok) throw new Error("전투 속성 외형을 불러오지 못했습니다.");
      const rig = await response.json();
      const images = Object.fromEntries(await Promise.all(Object.entries(rig.parts).filter(([name]) => ["bud", "tendril"].includes(name)).map(async ([name, part]) =>
        [name, await loadImage(root + part.image)])));
      rigs.set(key, { rig, images });
      return rig;
    })().catch(error => { pending.delete(key); throw error; }));
    return pending.get(key);
  }

  function frame(agent, time, scale, drawBody) {
    const prepared = rigs.get(agent.tribe || "bean"), attributes = agent.appearanceAttributes || agent.attributes || {};
    const keys = combatAttributeKeys(attributes).filter(key => key === "regeneration");
    if (!prepared || !keys.length) return null;
    const key = [agent.id, agent.tribe, Math.floor(time * 25), Object.entries(attributes).map(pair => pair.join(":")),
      agent.support?.kind, agent.health <= 0, agent.carrying, agent.carryingType].join("|");
    if (frames.has(key)) return frames.get(key);
    const surface = createSurface(512, 512), context = surface.getContext("2d");
    const growth = 1 + keys.length * .1;
    context.save(); context.translate(256, 448); context.scale(growth, growth); context.translate(-256, -448);
    drawBody(context); context.restore();
    const sampled = combatAttributePose(agent, time, prepared.rig);
    if (sampled.track?.visible) {
      context.save(); context.translate(256, 448); context.scale(scale, scale); context.translate(-128, -224);
      renderCombatFrame(context, empty, prepared.rig, prepared.images, sampled.track, keys,
        sampled.action, sampled.elapsed, sampled.duration, { x: 128, y: 224, scale: 1 });
      context.restore();
    }
    frames.set(key, surface);
    if (frames.size > 64) frames.delete(frames.keys().next().value);
    return surface;
  }

  return { prepare, ready, frame };
}

export function hasCombatEvolution(attributes) { return combatEvolutionKeys(attributes).length > 0; }

export function createCombatAttributeArt(assetSource, createSurface, loadImage) {
  const evolution = createCombatEvolutionArt(assetSource, createSurface, loadImage);
  const regeneration = createRegenerationArt(assetSource, createSurface, loadImage);
  function frame(agent, time, scale, drawBody, drawAttributes) {
    const sprite = evolution.frame(agent, time, drawAttributes, drawBody);
    const attributes = agent.appearanceAttributes || agent.attributes || {};
    if (!attributes.regeneration) return sprite;
    return regeneration.frame(agent, time, scale, sprite ? context => context.drawImage(sprite, 0, 0) : drawBody);
  }
  function portrait(agent, drawAttributes) {
    const sprite = evolution.portrait(agent, drawAttributes);
    if (!sprite) return null;
    const attributes = agent.appearanceAttributes || agent.attributes || {};
    return attributes.regeneration ? regeneration.frame({ ...agent, id: "portrait", health: 1, birth: null, attack: null, support: null, hurtStartedAt: -Infinity, moveDuration: 0, animationStartedAt: 0 }, 0, 1, context => context.drawImage(sprite, 0, 0)) : sprite;
  }
  return {
    prepare: tribe => Promise.all([evolution.prepare(tribe), regeneration.prepare(tribe)]),
    ready: tribe => evolution.ready(tribe) && regeneration.ready(tribe), frame, portrait
  };
}
