const pieces = [
  { polygon: [[-.06, -1], [-.43, -.58], [-.46, -.32], [0, -.48]], vx: -82, vy: -145, spin: -5 },
  { polygon: [[-.06, -1], [.42, -.62], [.48, -.32], [0, -.48]], vx: 87, vy: -160, spin: 5 },
  { polygon: [[-.46, -.32], [-.33, -.04], [-.02, 0], [0, -.48]], vx: -130, vy: -93, spin: -8 },
  { polygon: [[0, -.48], [-.02, 0], [.40, -.08], [.48, -.32]], vx: 136, vy: -100, spin: 8 }
];

function seedSurface(ctx, w, h) {
  const fill = ctx.createLinearGradient(-w * .45, -h * .7, w * .46, -h * .2);
  [[0, "#b17a3e"], [.28, "#e6c27b"], [.52, "#b98043"], [.77, "#d2a05a"], [1, "#85532f"]]
    .forEach(([p, color]) => fill.addColorStop(p, color));
  ctx.beginPath();
  ctx.moveTo(-w * .06, -h);
  ctx.bezierCurveTo(w * .08, -h * .87, w * .48, -h * .63, w * .48, -h * .31);
  ctx.bezierCurveTo(w * .48, -h * .11, w * .20, h * .02, -w * .05, -h * .02);
  ctx.bezierCurveTo(-w * .36, -h * .04, -w * .48, -h * .20, -w * .43, -h * .42);
  ctx.bezierCurveTo(-w * .39, -h * .62, -w * .12, -h * .79, -w * .06, -h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "#4d3e26";
  ctx.lineWidth = Math.max(.6, w * .035);
  ctx.stroke();
  ctx.strokeStyle = "#fff0bd70";
  ctx.lineWidth = Math.max(.5, w * .03);
  ctx.beginPath();
  ctx.moveTo(-w * .12, -h * .79);
  ctx.bezierCurveTo(-w * .29, -h * .54, -w * .37, -h * .33, -w * .21, -h * .15);
  ctx.stroke();
  ctx.strokeStyle = "#78502d99";
  ctx.lineWidth = Math.max(.4, w * .018);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-w * .02, -h * .82);
    ctx.bezierCurveTo(side * w * .26, -h * .61, side * w * .29, -h * .32, side * w * .13, -h * .12);
    ctx.stroke();
  }
  ctx.strokeStyle = "#654329";
  ctx.lineWidth = Math.max(.6, w * .037);
  ctx.beginPath();
  ctx.moveTo(-w * .04, -h * .93);
  ctx.bezierCurveTo(w * .09, -h * .61, -w * .05, -h * .27, -w * .02, -h * .08);
  ctx.stroke();
}

export function drawBirthSeed(ctx, x, floor, cell, motion) {
  const w = cell * .24, h = w * 1.42;
  const support = Math.hypot(w * .48 * motion.seedScaleX * Math.sin(motion.seedAngle),
    h * .50 * motion.seedScaleY * Math.cos(motion.seedAngle));
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.translate(x, floor - support - motion.seedLift * cell);
  ctx.rotate(motion.seedAngle);
  ctx.scale(motion.seedScaleX, motion.seedScaleY);
  ctx.translate(0, h * .5);
  seedSurface(ctx, w, h);
  if (motion.elapsed >= 2.50) {
    ctx.strokeStyle = "#443425";
    ctx.lineWidth = Math.max(.7, w * .044);
    ctx.beginPath();
    ctx.moveTo(-w * .05, -h * .94);
    for (const [px, py] of [[.10, -.66], [-.08, -.48], [.06, -.25], [0, -.03]]) ctx.lineTo(px * w, py * h);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBirthFragments(ctx, x, floor, cell, age) {
  if (age < 0 || age >= .74) return;
  const w = cell * .24, h = w * 1.42, scale = w / 46;
  for (const piece of pieces) {
    const dy = piece.vy * age * scale + 240 * age * age * scale;
    const p = Math.max(0, Math.min(1, (age - .40) / .34));
    ctx.save();
    ctx.translate(x + piece.vx * age * scale, Math.min(floor - h * .18, floor - h * .5 + dy));
    ctx.rotate(piece.spin * age);
    ctx.translate(0, h * .5);
    ctx.globalAlpha *= 1 - p * p * (3 - 2 * p);
    ctx.beginPath();
    piece.polygon.forEach(([px, py], index) => {
      if (index === 0) ctx.moveTo(px * w, py * h);
      else ctx.lineTo(px * w, py * h);
    });
    ctx.closePath();
    ctx.clip();
    seedSurface(ctx, w, h);
    ctx.restore();
  }
}

export function drawBirthImpact(ctx, x, floor, cell, age, strength) {
  if (age < 0 || age > .26) return;
  const p = age / .26;
  ctx.save();
  ctx.globalAlpha *= (1 - p) * strength;
  ctx.strokeStyle = "#d5c596";
  ctx.lineWidth = Math.max(.5, cell * .007);
  ctx.beginPath();
  ctx.ellipse(x, floor + cell * .008, cell * (.07 + p * .16), cell * (.02 + p * .04), 0, 0, Math.PI * 2);
  ctx.stroke();
  if (strength > .35) {
    ctx.fillStyle = "#dbc28e";
    for (let i = 0; i < 8; i++) {
      const d = cell * (.04 + i * .016) * (1 + p * 1.6);
      ctx.beginPath();
      ctx.ellipse(x + (i % 2 ? 1 : -1) * d, floor - Math.sin(p * Math.PI) * cell * (.025 + i % 3 * .02),
        Math.max(.1, cell * .011 * (1 - p)), Math.max(.1, cell * .009 * (1 - p)), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
