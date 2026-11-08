import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { drawUnitHealthRing } from './unit-health-ring.mjs';
const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
function fixture(options = {}) {
  const calls = [], ellipses = [];
  const context = { save() {}, restore() {}, beginPath() {}, stroke() {}, ellipse(...args) { ellipses.push(args); } };
  const state = { camera: { zoom: 40 }, simSeconds: 2, ending: false, ...options.state };
  const appearance = options.appearance || { scale: .8, centerY: .55, groundWidth: .7 };
  const scope = createContext({ ctx: context, state, viewport: { width: 1000, height: 1000 },
    COLONY_SIZE: 5, NEST_LEVELS: [{ health: 100 }, { health: 200 }], idleMotion: { matches: false }, nestGrowthPlayback: {},
    colonyInactive: entry => entry.nestHealth === 0 || state.ending && entry.id === 'own',
    colonyAppearance: () => appearance, colonyGrowthRendering: () => options.growth,
    worldToScreen: (x, y) => ({ x: x * state.camera.zoom, y: y * state.camera.zoom }),
    Spawner: { nestGrowthFrame: () => options.frame ?? null, drawUnitHealthRing(...args) { calls.push(args.slice(1)); return drawUnitHealthRing(...args); } }
  });
  runInContext(source.match(/^    function drawColonyHealthRing\([^]*?^    }/m)[0], scope);
  return { draw: entry => scope.drawColonyHealthRing(entry), calls, ellipses, state, appearance };
}
test('nest HP uses actual footprint and the same circular health painter, at full and partial HP', () => {
  for (const tribe of ['bean', 'spore', 'pebble', 'spring']) for (const health of [100, 50, 1]) {
    const f = fixture(); f.draw({ id: tribe, tribe, x: 3, y: 4, nestHealth: health, nestMaxHealth: 100 });
    assert.equal(f.calls.length, 1); const [hp, maximum, x, y, radius] = f.calls[0];
    assert.equal(hp, health); assert.equal(maximum, 100); assert.equal(x, 220);
    assert.equal(y, 260 - 160 * .55 + 160 * 1860 / 2048 - 200 * .012);
    assert.equal(radius, 160 * .7 * .52);
    const arc = f.ellipses.at(-1); assert.ok(Math.abs(arc[6] - arc[5] - Math.PI * 2 * health / 100) < 1e-12);
  }
});
test('growing nest ring follows growth floor and size at every stage', () => {
  const growth = { animation: { sheet: { complete: true }, frameCount: 61 }, appearance: { scale: 1, centerY: .5, groundWidth: .8 },
    placement: { fromScale: .7, toScale: 1, fromOffset: .2, toOffset: .3 } };
  for (const frame of [0, 15, 30, 60]) {
    const f = fixture({ growth, frame }); f.draw({ id: 'own', x: 3, y: 4, nestLevel: 2, nestHealth: 150, nestMaxHealth: 200 });
    assert.equal(f.calls[0][3], 260 + 200 * (.2 + .1 * frame / 60) - 2.4);
    assert.ok(Math.abs(f.calls[0][4] - 200 * (.7 + .3 * frame / 60) * .8 * .52) < 1e-12);
  }
});
test('destroyed, invalid, offscreen and distant nests do not draw misleading rings', () => {
  for (const entry of [{ nestHealth: 0 }, { nestHealth: -1 }, { nestHealth: NaN }, { nestMaxHealth: 0 }, { nestMaxHealth: Infinity }, { x: -100 }]) {
    const f = fixture(); f.draw({ id: 'other', x: 3, y: 4, nestHealth: 50, nestMaxHealth: 100, ...entry }); assert.equal(f.calls.length, 0);
  }
  const distant = fixture({ state: { camera: { zoom: 7 } } }); distant.draw({ x: 3, y: 4, nestHealth: 50, nestMaxHealth: 100 }); assert.equal(distant.calls.length, 0);
  const ended = fixture({ state: { ending: true } }); ended.draw({ id: 'own', x: 3, y: 4, nestHealth: 50, nestMaxHealth: 100 }); assert.equal(ended.calls.length, 0);
});
test('legacy snapshot maximum falls back to nest level; full ring is shown without combat flags', () => {
  const f = fixture(); f.draw({ id: 'own', x: 3, y: 4, nestLevel: 2 }); assert.deepEqual(f.calls[0].slice(0, 2), [200, 200]);
});
test('ground HP pass is above colony ground and below nest sprites, actors and fog', () => {
  const scene = source.slice(source.indexOf('      drawTerrain();'));
  assert.ok(scene.indexOf('drawColonyGround(entry,') < scene.indexOf('drawColonyHealthRing(entry)'));
  assert.ok(scene.indexOf('drawColonyHealthRing(entry)') < scene.indexOf('drawWorldObjects(now)'));
  assert.ok(scene.indexOf('drawColonyHealthRing(entry)') < scene.indexOf('drawCombatPanel(now)'));
  assert.ok(scene.indexOf('drawColonyHealthRing(entry)') < scene.indexOf('drawFog(now)'));
});
