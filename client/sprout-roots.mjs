import { SPROUT_ROOT_RIG } from "./sprout-root-rig.mjs";

export function createSpriteContour(sprite) {
  const source = sprite.getContext("2d").getImageData(0, 0, sprite.width, sprite.height);
  const width = sprite.width + 2, height = sprite.height + 2, data = new Uint8Array(width * height);
  for (let y = 0; y < sprite.height; y++) for (let x = 0; x < sprite.width; x++)
    data[(y + 1) * width + x + 1] = source.data[(y * sprite.width + x) * 4 + 3];
  const path = new Path2D(), vertices = new Map();
  const pairs = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
    [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]], [[1, 3]], [[0, 1]], [[3, 0]], []];
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    const alpha = [data[y * width + x], data[y * width + x + 1],
      data[(y + 1) * width + x + 1], data[(y + 1) * width + x]];
    const mask = (alpha[0] >= 128 ? 1 : 0) | (alpha[1] >= 128 ? 2 : 0) |
      (alpha[2] >= 128 ? 4 : 0) | (alpha[3] >= 128 ? 8 : 0);
    if (!mask || mask === 15) continue;
    const keys = [(y * width + x) * 2, (y * width + x + 1) * 2 + 1,
      ((y + 1) * width + x) * 2, (y * width + x) * 2 + 1];
    const corners = [[x - .5, y - .5], [x + .5, y - .5], [x + .5, y + .5], [x - .5, y + .5]];
    const vertex = edge => {
      const key = keys[edge];
      if (!vertices.has(key)) {
        const next = (edge + 1) % 4, ratio = (128 - alpha[edge]) / (alpha[next] - alpha[edge]);
        vertices.set(key, { x: corners[edge][0] + (corners[next][0] - corners[edge][0]) * ratio,
          y: corners[edge][1] + (corners[next][1] - corners[edge][1]) * ratio, links: [], visited: false });
      }
      return key;
    };
    for (const pair of pairs[mask]) {
      const a = vertex(pair[0]), b = vertex(pair[1]);
      vertices.get(a).links.push(b); vertices.get(b).links.push(a);
    }
  }
  for (const [key, start] of vertices) {
    if (start.visited) continue;
    path.moveTo(start.x, start.y);
    let previous = null, current = key;
    while (current != null) {
      const point = vertices.get(current); point.visited = true;
      const next = point.links.find(link => link !== previous);
      if (next === key) { path.closePath(); break; }
      if (next == null || vertices.get(next).visited) break;
      const target = vertices.get(next); path.lineTo(target.x, target.y);
      previous = current; current = next;
    }
  }
  return path;
}

export function sproutRootGeometry(level) {
  const count = Math.max(1, Math.min(4, level || 1));
  const height = 76 + count * 8;
  return { width: 264 * height / 84, height, floor: 512 * .94, overlap: .12 };
}

const clampRoot = value => Math.max(0, Math.min(1, value));
const rootEase = value => value * value * (3 - 2 * value);
const rootMix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function rootTriangle(context, image, source, target) {
  const [a, b, c] = source, [p, q, r] = target;
  const d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(d) < .00001) return;
  const xx = ((q[0] - p[0]) * (c[1] - a[1]) - (r[0] - p[0]) * (b[1] - a[1])) / d;
  const yx = ((q[1] - p[1]) * (c[1] - a[1]) - (r[1] - p[1]) * (b[1] - a[1])) / d;
  const xy = ((r[0] - p[0]) * (b[0] - a[0]) - (q[0] - p[0]) * (c[0] - a[0])) / d;
  const yy = ((r[1] - p[1]) * (b[0] - a[0]) - (q[1] - p[1]) * (c[0] - a[0])) / d;
  const clip = [p, q, r];
  context.save(); context.beginPath(); context.moveTo(...clip[0]); context.lineTo(...clip[1]); context.lineTo(...clip[2]); context.closePath(); context.clip();
  context.transform(xx, yx, xy, yy, p[0] - xx * a[0] - xy * a[1], p[1] - yx * a[0] - yy * a[1]);
  context.drawImage(image, 0, 0); context.restore();
}

