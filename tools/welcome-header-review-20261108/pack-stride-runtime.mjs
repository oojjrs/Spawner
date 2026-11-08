// Preserve the native 640px authored cells, but retain the established runtime
// atlas sizes so two welcome creatures do not add ~180 MB of decoded images.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const directory = new URL('./', import.meta.url);
const root = new URL('../../', directory);
const fits = JSON.parse(await fs.readFile(new URL('stride-registration-fit.json', directory), 'utf8'));
const manifest = JSON.parse(await fs.readFile(new URL('stride-assets-manifest.json', directory), 'utf8'));
const policy = JSON.parse(await fs.readFile(new URL('stride-image-policy-items.json', directory), 'utf8'));
const definitions = {
  'white-paw': { frameSize: 248, viewSize: 228.92307692307693, pivotX: 120.82051282051282, pivotY: 205.87179487179486 },
  'shadow-weasel': { frameSize: 229, viewSize: 176.45169082125602, pivotX: 111.18115886714976, pivotY: 193.59903492270533 }
};
for (const [key, geometry] of Object.entries(definitions)) {
  const fit = fits[key], atlas = await loadImage(new URL(key + '-stride-candidate.png', directory).pathname);
  const size = geometry.frameSize, packed = createCanvas(size * 8, size * 8), context = packed.getContext('2d');
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  for (let index = 0; index < 64; index++) {
    const x = index % 8 * size, y = Math.floor(index / 8) * size;
    context.save(); context.beginPath(); context.rect(x, y, size, size); context.clip();
    context.drawImage(atlas, index % 8 * 640, Math.floor(index / 8) * 640, 640, 640,
      x + fit.offset[0], y + fit.offset[1], 640 * fit.scale, 640 * fit.scale);
    context.restore();
  }
  const png = new URL(key + '-stride-runtime.png', directory);
  await fs.writeFile(png, packed.toBuffer('image/png'));
  const destination = new URL(manifest[key].runtime, root);
  execFileSync('magick', [png.pathname, '-define', 'webp:lossless=true', destination.pathname]);
  const sha = createHash('sha256').update(await fs.readFile(destination)).digest('hex');
  manifest[key].runtimeSha256 = sha; manifest[key].runtimeFrameSize = size;
  manifest[key].runtimePixelExact = false;
  manifest[key].runtimeMethod = 'Downsampled from retained native cells with the established runtime camera; lossless WebP encoding of packed pixels.';
  manifest[key].runtimeRegistration = { ...geometry, strideFrameRatio: 187.5 * fit.scale / size };
  policy[manifest[key].runtime] = { display: [size, size], grid: [8, 8] };
  global.gc?.();
}
await fs.writeFile(new URL('stride-assets-manifest.json', directory), JSON.stringify(manifest, null, 2) + '\n');
await fs.writeFile(new URL('stride-image-policy-items.json', directory), JSON.stringify(policy, null, 2) + '\n');
