const root = tribe => "DesignAssets/Tribes/" + tribe + "/Animations/Attributes/v2/Parts/";
const coreKeys = ["antenna", "strength"];
const coreNames = Array.from({ length: 4 }, (_, mask) => "body-" + (coreKeys.filter((key, index) => mask & 1 << index).join("-") || "base"));

const names = {
  spore: ["cap-antenna", "body-strength", "feet-left", "feet-right"],
  pebble: [...coreNames, "feet-left", "feet-right"],
  spring: [...coreNames, "feet-left", "feet-right"]
};

export const TRIBE_MORPHOLOGY_ASSETS = Object.freeze(Object.entries(names).flatMap(([tribe, parts]) => parts.map(name => root(tribe) + name + ".png")));

const models = {
  spore: {
    upper: "cap", upperWidths: { antenna: 94 },
    bodies: { strength: [44, 28] },
    foot: [19, 8], faceY: .56
  },
  pebble: {
    core: true, foot: [26, 9], faceY: .65
  },
  spring: {
    core: true, foot: [24, 8], faceY: .70
  }
};

export const TRIBE_MORPHOLOGY_MODELS = models;

export function morphologyPartSize(tribe, name, width, height) {
  const model = models[tribe];
  if (name.startsWith("feet-")) return model.foot;
  if (tribe === "spore") {
    if (name.startsWith("cap-")) { const w = model.upperWidths[name.slice(4)]; return [w, w * height / width]; }
    return model.bodies[name.slice(5)];
  }
  const sense = name.includes("antenna"), strength = name.includes("strength");
  const w = tribe === "pebble" ? 82 + sense * 6 + strength * 18 : 61 + sense * 4 + strength * 10;
  const h = Math.max(tribe === "pebble" ? 52 : 70, Math.min(tribe === "pebble" ? 78 : 104, w * height / width));
  return [w, h];
}

function triangle(context, image, source, target) {
  const [a, b, c] = source, [p, q, r] = target;
  const determinant = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(determinant) < .00001) return;
  const m11 = ((q[0] - p[0]) * (c[1] - a[1]) - (r[0] - p[0]) * (b[1] - a[1])) / determinant;
  const m12 = ((q[1] - p[1]) * (c[1] - a[1]) - (r[1] - p[1]) * (b[1] - a[1])) / determinant;
  const m21 = ((r[0] - p[0]) * (b[0] - a[0]) - (q[0] - p[0]) * (c[0] - a[0])) / determinant;
  const m22 = ((r[1] - p[1]) * (b[0] - a[0]) - (q[1] - p[1]) * (c[0] - a[0])) / determinant;
  context.save(); context.beginPath();
  for (const [index, point] of target.entries()) {
    const [x, y] = point;
    if (index) context.lineTo(x, y); else context.moveTo(x, y);
  }
  context.closePath(); context.clip();
  context.transform(m11, m12, m21, m22, p[0] - m11 * a[0] - m21 * a[1], p[1] - m12 * a[0] - m22 * a[1]);
  context.drawImage(image, 0, 0); context.restore();
}

function drawMesh(context, part, points, uv, columns, rows, createSurface) {
  const surface = createSurface(context.canvas.width, context.canvas.height), target = surface.getContext("2d");
  target.setTransform(context.getTransform()); target.globalCompositeOperation = "lighter";
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const i = row * (columns + 1) + col;
    for (const indices of [[i, i + 1, i + columns + 2], [i, i + columns + 2, i + columns + 1]])
      triangle(target, part.sprite, indices.map(i => uv[i]), indices.map(i => points[i]));
  }
  context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.drawImage(surface, 0, 0); context.restore();
}

function drawPart(context, part, box, bend, createSurface) {
  const [x, y, width, height] = box;
  if (Math.abs(bend) < .0001) { context.drawImage(part.sprite, x, y, width, height); return; }
  const points = [], uv = [];
  for (let row = 0; row <= 4; row++) for (let col = 0; col <= 4; col++) {
    const u = col / 4, v = row / 4, weight = Math.max(0, v - .42) * Math.max(0, Math.abs(u - .5) - .12) * 5;
    points.push([x + u * width + Math.sign(u - .5) * weight * bend * width, y + v * height - weight * bend * height * .35]);
    uv.push([u * part.width, v * part.height]);
  }
  drawMesh(context, part, points, uv, 4, 4, createSurface);
}

