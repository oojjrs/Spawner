import { readFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const sharp = createRequire(import.meta.url)(process.argv[2]);
const folder = path.dirname(fileURLToPath(import.meta.url));
const metadata = JSON.parse(await readFile(path.join(folder, 'idle.json'), 'utf8'));
const composites = await Promise.all(metadata.frames.map(async (file, index) => ({
  input: await readFile(path.join(folder, file)), left: 0, top: index * 512
})));
const strip = await sharp({ create: {
  width: 512, height: metadata.frameCount * 512, channels: 4, background: '#00000000'
} }).composite(composites).raw().toBuffer();
const input = { raw: { width: 512, height: metadata.frameCount * 512, channels: 4, pageHeight: 512 } };
await Promise.all([
  sharp(path.join(folder, 'idle.png')).webp({ lossless: true, effort: 5 }).toFile(path.join(folder, 'idle.webp')),
  sharp(strip, input).webp({ lossless: true, effort: 4, loop: 0, delay: metadata.durationsMs }).toFile(path.join(folder, 'idle-preview.webp'))
]);
await Promise.all([
  sharp(path.join(folder, 'idle-preview.webp'), { animated: true }).resize(64).webp({ lossless: true, effort: 5 }).toFile(path.join(folder, 'idle-thumbnail.webp')),
  sharp(path.join(folder, 'idle-preview.webp'), { animated: true }).resize(256).gif({ effort: 7, colours: 256, dither: 0 }).toFile(path.join(folder, 'idle-preview.gif'))
]);
const thumbnail = path.resolve(folder, '../../../UnitPreviews/bubble-toad/idle.webp');
await copyFile(path.join(folder, 'idle-thumbnail.webp'), thumbnail);
console.log(JSON.stringify({ atlas: 'idle.webp', preview: 'idle-preview.webp', frames: metadata.frameCount, durationMs: metadata.durationMs }));
