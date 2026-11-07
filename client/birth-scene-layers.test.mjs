import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_BIRTH_ART } from './unit-birth-art-assets.mjs';
import { createUnitActionArt, unitActionArtPose, unitActionArtDefinition } from './unit-action-art.mjs';
import { unitDisplaySize } from './unit-size.mjs';

function surface(width, height) {
  const calls = [], transforms = [];
  const context = { calls, transforms, save() {}, restore() {},
    translate(...args) { transforms.push(['translate', ...args]); },
    scale(...args) { transforms.push(['scale', ...args]); },
    beginPath() {}, arc() {}, stroke() {},
    drawImage(...args) { calls.push(args); },
    getImageData() { return { data: new Uint8ClampedArray(width * height * 4).fill(255) }; } };
  return { width, height, getContext: () => context };
}
function fixture(t, { referenceLength = 80, sourceFacing = 'right' } = {}) {
  const agent = { tribe: 'bean', attributes: { antenna: 1 }, health: 10,
    birth: { startedAt: 10, readyAt: 13 } };
  const animation = UNIT_BIRTH_ART['bean/antenna'];
  const previous = { ...animation };
  t.after(() => { for (const key of Object.keys(animation)) delete animation[key]; Object.assign(animation, previous); });
  const samples = [null, { frame: 1, destination: [100.25, 200.75, 80, 80] },
    { frame: 0, destination: [200, 300, 80, 80] }, { frame: 1, destination: [300, 397, 80, 80] }];
  const body = { role: 'body', wholeBody: true, image: 'test/body', frameSize: 512, frameHeight: 512,
    columns: 2, frameCount: 2, samples };
  const environment = { role: 'environment', image: 'test/environment', frameSize: 128, frameHeight: 64,
    columns: 2, frameCount: 2, samples: samples.map((_, index) => ({ frame: index % 2, destination: [0, 0, 512, 512] })) };
  Object.assign(animation, { image: 'test/fallback', frameSize: 512, frameHeight: 512, columns: 2,
    frameCount: 4, frames: [0, 1, 2, 3], durationsMs: [40, 20, 40, 650], loop: false,
    pivotX: 400.125, pivotY: 397, referenceLength, sourceFacing,
    fullScene: true, worldTravelIncludedInPixels: true, sceneLayers: { version: 1, layers: [environment, body] } });
  return { agent, animation, body, environment, at: ms => 10 + ms / 750 * 3 };
}
function renderer(load = async image => ({ image })) {
  const requested = [];
  return { requested, art: createUnitActionArt(value => value, surface, image => { requested.push(image); return load(image); }) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('whole-body scene uses master frame timing, arbitrary readyAt and final hold', async t => {
  const { agent, animation, at } = fixture(t);
  const { art, requested } = renderer();
  await art.prepare(agent, at(0));
  assert.deepEqual(requested.sort(), ['test/body', 'test/environment']);
  for (const [ms, expected] of [[0, 0], [39.999, 0], [40, 1], [59.999, 1], [60, 2], [100, 3], [749.999, 3]]) {
    const pose = unitActionArtPose(agent, at(ms));
    assert.equal(pose.frame, expected);
    assert.equal(pose.animation, animation);
    assert.equal(art.readyFrame(agent, at(ms)), true);
    assert.equal(art.readyAction(agent, at(ms)), true);
    assert.ok(art.frame(agent, at(ms)));
  }
  assert.notEqual(unitActionArtPose(agent, 13).action, 'birth');
  assert.equal(animation.worldTravelIncludedInPixels, true);
  assert.equal(animation.fullScene, true);
});

test('null body samples draw only environment and no outline; whole body gets one outline', async t => {
  const { agent, at } = fixture(t);
  const { art } = renderer();
  await art.prepare(agent, at(0));
  for (const ms of [0, 40, 60, 100]) {
    const context = surface(512, 512).getContext('2d'), outlined = [];
    art.draw(context, agent, at(ms), 123, 456, 80 / unitDisplaySize(agent), false,
      (...args) => outlined.push(args));
    assert.deepEqual(context.calls.map(call => call[0].image), ms ? ['test/environment', 'test/body'] : ['test/environment']);
    assert.equal(outlined.length, ms ? 1 : 0);
    if (ms) assert.equal(outlined[0][1].image, 'test/body');
    assert.deepEqual(context.transforms, [['translate', 123, 456], ['scale', 1, 1]]);
    if (ms === 40) assert.deepEqual(context.calls[1].slice(1), [512, 0, 512, 512, -299.875, -196.25, 80, 80]);
  }
});

test('scene mirroring uses authored facing once, without extra travel or body rotations', async t => {
  const { agent, animation, at } = fixture(t);
  const { art } = renderer();
  await art.prepare(agent, at(40));
  for (const sourceFacing of ['left', 'right']) for (const mirror of [false, true]) {
    animation.sourceFacing = sourceFacing;
    const context = surface(512, 512).getContext('2d');
    art.draw(context, agent, at(40), 17, 19, 80 / unitDisplaySize(agent), mirror);
    assert.deepEqual(context.transforms, [['translate', 17, 19], ['scale', (sourceFacing === 'left') !== mirror ? -1 : 1, 1]]);
    assert.equal(context.calls.length, 2);
  }
});

test('partial layers are not ready and never trigger baked or idle downloads', async t => {
  const { agent, at } = fixture(t);
  let finishBody;
  const { art, requested } = renderer(image => image === 'test/body' ? new Promise(resolve => { finishBody = resolve; }) : Promise.resolve({ image }));
  const prepared = art.prepare(agent, at(40));
  await tick();
  assert.equal(art.readyFrame(agent, at(40)), false);
  assert.equal(art.readyAction(agent, at(40)), false);
  assert.equal(art.frame(agent, at(40)), null);
  const context = surface(512, 512).getContext('2d');
  art.draw(context, agent, at(40), 0, 0, 100, false);
  assert.equal(context.calls.length, 0);
  assert.deepEqual(requested.sort(), ['test/body', 'test/environment']);
  finishBody({ image: 'test/body' }); await prepared;
  assert.equal(art.readyAction(agent, at(40)), true);
});

test('layer failure falls back atomically, retries with backoff and returns to layers', async t => {
  const { agent, at } = fixture(t);
  let now = 1000, failures = 1;
  t.mock.method(Date, 'now', () => now);
  const { art, requested } = renderer(async image => {
    if (image === 'test/body' && failures-- > 0) throw new Error('network');
    return { image };
  });
  await art.prepare(agent, at(40));
  assert.equal(art.readyAction(agent, at(40)), true);
  assert.deepEqual(requested, ['test/environment', 'test/body', 'test/fallback']);
  const context = surface(512, 512).getContext('2d');
  art.draw(context, agent, at(40), 0, 0, 100, false);
  assert.deepEqual(context.calls.map(call => call[0].image), ['test/fallback']);
  await art.prepare(agent, at(40));
  assert.equal(requested.length, 3);
  now += 1001;
  await art.prepare(agent, at(40));
  const retried = art.frame(agent, at(40)).getContext('2d');
  assert.deepEqual(retried.calls.map(call => call[0].image), ['test/environment', 'test/body']);
  assert.equal(requested.filter(image => image === 'test/body').length, 2);
});

test('failure of layers and baked fallback remains unready then retries safely', async t => {
  const { agent, at } = fixture(t);
  let now = 1000, fail = true;
  t.mock.method(Date, 'now', () => now);
  const { art } = renderer(async image => {
    if (fail) throw new Error('offline');
    return { image };
  });
  await art.prepare(agent, at(40));
  assert.equal(art.readyFrame(agent, at(40)), false);
  assert.equal(art.frame(agent, at(40)), null);
  fail = false; now += 1001;
  await art.prepare(agent, at(40));
  assert.equal(art.readyAction(agent, at(40)), true);
});

test('invalid schema and invalid sample destinations use legacy baked rendering', async t => {
  const { agent, body, at } = fixture(t);
  body.samples[1].destination[0] = NaN;
  const { art, requested } = renderer();
  await art.prepare(agent, at(40));
  assert.deepEqual(new Set(requested), new Set([unitActionArtDefinition(agent).reference.image, 'test/fallback']));
  const context = art.frame(agent, at(40)).getContext('2d');
  assert.deepEqual(context.calls.map(call => call[0].image), ['test/fallback']);
});

test('undersized decoded layer atlas fails over instead of drawing partial body', async t => {
  const { agent, at } = fixture(t);
  const { art } = renderer(async image => ({ image, width: 1, height: 1 }));
  await art.prepare(agent, at(40));
  assert.deepEqual(art.frame(agent, at(40)).getContext('2d').calls.map(call => call[0].image), ['test/fallback']);
});

test('unlayered birth keeps exact baked crop, reference loading and callback behavior', async t => {
  const { agent, animation, at } = fixture(t);
  delete animation.sceneLayers;
  const { art, requested } = renderer();
  await art.prepare(agent, at(40));
  assert.deepEqual(new Set(requested), new Set([unitActionArtDefinition(agent).reference.image, 'test/fallback']));
  const context = surface(512, 512).getContext('2d'); let outlines = 0;
  art.draw(context, agent, at(40), 123, 456, 80 / unitDisplaySize(agent), false, () => outlines++);
  assert.deepEqual(context.calls[0].slice(1), [512, 0, 512, 512, -400.125, -397, 512, 512]);
  assert.equal(outlines, 1);
  assert.equal(context.calls.length, 1);
});

test('timeless ready keeps reference semantics while timed scene readiness skips idle decode', async t => {
  const { agent, at } = fixture(t);
  const { art } = renderer();
  await art.prepare(agent, at(40));
  assert.equal(art.ready(agent), false);
  assert.equal(art.readyFrame(agent, at(40)), true);
  await art.prepare({ ...agent, birth: null }, 13);
  assert.equal(art.ready(agent), true);
});

test('scene samples follow mapped pose.frame rather than elapsed frame index', async t => {
  const { agent, animation, at } = fixture(t);
  animation.frames = [3, 2, 1, 0];
  const { art } = renderer();
  await art.prepare(agent, at(0));
  assert.equal(unitActionArtPose(agent, at(0)).frame, 3);
  assert.equal(art.frame(agent, at(0)).getContext('2d').calls.length, 2);
  assert.equal(unitActionArtPose(agent, at(100)).frame, 0);
  assert.equal(art.frame(agent, at(100)).getContext('2d').calls.length, 1);
});

test('layers without their own reference length still load the legacy scale reference', async t => {
  const { agent, at } = fixture(t, { referenceLength: undefined });
  // Remove the fixture default explicitly to exercise older opt-in metadata.
  delete UNIT_BIRTH_ART['bean/antenna'].referenceLength;
  const { art, requested } = renderer();
  await art.prepare(agent, at(40));
  assert.ok(requested.includes(unitActionArtDefinition(agent).reference.image));
  assert.ok(!requested.includes('test/fallback'));
  assert.equal(art.readyFrame(agent, at(40)), true);
  assert.equal(art.frame(agent, at(40)).getContext('2d').calls.length, 2);
});

test('malformed layer contracts fall back safely without loading any partial layer', async t => {
  const { agent, animation, at } = fixture(t);
  const valid = structuredClone(animation.sceneLayers);
  const corruptions = [
    scene => { scene.version = 2; },
    scene => { scene.layers[0] = null; },
    scene => { scene.layers[1].wholeBody = false; },
    scene => { scene.layers.push(structuredClone(scene.layers[1])); },
    scene => { scene.layers[1].samples[1].frame = 1000; },
    scene => { scene.layers[1].samples[1].destination[2] = -1; },
    scene => { scene.layers[1].samples.pop(); },
    scene => { scene.layers[1].columns = 0; },
  ];
  for (const corrupt of corruptions) {
    animation.sceneLayers = structuredClone(valid); corrupt(animation.sceneLayers);
    const { art, requested } = renderer();
    await art.prepare(agent, at(40));
    assert.deepEqual(art.frame(agent, at(40)).getContext('2d').calls.map(call => call[0].image), ['test/fallback']);
    assert.equal(requested.includes('test/body'), false);
    assert.equal(requested.includes('test/environment'), false);
  }
});

test('slow fallback finishing after recovery cannot replace the whole-body scene', async t => {
  const { agent, at } = fixture(t);
  let now = 1000, bodyAttempts = 0, finishFallback;
  t.mock.method(Date, 'now', () => now);
  const { art } = renderer(image => {
    if (image === 'test/body' && bodyAttempts++ === 0) return Promise.reject(new Error('temporary'));
    if (image === 'test/fallback') return new Promise(resolve => { finishFallback = resolve; });
    return Promise.resolve({ image });
  });
  const preparing = art.prepare(agent, at(40));
  await tick(); now += 1001;
  await art.prepare(agent, at(40));
  assert.deepEqual(art.frame(agent, at(40)).getContext('2d').calls.map(call => call[0].image), ['test/environment', 'test/body']);
  finishFallback({ image: 'test/fallback' }); await preparing;
  assert.deepEqual(art.frame(agent, at(40)).getContext('2d').calls.map(call => call[0].image), ['test/environment', 'test/body']);
});

test('the original 14 bean/spore layered births render 1358 boundaries in both facings without hot-path promises or idle decode', async t => {
  const { ANTENNA_COMBO_ACTION_ART } = await import('./antenna-combo-assets.mjs');
  const { ANTENNA_COMBINATION_FORMS } = await import('./unit-combination-forms.mjs');
  const { createHook } = await import('node:async_hooks');
  const { createHash } = await import('node:crypto');
  const entries = Object.entries(ANTENNA_COMBO_ACTION_ART).filter(([key, definition]) => /^(bean|spore)\//.test(key) && definition.actions.birth?.sceneLayers);
  assert.equal(entries.length, 14);
  const atlases = new Map();
  for (const [, definition] of entries) for (const layer of definition.actions.birth.sceneLayers.layers) {
    atlases.set(layer.image, { image: layer.image,
      width: layer.columns * layer.frameSize,
      height: Math.ceil(layer.frameCount / layer.columns) * layer.frameHeight });
  }
  assert.equal(atlases.size, 16, 'shared environments must not acquire duplicate decoded entries');
  const requested = [];
  const art = createUnitActionArt(value => value, (width, height) => {
    const result = surface(width, height);
    result.getContext('2d').getImageData = () => { throw new Error('Layered birth must not decode/measure idle'); };
    return result;
  }, async image => {
    requested.push(image);
    assert.ok(atlases.has(image), `unexpected idle or baked fallback request: ${image}`);
    return atlases.get(image);
  });
  const agents = entries.map(([key]) => {
    const [tribe, formKey] = key.split('/');
    const form = ANTENNA_COMBINATION_FORMS.find(value => value.key === formKey);
    assert.ok(form);
    return { tribe, attributes: form.attributes, health: 10, birth: { startedAt: 53.125, readyAt: 62.875 } };
  });
  await Promise.all(agents.map(agent => art.prepare(agent, agent.birth.startedAt)));
  assert.equal(requested.length, 16, 'shared atlas requests must be deduplicated');
  assert.equal(new Set(requested).size, 16);
  const hash = createHash('sha256');
  let boundaries = 0, draws = 0, promises = 0;
  const hook = createHook({ init(_id, type) { if (type === 'PROMISE') promises++; } });
  const started = performance.now();
  hook.enable();
  try {
    for (const [entryIndex, [key, definition]] of entries.entries()) {
      const agent = agents[entryIndex], animation = definition.actions.birth;
      const duration = animation.durationsMs.reduce((sum, value) => sum + value, 0);
      assert.equal(duration, agent.tribe === 'bean' ? 3850 : 3120);
      assert.equal(animation.frameCount, agent.tribe === 'bean' ? 116 : 78);
      assert.equal(animation.fullScene, true);
      assert.equal(animation.worldTravelIncludedInPixels, true);
      let elapsed = 0;
      for (let index = 0; index < animation.durationsMs.length; index++) {
        const time = agent.birth.startedAt + elapsed / duration * (agent.birth.readyAt - agent.birth.startedAt);
        const pose = unitActionArtPose(agent, time);
        assert.equal(pose.animation, animation);
        assert.equal(pose.frame, animation.frames?.[index] ?? index, `${key} boundary ${index}`);
        assert.equal(art.readyFrame(agent, time), true);
        assert.equal(art.readyAction(agent, time), true);
        const visibleLayers = animation.sceneLayers.layers.filter(layer => layer.samples[pose.frame] !== null);
        for (const mirror of [false, true]) {
          const context = surface(512, 512).getContext('2d');
          let outlines = 0;
          // scale=1 keeps authored fractional destinations inspectable.
          art.draw(context, agent, time, 137, 251, animation.referenceLength / unitDisplaySize(agent), mirror,
            (_context, image) => { outlines++; assert.equal(image.image, animation.sceneLayers.layers[1].image); });
          assert.equal(context.calls.length, visibleLayers.length);
          assert.equal(outlines, visibleLayers.some(layer => layer.role === 'body') ? 1 : 0);
          assert.deepEqual(context.transforms, [['translate', 137, 251],
            ['scale', (animation.sourceFacing === 'left') !== mirror ? -1 : 1, 1]]);
          for (const [layerIndex, layer] of visibleLayers.entries()) {
            const sample = layer.samples[pose.frame], call = context.calls[layerIndex];
            assert.equal(call[0].image, layer.image);
            assert.deepEqual(call.slice(1, 5), [sample.frame % layer.columns * layer.frameSize,
              Math.floor(sample.frame / layer.columns) * layer.frameHeight, layer.frameSize, layer.frameHeight]);
            const expected = [sample.destination[0] - animation.pivotX, sample.destination[1] - animation.pivotY,
              sample.destination[2], sample.destination[3]];
            call.slice(5).forEach((value, coordinate) => assert.ok(Math.abs(value - expected[coordinate]) < 1e-9));
            assert.ok(call.slice(1).every(Number.isFinite));
          }
          hash.update(JSON.stringify([key, pose.frame, context.transforms,
            context.calls.map(call => [call[0].image, ...call.slice(1).map(value => Math.round(value * 1e9) / 1e9)])]));
          draws++;
        }
        assert.equal(art.frame(agent, time).getContext('2d').calls.length, visibleLayers.length);
        boundaries++;
        elapsed += animation.durationsMs[index];
      }
      assert.notEqual(unitActionArtPose(agent, agent.birth.readyAt).action, 'birth');
    }
  } finally { hook.disable(); }
  const elapsedMs = performance.now() - started;
  assert.equal(boundaries, 1358);
  assert.equal(draws, 2716);
  assert.equal(promises, 0, 'decoded scene rendering must not allocate asynchronous work');
  assert.equal(requested.length, 16, 'hot frames must not reload layers, references or fallback scenes');
  const rgbaBytes = [...atlases.values()].reduce((sum, image) => sum + image.width * image.height * 4, 0);
  const snapshot = hash.digest('hex');
  assert.equal(rgbaBytes, 518425600);
  assert.equal(snapshot, 'f95f4901fea1fa4f1763340bdfb98d4c9d368d49465434e2e1452449fc26a79b',
    'published source crops, destinations, facing and scene anchor snapshot');
  t.diagnostic(`Stub-only runtime: ${boundaries} boundaries, ${draws} facing draws, ${elapsedMs.toFixed(1)} ms; decoded atlas estimate ${rgbaBytes} bytes; snapshot ${snapshot}. No pixel decode or browser rendering measured.`);
});
