import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { heldHurtProjectileSide, beanHeldHurtSource, drawBeanHeldHurt } from '../../../client/bean-held-hurt.mjs';
import { speciesHeldHurtSource, drawSpeciesHeldHurt } from '../../../client/species-held-hurt.mjs';
import { unitDisplaySize } from '../../../client/unit-size.mjs';
import { imageDimensions } from '../../../client/image-audit.mjs';
import { createCombatVfxCursor } from '../../../client/combat-vfx-events.mjs';
import { recordCombatVfx, snapshotCombatVfx } from '../../../server/combat-vfx-journal.mjs';

const root = new URL('../../../', import.meta.url);
const unit = extra => ({ id: 'target', tribe: 'bean', health: 10, facing: 1, attributes: {}, hurtStartedAt: 1, ...extra });
const shot = extra => ({ id: 's1', kind: 'shoot', mode: 'ranged', amount: 0, at: .5, arrivesAt: 1,
  sourceId: 'left', targetId: 'target', projectileId: 'p1', from: { x: 100, y: 100 }, to: { x: 102, y: 100 }, ...extra });
const hit = extra => ({ id: 'h1', kind: 'hit', mode: 'ranged', amount: 1, at: 1,
  sourceId: 'left', targetId: 'target', projectileId: 'p1', from: { x: 100, y: 100 }, to: { x: 102, y: 100 }, ...extra });
const frame = (...retainedEvents) => ({ retainedEvents });
function frozen(object) {
  if (object && typeof object === 'object') { Object.values(object).forEach(frozen); Object.freeze(object); }
  return object;
}

test('mixed fully visible and redacted actual journal hits preserve fallback', () => {
  const environment = {};
  for (const event of [shot(), shot({ id: 's2', projectileId: 'p2', sourceId: 'right', from: { x: 104, y: 100 } }),
    hit(), hit({ id: 'h2', projectileId: 'p2', sourceId: 'right', from: { x: 104, y: 100 } })]) recordCombatVfx(environment, event);
  const visibility = { agentIds: new Set(['left', 'target']), isVisible: () => false };
  const snapshot = snapshotCombatVfx(environment, 1.3, visibility);
  assert.equal(snapshot.events.find(e => e.projectileId === 'p2' && e.kind === 'hit').sourceId, null);
  const current = createCombatVfxCursor().consume(snapshot, 1.3);
  assert.equal(heldHurtProjectileSide(unit(), current, 1.3), null,
    'unknown simultaneous direction must not be discarded in favor of the known side');
});

test('incomplete or nonprojectile simultaneous direct hits preserve fallback', () => {
  for (const extra of [{ sourceId: null }, { projectileId: null }, { mode: 'melee' }]) {
    const other = hit({ id: 'h2', projectileId: 'p2', sourceId: 'right', ...extra });
    assert.equal(heldHurtProjectileSide(unit(), frame(shot(), hit(), other), 1.3), null, JSON.stringify(extra));
  }
});

test('pure direction sampling leaves deeply frozen agent and evidence untouched', () => {
  const agent = frozen(unit({ x: 900, y: 900, attack: { startedAt: .7, hitAt: 1.4, endsAt: 2 }, dnaStunnedUntil: 5 }));
  const evidence = frozen(frame(shot(), hit())), before = JSON.stringify({ agent, evidence });
  assert.equal(heldHurtProjectileSide(agent, evidence, 1.3), -1);
  assert.equal(JSON.stringify({ agent, evidence }), before);
});

test('duplicate and reordered snapshots select a bank without restarting cues or clocks', () => {
  const cursor = createCombatVfxCursor(); cursor.consume({ streamId: 'test', events: [] }, .1);
  const events = [shot(), hit()];
  const first = cursor.consume({ streamId: 'test', events }, 1.1);
  assert.ok(first.started.length > 0);
  for (const time of [1.2, 1.5, 1.7, 1.879]) {
    const repeated = cursor.consume({ streamId: 'test', events: [events[1], events[0], events[1]] }, time);
    assert.equal(repeated.started.length, 0);
    assert.equal(heldHurtProjectileSide(unit(), repeated, time), -1);
  }
  const replaced = cursor.consume({ streamId: 'replacement', events: [] }, 1.8);
  assert.equal(heldHurtProjectileSide(unit(), replaced, 1.8), null);
});

function renderer(relativePath) {
  const source = readFileSync(new URL(relativePath, root), 'utf8');
  return source.match(/^    function drawAgentHeldHurt\([^]*?^    }/m)[0];
}
const currentHelper = renderer('client/game.js');
const beforeHelper = renderer('tools/world-projectile-hurt-side-20261106/before/draw-agent-held-hurt.js');
const images = new Map();
function render(helper, agent, events, time) {
  const calls = [];
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'scale'].map(name => [name, (...args) => calls.push([name, ...args])]));
  ctx.drawImage = (image, ...args) => calls.push(['draw', image.path, ...args]);
  const scope = { Spawner: { heldHurtProjectileSide, beanHeldHurtSource, drawBeanHeldHurt, speciesHeldHurtSource, drawSpeciesHeldHurt, unitDisplaySize },
    state: { simSeconds: time }, combatVfxFrame: events, AGENT_HEIGHT: .7, ctx,
    unitDisplayScale: () => 1.5, unitBodySize: () => ({ width: .4 }),
    agentRangedImage: path => {
      if (!images.has(path)) { const [width, height] = imageDimensions(path); images.set(path, { path, width, height, complete: true }); }
      return images.get(path);
    }, unitAnimationSheets: new Map(['bean', 'spore', 'pebble', 'spring'].map(tribe => [tribe, new Map([['idle', { scale: 1.25 }]])])) };
  createContext(scope); runInContext(helper, scope);
  return { drawn: scope.drawAgentHeldHurt(ctx, agent, 250, 15, 23, null), calls };
}

test('all 24 forms preserve baseline image, geometry and facing across every recovery bank cell', () => {
  let checked = 0;
  for (const tribe of ['bean', 'spore', 'pebble', 'spring']) for (const form of ['base', 'blade', 'carapace', 'secretion', 'antenna', 'feet']) {
    const prototype = unit({ tribe, attributes: form === 'base' ? {} : { [form]: 1 } });
    const source = beanHeldHurtSource(prototype) || speciesHeldHurtSource(prototype);
    for (const facing of [-1, 1]) for (const side of [-1, 1]) for (const [cell, age] of source.times.entries()) {
      const agent = frozen({ ...prototype, facing }), time = 1 + age + 1e-7;
      const events = frozen(frame(shot({ from: { x: 102 + side * 2, y: 100 } }), hit()));
      const before = render(beforeHelper, agent, events, time), after = render(currentHelper, agent, events, time);
      assert.equal(after.drawn, true); assert.equal(before.drawn, true);
      const draw = after.calls.find(call => call[0] === 'draw'), prior = before.calls.find(call => call[0] === 'draw');
      const index = cell + (side * facing > 0 ? source.times.length : 0);
      assert.deepEqual(draw.slice(2, 4), [index % source.columns * source.frameWidth, Math.floor(index / source.columns) * source.frameHeight]);
      assert.equal(draw[1], prior[1]); assert.deepEqual(draw.slice(4), prior.slice(4));
      assert.deepEqual(after.calls.filter(call => call[0] !== 'draw'), before.calls.filter(call => call[0] !== 'draw'));
      checked++;
    }
  }
  assert.equal(checked, 1296);
});
