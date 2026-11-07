import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

// Node VM lifecycle tests, not browser automation or pixel evidence.
// Native header, createUnitPresentation, action-art preparation/readiness and clocks run.
// Image decoding, canvas rasterization, common asset setup and DOM are fakes.
const root = process.env.SPAWNER_ROOT || fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const sourcePath = process.env.WELCOME_HEADER_SOURCE || root + '/client/welcome-header.js';
const source = readFileSync(sourcePath, 'utf8');
const runtime = readFileSync(root + '/client/runtime.js', 'utf8');
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

async function headerHarness(t, initialControls = {}) {
  const controls = { failInitial: 0, failCurrent: false, holdInitial: false, holdWeasel: false, ...initialControls };
  const draws = [], paints = [], warnings = [], callbacks = new Map(), observers = [], listeners = new Map();
  const timers = new Set(), mediaListeners = [], loads = new Map(), actionLoads = new Map();
  let nextId = 1, now = 0, retryClock = 1000000, releaseInitial, releaseWeasel;
  const initialGate = new Promise(resolve => { releaseInitial = resolve; });
  const weaselGate = new Promise(resolve => { releaseWeasel = resolve; });
  const media = { matches: false, addEventListener: (name, fn) => mediaListeners.push(fn) };
  t.after(() => { for (const timer of timers) clearTimeout(timer); });
  function element(kind = 'div') {
    const value = { kind, className: '', width: 0, height: 0, hidden: false, parentNode: null, style: {}, dataset: {}, children: [],
      setAttribute() {}, append(...children) { this.children.push(...children); children.forEach(child => { child.parentNode = this; }); },
      prepend(child) { this.children.unshift(child); child.parentNode = this; }, before() {}, after() {},
      getBoundingClientRect: () => ({ width: 480, height: 280 }) };
    const context = { canvas: value, save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, setTransform() {}, clearRect() {},
      drawImage() { if (value.className === 'welcome-characters') paints.push(now); } };
    value.getContext = () => context;
    return value;
  }
  const stage = element(), title = element(), welcome = element(), waveform = element('canvas'), body = element();
  stage.parentNode = welcome;
  welcome.querySelector = selector => selector === '.welcome-stage' ? stage : selector === '.welcome-waveform' ? waveform : null;
  body.dataset.screen = 'welcome';
  const document = { hidden: false, body, createElement: element, getElementById: id => id === 'welcome' ? welcome : title,
    addEventListener: (name, fn) => listeners.set(name, fn) };
  const scope = createContext({ document, URL, Date: class extends Date { static now() { return retryClock; } },
    performance: { now: () => now }, devicePixelRatio: 1, matchMedia: () => media,
    console: { warn: (...args) => warnings.push(args.map(String)) },
    setTimeout(fn, ms) { const timer = setTimeout(fn, ms); timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); },
    requestAnimationFrame(fn) { const id = nextId++; callbacks.set(id, fn); return id; },
    cancelAnimationFrame: id => callbacks.delete(id),
    ResizeObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe(target) { this.target = target; } },
    MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe(target, options) { this.target = target; this.options = options; } }
  });
  runInContext(runtime, scope);
  const native = scope.Spawner, images = new Map();
  function image(path) {
    if (!images.has(path)) images.set(path, { complete: true, naturalWidth: 1024, width: 1024, height: 1024, path });
    return images.get(path);
  }
  const sheets = new Map(['bean', 'spore', 'pebble', 'spring'].map(key => [key, new Map()]));
  const assets = { images, sheets, baseParts: new Map(), displayScale: () => 1, prepareDisplaySize() {},
    tribeArt: { prepareBounds: async () => ({ x: 0, y: 0, width: 264, height: 111 }), bounds: () => ({ x: 0, y: 0, width: 264, height: 111 }) },
    async loadImage(path) {
      loads.set(path, (loads.get(path) || 0) + 1);
      if (path.endsWith('BaseParts/green-foot.png')) {
        if (controls.holdInitial) await initialGate;
        if (controls.failInitial > 0) { controls.failInitial--; throw new Error('injected common decode rejection'); }
      }
      if (controls.holdWeasel && path.includes('/shadow-weasel/')) await weaselGate;
      return image(path);
    },
    async prepareTribe(key) {
      for (const action of ['idle', 'walk']) sheets.get(key).set(action, { animation: native.UNIT_ANIMATIONS[key][action], sprite: image(key + action), scale: 1 });
    }
  };
  const order = ['bean', 'spore', 'pebble', 'spring', 'shadow-weasel', 'bean', 'spore'];
  let rosterIndex = 0;
  scope.Spawner = { ...native, createUnitPresentationAssets: () => assets, createSproutRoots: () => ({}),
    createWelcomeRoster: () => () => Object.freeze({ key: order[rosterIndex++ % order.length], variant: 0 }),
    createUnitPresentation: options => ({
      ...native.createUnitPresentation(options),
      prepareSproutCombatFrames() {}, drawAgentAppearanceBody() {},
      drawRootMotion(context, time, agent, cell, topLeft, position, outline, draw) {
        draws.push({ key: agent.tribe, time: options.time(), mode: agent.mode, x: topLeft.x + cell / 2 }); draw();
      }
    }),
    drawCreaturePresentation(context, pose, x) {
      draws.push({ key: pose.species, time: scope.__state().timeline, mode: pose.action, frame: pose.frame, mirror: pose.mirrorX, x }); return true;
    }
  };
  scope.SpawnerAssets = { welcomeReady: Promise.resolve(), ready: Promise.resolve(), source: path => path,
    image: () => ({ complete: true, naturalWidth: 1024, naturalHeight: 1024, src: '',
      async decode() {
        actionLoads.set(this.src, (actionLoads.get(this.src) || 0) + 1);
        const definition = native.unitActionArtDefinition({ tribe: 'bean', attributes: {} });
        const actions = controls.failCurrent === true ? ['idle', 'walk'] : [controls.failCurrent];
        if (actions.some(action => action && definition.actions[action].image === this.src))
          throw new Error('injected actual action-art image decode rejection');
      }
    }) };

  const audio = { create: () => ({}), reset() {}, update: () => [], definitions: {}, cue: () => null, material: () => null };
  scope.SpawnerMovementAudio = scope.SpawnerCombatAudio = audio;
  const anchor = /  startPresentation = (?:async )?\(\) => \{/;
  assert.match(source, anchor);
  const instrumented = source.replace(anchor, match => `  globalThis.__state = () => ({ current: { ...current }, phase, elapsed, timeline, phaseStartedAt, previousTime, started, resourcesReady,
    departing: departing.map(value => ({ choice: { ...value.choice }, startedAt: value.startedAt })), upcoming: upcoming && { choice: { ...upcoming.choice }, ready: upcoming.ready }, width, height });\n${match}`);
  runInContext(instrumented, scope, { filename: 'welcome-header-under-test.js' });
  await scope.SpawnerWelcomeHeaderReady;
  observers.find(observer => observer.target?.kind === 'canvas').fn();
  async function tick(at) {
    now = at;
    const scheduled = [...callbacks]; callbacks.clear();
    for (const [, fn] of scheduled) fn(at);
    await flush();
  }
  function signalVisibility(hidden) { document.hidden = hidden; listeners.get('visibilitychange')(); }
  function signalScreen(screen) { body.dataset.screen = screen; observers.filter(observer => observer.target === body).forEach(observer => observer.fn()); }
  function signalReduced(value) { media.matches = value; mediaListeners.forEach(fn => fn()); }
  return { controls, draws, paints, warnings, callbacks, observers, loads, actionLoads, scope, tick, signalVisibility, signalScreen, signalReduced,
    advanceRetryClock: () => { retryClock += 1001; },
    releaseInitial, releaseWeasel, state: () => JSON.parse(JSON.stringify(scope.__state())),
    start: () => scope.SpawnerWelcomeHeader.start(), resources: () => scope.SpawnerWelcomeHeader.presentationResources() };
}

