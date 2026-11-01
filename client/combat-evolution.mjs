import { COMBAT_EVOLUTION_CATALOG } from "./combat-evolution-assets.mjs";
import { unitAnimationFrame } from "./unit-animation.mjs";
import { createExcavationArt } from "./excavation.mjs";
import { renderEvolutionFrame, evolutionBodyTransform, renderEvolutionAttachment } from "../DesignAssets/Animations/CombatAttributesV7/renderer.mjs";
import { renderAttributeEffects } from "../DesignAssets/Animations/CombatAttributesV7/attack.mjs";

export const COMBAT_EVOLUTION_KEYS = Object.freeze(["blade", "piercing", "carapace", "guard"]);

export function combatEvolutionKeys(attributes) {
  return COMBAT_EVOLUTION_KEYS.filter(key => attributes?.[key] > 0);
}

export function combatEvolutionPose(agent, time, animations) {
  let action = "idle", elapsed = (time - (agent.animationStartedAt ?? agent.bornAt ?? 0)) * 1000;
  const hurt = (time - agent.hurtStartedAt) * 1000;
  const attack = agent.attack ? (time - agent.attack.startedAt) * (agent.attack.speed || 1) * 1000 : -1;
  if (agent.health <= 0) { action = "death"; elapsed = Math.max(0, (time - (agent.diedAt ?? time)) * 1000); }
  else if (agent.birth) {
    action = "birth";
    const start = agent.birth.startedAt ?? agent.bornAt ?? time, end = agent.birth.readyAt ?? start + animations.birth.durationMs / 1000;
    elapsed = Math.max(0, (time - start) / Math.max(.001, end - start)) * animations.birth.durationMs;
  } else if (hurt >= 0 && hurt < animations.hurt.durationMs) { action = "hurt"; elapsed = hurt; }
  else if (attack >= 0 && attack < animations.attack.durationMs) { action = "attack"; elapsed = attack; }
  else if (agent.mode === "harvest") {
    action = animations.harvest ? "harvest" : "attack";
    elapsed = Math.max(0, time - (agent.harvestStarted ?? time)) * 1000 % animations[action].durationMs;
  }
  else if (agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration &&
      ((agent.tribe || "bean") !== "bean" || (agent.appearanceAttributes || agent.attributes || {}).feet > 0)) {
    action = "walk"; elapsed = (Math.max(0, (agent.stepCount || 1) - 1) + (time - agent.moveStartedAt) / agent.moveDuration) * animations.walk.durationMs;
  }
  const animation = animations[action] || animations.idle;
  const frame = unitAnimationFrame(animation, elapsed);
  const sampleTime = animation.durationsMs.slice(0, frame).reduce((sum, value) => sum + value, 0);
  return { action: animation.action, frame, elapsed, sampleTime, animation };
}

