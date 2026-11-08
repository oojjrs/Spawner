import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { BLADE_CARAPACE_ACTION_ART, BLADE_CARAPACE_IMAGE_ASSETS } from './blade-carapace-assets.mjs';
import { auditImages, imageDimensions } from './image-audit.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const actions = ['idle', 'walk', 'attack', 'hurt', 'birth', 'death'];
const tribes = ['bean', 'spore', 'pebble', 'spring'];

test('all four blade+carapace forms expose six full-body clips and portraits, without ranged', () => {
  assert.equal(Object.keys(BLADE_CARAPACE_ACTION_ART).length, 4);
  assert.equal(BLADE_CARAPACE_IMAGE_ASSETS.length, 28);
  for (const tribe of tribes) {
    const definition = BLADE_CARAPACE_ACTION_ART[`${tribe}/blade-carapace`];
    const manifest = JSON.parse(readFileSync(resolve(root, `AnimationCandidates/${tribe}-blade-carapace-fullbody-v1-20261107/publication-manifest.json`)));
    assert.deepEqual(Object.keys(definition.actions), actions);
    assert.equal(definition.reference.image, definition.actions.idle.image);
    assert.deepEqual(imageDimensions(resolve(root, definition.portrait)), [definition.reference.frameSize, definition.reference.frameHeight]);
    for (const action of actions) {
      const clip = definition.actions[action], source = manifest.actions[action];
      assert.match(clip.image, /^DesignAssets\/Animations\/BladeCarapaceV1\//);
      assert.equal(createHash('sha256').update(readFileSync(resolve(root, clip.image))).digest('hex'), source.sheetSHA256);
      const reviewHold = tribe === 'bean' && action === 'birth';
      if (reviewHold) { assert.equal(source.durationsMs.at(-1), 650); assert.equal(source.durationsMs.reduce((a, b) => a + b, 0), 4500); }
      assert.deepEqual(clip.durationsMs, reviewHold ? source.durationsMs.slice(0, -1) : source.durationsMs);
      assert.equal(clip.durationsMs.length, clip.frameCount);
      assert.equal(clip.durationMs, clip.durationsMs.reduce((a, b) => a + b, 0));
      assert.equal(clip.loop, action === 'idle' || action === 'walk');
      assert.equal(clip.sourceFacing, source.sourceFacing || manifest.sourceFacing || 'right');
      assert.ok(clip.referenceLength > 0 && clip.viewSize === clip.referenceLength);
      assert.deepEqual(imageDimensions(resolve(root, clip.image)), [clip.frameSize * clip.columns, clip.frameHeight * Math.ceil(clip.frameCount / clip.columns)]);
    }
  }
});

test('birth registration anchors the finished body, never the full scene bounds', () => {
  for (const definition of Object.values(BLADE_CARAPACE_ACTION_ART)) {
    const birth = definition.actions.birth;
    assert.equal(birth.fullScene, true);
    assert.equal(birth.sceneIncludesNest, true);
    assert.equal(birth.worldTravelIncludedInPixels, true);
    assert.equal(birth.sceneAnchor, 'final-body-floor');
    assert.ok(birth.referenceLength < definition.reference.referenceLength);
    assert.ok(birth.sourceFacing === 'left' ? birth.pivotX < birth.frameSize / 2 : birth.pivotX > birth.frameSize / 2);
    assert.ok(birth.pivotY > birth.frameHeight / 2);
  }
  const spore = BLADE_CARAPACE_ACTION_ART['spore/blade-carapace'].actions.birth;
  assert.equal(spore.frameSize, 768);
  assert.equal(spore.frameHeight, 512);
});

test('all 28 runtime assets have exact-byte native image policy registration', () => {
  assert.equal(auditImages(root, BLADE_CARAPACE_IMAGE_ASSETS), 28);
});

test('pebble walk uses the corrected grounded twelve-pose source', () => {
  const walk = BLADE_CARAPACE_ACTION_ART['pebble/blade-carapace'].actions.walk;
  const source = JSON.parse(readFileSync(resolve(root, 'AnimationCandidates/pebble-blade-carapace-walk-grounded-v2-20261107/manifest.json')));
  assert.equal(walk.frameCount, 12);
  assert.equal(walk.durationMs, 840);
  assert.deepEqual(walk.durationsMs, source.durationsMs);
  assert.equal(walk.pivotY, 450);
  assert.equal(walk.referenceLength, 406);
  assert.equal(createHash('sha256').update(readFileSync(resolve(root, walk.image))).digest('hex'), source.sheetSHA256);
});
