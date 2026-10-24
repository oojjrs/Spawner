const fs = require('node:fs');
const sharp = require('C:/Users/oojjr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const width = 400, height = 240;
const leaf = [['M', [198, 160]], ['C', [185, 149], [176, 117], [155, 94]],
  ['C', [131, 66], [102, 51], [77, 56]], ['C', [51, 59], [39, 77], [45, 98]],
  ['C', [52, 124], [80, 143], [114, 148]], ['C', [149, 154], [178, 150], [198, 160]], ['Z']];
const vein = [['M', [194, 155]], ['C', [161, 120], [120, 91], [64, 81]]];
const highlight = [['M', [60, 75]], ['C', [80, 61], [120, 67], [146, 93]],
  ['C', [115, 79], [85, 72], [60, 75]], ['Z']];
const rim = [['M', [50, 87]], ['C', [48, 65], [77, 54], [100, 62]], ['C', [122, 68], [141, 81], [156, 100]]];
function path(commands, progress, mirrored) {
  return commands.map(([verb, ...points]) => verb + points.map(([x, y]) => {
    const distance = Math.max(0, (198 - x) / 155);
    const raised = y - 10.5 * distance * progress - (mirrored ? 3 * distance : 0);
    return (mirrored ? 400 - x : x).toFixed(4) + ' ' + raised.toFixed(4);
  }).join(' ')).join(' ');
}
function drawing(progress) {
  const leaves = [false, true].map(mirrored =>
    '<path d="' + path(leaf, progress, mirrored) + '" fill="url(#' + (mirrored ? 'right' : 'left') + ')" stroke="#0b3b30" stroke-width="8" stroke-linejoin="round"/>' +
    '<path d="' + path(rim, progress, mirrored) + '" fill="none" stroke="#d1e887" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="' + path(vein, progress, mirrored) + '" fill="none" stroke="#71973d" stroke-width="3.4" stroke-linecap="round"/>' +
    '<path d="' + path(highlight, progress, mirrored) + '" fill="#eff6ac"/>').join('');
  const gradients = [false, true].map(mirrored => {
    const shift = (10.5 * progress + (mirrored ? 3 : 0)) * 98 / 155;
    return '<linearGradient id="' + (mirrored ? 'right' : 'left') + '" gradientUnits="userSpaceOnUse" x1="0" y1="' + (55 - shift) + '" x2="0" y2="' + (158 - shift) + '">' +
      '<stop stop-color="#e6f398"/><stop offset=".26" stop-color="#c3e477"/><stop offset=".63" stop-color="#88b75d"/><stop offset="1" stop-color="#28734e"/></linearGradient>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><defs>' + gradients + '</defs>' + leaves + '</svg>';
}
(async () => {
  const referencePath = __dirname + '/neutral-reference.png';
  const original = await sharp(referencePath).ensureAlpha().raw().toBuffer();
  const stem = Buffer.alloc(original.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!((y >= 161 && x >= 180 && x < 220) || (y >= 207 && x >= 155 && x < 245))) continue;
    const offset = (y * width + x) * 4;
    original.copy(stem, offset, offset, offset + 4);
  }
  const stemPng = await sharp(stem, { raw: { width, height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(__dirname + '/fixed-stem.png', stemPng);
  fs.mkdirSync(__dirname + '/frames', { recursive: true });
  const tiles = [], records = [];
  let first = null, fixedDifferences = 0;
  for (let index = 0; index < 16; index++) {
    const progress = index / 15;
    const svg = drawing(progress);
    const raw = await sharp(Buffer.from(svg), { density: 288 }).resize(width, height).ensureAlpha().raw().toBuffer();
    for (let y = 161; y < height; y++) for (let x = 155; x < 245; x++) {
      if (!(y >= 207 || (x >= 180 && x < 220))) continue;
      const offset = (y * width + x) * 4;
      stem.copy(raw, offset, offset, offset + 4);
    }
    if (!first) first = Buffer.from(raw);
    for (let y = 161; y < height; y++) for (let x = 180; x < 220; x++) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel++) if (raw[offset + channel] !== first[offset + channel]) fixedDifferences++;
    }
    const png = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const name = String(index).padStart(3, '0');
    fs.writeFileSync(__dirname + '/frames/' + name + '.png', png);
    fs.writeFileSync(__dirname + '/frames/' + name + '.svg', svg + '\r\n');
    tiles.push({ input: png, left: index % 4 * width, top: Math.floor(index / 4) * height });
    records.push({ index, progress, leftTip: [45, 98 - 10.5 * (198 - 45) / 155 * progress], rightTip: [355, 98 - 3 * (198 - 45) / 155 - 10.5 * (198 - 45) / 155 * progress] });
  }
  if (fixedDifferences) throw new Error('Fixed stem pixels differ');
  await sharp({ create: { width: 1600, height: 960, channels: 4, background: '#00000000' } }).composite(tiles).png().toFile(__dirname + '/nest-stage-01-leaf-steady-sheet.png');
  const metadata = { frameSize: [width, height], columns: 4, frameCount: 16, periodMs: 3960,
    artwork: 'Redrawn leaf contours with coherent veins and highlights; small vertical motion matching the late bean idle.',
    runtimeTransforms: false, opacityBlending: false, fixedStem: { x: 180, y: 161, width: 40, height: 79, differences: fixedDifferences }, frames: records };
  fs.writeFileSync(__dirname + '/animation.json', JSON.stringify(metadata, null, 2).replace(/\n/g, '\r\n') + '\r\n');
  console.log(JSON.stringify({ frames: 16, periodMs: 3960, tipStepPixels: 10.5 * (198 - 45) / 155 / 15, fixedDifferences }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
