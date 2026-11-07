import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetailCombatVfx } from '../../../client/combat-detail-vfx.mjs';
import { createCombatVfxCursor } from '../../../client/combat-vfx-events.mjs';
import { recordCombatVfx, snapshotCombatVfx } from '../../../server/combat-vfx-journal.mjs';

// Reviewer-authored tests. Uses the real journal and cursor rather than another
// test's fixture. No browser, generated bundle, product, or artwork changes.
const units = [{ id: 'source', tribe: 'bean', health: 10 }, { id: 'target', tribe: 'bean', health: 10 }];
const all = new Map([['source', { x: 100, y: 200, width: 70, height: 100 }], ['target', { x: 300, y: 200, width: 70, height: 100 }]]);
const remaining = new Map([['source', all.get('source')]]);
function scene() {
  const environment = {}, detail = createDetailCombatVfx(), cursor = createCombatVfxCursor();
  function draw(time, snapshotTime, { ids = ['source', 'target'], actors = units, positions = all,
    scope = 'fight', width = 600, height = 350, override = {} } = {}) {
    const packet = snapshotCombatVfx(environment, snapshotTime, { agentIds: new Set(ids), isVisible: () => false });
    const before = structuredClone(packet), frame = cursor.consume(packet, time);
    detail.consume(frame, time);
    const view = { scope, width, height, snapshotTime, includeDirectDamage: true, ...override };
    const commands = detail.commands(actors, positions, time, 100, view);
    const labels = detail.vitalCommands(actors, positions, time, view);
    assert.deepEqual(packet, before);
    return { commands, labels, packet, frame };
  }
  function emit(kind = 'hit', extras = {}) {
    recordCombatVfx(environment, { kind, at: 1, amount: kind === 'death' ? 0 : 2, sourceId: 'source', targetId: 'target', ...extras });
  }
  draw(0, 0);
  return { draw, emit, detail };
}
const offRoster = { actors: [units[0]], positions: remaining };

test('authoritative snapshot time recovers a recent lethal anchor; resize and repeated packets retain age', () => {
  const s = scene(); s.draw(1.1, .95); s.emit(); s.emit('death');
  const first = s.draw(1.12, 1.05, offRoster);
  assert.equal(first.commands.length, 1); assert.equal(first.labels.length, 1);
  assert.equal(first.commands[0].targetId, 'target'); assert.equal(first.commands[0].amount, 2);
  assert.ok(Math.abs(first.labels[0].age - .12) < 1e-12);
  const repeat = s.draw(1.12, 1.05, offRoster);
  assert.equal(repeat.frame.started.length, 0); assert.deepEqual(repeat.commands, first.commands); assert.deepEqual(repeat.labels, first.labels);
  const resized = s.draw(1.12, 1.05, { ...offRoster, width: 300, height: 175 });
  assert.equal(resized.commands[0].x, first.commands[0].x / 2); assert.equal(resized.commands[0].y, first.commands[0].y / 2);
  assert.equal(resized.labels[0].age, first.labels[0].age);
  assert.equal(s.draw(1.5, 1.4, offRoster).commands.length, 0);
  assert.equal(s.draw(1.84, 1.8, offRoster).labels.length, 1);
  assert.equal(s.draw(1.86, 1.8, offRoster).labels.length, 0);
});

test('no clock or invalid clock keeps the conservative paint-time rule', () => {
  for (const snapshotTime of [undefined, null, NaN, Infinity, -Infinity, '0.95']) {
    const s = scene(); s.draw(1.1, .95, { override: { snapshotTime } }); s.emit(); s.emit('death');
    const row = s.draw(1.12, 1.05, offRoster);
    assert.equal(row.commands.length, 0, String(snapshotTime)); assert.equal(row.labels.length, 0);
  }
});

test('authoritatively newer living records, stale observations, omitted living actors, absent death and late packets stay suppressed', () => {
  for (const reason of ['newerLiving', 'stale', 'unseen', 'noDeath', 'tooLate', 'changedView', 'clearView']) {
    const s = scene();
    s.draw(reason === 'stale' ? .1 : 1.1, reason === 'newerLiving' ? 1.01 : reason === 'stale' ? 0 : .95,
      reason === 'unseen' ? offRoster : {});
    s.emit(); if (reason !== 'noDeath') s.emit('death');
    if (reason === 'clearView') s.detail.clearView();
    const row = s.draw(reason === 'tooLate' ? 1.351 : 1.12, 1.05,
      { ...offRoster, scope: reason === 'changedView' ? 'other' : 'fight' });
    assert.equal(row.commands.length, 0, reason); assert.equal(row.labels.length, 0, reason);
  }
});

