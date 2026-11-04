import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { UNIT_ANIMATIONS } from '../../client/unit-animation.mjs';
import { AGENT_DEATH_ANIMATIONS } from '../../client/agent-death.mjs';
import { unitAppearanceReadiness, unitAppearanceSourceScale } from '../../client/unit-appearance.mjs';
import { extractLegacyFunction } from './scene-contracts.mjs';

const root = new URL('../../', import.meta.url);
const read = path => JSON.parse(fs.readFileSync(new URL(path, root), 'utf8'));
const hash = path => crypto.createHash('sha256').update(fs.readFileSync(new URL(path, root))).digest('hex');
const report = read('tools/native-appearance-registration-20261104/report.json');
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-10, `${label}: ${a} != ${b}`);
const expectedActions = {
  bean: ['idle', 'attack', 'hurt', 'death'],
  spore: ['idle', 'walk', 'jump', 'attack', 'hurt', 'death'],
  pebble: ['idle', 'walk', 'jump', 'attack', 'hurt', 'death'],
  spring: ['idle', 'walk', 'jump', 'attack', 'hurt', 'death']
};

test('all 22 registrations reference unchanged native strips, source hashes and physical geometry', () => {
  let clips = 0, frames = 0;
  for (const [tribe, actionNames] of Object.entries(expectedActions)) {
    const base = `DesignAssets/Animations/UnitAppearanceV1/${tribe}/00/`;
    const source = read(base + 'source.json'), motions = read(base + 'motions.json');
    assert.equal(hash(source.image), source.sourceHash);
    assert.equal(hash(source.provenance.sourceImage), source.provenance.sourceHash);
    assert.equal(hash(source.provenance.currentOriginalReference.image), source.provenance.currentOriginalReference.sourceHash);
    assert.equal(motions.sourceId, source.sourceId);
    assert.deepEqual(Object.keys(motions.actions), actionNames);
    const native = { ...UNIT_ANIMATIONS[tribe], death: AGENT_DEATH_ANIMATIONS[tribe] };
    for (const [name, clip] of Object.entries(motions.actions)) {
      const original = native[name], measured = report.tribes[tribe].actions[name];
      assert.equal(clip.image, original.image);
      assert.equal(hash(clip.image), clip.sourceHash);
      assert.equal(clip.sourceHash, measured.sourceHash);
      assert.equal(clip.sourceHash, clip.cameraMapping.sourceHash);
      for (const key of ['frameSize', 'columns', 'frameCount', 'pivotX', 'pivotY']) assert.equal(clip[key], original[key], `${tribe}/${name} ${key}`);
      assert.deepEqual(clip.durationsMs, original.durationsMs);
      assert.equal(clip.loop, original.loop ?? false);
      assert.equal(clip.sourceId, source.sourceId);
      assert.equal(clip.cameraMapping.verified, true);
      assert.equal(measured.allFrames.length, clip.frameCount);
      assert.equal(measured.maximumWorldProjectionError < 1e-12, true);
      assert.equal(measured.allFrames.every(frame => frame.alphaPixels > 0 && frame.edgeAlphaPixels === 0), true);
      assert.deepEqual(measured.nativeDimensions, [clip.frameSize * clip.columns, clip.frameSize * Math.ceil(clip.frameCount / clip.columns)]);
      clips++; frames += clip.frameCount;
    }
  }
  assert.equal(clips, 22);
  assert.equal(frames, 524);
  assert.equal(report.allNativeFramesChecked, frames);
});

test('native camera projection matches the existing game and DNA growth applies exactly once', () => {
  for (const tribe of Object.keys(expectedActions)) {
    const source = read(`DesignAssets/Animations/UnitAppearanceV1/${tribe}/00/source.json`);
    const { actions } = read(`DesignAssets/Animations/UnitAppearanceV1/${tribe}/00/motions.json`);
    for (const [name, clip] of Object.entries(actions)) {
      const mapping = clip.cameraMapping, proof = report.tribes[tribe].actions[name];
      near(mapping.scale, 512 / mapping.pixelsPerWorld, 'source -> canonical scale');
      near(clip.pivotX * mapping.scale + mapping.offsetX, source.pivot.x, 'same fixed x pivot');
      near(clip.pivotY * mapping.scale + mapping.offsetY, source.pivot.y, 'same fixed y pivot');
      for (const screenPixels of [40, 100, 320]) {
        for (const count of [0, 1, 20]) {
          const agent = { tribe, dna: { pieces: Array(count).fill({}) } };
          const scale = unitAppearanceSourceScale(agent, screenPixels, source, clip);
          near(scale, screenPixels * proof.oldWorldPerPixel * (1 + .01 * count), `${tribe}/${name} DNA count ${count}`);
          // Every measured original frame keeps its old support point and dimensions.
          for (const frame of proof.allFrames) {
            const [x, y, w, h] = frame.pixelBounds;
            near((x - clip.pivotX) * scale, (x - clip.pivotX) * proof.oldWorldPerPixel * screenPixels * (1 + .01 * count), 'frame x');
            near((y + h - clip.pivotY) * scale, (y + h - clip.pivotY) * proof.oldWorldPerPixel * screenPixels * (1 + .01 * count), 'frame support');
            near(w * scale, w * proof.oldWorldPerPixel * screenPixels * (1 + .01 * count), 'frame width');
          }
        }
      }
    }
  }
});