async function reach(harness, predicate, start = 0, end = 90000) {
  for (let time = start; time <= end; time += 20) { await harness.tick(time); if (predicate(harness.state())) return time; }
  assert.fail('Target lifecycle state was not reached.');
}

const greenFoot = 'DesignAssets/Units/BaseParts/green-foot.png';

test('initial decode retry stays bounded and a later explicit start recovers the same appearance', async t => {
  const h = await headerHarness(t, { failInitial: Infinity });
  assert.equal(h.state().started, false);
  assert.equal(await h.start(), false);
  assert.equal(h.loads.get(greenFoot), 2);
  assert.equal(h.callbacks.size, 0);
  assert.equal(h.paints.length, 0);
  assert.equal(h.resources(), null);
  assert.deepEqual(h.state().current, { key: 'bean', variant: 0 });
  await flush();
  assert.equal(h.loads.get(greenFoot), 2, 'No automatic retry loop after both failures');
  const observerCount = h.observers.length;
  h.controls.failInitial = 0;
  assert.equal(await h.start(), true);
  assert.equal(h.loads.get(greenFoot), 3);
  assert.equal(h.observers.length, observerCount);
  assert.equal(h.state().started, true);
  assert.ok(h.resources());
  assert.equal(h.callbacks.size, 1);
  assert.deepEqual(h.state().current, { key: 'bean', variant: 0 });
});

test('initial transient failure succeeds once and simultaneous start calls share preparation', async t => {
  const h = await headerHarness(t, { holdInitial: true, failInitial: 1 });
  const first = h.start(), second = h.start();
  assert.equal(first, second);
  await flush();
  assert.equal(h.state().started, false);
  assert.equal(h.callbacks.size, 0);
  assert.equal(h.paints.length, 0);
  assert.equal(h.resources(), null);
  h.releaseInitial();
  assert.equal(await first, true);
  assert.equal(h.loads.get(greenFoot), 2);
  assert.equal(h.callbacks.size, 1);
  const loadCount = h.loads.get(greenFoot);
  assert.equal(await h.start(), true);
  assert.equal(h.loads.get(greenFoot), loadCount);
});

