// Source-owned foliage, body and pod keep the existing authored birth tracks.
// No seed/root scene is baked into this source-space render.
export function drawBeanSecretionBirth(ctx, sprite, head, outline) {
  if (!sprite || sprite.complete === false || (sprite.naturalWidth || sprite.width) !== 512 ||
      (sprite.naturalHeight || sprite.height) !== 512 || !head ||
      ["left", "right"].some(side => !Number.isFinite(head[side + "Rotation"]) ||
        !Number.isFinite(head[side + "ScaleX"] ?? 1) || !((head[side + "ScaleX"] ?? 1) > 0) ||
        !Number.isFinite(head[side + "ScaleY"]) || !(head[side + "ScaleY"] > 0))) return false;
  const neutral = ["left", "right"].every(side => Math.abs(head[side + "Rotation"]) < 1e-12 &&
    Math.abs((head[side + "ScaleX"] ?? 1) - 1) < 1e-12 && Math.abs(head[side + "ScaleY"] - 1) < 1e-12);
  const draw = () => {
    if (outline) outline(sprite, 0, 0, 512, 512);
    ctx.drawImage(sprite, 0, 0);
  };
  // Once both leaves settle, draw the original once. This avoids resampling
  // seams and makes the final source exactly identical to ordinary idle.
  if (neutral) { draw(); return true; }
  const clip = points => {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.clip();
  };
  // The short, original stalk stays behind both leaves. Pivots sit at their
  // source junctions, so rotations cannot drag the intact body or side pod.
  for (const [side, left, right, pivot] of [
    ["left", 0, 262, [257, 295]], ["right", 262, 512, [267, 295]]
  ]) {
    ctx.save();
    ctx.translate(...pivot);
    ctx.rotate(head[side + "Rotation"]);
    ctx.scale(head[side + "ScaleX"] ?? 1, head[side + "ScaleY"]);
    ctx.translate(-pivot[0], -pivot[1]);
    clip([[left, 0], [right, 0], [right, 301], [left, 301]]);
    draw();
    ctx.restore();
  }
  ctx.save();
  clip([[0, 301], [253, 301], [253, 286], [271, 286], [271, 301], [512, 301], [512, 512], [0, 512]]);
  draw();
  ctx.restore();
  return true;
}
