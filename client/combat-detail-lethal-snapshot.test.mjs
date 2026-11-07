import { combatViewLayout, unitDisplaySize } from "./unit-size.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createCombat } from '../server/combat.mjs';
import { ATTRIBUTE_DNA } from '../server/dna.mjs';
import { snapshotCombatVfx } from '../server/combat-vfx-journal.mjs';
import { createCombatVfxCursor } from './combat-vfx-events.mjs';
import { createDetailCombatVfx, DETAIL_COMBAT_VFX, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect } from './combat-detail-vfx.mjs';

const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const helper = readFileSync(new URL('./combat-detail-dodge.test.mjs', import.meta.url), 'utf8').split('const event = ')[0];
const box = { combatViewLayout, unitDisplaySize, assert, source, createContext, runInContext, createCombatVfxCursor, createDetailCombatVfx,
  DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect };
createContext(box); runInContext(helper.slice(helper.indexOf('function extract(')), box);
const fixture = readFileSync(new URL('./combat-detail-damage-labels.test.mjs', import.meta.url), 'utf8');
const actualScene = new Function('ATTRIBUTE_DNA', 'createCombat', fixture.slice(fixture.indexOf('const dna = '),
  fixture.indexOf('\ntest("real lethal melee/ranged')) + '\nreturn actualScene;')(ATTRIBUTE_DNA, createCombat);
const delay = Number(source.match(/const MOVEMENT_DELAY = ([\d.]+)/)[1]);
const extrapolate = (lastPaint, snapshot, elapsed) => Math.max(lastPaint, snapshot + Math.min(.3, elapsed) - delay);
const amountRows = row => Array.from(row.texts.filter(c => /^[+−]/.test(c.text)));

function modal(options = {}) {
  const view = box.modal(options);
  view.sandbox.connection = { simSeconds: 0 };
  return { ...view, paint(time, snapshotTime, events = []) {
    view.sandbox.connection.simSeconds = snapshotTime;
    return view.draw(time, events);
  } };
}

const units = ['source', 'target'].map(id => ({ id, tribe: 'bean', health: 10 }));
const points = new Map(units.map((unit, i) => [unit.id, { x: 100 + i * 200, y: 250, width: 70, height: 100 }]));
const survivors = [units[0]], remaining = new Map([['source', points.get('source')]]);
const viewport = { scope: 'fight', width: 600, height: 350, includeDirectDamage: true };
const event = (kind, extra = {}) => ({ id: kind, kind, at: 1, amount: 2, sourceId: 'source', targetId: 'target', ...extra });
const death = event('death', { amount: 0 });
function controller() {
  const cursor = createCombatVfxCursor(), detail = createDetailCombatVfx();
  function draw(time, events = [], agents = units, positions = points, view = viewport, streamId = 'stream') {
    detail.consume(cursor.consume({ streamId, events }, time), time);
    return { commands: detail.commands(agents, positions, time, 100, view),
      labels: detail.vitalCommands(agents, positions, time, view) };
  }
  draw(0); return { draw, detail };
}

// Actual game snapshots preserve the prior paint clock between server packets.
test('real lethal melee/ranged critical feedback survives normal render extrapolation in both arena directions', () => {
  assert.equal(delay, .15);
  assert.ok(source.includes('Math.min(0.3, (now - connection.receivedAt) / 1000) - MOVEMENT_DELAY'));
  assert.ok(source.includes('if (!firstSnapshot && !state.ending) state.simSeconds = renderedAt;'));
  for (const tribe of ['bean', 'spore', 'pebble', 'spring']) for (const mode of ['melee', 'ranged'])
    for (const reverse of [false, true]) for (const missing of [false, true]) {
      const live = actualScene(mode, tribe), control = actualScene(mode, tribe), initial = structuredClone(live.units);
      const snapshotAt = live.at - .05, paintAt = extrapolate(0, snapshotAt, .3);
      assert.ok(paintAt > live.at);
      const view = modal({ units: initial, unavailable: missing ? DETAIL_COMBAT_VFX_ASSETS : [],
        initialSnapshot: snapshotCombatVfx(live.environment, snapshotAt) });
      if (reverse) {
        view.agents.reverse(); view.agents.forEach((unit, side) => unit.combat.side = side);
        view.sandbox.combatRoster.dataset.key = "target,source";
      }
      view.paint(paintAt, snapshotAt, snapshotCombatVfx(live.environment, snapshotAt));
      live.resolve(); control.resolve();
      view.agents.find(unit => unit.id === 'target').health = 0; view.sandbox.combatRoster.dataset.key = 'source';
      const snapshot = snapshotCombatVfx(live.environment, live.at + .05), original = structuredClone(snapshot);
      const at = extrapolate(paintAt, live.at + .05, .22), row = view.paint(at, live.at + .05, snapshot);
      const impacts = row.commands.filter(c => c.kind === 'impact');
      assert.equal(impacts.length, 1, tribe + '/' + mode);
      assert.equal(impacts[0].amount, .75); assert.equal(impacts[0].eventAt, live.at);
      assert.equal(impacts[0].image, DETAIL_COMBAT_VFX[mode === 'melee' ? 'hit' : tribe].image);
      assert.equal(row.art.length, missing ? 0 : 1); assert.equal(row.hits.length, missing ? 1 : 0);
      assert.deepEqual(amountRows(row).map(c => c.text), ['−0.8']);
      assert.equal(row.texts.filter(c => c.text === '치명').length, 1);
      assert.deepEqual(view.paint(at, live.at + .05, snapshot), row, 'pause/repeated snapshot does not replay');
      assert.deepEqual(snapshot, original); assert.deepEqual(live.units, control.units); assert.equal(live.rolls(), control.rolls());
    }
});

