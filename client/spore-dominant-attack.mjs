import { UNIT_ANIMATIONS, unitAnimationFrame } from "./unit-animation.mjs";

// Horizontal cap yaw: the blade tips sweep from the far side across the target.
// Every rendered pixel remains the approved canonical V7 blade form.
// Rows: cap dx/dy/angle/sx/sy, then each eye dx/dy/sx/sy.
// Source audit and offline comparison: tools/spore-blade-swing-horizontal-20261105/.
const MOTION = Object.freeze([
  Object.freeze([0,0,0,1,1,7.061018436615995e-15,1.5987211554602254e-14,1.0,1.0,-1.176836406102666e-14,1.5987211554602254e-14,1.0,1.0]),
  Object.freeze([-8,0,0,0.65,1,10.00578661844486,1.5987211554602254e-14,1.09375,1.0,7.590596745027126,-0.7811934900542195,0.8749999999999999,1.0]),
  Object.freeze([-18,0,0,-0.48,1,19.321518987341786,1.5987211554602254e-14,1.0625,1.0,11.385895117540677,-3.1247739602169684,0.71875,1.0]),
  Object.freeze([-24,0,0,-0.9,1,26.22206148282102,-1.1717902350814011,1.0625,1.0294117647058825,12.075949367088622,-4.687160940325482,0.59375,1.0]),
  Object.freeze([-5,0,0,0.38,1,39.678119349005435,1.5623869801085295,1.09375,0.8235294117647058,22.77179023508137,2.343580470162765,0.43749999999999994,0.8235294117647058]),
  Object.freeze([36,0,0,1.04,1,47.268716094032534,5.077757685352653,1.09375,0.5588235294117647,32.43254972875223,10.155515370705247,0.43749999999999994,0.5882352941176471]),
  Object.freeze([42,0,0,1.08,1,47.268716094032534,5.077757685352653,1.09375,0.5588235294117647,32.43254972875223,10.155515370705247,0.43749999999999994,0.5882352941176471]),
  Object.freeze([38,0,0,1.04,1,47.268716094032534,4.687160940325471,1.09375,0.5882352941176471,31.052441229656413,10.155515370705247,0.375,0.5882352941176471]),
  Object.freeze([30,0,0,0.98,1,47.268716094032534,4.687160940325471,1.09375,0.5882352941176471,31.052441229656413,9.37432188065097,0.375,0.5882352941176471]),
  Object.freeze([18,0,0,0.92,1,45.198553345388774,4.687160940325471,1.09375,0.5882352941176471,31.742495479204358,9.37432188065097,0.5,0.5882352941176471]),
  Object.freeze([5,0,0,0.88,1,42.093309222423166,3.9059674502712785,1.1249999999999998,0.6470588235294118,29.327305605786623,8.983725135623873,0.46875,0.6176470588235294]),
  Object.freeze([-2,0,0,0.88,1,34.50271247739603,2.343580470162765,1.1249999999999998,0.7058823529411765,26.222061482820944,6.249547920433985,0.625,0.7058823529411765]),
  Object.freeze([-5,0,0,0.92,1,22.771790235081404,1.1717902350813478,1.1249999999999998,0.8529411764705883,18.976491862567816,3.1247739602170004,0.78125,0.8235294117647058]),
  Object.freeze([-3,0,0,0.98,1,10.695840867992768,-2.6645352591003757e-14,1.09375,0.9411764705882354,9.315732368896915,1.1717902350813905,0.90625,0.9117647058823529]),
  Object.freeze([0,0,0,1.01,1,2.4151898734177224,1.5987211554602254e-14,1.0312499999999998,1.0,2.4151898734177224,1.5987211554602254e-14,0.9687499999999999,1.0]),
  Object.freeze([0,0,0,1,1,7.061018436615995e-15,1.5987211554602254e-14,1.0,1.0,-1.176836406102666e-14,1.5987211554602254e-14,1.0,1.0]),
]);
const point2 = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);

export function sporeDominantAttackAppearance(tribe, attributes) {
  return tribe === "spore" && attributes?.blade > 0 &&
    !["piercing", "carapace", "antenna", "strength", "arms", "feet", "legs", "secretion"].some(key => attributes[key] > 0);
}

export function prepareSporeDominantAttack(rig, images) {
  try {
    if (rig?.tribe !== "spore" || rig.variant !== "blade" ||
        rig.approvedSource !== "DesignAssets/Concepts/CombatEvolutionV1/spore.png" ||
        rig.canvas?.[0] !== 512 || rig.canvas?.[1] !== 322 ||
        ![rig.root, rig.face, rig.fitOffset].every(point2) || !Number.isFinite(rig.scale) || !(rig.scale > 0)) return null;
    const ids = ["body", "cap-left", "eye-0", "eye-1", "foot-0", "foot-1"];
    const parts = Object.fromEntries(ids.map(id => [id, rig.parts?.find(part => part.id === id)]));
    const sourceImages = Object.fromEntries(ids.map(id => [id,
      ["body", "cap-left"].includes(id) ? images?.["attack-" + id] : images?.[id]]));
    for (const id of ids) {
      const part = parts[id], image = sourceImages[id];
      if (!part || !point2(part.pivot) || !image || image.complete === false ||
          (image.naturalWidth || image.width) !== 512 || (image.naturalHeight || image.height) !== 322) return null;
    }
    // This deformation is registered to this stem and cap, not to arbitrary
    // replacement artwork that happens to have the same nominal dimensions.
    if (Math.abs(rig.root[0] - 211.6836723246339) > .00001 || rig.root[1] !== 318 ||
        Math.abs(parts["cap-left"].pivot[1] - 167.79579854977493) > .00001) return null;
    const vertices = [], triangles = [];
    for (let row = 0; row <= 8; row++) for (let col = 0; col <= 6; col++) vertices.push([110 + col * 34, 170 + row * 18]);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 6; col++) {
      const i = row * 7 + col; triangles.push([i, i + 1, i + 8], [i, i + 8, i + 7]);
    }
    return { rig, parts, images: sourceImages, vertices, triangles, areas: triangles.map(ids => area(...ids.map(i => vertices[i]))) };
  } catch { return null; }
}