for (const failedAction of ['idle', 'walk']) test(`actual swallowed ${failedAction} decode failure never starts blank or changes appearance`, async t => {
  const h = await headerHarness(t, { failCurrent: failedAction });
  assert.equal(await h.start(), false);
  assert.equal(h.loads.get(greenFoot), 1);
  assert.equal(h.state().started, false);
  assert.deepEqual(h.state().current, { key: 'bean', variant: 0 });
  assert.equal(h.state().upcoming, null);
  assert.equal(h.callbacks.size, 0);
  assert.equal(h.paints.length, 0);
  assert.equal(h.resources(), null);
  assert.ok(h.warnings.some(values => values.join(' ').includes('Missing welcome appearance assets: bean')));
  const definition = h.scope.Spawner.unitActionArtDefinition({ tribe: 'bean', attributes: {} });
  assert.equal(h.actionLoads.get(definition.actions[failedAction].image), 1, 'Actual image request cooldown suppresses the immediate second decode');
  h.controls.failCurrent = false;
  h.advanceRetryClock();
  assert.equal(await h.start(), true);
  assert.equal(h.actionLoads.get(definition.actions[failedAction].image), 2);
  assert.equal(h.loads.get(greenFoot), 1, 'Successfully prepared common assets are reused');
});

test('reduced-motion toggling during overlap draws one character and resumes the preserved clock', async t => {
  const h = await headerHarness(t); await h.start();
  const time = await reach(h, state => state.current.key === 'shadow-weasel' && state.phase === 'enter' && state.departing.length > 0);
  const before = h.state(), drawCount = h.draws.length;
  h.signalReduced(true);
  const reduced = h.draws.slice(drawCount);
  assert.equal(reduced.length, 1);
  assert.equal(reduced[0].key, 'shadow-weasel');
  assert.equal(reduced[0].x, 240);
  assert.equal(h.callbacks.size, 0);
  assert.equal(h.state().timeline, before.timeline);
  assert.deepEqual(h.state().departing, before.departing);
  h.signalVisibility(true); h.signalVisibility(false);
  assert.equal(h.callbacks.size, 0);
  h.signalReduced(false);
  assert.equal(h.callbacks.size, 1);
  await h.tick(time + 100000);
  assert.equal(h.state().timeline, before.timeline);
  await h.tick(time + 100020);
  assert.ok(Math.abs(h.state().timeline - before.timeline - .02) < 1e-10);
  assert.equal(h.state().phase, 'enter');
  assert.equal(h.state().current.key, 'shadow-weasel');
});

test('reduced-motion during asset waiting keeps one existing identity until preparation completes', async t => {
  const h = await headerHarness(t, { holdWeasel: true }); await h.start();
  const time = await reach(h, state => state.phase === 'waiting' && state.upcoming?.choice.key === 'shadow-weasel');
  const before = h.state(), drawCount = h.draws.length;
  h.signalReduced(true);
  const reduced = h.draws.slice(drawCount);
  assert.equal(reduced.length, 1);
  assert.equal(reduced[0].key, 'spring');
  assert.equal(reduced[0].x, 240);
  assert.equal(h.state().upcoming.ready, false);
  assert.equal(h.callbacks.size, 0);
  h.signalReduced(false); await h.tick(time + 100000);
  assert.equal(h.state().current.key, 'spring');
  assert.equal(h.state().timeline, before.timeline);
  h.releaseWeasel(); await flush();
  await h.tick(time + 100020);
  assert.equal(h.state().current.key, 'shadow-weasel');
  assert.equal(h.state().phase, 'enter');
});

test('normal native header lifecycle and hidden/game return retain valid left-facing weasel motion', async t => {
  const h = await headerHarness(t); await h.start();
  await reach(h, state => state.current.key === 'shadow-weasel' && state.phase === 'perform');
  await reach(h, state => state.departing.some(departure => departure.choice.key === 'shadow-weasel'), 44000);
  const weaselDraws = h.draws.filter(draw => draw.key === 'shadow-weasel');
  assert.ok(weaselDraws.some(draw => draw.mode === 'walk'));
  assert.ok(weaselDraws.some(draw => draw.mode === 'idle'));
  assert.ok(weaselDraws.every(draw => draw.mirror === false));
  assert.equal(h.warnings.length, 0);
  const paused = h.state().timeline;
  h.signalVisibility(true); assert.equal(h.callbacks.size, 0);
  h.signalVisibility(false); await h.tick(200000);
  assert.equal(h.state().timeline, paused);
  await h.tick(200020);
  assert.ok(Math.abs(h.state().timeline - paused - .02) < 1e-10);
  h.signalScreen('game'); assert.equal(h.callbacks.size, 0);
  h.signalScreen('welcome'); const beforeReturn = h.state().timeline;
  await h.tick(300000);
  assert.equal(h.state().timeline, beforeReturn);
  assert.equal(h.callbacks.size, 1);
});
