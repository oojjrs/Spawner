// Tool-only proposal: a body clip plus unchanged legacy birth scene drivers.
// This file is deliberately outside the runtime and does not register actions.birth.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const hashText = text => crypto.createHash('sha256').update(text).digest('hex');
const hashFile = path => crypto.createHash('sha256').update(fs.readFileSync(new URL(path, root))).digest('hex');

export function extractLegacyFunction(name) {
  const game = read('client/game.js');
  const start = game.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing legacy body renderer ${name}`);
  let depth = 0, end = game.indexOf('{', start);
  for (; end < game.length; end++) {
    if (game[end] === '{') depth++;
    if (game[end] === '}' && !--depth && game[end] === '}') break;
  }
  return game.slice(start, end + 1);
}

function legacyBaselineFunction(name) {
  const path = new URL('./legacy-body-reference.json', import.meta.url);
  if (!fs.existsSync(path)) throw Error('CAPTURE_ORIGINAL_BIRTH_REFERENCE_FIRST');
  const baseline = JSON.parse(fs.readFileSync(path, 'utf8'))[name];
  if (typeof baseline !== 'string' || !baseline.startsWith(`function ${name}(`)) throw Error('INVALID_LEGACY_BIRTH_REFERENCE');
  return baseline;
}

// source/meta/proof are independently measured by verify.py; no image is produced here.
export function buildSceneContract(tribe, source, birth, proof, unitDisplayScale) {
  const cap = tribe[0].toUpperCase() + tribe.slice(1);
  const legacyFunction = `draw${cap}Birth`;
  const placementExport = `${tribe}BirthPlacement`;
  const deformation = tribe === 'spring' ? 'spring-row-surface-v1' : tribe === 'spore' ? 'spore-affine-body-v1' : 'none';
  const bodyPixelsPerWorld = proof.runtimePixelsPerWorld;
  const scale = 512 / bodyPixelsPerWorld;
  const body = {
    sourceId: source.sourceId, image: birth.image, sourceHash: proof.sourceHash,
    frameSize: birth.frameSize, columns: birth.columns, frameCount: birth.frameCount,
    durationsMs: birth.durationsMs, loop: false, pivotX: birth.pivotX, pivotY: birth.pivotY,
    cameraMapping: { verified: true, sourceHash: proof.sourceHash, pixelsPerWorld: bodyPixelsPerWorld,
      scale, offsetX: 256 - birth.pivotX * scale, offsetY: 448 - birth.pivotY * scale,
      method: 'preserve-existing-game-fixed-native-birth-body-camera' }
  };
  const sceneAssets = [];
  for (const key of ['nest', 'foreground']) if (birth[key]) sceneAssets.push({ role: key, image: birth[key], sourceHash: hashFile(birth[key]) });
  if (tribe === 'spring') sceneAssets.push({ role: 'water', module: 'client/birth.mjs', export: 'drawSpringBirthWater' });
  return {
    contractVersion: 1, kind: 'native-body-with-external-legacy-scene', tribe, mask: 0, sourceId: source.sourceId,
    runtimeEnabled: false, independentBodyAction: false,
    integrationStatus: 'scene-adapter-required', body,
    externalRoot: { module: 'client/birth.mjs', export: placementExport, ownsWorldTravel: true,
      targetFloorWorld: tribe === 'pebble' ? .5 + .7 * (birth.unitPivotY / 512 - .5) : .5 + .7 * .44 },
    deformation: { kind: deformation, module: 'client/birth.mjs', moduleHash: hashFile('client/birth.mjs'),
      export: tribe === 'pebble' ? null : `${tribe}BirthMotion`,
      nativeHeight: tribe === 'spore' ? birth.unitHeight * birth.imageScale : birth.height,
      nativeOutletX: birth.outletX, nativeOutletY: birth.outletY,
      nativeCenterX: birth.pivotX, nativePivotY: birth.pivotY,
      rowStep: tribe === 'spring' ? Math.max(1, Math.round(birth.frameSize / 120)) : null },
    visibility: { firstBodyFrame: birth.firstUnitFrame ?? 0,
      lastFramePolicy: 'handoff-to-registered-idle', lastFrame: birth.frameCount - 1 },
    nativeFrameSampling: tribe === 'spore' ? 'fixed-native-frame-canvas-copy' : 'original-sheet-source-rect',
    legacyPixelStage: { displayScale: unitDisplayScale, nativeWorldPerPixelBeforeDisplay: 1 / (bodyPixelsPerWorld * unitDisplayScale),
      agentHeight: .7, canonicalFrameSize: 512, referenceHeight: tribe === 'spring' ? 350 : null,
      unitHeight: birth.unitHeight ?? null, unitPivotY: birth.unitPivotY ?? null,
      commonFloorOffsetFromHalfCell: .44 },
    floorOffsetWorld: tribe === 'pebble' ? (.7 * (birth.unitPivotY / 512 - .5) - .7 * .44) * unitDisplayScale : 0,
    separatedSceneAssets: sceneAssets,
    legacyReference: { file: 'client/game.js', function: legacyFunction, sourceHash: hashText(legacyBaselineFunction(legacyFunction)),
      capture: 'tools/native-appearance-registration-20261104/legacy-body-reference.json' },
    ownership: { bodyOnly: true, originalPixelsPreserved: true, perFrameFit: false,
      sceneRootInsideBodyClip: false, nestsOrWaterInsideBodyClip: false, dnaGrowthApplications: 1 },
    validation: { cameraVerified: true, runtimeRendererConnected: false,
      report: 'tools/native-appearance-registration-20261104/scene-render-report.json' }
  };
}

// Browser-safe counterpart is in scene-body-proposal.mjs. This CLI emits only the
// reference functions needed by the isolated renderer equivalence test.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--contract') {
    const { tribe, source, birth, proof, unitDisplayScale } = JSON.parse(fs.readFileSync(0, 'utf8'));
    console.log(JSON.stringify(buildSceneContract(tribe, source, birth, proof, unitDisplayScale)));
    process.exit(0);
  }
  if (process.argv[2] === '--capture-current-adapter') {
    const refs = Object.fromEntries(['Spore', 'Pebble', 'Spring'].map(name => [`draw${name}Birth`, extractLegacyFunction(`draw${name}Birth`)]));
    fs.writeFileSync(new URL('./current-body-adapter.json', import.meta.url), JSON.stringify(refs, null, 2) + '\n');
    process.exit(0);
  }
  const path = new URL('./legacy-body-reference.json', import.meta.url);
  if (!fs.existsSync(path) || process.argv[2] === '--refresh-legacy-reference') {
    const refs = Object.fromEntries(['Spore', 'Pebble', 'Spring'].map(name => [`draw${name}Birth`, extractLegacyFunction(`draw${name}Birth`)]));
    fs.writeFileSync(path, JSON.stringify(refs, null, 2) + '\n');
  }
}
