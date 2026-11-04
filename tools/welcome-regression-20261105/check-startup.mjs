// Browser-free control-flow regression. Canvas pixels and real network are not tested.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createWelcomeRoster, prepareWelcomeChoice, drawWelcomeChoice } from '../../client/welcome-presentation.mjs';
const source = await readFile(new URL('../../client/welcome-header.js', import.meta.url), 'utf8');
async function run(failedPart, reduced, viewportWidth) {
  let frames = 0, spriteDraws = 0;
  const warnings = [];
  const context = new Proxy({}, { get: (_, key) => key === 'drawImage' ? image => {
    if (image.src?.startsWith('bean-')) spriteDraws++;
  } : () => {} });
  const node = () => ({ style: {}, parentNode: {}, setAttribute() {}, before() {}, after() {}, prepend() {},
    getContext: () => context, getBoundingClientRect: () => ({ width: viewportWidth, height: 280 }) });
  const stage = node();
  const welcome = { ...node(), hidden: false, querySelector: selector => selector === '.welcome-stage' ? stage : null };
  const animation = image => ({ image, frameSize: 512, columns: 1, pivotX: 256, pivotY: 460, durationsMs: [100], durationMs: 100 });
  const tribes = ['bean', 'spore', 'pebble', 'spring'];
  const sandbox = {
    console: { warn: (...args) => warnings.push(args) }, setTimeout,
    document: { hidden: false, body: { dataset: { screen: 'welcome' } }, addEventListener() {},
      getElementById: id => id === 'welcome' ? welcome : node(), createElement: node },
    Image: class { naturalWidth = 512; naturalHeight = 512; async decode() {
      if (failedPart && this.src.endsWith('/' + failedPart + '.png')) throw new Error('Injected decode failure');
    } },
    matchMedia: () => ({ matches: reduced, addEventListener() {} }), devicePixelRatio: 2,
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } },
    MutationObserver: class { observe() {} },
    requestAnimationFrame() { frames++; return frames; }, cancelAnimationFrame() {},
    SpawnerAssets: { welcomeReady: Promise.resolve(), ready: Promise.resolve(), source: value => value },
    SpawnerMovementAudio: { create: () => ({}), reset() {} },
    SpawnerCombatAudio: { create: () => ({}), reset() {} },
    Spawner: {
      UNIT_ANIMATIONS: Object.fromEntries(tribes.map(key => [key, Object.fromEntries(['idle', 'walk', 'jump'].map(action => [action, animation(key + '-' + action)]))])),
      PLAYER_TRIBES: tribes.map(key => ({ key })), CREATURE_IDLE_ANIMATIONS: {},
      createTribeArt: () => ({}), createWelcomeRoster, prepareWelcomeChoice, drawWelcomeChoice,
      createSproutRoots: () => ({}), unitAnimationFrame: () => 0,
      welcomeTravelMotion: () => ({ x: viewportWidth / 2, agent: {}, position: { progress: 0 } })
    }
  };
  vm.runInNewContext(source, sandbox);
  await sandbox.SpawnerWelcomeHeaderReady;
  if (failedPart) {
    assert.ok(spriteDraws > 0, 'Missing bean part must use the existing sprite fallback');
    assert.equal(warnings.filter(args => args[0] === 'Welcome bean part unavailable:').length, 1);
  }
  assert.equal(frames, reduced ? 0 : 1, 'Initialization must preserve motion preference and animation scheduling');
}
for (const width of [390, 1440]) for (const reduced of [false, true]) {
  await run(null, reduced, width);
  for (const part of ['body', 'sprout-left', 'sprout-right', 'sprout-stem', 'green-foot', 'bean-root-rig', 'antenna-1', 'strength-1'])
    await run(part, reduced, width);
}
console.log('PASS: 36 startup cases (healthy + all eight bean part failures, two viewport widths, motion on/off). DOM/canvas are stubs; not browser or visual verification.');
