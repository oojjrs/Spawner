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