test('initial redaction cannot infer a retained recipient and restore events cannot restore a corpse', () => {
  for (const kind of ['hit', 'bleed', 'drain', 'regeneration']) {
    const s = scene(); s.draw(1.1, .95); s.emit(kind); s.emit('death');
    const row = s.draw(1.12, 1.05, { ...offRoster, ids: ['source'] });
    assert.ok(row.packet.events.every(e => e.targetId === null));
    assert.equal(row.commands.length, 0, kind); assert.equal(row.labels.length, 0, kind);
  }
  for (const kind of ['drain', 'regeneration']) {
    const s = scene(); s.draw(1.1, .95); s.emit(kind); s.emit('death');
    assert.equal(s.draw(1.12, 1.05, offRoster).labels.length, 0, kind);
  }
});

test('later target redaction suppresses the already-started retained impact', () => {
  const s = scene(); s.draw(1.1, .95); s.emit(); s.emit('death');
  assert.equal(s.draw(1.12, 1.05, offRoster).commands.length, 1);
  const hidden = s.draw(1.2, 1.15, { ...offRoster, ids: ['source'] });
  assert.ok(hidden.packet.events.every(e => e.targetId === null));
  assert.equal(hidden.frame.started.length, 0); assert.equal(hidden.labels.length, 0);
  assert.equal(hidden.commands.length, 0, 'current redaction must replace cached target identity');
});

test('later target redaction suppresses already-started retained bleed labels', () => {
  const s = scene(); s.draw(1.1, .95); s.emit('bleed'); s.emit('death');
  assert.equal(s.draw(1.12, 1.05, offRoster).labels.length, 1);
  const hidden = s.draw(1.2, 1.15, { ...offRoster, ids: ['source'] });
  assert.ok(hidden.packet.events.every(e => e.targetId === null));
  assert.equal(hidden.labels.length, 0, 'current redaction must replace cached bleed recipient');
});

test('explicit recipient revocation is permanent for this event, including initially hidden and living recipients', () => {
  for (const kind of ['hit', 'bleed', 'drain', 'regeneration']) for (const initiallyHidden of [false, true]) {
    const s = scene(); s.draw(1.1, .95); s.emit(kind);
    const first = s.draw(1.12, 1.05, initiallyHidden ? { ...offRoster, ids: ['source'] } : {});
    assert.equal(first.labels.length, initiallyHidden ? 0 : 1, kind);
    const hidden = s.draw(1.2, 1.15, { ...offRoster, ids: ['source'] });
    assert.equal(hidden.commands.length, 0); assert.equal(hidden.labels.length, 0);
    const revealed = s.draw(1.25, 1.2);
    assert.equal(revealed.frame.started.length, 0); assert.equal(revealed.commands.length, 0); assert.equal(revealed.labels.length, 0, kind);
  }
});

test('source-only redaction preserves visible-recipient damage while permanently scrubbing source identity', () => {
  for (const initiallyHidden of [false, true]) {
    const s = scene(); s.draw(1.1, .95); s.emit('hit', { mode: 'ranged' });
    const onlyTarget = { ids: ['target'], actors: [units[1]], positions: new Map([['target', all.get('target')]]) };
    const first = s.draw(1.12, 1.05, initiallyHidden ? onlyTarget : {});
    assert.equal(first.commands.length, 1); assert.equal(first.labels.length, 1);
    assert.equal(first.commands[0].sourceId, initiallyHidden ? null : 'source');
    assert.match(first.commands[0].image, initiallyHidden ? /hit\.png$/ : /bean\.png$/);
    const hidden = s.draw(1.2, 1.15, onlyTarget);
    assert.equal(hidden.commands.length, 1); assert.equal(hidden.labels.length, 1);
    assert.equal(hidden.commands[0].sourceId, null); assert.equal(hidden.labels[0].sourceId, null);
    assert.match(hidden.commands[0].image, /hit\.png$/);
    assert.equal(hidden.commands[0].eventAt, 1); assert.equal(hidden.commands[0].amount, 2);
    assert.ok(Math.abs(hidden.labels[0].age - .2) < 1e-12);
    const revealed = s.draw(1.25, 1.2);
    assert.equal(revealed.commands.length, 1); assert.equal(revealed.commands[0].sourceId, null);
    assert.match(revealed.commands[0].image, /hit\.png$/); assert.equal(revealed.frame.started.length, 0);
  }
});
