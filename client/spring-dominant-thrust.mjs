import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from "../server/unit-appearance.mjs";
import { springThrustRegisteredPose, springThrustFeatureTip } from "./spring-attachment-thrust.mjs";
import { attributeAttackPose } from "../DesignAssets/Animations/CombatAttributesV7/attack.mjs";

// Current DNA has one canonical blade silhouette. Retired compound bodies
// retain their existing separately registered sockets and motion.
export function springDominantThrustAppearance(tribe, attributes = {}) {
  return tribe === "spring" && attributes.blade > 0 &&
    ![...UNIT_APPEARANCE_LEGACY_VISUAL_KEYS, "secretion", "carapace", "antenna", "feet", "legs"]
      .some(key => attributes[key] > 0);
}

const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const point2 = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

export function springDominantThrustPose(time, rig, sourceTip) {
  if (!Number.isFinite(time) || time < 0 || time > 1000 || !rig ||
      ![rig.root, rig.face, rig.fitOffset, sourceTip].every(point2) || !(rig.scale > 0)) return null;
  const scale = 2 * rig.scale;
  const left = 256 + rig.fitOffset[0] * 2 - rig.root[0] * scale;
  const top = 448 + rig.fitOffset[1] * 2 - rig.root[1] * scale;
  const source = [rig.face[0], rig.face[1] - 70];
  if (!(source[1] > sourceTip[1])) return null;
  const project = p => [left + p[0] * scale, top + p[1] * scale];
  const pose = springThrustRegisteredPose(time, project(source), project(source), project(sourceTip));
  if (!pose) return null;
  const target = [(pose.tip[0] - left) / scale, (pose.tip[1] - top) / scale];
  const vector = sourceTip.map((v, i) => v - source[i]), destination = target.map((v, i) => v - source[i]);
  const originalLength = Math.hypot(...vector), targetLength = Math.hypot(...destination);
  if (!(targetLength > 0)) return null;
  const requestedAngle = Math.atan2(destination[1], destination[0]) - Math.atan2(vector[1], vector[0]);
  const extension = Math.max(0, targetLength - originalLength);
  // Preserve the reviewed narrow-fin limits during preparation. Compressing
  // its neutral length or copying the broad-body bend folds the forehead.
  const angle = Math.min(requestedAngle, .70 + extension / 1000);
  const direction = destination.map(v => v / targetLength);
  const point = ([x, y]) => {
    const weight = smooth((source[1] - y) / (source[1] - sourceTip[1]));
    const turn = angle * weight, c = Math.cos(turn), s = Math.sin(turn);
    const dx = x - source[0], dy = y - source[1];
    return [source[0] + dx * c - dy * s + direction[0] * extension * weight,
      source[1] + dx * s + dy * c + direction[1] * extension * weight];
  };
  return { pose, source, sourceTip, target, angle, extension, point };
}

