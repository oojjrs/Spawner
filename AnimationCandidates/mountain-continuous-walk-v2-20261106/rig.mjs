// Isolated art rig only. This module is not imported by the game.
// One continuous painted limb per leg, with fixed shoulder and a rigid toe pad.
export { CONFIG, SOURCE_PIXELS_PER_CELL, CYCLES_PER_CELL, PERIOD } from '../mountain-layer-walk-20261106/rig.mjs';
import { footPose as previousFootPose } from '../mountain-layer-walk-20261106/rig.mjs';
export const LEGS = [
  { name: 'far hind', root: [365, 340], foot: [367, 415], offset: .5, width: 74, far: true, hind: true },
  { name: 'far front', root: [113, 335], foot: [84, 423], offset: .75, width: 88, far: true },
  { name: 'near hind', root: [418, 344], foot: [430, 425], offset: 0, width: 90, hind: true },
  { name: 'near front', root: [280, 348], foot: [261, 443], offset: .25, width: 102 },
];
export const PAWS = {
  front: { rect: [236, 174, 494, 547], sole: [469, 719], center: 520, rootY: 290, rigidY: 535 },
  hind: { rect: [1178, 76, 550, 644], sole: [1440, 719], center: 1460, rootY: 235, rigidY: 535 },
};
export function bodyPose(phase) { return { bob: Math.cos(phase * Math.PI * 8) * 3, angle: 0 }; }
export function footPose(phase, leg) { return previousFootPose(phase, leg); }
const clamp = value => Math.max(0, Math.min(1, value));
export function world(x, y, leg, pose) {
  const part = PAWS[leg.hind ? 'hind' : 'front'];
  const scale = leg.width / part.rect[2], angle = pose.angle;
  const rigid = (sx, sy) => {
    const ox = (sx - part.sole[0]) * scale, oy = (sy - part.sole[1]) * scale;
    return [pose.x + ox * Math.cos(angle) - oy * Math.sin(angle), pose.y + ox * Math.sin(angle) + oy * Math.cos(angle)];
  };
  const originalRoot = rigid(part.center, part.rootY), point = rigid(x, y);
  const q = clamp((y - part.rootY) / (part.rigidY - part.rootY));
  const weight = 1 - q * q * (3 - 2 * q);
  return [point[0] + (pose.root[0] - originalRoot[0]) * weight, point[1] + (pose.root[1] - originalRoot[1]) * weight];
}
export function drawLeg(ctx, art, leg, pose) {
  const part = PAWS[leg.hind ? 'hind' : 'front'], [x, y, w, h] = part.rect;
  const rows = [y, part.rootY, ...Array.from({ length: 24 }, (_, i) => part.rootY + (part.rigidY - part.rootY) * (i + 1) / 24), y + h];
  for (let i = 0; i < rows.length - 1; i++) {
    const source = [[x, rows[i]], [x + w, rows[i]], [x + w, rows[i + 1]], [x, rows[i + 1]]];
    const destination = source.map(([sx, sy]) => world(sx, sy, leg, pose));
    for (const tri of [[0, 1, 2], [0, 2, 3]]) ctx.drawTriangle(art.paws, tri.map(j => source[j]), tri.map(j => destination[j]));
  }
}
export function drawRig(ctx, art, phase, { onlyLeg = null, bodyOnly = false } = {}) {
  const feet = LEGS.map(leg => footPose(phase, leg)), bob = bodyPose(phase).bob;
  if (onlyLeg !== null) { drawLeg(ctx, art, LEGS[onlyLeg], feet[onlyLeg]); return feet; }
  if (bodyOnly) { ctx.drawImage(art.body, 0, bob, 512, 512); return feet; }
  for (let i = 0; i < 4; i++) if (LEGS[i].far) drawLeg(ctx, art, LEGS[i], feet[i]);
  ctx.drawImage(art.body, 0, bob, 512, 512);
  for (let i = 0; i < 4; i++) if (!LEGS[i].far) drawLeg(ctx, art, LEGS[i], feet[i]);
  ctx.drawImage(art.occluder, 0, bob, 512, 512);
  return feet;
}
