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

async function resizedFrames(size) {
  const resized = await Promise.all(metadata.frames.map(file =>
    sharp(path.join(folder, file)).resize(size, size).ensureAlpha().raw().toBuffer()
  ));
  const frames = [], durations = [];
  for (let index = 0; index < resized.length; index++) {
    const frame = resized[index];
    for (let pixel = 0; pixel < frame.length; pixel += 4) {
      if (frame[pixel + 3] === 0) frame[pixel] = frame[pixel + 1] = frame[pixel + 2] = 0;
    }
    if (frames.length && frames.at(-1).equals(frame)) durations[durations.length - 1] += metadata.durationsMs[index];
    else { frames.push(frame); durations.push(metadata.durationsMs[index]); }
  }
  return { pixels: Buffer.concat(frames), frameCount: frames.length, durations };
}

const [thumbnail, gif] = await Promise.all([resizedFrames(64), resizedFrames(320)]);
let elapsedMs = 0, previousGifEnd = 0;
const gifDurations = gif.durations.map(duration => {
  elapsedMs += duration;
  const end = Math.round(elapsedMs / 10) * 10;
  const delay = end - previousGifEnd;
  previousGifEnd = end;
  return delay;
});
await Promise.all([
  sharp(path.join(folder, 'idle.png')).webp({ lossless: true, effort: 5 }).toFile(path.join(folder, 'idle.webp')),
  sharp(strip, input).webp({ lossless: true, effort: 4, loop: 0, delay: metadata.durationsMs }).toFile(path.join(folder, 'idle-preview.webp')),
  sharp(thumbnail.pixels, { raw: { width: 64, height: thumbnail.frameCount * 64, channels: 4, pageHeight: 64 } })
    .webp({ lossless: true, effort: 5, loop: 0, delay: thumbnail.durations }).toFile(path.join(folder, 'idle-thumbnail.webp')),
  sharp(gif.pixels, { raw: { width: 320, height: gif.frameCount * 320, channels: 4, pageHeight: 320 } })
    .gif({ loop: 0, delay: gifDurations, effort: 7, colours: 256, dither: 0, keepDuplicateFrames: true }).toFile(path.join(folder, 'idle-preview.gif'))
]);
for (const [file, size, count] of [['idle-preview.gif', 320, gif.frameCount], ['idle-thumbnail.webp', 64, thumbnail.frameCount]]) {
  const result = await sharp(path.join(folder, file), { animated: true }).metadata();
  if (result.pages !== count || result.width !== size || result.pageHeight !== size ||
      result.delay.reduce((sum, duration) => sum + duration, 0) !== metadata.durationMs) {
    throw new Error('Animation export contract mismatch: ' + file);
  }
}
await copyFile(path.join(folder, 'idle-thumbnail.webp'), path.resolve(folder, '../../../UnitPreviews/cotton-sheep/idle-calm-v5.webp'));
console.log(JSON.stringify({ frames: metadata.frameCount, durationMs: metadata.durationMs }));