test('existing direct, secondary and bleed effects retain their own recipient, age and opt-in contract', () => {
  for (const hit of [event('hit'), event('critical'), event('hit', { hitIndex: 1 }), event('area'),
    event('reflect', { fromId: 'source', toId: 'target' }), event('bleed')]) {
    const scene = controller(); scene.draw(1.1, [], units, points, { ...viewport, snapshotTime: .95 });
    const packet = [hit, death], copy = structuredClone(packet);
    const row = scene.draw(1.12, packet, survivors, remaining, { ...viewport, snapshotTime: 1.05 });
    assert.equal(row.labels.length, 1); assert.equal(row.labels[0].targetId, 'target');
    assert.equal(row.labels[0].amount, 2); assert.ok(Math.abs(row.labels[0].age - .12) < 1e-8);
    assert.equal(row.commands.length, hit.kind === 'bleed' ? 0 : 1);
    for (const command of row.commands) { assert.equal(command.targetId, 'target'); assert.equal(command.x, points.get('target').x); }
    const lab = scene.draw(1.13, packet, survivors, remaining, { ...viewport, snapshotTime: 1.05, includeDirectDamage: false });
    assert.equal(lab.labels.length, hit.kind === 'bleed' ? 1 : 0);
    assert.deepEqual(packet, copy);
  }
});

test('authoritative living-after-death, unseen or omitted targets and restore-to-corpse remain suppressed', () => {
  for (const reason of ['livingAfterDeath', 'noDeath', 'unobserved', 'redacted', 'restore', 'changedView', 'clearedView', 'newStream', 'backseek']) {
    const scene = controller(), snapshotTime = reason === 'livingAfterDeath' ? 1.01 : .95;
    scene.draw(1.1, [], reason === 'unobserved' ? survivors : units, reason === 'unobserved' ? remaining : points, { ...viewport, snapshotTime });
    if (reason === 'clearedView') scene.detail.clearView();
    const hit = event(reason === 'restore' ? 'regeneration' : 'hit', reason === 'redacted' ? { targetId: null } : {});
    const events = reason === 'noDeath' ? [hit] : [hit, reason === 'redacted' ? { ...death, targetId: null } : death];
    const row = scene.draw(reason === 'backseek' ? 1.05 : 1.12, events, survivors, remaining,
      { ...viewport, scope: reason === 'changedView' ? 'other' : 'fight', snapshotTime: 1.05 }, reason === 'newStream' ? 'other' : 'stream');
    assert.equal(row.commands.length, 0, reason); assert.equal(row.labels.length, 0, reason);
  }
});

test('current-age recovery, resized retained points and original expiry do not extend the killing effect', () => {
  const view = modal({ unavailable: DETAIL_COMBAT_VFX_ASSETS });
  view.paint(1.1, .95); view.agents[1].health = 0; view.sandbox.combatRoster.dataset.key = 'source';
  const events = [event('critical'), death], first = view.paint(1.12, 1.05, events);
  assert.equal(first.hits.length, 1); const initial = first.commands[0];
  view.sandbox.detailVfxImages.get(initial.image).complete = true;
  const recovered = view.paint(1.2, 1.1, events);
  assert.equal(recovered.art.length, 1); assert.equal(recovered.hits.length, 0); assert.ok(recovered.art[0].args[0] + recovered.art[0].args[1] > 0);
  view.canvas.clientWidth /= 2; view.canvas.clientHeight /= 2; view.sandbox.idleMotion.matches = true;
  const resized = view.paint(1.2, 1.1, events);
  assert.equal(resized.commands[0].x, recovered.commands[0].x / 2);
  assert.equal(resized.commands[0].y, recovered.commands[0].y / 2);
  assert.equal(amountRows(resized).length, 1);
  assert.equal(view.paint(1.51, 1.4, events).art.length, 0);
  assert.equal(amountRows(view.paint(1.6, 1.5, events)).length, 1);
  assert.equal(amountRows(view.paint(1.851, 1.8, events)).length, 0);
});

