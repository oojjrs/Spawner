import { imageAnimation, imageScale } from "./image-geometry.mjs";
import { SPORE_BIRTH_DURATIONS, SPORE_BIRTH_DURATION, SPRING_BIRTH_DURATIONS, SPRING_BIRTH_DURATION, PEBBLE_BIRTH_DURATIONS, PEBBLE_BIRTH_DURATION } from "../server/birth.mjs";

export const SPORE_BIRTH_ANIMATION = Object.freeze(imageAnimation({
  image: "DesignAssets/Tribes/spore/AnimationStudies/birth-size-v3/birth.webp",
  nest: "DesignAssets/Tribes/spore/AnimationStudies/birth-size-v3/nest-stationary.png",
  frameSize: 576, columns: 4, frameCount: 22, pivotX: 400, pivotY: 500,
  unitHeight: 179, detachAt: .82, contactAt: 1.46, firstUnitFrame: 9,
  nestBounds: Object.freeze({ x: 37, y: 77, width: 459, height: 344 }),
  duration: SPORE_BIRTH_DURATION, durationsMs: SPORE_BIRTH_DURATIONS
}));

export function sporeBirthPlacement(elapsed, outlet, target, height) {
  const animation = SPORE_BIRTH_ANIMATION;
  if (elapsed < 0 || elapsed >= animation.duration) return null;
  let end = 0, frame = animation.frameCount - 1;
  for (let index = 0; index < animation.frameCount; index++) {
    end += animation.durationsMs[index] / 1000;
    if (elapsed + 1e-9 < end) { frame = index; break; }
  }
  const age = Math.max(0, Math.min(1, (elapsed - animation.detachAt) / (animation.contactAt - animation.detachAt)));
  const progress = age * age * (3 - 2 * age);
  const rootX = outlet.x + (target.x - outlet.x) * progress;
  const rootY = outlet.y + (target.y - outlet.y) * progress;
  return { frame, rootX, rootY, scale: height / (animation.unitHeight * imageScale(animation.image)), unitVisible: elapsed >= animation.detachAt };
}

export function sporeBirthPixels(scene, nest) {
  const pixels = new Uint8ClampedArray(scene.length);
  for (let index = 0; index < scene.length; index += 4) {
    if (scene[index] === nest[index] && scene[index + 1] === nest[index + 1] &&
        scene[index + 2] === nest[index + 2] && scene[index + 3] === nest[index + 3]) continue;
    const alpha = nest[index + 3] === 255 ? 255 :
      Math.max(0, Math.min(255, (scene[index + 3] - nest[index + 3]) * 255 / (255 - nest[index + 3])));
    if (alpha <= 0) continue;
    pixels[index + 3] = alpha;
    for (let channel = 0; channel < 3; channel++) pixels[index + channel] =
      (scene[index + channel] * scene[index + 3] - nest[index + channel] * nest[index + 3] * (1 - alpha / 255)) / alpha;
  }
  return pixels;
}

export const SPRING_BIRTH_ANIMATION = Object.freeze(imageAnimation({
  image: "DesignAssets/Tribes/spring/AnimationStudies/birth-detach-v1/birth-unit.webp",
  frameSize: 512, columns: 4, frameCount: 13, pivotX: 320, pivotY: 448,
  outletX: 86, outletY: 105, height: 224, detachAt: .53, contactAt: .79,
  duration: SPRING_BIRTH_DURATION, durationsMs: SPRING_BIRTH_DURATIONS
}));

export function springBirthPlacement(elapsed, outlet, target, height) {
  if (elapsed < 0 || elapsed >= SPRING_BIRTH_DURATION) return null;
  const animation = SPRING_BIRTH_ANIMATION;
  let end = 0, frame = animation.frameCount - 1;
  for (let index = 0; index < animation.durationsMs.length; index++) {
    end += animation.durationsMs[index] / 1000;
    if (elapsed + 1e-9 < end) { frame = index; break; }
  }
  const scale = height / animation.height;
  const startX = outlet.x - animation.outletX * scale;
  const startY = outlet.y - animation.outletY * scale;
  const endX = target.x - animation.pivotX * scale;
  const endY = target.y - animation.pivotY * scale;
  const progress = Math.max(0, Math.min(1, (elapsed - animation.detachAt) / (animation.contactAt - animation.detachAt)));
  const x = startX + (endX - startX) * progress;
  const y = startY + (endY - startY) * progress * progress;
  return { frame, x, y, scale, rootX: x + animation.pivotX * scale, rootY: y + animation.pivotY * scale };
}

export const PEBBLE_BIRTH_ANIMATION = Object.freeze(imageAnimation({
  image: "DesignAssets/Tribes/pebble/AnimationStudies/birth-den-v1/birth-unit.webp",
  foreground: "DesignAssets/Tribes/pebble/AnimationStudies/birth-den-v1/birth-foreground.png",
  frameSize: 512, columns: 8, frameCount: 48, pivotX: 256, pivotY: 460,
  outletX: 256, outletY: 460, height: 229, unitHeight: 229, unitPivotY: 460,
  detachAt: .12, contactAt: 1.48, audioAt: .25,
  nestOutletX: .5, nestOutletY: .82,
  duration: PEBBLE_BIRTH_DURATION, durationsMs: PEBBLE_BIRTH_DURATIONS
}));

export function pebbleBirthPlacement(elapsed, outlet, target, height) {
  const animation = PEBBLE_BIRTH_ANIMATION;
  if (elapsed < 0 || elapsed >= animation.duration) return null;
  let end = 0, frame = animation.frameCount - 1;
  for (let index = 0; index < animation.durationsMs.length; index++) {
    end += animation.durationsMs[index] / 1000;
    if (elapsed + 1e-9 < end) { frame = index; break; }
  }
  const scale = height / animation.height;
  const startX = outlet.x - animation.outletX * scale;
  const startY = outlet.y - animation.outletY * scale;
  const endX = target.x - animation.pivotX * scale;
  const endY = target.y - animation.pivotY * scale;
  const progress = Math.max(0, Math.min(1, (elapsed - animation.detachAt) / (animation.contactAt - animation.detachAt)));
  const horizontal = progress * progress * (3 - 2 * progress);
  const x = startX + (endX - startX) * horizontal;
  const y = startY + (endY - startY) * horizontal;
  return { frame, x, y, scale, rootX: x + animation.pivotX * scale, rootY: y + animation.pivotY * scale };
}

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
