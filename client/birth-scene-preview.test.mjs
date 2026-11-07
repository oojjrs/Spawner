import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

function harness(count = 1, suppliedClip = null) {
  const images = [], observers = [], mutations = [], events = {}, draws = [], transforms = [], mirrors = [], clears = [], canvases = [];
  const classes = new Set(['is-open']);
  const context = { translate(...args) { mirrors.push(["translate", ...args]); }, scale(...args) { mirrors.push(["scale", ...args]); }, setTransform(...args) { transforms.push(args); }, clearRect(...args) { clears.push(args); }, drawImage(...args) { draws.push(args); } };
  const canvas = () => { const value = { width: 1, height: 1, style: {}, dataset: {}, getContext: () => context, getBoundingClientRect: () => ({ width: 512 }) }; canvases.push(value); return value; };
  const thumbnail = { style: {}, after() {} };
  const layers = [
    { role: 'environment', image: 'environment.png', frameSize: 434, frameHeight: 424, columns: 8, samples: [{ frame: 9, destination: [49, 29, 434, 424] }, null] },
    { role: 'body', wholeBody: true, image: 'body.png', frameSize: 512, frameHeight: 512, columns: 8, samples: [null, { frame: 2, destination: [400, 410, 80, 80] }] }
  ];
  const clip = suppliedClip || { frameSize: 512, durationsMs: [40, 650], sceneLayers: { version: 1, layers } };
  const link = { dataset: { birthScene: JSON.stringify(clip) }, querySelector: () => thumbnail };
  const links = Array.from({ length: count }, () => ({ ...link, querySelector: () => ({ style: {}, after() {} }) }));
  links[0] = link;
  const lightbox = { classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) }, querySelector: () => ({ after() {} }) };
  const document = { hidden: false, querySelector: () => ({ contains: () => true }), querySelectorAll: selector => selector.includes('data-birth-scene') ? links : [],
    createElement: canvas, getElementById: id => id === 'image-lightbox' ? lightbox : null,
    addEventListener(name, callback) { (events[name] ||= []).push(callback); } };
  class Image {
    constructor() { images.push(this); this.naturalWidth = 4096; }
    set src(path) { this.path = path; }
    getAttribute() { return this.path; }
    removeAttribute() { this.path = null; }
  }
  const sandbox = { document, window: { devicePixelRatio: 1 }, Image, performance: { now: () => 0 },
    IntersectionObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} unobserve() {} },
    MutationObserver: class { constructor(callback) { mutations.push(callback); } observe() {} }, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, addEventListener() {}, queueMicrotask,
    SpawnerUnitMatrixData: { units: {}, attributes: {}, bounds: {} } };
  vm.runInNewContext(fs.readFileSync(new URL('./unit-matrix-preview.js', import.meta.url), 'utf8'), sandbox);
  return { api: sandbox.SpawnerBirthScenePreview, images, observers, mutations, links, link, thumbnail, draws, transforms, mirrors, clears, canvases, document, events, classes };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('birth scenes load only on visibility, draw rectangular atlas cells and exact timeline samples', async () => {
  const h = harness(); assert.equal(h.images.length, 0);
  h.observers.at(-1).callback([{ target: h.link, isIntersecting: true }]);
  assert.equal(h.images.length, 2); h.images.forEach(image => image.onload()); await settle();
  assert.equal(h.thumbnail.style.display, 'none');
  assert.deepEqual(h.draws.at(-1).slice(1), [434, 424, 434, 424, 49, 29, 434, 424]);
  h.api.drawScene(h.api.scenes[0], 40);
  assert.deepEqual(h.draws.at(-1).slice(1), [1024, 0, 512, 512, 400, 410, 80, 80]);
  h.api.drawScene(h.api.scenes[0], 689); assert.equal(h.api.scenes[0].frame, 1);
  h.api.drawScene(h.api.scenes[0], 690); assert.equal(h.api.scenes[0].frame, 0);
  h.observers.at(-1).callback([{ target: h.link, isIntersecting: false }]);
  assert.equal(h.api.resources.size, 0); assert.ok(h.images.every(image => image.path === null));
  assert.equal(h.thumbnail.style.display, '');
});
test('failed scene layer restores the original preview and releases both decoded atlases', async () => {
  const h = harness(); h.observers.at(-1).callback([{ target: h.link, isIntersecting: true }]);
  h.images[0].onerror(); await settle();
  assert.equal(h.api.scenes[0].failed, true); assert.equal(h.api.resources.size, 0);
  assert.equal(h.thumbnail.style.display, ''); assert.equal(h.api.scenes[0].canvas.style.display, 'none');
});
test('offscreen pending loads cannot resurrect a scene', async () => {
  const h = harness(); h.observers.at(-1).callback([{ target: h.link, isIntersecting: true }]);
  h.observers.at(-1).callback([{ target: h.link, isIntersecting: false }]);
  h.images.forEach(image => image.onload()); await settle();
  assert.equal(h.api.scenes[0].ready, false); assert.equal(h.api.resources.size, 0);
});
test('lightbox shares live atlases and keeps the original fallback until both layers load', async () => {
  const h = harness(); h.observers.at(-1).callback([{ target: h.link, isIntersecting: true }]);
  h.images.forEach(image => image.onload()); await settle();
  for (const callback of h.events.click) callback({ target: { closest: () => h.link }, button: 0 });
  await settle();
  assert.equal(h.images.length, 2); assert.ok(h.classes.has('is-unit-animation'));
  assert.ok([...h.api.resources.values()].every(resource => resource.references === 2));
});

