import { constructionHeartbeat } from "./construction-growth.mjs";

const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const interval = (progress, start, end) => ease((progress - start) / (end - start));

function drawPart(context, image, rect, x, y, width, height, rotation, pivot, clipBottom) {
  context.save();
  if (Number.isFinite(clipBottom)) { context.beginPath(); context.rect(-10, -10, 20, 10 + clipBottom); context.clip(); }
  context.translate(x, y); context.rotate(rotation);
  context.drawImage(image, ...rect, -width * pivot[0], -height * pivot[1], width, height);
  context.restore();
}

export function constructionCorePose(tribe, unit, progress, time) {
  const bodyWidth = tribe === "spore" ? 320 : tribe === "spring" ? 430 : 460;
  const source = unit.parts.body, height = source[3] / source[2] * bodyWidth;
  const settled = interval(progress, 0, 1), pulse = Number.isFinite(time) ? constructionHeartbeat(time, 0) * settled : 0;
  const squash = tribe === "pebble" ? 1 : 1 - settled * .04 + (tribe === "spore" ? 0 : pulse * .035);
  const width = bodyWidth * (tribe === "pebble" ? 1 : 1 + settled * .02 + (tribe === "spore" ? 0 : pulse * .025));
  const bodyHeight = height * squash;
  const centerY = 460 - bodyHeight / 2;
  const crown = unit.parts.crown, crownWidth = tribe === "spore" ? 460 : 220;
  const crownHeight = crown[3] / crown[2] * crownWidth;
  const crownFold = settled;
  const crownY = centerY - bodyHeight / 2 + crownHeight * (tribe === "spore" ? .24 : .18);
  return { body: [256 - width / 2, centerY - bodyHeight / 2, width, bodyHeight],
    crown: [256, crownY, crownWidth * (1 - crownFold * .10 + (tribe === "spore" ? pulse * .025 : 0)),
      crownHeight * (1 - crownFold * .15 + (tribe === "spore" ? pulse * .04 : 0))],
    eyeY: centerY + bodyHeight * .03, eyeSpread: 66 * width / bodyWidth,
    eyeScale: 1, closed: progress > .15,
    crownVisible: tribe === "bean" || tribe === "spore" };
}

export function drawConstructionCore(context, image, unit, tribe, progress, time) {
  const pose = constructionCorePose(tribe, unit, progress, time), [x, y, width, height] = pose.body;
  if (pose.crownVisible) drawPart(context, image, unit.parts.crown, ...pose.crown, 0, [.5, 1]);
  context.drawImage(image, ...unit.parts.body, x, y, width, height);
  if (tribe === "pebble" && Number.isFinite(time)) {
    const pulse = constructionHeartbeat(time, 0) * progress, centerY = y + height * .70;
    const light = context.createRadialGradient(256, centerY, 0, 256, centerY, 38);
    light.addColorStop(0, "rgba(255,217,114," + pulse * .50 + ")"); light.addColorStop(1, "rgba(255,217,114,0)");
    context.save(); context.globalCompositeOperation = "screen"; context.fillStyle = light;
    context.fillRect(218, centerY - 38, 76, 76); context.restore();
  }
  const eyes = pose.closed ? [unit.parts.eyesClosedLeft, unit.parts.eyesClosedRight] :
    [unit.parts.eyesOpenLeft, unit.parts.eyesOpenRight];
  const eyeWidth = (pose.closed ? 30 : 23) * pose.eyeScale;
  for (const [index, side] of [-1, 1].entries()) {
    const eye = eyes[index], eyeHeight = eyeWidth * eye[3] / eye[2];
    context.drawImage(image, ...eye, 256 + side * pose.eyeSpread - eyeWidth / 2,
      pose.eyeY - eyeHeight / 2, eyeWidth, eyeHeight);
  }
}

