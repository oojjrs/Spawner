const fs = require('node:fs');
const sharp = require('C:/Users/oojjr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const width = 400, height = 240;
const leftEdge = [['M', [200, 160]], ['C', [187, 144], [177, 113], [155, 91]],
  ['C', [131, 64], [99, 48], [75, 56]], ['C', [51, 60], [40, 77], [45, 98]],
  ['C', [53, 126], [83, 144], [118, 150]], ['C', [151, 155], [177, 151], [191, 163]]];
const rightEdge = [['C', [177, 151], [151, 155], [118, 150]], ['C', [83, 144], [53, 126], [45, 98]],
  ['C', [40, 77], [51, 60], [75, 56]], ['C', [99, 48], [131, 64], [155, 91]],
  ['C', [177, 113], [187, 144], [200, 160]]];
const stem = 'C190 181 189 204 185 227 Q200 237 215 227 C211 204 210 181 209 163';
const vein = [['M', [195, 158]], ['C', [165, 124], [122, 92], [65, 82]]];
const sheen = [['M', [55, 78]], ['C', [69, 64], [103, 64], [130, 79]],
  ['C', [140, 84], [150, 93], [157, 104]], ['C', [131, 88], [91, 74], [55, 78]], ['Z']];
const secondary = [['M', [70, 66]], ['C', [88, 59], [111, 67], [128, 76]]];
function path(commands, progress, mirrored) {
  return commands.map(([verb, ...points]) => verb + points.map(([x, y]) => {
    const taper = Math.max(0, Math.min(1, (190 - x) / 20));
    const distance = Math.max(0, (198 - x) / 155) * taper * taper * (3 - 2 * taper);
    const raised = y - (13.5 * progress + (mirrored ? 3 : 0)) * distance;
    return (mirrored ? 400 - x : x).toFixed(4) + ' ' + raised.toFixed(4);
  }).join(' ')).join(' ');
}
function drawing(progress) {
  const left = path(leftEdge, progress, false);
  const right = path(rightEdge, progress, true);
  const silhouette = left + stem + right + 'Z';
  const leftBlade = left + 'Q196 166 200 160Z';
  const rightBlade = path(leftEdge, progress, true) + 'Q204 166 200 160Z';
  const gradients = [false, true].map(mirrored => {
    const side = mirrored ? 'right' : 'left';
    const shift = (13.5 * progress + (mirrored ? 3 : 0)) * 98 / 155;
    return '<linearGradient id="' + side + '" gradientUnits="userSpaceOnUse" x1="0" y1="' + (54 - shift) + '" x2="0" y2="' + (161 - shift) + '">' +
      '<stop stop-color="#dceca0"/><stop offset=".25" stop-color="#c5df8b"/><stop offset=".56" stop-color="#99c373"/><stop offset=".85" stop-color="#5b9862"/><stop offset="1" stop-color="#347653"/></linearGradient>';
  }).join('');
  const paints = [false, true].map(mirrored => {
    const side = mirrored ? 'right' : 'left';
    const blade = mirrored ? rightBlade : leftBlade;
    return '<g clip-path="url(#' + side + '-clip)"><path d="' + blade + '" fill="url(#' + side + ')"/>' +
      '<path d="' + path(sheen, progress, mirrored) + '" fill="url(#sheen)"/>' +
      '<path d="' + path(secondary, progress, mirrored) + '" fill="none" stroke="#e8f0b2" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="' + path(vein, progress, mirrored) + '" fill="none" stroke="#789d50" stroke-width="2.8" stroke-linecap="round"/></g>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><defs>' + gradients +
    '<linearGradient id="stem" gradientUnits="userSpaceOnUse" x1="188" y1="0" x2="212" y2="0"><stop stop-color="#286943"/><stop offset=".4" stop-color="#89b460"/><stop offset=".62" stop-color="#b8cf77"/><stop offset="1" stop-color="#37774c"/></linearGradient>' +
    '<linearGradient id="sheen" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#f1f4c2"/><stop offset="1" stop-color="#cee293"/></linearGradient>' +
    '<clipPath id="left-clip"><path d="' + leftBlade + '"/></clipPath><clipPath id="right-clip"><path d="' + rightBlade + '"/></clipPath></defs>' +
    '<path d="' + silhouette + '" fill="url(#stem)" stroke="#163e30" stroke-width="6" stroke-linejoin="round"/>' + paints +
    '<path d="M191 163 Q200 168 209 163 L207 175 Q200 178 193 175Z" fill="url(#stem)"/>' +
    '<path d="M198 177 C197 190 196 202 195 212" fill="none" stroke="#a5c672" stroke-width="1.5" stroke-linecap="round"/></svg>';
}
function components(raw) {
  const visited = new Uint8Array(width * height), queue = new Uint32Array(width * height);
  const sizes = [];
  for (let first = 0; first < visited.length; first++) {
    if (visited[first] || raw[first * 4 + 3] < 32) continue;
    let count = 1; queue[0] = first; visited[first] = 1;
    for (let cursor = 0; cursor < count; cursor++) {
      const pixel = queue[cursor], x = pixel % width, y = Math.floor(pixel / width);
      for (const next of [x > 0 ? pixel - 1 : -1, x < width - 1 ? pixel + 1 : -1, y > 0 ? pixel - width : -1, y < height - 1 ? pixel + width : -1]) {
        if (next < 0 || visited[next] || raw[next * 4 + 3] < 32) continue;
        visited[next] = 1; queue[count++] = next;
      }
    }
    sizes.push(count);
  }
  return sizes;
}
(async () => {
  fs.mkdirSync(__dirname + '/frames', { recursive: true });
  const tiles = [], records = [];
  let first = null, fixedDifferences = 0, jointHoles = 0;
  for (let index = 0; index < 16; index++) {
    const progress = index / 15, svg = drawing(progress);
    const raw = await sharp(Buffer.from(svg), { density: 288 }).resize(width, height).ensureAlpha().raw().toBuffer();
    if (!first) first = Buffer.from(raw);
    for (let y = 175; y < 230; y++) for (let x = 180; x < 220; x++) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel++) if (raw[offset + channel] !== first[offset + channel]) fixedDifferences++;
    }
    for (let y = 165; y < 212; y++) for (let x = 197; x < 204; x++) if (raw[(y * width + x) * 4 + 3] < 250) jointHoles++;
    const pieces = components(raw);
    if (pieces.length !== 1) throw new Error('Detached artwork in frame ' + index + ': ' + pieces.join(','));
    const name = String(index).padStart(3, '0');
    const png = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
    fs.writeFileSync(__dirname + '/frames/' + name + '.png', png);
    fs.writeFileSync(__dirname + '/frames/' + name + '.svg', svg + '\r\n');
    tiles.push({ input: png, left: index % 4 * width, top: Math.floor(index / 4) * height });
    records.push({ index, progress, connectedPieces: pieces.length });
  }
  if (fixedDifferences || jointHoles) throw new Error(JSON.stringify({ fixedDifferences, jointHoles }));
  await sharp({ create: { width: 1600, height: 960, channels: 4, background: '#00000000' } }).composite(tiles).png().toFile(__dirname + '/nest-stage-01-leaf-clean-sheet.png');
  const metadata = { frameSize: [width, height], columns: 4, frameCount: 16, periodMs: 3960, leafAmplitudePx: 13.5,
    artwork: 'Continuous sprout silhouette with clipped leaf paint and a fixed, fully drawn stem. Same slow leaf rhythm as the accepted steady idle.',
    runtimeTransforms: false, opacityBlending: false, rasterCutouts: false,
    fixedStem: { x: 180, y: 175, width: 40, height: 55, differences: fixedDifferences }, jointHoles, frames: records };
  fs.writeFileSync(__dirname + '/animation.json', JSON.stringify(metadata, null, 2).replace(/\n/g, '\r\n') + '\r\n');
  console.log(JSON.stringify({ frames: 16, periodMs: 3960, leafAmplitudePx: 13.5, fixedDifferences, jointHoles, connectedPiecesPerFrame: 1 }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