test('visible scene work is bounded and queued panels advance when earlier rows leave', async () => {
  const h = harness(6);
  h.observers.at(-1).callback(h.links.map(target => ({ target, isIntersecting: true })));
  assert.equal(h.api.scenes.filter(scene => scene.resources).length, 4);
  assert.equal(h.images.length, 2); // identical atlases are decoded once across all users
  h.images.forEach(image => image.onload()); await settle();
  h.observers.at(-1).callback([{ target: h.links[0], isIntersecting: false }]);
  await settle();
  assert.equal(h.api.scenes[4].ready, true);
  assert.equal(h.api.scenes.filter(scene => scene.resources).length, 4);
});
test('closing lightbox releases its references; hiding document releases remaining atlases', async () => {
  const h = harness(); h.observers.at(-1).callback([{ target: h.link, isIntersecting: true }]);
  h.images.forEach(image => image.onload()); await settle();
  for (const callback of h.events.click) callback({ target: { closest: () => h.link }, button: 0 });
  await settle();
  h.classes.delete('is-open'); h.mutations.at(-1)();
  assert.ok([...h.api.resources.values()].every(resource => resource.references === 1));
  h.document.hidden = true;
  for (const callback of h.events.visibilitychange) callback();
  assert.equal(h.api.resources.size, 0);
});

// Exercise the publisher's real normalization rather than a synthetic square-only fixture.
const publishedScenes = JSON.parse(execFileSync('python', ['-c', `
import importlib.util,json
spec=importlib.util.spec_from_file_location('publisher','scripts/publish-antenna-combo-docs.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
result=[]
for relative in json.loads(m.INDEX.read_text()):
    publication=json.loads((m.ROOT/relative).read_text())
    birth=publication['actions']['birth']
    if birth.get('sceneLayers'):
        result.append({'tribe':publication['tribe'],'form':publication['form'],
            'source':birth,'clip':m.birth_scene_clip(birth)})
print(json.dumps(result))
`], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }));

