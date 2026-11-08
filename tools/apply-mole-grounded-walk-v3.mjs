// Publish only the approved mole drawing and its measured presentation metadata.
// Uses the existing project directories; no gameplay movement or stats are edited.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
const base = 'AnimationCandidates/mole-smooth-arm-v2-20261106/mole-grounded-walk-v3';
const image = 'DesignAssets/Animations/CreatureApprovedV4/soil-mole/walk-grounded-v3.webp';
const thumbnail = 'DesignAssets/Planning/ApprovedAnimations96/soil-mole-grounded-walk-v3-preview.webp';
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const sourceHash = sha(base + '-sheet.png');
if (sourceHash !== '4d105f9051e39b4ef68f78ebb46f4353504646492e5fb04fd428bcd51028dca7') throw new Error('Approved sheet changed');
const source = JSON.parse(readFileSync(base + '-manifest.json', 'utf8'));
if (sha(base + '-source.png') !== source.sourceImageSHA256) throw new Error('Approved source changed');
const durationsMs = [180, 80, 80, 80, 110, 50, 40, 20];
const clip = { image, frameSize: 256, viewSize: 256, columns: 4,
  // One registration for the entire strip, fitted to the idle eye landmark.
  pivotX: 127.25, pivotY: 181.75, durationsMs, loop: true, registrationScale: 1,
  groundRadiusX: .387324, groundRadiusY: .087324, cyclesPerCell: 2.5,
  sourceFacing: 'left',
  // 60 / (180 / 640) = 213 1/3 px per cycle on the approved 512px camera.
  // The 27px next stance and 36px far-paw stance independently agree.
  strideFrameRatio: 5 / 12 };
execFileSync('magick', [base + '-sheet.png', '-resize', '50%', '-define', 'webp:lossless=true', image]);
const inputs = [];
for (let f = 0; f < 8; f++) inputs.push('-delay', String(durationsMs[f] / 10), base + '-frame-' + String(f).padStart(2, '0') + '.png');
execFileSync('magick', ['-dispose', 'background', ...inputs, '-loop', '0', base + '-timed-preview.gif']);
execFileSync('magick', ['-dispose', 'background', ...inputs, '-resize', '96x96', '-loop', '0', '-define', 'webp:lossless=true', thumbnail]);
function writePreserved(path, content) {
  const previous = readFileSync(path, 'utf8');
  writeFileSync(path, content.replace(/\r?\n/g, previous.includes('\r\n') ? '\r\n' : '\n'));
}
const catalog = 'client/creature-approved-animations.mjs', old = readFileSync(catalog, 'utf8');
writePreserved(catalog, old.replace(/  "soil-mole": \{[^]*?\n  \},(?=\r?\n  "walking-forest")/,
  '  "soil-mole": ' + JSON.stringify(clip, null, 2).replace(/\n/g, '\n  ') + ','));
const runtime = { ...clip, frameCount: 8, durationMs: 640 };
const refPath = 'client/creature-walk-reference.json', refs = JSON.parse(readFileSync(refPath, 'utf8'));
const ref = refs.creatures.find(row => row.key === 'soil-mole');
Object.assign(ref, { walkImage: image, walkSha256: sha(image), frameSize: clip.frameSize, viewSize: clip.viewSize,
  pivotX: clip.pivotX, pivotY: clip.pivotY, runtime,
  result: 'User-approved whole-body v3. Constant idle-landmark scale and pivot. Source stance distances set nonuniform key durations and distance-based phase; no gameplay speed change.' });
writePreserved(refPath, JSON.stringify(refs, null, 2) + '\n');
const policyPath = 'DesignAssets/image-sizes.json', policyText = readFileSync(policyPath, 'utf8').replace(/\r\n/g, '\n');
const policy = JSON.parse(policyText), additions = { [image]: { display: [256, 256], grid: [4, 2] }, [thumbnail]: { display: [96, 96], grid: [1, 1] } };
const missing = Object.entries(additions).filter(([key, value]) => {
  if (policy.images[key] && JSON.stringify(policy.images[key]) !== JSON.stringify(value)) throw new Error('Different existing policy: ' + key);
  return !policy.images[key];
});
if (missing.length) {
  const end = policyText.lastIndexOf('\n  }\n}');
  if (end < 0) throw new Error('Unexpected image policy layout');
  const extra = ',\n' + missing.map(([key, value]) => '    ' + JSON.stringify(key) + ': ' + JSON.stringify(value, null, 2).replace(/\n/g, '\n    ')).join(',\n');
  writePreserved(policyPath, policyText.slice(0, end) + extra + policyText.slice(end));
}
const matrixPath = 'client/unit-matrix-data.js', context = {};
runInNewContext(readFileSync(matrixPath, 'utf8'), context);
context.SpawnerUnitMatrixData.units['soil-mole'].animations.walk = runtime;
writePreserved(matrixPath, 'globalThis.SpawnerUnitMatrixData=' + JSON.stringify(context.SpawnerUnitMatrixData) + ';\n');
const designPath = 'DesignAssets/sections/unit-appearance.js'; let html = '';
runInNewContext(readFileSync(designPath, 'utf8'), { document: { write(value) { html += value; } } });
let edited = false;
html = html.replace(/<tr id="unit-soil-mole"[^]*?<\/tr>/, row => row.replace(/<td data-action="walk"[^]*?<\/td>/, cell => {
  edited = true;
  return cell.replace(/data-preview="[^"]+"/, 'data-preview="' + image + '"')
    .replace(/href="[^"]+"/, 'href="' + base + '-sheet.png"')
    .replace(/data-columns="[^"]+"/, 'data-columns="4"')
    .replace(/data-durations="[^"]+"/, 'data-durations="' + durationsMs.join(',') + '"')
    .replace('"times":[0,330]', '"times":[0,420]')
    .replace(/data-original-src="[^"]+"/, 'data-original-src="' + base + '-timed-preview.gif"')
    .replace(/data-src="[^"]+"/, 'data-src="' + thumbnail + '"');
}));
if (!edited) throw new Error('Mole design walk entry not found');
writePreserved(designPath, 'document.write(\n' + html.match(/[^\n]*\n|[^\n]+$/g).map(line => JSON.stringify(line)).join(' +\n') + '\n);\n');
const manifest = { approval: '2026-11-08 user: 어, 좋아, 두더지 괜찮은 거 같다. 그대로 적용하자',
  approvedSheet: base + '-sheet.png', approvedSheetSHA256: sourceHash,
  image, imageSHA256: sha(image), thumbnail, thumbnailSHA256: sha(thumbnail), runtime,
  transform: 'Whole atlas common 50% downsample to 256px cells. All eight approved poses kept in original order. No image blending or new drawing.',
  timing: 'Near paw 0->1: 60px/180ms; 1->2: 27px/80ms; far paw 4->5: 36px/110ms. Phase follows displayed world/combat travel. 7->0 has only 20ms to avoid a long reverse-contact dwell.',
  limitations: 'Discrete eight-key walk, not a 64-frame interpolation. Contact positions have pixel-level stepping during held keys. Vertical/diagonal motion remains a side-view illustration.',
  changedGameplaySpeed: false, changedDisplaySize: false };
writeFileSync(base + '-publication.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