export function constructionBuildingLayout(sequence) {
  const { width, height, parts } = sequence;
  const watch = sequence.kind === "watchpost", provisional = sequence.kind === "outpost";
  const contact = sequence.tribe === "spore" && ["storage", "outpost"].includes(sequence.kind) ? .94 : 1;
  const wallHeight = height * (watch ? .18 : provisional ? .39 : .53) * contact;
  const floor = height * (provisional ? .28 : .39);
  const dimensions = (name, extent, axis) => {
    const rect = parts[name];
    return axis === "height" ? [extent * rect[2] / rect[3], extent] : [extent, extent * rect[3] / rect[2]];
  };
  const back = dimensions("back", watch ? height * .77 : width * .77, watch ? "height" : "width");
  const roof = dimensions("roof", width * (watch ? .72 : provisional ? .91 : .96), "width");
  const left = dimensions("left", wallHeight, "height"), right = dimensions("right", wallHeight, "height");
  const front = dimensions("front", width * (watch ? .54 : .79), "width");
  const feature = dimensions("feature", width * (sequence.kind === "evolution-lab" ? .33 : watch ? .14 : .90), "width");
  const roofBottom = height * (watch ? -.28 : provisional ? .04 : .06);
  const result = {
    back: { center: [0, floor - back[1] / 2], size: back, pivot: [.5, .5] },
    roof: { center: [0, roofBottom], size: roof, pivot: [.5, 1] },
    left: { center: [-width * (watch ? .18 : .33), floor], size: left, pivot: [.5, 1] },
    right: { center: [width * (watch ? .18 : .33), floor], size: right, pivot: [.5, 1] },
    front: { center: [0, floor + height * .025], size: front, pivot: [.5, 1] },
    feature: { center: [0, sequence.kind === "evolution-lab" ? height * .22 : watch ? roofBottom : roofBottom + height * .04],
      size: feature, pivot: [.5, 1] }
  };
  let leftEdge = Infinity, rightEdge = -Infinity, topEdge = Infinity, bottomEdge = -Infinity;
  for (const [name, part] of Object.entries(result)) {
    if (name === "feature" && sequence.featureVisible === false) continue;
    leftEdge = Math.min(leftEdge, part.center[0] - part.size[0] * part.pivot[0]);
    rightEdge = Math.max(rightEdge, part.center[0] + part.size[0] * (1 - part.pivot[0]));
    topEdge = Math.min(topEdge, part.center[1] - part.size[1] * part.pivot[1]);
    bottomEdge = Math.max(bottomEdge, part.center[1] + part.size[1] * (1 - part.pivot[1]));
  }
  const scale = Math.min(width * .94 / (rightEdge - leftEdge), height * .90 / (bottomEdge - topEdge));
  const centerX = (leftEdge + rightEdge) / 2, centerY = (topEdge + bottomEdge) / 2;
  for (const part of Object.values(result)) {
    part.center = [(part.center[0] - centerX) * scale, (part.center[1] - centerY) * scale];
    part.size = part.size.map(value => value * scale);
  }
  return result;
}

export function drawConstructionBuilding(context, image, sequence, gate, assemblyAmount) {
  const layout = sequence.layout || constructionBuildingLayout(sequence);
  const draw = name => {
    if (name === "feature" && sequence.featureVisible === false) return;
    const part = layout[name];
    let rise = 0;
    if (sequence.assembly && Number.isFinite(assemblyAmount)) {
      const assembly = sequence.assembly, delay = assembly.delays[name] || 0;
      const amount = ease((assemblyAmount - delay) / (1 - delay));
      const top = assembly.connected ? Math.min(...Object.values(layout).map(value =>
        value.center[1] - value.size[1] * value.pivot[1])) : part.center[1] - part.size[1] * part.pivot[1];
      rise = Math.max(0, assembly.ground - top + .01) * (1 - amount);
    }
    drawPart(context, image, sequence.parts[name], part.center[0], part.center[1] + rise, ...part.size, 0, part.pivot, part.clipBottom);
  };
  draw("back");
  if (!sequence.ground && sequence.kind !== "evolution-lab" && sequence.kind !== "watchpost") draw("feature");
  draw("left"); draw("right");
  if (sequence.kind === "evolution-lab" || sequence.kind === "watchpost") draw("feature");
  if (typeof gate === "function") gate();
  if (sequence.ground && sequence.kind !== "evolution-lab" && sequence.kind !== "watchpost") draw("feature");
  draw("roof"); draw("front");
}