test('all 18 real publication payloads preserve complete bodies, frame counts and hashed atlases', () => {
  assert.equal(publishedScenes.length, 18);
  assert.equal(publishedScenes.filter(item => item.tribe === 'spore').length, 7);
  assert.equal(publishedScenes.filter(item => item.tribe === 'bean').length, 7);
  for (const { tribe, source, clip } of publishedScenes) {
    assert.equal(clip.frameSize, tribe === 'spring' ? 480 : tribe === 'spore' ? 768 : 512);
    assert.equal(clip.frameHeight, tribe === 'spring' ? 480 : 512);
    assert.deepEqual(clip.durationsMs, source.durationsMs);
    assert.equal(clip.durationsMs.length, source.frameCount);
    assert.deepEqual(clip.sceneLayers.layers.map(layer => layer.role), ['environment', 'body']);
    for (const layer of clip.sceneLayers.layers) {
      assert.equal(layer.samples.length, source.frameCount);
      assert.ok(layer.image.endsWith('/' + layer.imageSHA256 + '.png'));
      const header = Buffer.alloc(24), fd = fs.openSync(new URL('../' + layer.image, import.meta.url), 'r');
      try { fs.readSync(fd, header, 0, 24, 0); } finally { fs.closeSync(fd); }
      assert.equal(header.readUInt32BE(16), layer.columns * layer.frameSize);
      assert.equal(header.readUInt32BE(20), Math.ceil(layer.frameCount / layer.columns) * layer.frameHeight);
      if (layer.role === 'body') { assert.equal(layer.wholeBody, true); assert.equal(layer.frameSize, tribe === 'spring' ? 316 : 512); assert.equal(layer.frameHeight, tribe === 'spring' ? 312 : 512); }
      for (const sample of layer.samples.filter(Boolean)) {
        assert.ok(Number.isInteger(sample.frame) && sample.frame >= 0 && sample.frame < layer.frameCount);
        assert.equal(sample.destination.length, 4); assert.ok(sample.destination.every(Number.isFinite));
        assert.ok(sample.destination[2] > 0 && sample.destination[3] > 0);
      }
    }
  }
});

for (const { tribe, form, clip } of publishedScenes) test(`${tribe} ${form}: real scene transforms and every master sample render in table and rectangular lightbox`, async () => {
  const h = harness(1, clip);
  h.observers.at(-1).callback([{ target: h.link, isIntersecting: true }]);
  h.images.forEach(image => image.onload()); await settle();
  const scene = h.api.scenes[0];
  assert.equal(scene.canvas.width, 512);
  assert.equal(scene.canvas.height, Math.round(512 * clip.frameHeight / clip.frameSize));
  assert.equal(scene.canvas.style.objectFit, 'contain');
  assert.equal(scene.mirror, clip.sourceFacing !== 'left');
  if (scene.mirror) assert.deepEqual(h.mirrors.slice(-2), [['translate', clip.frameSize, 0], ['scale', -1, 1]]);
  let time = 0;
  for (let index = 0; index < clip.durationsMs.length; index++) {
    h.api.drawScene(scene, time);
    assert.equal(scene.frame, index);
    assert.deepEqual(h.clears.at(-1), [0, 0, clip.frameSize, clip.frameHeight]);
    assert.ok(h.transforms.at(-1).every(Number.isFinite));
    assert.equal(h.transforms.at(-1)[0], 512 / clip.frameSize);
    time += clip.durationsMs[index];
  }
  assert.ok(h.draws.every(args => args.slice(1).every(Number.isFinite)));
  for (const callback of h.events.click) callback({ target: { closest: () => h.link }, button: 0 });
  await settle();
  const lightCanvas = h.canvases.at(-1);
  assert.equal(lightCanvas.id, 'unit-lightbox-canvas');
  assert.equal(lightCanvas.width, 512);
  assert.equal(lightCanvas.height, Math.round(512 * clip.frameHeight / clip.frameSize));
  if (scene.mirror) assert.deepEqual(h.mirrors.slice(-2), [['translate', clip.frameSize, 0], ['scale', -1, 1]]);
  assert.equal(lightCanvas.style.width, undefined); // existing CSS/zoom continues to own sizing
  assert.equal(lightCanvas.style.height, undefined);
  assert.ok(h.classes.has('is-unit-animation'));
});
