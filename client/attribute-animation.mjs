import { createTribeMorphology, TRIBE_MORPHOLOGY_ASSETS } from "./attribute-morphology.mjs";
import { UNIT_ANIMATIONS } from "./unit-animation.mjs";

export const TRIBE_ATTRIBUTE_ASSETS = Object.freeze(["spore", "pebble", "spring"].flatMap(tribe => {
  const root = "DesignAssets/Tribes/" + tribe + "/Animations/Attributes/v1/";
  return [root + "rig.json", ...["antenna", "strength", "feet"].flatMap(attribute =>
    ["strength", "feet"].includes(attribute) || attribute === "antenna" && tribe !== "spring" ?
      [root + "Parts/" + attribute + "-left.png", root + "Parts/" + attribute + "-right.png"] :
      [root + "Parts/" + attribute + ".png"])];
}).concat(TRIBE_MORPHOLOGY_ASSETS));

const attachments = {
  spore: {
    antenna: { anchor: "cap", root: [.28, .81], pivot: [.5, .2], width: 16, inset: true, rear: false, flex: 0 },
    strength: { anchor: "body", root: [.16, .74], pivot: [.55, .2], width: 12, rear: false, flex: .35 },
    feet: { anchor: "body", root: [.25, 1], pivot: [.5, .3], width: 15, rear: true, flex: .25 }
  },
  pebble: {
    antenna: { anchor: "body", root: [.23, .19], pivot: [.5, .5], width: 15, inset: true, rear: false, flex: 0 },
    strength: { anchor: "body", root: [.13, .73], pivot: [.58, .25], width: 17, rear: false, flex: 0 },
    feet: { anchor: "body", root: [.24, 1], pivot: [.5, .3], width: 20, rear: true, flex: 0 }
  },
  spring: {
    antenna: { anchor: "tip", root: [0, 0], pivot: [.5, .5], width: 11, inset: true, rear: false, flex: 0 },
    strength: { anchor: "body", root: [.13, .8], pivot: [.58, .25], width: 15, rear: false, flex: .65 },
    feet: { anchor: "body", root: [.26, 1], pivot: [.5, .3], width: 23, rear: true, flex: .45 }
  }
};

export function hasTribeAttributes(attributes) {
  return ["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0);
}

function triangle(context, image, source, target) {
  const [a, b, c] = source, [p, q, r] = target;
  const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(det) < .00001) return;
  const xx = ((q[0] - p[0]) * (c[1] - a[1]) - (r[0] - p[0]) * (b[1] - a[1])) / det;
  const xy = ((r[0] - p[0]) * (b[0] - a[0]) - (q[0] - p[0]) * (c[0] - a[0])) / det;
  const yx = ((q[1] - p[1]) * (c[1] - a[1]) - (r[1] - p[1]) * (b[1] - a[1])) / det;
  const yy = ((r[1] - p[1]) * (b[0] - a[0]) - (q[1] - p[1]) * (c[0] - a[0])) / det;
  const center = [(p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3];
  context.save();
  context.beginPath();
  for (const [i, v] of target.entries()) {
    const dx = v[0] - center[0], dy = v[1] - center[1], length = Math.hypot(dx, dy) || 1;
    const x = v[0] + dx / length * .18, y = v[1] + dy / length * .18;
    if (i) context.lineTo(x, y); else context.moveTo(x, y);
  }
  context.closePath(); context.clip();
  context.transform(xx, yx, xy, yy, p[0] - xx * a[0] - xy * a[1], p[1] - yx * a[0] - yy * a[1]);
  context.drawImage(image, 0, 0);
  context.restore();
}

function attachmentMesh(part, spec) {
  const pivot = [spec.pivot[0] * part.width, spec.pivot[1] * part.height];
  const tip = [part.width - pivot[0], part.height - pivot[1]];
  const length = Math.hypot(tip[0] - pivot[0], tip[1] - pivot[1]) || 1;
  const axis = [(tip[0] - pivot[0]) / length, (tip[1] - pivot[1]) / length];
  const joint = [pivot[0] + axis[0] * length * .48, pivot[1] + axis[1] * length * .48];
  const vertices = [];
  for (let y = 0; y <= 4; y++) for (let x = 0; x <= 4; x++) {
    const u = part.width * x / 4, v = part.height * y / 4;
    const distance = ((u - pivot[0]) * axis[0] + (v - pivot[1]) * axis[1]) / length;
    const weight = Math.max(0, Math.min(1, (distance - .2) / .65));
    vertices.push({ uv: [u, v], weight });
  }
  const triangles = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const i = y * 5 + x;
    triangles.push([i, i + 1, i + 6], [i, i + 6, i + 5]);
  }
  return { pivot, joint, vertices, triangles };
}

