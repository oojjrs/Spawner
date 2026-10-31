const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const ramp = (value, start, end) => smooth((value - start) / (end - start));
const mix = (from, to, amount) => from + (to - from) * amount;

export function constructionGrowthPose(progress) {
  const first = ramp(progress, .31, .37), second = ramp(progress, .65, .71);
  const stage = second >= .45 ? 3 : first >= .16 ? 2 : 1;
  return { stage, extent: second > 0 ? 2 + second : 1 + first,
    settle: ramp(progress, 0, .075), first, second, opening: ramp(progress, .90, 1) };
}

export function constructionHeartbeat(time, offset) {
  const phase = (time / 1.45 + offset) % 1;
  return Math.exp(-Math.pow((phase - .20) / .075, 2)) + .58 * Math.exp(-Math.pow((phase - .40) / .09, 2));
}

export function drawConstructionBed(context, image, growth, extent) {
  return;
}

function triangle(context, image, source, uv, points) {
  const [a, b, c] = uv, [p, q, r] = points;
  const determinant = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  const xx = ((q[0] - p[0]) * (c[1] - a[1]) - (r[0] - p[0]) * (b[1] - a[1])) / determinant;
  const xy = ((r[0] - p[0]) * (b[0] - a[0]) - (q[0] - p[0]) * (c[0] - a[0])) / determinant;
  const yx = ((q[1] - p[1]) * (c[1] - a[1]) - (r[1] - p[1]) * (b[1] - a[1])) / determinant;
  const yy = ((r[1] - p[1]) * (b[0] - a[0]) - (q[1] - p[1]) * (c[0] - a[0])) / determinant;
  const center = [(p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3];
  context.save(); context.beginPath();
  for (const [index, point] of points.entries()) {
    const distance = Math.hypot(point[0] - center[0], point[1] - center[1]);
    const x = point[0] + (point[0] - center[0]) / distance * .016;
    const y = point[1] + (point[1] - center[1]) / distance * .016;
    if (index) context.lineTo(x, y); else context.moveTo(x, y);
  }
  context.closePath(); context.clip();
  context.transform(xx, yx, xy, yy, p[0] - xx * a[0] - xy * a[1], p[1] - yx * a[0] - yy * a[1]);
  context.drawImage(image, ...source, 0, 0, 1, 1); context.restore();
}

export function drawConstructionCocoon(context, image, growth, tribe, extent, time) {
  const rect = growth.parts.cocoon, width = extent * .94, height = width * rect[3] / rect[2];
  const floor = growth.ground ? growth.ground[1] : extent * .31;
  if (tribe === "pebble") {
    context.drawImage(image, ...rect, -width / 2, floor - height, width, height);
    const pulse = constructionHeartbeat(time, 0), centerY = floor - height * .40;
    const light = context.createRadialGradient(0, centerY, 0, 0, centerY, width * .16);
    light.addColorStop(0, "rgba(255,221,130," + pulse * .38 + ")"); light.addColorStop(1, "rgba(255,221,130,0)");
    context.save(); context.globalCompositeOperation = "screen"; context.fillStyle = light;
    context.fillRect(-width * .16, centerY - width * .16, width * .32, width * .32); context.restore();
    return;
  }
  const mesh = growth.mesh, vertices = [];
  for (const vertex of mesh.vertices) {
    const [u, v] = vertex.uv;
    let dx = 0, dy = 0;
    for (let index = 0; index < mesh.pulseCenters.length; index++) {
      const pulse = constructionHeartbeat(time, index * .17) * vertex.weights[index + 1];
      dx += (u - .5) * pulse * (tribe === "spring" ? .07 : .055);
      dy -= pulse * (tribe === "spore" ? .023 : .018);
    }
    vertices.push({ uv: [u, v], point: [(u - .5 + dx) * width, floor - height + (v + dy) * height] });
  }
  for (const indices of mesh.triangles) triangle(context, image, rect,
    indices.map(index => vertices[index].uv), indices.map(index => vertices[index].point));
}

export function constructionDoorway(sequence) {
  const layout = sequence.layout;
  const watch = sequence.kind === "watchpost", lab = sequence.kind === "evolution-lab";
  const width = watch ? Math.max(layout.back.size[0] * .9, .55) : lab ? 1.52 : 1.94;
  const bottom = watch ? layout.front.center[1] - layout.front.size[1] * .30 :
    layout.front.center[1] - layout.front.size[1] * .48;
  const top = watch ? layout.roof.center[1] : layout.roof.center[1] - .28;
  return { width, top, bottom, height: Math.max(.45, bottom - top) };
}

export function drawConstructionDoors(context, image, growth, sequence, opening, time) {
  if (opening >= 1) return;
  const doorway = sequence.doorway || constructionDoorway(sequence), pulse = constructionHeartbeat(time, 0);
  const curve = Math.cos(opening * Math.PI / 2), flexible = sequence.tribe !== "pebble";
  context.save(); context.beginPath();
  context.rect(-doorway.width / 2 - .01, doorway.top - .03, doorway.width + .02, doorway.height + .03); context.clip();
  for (const [index, name] of ["doorLeft", "doorRight"].entries()) {
    const rect = growth.parts[name], side = index ? 1 : -1;
    const width = doorway.width / 2 * curve * (1 + (flexible ? pulse * .018 : 0));
    const height = doorway.height * (1 + (flexible ? pulse * .012 : 0));
    const x = side < 0 ? -doorway.width / 2 : doorway.width / 2 - width;
    context.drawImage(image, ...rect, x, doorway.bottom - height, width + .006, height);
  }
  if (sequence.tribe === "pebble") {
    const centerY = (doorway.top + doorway.bottom) / 2;
    const light = context.createRadialGradient(0, centerY, 0, 0, centerY, .17);
    light.addColorStop(0, "rgba(255,213,102," + pulse * (1 - opening) * .65 + ")");
    light.addColorStop(1, "rgba(255,213,102,0)");
    context.globalCompositeOperation = "screen"; context.fillStyle = light;
    context.fillRect(-.17, centerY - .17, .34, .34);
  }
  context.restore();
}

export function drawConstructionGrowth(context, sequence, growth, image, pose, time, core, architecture) {
  if (pose.stage === 1) {
    const laid = ramp(pose.settle, .05, 1);
    if (laid > 0) drawConstructionBed(context, image, growth, mix(.14, 1.18, laid));
    core(pose.extent);
    return;
  }
  if (pose.stage === 2) {
    drawConstructionBed(context, image, growth, pose.extent * 1.07);
    drawConstructionCocoon(context, image, growth, sequence.tribe, pose.extent, time);
    return;
  }
  context.save();
  const ground = growth.ground || [0, 0];
  context.translate(...ground); context.scale(pose.extent / 3, pose.extent / 3); context.translate(-ground[0], -ground[1]);
  if (sequence.ground && architecture) {
    drawConstructionBed(context, image, growth, 3);
    architecture(() => drawConstructionDoors(context, image, growth, sequence, pose.opening, time));
  } else {
    context.drawImage(sequence.building, -1.5, -1.5, 3, 3);
    drawConstructionDoors(context, image, growth, sequence, pose.opening, time);
  }
  context.restore();
}