test('consumers without a snapshot clock keep the conservative former paint-time check', () => {
  for (const snapshotTime of [undefined, NaN, Infinity]) {
    const scene = controller(); scene.draw(1.1, [], units, points, { ...viewport, snapshotTime });
    const row = scene.draw(1.12, [event('hit'), death], survivors, remaining);
    assert.equal(row.commands.length, 0); assert.equal(row.labels.length, 0);
  }
  const scene = controller(); scene.draw(.9);
  const row = scene.draw(1.1, [event('hit'), death], survivors, remaining);
  assert.equal(row.commands.length, 1); assert.equal(row.labels.length, 1);
});

test('explicit target revocation removes cached damage and restoration tails without replay on reveal', () => {
  for (const kind of ['hit', 'critical', 'bleed', 'drain', 'regeneration']) for (const initiallyHidden of [false, true]) {
    const scene = controller(), restore = ['drain', 'regeneration'].includes(kind);
    scene.draw(1.1, [], units, points, { ...viewport, snapshotTime: .95 });
    const hit = event(kind), packet = restore ? [hit] : [hit, death];
    const hidden = packet.map(cue => ({ ...cue, targetId: null }));
    const agents = restore ? units : survivors, positions = restore ? points : remaining;
    const first = scene.draw(1.12, initiallyHidden ? hidden : packet, agents, positions, { ...viewport, snapshotTime: 1.05 });
    assert.equal(first.labels.length, initiallyHidden ? 0 : 1, kind);
    const revoked = scene.draw(1.2, hidden, survivors, remaining, { ...viewport, snapshotTime: 1.15 });
    assert.equal(revoked.commands.length, 0); assert.equal(revoked.labels.length, 0);
    const revealed = scene.draw(1.25, packet, agents, positions, { ...viewport, snapshotTime: 1.2 });
    assert.equal(revealed.commands.length, 0, kind); assert.equal(revealed.labels.length, 0, kind);
  }
});

test('source-only redaction preserves visible recipient damage without restoring a hidden source identity', () => {
  for (const initiallyHidden of [false, true]) {
    const scene = controller(); scene.draw(1.1, [], units, points, { ...viewport, snapshotTime: .95 });
    const packet = [event('critical', { mode: 'ranged' }), death];
    const hidden = packet.map(cue => ({ ...cue, sourceId: null }));
    const first = scene.draw(1.12, initiallyHidden ? hidden : packet, survivors, remaining, { ...viewport, snapshotTime: 1.05 });
    assert.equal(first.commands.length, 1); assert.equal(first.labels.length, 1);
    const next = scene.draw(1.2, hidden, [], new Map(), { ...viewport, snapshotTime: 1.15 });
    assert.equal(next.commands.length, 1); assert.equal(next.labels.length, 1);
    assert.equal(next.commands[0].sourceId, null); assert.equal(next.labels[0].sourceId, null);
    assert.equal(next.commands[0].image, DETAIL_COMBAT_VFX.hit.image);
    const revealed = scene.draw(1.25, packet, survivors, remaining, { ...viewport, snapshotTime: 1.2 });
    assert.equal(revealed.commands[0].sourceId, null); assert.equal(revealed.labels[0].sourceId, null);
    assert.equal(revealed.commands[0].image, DETAIL_COMBAT_VFX.hit.image);
    assert.equal(revealed.commands[0].eventId, first.commands[0].eventId);
    assert.equal(revealed.commands[0].eventAt, 1); assert.equal(revealed.labels[0].amount, 2);
    assert.equal(revealed.labels[0].age, .25);
  }
});

test('retargeted retained records cannot redirect an already-started effect to a new actor', () => {
  const scene = controller(); scene.draw(1.1, [], units, points, { ...viewport, snapshotTime: .95 });
  assert.equal(scene.draw(1.12, [event('critical'), death], survivors, remaining, { ...viewport, snapshotTime: 1.05 }).labels.length, 1);
  const altered = [event('critical', { targetId: 'source' }), death];
  const row = scene.draw(1.2, altered, survivors, remaining, { ...viewport, snapshotTime: 1.15 });
  assert.equal(row.commands.length, 0); assert.equal(row.labels.length, 0);
});
