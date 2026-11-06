import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';
import { LEGS, PAWS, bodyPose, footPose, world } from './rig.mjs';
const here = path.dirname(new URL(import.meta.url).pathname);
export const art = {};
for (const [key, file] of Object.entries({ paws: 'lower-paws-source.png', body: 'body-source.png', occluder: 'shell-occluder.png' })) {
  const bytes = await fs.readFile(path.join(here, file));
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  art[key] = { data, w: info.width, h: info.height, png: bytes };
}
const weight = (y, part) => {
  const q = Math.max(0, Math.min(1, (y - part.rootY) / (part.rigidY - part.rootY)));
  return 1 - q * q * (3 - 2 * q);
};
export async function renderLeg(phase, index) {
  const leg = LEGS[index], pose = footPose(phase, leg), part = PAWS[leg.hind ? 'hind' : 'front'];
  const [sx, sy, sw, sh] = part.rect, scale = leg.width / sw, cos = Math.cos(pose.angle), sin = Math.sin(pose.angle);
  const ox = (part.center - part.sole[0]) * scale, oy = (part.rootY - part.sole[1]) * scale;
  const dx = pose.root[0] - pose.x - cos * ox + sin * oy, dy = pose.root[1] - pose.y - sin * ox - cos * oy;
  const localXDelta = dx * cos + dy * sin, localYDelta = dy * cos - dx * sin;
  const projectY = y => scale * (y - part.sole[1]) + localYDelta * weight(y, part);
  const yMin = projectY(sy), yMax = projectY(sy + sh), precision = 32;
  const inverse = new Float64Array(Math.ceil((yMax - yMin) * precision) + 2);
  for (let i = 0; i < inverse.length; i++) {
    const target = yMin + i / precision; let low = sy, high = sy + sh;
    for (let k = 0; k < 24; k++) { const mid = (low + high) / 2; if (projectY(mid) < target) low = mid; else high = mid; }
    inverse[i] = (low + high) / 2;
  }
  const bounds = [];
  for (let y = sy; y <= sy + sh; y += 2) for (const x of [sx, sx + sw]) bounds.push(world(x, y, leg, pose));
  const minX = Math.max(0, Math.floor(Math.min(...bounds.map(v => v[0])) + 63));
  const maxX = Math.min(640, Math.ceil(Math.max(...bounds.map(v => v[0])) + 65));
  const minY = Math.max(0, Math.floor(Math.min(...bounds.map(v => v[1])) + 63));
  const maxY = Math.min(640, Math.ceil(Math.max(...bounds.map(v => v[1])) + 65));
  const out = Buffer.alloc(640 * 640 * 4), source = art.paws;
  // Four inverse-mapped samples per output pixel avoid triangle seams or skin cuffs.
  for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
    const sum = [0, 0, 0, 0];
    for (const subY of [.25, .75]) for (const subX of [.25, .75]) {
      const px = x + subX - 64 - pose.x, py = y + subY - 64 - pose.y;
      const projectedY = cos * py - sin * px, lut = (projectedY - yMin) * precision;
      if (lut < 0 || lut >= inverse.length - 1) continue;
      const lo = Math.floor(lut), fy = lut - lo, sourceY = inverse[lo] * (1 - fy) + inverse[lo + 1] * fy;
      const sourceX = part.sole[0] + (cos * px + sin * py - localXDelta * weight(sourceY, part)) / scale;
      if (sourceX < sx || sourceX >= sx + sw - 1 || sourceY < sy || sourceY >= sy + sh - 1) continue;
      const ix = Math.floor(sourceX), iy = Math.floor(sourceY), fx = sourceX - ix, yy = sourceY - iy;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const factor = (i ? fx : 1 - fx) * (j ? yy : 1 - yy), offset = ((iy + j) * source.w + ix + i) * 4, a = source.data[offset + 3] * factor / 4;
        sum[3] += a; for (let c = 0; c < 3; c++) sum[c] += source.data[offset + c] * a;
      }
    }
    const dest = (y * 640 + x) * 4;
    if (sum[3]) for (let c = 0; c < 3; c++) out[dest + c] = Math.round(sum[c] / sum[3]);
    out[dest + 3] = Math.round(sum[3]);
  }
  return sharp(out, { raw: { width: 640, height: 640, channels: 4 } }).png().toBuffer();
}
async function bodyLayer(phase, key) {
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><image x="64" y="${64 + bodyPose(phase).bob}" width="512" height="512" href="data:image/png;base64,${art[key].png.toString('base64')}"/></svg>`)).png().toBuffer();
}
export async function renderRig(phase, { onlyLeg = null, bodyOnly = false } = {}) {
  if (onlyLeg !== null) return renderLeg(phase, onlyLeg);
  const body = await bodyLayer(phase, 'body'); if (bodyOnly) return body;
  const legs = await Promise.all(LEGS.map((_, i) => renderLeg(phase, i)));
  return sharp({ create: { width: 640, height: 640, channels: 4, background: '#00000000' } }).composite([
    ...legs.filter((_, i) => LEGS[i].far).map(input => ({ input })), { input: body },
    ...legs.filter((_, i) => !LEGS[i].far).map(input => ({ input })), { input: await bodyLayer(phase, 'occluder') },
  ]).png().toBuffer();
}