export function createSproutRoots(createSurface) {
  const gaits = new Map(), frames = new Map(), sources = new WeakMap();
  let generation = 0;
  function sourceParts(image) {
    if (!sources.has(image)) sources.set(image, SPROUT_ROOT_RIG.parts.map(part => {
      const density = 4, surface = createSurface(part.rect[2] * density, part.rect[3] * density), context = surface.getContext("2d");
      context.drawImage(image, ...part.rect, 0, 0, surface.width, surface.height);
      context.globalCompositeOperation = "source-atop"; context.strokeStyle = "#30372b";
      context.lineWidth = 4 * surface.height / 68; context.lineCap = "round"; context.lineJoin = "round";
      context.stroke(createSpriteContour(surface));
      return surface;
    }));
    return sources.get(image);
  }
  function neutral(level) {
    const geometry = sproutRootGeometry(level), scale = geometry.height / 84;
    return [{ x: 256 - 45 * scale, y: geometry.floor - 6 * scale },
      { x: 256, y: geometry.floor }, { x: 256 + 45 * scale, y: geometry.floor - 6 * scale }];
  }
  function pose(agent, position, time) {
    const attributes = agent.appearanceAttributes || agent.attributes || {}, level = attributes.feet || 1;
    const scale = sproutRootGeometry(level).height / 84, unitScale = .7 * (attributes.construction ? 512 / 350 : 1);
    const planPerCell = 512 / unitScale;
    const moving = agent.moveDuration > 0 && time >= agent.moveStartedAt && time < agent.moveStartedAt + agent.moveDuration;
    const direction = { x: Math.sign(agent.x - agent.renderFromX), y: Math.sign(agent.y - agent.renderFromY) };
    const speed = moving ? 1 / Math.max(.1, agent.moveDuration) : 0;
    const duty = direction.y ? 1 / 3 : 2 / 3;
    const step = Math.max(scale * unitScale / .7 / 4.5, speed / (direction.y ? 6 : 4));
    const rests = neutral(level), worldRest = index => ({ x: position.x + (rests[index].x - 256) / planPerCell,
      y: position.y + (rests[index].y - 512 * .94) / planPerCell });
    let state = gaits.get(agent.id);
    const moved = state ? Math.hypot(position.x - state.position.x, position.y - state.position.y) : 0;
    const expected = state && moving ? Math.max(0, time - state.time) / Math.max(.1, agent.moveDuration) : 0;
    if (!state || time < state.time - .5 || time - state.time > 1 || moved > Math.max(.07, expected * 2.5)) {
      state = { generation: ++generation, time: time - .001, position: { ...position }, distance: 0, cycles: duty / 2, moving: false,
        feet: rests.map((rest, i) => ({ point: worldRest(i), plant: worldRest(i), planted: true, lift: 0, cycle: null })) };
      gaits.set(agent.id, state); if (gaits.size > 512) gaits.delete(gaits.keys().next().value);
    }
    if (state.time === time && state.position.x === position.x && state.position.y === position.y && state.moving === moving && state.result) return state.result;
    const started = moving && !state.moving;
    const distance = Math.hypot(position.x - state.position.x, position.y - state.position.y);
    if (moving) {
      if (started) {
        state.distance = 0; state.cycles = duty / 2;
        for (const [i, foot] of state.feet.entries()) {
          foot.plant = { ...foot.point }; foot.from = null; foot.to = null; foot.cycle = null;
          const phase = (state.cycles + i / 3) % 1;
          const remaining = phase >= duty ? 1 - phase : duty / 2 - phase;
          const ahead = phase >= duty ? remaining + duty / 2 : remaining;
          foot.startup = remaining > 0 ? { from: { ...foot.point }, distance: state.distance,
            length: remaining * step,
            to: { x: worldRest(i).x + direction.x * ahead * step,
              y: worldRest(i).y + direction.y * ahead * step } } : null;
        }
      }
      state.distance += distance;
      state.cycles += distance / step;
      for (const [i, foot] of state.feet.entries()) {
        const total = state.cycles + i / 3, phase = total - Math.floor(total), cycle = Math.floor(total);
        if (foot.startup) {
          const q = clampRoot((state.distance - foot.startup.distance) / Math.max(.0001, foot.startup.length));
          foot.point = rootMix(foot.startup.from, foot.startup.to, rootEase(q)); foot.lift = Math.sin(Math.PI * q) ** 2 * 13 * scale; foot.planted = q === 1;
          if (q === 1) { foot.plant = { ...foot.point }; foot.startup = null; foot.cycle = cycle; }
          continue;
        }
        if (phase < duty) {
          if (foot.planted && foot.cycle != null && foot.cycle !== cycle) {
            foot.plant = { x: worldRest(i).x + direction.x * (duty / 2 - phase) * step,
              y: worldRest(i).y + direction.y * (duty / 2 - phase) * step };
          } else if (!foot.planted) foot.plant = { ...(foot.to || foot.point) };
          foot.point = { ...foot.plant }; foot.lift = 0; foot.planted = true; foot.from = null;
        } else {
          if (foot.planted || !foot.from || foot.cycle !== cycle) {
            foot.from = { ...foot.point };
            const ahead = (1 - phase + duty / 2) * step;
            foot.to = { x: worldRest(i).x + direction.x * ahead, y: worldRest(i).y + direction.y * ahead };
          }
          const q = (phase - duty) / (1 - duty);
          foot.point = rootMix(foot.from, foot.to, rootEase(q)); foot.lift = Math.sin(Math.PI * q) ** 2 * 14 * scale; foot.planted = false;
        }
        foot.cycle = cycle;
      }
      state.stoppedAt = null;
    } else {
      if (state.moving) {
        state.stoppedAt = time; state.stopRotation = state.result?.rotation || 0; state.stopBob = state.result?.bob || 0;
        for (const foot of state.feet) { foot.stopFrom = { ...foot.point }; foot.stopLift = foot.lift; }
      }
      for (const [i, foot] of state.feet.entries()) {
        const q = state.stoppedAt == null ? 1 : clampRoot((time - state.stoppedAt - i * .07) / .22);
        const target = worldRest(i), from = foot.stopFrom || target;
        foot.point = rootMix(from, target, rootEase(q));
        foot.lift = (foot.stopLift || 0) * (1 - rootEase(q)) + Math.sin(Math.PI * q) ** 2 * 9 * scale;
        foot.planted = q === 0 || q === 1;
      }
    }
    const phase = state.cycles % 1, fade = state.stoppedAt == null ? 0 : 1 - clampRoot((time - state.stoppedAt) / .18);
    const rotation = moving ? direction.x * .035 + Math.sin(phase * Math.PI * 2) * .014 : (state.stopRotation || 0) * fade;
    const bob = moving ? (1 - Math.cos(phase * Math.PI * 2)) * .003 : (state.stopBob || 0) * fade;
    const result = { phase: phase * Math.PI * 2, stride: moving ? 1 : 0, rotation, bob, load: 0,
      moving, settling: !moving && state.stoppedAt != null && time - state.stoppedAt < .4,
      feet: state.feet.map(foot => ({ x: 256 + (foot.point.x - position.x) * planPerCell,
        y: 512 * .94 + (foot.point.y - position.y) * planPerCell - foot.lift, lift: foot.lift, planted: foot.planted,
        worldX: foot.point.x, worldY: foot.point.y, contact: state.generation + ":" + foot.cycle })) };
    state.time = time; state.position = { ...position }; state.moving = moving; state.result = result;
    return result;
  }
  function rootFrame(image, index, level, dx, dy) {
    dx = Math.round(dx * 2) / 2; dy = Math.round(dy * 2) / 2;
    const key = [index, level, dx, dy].join(":");
    if (frames.has(key)) return frames.get(key);
    const part = SPROUT_ROOT_RIG.parts[index + 1], source = sourceParts(image)[index + 1], sw = source.width, sh = source.height;
    const scale = sproutRootGeometry(level).height / 84, length = Math.max(1, Math.hypot(dx, dy));
    const upper = Math.min(78 * scale, Math.max(30 * scale, dy * .9));
    const lower = Math.min(68 * scale, Math.max(20 * scale, dy * 1.6));
    const volume = Math.max(.92, Math.min(1.04, Math.sqrt(76 * scale / length)));
    const points = [], uv = [];
    for (let row = 0; row <= 12; row++) for (let col = 0; col <= 4; col++) {
      const v = row / 12, u = col / 4, v2 = v * v, v3 = v2 * v;
      const cx = dx * (-2 * v3 + 3 * v2);
      const cy = upper * (v3 - 2 * v2 + v) + dy * (-2 * v3 + 3 * v2) + lower * (v3 - v2);
      const tx = dx * (-6 * v2 + 6 * v);
      const ty = upper * (3 * v2 - 4 * v + 1) + dy * (-6 * v2 + 6 * v) + lower * (3 * v2 - 2 * v);
      const blend = rootEase(clampRoot((v - .6) / .2)), nx = ty * (1 - blend) + Math.hypot(tx, ty) * blend, ny = -tx * (1 - blend);
      const normal = Math.max(1, Math.hypot(nx, ny)), axis = part.attachment[0] + (part.contact[0] - part.attachment[0]) * v;
      const offset = (u - axis) * sw * (68 * scale / sh) * volume;
      points.push([cx + nx / normal * offset, cy + ny / normal * offset]); uv.push([u * sw, v * sh]);
    }
    const left = Math.floor(Math.min(...points.map(p => p[0])) - 3), top = Math.floor(Math.min(...points.map(p => p[1])) - 3);
    const right = Math.ceil(Math.max(...points.map(p => p[0])) + 3), bottom = Math.ceil(Math.max(...points.map(p => p[1])) + 3), density = 2;
    const sprite = createSurface(Math.ceil((right - left) * density), Math.ceil((bottom - top) * density)), context = sprite.getContext("2d");
    context.scale(density, density); context.translate(-left, -top); context.globalCompositeOperation = "lighter";
    for (let row = 0; row < 12; row++) for (let col = 0; col < 4; col++) {
      const i = row * 5 + col;
      for (const indices of [[i, i + 1, i + 6], [i, i + 6, i + 5]]) rootTriangle(context, source, indices.map(i => uv[i]), indices.map(i => points[i]));
    }
    const frame = { sprite, left, top, width: sprite.width / density, height: sprite.height / density, tip: [dx, dy] };
    frames.set(key, frame); if (frames.size > 512) frames.delete(frames.keys().next().value);
    return frame;
  }
  function drawRig(context, image, level, gait, body, outline) {
    if (!image || image.complete === false || !(image.naturalWidth || image.width)) return;
    const geometry = sproutRootGeometry(level), scale = geometry.height / 84, feet = gait?.feet || neutral(level);
    const rotation = body?.rotation || 0, bob = body?.bob || 0, pivot = body?.pivot ?? 460 - (426 - geometry.floor + geometry.height * .88);
    const transform = (x, y) => ({ x: 256 + (x - 256) * Math.cos(rotation) - (y - pivot) * Math.sin(rotation),
      y: pivot + (x - 256) * Math.sin(rotation) + (y - pivot) * Math.cos(rotation) - bob * 512 });
    const order = [0, 2, 1].sort((a, b) => Math.round((feet[a].y + (feet[a].lift || 0)) * 2) - Math.round((feet[b].y + (feet[b].lift || 0)) * 2));
    const roots = order.map(i => {
      const foot = feet[i], hip = transform(256 + (i - 1) * 23 * scale, geometry.floor - geometry.height * .75 - 9 * scale);
      const frame = rootFrame(image, i, level, foot.x - hip.x, foot.y - hip.y);
      return { frame, x: foot.x - frame.tip[0] + frame.left, y: foot.y - frame.tip[1] + frame.top };
    });
    const crown = sourceParts(image)[0], width = 74 * scale, height = width * crown.height / crown.width;
    const crownX = 256 - width / 2, crownY = geometry.floor - geometry.height * .75 - 9 * scale - height;
    const paint = target => {
      for (const root of roots) target.drawImage(root.frame.sprite, root.x, root.y, root.frame.width, root.frame.height);
      target.save(); target.translate(256, pivot - bob * 512); target.rotate(rotation);
      target.drawImage(crown, crownX - 256, crownY - pivot, width, height); target.restore();
    };
    const corners = [[crownX, crownY], [crownX + width, crownY], [crownX, crownY + height], [crownX + width, crownY + height]].map(p => transform(...p));
    const left = Math.floor(Math.min(...roots.map(r => r.x), ...corners.map(p => p.x)) - 2);
    const top = Math.floor(Math.min(...roots.map(r => r.y), ...corners.map(p => p.y)) - 2);
    const right = Math.ceil(Math.max(...roots.map(r => r.x + r.frame.width), ...corners.map(p => p.x)) + 2);
    const bottom = Math.ceil(Math.max(...roots.map(r => r.y + r.frame.height), ...corners.map(p => p.y)) + 2), density = 2;
    const group = createSurface((right - left) * density, (bottom - top) * density), target = group.getContext("2d");
    target.scale(density, density); target.translate(-left, -top); paint(target);
    if (outline) outline(group, left, top, right - left, bottom - top);
    context.drawImage(group, left, top, right - left, bottom - top);
  }
  function draw(context, image, level, phase, stride, outline) {
    if (!image || image.complete === false || !(image.naturalWidth || image.width)) return;
    const geometry = sproutRootGeometry(level), box = [256 - geometry.width / 2, geometry.floor - geometry.height, geometry.width, geometry.height];
    if (outline) outline(image, ...box); context.drawImage(image, ...box);
  }
  return { pose, draw, drawRig, neutral };
}
