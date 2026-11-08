import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { UNIT_APPEARANCE_ASSETS } from './unit-appearance-assets.mjs';

test('native-left spring attack keeps the legacy lazy copy byte-exact with its source', () => {
  const image = 'DesignAssets/Tribes/spring/AnimationStudies/attack-directions-v3/right/attack.webp';
  const bytes = readFileSync(image), hash = createHash('sha256').update(bytes).digest('hex');
  const context = { SpawnerUnitAppearanceData: {} };
  runInNewContext(readFileSync('client/unit-appearance-lazy-assets.js', 'utf8'), context);
  const entry = context.SpawnerUnitAppearanceFiles[image];
  assert.equal(entry.hash, hash);
  assert.equal(entry.bytes, bytes.length);
  runInNewContext(readFileSync(entry.script, 'utf8'), context);
  assert.deepEqual(Buffer.from(context.SpawnerUnitAppearanceData[image].split(',')[1], 'base64'), bytes);
  const clip = UNIT_APPEARANCE_ASSETS['spring/00'].actions.attack;
  assert.equal(clip.imageHash, hash);
  assert.equal(clip.cameraMapping.sourceHash, hash);
  assert.equal(clip.sourceFacing, 'left');
});

test('legacy appearance generator preserves the authored sourceFacing field', () => {
  const source=readFileSync('client/build-unit-appearance.mjs','utf8');
  const picked=source.match(/const animation = pick\(clip, \[([^\]]+)\]\)/)?.[1];
  assert.ok(picked?.includes('"sourceFacing"'), 'regeneration must not silently revert native-left registration');
});

test('every legacy lazy wrapper has the exact current source bytes and registry hash', () => {
  const registry = {};
  runInNewContext(readFileSync('client/unit-appearance-lazy-assets.js', 'utf8'), registry);
  const entries = Object.entries(registry.SpawnerUnitAppearanceFiles);
  assert.ok(entries.length >= 44, 'all legacy entries are inspected, not only the last changed attack');
  for (const [image, entry] of entries) {
    const bytes = readFileSync(image), hash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(entry.hash, hash, image + ' hash');
    assert.equal(entry.bytes, bytes.length, image + ' byte length');
    const context = { SpawnerUnitAppearanceData: {} };
    runInNewContext(readFileSync(entry.script, 'utf8'), context);
    assert.deepEqual(Buffer.from(context.SpawnerUnitAppearanceData[image].split(',')[1], 'base64'), bytes, image + ' offline payload');
  }
  let checkedClips = 0;
  for (const definition of Object.values(UNIT_APPEARANCE_ASSETS)) for (const clip of Object.values(definition.actions)) {
    const entry = registry.SpawnerUnitAppearanceFiles[clip.image];
    if (!entry) continue;
    assert.equal(clip.imageHash, entry.hash, clip.image + ' archived clip hash');
    if (clip.cameraMapping) assert.equal(clip.cameraMapping.sourceHash, entry.hash, clip.image + ' camera source hash');
    checkedClips++;
  }
  assert.ok(checkedClips > 0);
});
