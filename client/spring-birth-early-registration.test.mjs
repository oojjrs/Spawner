import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { UNIT_ACTION_ART } from './unit-action-art-assets.mjs';
const root = new URL('../', import.meta.url);
const approved = JSON.parse(fs.readFileSync(new URL('AnimationCandidates/spring-birth-early-registration-v1-20261107/registration.json', root)));
for (const [key, record] of Object.entries(approved)) {
  test(`${key}: only eight whole-scene translations change, original pixels and final landing stay exact`, () => {
    const current = UNIT_ACTION_ART[key].actions.birth;
    const expected = structuredClone(record.original);
    for (let frame = 0; frame < 8; frame++) {
      const before = expected.sceneLayers.layers[1].samples[frame];
      const after = record.candidate.sceneLayers.layers[1].samples[frame];
      assert.equal(after.frame, before.frame);
      assert.deepEqual(after.destination.slice(2), before.destination.slice(2));
      assert.ok(after.destination.every(Number.isInteger));
      before.destination = after.destination;
    }
    assert.deepEqual(expected, record.candidate);
    assert.equal(expected.sourceFacing, 'right', 'historical registration remains intact');
    assert.deepEqual(current, { ...expected, sourceFacing: 'left' });
    assert.deepEqual(current.sceneLayers.layers[1].samples.slice(8), record.original.sceneLayers.layers[1].samples.slice(8));
    assert.deepEqual(current.sceneLayers.layers[0], record.original.sceneLayers.layers[0]);
    assert.equal(current.durationMs, 1790);
    for (const [path, digest] of Object.entries(record.hashes))
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(path, root))).digest('hex'), digest);
    const source = JSON.parse(fs.readFileSync(new URL(UNIT_ACTION_ART[key].sourceManifest, root))).actions.birth;
    for (const [i, layer] of current.sceneLayers.layers.entries())
      assert.deepEqual(source.sceneLayers.layers[i].samples, layer.samples);
  });
}
