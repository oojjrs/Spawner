import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
let sharp;
try { sharp = createRequire(import.meta.url)('sharp'); }
catch { sharp = createRequire(resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'))('sharp'); }
const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../../../../..');
const rig = JSON.parse(readFileSync(resolve(directory, 'outpost-rig-20261101.json'), 'utf8'));
const width = rig.canvas[0], height = rig.canvas[1], count = rig.frames;
const key = await sharp(resolve(directory, rig.artwork)).ensureAlpha().raw().toBuffer();
const atlas = Buffer.alloc(width * 3 * height * 2 * 4);
for (const part of rig.parts) {
  const pixels = await sharp(resolve(directory, part.source)).ensureAlpha().raw().toBuffer();
  const [left, top, w, h] = part.atlas;
  for (let y = 0; y < h; y++) pixels.copy(atlas, ((top + y) * width * 3 + left) * 4, y * w * 4, (y + 1) * w * 4);
}
writeFileSync(resolve(root, rig.output.parts), await sharp(atlas, { raw: { width: width * 3, height: height * 2, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer());
copyFileSync(resolve(directory, rig.artwork), resolve(root, rig.output.complete));
const frames = [], sheet = Buffer.alloc(width * 8 * height * 6 * 4), light = rig.idle.light;
for (let frame = 0; frame < count; frame++) {
  const pixels = Buffer.from(key), phase = frame / count * Math.PI * 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    if (!key[offset + 3]) continue;
    let amount = 0;
    if (rig.tribe === 'pebble') {
      const dx = (x - light.center[0]) / light.radius[0], dy = (y - light.center[1]) / light.radius[1];
      amount = Math.exp(-(dx * dx + dy * dy) * 2) * Math.pow(Math.sin(phase / 2), 2) * light.strength;
    } else {
      const [cx, cy, rx, ry] = light.pool, radius = Math.hypot((x - cx) / rx, (y - cy) / ry);
      const interior = Math.max(0, Math.min(1, (1 - radius) * 6));
      amount = interior * (Math.sin(radius * light.ringFrequency - phase * light.waves) - Math.sin(radius * light.ringFrequency)) * light.strength;
    }
    for (let channel = 0; channel < 3; channel++) {
      const value = key[offset + channel];
      pixels[offset + channel] = Math.max(0, Math.min(255, Math.round(amount > 0 ? value + (light.tint[channel] - value) * amount : value * (1 + amount))));
    }
  }
  frames.push(pixels);
  const left = frame % 8 * width, top = Math.floor(frame / 8) * height;
  for (let y = 0; y < height; y++) pixels.copy(sheet, ((top + y) * width * 8 + left) * 4, y * width * 4, (y + 1) * width * 4);
}
writeFileSync(resolve(root, rig.output.idle), await sharp(sheet, { raw: { width: width * 8, height: height * 6, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer());
for (const [path, size] of [[rig.output.preview, 192], [rig.output.thumbnail, 96]]) {
  const pages = await Promise.all(frames.map(pixels => sharp(pixels, { raw: { width, height, channels: 4 } }).resize(size, size).ensureAlpha().raw().toBuffer()));
  writeFileSync(resolve(root, path), await sharp(Buffer.concat(pages), { raw: { width: size, height: size * count, channels: 4, pageHeight: size } })
    .webp({ lossless: true, effort: 4, loop: 0, delay: Array(count).fill(rig.frameDuration) }).toBuffer());
}
writeFileSync(resolve(directory, 'outpost-render-output-20261101.json'), JSON.stringify(rig.output, null, 2).replaceAll('\n', '\r\n') + '\r\n');
console.log(JSON.stringify({ tribe: rig.tribe, frames: count, outputs: rig.output }));
