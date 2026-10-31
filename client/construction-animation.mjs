import { BUILDING_TYPES, buildingDefinition, buildingImage } from "../server/buildings.mjs";
import { AGENT_LEVEL_UP } from "./agent-level-up.mjs";
import { CONSTRUCTION_APPEARANCE_ASSETS, createConstructionAppearance } from "./construction-appearance.mjs";
import { drawConstructionCore, constructionCorePose, drawConstructionBuilding } from "./construction-rig.mjs";
import { constructionGrowthPose, drawConstructionGrowth } from "./construction-growth.mjs";
import { createOrganicConstruction, organicConstructionPose } from "./construction-organic.mjs";

export const CONSTRUCTION_ANIMATION_ASSETS = Object.freeze([...CONSTRUCTION_APPEARANCE_ASSETS,
  ...["bean", "spore", "pebble", "spring"].flatMap(tribe => BUILDING_TYPES.flatMap(building =>
    [buildingImage(building.key, tribe).replace("-complete.png", "-parts.webp"), buildingImage(building.key, tribe)]))]);

const limit = value => Math.max(0, Math.min(1, value));
const ease = value => value * value * (3 - 2 * value);

export function constructionUnitPose(agent, time) {
  const attributes = agent.appearanceAttributes || agent.attributes || {};
  if (!attributes.construction || agent.species || agent.birth || agent.health <= 0) return null;
  const moving = agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration;
  const movement = moving ? (time - agent.moveStartedAt) / agent.moveDuration : 0;
  const distance = attributes.feet ? movement : ease(movement);
  const phase = moving ? (((agent.stepCount || 1) - 1 + distance) * 2) % 1 :
    Math.max(0, time - (agent.animationStartedAt ?? agent.bornAt ?? 0)) % 2.8 / 2.8;
  const action = agent.attack && time < agent.attack.endsAt ? "attack" : agent.mode === "harvest" ? "harvest" :
    agent.mode === "unload" ? "throw" : moving ? "walk" : "idle";
  const direction = moving ? {
    x: Math.sign((agent.x ?? 0) - (agent.renderFromX ?? agent.x ?? 0)) * (agent.facing < 0 ? -1 : 1),
    y: Math.sign((agent.y ?? 0) - (agent.renderFromY ?? agent.y ?? 0))
  } : { x: 0, y: 0 };
  return { action, phase, direction, frame: moving ? 4 + Math.min(7, Math.floor(phase * 8)) : Math.min(3, Math.floor(phase * 4)) };
}

export function constructionMorphPose(agent, time) {
  const plan = agent.construction;
  if (!agent.attributes?.construction || agent.health <= 0 || plan?.state !== "transforming" ||
    !Number.isFinite(plan.startedAt) || !Number.isFinite(plan.readyAt) || plan.readyAt <= plan.startedAt ||
    !buildingDefinition(plan.buildingKey)) return null;
  const progress = Number.isFinite(plan.progress) ? limit(plan.progress) : limit((time - plan.startedAt) / (plan.readyAt - plan.startedAt));
  return { progress, ...((agent.tribe || "bean") === "bean" ? organicConstructionPose(progress) : constructionGrowthPose(progress)) };
}

export function constructionApproachOffset(agent, time) {
  const plan = agent.construction;
  if (plan?.state !== "moving") return { x: 0, y: 0 };
  const definition = buildingDefinition(plan.buildingKey);
  if (!definition) return { x: 0, y: 0 };
  const x = plan.x + Math.floor((definition.width - 1) / 2), y = plan.y + Math.floor((definition.height - 1) / 2);
  if (agent.x !== x || agent.y !== y) return { x: 0, y: 0 };
  const progress = agent.moveDuration > 0 ? limit((time - agent.moveStartedAt) / agent.moveDuration) : 1;
  const amount = agent.attributes.feet ? progress : ease(progress);
  return { x: ((definition.width - 1) / 2 - Math.floor((definition.width - 1) / 2)) * amount,
    y: ((definition.height - 1) / 2 - Math.floor((definition.height - 1) / 2)) * amount };
}

