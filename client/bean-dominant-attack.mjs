import { attributeAttackPose, attributeAttackBodyTransform } from "../DesignAssets/Animations/CombatAttributesV7/attack.mjs";

// A stronger wind-up uses the approved canonical blade's own body pixels.
// Existing blade tracks and eye closure stay unchanged. Lower body support
// blends back to the source so body compression cannot drag the planted feet.
const BODY = Object.freeze({
  x: [[0, 0], [160, -8], [240, -11], [300, 22], [380, 26], [520, 12], [720, 0], [1000, 0]],
  y: [[0, 0], [240, 0], [300, -13], [420, -18], [520, -8], [720, 0], [1000, 0]],
  angle: [[0, 0], [160, -.10], [240, -.14], [300, .17], [380, .18], [520, .08], [720, 0], [1000, 0]],
  sx: [[0, 1], [160, 1.10], [240, 1.16], [300, 1.06], [380, 1.06], [520, 1.02], [720, 1], [1000, 1]],
  sy: [[0, 1], [160, .86], [240, .78], [300, .87], [380, .89], [520, .94], [720, 1], [1000, 1]],
});
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const point2 = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
const rotate = (x, y, angle) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];

export function beanDominantAttackAppearance(tribe, attributes) {
  return (tribe || "bean") === "bean" && attributes?.blade > 0 &&
    !["piercing", "carapace", "antenna", "strength", "arms", "feet", "legs", "secretion"].some(key => attributes[key] > 0);
}

export function prepareBeanDominantAttack(original, images) {
  try {
    if (original?.tribe !== "sprout" || original.variant !== "blade" ||
        original.approvedSource !== "DesignAssets/Concepts/CombatEvolutionV1/sprout.png" ||
        original.canvas?.[0] !== 506 || original.canvas?.[1] !== 372 ||
        ![original.root, original.face, original.fitOffset].every(point2) ||
        !Number.isFinite(original.scale) || !(original.scale > 0) ||
        Math.abs(original.root[0] - 238.72330397422388) > .00001 || original.root[1] !== 368) return null;
    const ids = ["body", "foliage-left", "foliage-right", "eye-0", "eye-1", "foot-0", "foot-1"];
    const parts = Object.fromEntries(ids.map(id => [id, original.parts?.find(part => part.id === id)]));
    const sourceImages = Object.fromEntries(ids.map(id => [id, images?.[original.attackMotion?.images?.[id] ? "attack-" + id : id]]));
    for (const id of ids) {
      const part = parts[id], image = sourceImages[id], foliage = id.startsWith("foliage-");
      if (!part || !point2(part.pivot) || !image || image.complete === false ||
          (image.naturalWidth || image.width) !== (foliage ? 553 : 506) ||
          (image.naturalHeight || image.height) !== (foliage ? 415 : 372)) return null;
      if (foliage && (part.imageOrigin?.[0] !== -17 || part.imageOrigin?.[1] !== -32)) return null;
    }
    const meshes = {};
    for (const id of ["body", "foliage-left", "foliage-right"]) {
      const mesh = parts[id].skin;
      if (!mesh?.vertices?.length || !mesh.triangles?.length ||
          mesh.vertices.some(vertex => !point2(vertex.uv) || !point2(vertex.point || vertex.uv) ||
            id !== "body" && (!Array.isArray(vertex.weights) || vertex.weights.length !== 3 || !vertex.weights.every(Number.isFinite))) ||
          mesh.triangles.some(ids => !Array.isArray(ids) || ids.length !== 3 || ids.some(i => !Number.isInteger(i) || i < 0 || i >= mesh.vertices.length))) return null;
      const points = mesh.vertices.map(vertex => vertex.point || vertex.uv);
      const areas = mesh.triangles.map(ids => area(...ids.map(i => points[i])));
      if (areas.some(value => !Number.isFinite(value) || Math.abs(value) < .00001) ||
          mesh.triangles.some(ids => Math.abs(area(...ids.map(i => mesh.vertices[i].uv))) < .00001)) return null;
      meshes[id] = { ...mesh, points, areas };
    }
    const rig = { ...original, attackMotion: { ...original.attackMotion,
      body: { ...original.attackMotion.body, ...BODY } } };
    return { rig, parts, images: sourceImages, meshes };
  } catch { return null; }
}

