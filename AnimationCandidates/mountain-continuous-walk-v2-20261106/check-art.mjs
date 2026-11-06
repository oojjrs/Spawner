// Asset-only quality checks. No production module, game runtime, or build is loaded.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';
import { LEGS, PAWS, CONFIG, PERIOD, world, footPose, bodyPose } from './rig.mjs';
import { LEGS as previousLegs, footPose as previousFootPose } from '../mountain-layer-walk-20261106/rig.mjs';
import { renderRig } from './raster-core.mjs';
const here = path.dirname(new URL(import.meta.url).pathname), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let maxFootDifference = 0, maxRootError = 0, minDerivative = Infinity, minSupport = 4;
for (let frame = 0; frame < 2048; frame++) {
  const phase = frame / 2048; let supported = 0;
  for (const [i, leg] of LEGS.entries()) {
    const p = footPose(phase, leg), before = previousFootPose(phase, previousLegs[i]), part = PAWS[leg.hind ? 'hind' : 'front'];
    if (p.support) supported++;
    maxFootDifference = Math.max(maxFootDifference, Math.abs(p.x - before.x), Math.abs(p.y - before.y), Math.abs(p.angle - before.angle));
    const root = world(part.center, part.rootY, leg, p);
    maxRootError = Math.max(maxRootError, Math.hypot(root[0] - leg.root[0], root[1] - leg.root[1] - bodyPose(phase).bob));
    const s = leg.width / part.rect[2], cos = Math.cos(p.angle), sin = Math.sin(p.angle), ox = (part.center - part.sole[0]) * s, oy = (part.rootY - part.sole[1]) * s;
    const dx = p.root[0] - p.x - cos * ox + sin * oy, dy = p.root[1] - p.y - sin * ox - cos * oy, deltaY = dy * cos - dx * sin;
    // The inverse mapping is unique only when this derivative stays positive.
    const derivative = s - Math.max(0, deltaY) * 1.5 / (part.rigidY - part.rootY);
    minDerivative = Math.min(minDerivative, derivative);
  }
  minSupport = Math.min(minSupport, supported);
}
assert.equal(maxFootDifference, 0); assert.ok(maxRootError < 1e-10); assert.ok(minDerivative > 0); assert.ok(minSupport >= 3);
function mask(bytes) { const m = new Uint8Array(bytes.length / 4); for (let i = 0; i < m.length; i++) m[i] = bytes[i * 4 + 3] > 128 ? 1 : 0; return m; }
function componentSizes(input) {
  const m = Uint8Array.from(input), components = [];
  for (let i = 0; i < m.length; i++) if (m[i]) {
    const q = [i]; m[i] = 0;
    for (let n = 0; n < q.length; n++) { const p = q[n], x = p % 640, y = Math.floor(p / 640); for (const j of [x ? p - 1 : -1, x < 639 ? p + 1 : -1, y ? p - 640 : -1, y < 639 ? p + 640 : -1]) if (j >= 0 && m[j]) { m[j] = 0; q.push(j); } }
    if (q.length > 16) components.push(q.length);
  }
  return components.sort((a, b) => b - a);
}
const frames = [], legs = []; let minBodyOverlap = Infinity, maxGroundBelow = 0, maxSupportGap = 0;
for (let n = 0; n < 64; n++) {
  const png = await fs.readFile(path.join(here, 'Frames', `${n}`.padStart(2, '0') + '.png')), rgba = await sharp(png).raw().toBuffer(), m = mask(rgba);
  assert.equal(componentSizes(m).length, 1, `Full frame ${n} disconnected`);
  const fresh = await sharp(await renderRig(n / 64)).raw().toBuffer(); assert.deepEqual(rgba, fresh, `Stale frame ${n}`);
  let edge = 0; for (let x = 0; x < 640; x++) edge = Math.max(edge, m[x], m[639 * 640 + x], m[x * 640], m[x * 640 + 639]); assert.equal(edge, 0);
  const body = mask(await sharp(await renderRig(n / 64, { bodyOnly: true })).raw().toBuffer());
  for (let i = 0; i < 4; i++) {
    const lm = mask(await sharp(await renderRig(n / 64, { onlyLeg: i })).raw().toBuffer()), union = lm.map((v, j) => v || body[j] ? 1 : 0), p = footPose(n / 64, LEGS[i]);
    assert.equal(componentSizes(lm).length, 1, `Leg ${i} frame ${n} internally split`); assert.equal(componentSizes(union).length, 1, `Leg ${i} frame ${n} detached from body`);
    let overlap = 0, maxY = -1; for (let j = 0; j < lm.length; j++) if (lm[j]) { if (body[j]) overlap++; maxY = Math.max(maxY, Math.floor(j / 640)); }
    minBodyOverlap = Math.min(minBodyOverlap, overlap); maxGroundBelow = Math.max(maxGroundBelow, maxY - (LEGS[i].foot[1] + 63));
    if (p.support) maxSupportGap = Math.max(maxSupportGap, p.y + 63 - maxY);
    legs.push({ frame: n, leg: LEGS[i].name, overlapPixels: overlap, support: p.support, soleGap: p.y + 63 - maxY });
  }
  frames.push({ frame: n, sha256: hash(png), connected: true, edgeClear: true });
}
assert.ok(minBodyOverlap > 20); assert.ok(maxGroundBelow < 2); assert.ok(maxSupportGap < 2); assert.equal(new Set(frames.map(f => f.sha256)).size, 64);
for (const file of ['body-source.png', 'lower-paws-source.png', 'shell-occluder.png']) assert.equal(hash(await fs.readFile(path.join(here, file))), hash(await fs.readFile(path.join(here, '../mountain-attached-walk-20261106', file))));
const report = { status: 'unapproved-review-art-only', frameCount: 64, separateLegChecks: 256, minBodyOverlapPixels: minBodyOverlap, maxFootDifferencePixels: maxFootDifference, maxRootErrorPixels: maxRootError, minimumMappingDerivative: minDerivative, minSupportedFeet: minSupport, maxGroundBelowPixels: maxGroundBelow, maxSupportGapPixels: maxSupportGap, periodSeconds: PERIOD, speedCellsPerSecond: CONFIG.speed, sourceImagesUnchanged: true, noProductionChanges: true, frames, legs, limits: ['Continuous skin deforms above the rigid toe pad; this is not a fixed-bone anatomical simulation.', 'Long-stride extension remains visible and requires artistic review.', 'Offline artifact checks do not cover game playback, start/stop, turns, performance, or mobile behavior.'] };
await fs.writeFile(path.join(here, 'art-checks.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, frames: undefined, legs: undefined }));