test('unverified birth and missing native actions remain unsupported without fake idle fallbacks', () => {
  let birthFrames = 0;
  for (const tribe of Object.keys(expectedActions)) {
    const source = read(`DesignAssets/Animations/UnitAppearanceV1/${tribe}/00/source.json`);
    const { actions } = read(`DesignAssets/Animations/UnitAppearanceV1/${tribe}/00/motions.json`);
    const status = unitAppearanceReadiness({ source, actions }, 0);
    assert.equal(status.sourceApproved, true);
    assert.equal(status.cameraVerified, true);
    assert.equal(status.actionSetComplete, false);
    assert.equal(status.worldReady, false);
    for (const name of ['birth', 'harvest', 'carry', 'throw']) {
      assert.equal(actions[name], undefined);
      assert.equal(report.tribes[tribe].unsupported[name].registered, false);
      assert.ok(report.tribes[tribe].unsupported[name].reason.length > 40);
    }
    if (tribe === 'bean') assert.equal(actions.walk, undefined);
    const birth = report.tribes[tribe].unsupported.birth;
    if (birth.frameCount) {
      assert.equal(hash(birth.image), birth.sourceHash);
      assert.equal(birth.allFramePixelBounds.length, birth.frameCount);
      birthFrames += birth.frameCount;
    }
  }
  assert.equal(birthFrames, 83);
  assert.equal(report.worldReadySources, 0);
});

test('separate birth scene contracts preserve exact native body sources and the verified renderer', () => {
  const sceneReport = read('tools/native-appearance-registration-20261104/scene-render-report.json');
  assert.equal(sceneReport.samples, 1032);
  assert.equal(sceneReport.changedPixels, 0);
  assert.equal(sceneReport.maxChannelError, 0);
  assert.deepEqual(sceneReport.failures, []);
  assert.deepEqual(sceneReport.pageErrors, []);
  assert.equal(hash(sceneReport.runtimeHelper), sceneReport.runtimeHelperHash);
  assert.equal(sceneReport.currentIntegration.samples, 516);
  assert.equal(sceneReport.currentIntegration.helperCalls, 484);
  assert.equal(sceneReport.currentIntegration.changedPixels, 0);
  assert.equal(sceneReport.currentIntegration.maxChannelError, 0);
  assert.deepEqual(sceneReport.currentIntegration.failures, []);
  assert.equal(sceneReport.currentIntegration.gateCases.length, 28);
  assert.equal(sceneReport.currentIntegration.gateCases.every(c => c.helperCalls === c.expectedCalls), true);
  for (const tribe of ['spore', 'pebble', 'spring']) {
    const path = `DesignAssets/Animations/UnitAppearanceV1/${tribe}/00/motions.json`;
    const motions = read(path), contract = motions.sceneActions.birth;
    assert.equal(contract.mask, 0);
    assert.equal(contract.tribe, tribe);
    assert.equal(contract.sourceId, motions.sourceId);
    assert.equal(contract.body.sourceId, motions.sourceId);
    assert.equal(contract.runtimeEnabled, contract.validation.runtimeRendererConnected);
    assert.equal(contract.integrationStatus, contract.runtimeEnabled ? 'legacy-scene-body-adapter' : 'scene-adapter-required');
    assert.equal(contract.independentBodyAction, false);
    assert.equal(contract.ownership.bodyOnly, true);
    assert.equal(contract.ownership.originalPixelsPreserved, true);
    assert.equal(contract.ownership.perFrameFit, false);
    assert.equal(contract.ownership.dnaGrowthApplications, 1);
    assert.equal(contract.body.sourceHash, hash(contract.body.image));
    assert.equal(contract.deformation.moduleHash, hash(contract.deformation.module));
    assert.equal(contract.visibility.lastFramePolicy, 'handoff-to-registered-idle');
    assert.equal(contract.visibility.lastFrame, contract.body.frameCount - 1);
    assert.equal(hash(path), sceneReport.tribes[tribe].motionsFileHash);
    assert.equal(contract.body.sourceHash, sceneReport.tribes[tribe].bodySourceHash);
    assert.equal(contract.legacyReference.sourceHash, sceneReport.tribes[tribe].legacyRendererHash);
    const baseline = read(contract.legacyReference.capture)[contract.legacyReference.function];
    assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'), contract.legacyReference.sourceHash);
    const currentFunction = extractLegacyFunction(contract.legacyReference.function);
    assert.equal(crypto.createHash('sha256').update(currentFunction).digest('hex'), sceneReport.tribes[tribe].currentIntegrationFunctionHash);
    for (const item of contract.separatedSceneAssets) if (item.image) assert.equal(hash(item.image), item.sourceHash);
    const mapping = contract.body.cameraMapping;
    near(mapping.pixelsPerWorld, report.tribes[tribe].unsupported.birth.runtimePixelsPerWorld, 'birth fixed camera');
    near(mapping.scale, 512 / mapping.pixelsPerWorld, 'birth canonical mapping');
    near(mapping.scale * contract.body.pivotX + mapping.offsetX, 256, 'birth fixed pivot x');
    near(mapping.scale * contract.body.pivotY + mapping.offsetY, 448, 'birth fixed pivot y');
  }
  const audit = read('tools/native-appearance-registration-20261104/followup-action-audit.json');
  assert.equal(audit.newIndependentBodyClipsFound, 0);
  assert.equal(audit.legacyResourcePreviews.length, 12);
  assert.equal(audit.legacyResourcePreviews.every(p => p.independentNativeBody === false && p.rendering === 'runtime-composite'), true);
  for (const item of audit.legacyResourcePreviews) {
    assert.equal(hash(item.metadata), item.metadataHash);
    assert.equal(hash(item.resourceImage), item.resourceImageHash);
  }
});
