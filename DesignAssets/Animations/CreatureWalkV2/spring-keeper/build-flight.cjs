const fs = require('node:fs');
const sharp = require('C:/Users/oojjr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const folder = __dirname;
const order = [8,9,10,11,0,1,2,3,4,5,6,7,12,13,14,15];
const lifts = [0,8,28,45,45,47,49,48,45,43,42,44,45,28,8,0];
const durations = [60,60,80,120,...Array(8).fill(80),...Array(4).fill(80)];
(async () => {
  const frames = [];
  for (const [index, source] of order.entries()) {
    const file = folder + '/Source/flight-v2/normalized/' + String(source).padStart(2, '0') + '.png';
    frames.push(await sharp(file).extract({ left: 0, top: lifts[index], width: 512, height: 512 - lifts[index] })
      .extend({ top: 0, bottom: lifts[index], left: 0, right: 0, background: '#00000000' }).png().toBuffer());
  }
  await sharp({ create: { width: 2048, height: 2048, channels: 4, background: '#00000000' } })
    .composite(frames.map((input, index) => ({ input, left: index % 4 * 512, top: Math.floor(index / 4) * 512 })))
    .webp({ lossless: true, effort: 4 }).toFile(folder + '/walk.webp');
  for (const [name, size] of [['preview.webp',256],['thumb.webp',64]]) {
    const raw = Buffer.concat(await Promise.all(frames.map(frame => sharp(frame).resize(size,size).ensureAlpha().raw().toBuffer())));
    await sharp(raw, { raw: { width: size, height: size * 16, channels: 4, pageHeight: size } })
      .webp({ lossless: true, loop: 0, delay: durations, effort: 4 }).toFile(folder + '/' + name);
  }
})();
