import { pebbleDominantSwingAppearance, preparePebbleDominantSwing, samplePebbleDominantSwing, renderPebbleDominantSwing } from "./pebble-dominant-swing.mjs";
import { dominantDeliveryPose, dominantDeliverySample, renderDominantDelivery } from "./dominant-delivery-motion.mjs";
import { dominantResourceHarvestPose, dominantResourceHarvestSample, renderDominantResourceHarvest } from "./dominant-resource-motion.mjs";
import { beanResourceHarvestPose, prepareBeanResourceHarvest, sampleBeanResourceHarvest, renderBeanResourceHarvest } from "./bean-resource-motion.mjs";
import { beanDominantAttackAppearance, prepareBeanDominantAttack, sampleBeanDominantAttack, renderBeanDominantAttack } from "./bean-dominant-attack.mjs";
import { sporeDominantAttackAppearance, prepareSporeDominantAttack, sampleSporeDominantAttack, renderSporeDominantAttack } from "./spore-dominant-attack.mjs";
import { springDominantThrustAppearance, prepareSpringDominantThrust, sampleSpringDominantThrust, renderSpringDominantThrust } from "./spring-dominant-thrust.mjs";
import { isBladeRangedAction, bladeRangedPose, applyBladeRangedRecoil, bladeRangedSample, renderBladeRanged } from "./blade-ranged.mjs";
import { unitDisplayAttributes, unitDisplayAttributesFrom } from "./unit-display-appearance.mjs";
import { SPRING_THRUST_CAMERA, springThrustAppearance, springThrustPose, renderSpringThrust, springThrustRegisteredPose, springThrustFeatureTip, springThrustLowerBounds, renderSpringThrustBody } from "./spring-attachment-thrust.mjs";
import { attackAnimationElapsed, AGENT_ATTACK_HIT_TIME } from "../server/attack.mjs";
import { COMBAT_EVOLUTION_CATALOG } from "./combat-evolution-assets.mjs";
import { UNIT_COMBAT_DEATH_ANIMATIONS } from "./combat-death.mjs";
import { unitAnimationFrame } from "./unit-animation.mjs";
import { renderEvolutionFrame, evolutionBodyTransform, renderEvolutionAttachment } from "../DesignAssets/Animations/CombatAttributesV7/renderer.mjs";
import { attributeAttackPose, renderAttributeEffects } from "../DesignAssets/Animations/CombatAttributesV7/attack.mjs";

export const COMBAT_EVOLUTION_KEYS = Object.freeze(["blade", "piercing", "carapace"]);

export function combatEvolutionKeys(attributes) {
  attributes = unitDisplayAttributesFrom(attributes);
  return COMBAT_EVOLUTION_KEYS.filter(key => attributes?.[key] > 0);
}

export function combatEvolutionPose(agent, time, animations, skipResourceMotion = false) {
  let action = "idle", elapsed = (time - (agent.animationStartedAt ?? agent.bornAt ?? 0)) * 1000;
  const rpg = agent.combat?.version === 2;
  const hurt = (time - agent.hurtStartedAt) * 1000 * (rpg ? animations.hurt.durationMs / 120 : 1);
  const ranged = bladeRangedPose(agent, time);
  // A ranged action must not borrow a melee swing, including malformed or
  // not-yet-started launch clocks. Existing legacy compound rigs are unchanged.
  const attack = agent.attack && !isBladeRangedAction(agent) ? attackAnimationElapsed(agent.attack, time, AGENT_ATTACK_HIT_TIME, animations.attack.durationMs / 1000) * 1000 : -1;
  const rangedSample = () => ({ action: "ranged", frame: 0, elapsed: ranged.elapsed,
    sampleTime: 0, animation: animations.idle, ranged });
  const delivery = !skipResourceMotion && agent.mode === "unload" ? dominantDeliveryPose(agent, time, animations) : null;
  if (agent.health <= 0) { action = "death"; elapsed = Math.max(0, (time - (agent.diedAt ?? time)) * 1000); }
  else if (agent.birth) {
    action = "birth";
    const start = agent.birth.startedAt ?? agent.bornAt ?? time, end = agent.birth.readyAt ?? start + animations.birth.durationMs / 1000;
    elapsed = Math.max(0, (time - start) / Math.max(.001, end - start)) * animations.birth.durationMs;
  } else if (rpg && ranged) return rangedSample();
  else if (rpg && attack >= 0 && attack < animations.attack.durationMs) { action = "attack"; elapsed = attack; }
  else if (hurt >= 0 && hurt < animations.hurt.durationMs) { action = "hurt"; elapsed = hurt; }
  else if (ranged) return rangedSample();
  else if (attack >= 0 && attack < animations.attack.durationMs) { action = "attack"; elapsed = attack; }
  else if (agent.mode === "harvest") {
    const resource = !skipResourceMotion && (beanResourceHarvestPose(agent, time, animations) || dominantResourceHarvestPose(agent, time, animations));
    if (resource) return resource;
    action = animations.harvest ? "harvest" : "attack";
    elapsed = Math.max(0, time - (agent.harvestStarted ?? time)) * 1000 % animations[action].durationMs;
  }
  else if (delivery) return delivery;
  else if (agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration &&
      ((agent.tribe || "bean") !== "bean" || (unitDisplayAttributes(agent)).feet > 0)) {
    action = "walk"; elapsed = (Math.max(0, (agent.stepCount || 1) - 1) + (time - agent.moveStartedAt) / agent.moveDuration) * animations.walk.durationMs;
  }
  const animation = animations[action] || animations.idle;
  const frame = unitAnimationFrame(animation, elapsed);
  const sampleTime = animation.durationsMs.slice(0, frame).reduce((sum, value) => sum + value, 0);
  return { action: animation.action, frame, elapsed, sampleTime, animation };
}