function activeKey(attributes, keys) {
  return keys.filter(key => (key === "strength" ? attributes.strength || attributes.arms : attributes[key]) > 0).join("-");
}

function hull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const first = [], second = [];
  for (const p of sorted) { while (first.length > 1 && cross(first.at(-2), first.at(-1), p) <= 0) first.pop(); first.push(p); }
  for (const p of sorted.slice().reverse()) { while (second.length > 1 && cross(second.at(-2), second.at(-1), p) <= 0) second.pop(); second.push(p); }
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

function rotate(point, angle) {
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  return [point[0] * cosine - point[1] * sine, point[0] * sine + point[1] * cosine];
}

function outlineAt(part, u) {
  let nearest = part.outline[0], distance = Infinity;
  for (const point of part.outline) if (Math.abs(point[0] - u) < distance) { nearest = point; distance = Math.abs(point[0] - u); }
  return nearest?.[1] || 1;
}

export function createTribeMorphology(createSurface, loadImage, excavation) {
  const frames = new Map();

  async function prepare(rig) {
    if (!rig.morphs) return;
    rig.morphs.cache = new Map();
    await Promise.all(Object.entries(rig.morphs.parts).map(async ([name, part]) => {
      part.sprite = await loadImage(part.image);
      const surface = createSurface(part.width, part.height), context = surface.getContext("2d"); context.drawImage(part.sprite, 0, 0);
      const pixels = context.getImageData(0, 0, part.width, part.height).data;
      part.outline = [];
      for (let x = 0; x < part.width; x++) for (let y = part.height - 1; y >= 0; y--) {
        if (pixels[(y * part.width + x) * 4 + 3] < 80) continue;
        part.outline.push([x / part.width, (y + 1) / part.height]); break;
      }
      let neckLeft = part.width, neckRight = 0;
      for (let x = 0; x < part.width; x++) if (pixels[(Math.floor(part.height * .43) * part.width + x) * 4 + 3] >= 80) { neckLeft = Math.min(neckLeft, x); neckRight = x + 1; }
      part.neckX = part.neck?.[0] ?? (neckRight > neckLeft ? (neckLeft + neckRight) / 2 / part.width : .5);
    }));
  }

  function sourcePose(rig, source, animation, index, action, track) {
    const key = action + ":" + index + ":" + animation.frameSize;
    if (rig.morphs.cache.has(key)) return rig.morphs.cache.get(key);
    const size = animation.frameSize, k = size / 144, surface = createSurface(size, size), context = surface.getContext("2d");
    context.drawImage(source, index % animation.columns * size, Math.floor(index / animation.columns) * size, size, size, 0, 0, size, size);
    const image = context.getImageData(0, 0, size, size), pixels = image.data, body = track.body;
    const row = value => {
      const y = Math.max(0, Math.min(size - 1, Math.round(value * k))); let left = size, right = -1;
      for (let x = 0; x < size; x++) if (pixels[(y * size + x) * 4 + 3] >= 64) { left = Math.min(left, x); right = x; }
      return right < left ? [body[0] + body[2] / 2, value, 1] : [(left + right + 1) / 2 / k, y / k, (right - left + 1) / k];
    };
    const neck = row(body[1] + body[3] * .43), torso = row(body[1] + body[3] * .76), rootRow = row(Math.min(track.cut - .5, body[1] + body[3] * .96));
    const mask = new Uint8Array(size * size), model = models[rig.tribe];
    for (let y = Math.max(0, Math.floor((body[1] + body[3] * (rig.tribe === "spore" ? .23 : .36)) * k)); y < Math.min(size, (body[1] + body[3] * .9) * k); y++) {
      for (let x = Math.max(0, Math.floor((body[0] + body[2] * .08) * k)); x < Math.min(size, (body[0] + body[2] * .92) * k); x++) {
        const p = (y * size + x) * 4, r = pixels[p], g = pixels[p + 1], b = pixels[p + 2];
        if (pixels[p + 3] >= 64 && Math.max(r, g, b) < 112 && !(r - g > 20 && r > b * .98)) mask[y * size + x] = 1;
      }
    }
    const groups = [];
    for (let p = 0; p < mask.length; p++) if (mask[p]) {
      const queue = [p]; mask[p] = 0;
      for (let i = 0; i < queue.length; i++) {
        const at = queue[i], x = at % size, y = Math.floor(at / size);
        for (const next of [x ? at - 1 : -1, x + 1 < size ? at + 1 : -1, y ? at - size : -1, y + 1 < size ? at + size : -1]) {
          if (next < 0 || !mask[next]) continue; mask[next] = 0; queue.push(next);
        }
      }
      if (queue.length > body[2] * body[3] * k * k * .12) continue;
      const points = queue.map(at => [at % size, Math.floor(at / size)]);
      groups.push({ points, x: points.reduce((sum, p) => sum + p[0], 0) / points.length / k,
        y: points.reduce((sum, p) => sum + p[1], 0) / points.length / k });
    }
    const eyes = [], used = new Set();
    for (const u of [.29, .71]) {
      const target = [body[0] + body[2] * u, body[1] + body[3] * model.faceY]; let best = null, distance = .38;
      for (const group of groups) {
        if (used.has(group)) continue;
        const d = Math.hypot((group.x - target[0]) / body[2], (group.y - target[1]) / body[3]);
        if (d < distance) { best = group; distance = d; }
      }
      if (!best) continue; used.add(best);
      const outline = hull(best.points), xs = best.points.map(p => p[0]), ys = best.points.map(p => p[1]);
      const left = Math.max(0, Math.min(...xs) - 2), top = Math.max(0, Math.min(...ys) - 2);
      const width = Math.min(size, Math.max(...xs) + 3) - left, height = Math.min(size, Math.max(...ys) + 3) - top;
      const eye = createSurface(width, height), targetContext = eye.getContext("2d"); targetContext.save(); targetContext.beginPath();
      if (outline.length < 3) targetContext.rect(1, 1, width - 2, height - 2);
      else for (const [i, point] of outline.entries()) {
        const dx = point[0] - best.x * k, dy = point[1] - best.y * k, length = Math.hypot(dx, dy) || 1;
        const x = point[0] - left + dx / length * 1.05, y = point[1] - top + dy / length * 1.05;
        if (i) targetContext.lineTo(x, y); else targetContext.moveTo(x, y);
      }
      targetContext.closePath(); targetContext.clip(); targetContext.drawImage(surface, -left, -top); targetContext.restore();
      eyes.push({ sprite: eye, side: u < .5 ? -1 : 1, box: [left / k, top / k, width / k, height / k] });
    }
    const front = createSurface(size, size), frontContext = front.getContext("2d"), frontImage = context.getImageData(0, 0, size, size);
    for (let p = 0; p < frontImage.data.length; p += 4) if (frontImage.data[p] - frontImage.data[p + 1] < 18 ||
      frontImage.data[p] < frontImage.data[p + 2] * .9) frontImage.data[p + 3] = 0;
    frontContext.putImageData(frontImage, 0, 0);
    const outline = [];
    for (let x = 0; x < size; x++) for (let y = Math.min(size - 1, Math.ceil(track.cut * k) - 1); y >= 0; y--) {
      if (pixels[(y * size + x) * 4 + 3] < 80) continue;
      outline.push([x / size, (y + 1) / size]); break;
    }
    const result = { tribe: rig.tribe, surface, front, eyes, outline, neck: neck.slice(0, 2), torso: torso.slice(0, 2), torsoWidth: torso[2], root: [rootRow[0], track.cut], tip: track.tip, bases: new Map() };
    rig.morphs.cache.set(key, result); if (rig.morphs.cache.size > 80) rig.morphs.cache.delete(rig.morphs.cache.keys().next().value);
    return result;
  }

  function sourceBase(pose, track, removeCap, removeBody, size, excavation) {
    const key = [removeCap, removeBody, Boolean(excavation)].join(":");
    if (pose.bases.has(key)) return pose.bases.get(key);
    const surface = createSurface(size, size), context = surface.getContext("2d"); context.drawImage(pose.surface, 0, 0);
    const image = context.getImageData(0, 0, size, size), pixels = image.data, k = size / 144, body = track.body, cap = track.cap;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const p = (y * size + x) * 4, coral = pose.tribe === "spore" && pixels[p] - pixels[p + 1] > 18 && pixels[p] > pixels[p + 2] * .9;
      const inCap = x >= (cap[0] - 2) * k && x <= (cap[0] + cap[2] + 2) * k && y >= (cap[1] - 2) * k && y <= (cap[1] + cap[3] + 2) * k;
      if (y >= track.cut * k && !coral || removeCap && inCap && (coral || y < body[1] * k || x < (body[0] - 1) * k || x > (body[0] + body[2] + 1) * k) ||
        removeBody && (!coral || excavation && y > (body[1] + body[3] * .14) * k) && x >= (body[0] - 2) * k && x <= (body[0] + body[2] + 2) * k && y >= (body[1] - 2) * k) pixels[p + 3] = 0;
    }
    context.putImageData(image, 0, 0); pose.bases.set(key, surface); return surface;
  }

  function frame(rig, attributes, source, animation, index, action, time, motion) {
    const model = models[rig.tribe], sourceAction = motion?.sourceAction || action;
    const trackAction = rig.animations[sourceAction] ? sourceAction : sourceAction === "carry" ? "walk" : "idle";
    const sequence = rig.animations[trackAction], track = sequence.tracks[Math.min(index, sequence.tracks.length - 1)];
    if (!track) return null;
    const partKey = activeKey(attributes, model.core ? coreKeys : ["strength"]);
    const upperKey = model.core ? "" : activeKey(attributes, ["antenna"]);
    const part = rig.morphs.parts["body-" + partKey], upper = rig.morphs.parts["cap-" + upperKey];
    const feet = attributes.feet > 0, clock = motion?.sampleTime ?? time, progress = motion?.motionPhase ?? index / sequence.frameCount;
    const stride = motion?.motionBlend ?? 1, key = [rig.tribe, trackAction, action, index, Math.floor(time * 20), Math.floor(clock * 20),
      Math.round(progress * 120), Math.round(stride * 20), ...[...coreKeys, "feet", "excavation"].map(k => k === "strength" ? attributes.strength || attributes.arms || 0 : attributes[k] || 0)].join(":");
    if (frames.has(key)) return frames.get(key);
    const size = animation.frameSize, padding = Math.ceil(size / 2), scale = size / 144;
    const surface = createSurface(size + padding * 2, size + padding * 2), core = createSurface(surface.width, surface.height), context = core.getContext("2d");
    context.translate(padding, padding); context.scale(scale, scale);
    const pose = sourcePose(rig, source, animation, index, trackAction, track);
    const neutralIndex = sequence.tracks.findIndex(value => value), neutralTrack = sequence.tracks[neutralIndex];
    const neutral = sourcePose(rig, source, animation, neutralIndex, trackAction, neutralTrack);
    const reference = rig.reference, body = track.body, center = [body[0] + body[2] / 2, body[1] + body[3] / 2];
    const restBody = trackAction === "walk" ? rig.animations.idle.tracks[0].body : neutralTrack.body;
    const factor = (action === "birth" ? body[2] : restBody[2]) / reference.body[2];
    const death = action === "death" ? index / Math.max(1, sequence.frameCount - 1) : 0;
    const phase = progress * Math.PI * 2 * (rig.tribe === "pebble" ? 2 : 1), walking = action === "walk" || action === "carry";
    const harvest = action === "harvest" ? Math.sin(time * Math.PI * 2 / .72) : 0;
    const footSize = feet ? model.foot : rig.tribe === "spore" ? [6, 3] : [10, 4];
    const footWidth = footSize[0] * factor, footHeight = footSize[1] * factor * (rig.tribe === "spring" ? 1 - death * .72 : 1);
    let maximum = -Infinity;
    const items = [], include = (part, box, point) => {
      for (const [u, v] of part.outline) maximum = Math.max(maximum, point([box[0] + u * box[2], box[1] + v * box[3]])[1]);
    };
    let eyeTransform = point => point;
    let bodyPoint, bodyWidth, bodyHeight, bodyAngle, bodyX;

    if (model.core && part) {
      bodyWidth = part.size[0] * factor; bodyHeight = part.size[1] * factor; bodyX = pose.root[0];
      if (rig.tribe === "pebble") {
        bodyAngle = track.angle + harvest * .045;
        bodyPoint = point => { const rotated = rotate(point, bodyAngle); return [bodyX + rotated[0], track.cut + rotated[1]]; };
        const box = [-bodyWidth / 2, -bodyHeight, bodyWidth, bodyHeight];
        items.push(() => { context.save(); context.translate(bodyX, track.cut); context.rotate(bodyAngle); drawPart(context, part, box, 0, createSurface); context.restore(); });
        include(part, box, bodyPoint);
        eyeTransform = point => {
          const local = rotate([point[0] - center[0], point[1] - center[1]], -track.angle);
          return bodyPoint([local[0], local[1] - reference.body[3] / 2 * factor]);
        };
      } else {
        const base = action === "birth" ? pose : neutral;
        const a = [pose.neck[0] - pose.root[0], pose.neck[1] - pose.root[1]], b = [base.neck[0] - base.root[0], base.neck[1] - base.root[1]];
        bodyAngle = action === "birth" ? track.angle : Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]);
        const sy = action === "birth" ? body[3] / reference.body[3] / Math.max(.01, factor) : Math.hypot(...a) / Math.max(1, Math.hypot(...b));
        const sx = action === "birth" ? 1 : pose.torsoWidth / Math.max(1, base.torsoWidth);
        const first = [pose.tip[0] - pose.neck[0], pose.tip[1] - pose.neck[1]], second = [base.tip[0] - base.neck[0], base.tip[1] - base.neck[1]];
        const angle = (Math.atan2(first[1], first[0]) - Math.atan2(second[1], second[0]) - bodyAngle) * (1 - death);
        const length = Math.max(.4, Math.min(2, Math.hypot(...first) / Math.max(1, Math.hypot(...second)) / Math.max(.05, sy)));
        const neck = [(part.neckX - .5) * bodyWidth, part.neck ? (part.neck[1] - 1) * bodyHeight : -.57 * bodyHeight];
        bodyPoint = point => {
          const v = point[1] / bodyHeight + 1, edge = part.neck ? part.neck[1] + .2 : .63;
          const crest = part.neck ? Math.max(0, Math.min(1, (point[0] / bodyWidth + .5 - part.neck[0] + .24) / .22)) : 1;
          const weight = Math.max(0, Math.min(1, (edge - v) / .36)) * crest;
          const turn = rotate([point[0] - neck[0], (point[1] - neck[1]) * length], angle);
          const local = [point[0] + (neck[0] + turn[0] - point[0]) * weight, point[1] + (neck[1] + turn[1] - point[1]) * weight];
          const sway = (attributes.strength || attributes.arms) ? harvest * .035 * Math.max(0, v - .58) * Math.sign(point[0]) : 0;
          const result = rotate([local[0] * sx + sway * bodyWidth, local[1] * sy], bodyAngle);
          return [bodyX + result[0], track.cut + result[1]];
        };
        const points = [], uv = [];
        for (let row = 0; row <= 6; row++) for (let col = 0; col <= 6; col++) {
          points.push(bodyPoint([(col / 6 - .5) * bodyWidth, (row / 6 - 1) * bodyHeight])); uv.push([col / 6 * part.width, row / 6 * part.height]);
        }
        items.push(() => drawMesh(context, part, points, uv, 6, 6, createSurface));
        eyeTransform = (point, eye) => bodyPoint([eye.side * bodyWidth * .17, -bodyHeight * .28]);
        include(part, [-bodyWidth / 2, -bodyHeight, bodyWidth, bodyHeight], bodyPoint);
      }
    } else {
      const base = sourceBase(pose, track, Boolean(upper), Boolean(part), size, attributes.excavation);
      items.push(() => context.drawImage(base, 0, 0, 144, 144));
      maximum = Math.max(maximum, track.cut);
      if (!upper && rig.tribe === "spore") maximum = Math.max(maximum, track.cap[1] + track.cap[3]);
      bodyWidth = part ? part.size[0] * body[2] / reference.body[2] : body[2];
      bodyHeight = part ? part.size[1] * body[3] / reference.body[3] : body[3]; bodyX = center[0]; bodyAngle = track.angle;
      bodyPoint = point => { const p = rotate(point, bodyAngle); return [bodyX + p[0], track.cut + p[1]]; };
      if (part) {
        const box = [-bodyWidth / 2, -bodyHeight, bodyWidth, bodyHeight], bend = (attributes.strength || attributes.arms) ? harvest * .045 : 0;
        items.push(() => { context.save(); context.translate(bodyX, track.cut); context.rotate(bodyAngle); drawPart(context, part, box, bend, createSurface); context.restore(); });
        include(part, box, bodyPoint);
      }
    }

    const footItems = [];
    for (const [index, side] of [-1, 1].entries()) {
      const foot = rig.morphs.parts[index ? "feet-right" : "feet-left"], u = side < 0 ? .25 : .75;
      const bottom = part ? (outlineAt(part, u) - 1) * bodyHeight : 0;
      const p = phase + (index ? Math.PI : 0), strideX = walking ? Math.sin(p) * 2.8 * factor * stride : 0;
      const raised = walking ? Math.max(0, Math.sin(p)) * 2.5 * factor * stride : 0;
      const rootX = pose.torso[0] + side * pose.torsoWidth * .25 + strideX;
      const root = part ? bodyPoint([side * bodyWidth * .25 + strideX, bottom - footHeight * .45 - raised]) :
        [rootX, outlineAt(pose, rootX / 144) * 144 - footHeight * .6 - raised];
      const rotation = (rig.tribe === "spring" && !part ? 0 : bodyAngle) + (walking ? Math.sin(p) * .13 * stride : 0), pivotX = rig.tribe === "spring" ? index ? .2 : .8 : .5;
      const box = [-pivotX * footWidth, -.25 * footHeight, footWidth, footHeight];
      const point = value => { const p = rotate(value, rotation); return [root[0] + p[0], root[1] + p[1]]; };
      include(foot, box, point);
      footItems.push(() => { context.save(); context.translate(...root); context.rotate(rotation); drawPart(context, foot, box, 0, createSurface); context.restore(); });
    }
    for (const draw of footItems) draw(); for (const draw of items) draw();
    if (upper) {
      const axis = track.capAxis, width = upper.size[0] * axis[2] / reference.capAxis[2];
      const h = upper.size[1] * axis[3] / reference.capAxis[3], height = h;
      const anchor = [axis[0] - Math.sin(axis[4]) * axis[3] / 2, axis[1] + Math.cos(axis[4]) * axis[3] / 2], box = [-width / 2, -height, width, height];
      const point = value => { const p = rotate(value, axis[4]); return [anchor[0] + p[0], anchor[1] + p[1]]; };
      include(upper, box, point);
      context.save(); context.translate(...anchor); context.rotate(axis[4]);
      drawPart(context, upper, box, 0, createSurface); context.restore();
    } else if (rig.tribe === "spore" && part) {
      context.save();
      if (attributes.excavation) {
        context.beginPath(); context.rect(-24, -24, 192, 192);
        context.rect(body[0] - 2, body[1] + body[3] * .14, body[2] + 4, body[3]); context.clip("evenodd");
      }
      context.drawImage(pose.front, 0, 0, 144, 144); context.restore();
    }
    if (attributes.excavation) {
      const eyes = pose.eyes.slice().sort((a, b) => a.side - b.side);
      if (eyes.length === 2) {
        const points = eyes.map(eye => {
          const [x, y, width, height] = eye.box, center = [x + width / 2, y + height / 2];
          return part ? eyeTransform(center, eye) : center;
        });
        excavation.draw(context, rig.tribe, { left: points[0], right: points[1], bottom: bodyPoint([0, 0]) });
      } else excavation.body(context, rig.tribe, [bodyX - bodyWidth / 2, track.cut - bodyHeight, bodyWidth, bodyHeight], bodyAngle);
    }
    if (part) {
      context.save(); context.globalCompositeOperation = "source-atop";
      const eyes = part.neck && action === "birth" ? pose.eyes.filter(eye =>
        eye.box[2] < body[2] * .24 && eye.box[3] < Math.max(3, body[3] * .24)) : pose.eyes;
      for (const eye of part.neck && action === "birth" && eyes.length !== 2 ? [] : eyes) {
        const [x, y, width, height] = eye.box, p = eyeTransform([x + width / 2, y + height / 2], eye);
        if (model.core) { context.save(); context.translate(...p); context.rotate(bodyAngle); context.drawImage(eye.sprite, -width / 2, -height / 2, width, height); context.restore(); }
        else context.drawImage(eye.sprite, p[0] - width / 2, p[1] - height / 2, width, height);
      }
      context.restore();
    }
    const target = ["birth", "jump"].includes(action) ? body[1] + body[3] + (reference.floor - reference.cut) * factor : track.floor;
    const offset = Number.isFinite(maximum) ? target - maximum : 0;
    surface.getContext("2d").drawImage(core, 0, offset * scale);
    frames.set(key, surface); if (frames.size > 192) frames.delete(frames.keys().next().value);
    return surface;
  }

  return { prepare, frame };
}
