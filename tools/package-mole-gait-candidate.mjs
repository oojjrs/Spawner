// Packaging only: preserve generated RGBA and use one scale for all cells.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url), { createCanvas, loadImage } = require('@napi-rs/canvas');
const base = 'AnimationCandidates/mole-smooth-arm-v2-20261106/mole-grounded-walk-v3';
const source = process.argv[2] || base + '-source.png';
if (createHash('sha256').update(readFileSync(source)).digest('hex') !== 'b8859e670cbf14aa95be2f17dff6bc196120c8f742eef1025c489602f9af2898') throw new Error('Source does not match the approved image');
if (source !== base + '-source.png') copyFileSync(source, base + '-source.png');
const image = await loadImage(source), size = 512, sheet = createCanvas(size * 4, size * 2), sc = sheet.getContext('2d'), rows = [], files = [];
for (let f = 0; f < 8; f++) {
  const x0 = Math.round(f % 4 * image.width / 4), x1 = Math.round((f % 4 + 1) * image.width / 4);
  const y0 = Math.round(Math.floor(f / 4) * image.height / 2), y1 = Math.round((Math.floor(f / 4) + 1) * image.height / 2);
  const cv = createCanvas(size, size), ctx = cv.getContext('2d');
  const dx = Math.floor((size - (x1 - x0)) / 2), dy = Math.floor((size - (y1 - y0)) / 2);
  ctx.drawImage(image, x0, y0, x1 - x0, y1 - y0, dx, dy, x1 - x0, y1 - y0);
  const pixels = ctx.getImageData(0, 0, size, size).data;
  let l = size, t = size, r = -1, b = -1, edge = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const a = pixels[(y * size + x) * 4 + 3];
    if (!x || !y || x === size - 1 || y === size - 1) edge = Math.max(edge, a);
    if (a >= 16) { l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x); b = Math.max(b, y); }
  }
  const file = base + '-frame-' + String(f).padStart(2, '0') + '.png';
  writeFileSync(file, cv.toBuffer('image/png')); files.push(file);
  sc.drawImage(cv, f % 4 * size, Math.floor(f / 4) * size);
  rows.push({ frame: f, sourceRect: [x0, y0, x1 - x0, y1 - y0], destination: [dx, dy], boundsAtAlpha16: [l, t, r + 1, b + 1], edgeAlpha: edge,
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
}
writeFileSync(base + '-sheet.png', sheet.toBuffer('image/png'));
execFileSync('magick', ['-dispose', 'background', '-delay', '8', ...files, '-loop', '0', base + '-preview.gif']);
execFileSync('magick', ['-dispose', 'background', '-delay', '8', ...files, '-loop', '0', '-define', 'webp:lossless=true', base + '-preview.webp']);
const manifest = { status: 'approved-source-art', publication: base + '-publication.json', species: 'soil-mole', sourceTool: 'built-in image_gen',
  sourceImage: base + '-source.png', sheetImage: base + '-sheet.png', previewGif: base + '-preview.gif', previewWebp: base + '-preview.webp',
  sourceImageSHA256: createHash('sha256').update(readFileSync(source)).digest('hex'),
  frameSize: size, columns: 4, frameCount: 8, durationMs: 640, durationsMs: Array(8).fill(80), loop: true,
  reference: 'AnimationCandidates/mole-smooth-arm-v2-20261106/Source/neutral.png',
  changes: 'New whole-body key poses with a longer planted near-forepaw sweep, lifted recovery, and an opposite-phase far forepaw. Character silhouette and face use the original reference.',
  packaging: 'Equal source-grid crops, common unit scale, integer centering into 512x512 cells. No per-frame resizing, warping, painted replacements, or alpha cleanup. Generated RGBA preserved; GIF necessarily has palette/alpha limitations.',
  validation: { uniqueFrames: new Set(rows.map(r => r.sha256)).size, allFrameEdgesTransparent: rows.every(r => r.edgeAlpha === 0), packagingOnly: true, noGameplaySpeedChanges: true },
  limitations: 'Review preview uses uniform timing. Production preserves these eight poses with measured nonuniform timing; see the publication manifest for registration, stride, approval and limitations.', frames: rows };
writeFileSync(base + '-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ ...manifest, frames: undefined }, null, 2));