export function sampleSporeDominantAttack(prepared, time) {
  try {
    if (!prepared || !Number.isFinite(time) || time < 0 || time > 1000) return null;
    const index = unitAnimationFrame(UNIT_ANIMATIONS.spore.attack, time), motion = MOTION[index];
    if (!motion) return null;
    const { parts, vertices, triangles, areas } = prepared, [dx, dy, angle, sx, sy] = motion;
    const pivot = parts["cap-left"].pivot, cosine = Math.cos(angle), sine = Math.sin(angle);
    const point = ([x, y]) => {
      // Follow the cap root sideways without mirroring the stem. Cap width
      // projects its yaw; keep the neck broad and fade to the planted feet.
      const weight = Math.max(0, Math.min(1, (310 - y) / 105));
      const px = (x - pivot[0]) * Math.max(.7, Math.abs(sx)), py = (y - pivot[1]) * sy;
      const tx = pivot[0] + dx + px * cosine - py * sine, ty = pivot[1] + dy + px * sine + py * cosine;
      return [x + (tx - x) * weight, y + (ty - y) * weight];
    };
    const points = vertices.map(point);
    if (points.some(value => !point2(value))) return null;
    for (let i = 0; i < triangles.length; i++) {
      const ratio = area(...triangles[i].map(index => points[index])) / areas[i];
      if (!Number.isFinite(ratio) || ratio <= .02) return null;
    }
    return { prepared, index, motion, points, neutral: index === 0 || index === 15 };
  } catch { return null; }
}

function drawTriangle(context, image, uv, points) {
  const [a, b, c] = uv, [p, q, r] = points, determinant = area(a, b, c);
  const xx = ((q[0] - p[0]) * (c[1] - a[1]) - (r[0] - p[0]) * (b[1] - a[1])) / determinant;
  const xy = ((r[0] - p[0]) * (b[0] - a[0]) - (q[0] - p[0]) * (c[0] - a[0])) / determinant;
  const yx = ((q[1] - p[1]) * (c[1] - a[1]) - (r[1] - p[1]) * (b[1] - a[1])) / determinant;
  const yy = ((r[1] - p[1]) * (b[0] - a[0]) - (q[1] - p[1]) * (c[0] - a[0])) / determinant;
  const center = points.reduce((sum, value) => [sum[0] + value[0] / 3, sum[1] + value[1] / 3], [0, 0]);
  context.save();
  try {
    context.beginPath();
    points.forEach((value, i) => {
      const x = value[0] - center[0], y = value[1] - center[1], length = Math.hypot(x, y) || 1;
      const vertex = [value[0] + x / length * 1.5, value[1] + y / length * 1.5];
      if (i) context.lineTo(...vertex); else context.moveTo(...vertex);
    });
    context.closePath(); context.clip();
    context.transform(xx, yx, xy, yy, p[0] - xx * a[0] - xy * a[1], p[1] - yx * a[0] - yy * a[1]);
    context.drawImage(image, 0, 0);
  } finally { context.restore(); }
}

export function renderSporeDominantAttack(context, sample) {
  if (!sample) return false;
  const { prepared, motion, points, neutral } = sample;
  const { rig, parts, images, vertices, triangles } = prepared;
  context.save();
  try {
    context.translate(256 + rig.fitOffset[0] * 2, 448 + rig.fitOffset[1] * 2);
    context.scale(rig.scale * 2, rig.scale * 2); context.translate(-rig.root[0], -rig.root[1]);
    if (neutral) context.drawImage(images.body, 0, 0);
    else for (const ids of triangles) drawTriangle(context, images.body, ids.map(i => vertices[i]), ids.map(i => points[i]));
    for (let index = 0; index < 2; index++) {
      const id = "eye-" + index, part = parts[id], offset = 5 + index * 4;
      context.save();
      try {
        context.translate(part.pivot[0] + motion[offset], part.pivot[1] + motion[offset + 1]);
        context.scale(motion[offset + 2], motion[offset + 3]);
        context.translate(-part.pivot[0], -part.pivot[1]); context.drawImage(images[id], 0, 0);
      } finally { context.restore(); }
    }
    const cap = parts["cap-left"];
    context.save();
    try {
      context.translate(cap.pivot[0] + motion[0], cap.pivot[1] + motion[1]);
      context.rotate(motion[2]); context.scale(motion[3], motion[4]);
      context.translate(-cap.pivot[0], -cap.pivot[1]); context.drawImage(images["cap-left"], 0, 0);
    } finally { context.restore(); }
    for (const id of ["foot-0", "foot-1"]) context.drawImage(images[id], 0, 0);
    return true;
  } catch { return false; }
  finally { context.restore(); }
}