export function createConstructionAnimation(assetSource, createSurface, loadImage, onError) {
  const appearance = createConstructionAppearance(assetSource, createSurface, loadImage);
  let organic = null;
  const sequences = new Map(), pending = new Map(), failures = new Set(), coreFrames = new Map();
  let effects = null, sparkle = null;

  async function prepare(tribe, buildingKey) {
    await appearance.prepare(tribe);
    if (!buildingDefinition(buildingKey)) return true;
    const key = tribe + ":" + buildingKey;
    if (!pending.has(key)) pending.set(key, (async () => {
      const geometry = appearance.manifest().sequences[key];
      const [sheet, building] = await Promise.all([loadImage(geometry.image), loadImage(buildingImage(buildingKey, tribe))]);
      sequences.set(key, { ...geometry, sheet, building, key });
      if (sequences.size > 8) {
        const oldest = sequences.keys().next().value;
        sequences.delete(oldest); pending.delete(oldest);
      }
      return true;
    })().catch(error => { pending.delete(key); throw error; }));
    return pending.get(key);
  }

  function queue(tribe, buildingKey) {
    const key = tribe + ":" + (buildingKey || "unit");
    if (pending.has(key) || failures.has(key) || !buildingKey && appearance.unit(tribe)) return;
    prepare(tribe, buildingKey).catch(error => {
      if (failures.has(key)) return;
      failures.add(key);
      if (typeof onError === "function") onError(error);
    });
  }

  function unit(tribe, index) {
    const base = appearance.unit(tribe);
    return base ? { ...base, frame: 0 } : null;
  }

  function frame(agent, time) {
    const pose = constructionUnitPose(agent, time);
    if (!pose) return null;
    queue(agent.tribe || "bean", agent.construction?.buildingKey);
    const base = appearance.frame(agent.tribe || "bean", pose);
    return base ? { ...pose, ...base } : null;
  }

  function sample(agent, time) {
    const pose = constructionMorphPose(agent, time);
    if (!pose) return null;
    const tribe = agent.tribe || "bean", key = tribe + ":" + agent.construction.buildingKey;
    const sequence = sequences.get(key);
    if (!sequence) { queue(tribe, agent.construction.buildingKey); return null; }
    sequences.delete(key); sequences.set(key, sequence);
    return { pose, sequence, tribe, progress: pose.progress };
  }

  function morphFrame(agent, time) {
    const current = sample(agent, time);
    if (!current || current.pose.settle >= 1) return null;
    const { tribe, pose } = current, base = appearance.unit(tribe);
    const index = Math.round(pose.settle * 24), key = tribe + ":" + index;
    if (!coreFrames.has(key)) {
      const sprite = createSurface(512, 512);
      if (!index) sprite.getContext("2d").drawImage(base.sprite, 0, 0);
      else drawConstructionCore(sprite.getContext("2d"), base.partsImage, base.rig, tribe, index / 24);
      const pose = constructionCorePose(tribe, base.rig, index / 24), factor = 144 / 512;
      const body = pose.body.map(value => value * factor), crown = pose.crown;
      const cap = [(crown[0] - crown[2] / 2) * factor, (crown[1] - crown[3]) * factor,
        crown[2] * factor, crown[3] * factor];
      coreFrames.set(key, { sprite, track: { ...base.track, body, cap,
        capAxis: [cap[0] + cap[2] / 2, cap[1] + cap[3] / 2, cap[2], cap[3], 0] } });
      if (coreFrames.size > 48) coreFrames.delete(coreFrames.keys().next().value);
    }
    const absorption = pose.settle;
    return { ...coreFrames.get(key), action: "idle", phase: 0, artKey: key,
      frame: key + ":" + Math.round(absorption * 24), absorption };
  }

  function drawMorph(context, agent, source, time, point, cell, reducedMotion) {
    const current = sample(agent, time);
    if (!current) return false;
    const { pose, sequence, tribe, progress } = current;
    const definition = buildingDefinition(agent.construction.buildingKey);
    if (progress >= 1) {
      context.drawImage(sequence.building, point.x, point.y, definition.width * cell, definition.height * cell);
      return true;
    }
    const base = appearance.unit(tribe);
    const attributes = agent.appearanceAttributes || agent.attributes;
    const absorption = pose.settle;
    const footPivot = tribe === "bean" && attributes.feet ? 21 / 512 * (1 - absorption) : 0;
    const elapsed = reducedMotion ? 0 : time - agent.construction.startedAt;
    context.save(); context.translate(point.x + definition.width * cell / 2, point.y + definition.height * cell / 2);
    const scale = sequence.kind === "watchpost" ? cell / pose.extent : cell;
    context.scale(scale, scale);
    if (sequence.organism) {
      organic ||= createOrganicConstruction(createSurface);
      organic(context, sequence, base, pose, progress, elapsed, source, footPivot);
    } else drawConstructionGrowth(context, sequence, base.rig.growth, base.growthImage, pose, elapsed, extent => {
      const scale = extent * 1.024;
      const ground = base.rig.growth.ground;
      context.save();
      if (ground) context.translate(ground[0], ground[1] * (1 - extent));
      context.translate(-scale / 2, -scale * (.59765625 + footPivot));
      context.scale(scale / 512, scale / 512);
      if (source && pose.settle < 1) context.drawImage(source, 0, 0);
      else drawConstructionCore(context, base.partsImage, base.rig, tribe, pose.settle, elapsed);
      context.restore();
    }, gate => drawConstructionBuilding(context, sequence.sheet, sequence, gate));
    if (!reducedMotion && sparkle && pose.opening > 0) {
      context.save(); context.globalAlpha *= Math.sin(Math.PI * pose.opening) * .32;
      for (let index = 0; index < 4; index++) {
        const angle = index * Math.PI / 2, radius = 1.05 + pose.opening * .25;
        context.drawImage(sparkle, Math.cos(angle) * radius - .025, Math.sin(angle) * radius - .025, .05, .05);
      }
      context.restore();
    }
    context.restore(); return true;
  }

  function prepareEffects() {
    effects ||= loadImage(AGENT_LEVEL_UP.sparkle).then(image => { sparkle = image; });
    return effects;
  }

  return { prepare, prepareEffects, unit, frame, morphFrame, drawMorph };
}
