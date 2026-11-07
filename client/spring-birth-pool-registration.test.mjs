import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { UNIT_ACTION_ART } from './unit-action-art-assets.mjs';
import { createUnitActionArt, unitActionArtPose, unitActionArtDefinition } from './unit-action-art.mjs';
import { combatLabCombinationDna } from './combat-lab-appearances.mjs';
import { validateDna } from '../server/dna-unit.mjs';
const root = new URL('../', import.meta.url);
const changes = JSON.parse(fs.readFileSync(new URL('AnimationCandidates/spring-birth-pool-registration-v1-20261107/candidate-registration.json', root)));
const early = JSON.parse(fs.readFileSync(new URL('AnimationCandidates/spring-birth-early-registration-v1-20261107/registration.json', root)));
const digest = path => crypto.createHash('sha256').update(fs.readFileSync(new URL(path, root))).digest('hex');
function context() { return { calls: [], transforms: [], save() {}, restore() {}, translate(...v) { this.transforms.push(v); }, scale(...v) { this.transforms.push(v); }, drawImage(image, ...args) { this.calls.push({ image: image.path, args }); }, getImageData() { return { data: new Uint8ClampedArray(480 * 480 * 4).fill(255) }; } }; }
function surface(width, height) { const c = context(); return { width, height, getContext: () => c }; }
const policy = JSON.parse(fs.readFileSync(new URL('DesignAssets/image-sizes.json', root)));
for (const [key, candidate] of Object.entries(changes)) {
  test(`${key}: approved partial scene, persistent sources and original fallback`, () => {
    const definition = UNIT_ACTION_ART[key], clip = definition.actions.birth;
    const { sceneLayers, ...registration } = clip;
    assert.deepEqual(registration, candidate.unchangedRegistration);
    assert.equal(digest(clip.image), candidate.sourceSHA256);
    const manifest = JSON.parse(fs.readFileSync(new URL(definition.sourceManifest, root)));
    const original = manifest.actions.birth;
    assert.equal(digest(original.sheet), candidate.sourceSHA256);
    assert.equal(sceneLayers.version, 1);
    for (const [i, layer] of sceneLayers.layers.entries()) {
      const approved = structuredClone(candidate.sceneLayers.layers[i]), file = candidate.assetFiles[i];
      if (i === 1) for (let frame = 0; frame < 8; frame++)
        approved.samples[frame].destination = early[key].candidate.sceneLayers.layers[i].samples[frame].destination;
      assert.deepEqual({ ...layer, image: approved.image }, approved);
      assert.equal(digest(layer.image), file.sha256);
      assert.equal(digest(original.sceneLayers.layers[i].image), file.sha256);
      assert.equal(policy.images[layer.image].nativeSource.sha256, file.sha256);
      if (i === 0) assert.deepEqual(layer.samples.slice(0, 9), Array(9).fill(null));
    }
    const docs = fs.readFileSync(new URL('DesignAssets/sections/unit-appearance.js', root), 'utf8');
    const source = docs.split('\n').filter(line => line.trim().startsWith('"')).map(line => JSON.parse(line.trim().replace(/\s*\+$/, ''))).join('');
    const row = source.match(new RegExp(`<tr id="unit-${key.replace('/', '-')}">[\\s\\S]*?</tr>`))[0];
    const cell = row.match(/<td data-action="birth">[\s\S]*?<\/td>/)[0];
    assert.ok(cell.includes('data-birth-scene='));
    for (const layer of sceneLayers.layers) assert.ok(cell.includes(layer.image));
    const preview = JSON.parse(cell.match(/data-birth-scene="([^"]+)"/)[1]
      .replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&'));
    for (const [i, layer] of sceneLayers.layers.entries())
      assert.deepEqual(preview.sceneLayers.layers[i].samples, layer.samples, 'planning uses the same approved positions');
  });
  test(`${key}: real DNA5, both facings, every frame boundary, idle exit and demand-only loading`, async () => {
    const dna = combatLabCombinationDna(key.split('/')[1]);
    assert.equal(dna.version, 5); assert.ok(validateDna(dna, dna.level, dna.budget));
    const actor = { tribe: 'spring', dna, health: 20, birth: { startedAt: 0, readyAt: 1.79 } };
    assert.equal(unitActionArtDefinition(actor), UNIT_ACTION_ART[key]);
    const clip = UNIT_ACTION_ART[key].actions.birth, layers = clip.sceneLayers.layers;
    const loaded = [];
    const art = createUnitActionArt(v => v, surface, async path => { loaded.push(path); return { path }; });
    await art.prepare(actor, 0);
    assert.deepEqual(loaded.sort(), layers.map(l => l.image).sort());
    for (const mirror of [false, true]) for (const ms of [...Array.from({ length: 16 }, (_, i) => i * 100).flatMap(v => v ? [v - .001, v] : [0]), 1789.999, 1790, 1790.001]) {
      await art.prepare(actor, ms / 1000);
      const c = context(), pose = unitActionArtPose(actor, ms / 1000);
      assert.ok(art.draw(c, actor, ms / 1000, 190, 250, 200, mirror));
      if (ms >= 1790) { assert.equal(pose.action, 'idle'); assert.ok(c.calls.every(call => !layers.some(l => l.image === call.image))); continue; }
      assert.equal(pose.action, 'birth'); assert.equal(pose.frame, Math.min(15, Math.floor(ms / 100)));
      assert.deepEqual(c.transforms, [[190, 250], [mirror ? -1 : 1, 1]]);
      assert.equal(c.calls.length, pose.frame < 9 ? 1 : 2);
      for (const call of c.calls) {
        const layer = layers.find(l => l.image === call.image), rect = layer.samples[pose.frame].destination;
        const scale = call.args[6] / rect[2];
        assert.ok(Math.abs(call.args[4] - (rect[0] - clip.pivotX) * scale) < 1e-8);
        assert.ok(Math.abs(call.args[5] - (rect[1] - clip.pivotY) * scale) < 1e-8);
      }
    }
    assert.ok(!loaded.includes(clip.image));
  });
  test(`${key}: either missing or undersized layer atomically restores original flat scene`, async () => {
    const clip = UNIT_ACTION_ART[key].actions.birth, layers = clip.sceneLayers.layers;
    const actor = { tribe: 'spring', dna: combatLabCombinationDna(key.split('/')[1]), health: 20, birth: { startedAt: 0, readyAt: 1.79 } };
    for (const bad of layers) for (const failure of ['missing', 'undersized']) for (const mirror of [false, true]) for (const ms of [0, 700, 800, 900, 1200, 1789.999]) {
      const loaded = [];
      const art = createUnitActionArt(v => v, surface, async path => {
        loaded.push(path);
        if (path === bad.image) { if (failure === 'missing') throw Error('injected missing layer'); return { path, naturalWidth: 1, naturalHeight: 1 }; }
        return { path };
      });
      await art.prepare(actor, ms / 1000);
      const c = context(); assert.ok(art.draw(c, actor, ms / 1000, 190, 250, 200, mirror));
      assert.equal(c.calls.length, 1); assert.equal(c.calls[0].image, clip.image);
      const frame = Math.min(15, Math.floor(ms / 100));
      assert.deepEqual(c.calls[0].args.slice(0, 4), [frame % 4 * 480, Math.floor(frame / 4) * 480, 480, 480]);
      assert.ok(loaded.every(path => path === clip.image || layers.some(l => l.image === path)));
    }
  });
}