export function createCombatEvolutionArt(assetSource, createSurface, loadImage) {
  const prepared = new Map(), pending = new Map(), frames = new Map(), portraits = new Map(), registrations = new Map(), blank = createSurface(1, 1);
  const folder = "DesignAssets/Animations/CombatAttributesV7/";
  const excavation = createExcavationArt(assetSource, loadImage);
  function ready(tribe) { return prepared.has(tribe || "bean"); }
  async function prepare(tribe) {
    const key = tribe || "bean", name = key === "bean" ? "sprout" : key;
    if (!["sprout", "spore", "pebble", "spring"].includes(name)) return null;
    if (!pending.has(key)) pending.set(key, (async () => {
      await excavation.prepare();
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
        const value = { definition, rig, images, feature, sheets, loading };
        variants.set(variant, value);
        await Promise.all(["idle", "attack"].map(action => sheet(value, action)));
      }));
      prepared.set(key, variants); return variants;
    })().catch(error => { pending.delete(key); throw error; }));
    return pending.get(key);
  }
  function sheet(source, action) {
    if (!source.loading.has(action)) source.loading.set(action, loadImage(source.definition.animations[action].image).then(image => {
      source.sheets.set(action, image); frames.clear(); return image;
    }).catch(error => { source.loading.delete(action); throw error; }));
    return source.loading.get(action);
  }
  function profile(keys, action) {
    return ["blade", "piercing", "guard", "carapace"].find(key => keys.includes(key));
  }
  function body(keys) { return ["carapace", "guard", "blade", "piercing"].find(key => keys.includes(key)); }
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

  function drawComposite(context, variants, keys, sampled, replacement) {
    const base = variants.get(body(keys)), master = variants.get(profile(keys, sampled.action)), rig = motionRig(base, master);
    let registration = null;
    if (replacement && rig.tribe !== "sprout") {
      const reference = createSurface(512, 512); replacement(reference.getContext("2d"), sampled);
      const registrationKey = rig.tribe + keys.join(",") + replacement.key;
      if (!registrations.has(registrationKey)) registrations.set(registrationKey, bodyRegistration(reference, rig));
      registration = registrations.get(registrationKey);
      replacement = target => target.drawImage(reference, 0, registration.dy);
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
    for (const key of ["carapace", "guard", "blade", "piercing"].filter(key => keys.includes(key))) {
      const source = variants.get(key);
      if (rig.tribe === "sprout") {
        for (const part of source.rig.parts.filter(part => part.id.startsWith("foliage-"))) {
          if (key === "blade" && keys.includes("guard") && part.id.endsWith("right")) continue;
          attachments.push({ source, id: part.id, feature: false, rear: false, mirror: false });
        }
      } else if (rig.tribe === "spore") attachments.push({ source, id: "cap-left", feature: (key !== base.rig.variant || replacement) && Boolean(source.feature), rear: Boolean((key !== base.rig.variant || replacement) && source.definition.feature?.rear), mirror: false });
      else if (key !== base.rig.variant || replacement) attachments.push({ source, id: "body", feature: true,
        rear: source.definition.feature.rear || Boolean(replacement && rig.tribe === "spring"), mirror: rig.tribe === "spring" && key === "blade" && keys.includes("piercing") });
    }
    for (const rear of [true, false]) {
      if (!rear) {
        context.save(); context.translate(256, 448); context.scale(2, 2); context.translate(-128, -230);
        if (!replacement) renderEvolutionFrame(context, rig, images, sampled.action, sampled.sampleTime); context.restore();
        if (replacement) {
          context.save(); sharedTransform(context, rig, sampled); context.translate(...rig.root);
          context.scale(1 / (2 * rig.scale), 1 / (2 * rig.scale)); context.translate(-256, -448);
          replacement(context, sampled); context.restore();
        }
      }
      context.save(); sharedTransform(context, rig, sampled); if (registration) context.translate(...registration.offset);
      for (const item of attachments.filter(item => item.rear === rear)) attachment(context, base, item.source, item.id, sampled, item.feature, item.mirror);
      context.restore();
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
    return rig;
  }
  function drawSproutAttributes(surface, rig, sampled, agent, drawAttributes) {
    const sprite = createSurface(512, 512), context = sprite.getContext("2d");
    context.drawImage(surface, 0, 0);
    context.save(); sharedTransform(context, rig, sampled); context.translate(...rig.root);
    context.scale(1 / (2 * rig.scale), 1 / (2 * rig.scale)); context.translate(-256, -448);
    drawAttributes(context, sampled); context.restore();
    const attributes = agent.appearanceAttributes || agent.attributes || {};
    if (attributes.excavation) {
      context.save(); sharedTransform(context, rig, sampled);
      excavation.draw(context, agent.tribe || "bean", { left: rig.eyes[0], right: rig.eyes[1], bottom: rig.root });
      context.restore();
    }
    return sprite;
  }
  function frame(agent, time, drawAttributes, drawBody) {
    const variants = prepared.get(agent.tribe || "bean"), attributes = agent.appearanceAttributes || agent.attributes || {}, keys = combatEvolutionKeys(attributes);
    if (!variants || !keys.length) return null;
    const source = variants.get(keys.length === 1 ? keys[0] : body(keys));
    const animations = source.definition.animations;
    const sampled = combatEvolutionPose(agent, time, animations);
    let replacement = drawBody && (attributes.construction || source.rig.tribe !== "sprout" && ["antenna", "strength", "arms", "butchery", "lifespan", "feet", "excavation"].some(key => attributes[key] > 0)) ? drawBody : null;
    if (replacement) { const paint = replacement; replacement = (context, pose) => paint(context, pose); replacement.key = JSON.stringify(attributes) + ":" + (agent.construction?.buildingKey || "") + ":" + (agent.construction?.level || ""); }
    const liveFeet = source.rig.tribe === "sprout" && attributes.feet > 0;
    const dynamic = liveFeet && drawAttributes && !replacement;
    const key = [agent.tribe || "bean", JSON.stringify(attributes), sampled.action, sampled.frame, Boolean(drawAttributes),
      replacement ? liveFeet ? agent.id + ":" + time : Math.floor(time * 25) : ""].join("|");
    const cached = frames.get(key);
    if (cached) return dynamic ? drawSproutAttributes(cached.sprite, cached.rig, sampled, agent, drawAttributes) : cached.sprite;
    const surface = createSurface(512, 512), large = createSurface(1024, 1024), context = large.getContext("2d"); context.scale(2, 2);
    if (sampled.action === "birth" && sampled.sampleTime < sampled.animation.durationMs * .035) return surface;
    let rig = source.rig;
    if (keys.length === 1 && !replacement) {
      const image = source.sheets.get(sampled.action);
      context.save(); context.translate(256, 448); context.scale(2, 2); context.translate(-128, -230);
      if (image) context.drawImage(image, sampled.frame % 8 * 256, Math.floor(sampled.frame / 8) * 256, 256, 256, 0, 0, 256, 256);
      else {
        sheet(source, sampled.action).catch(() => {});
        renderEvolutionFrame(context, source.rig, source.images, sampled.action, sampled.sampleTime);
      }
      context.restore();
    } else rig = drawComposite(context, variants, keys, sampled, replacement);
    if (drawAttributes && !replacement && !dynamic) {
      context.save(); sharedTransform(context, rig, sampled); context.translate(...rig.root);
      context.scale(1 / (2 * rig.scale), 1 / (2 * rig.scale)); context.translate(-256, -448);
      drawAttributes(context, sampled); context.restore();
    }
    if (attributes.excavation && !replacement && !dynamic) {
      context.save(); sharedTransform(context, rig, sampled);
      excavation.draw(context, agent.tribe || "bean", { left: rig.eyes[0], right: rig.eyes[1], bottom: rig.root });
      context.restore();
    }
    const target = surface.getContext("2d"); target.imageSmoothingEnabled = true; target.imageSmoothingQuality = "high"; target.drawImage(large, 0, 0, 512, 512);
    frames.set(key, { sprite: surface, rig }); if (frames.size > 96) frames.delete(frames.keys().next().value);
    return dynamic ? drawSproutAttributes(surface, rig, sampled, agent, drawAttributes) : surface;
  }
  function portrait(agent, drawAttributes) {
    const attributes = agent.appearanceAttributes || agent.attributes || {}, key = (agent.tribe || "bean") + JSON.stringify(attributes);
    if (!portraits.has(key)) {
      const result = frame({ ...agent, health: 1, birth: null, diedAt: null, attack: null, support: null, hurtStartedAt: -Infinity, moveDuration: 0, animationStartedAt: 0 }, 0, drawAttributes);
      if (result) portraits.set(key, result); else return null;
    }
    return portraits.get(key);
  }
  function bodySize(agent, replacement) {
    const attributes = agent.appearanceAttributes || agent.attributes || {}, keys = combatEvolutionKeys(attributes);
    const variants = prepared.get(agent.tribe || "bean");
    if (!variants || !keys.length) return null;
    const source = variants.get(keys.length === 1 ? keys[0] : body(keys));
    if (attributes.construction || source.rig.tribe !== "sprout" &&
        ["antenna", "strength", "arms", "butchery", "lifespan", "feet", "excavation"].some(key => attributes[key] > 0)) return replacement;
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

  return { prepare, ready, frame, portrait, bodySize };
}