export function prepareSpringDominantThrust(rig, images, createSurface) {
  try {
    if (rig?.tribe !== "spring" || rig.variant !== "blade" || !images?.body ||
        ![rig.root, rig.face, rig.fitOffset, rig.canvas].every(point2) || !(rig.scale > 0)) return null;
    const body = images.body, width = body.naturalWidth || body.width, height = body.naturalHeight || body.height;
    if (body.complete === false || width !== rig.canvas[0] || height !== rig.canvas[1]) return null;
    const mesh = rig.attackMotion?.meshes?.body, eyes = rig.parts?.filter(part => part.id.startsWith("eye-"));
    if (!mesh?.vertices?.length || !mesh.triangles?.length || eyes?.length !== 2 ||
        eyes.some(part => !point2(part.pivot) || !images[part.id] || images[part.id].complete === false)) return null;
    const points = mesh.vertices.map(vertex => vertex.point || vertex.uv);
    if (points.some(point => !point2(point)) || mesh.vertices.some(vertex => !point2(vertex.uv))) return null;
    if (mesh.triangles.some(ids => !Array.isArray(ids) || ids.length !== 3 || ids.some(index =>
      !Number.isInteger(index) || index < 0 || index >= points.length))) return null;
    const areas = mesh.triangles.map(ids => area(...ids.map(index => points[index])));
    const uvAreas = mesh.triangles.map(ids => area(...ids.map(index => mesh.vertices[index].uv)));
    if (uvAreas.some(value => !Number.isFinite(value) || Math.abs(value) < .00001)) return null;
    if (areas.some(value => !Number.isFinite(value) || Math.abs(value) < .00001)) return null;
    const surface = createSurface(width, height), context = surface.getContext("2d", { willReadFrequently: true });
    context.drawImage(body, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;
    if (pixels?.length !== width * height * 4) return null;
    const tip = springThrustFeatureTip(pixels, width, height);
    if (!tip || !springDominantThrustPose(0, rig, tip)) return null;
    return { rig, images, mesh, points, areas, eyes, tip };
  } catch { return null; }
}

export function sampleSpringDominantThrust(prepared, time) {
  try {
    if (!prepared) return null;
    const { rig, mesh, points, areas, tip } = prepared, mapping = springDominantThrustPose(time, rig, tip);
    if (!mapping) return null;
    const mapped = points.map(mapping.point);
    if (mapped.some(point => !point2(point))) return null;
    // Validate before drawing anything. Unexpected source/mesh registrations
    // retain the old sheet rather than partially rendering a folded candidate.
    for (let i = 0; i < mesh.triangles.length; i++) {
      const ratio = area(...mesh.triangles[i].map(index => mapped[index])) / areas[i];
      if (!Number.isFinite(ratio) || ratio <= .02) return null;
    }
    const blink = attributeAttackPose(rig, time).body.blink;
    if (!Number.isFinite(blink)) return null;
    return { prepared, mapping, points: mapped, blink };
  } catch { return null; }
}

function drawTriangle(context, image, uv, points) {
  const transform = context.getTransform();
  const padding = 1.2 / Math.sqrt(Math.max(.0001, Math.abs(transform.a * transform.d - transform.b * transform.c)));
  const [a, b, c] = uv, [p, q, r] = points, d = area(a, b, c);
  if (Math.abs(d) < .00001) return;
  const xx = ((q[0] - p[0]) * (c[1] - a[1]) - (r[0] - p[0]) * (b[1] - a[1])) / d;
  const xy = ((r[0] - p[0]) * (b[0] - a[0]) - (q[0] - p[0]) * (c[0] - a[0])) / d;
  const yx = ((q[1] - p[1]) * (c[1] - a[1]) - (r[1] - p[1]) * (b[1] - a[1])) / d;
  const yy = ((r[1] - p[1]) * (b[0] - a[0]) - (q[1] - p[1]) * (c[0] - a[0])) / d;
  const center = points.reduce((sum, v) => [sum[0] + v[0] / 3, sum[1] + v[1] / 3], [0, 0]);
  context.save();
  try {
    context.beginPath();
    points.forEach((v, i) => {
      const x = v[0] - center[0], y = v[1] - center[1], n = Math.hypot(x, y) || 1;
      const px = v[0] + x / n * padding, py = v[1] + y / n * padding;
      if (i) context.lineTo(px, py); else context.moveTo(px, py);
    });
    context.closePath(); context.clip();
    context.transform(xx, yx, xy, yy, p[0] - xx * a[0] - xy * a[1], p[1] - yx * a[0] - yy * a[1]);
    context.drawImage(image, 0, 0);
  } finally { context.restore(); }
}

export function renderSpringDominantThrust(context, sample) {
  const { prepared, mapping, points, blink } = sample;
  const { rig, images, mesh, eyes } = prepared;
  context.save();
  try {
    context.translate(256 + rig.fitOffset[0] * 2, 448 + rig.fitOffset[1] * 2);
    context.scale(rig.scale * 2, rig.scale * 2); context.translate(-rig.root[0], -rig.root[1]);
    if (!mapping.angle && !mapping.extension) context.drawImage(images.body, 0, 0);
    else for (const ids of mesh.triangles)
      drawTriangle(context, images.body, ids.map(index => mesh.vertices[index].uv), ids.map(index => points[index]));
    for (const eye of eyes) {
      const pivot = mapping.point(eye.pivot);
      context.save();
      try {
        context.translate(...pivot); context.scale(1, Math.max(.14, blink));
        context.translate(-eye.pivot[0], -eye.pivot[1]); context.drawImage(images[eye.id], 0, 0);
      } finally { context.restore(); }
    }
    // The mesh keeps lower geometry fixed. Restore the exact source AA/support
    // edge too, without changing either the source pixels or the ground pivot.
    context.save();
    try {
      context.beginPath(); context.rect(0, rig.face[1] + 30, rig.canvas[0], rig.canvas[1]); context.clip();
      context.globalCompositeOperation = "copy"; context.drawImage(images.body, 0, 0);
    } finally { context.restore(); }
    return true;
  } catch { return false; }
  finally { context.restore(); }
}
