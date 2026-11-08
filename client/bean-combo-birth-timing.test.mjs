import test from 'node:test';
import assert from 'node:assert/strict';
import { ANTENNA_COMBO_ACTION_ART } from './antenna-combo-assets.mjs';
import { SECRETION_COMBO_ACTION_ART } from './secretion-combo-assets.mjs';
import { BLADE_CARAPACE_ACTION_ART } from './blade-carapace-assets.mjs';
import { UNIT_BIRTH_ART } from './unit-birth-art-assets.mjs';
import { UNIT_COMBINATION_FORMS } from './unit-combination-forms.mjs';
import { createUnitActionArt, unitActionArtPose } from './unit-action-art.mjs';
const entries = Object.entries({ ...ANTENNA_COMBO_ACTION_ART, ...SECRETION_COMBO_ACTION_ART,
  ...BLADE_CARAPACE_ACTION_ART }).filter(([key]) => key.startsWith('bean/'));
const surface = (width, height) => ({ getContext: () => ({ drawImage() {},
  getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4).fill(255) }) }) });
const context = () => { const calls = [], transforms = []; return { calls, transforms,
  save() {}, restore() {}, translate(...v) { transforms.push(v); }, scale(...v) { transforms.push(v); },
  drawImage(...v) { calls.push(v); } }; };

test('all eleven bean combo births retain the 3850 ms motion clock and enter idle at readyAt', () => {
  assert.equal(entries.length, 11);
  assert.equal(UNIT_BIRTH_ART['bean/base'].durationMs, 3850);
  for (const [key, definition] of entries) {
    const animation = UNIT_BIRTH_ART[key] || definition.actions.birth;
    const form = UNIT_COMBINATION_FORMS.find(value => key.endsWith('/' + value.key));
    assert.ok(form, key);
    const agent = { tribe: 'bean', attributes: form.attributes, health: 10,
      birth: { startedAt: 53.125, readyAt: 56.975 } };
    const at = ms => agent.birth.startedAt + ms / 1000;
    assert.equal(animation.frameCount, 116, key);
    assert.equal(animation.durationMs, 3850, key);
    assert.equal(animation.durationsMs.reduce((a, b) => a + b), 3850, key);
    let elapsed = 0;
    for (let frame = 0; frame < 116; frame++) {
      const pose = unitActionArtPose(agent, at(elapsed));
      assert.equal(pose.animation, animation, key);
      assert.equal(pose.frame, frame, `${key}: ${elapsed} ms`);
      assert.equal(unitActionArtPose(agent, at(elapsed + animation.durationsMs[frame] - 0.001)).frame, frame);
      if (animation.sceneLayers) {
        const body = animation.sceneLayers.layers[1];
        assert.equal(body.samples.length, 116);
        assert.equal(!!body.samples[frame], elapsed >= 2590, key);
      }
      elapsed += animation.durationsMs[frame];
    }
    assert.equal(unitActionArtPose(agent, at(3849.999)).frame, 115);
    assert.equal(unitActionArtPose(agent, agent.birth.readyAt).action, 'idle');
  }
});

test('all eleven trimmed births preserve baked fallback crops in both facings through the final body', async () => {
  for (const [key, definition] of entries) {
    const animation = UNIT_BIRTH_ART[key] || definition.actions.birth;
    const form = UNIT_COMBINATION_FORMS.find(value => key.endsWith('/' + value.key));
    const agent = { tribe: 'bean', attributes: form.attributes, health: 10,
      birth: { startedAt: 10, readyAt: 13.85 } };
    const layerImages = new Set((animation.sceneLayers?.layers || []).map(layer => layer.image));
    const art = createUnitActionArt(value => value, surface, async image => {
      if (layerImages.has(image)) throw new Error('exercise baked fallback');
      return { image };
    });
    await art.prepare(agent, 10);
    for (const mirror of [false, true]) {
      let elapsed = 0;
      for (let frame = 0; frame < 116; frame++) {
        const ctx = context(), time = 10 + elapsed / 1000;
        assert.equal(art.readyAction(agent, time), true, key);
        assert.equal(art.draw(ctx, agent, time, 137, 251, 100, mirror), true, key);
        assert.equal(ctx.calls.length, 1, key);
        assert.equal(ctx.calls[0][0].image, animation.image);
        assert.deepEqual(ctx.calls[0].slice(1, 5), [frame % animation.columns * animation.frameSize,
          Math.floor(frame / animation.columns) * animation.frameHeight, animation.frameSize, animation.frameHeight]);
        assert.deepEqual(ctx.transforms, [[137, 251], [(animation.sourceFacing === 'left') !== mirror ? -1 : 1, 1]]);
        elapsed += animation.durationsMs[frame];
      }
    }
  }
});