export function sampleBeanDominantAttack(prepared, time) {
  try {
    if (!prepared || !Number.isFinite(time) || time < 0 || time > 1000) return null;
    const { rig, parts, meshes } = prepared, pose = attributeAttackPose(rig, time), b = pose.body;
    if (![b.x, b.y, b.angle, b.sx, b.sy, b.projection, b.blink].every(Number.isFinite) || !(b.sx > 0 && b.sy > 0)) return null;
    const bodyPoint = ([x, y]) => {
      const q = rotate((x - pose.center[0]) * b.sx * b.projection, (y - pose.center[1]) * b.sy, b.angle);
      const weight = smooth((360 - y) / 100);
      return [x + (pose.center[0] + b.x + q[0] - x) * weight,
        y + (pose.center[1] + b.y + q[1] - y) * weight];
    };
    const mapped = { body: meshes.body.points.map(bodyPoint) };
    for (const id of ["foliage-left", "foliage-right"]) {
      const part = parts[id], state = pose.parts[id];
      mapped[id] = meshes[id].vertices.map(vertex => {
        const point = vertex.point || vertex.uv;
        const q = rotate(point[0] - part.pivot[0], point[1] - part.pivot[1], state.bend * (vertex.weights[1] * .45 + vertex.weights[2]));
        return [part.pivot[0] + q[0], part.pivot[1] + q[1]];
      });
    }
    for (const [id, points] of Object.entries(mapped)) {
      const mesh = meshes[id];
      if (points.some(point => !point2(point))) return null;
      for (let i = 0; i < mesh.triangles.length; i++) {
        const ratio = area(...mesh.triangles[i].map(index => points[index])) / mesh.areas[i];
        if (!Number.isFinite(ratio) || ratio <= .02) return null;
      }
    }
    return { prepared, pose, mapped, neutralBody: !b.x && !b.y && !b.angle && b.sx === 1 && b.sy === 1 && b.projection === 1 };
  } catch { return null; }
}

function triangle(context, image, uv, points) {
  const transform = context.getTransform();
  const padding = 1.2 / Math.sqrt(Math.max(.0001, Math.abs(transform.a * transform.d - transform.b * transform.c)));
  const [a, b, c] = uv, [p, q, r] = points, d = area(a, b, c);
  const xx = ((q[0] - p[0]) * (c[1] - a[1]) - (r[0] - p[0]) * (b[1] - a[1])) / d;
  const xy = ((r[0] - p[0]) * (b[0] - a[0]) - (q[0] - p[0]) * (c[0] - a[0])) / d;
  const yx = ((q[1] - p[1]) * (c[1] - a[1]) - (r[1] - p[1]) * (b[1] - a[1])) / d;
  const yy = ((r[1] - p[1]) * (b[0] - a[0]) - (q[1] - p[1]) * (c[0] - a[0])) / d;
  const center = points.reduce((sum, point) => [sum[0] + point[0] / 3, sum[1] + point[1] / 3], [0, 0]);
  context.save();
  try {
    context.beginPath();
    points.forEach((point, i) => {
      const x = point[0] - center[0], y = point[1] - center[1], length = Math.hypot(x, y) || 1;
      const vertex = [point[0] + x / length * padding, point[1] + y / length * padding];
      if (i) context.lineTo(...vertex); else context.moveTo(...vertex);
    });
    context.closePath(); context.clip();
    context.transform(xx, yx, xy, yy, p[0] - xx * a[0] - xy * a[1], p[1] - yx * a[0] - yy * a[1]);
    context.drawImage(image, 0, 0);
  } finally { context.restore(); }
}

export function renderBeanDominantAttack(context, sample) {
  if (!sample) return false;
  const { prepared, pose, mapped, neutralBody } = sample, { rig, parts, images, meshes } = prepared, b = pose.body;
  context.save();
  try {
    context.translate(256 + rig.fitOffset[0] * 2, 448 + rig.fitOffset[1] * 2);
    context.scale(rig.scale * 2, rig.scale * 2); context.translate(-rig.root[0], -rig.root[1]);
    if (neutralBody) context.drawImage(images.body, 0, 0);
    else for (const ids of meshes.body.triangles)
      triangle(context, images.body, ids.map(i => meshes.body.vertices[i].uv), ids.map(i => mapped.body[i]));
    context.save();
    try {
      context.beginPath(); context.rect(0, 360, 506, 12); context.clip();
      context.globalCompositeOperation = "copy"; context.drawImage(images.body, 0, 0);
    } finally { context.restore(); }
    for (const id of ["eye-0", "eye-1"]) {
      const part = parts[id]; context.save();
      try {
        attributeAttackBodyTransform(context, pose); context.translate(...part.pivot);
        context.scale(1 / b.sx, Math.max(.14, b.blink) / b.sy); context.translate(-part.pivot[0], -part.pivot[1]);
        context.drawImage(images[id], 0, 0);
      } finally { context.restore(); }
    }
    for (const id of ["foliage-left", "foliage-right"]) {
      const part = parts[id], state = pose.parts[id], mesh = meshes[id]; context.save();
      try {
        attributeAttackBodyTransform(context, pose); context.translate(part.pivot[0] + state.x, part.pivot[1] + state.y);
        context.rotate(state.angle); context.scale(state.sx * state.projection, state.sy); context.translate(-part.pivot[0], -part.pivot[1]);
        if (!state.bend) context.drawImage(images[id], ...part.imageOrigin);
        else for (const ids of mesh.triangles)
          triangle(context, images[id], ids.map(i => mesh.vertices[i].uv), ids.map(i => mapped[id][i]));
      } finally { context.restore(); }
    }
    for (const id of ["foot-0", "foot-1"]) context.drawImage(images[id], 0, 0);
    return true;
  } catch { return false; }
  finally { context.restore(); }
}