export function createCombatEvolutionArt(assetSource, createSurface, loadImage) {
  const prepared = new Map(), pending = new Map(), frames = new Map(), portraits = new Map(), registrations = new Map(), thrustFeatures = new Map(), thrustBounds = new Map(), blank = createSurface(1, 1);
  const folder = "DesignAssets/Animations/CombatAttributesV7/";
  const resourceBeans = new WeakMap();
  function resourceBeanSample(source, time) {
    let prepared = resourceBeans.get(source);
    if (!prepared) {
      const body = prepareBeanResourceHarvest(source.rig, source.images);
      if (!body) return null;
      prepared = { body, samples: new Map() }; resourceBeans.set(source, prepared);
    }
    if (!prepared.samples.has(time)) {
      const sample = sampleBeanResourceHarvest(prepared.body, time);
      if (!sample) return null;
      prepared.samples.set(time, sample);
      if (prepared.samples.size > 32) prepared.samples.delete(prepared.samples.keys().next().value);
    }
    return prepared.samples.get(time);
  }
  const dominantBeans = new WeakMap();
  function dominantBeanSample(source, time) {
    let prepared = dominantBeans.get(source);
    if (!prepared) {
      const body = prepareBeanDominantAttack(source.rig, source.images);
      if (!body) return null;
      prepared = { body, samples: new Map() }; dominantBeans.set(source, prepared);
    }
    if (!prepared.samples.has(time)) {
      const sample = sampleBeanDominantAttack(prepared.body, time);
      if (!sample) return null;
      prepared.samples.set(time, sample);
      if (prepared.samples.size > 32) prepared.samples.delete(prepared.samples.keys().next().value);
    }
    return prepared.samples.get(time);
  }
  const dominantPebbles = new WeakMap();
  function dominantPebbleSample(source, time) {
    let prepared = dominantPebbles.get(source);
    if (!prepared) {
      const body = preparePebbleDominantSwing(source.rig, source.images);
      if (!body) return null;
      prepared = { body, samples: new Map() }; dominantPebbles.set(source, prepared);
    }
    if (!prepared.samples.has(time)) {
      const sample = samplePebbleDominantSwing(prepared.body, time);
      if (!sample) return null;
      prepared.samples.set(time, sample);
      if (prepared.samples.size > 32) prepared.samples.delete(prepared.samples.keys().next().value);
    }
    return prepared.samples.get(time);
  }
  const dominantSpores = new WeakMap();
  function dominantSporeSample(source, time) {
    let prepared = dominantSpores.get(source);
    if (!prepared) {
      const body = prepareSporeDominantAttack(source.rig, source.images);
      if (!body) return null;
      prepared = { body, samples: new Map() }; dominantSpores.set(source, prepared);
    }
    if (!prepared.samples.has(time)) {
      const sample = sampleSporeDominantAttack(prepared.body, time);
      if (!sample) return null;
      prepared.samples.set(time, sample);
      if (prepared.samples.size > 32) prepared.samples.delete(prepared.samples.keys().next().value);
    }
    return prepared.samples.get(time);
  }
  const dominantThrusts = new WeakMap();
  function dominantThrustSample(source, time) {
    let prepared = dominantThrusts.get(source);
    if (!prepared) {
      const body = prepareSpringDominantThrust(source.rig, source.images, createSurface);
      if (!body) return null;
      prepared = { body, samples: new Map() }; dominantThrusts.set(source, prepared);
    }
    if (!prepared.samples.has(time)) {
      const sample = sampleSpringDominantThrust(prepared.body, time);
      if (!sample) return null;
      prepared.samples.set(time, sample);
      if (prepared.samples.size > 32) prepared.samples.delete(prepared.samples.keys().next().value);
    }
    return prepared.samples.get(time);
  }
  function ready(tribe) { return prepared.has(tribe || "bean"); }
  async function prepare(tribe) {
    const key = tribe || "bean", name = key === "bean" ? "sprout" : key;
    if (!["sprout", "spore", "pebble", "spring"].includes(name)) return null;
    if (!pending.has(key)) pending.set(key, (async () => {
      const variants = new Map();
      await Promise.all(COMBAT_EVOLUTION_KEYS.map(async variant => {
        const definition = COMBAT_EVOLUTION_CATALOG[name + "/" + variant], response = await fetch(assetSource(definition.rig));
        if (!response.ok) throw new Error("전투 속성 외형을 불러오지 못했습니다.");
        const rig = await response.json(), images = {}, base = folder + name + "/" + variant + "/";
        await Promise.all(rig.parts.map(async part => { images[part.id] = await loadImage(base + part.image); }));
        await Promise.all(Object.entries(rig.attackMotion.images).map(async ([id, file]) => { images["attack-" + id] = await loadImage(base + file); }));
        images["attack-projectile"] = await loadImage(folder + "AttackEffects/" + name + "-projectile.png");
        images["attack-impact"] = await loadImage(folder + "AttackEffects/" + name + "-impact.png");
        const feature = definition.feature ? await loadImage(definition.feature.image) : null;
        const sheets = new Map(), loading = new Map();
        const value = { definition, rig, images, feature, sheets, loading, deathAnimation: UNIT_COMBAT_DEATH_ANIMATIONS[name + "/" + variant] };
        variants.set(variant, value);
        await Promise.all(["idle", "attack", "death"].map(action => sheet(value, action)));
      }));
      prepared.set(key, variants); return variants;
    })().catch(error => { pending.delete(key); throw error; }));
    return pending.get(key);
  }
  function sheet(source, action) {
    if (!source.loading.has(action)) source.loading.set(action, loadImage((action === "death" && source.deathAnimation || source.definition.animations[action]).image).then(image => {
      source.sheets.set(action, image); frames.clear(); return image;
    }).catch(error => { source.loading.delete(action); throw error; }));
    return source.loading.get(action);
  }
  function profile(keys, action) {
    return ["blade", "piercing", "carapace"].find(key => keys.includes(key));
  }
  function body(keys) { return ["carapace", "blade", "piercing"].find(key => keys.includes(key)); }
  function motionRig(base, master) {
    const rig = { ...base.rig, opaque: true, timelines: { ...base.rig.timelines }, attackMotion: { ...base.rig.attackMotion, projectiles: [], impact: null } };
    const factor = master.rig.scale / base.rig.scale, channels = master.rig.attackMotion.body;
    rig.attackMotion.body = Object.fromEntries(Object.entries(channels).map(([key, values]) =>
      [key, ["x", "y"].includes(key) ? values.map(([time, value]) => [time, value * factor]) : values]));
    rig.attackMotion.anchor = master.rig.attackMotion.anchor;
    rig.attackMotion.feet = master.rig.attackMotion.feet; rig.attackMotion.ground = master.rig.attackMotion.ground;
    return rig;
  }
  function bind(context, base, source, id, mirror) {
    const factor = source.rig.scale / base.rig.scale;
    const a = id.startsWith("foliage-") ? base.rig.parts.find(part => part.id.startsWith("foliage-")).pivot :
      id.startsWith("cap-") ? base.rig.parts.find(part => part.id.startsWith("cap-")).pivot : base.rig.face;
    const b = id.startsWith("foliage-") || id.startsWith("cap-") ? source.rig.parts.find(part => part.id === id).pivot : source.rig.face;
    context.translate(...a); context.scale(mirror ? -factor : factor, factor); context.translate(-b[0], -b[1]);
  }
  function attachment(context, base, source, id, sampled, feature, mirror) {
    const animation = source.definition.animations[sampled.action] || source.definition.animations.idle;
    const localTime = sampled.sampleTime / sampled.animation.durationMs * animation.durationMs;
    const images = feature ? { ...source.images, [id]: source.feature, ["attack-" + id]: source.feature } : source.images;
    context.save(); bind(context, base, source, id, mirror);
    renderEvolutionAttachment(context, source.rig, images, id, animation.action, localTime); context.restore();
  }
  function sharedTransform(context, rig, sampled) {
    context.translate(256 + rig.fitOffset[0] * 2, 448 + rig.fitOffset[1] * 2); context.scale(2 * rig.scale, 2 * rig.scale); context.translate(-rig.root[0], -rig.root[1]);
    evolutionBodyTransform(context, rig, sampled.action, sampled.sampleTime);
  }
  function bodyRegistration(surface, rig) {
    const pixels = surface.getContext("2d").getImageData(0, 0, 512, 512).data, mask = new Uint8Array(512 * 512), components = [];
    let bottom = 0;
    for (let i = 0; i < mask.length; i++) { const p = i * 4, y = Math.floor(i / 512);
      if (pixels[p + 3] > 128) bottom = Math.max(bottom, y);
      if (y > 256 && pixels[p + 3] > 192 && pixels[p] < 65 && pixels[p + 1] < 65 && pixels[p + 2] < 85 && pixels[p + 1] > pixels[p] * 1.05 && pixels[p + 2] > pixels[p] * 1.03) mask[i] = 1;
    }
    const queue = new Int32Array(mask.length);
    for (let i = 0; i < mask.length; i++) if (mask[i]) { let head = 0, tail = 1, x0 = 512, x1 = 0, y0 = 512, y1 = 0; queue[0] = i; mask[i] = 0;
      while (head < tail) { const p = queue[head++], x = p % 512, y = Math.floor(p / 512); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        for (const n of [x ? p - 1 : -1, x < 511 ? p + 1 : -1, p - 512, p + 512]) if (n >= 0 && n < mask.length && mask[n]) { mask[n] = 0; queue[tail++] = n; }
      }
      const ratio = (x1 - x0 + 1) / (y1 - y0 + 1);
      if (tail > 12 && tail < 1200 && ratio > .55 && ratio < 1.9) components.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, area: tail });
    }
    let pair = null, score = 0;
    for (const a of components) for (const b of components) if (a.x < b.x && b.x - a.x > 20 && b.x - a.x < 200 && Math.abs(a.y - b.y) < 16) {
      const value = a.area + b.area; if (value > score) { score = value; pair = [(a.x + b.x) / 2, (a.y + b.y) / 2]; }
    }
    const dy = 448 - bottom, face = [256 + rig.fitOffset[0] * 2, 448 + rig.fitOffset[1] * 2 + (rig.face[1] - rig.root[1]) * rig.scale * 2];
    return { dy, offset: pair ? [(pair[0] - face[0]) / (2 * rig.scale), (pair[1] + dy - face[1]) / (2 * rig.scale)] : [0, 0] };
  }

  function drawComposite(context, variants, keys, sampled, replacement, result) {
    const base = variants.get(body(keys)), master = variants.get(profile(keys, sampled.action)), rig = motionRig(base, master);
    let registration = null, replacementSocket = null, neutralBody = null, bodyReady = true, thrustReady = false;
    const thrustKind = replacement?.thrustKind;
    const thrust = replacement?.springThrust && sampled.action === "attack";
    if (replacement && rig.tribe !== "sprout") {
      const reference = createSurface(512, 512); replacement(reference.getContext("2d"), sampled);
      const registrationKey = rig.tribe + keys.join(",") + replacement.key;
      if (!registrations.has(registrationKey)) registrations.set(registrationKey, bodyRegistration(reference, rig));
      registration = registrations.get(registrationKey);
      // Hop feet follow the body, but may still tuck out of view. Keep that
      // authored visibility track instead of baking visible feet into the body.
      const splitFeet = replacement.splitFeet && (sampled.action === "hurt" ||
        sampled.action === "attack" && (["plant", "tuck"].includes(rig.attackMotion.feet) ||
          Array.isArray(rig.attackMotion.body.feetAlpha)));
      const layers = new Map([[undefined, reference]]);
      if (splitFeet) for (const layer of ["combat-body", "combat-feet"]) {
        const surface = createSurface(512, 512);
        const socket = replacement(surface.getContext("2d"), sampled, layer);
        if (thrust && layer === "combat-body" && socket &&
            Array.isArray(socket.source) && socket.source.length === 2 &&
            Array.isArray(socket.target) && socket.target.length === 2 &&
            [...socket.source, ...socket.target].every(Number.isFinite)) replacementSocket = socket;
        layers.set(layer, surface);
      }
      if (thrust && thrustKind?.smallFeet && replacementSocket) {
        neutralBody = createSurface(512, 512);
        replacement(neutralBody.getContext("2d"), { ...sampled, action: "idle", sampleTime: 0, frame: 0 }, "combat-body");
      }
      replacement = (target, pose, layer) => target.drawImage(layers.get(layer), 0, registration.dy);
      replacement.splitFeet = splitFeet;
    }
    if (rig.tribe === "pebble") {
      const hull = keys.flatMap(key => { const source = variants.get(key), factor = source.rig.scale / rig.scale;
        return source.rig.parts.find(part => part.id === "body").contactHull.map(point =>
          [rig.face[0] + (point[0] - source.rig.face[0]) * factor + (registration?.offset[0] || 0), rig.face[1] + (point[1] - source.rig.face[1]) * factor + (registration?.offset[1] || 0)]);
      });
      rig.parts = rig.parts.map(part => part.id === "body" ? { ...part, contactHull: hull } : part);
    }
    const images = Object.fromEntries(Object.entries(base.images).map(([key, image]) =>
      [key, key.includes("foliage-") || key.includes("cap-") ? blank : image]));
    const attachments = [];
    for (const key of ["carapace", "blade", "piercing"].filter(key => keys.includes(key))) {
      const source = variants.get(key);
      if (rig.tribe === "sprout") {
        for (const part of source.rig.parts.filter(part => part.id.startsWith("foliage-"))) {
          attachments.push({ source, id: part.id, feature: false, rear: false, mirror: false });
        }
      } else if (rig.tribe === "spore") attachments.push({ source, id: "cap-left", feature: (key !== base.rig.variant || replacement) && Boolean(source.feature), rear: Boolean((key !== base.rig.variant || replacement) && source.definition.feature?.rear), mirror: false });
      else if (key !== base.rig.variant || replacement) attachments.push({ source, id: "body", feature: true,
        rear: source.definition.feature.rear || Boolean(replacement && rig.tribe === "spring"), mirror: rig.tribe === "spring" && key === "blade" && keys.includes("piercing") });
    }
    for (const rear of [true, false]) {
      if (!rear) {
        if (replacement?.splitFeet) drawReplacementFeet(context, rig, sampled, replacement);
        context.save(); context.translate(256, 448); context.scale(2, 2); context.translate(-128, -230);
        if (!replacement) renderEvolutionFrame(context, rig, images, sampled.action, sampled.sampleTime); context.restore();
        if (replacement) {
          if (replacementSocket && thrustKind?.smallFeet) {
            bodyReady = drawSpringBody(context, rig, sampled, replacement, registration, neutralBody, thrustKind.key);
          } else drawReplacementBody(context, rig, sampled, replacement);
        }
      }
      for (const item of attachments.filter(item => item.rear === rear)) {
        if (replacementSocket && item.feature && item.source.rig.variant === "blade" &&
            drawSpringThrust(context, base, item, rig, sampled, registration, replacementSocket, thrustKind?.control)) {
          thrustReady = true;
        } else {
          context.save(); sharedTransform(context, rig, sampled);
          if (registration) context.translate(...registration.offset);
          attachment(context, base, item.source, item.id, sampled, item.feature, item.mirror);
          context.restore();
        }
      }
    }
    if (sampled.action === "attack") {
      const effects = [master.rig.variant];
      for (const key of effects) {
        const source = variants.get(key); context.save(); context.translate(256 + rig.fitOffset[0] * 2, 448 + rig.fitOffset[1] * 2); context.scale(2 * rig.scale, 2 * rig.scale); context.translate(-rig.root[0], -rig.root[1]);
        if (registration) context.translate(...registration.offset);
        bind(context, base, source, "body", false);
        const effectRig = motionRig(source, master); effectRig.attackMotion.projectiles = source.rig.attackMotion.projectiles; effectRig.attackMotion.impact = source.rig.attackMotion.impact;
        if (rig.tribe === "pebble") { const factor = source.rig.scale / rig.scale;
          effectRig.root = [source.rig.face[0] + (rig.root[0] - rig.face[0]) / factor, source.rig.face[1] + (rig.root[1] - rig.face[1]) / factor];
          const hull = rig.parts.find(part => part.id === "body").contactHull.map(point => [source.rig.face[0] + (point[0] - rig.face[0]) / factor, source.rig.face[1] + (point[1] - rig.face[1]) / factor]);
          effectRig.parts = effectRig.parts.map(part => part.id === "body" ? { ...part, contactHull: hull } : part);
        }
        renderAttributeEffects(context, effectRig, source.images, sampled.sampleTime); context.restore();
      }
    }
    if (result) result.thrustReady = thrustReady && bodyReady;
    return rig;
  }
  function drawReplacementBody(context, rig, sampled, replacement) {
    context.save(); sharedTransform(context, rig, sampled); context.translate(...rig.root);
    context.scale(1 / (2 * rig.scale), 1 / (2 * rig.scale)); context.translate(-256, -448);
    replacement(context, sampled, replacement.splitFeet ? "combat-body" : undefined); context.restore();
  }
  function drawSpringBody(context, rig, sampled, replacement, registration, neutral, form) {
    const image = createSurface(1024, 1024), target = image.getContext("2d"); target.scale(2, 2);
    drawReplacementBody(target, rig, sampled, replacement);
    const key = JSON.stringify([form, registration.dy, registration.offset]), poseKey = key + ":" + sampled.frame;
    const bounds = (surface, cacheKey) => {
      if (thrustBounds.has(cacheKey)) return thrustBounds.get(cacheKey);
      let value = null;
      try { value = springThrustLowerBounds(surface.getContext("2d").getImageData(0, 0, 1024, 1024).data, 1024, 1024); } catch {}
      // Missing/tainted pixels must be retried, never cached as valid geometry.
      if (value) {
        thrustBounds.set(cacheKey, value);
        if (thrustBounds.size > 128) thrustBounds.delete(thrustBounds.keys().next().value);
      }
      return value;
    };
    let support = thrustBounds.get(key + ":neutral");
    if (!support) {
      const surface = createSurface(1024, 1024), ctx = surface.getContext("2d"); ctx.scale(2, 2);
      drawReplacementBody(ctx, rig, { ...sampled, sampleTime: 0, frame: 0 },
        destination => destination.drawImage(neutral, 0, registration.dy));
      support = bounds(surface, key + ":neutral");
    }
    if (renderSpringThrustBody(context, image, bounds(image, poseKey), support)) return true;
    thrustBounds.delete(poseKey); thrustBounds.delete(key + ":neutral");
    drawReplacementBody(context, rig, sampled, replacement); return false;
  }
  function drawSpringThrust(context, base, item, rig, sampled, registration, socket, control) {
    const neutral = { ...sampled, sampleTime: 0, frame: 0 };
    const key = JSON.stringify([registration.dy, registration.offset]);
    let feature = thrustFeatures.get(key);
    if (!feature) {
      feature = createSurface(512, 512);
      const target = feature.getContext("2d");
      sharedTransform(target, rig, neutral); target.translate(...registration.offset);
      attachment(target, base, item.source, item.id, neutral, true, false);
      thrustFeatures.set(key, feature);
      if (thrustFeatures.size > 8) thrustFeatures.delete(thrustFeatures.keys().next().value);
    }
    const project = (point, pose) => {
      const target = createSurface(1, 1).getContext("2d");
      sharedTransform(target, rig, pose); target.translate(...rig.root);
      target.scale(1 / (2 * rig.scale), 1 / (2 * rig.scale)); target.translate(-256, -448);
      const m = target.getTransform(), [x, y] = [point[0], point[1] + registration.dy];
      return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
    };
    const source = project(socket.source, neutral), target = project(socket.target, sampled);
    let pose;
    if (control) pose = springThrustPose(sampled.sampleTime, source, target);
    else {
      if (!feature.thrustTip) {
        try { feature.thrustTip = springThrustFeatureTip(feature.getContext("2d").getImageData(0, 0, 512, 512).data, 512, 512); } catch {}
      }
      if (!feature.thrustTip) { thrustFeatures.delete(key); return false; }
      pose = springThrustRegisteredPose(sampled.sampleTime, source, target, feature.thrustTip);
    }
    if (!pose) return false;
    renderSpringThrust(context, feature, pose); return true;
  }

  function drawReplacementFeet(context, rig, sampled, replacement) {
    context.save();
    context.translate(256 + rig.fitOffset[0] * 2, 448 + rig.fitOffset[1] * 2);
    context.scale(2 * rig.scale, 2 * rig.scale); context.translate(-rig.root[0], -rig.root[1]);
    if (sampled.action === "attack") {
      const pose = attributeAttackPose(rig, sampled.sampleTime).body;
      context.globalAlpha *= rig.opaque ? (pose.feetAlpha > .35 ? 1 : 0) : pose.feetAlpha;
      if (rig.attackMotion.feet === "plant") context.translate(pose.x * .45, Math.min(0, pose.y) * .25);
      else {
        evolutionBodyTransform(context, rig, sampled.action, sampled.sampleTime);
        if (rig.attackMotion.feet === "tuck") context.translate(0, -(1 - pose.feetAlpha) * 18);
      }
    }
    // Hurt keeps the original support; only body-mounted pixels recoil.
    context.translate(...rig.root); context.scale(1 / (2 * rig.scale), 1 / (2 * rig.scale)); context.translate(-256, -448);
    replacement(context, sampled, "combat-feet"); context.restore();
  }
  function drawSproutAttributes(surface, rig, sampled, agent, drawAttributes) {
    const sprite = createSurface(512, 512), context = sprite.getContext("2d");
    context.drawImage(surface, 0, 0);
    // Extra root feet use the same support policy as the original rig's feet.
    // Body-mounted antennae/arms still follow the complete body transform.
    const planted = drawAttributes.splitFeet && (sampled.action === "hurt" ||
      sampled.action === "attack" && rig.attackMotion.feet === "plant");
    if (planted) {
      context.save(); context.translate(rig.fitOffset[0] * 2, rig.fitOffset[1] * 2);
      if (sampled.action === "attack") {
        const pose = attributeAttackPose(rig, sampled.sampleTime).body;
        context.translate(pose.x * .45 * 2 * rig.scale, Math.min(0, pose.y) * .25 * 2 * rig.scale);
      }
      drawAttributes(context, sampled, "feet"); context.restore();
    }
    context.save(); sharedTransform(context, rig, sampled); context.translate(...rig.root);
    context.scale(1 / (2 * rig.scale), 1 / (2 * rig.scale)); context.translate(-256, -448);
    drawAttributes(context, sampled, planted ? "body" : undefined); context.restore();
    return sprite;
  }
  function frame(agent, time, drawAttributes, drawBody, skipDominantMotion = false, skipResourceMotion = false, skipIdleSheet = false, skipRangedExpression = false) {
    const variants = prepared.get(agent.tribe || "bean"), attributes = unitDisplayAttributes(agent), keys = combatEvolutionKeys(attributes);
    if (!variants || !keys.length) return null;
    const source = variants.get(keys.length === 1 ? keys[0] : body(keys));
    let replacement = drawBody && (source.rig.tribe !== "sprout" && ["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0)) ? drawBody : null;
    if (replacement) {
      const paint = replacement;
      replacement = (context, pose, layer) => paint(context, pose, layer);
      replacement.key = JSON.stringify(attributes);
      // Every morphology portrait includes support feet, even without the
      // added-feet upgrade. Keep those small feet on the same authored support
      // and visibility track instead of baking them into the recoiling body.
      replacement.splitFeet = Boolean(paint.splitFeet);
      replacement.springThrust = Boolean(paint.springThrust && replacement.splitFeet && agent.attack &&
        agent.attack.mode !== "ranged" && springThrustAppearance(agent.tribe, attributes));
      replacement.thrustKind = { control: attributes.antenna > 0 && attributes.feet > 0,
        smallFeet: !(attributes.feet > 0), key: `${attributes.antenna > 0}:${attributes.feet > 0}` };
    }
    const deathAnimation = keys.length === 1 && !replacement && !["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0) ? source.deathAnimation : null;
    const animations = deathAnimation ? { ...source.definition.animations, death: deathAnimation } : source.definition.animations;
    const requested = combatEvolutionPose(agent, time, animations, skipResourceMotion), ranged = requested.ranged;
    const rangedBody = ranged && !skipRangedExpression && !skipIdleSheet && keys.length === 1 && !replacement ? bladeRangedSample(source, requested) : null;
    const resourceRequested = requested.action === "harvest" && !skipResourceMotion;
    const beanHarvest = resourceRequested && !requested.dominantResource ? resourceBeanSample(source, requested.sampleTime) : null;
    const dominantHarvest = resourceRequested && requested.dominantResource ? dominantResourceHarvestSample(source, requested) : null;
    const resourceHarvest = beanHarvest || dominantHarvest;
    if (resourceRequested && !resourceHarvest) return frame(agent, time, drawAttributes, drawBody, skipDominantMotion, true);
    const deliveryRequested = Boolean(requested.dominantDelivery), delivery = deliveryRequested ? dominantDeliverySample(source, requested) : null;
    if (deliveryRequested && !delivery) return frame(agent, time, drawAttributes, drawBody, skipDominantMotion, true, true);
    const resourceBody = resourceHarvest || delivery;
    // Reuse the approved neutral blade pixels for this separate firing action.
    // No melee frame/effect or hidden secretion body is drawn into this layer.
    const sampled = ranged ? { ...requested, action: "idle", frame: 0, sampleTime: 0 } : requested;
    const liveFeet = sampled.action !== "death" && source.rig.tribe === "sprout" && attributes.feet > 0;
    const dynamic = liveFeet && drawAttributes && !replacement;
    const thrust = replacement?.springThrust && sampled.action === "attack";
    const dominantRequested = !skipDominantMotion && !agent.species && !replacement && agent.attack && sampled.action === "attack" &&
      !isBladeRangedAction(agent) && springDominantThrustAppearance(agent.tribe, attributes);
    const dominantThrust = dominantRequested ? dominantThrustSample(source, sampled.sampleTime) : null;
    const sporeRequested = !skipDominantMotion && !agent.species && !replacement && agent.attack && sampled.action === "attack" &&
      !isBladeRangedAction(agent) && sporeDominantAttackAppearance(agent.tribe, attributes);
    const dominantSpore = sporeRequested ? dominantSporeSample(source, sampled.sampleTime) : null;
    const beanRequested = !skipDominantMotion && !agent.species && !replacement && agent.attack && sampled.action === "attack" &&
      !isBladeRangedAction(agent) && beanDominantAttackAppearance(agent.tribe, attributes);
    const dominantBean = beanRequested ? dominantBeanSample(source, sampled.sampleTime) : null;
    const pebbleRequested = !skipDominantMotion && !agent.species && !replacement && agent.attack && sampled.action === "attack" &&
      !isBladeRangedAction(agent) && pebbleDominantSwingAppearance(agent.tribe, attributes);
    const dominantPebble = pebbleRequested ? dominantPebbleSample(source, sampled.sampleTime) : null;
    const key = [agent.tribe || "bean", JSON.stringify(attributes), requested.action, ranged?.frame ?? sampled.frame, Boolean(drawAttributes), Boolean(replacement?.splitFeet),
      Boolean(thrust), Boolean(dominantThrust), Boolean(dominantSpore), Boolean(dominantBean), Boolean(dominantPebble), Boolean(rangedBody), requested.dominantDelivery?.key || "", replacement && !thrust ? liveFeet ? agent.id + ":" + time : Math.floor(time * 25) : ""].join("|");
    const cached = !skipIdleSheet && frames.get(key);
    if (cached) return dynamic ? drawSproutAttributes(cached.sprite, cached.rig, sampled, agent, drawAttributes) : cached.sprite;
    // Existing sheets are already rasterized. Draw them once into the final
    // camera instead of enlarging to 1024 and filtering back down to 512.
    // Live multi-part rendering retains its existing supersampled surface.
    const directSheet = !skipIdleSheet && !resourceBody && !dominantThrust && !dominantSpore && !dominantBean && !dominantPebble && keys.length === 1 && !replacement && (sampled.action !== "death" || deathAnimation) && source.sheets.get(sampled.action);
    const camera = thrust || dominantThrust ? SPRING_THRUST_CAMERA : null, width = camera?.width || 512, height = camera?.height || 512;
    const surface = createSurface(width, height), large = directSheet || resourceBody || dominantThrust || dominantSpore || dominantBean || dominantPebble ? surface : createSurface(width * 2, height * 2), context = large.getContext("2d");
    if (camera) surface.combatCamera = camera;
    if (!directSheet && !resourceBody && !dominantThrust && !dominantSpore && !dominantBean && !dominantPebble) context.scale(2, 2);
    if (camera) context.translate(camera.offsetX, camera.offsetY);
    if (ranged && !rangedBody) applyBladeRangedRecoil(context, ranged);
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
    if (sampled.action === "birth" && sampled.sampleTime < sampled.animation.durationMs * .035) return surface;
    let rig = source.rig;
    const rendered = {};
    if (rangedBody) {
      // Discard a failed partial mesh and retry the original body-only recoil.
      // Its separate cache key never freezes a failed expressive sample.
      if (!renderBladeRanged(context, rangedBody)) return frame(agent, time, drawAttributes, drawBody, skipDominantMotion, skipResourceMotion, skipIdleSheet, true);
    }
    else if (delivery) {
      if (!renderDominantDelivery(context, delivery)) return frame(agent, time, drawAttributes, drawBody, skipDominantMotion, true, true);
    }
    else if (dominantHarvest) {
      if (!renderDominantResourceHarvest(context, dominantHarvest)) return frame(agent, time, drawAttributes, drawBody, skipDominantMotion, true);
    }
    else if (beanHarvest) {
      if (!renderBeanResourceHarvest(context, beanHarvest)) {
        resourceBeans.delete(source);
        return frame(agent, time, drawAttributes, drawBody, skipDominantMotion, true);
      }
    }
    else if (dominantPebble) {
      if (!renderPebbleDominantSwing(context, dominantPebble)) {
        dominantPebbles.delete(source);
        return frame(agent, time, drawAttributes, drawBody, true, skipResourceMotion);
      }
    }
    else if (dominantBean) {
      if (!renderBeanDominantAttack(context, dominantBean)) {
        dominantBeans.delete(source);
        return frame(agent, time, drawAttributes, drawBody, true, skipResourceMotion);
      }
    }
    else if (dominantSpore) {
      if (!renderSporeDominantAttack(context, dominantSpore)) {
        dominantSpores.delete(source);
        return frame(agent, time, drawAttributes, drawBody, true, skipResourceMotion);
      }
    }
    else if (dominantThrust) {
      if (!renderSpringDominantThrust(context, dominantThrust)) {
        dominantThrusts.delete(source);
        // Discard this private, partly drawn surface. Retry only the unchanged
        // sheet path once; do not recurse into another failing mesh attempt.
        return frame(agent, time, drawAttributes, drawBody, true, skipResourceMotion);
      }
    }
    else if (keys.length === 1 && !replacement) {
      const animation = sampled.animation, frameSize = animation.frameSize || 256, columns = animation.columns || 8;
      const pivotX = animation.pivotX ?? animation.pivot?.[0] ?? 128, pivotY = animation.pivotY ?? animation.pivot?.[1] ?? 230;
      const image = skipIdleSheet && sampled.action === "idle" || sampled.action === "death" && !deathAnimation ? null : source.sheets.get(sampled.action);
      context.save(); context.translate(256, 448); context.scale(512 / frameSize, 512 / frameSize); context.translate(-pivotX, -pivotY);
      if (image) context.drawImage(image, sampled.frame % columns * frameSize, Math.floor(sampled.frame / columns) * frameSize, frameSize, frameSize, 0, 0, frameSize, frameSize);
      else {
        sheet(source, sampled.action).catch(() => {});
        renderEvolutionFrame(context, source.rig, source.images, sampled.action, sampled.sampleTime);
      }
      context.restore();
    } else rig = drawComposite(context, variants, keys, sampled, replacement, rendered);
    if (drawAttributes && !replacement && !dynamic && !resourceBody) {
      context.save(); sharedTransform(context, rig, sampled); context.translate(...rig.root);
      context.scale(1 / (2 * rig.scale), 1 / (2 * rig.scale)); context.translate(-256, -448);
      drawAttributes(context, sampled); context.restore();
    }
    if (large !== surface) {
      const target = surface.getContext("2d"); target.imageSmoothingEnabled = true; target.imageSmoothingQuality = "high"; target.drawImage(large, 0, 0, width, height);
    }
    // Delivery failures must not retry the same unavailable sheet or poison the
    // ordinary idle cache. Render the original own-source idle rig once instead.
    if (skipIdleSheet) return surface;
    // A temporarily unavailable/malformed animated body must be retried when
    // its source becomes ready, not frozen as a successful thrust cache entry.
    if (thrust && !rendered.thrustReady || dominantRequested && !dominantThrust || sporeRequested && !dominantSpore || beanRequested && !dominantBean || pebbleRequested && !dominantPebble) return surface;
    frames.set(key, { sprite: surface, rig });
    // Keep the old 96-square pixel ceiling even when a sprite has a wider camera.
    let pixels = [...frames.values()].reduce((sum, entry) => sum + entry.sprite.width * entry.sprite.height, 0);
    while (frames.size > 96 || pixels > 96 * 512 * 512) {
      const oldest = frames.keys().next().value, entry = frames.get(oldest);
      pixels -= entry.sprite.width * entry.sprite.height; frames.delete(oldest);
    }
    return dynamic ? drawSproutAttributes(surface, rig, sampled, agent, drawAttributes) : surface;
  }
  function portrait(agent, drawAttributes) {
    const attributes = unitDisplayAttributes(agent), key = (agent.tribe || "bean") + JSON.stringify(attributes);
    if (!portraits.has(key)) {
      const result = frame({ ...agent, health: 1, birth: null, diedAt: null, attack: null, support: null, hurtStartedAt: -Infinity, moveDuration: 0, animationStartedAt: 0 }, 0, drawAttributes, undefined, false, true);
      if (result) portraits.set(key, result); else return null;
    }
    return portraits.get(key);
  }
  function bodySize(agent, replacement) {
    const attributes = unitDisplayAttributes(agent), keys = combatEvolutionKeys(attributes);
    const variants = prepared.get(agent.tribe || "bean");
    if (!variants || !keys.length) return null;
    const source = variants.get(keys.length === 1 ? keys[0] : body(keys));
    if (source.rig.tribe !== "sprout" &&
        ["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0)) return replacement;
    if (!source.bodySize) {
      const image = source.images.body, surface = createSurface(image.naturalWidth || image.width, image.naturalHeight || image.height);
      const context = surface.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
      let left = surface.width, right = 0, top = surface.height, bottom = 0;
      for (let y = 0; y < surface.height; y++) for (let x = 0; x < surface.width; x++) if (pixels[(y * surface.width + x) * 4 + 3] >= 16) {
        left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      }
      source.bodySize = { width: right - left, height: bottom - top };
    }
    return { width: source.bodySize.width * source.rig.scale * 2, height: source.bodySize.height * source.rig.scale * 2 };
  }

  function clearDeaths() {
    for (const key of frames.keys()) if (key.split("|")[2] === "death") frames.delete(key);
  }

  return { prepare, ready, frame, portrait, bodySize, clearDeaths };
}