function drawAttachment(context, part, spec, x, y, scale, rotation, bend, flatten) {
  const mesh = part.mesh;
  context.save(); context.translate(x, y); context.rotate(rotation); context.scale(scale, scale * flatten);
  context.translate(-mesh.pivot[0], -mesh.pivot[1]);
  if (!spec.flex || Math.abs(bend) < .001) context.drawImage(part.sprite, 0, 0);
  else {
    const cosine = Math.cos(bend), sine = Math.sin(bend);
    const points = mesh.vertices.map(vertex => {
      const [x, y] = vertex.uv, dx = x - mesh.joint[0], dy = y - mesh.joint[1], weight = vertex.weight;
      return [x + weight * (dx * cosine - dy * sine - dx), y + weight * (dx * sine + dy * cosine - dy)];
    });
    for (const indices of mesh.triangles) triangle(context, part.sprite,
      indices.map(i => mesh.vertices[i].uv), indices.map(i => points[i]));
  }
  context.restore();
}

export function createTribeAttributeAnimation(assetSource, createSurface, loadImage) {
  const rigs = new Map(), pending = new Map(), frames = new Map(), motions = new Map();
  const morphology = createTribeMorphology(createSurface, loadImage);

  function neutralDistance(tribe, track, reference) {
    const box = tribe === "spore" ? track.cap : track.body;
    const base = tribe === "spore" ? reference.cap : reference.body;
    const angle = tribe === "spore" ? track.capAxis?.[4] || 0 : track.angle;
    const referenceAngle = tribe === "spore" ? reference.capAxis?.[4] || 0 : reference.angle;
    return Math.abs(box[1] - track.floor - base[1] + reference.floor) +
      Math.abs(box[3] - base[3]) * .5 + Math.abs(box[2] - base[2]) * .2 + Math.abs(angle - referenceAngle) * 40;
  }

  function pose(agent, current, time) {
    const rig = rigs.get(agent.tribe), attributes = agent.appearanceAttributes || agent.attributes || {};
    if (!rig || !hasTribeAttributes(attributes) || !current) return current;
    const action = ["harvest", "throw"].includes(current.action) ? "idle" : current.action;
    let motion = motions.get(agent.id);
    if (!motion || time < motion.seenAt || time - motion.seenAt > .4) {
      const elapsed = rig.animations.idle.durationsMs.slice(0, current.action === "idle" ? current.frame : 0).reduce((sum, value) => sum + value, 0) / 1000;
      motion = { action, seenAt: time, changedAt: time, idleEpoch: time - elapsed, bridge: null, sourceAction: action, sourceFrame: current.frame };
      motions.set(agent.id, motion);
      if (motions.size > 512) motions.delete(motions.keys().next().value);
    }
    if (motion.action !== action) {
      if (action === "idle") motion.idleEpoch = time;
      const previous = rig.animations[motion.sourceAction], track = previous?.tracks[motion.sourceFrame];
      const reference = previous?.tracks.find(value => value);
      if (track && reference && neutralDistance(agent.tribe, track, reference) > 3) {
        let target = motion.sourceFrame, distance = Infinity;
        for (let index = 0; index < previous.tracks.length; index++) {
          const candidate = previous.tracks[index];
          if (!candidate || neutralDistance(agent.tribe, candidate, reference) > 2) continue;
          const steps = Math.abs(index - motion.sourceFrame);
          if (steps < distance) { distance = steps; target = index; }
        }
        if (Number.isFinite(distance) && distance > 0) motion.bridge = {
          action: motion.sourceAction, from: motion.sourceFrame, to: target, startedAt: time,
          duration: current.action === "hurt" ? .09 : Math.min(.2, Math.max(.08, distance * .012))
        };
      }
      motion.action = action; motion.changedAt = time;
    }
    let sourceAction = action, sourceFrame = current.frame;
    if (action === "idle") {
      const animation = rig.animations.idle;
      let elapsed = Math.max(0, time - motion.idleEpoch) * 1000 % animation.durationMs;
      sourceFrame = 0;
      while (sourceFrame < animation.frameCount - 1 && elapsed >= animation.durationsMs[sourceFrame]) elapsed -= animation.durationsMs[sourceFrame++];
    }
    if (motion.bridge) {
      const bridge = motion.bridge, progress = Math.max(0, Math.min(1, (time - bridge.startedAt) / bridge.duration));
      if (progress < 1) {
        sourceAction = bridge.action;
        sourceFrame = Math.round(bridge.from + (bridge.to - bridge.from) * progress);
      } else { motion.bridge = null; if (action === "idle") motion.idleEpoch = time; }
    }
    motion.seenAt = time; motion.sourceAction = sourceAction; motion.sourceFrame = sourceFrame;
    return { ...current, sourceAction, sourceFrame, sourceAnimation: rig.animations[sourceAction], sampleTime: time,
      motionPhase: current.frame / current.animation.frameCount,
      motionBlend: action === "walk" ? Math.max(0, Math.min(1, (time - motion.changedAt) / .12)) : 1 };
  }

  function prepare(tribe) {
    if (!attachments[tribe]) return Promise.resolve(null);
    if (!pending.has(tribe)) pending.set(tribe, (async () => {
      const path = "DesignAssets/Tribes/" + tribe + "/Animations/Attributes/v1/rig.json";
      const response = await fetch(assetSource(path));
      if (!response.ok) throw new Error("종족 파츠를 불러오지 못했습니다.");
      const rig = await response.json();
      rig.animations = Object.fromEntries(Object.entries(rig.animations).map(([action, animation]) =>
        [action, { ...animation, ...UNIT_ANIMATIONS[tribe]?.[action] }]));
      rig.parts = Object.fromEntries(Object.entries(rig.parts).filter(([attribute]) => Object.hasOwn(attachments[tribe], attribute)));
      await Promise.all(Object.entries(rig.parts).flatMap(([attribute, parts]) => parts.map(async part => {
        part.sprite = await loadImage(part.image);
        const source = attachments[tribe][attribute];
        const pivot = part.side > 0 ? [1 - source.pivot[0], source.pivot[1]] : source.pivot;
        part.spec = { ...source, pivot };
        part.mesh = attachmentMesh(part, part.spec);
        const surface = createSurface(part.width, part.height), context = surface.getContext("2d", { willReadFrequently: true });
        context.drawImage(part.sprite, 0, 0);
        const pixels = context.getImageData(0, 0, part.width, part.height).data;
        part.sole = [];
        for (let x = 0; x < part.width; x++) for (let y = part.height - 1; y >= 0; y--) {
          if (pixels[(y * part.width + x) * 4 + 3] < 128) continue;
          part.sole.push([x, y + 1]); break;
        }
      })));
      rig.idle = await loadImage(rig.animations.idle.image);
      await morphology.prepare(rig);
      rig.bodyFrames = new Map();
      rigs.set(tribe, rig);
      return rig;
    })().catch(error => { pending.delete(tribe); throw error; }));
    return pending.get(tribe);
  }

  function frame(tribe, attributes, source, animation, index, action, time, motion, replacement) {
    const rig = rigs.get(tribe);
    if (!rig || !hasTribeAttributes(attributes) && !replacement) return null;
    const bodyAction = motion?.sourceAction || action;
    const trackAction = bodyAction === "carry" ? "walk" : rig.animations[bodyAction] ? bodyAction : "idle";
    const sequence = rig.animations[trackAction];
    const track = replacement?.track || sequence.tracks[Math.min(index, sequence.tracks.length - 1)];
    if (!track) return null;
    if (rig.morphs && !replacement) return morphology.frame(rig, attributes, source, animation, index, action, time, motion);
    const birthAge = action === "birth" ? sequence.durationsMs.slice(0, index).reduce((sum, value) => sum + value, 0) / 1000 : 0;
    const growth = action !== "birth" || tribe === "pebble" ? 1 :
      Math.max(0, Math.min(1, (birthAge - sequence.detachAt) / Math.max(.1, sequence.contactAt - sequence.detachAt)));
    if (!growth) return null;
    const absorption = Math.max(0, Math.min(1, replacement?.absorption || 0));
    const keys = [attributes.antenna || 0, attributes.strength || attributes.arms || 0, attributes.feet || 0,
      replacement?.key ?? -1, Math.round(absorption * 24)];
    const clock = Number.isFinite(motion?.sampleTime) ? motion.sampleTime : time;
    const phaseProgress = Number.isFinite(motion?.motionPhase) ? motion.motionPhase : index / sequence.tracks.length;
    const stride = Number.isFinite(motion?.motionBlend) ? motion.motionBlend : 1;
    const tick = Math.floor(time * 20), key = [tribe, action, trackAction, index, tick,
      Math.floor(clock * 20), Math.round(phaseProgress * 120), Math.round(stride * 20), ...keys].join(":");
    if (frames.has(key)) return frames.get(key);
    const size = animation.frameSize, padding = Math.ceil(size / 6);
    const surface = createSurface(size + padding * 2, size + padding * 2), context = surface.getContext("2d");
    context.translate(padding, padding); context.scale(size / 144, size / 144);
    context.imageSmoothingEnabled = true;
    const neutral = replacement ? track : action === "birth" && tribe !== "pebble" ? track : rig.animations[trackAction].tracks.find(value => value) || track;
    const reference = replacement?.reference || rig.reference;
    const factor = (tribe === "spore" ? neutral.cap[2] / reference.cap[2] : neutral.body[2] / reference.body[2]);
    const poseTime = Math.floor(clock * 20) / 20;
    const walk = action === "walk" || action === "carry";
    const cycle = walk ? Math.PI * 2 * phaseProgress * (tribe === "pebble" ? 2 : 1) : poseTime * Math.PI * 4 / 6.4;
    const harvest = action === "harvest" ? Math.sin(time * Math.PI * 2 / .42) : 0;
    const impact = action === "throw" ? Math.sin(Math.min(1, Math.max(0, time) / .45) * Math.PI) :
      ["attack", "hurt"].includes(action) ? Math.sin(Math.min(1, phaseProgress) * Math.PI) : 0;
    const death = action === "death" ? Math.min(1, index / Math.max(1, sequence.tracks.length - 1)) : 0;
    const foot = rig.parts.feet[0], footSpec = foot.spec;
    const footLevel = 1 + Math.min(3, Math.max(0, (attributes.feet || 1) - 1)) * .035;
    const footHeight = foot.height / foot.width * footSpec.width * factor * growth * footLevel;
    const lift = attributes.feet ? (replacement ? footHeight * .6 : Math.max(0,
      footHeight * (1 - footSpec.pivot[1]) - (track.floor - track.cut) - factor * 2.5)) * (1 - death) * (1 - absorption) : 0;
    const drawn = [];
    const bodyFrame = null;
    let capAxis = bodyFrame?.capAxis || track.capAxis;
    for (const [attribute, parts] of Object.entries(rig.parts)) {
      const level = attributes[attribute] || (attribute === "strength" ? attributes.arms : 0);
      if (!level) continue;
      for (const part of parts) {
        const spec = part.spec, side = part.side;
        let scale = spec.width * factor / part.width * growth * (1 + Math.min(3, Math.max(0, level - 1)) * .035);
        let flatten = tribe === "spring" ? 1 - death * .72 : 1;
        if (spec.replaces === "cap" && capAxis) { scale = capAxis[2] / part.width; flatten = capAxis[3] / (part.height * scale); }
        const anchor = spec.anchor === "cap" ? track.cap : track.body;
        let x = anchor[0] + anchor[2] * (side > 0 ? 1 - spec.root[0] : spec.root[0]);
        let y = anchor[1] + anchor[3] * spec.root[1] - lift;
        const surface = track.bodySurfaces?.[attribute];
        if (surface && spec.anchor === "body") {
          x = surface[0] + surface[2] * (side > 0 ? 1 - spec.root[0] : spec.root[0]);
          y = surface[1] - lift;
        }
        if (spec.anchor === "cap" && capAxis) {
          const axis = capAxis, dx = axis[2] * ((side > 0 ? 1 - spec.root[0] : spec.root[0]) - .5), dy = axis[3] * (spec.root[1] - .5);
          x = axis[0] + dx * Math.cos(axis[4]) - dy * Math.sin(axis[4]);
          y = axis[1] + dx * Math.sin(axis[4]) + dy * Math.cos(axis[4]) - lift;
        }
        if (spec.anchor === "tip") { x = track.tip[0] - factor * 2; y = track.tip[1] + factor * 10 - lift; }
        let rotation = (spec.anchor === "cap" ? track.capAxis?.[4] || 0 : track.angle) + (spec.angle || 0), bend = 0;
        const phase = cycle + (side > 0 ? Math.PI : 0);
        const sway = Math.sin(phase - .35);
        if (attribute === "strength") { rotation += (sway * (walk ? .035 : 0) + harvest * .12 - impact * .16) * (side || 1); bend = (harvest * .12 + sway * .025) * spec.flex * (side || 1); }
        if (attribute === "feet") {
          const raised = walk ? Math.max(0, Math.sin(phase)) * stride : 0;
          x += walk ? Math.sin(phase) * factor * 3.5 * stride : 0;
          y = track.floor - footHeight * (1 - spec.pivot[1]) - raised * factor * 5;
          rotation = walk ? Math.sin(phase) * (tribe === "pebble" ? .12 : .2) * stride : 0;
          bend = raised * .1 * spec.flex * (side || 1);
          const contact = Math.max(...part.sole.map(([u, v]) =>
            ((u - part.mesh.pivot[0]) * Math.sin(rotation) + (v - part.mesh.pivot[1]) * Math.cos(rotation)) * scale));
          y = (walk ? neutral.floor : track.floor) - contact - raised * factor * 5;
        }
        if (absorption) {
          const centerX = x + (.5 - spec.pivot[0]) * part.width * scale;
          const centerY = y + (.5 - spec.pivot[1]) * part.height * scale * flatten;
          const destination = spec.replaces === "cap" ? track.cap : track.body;
          if (spec.replaces === "cap") scale *= 1 - absorption * .8;
          x = centerX + (destination[0] + destination[2] * .5 - centerX) * absorption - (.5 - spec.pivot[0]) * part.width * scale;
          y = centerY + (destination[1] + destination[3] * (spec.replaces === "cap" ? .5 : .4) - centerY) * absorption - (.5 - spec.pivot[1]) * part.height * scale * flatten;
        }
        if (death && tribe !== "spring" && !spec.inset && !spec.replaces) { rotation += death * .4 * (side || 1); y += death * factor * 2; }
        if (death && tribe === "spring") {
          rotation *= 1 - death; bend *= 1 - death;
          if (attribute === "feet") {
            const contact = Math.max(...part.sole.map(([u, v]) =>
              ((u - part.mesh.pivot[0]) * Math.sin(rotation) + (v - part.mesh.pivot[1]) * flatten * Math.cos(rotation)) * scale));
            y = track.floor - contact;
          }
        }
        const rear = spec.rear || absorption > 0 && !spec.inset && !spec.replaces || tribe === "pebble" && trackAction === "attack" && index >= 3 && index <= 11 && side < 0;
        drawn.push({ attribute, part, spec, x, y, scale, rotation, bend, flatten, rear });
      }
    }
    const draw = (target, item) => {
      target.save();
      if (item.spec.inset) target.globalAlpha *= 1 - absorption;
      drawAttachment(target, item.part, item.spec, item.x, item.y, item.scale, item.rotation, item.bend, item.flatten);
      target.restore();
    };
    const drawBody = target => {
      target.save();
      if (attributes.feet && !replacement && !(tribe === "spring" && action === "death")) { target.beginPath(); target.rect(-24, -24, 192, track.cut - lift + 24); target.clip(); }
      if (replacement && !capReplacement) target.drawImage(replacement.sprite, 0, -lift, 144, 144);
      else if (bodyFrame) target.drawImage(bodyFrame.sprite, 0, 0, size, size, 0, -lift, 144, 144);
      else target.drawImage(source, index % animation.columns * size, Math.floor(index / animation.columns) * size,
        size, size, 0, -lift, 144, 144);
      target.restore();
    };
    let creature = null;
    if (capReplacement) {
      creature = createSurface(surface.width, surface.height);
      const target = creature.getContext("2d"); target.setTransform(context.getTransform());
      if (absorption) target.drawImage(replacement.sprite, 0, -lift, 144, 144);
      for (const item of drawn) if (item.spec.replaces) draw(target, item);
      drawBody(target);
      if (absorption) {
        target.save(); target.beginPath();
        target.rect(track.cap[0] - 2, track.cap[1] + track.cap[3] * (1 - absorption) - lift,
          track.cap[2] + 4, track.cap[3] * absorption + 2); target.clip();
        target.drawImage(replacement.sprite, 0, -lift, 144, 144); target.restore();
      }
    }
    const drawCreature = target => {
      if (!creature) { drawBody(target); return; }
      target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.drawImage(creature, 0, 0); target.restore();
    };
    for (const item of drawn) if (item.rear && !item.spec.inset && !item.spec.replaces) draw(context, item);
    drawCreature(context);
    const insets = drawn.filter(item => item.spec.inset).sort((a, b) => Number(a.attribute === "antenna") - Number(b.attribute === "antenna"));
    if (insets.length) {
      const layer = createSurface(surface.width, surface.height), layerContext = layer.getContext("2d");
      layerContext.setTransform(context.getTransform());
      for (const item of insets) draw(layerContext, item);
      layerContext.globalCompositeOperation = "destination-in";
      drawCreature(layerContext);
      context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.drawImage(layer, 0, 0); context.restore();
    }
    for (const item of drawn) if (!item.rear && !item.spec.inset && !item.spec.replaces) draw(context, item);
    frames.set(key, surface);
    if (frames.size > 192) frames.delete(frames.keys().next().value);
    return surface;
  }

  function portrait(tribe, attributes, width, height, box, layer) {
    const rig = rigs.get(tribe);
    if (!rig) return null;
    const surface = createSurface(width, height), context = surface.getContext("2d");
    if (layer && !["full", "body"].includes(layer)) return surface;
    const animation = rig.animations.idle;
    const sprite = frame(tribe, attributes, rig.idle, animation, 0, "idle", 0);
    if (!sprite) return null;
    const track = animation.tracks[0], padding = (sprite.width - animation.frameSize) / 2;
    const scale = Math.min(box.width / track.bounds[2], box.height / track.bounds[3]) * 144 / animation.frameSize;
    context.drawImage(sprite, width / 2 - (animation.pivotX + padding) * scale,
      box.y + box.height - (animation.pivotY + padding) * scale, sprite.width * scale, sprite.height * scale);
    return surface;
  }

  function bodySize(tribe, appearance, box) {
    const rig = rigs.get(tribe);
    if (!rig) return null;
    const track = rig.animations.idle.tracks[0];
    const keys = tribe === "spore" ? ["strength"] : ["antenna", "strength"];
    const key = keys.filter(key => (key === "strength" ? appearance.strength || appearance.arms : appearance[key]) > 0).join("-");
    const part = rig.morphs?.parts["body-" + key];
    const width = part ? part.size[0] * track.body[2] / rig.reference.body[2] : track.body[2];
    const height = part ? part.size[1] * track.body[3] / rig.reference.body[3] : track.body[3];
    const scale = box ? Math.min(box.width / track.bounds[2], box.height / track.bounds[3]) : 1;
    return { width: width * scale, height: height * scale };
  }

  return { prepare, frame, portrait, pose, bodySize };
}
