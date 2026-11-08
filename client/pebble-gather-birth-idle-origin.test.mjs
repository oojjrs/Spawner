import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { createGame } from '../server/game.mjs';
import { startingWorkerDna } from '../server/tribe-start.mjs';
import { agentBirthDuration } from '../server/birth.mjs';
import { UNIT_APPEARANCE_FORMS } from '../server/unit-appearance.mjs';
import { unitActionState } from './unit-appearance-state.mjs';
import { unitActionArtPose } from './unit-action-art.mjs';
import { UNIT_ACTION_ART } from './unit-action-art-assets.mjs';

function fixture(tribe = 'pebble', time = 100.125) {
  const occupiedCells = new Set(['1,0','2,0','3,0','0,1','1,1','2,1','3,1','4,1','0,2','1,2','2,2','3,2','4,2','0,3','1,3','2,3','3,3','4,3','1,4','2,4','3,4']);
  const colony = { id: 1, ownerId: 'player', tribe, x: 40, y: 40, occupiedCells };
  const environment = { hostId: 'player', simSeconds: 0,
    world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set('player', game);
  game.prepare(time);
  const { templateId } = game.command({ type: 'design', templateId: null, name: 'Idle seam', dna: startingWorkerDna(tribe), birth: false });
  const { agentId } = game.command({ type: 'birth', templateId });
  return { game, agentId, snapshot: () => JSON.parse(JSON.stringify(game.snapshot().agents.find(agent => agent.id === agentId))) };
}

function gather(extra = {}) {
  return { id: 'gather', tribe: 'pebble', dna: startingWorkerDna('pebble'), health: 10,
    bornAt: 100, mode: 'idle', moveDuration: 0, ...extra };
}
const options = { animations: UNIT_ACTION_ART['pebble/gather'].actions };

// This exercises actual production state transport, not a fabricated renderer clock.
test('Pebble gather idle begins at actual birth completion before and after server tick, snapshot, save and restore', () => {
  for (const time of [0, 100.125]) {
    const f = fixture('pebble', time), spawned = f.snapshot(), readyAt = spawned.birth.readyAt;
    assert.equal(spawned.dna.version, 6);
    assert.equal(spawned.bornAt, time);
    assert.equal(readyAt, time + 2.62);
    assert.equal(spawned.birthIdleStartedAt, undefined);
    const before = unitActionArtPose(spawned, readyAt - .000001);
    assert.equal(before.action, 'birth'); assert.equal(before.frame, 65);
    const retained = unitActionArtPose(spawned, readyAt);
    assert.equal(retained.action, 'idle'); assert.equal(retained.frame, 0);
    f.game.prepare(readyAt - .001); f.game.tick(.001);
    assert.ok(f.snapshot().birth); assert.equal(f.snapshot().birthIdleStartedAt, undefined);
    f.game.prepare(readyAt); f.game.tick(.001);
    let completed = f.snapshot();
    assert.equal(completed.birth, null);
    assert.equal(completed.birthIdleStartedAt, readyAt);
    assert.equal(completed.bornAt, time);
    assert.equal(completed.animationStartedAt, undefined);
    assert.equal(completed.moveDuration, 0);
    assert.equal(unitActionArtPose(completed, readyAt).frame, 0);
    assert.equal(unitActionArtPose(completed, readyAt + .999).frame, 0);
    assert.equal(unitActionArtPose(completed, readyAt + 1).frame, 1);
    f.game.restore(f.game.save()); completed = f.snapshot();
    assert.equal(completed.birthIdleStartedAt, readyAt);
    assert.equal(completed.bornAt, time);
    assert.equal(unitActionArtPose(completed, readyAt).frame, 0);
  }
});

test('restoring an active birth preserves the completion origin; old completed saves and founders are not backfilled', () => {
  const f = fixture(), readyAt = f.snapshot().birth.readyAt;
  f.game.prepare(readyAt - .1); f.game.tick(.001); f.game.restore(f.game.save());
  assert.equal(f.snapshot().birthIdleStartedAt, undefined);
  f.game.prepare(readyAt); f.game.tick(.001);
  assert.equal(f.snapshot().birthIdleStartedAt, readyAt);
  const old = JSON.parse(f.game.save());
  delete old.state.agents.find(agent => agent.id === f.agentId).birthIdleStartedAt;
  f.game.restore(JSON.stringify(old));
  assert.equal(f.snapshot().birthIdleStartedAt, undefined);
  assert.equal(unitActionArtPose(f.snapshot(), readyAt).frame, 11);
  f.game.prepare(readyAt + .1); f.game.tick(.001);
  assert.equal(f.snapshot().birthIdleStartedAt, undefined);
  for (const founder of f.game.snapshot().agents.filter(agent => agent.id !== f.agentId)) {
    assert.equal(founder.birth, undefined);
    assert.equal(founder.birthIdleStartedAt, undefined);
  }
});

test('the retained-birth fallback and persisted marker cannot shift the other 67 forms or legacy DNA', () => {
  let checked = 0;
  for (const tribe of ['bean','spore','pebble','spring']) for (const form of UNIT_APPEARANCE_FORMS) {
    if (tribe === 'pebble' && form === 'gather') continue;
    const base = { id: tribe + '/' + form, tribe, health: 10, bornAt: 100, mode: 'idle', moveDuration: 0,
      dna: { version: 6, pieces: form === 'base' ? [] : form.split('-').map(gene => ({ gene, grade: 1 })) } };
    const readyAt = 100 + agentBirthDuration(tribe), at = readyAt + .01;
    const settings = { animations: UNIT_ACTION_ART[tribe + '/' + form].actions };
    const expected = unitActionState(base, at, settings);
    for (const extra of [{ birthIdleStartedAt: readyAt }, { birth: { startedAt: 100, readyAt } }])
      assert.deepEqual(unitActionState({ ...base, ...extra }, at, settings), expected, base.id);
    checked++;
  }
  assert.equal(checked, 67);
  const old = gather({ dna: { version: 4, pieces: [{ gene: 'gather' }] }, birth: { startedAt: 100, readyAt: 102.62 }, birthIdleStartedAt: 102.62 });
  assert.equal(unitActionState(old, 102.62, options).startedAt, 100);
  const legacy = gather({ dna: undefined, attributes: { strength: 1 }, birth: old.birth, birthIdleStartedAt: 102.62 });
  assert.equal(unitActionState(legacy, 102.62, options).startedAt, 100);
});

test('the server does not persist a marker for another tribe or a non-gather Pebble birth', () => {
  for (const tribe of ['bean','spore','spring']) {
    const f = fixture(tribe), readyAt = f.snapshot().birth.readyAt;
    f.game.prepare(readyAt); f.game.tick(.001);
    assert.equal(f.snapshot().birth, null);
    assert.equal(f.snapshot().birthIdleStartedAt, undefined, tribe);
  }
  const f = fixture(), agent = f.game.agents.find(agent => agent.id === f.agentId), readyAt = agent.birth.readyAt;
  // Exact appearance gating must also honor the display snapshot used by art selection.
  agent.appearanceAttributes = { blade: 1 };
  f.game.prepare(readyAt); f.game.tick(.001);
  assert.equal(f.snapshot().birth, null);
  assert.equal(f.snapshot().birthIdleStartedAt, undefined);
});

test('explicit combat and preview clocks win, while ordinary preview and founder actors retain bornAt', () => {
  for (const animationStartedAt of [0, 101.9, 103]) {
    const base = gather({ animationStartedAt });
    for (const extra of [{ birthIdleStartedAt: 102.62 }, { birth: { startedAt: 100, readyAt: 102.62 } }]) {
      const at = 103.2;
      assert.deepEqual(unitActionState({ ...base, ...extra }, at, options), unitActionState(base, at, options));
    }
  }
  for (const actor of [gather(), gather({ id: 'preview', bornAt: 0 }), gather({ id: 'preview', bornAt: undefined })])
    assert.equal(unitActionState(actor, 102.62, options).startedAt, actor.bornAt ?? 0);
});

test('idle return keeps the birth origin instead of restarting the neutral hold; non-idle cues remain identical', () => {
  const plain = gather(), readyAt = 102.62, corrected = { ...plain, birthIdleStartedAt: readyAt };
  const moving = { moveStartedAt: 103, moveAnimationStartedAt: 103, moveDuration: 1, stepCount: 1 };
  assert.deepEqual(unitActionState({ ...corrected, ...moving }, 103.2, options), unitActionState({ ...plain, ...moving }, 103.2, options));
  const returned = unitActionState({ ...corrected, ...moving }, 104, options);
  assert.equal(returned.action, 'idle'); assert.equal(returned.startedAt, readyAt);
  assert.ok(returned.elapsedMs > 1000);
  assert.notEqual(unitActionArtPose({ ...corrected, ...moving }, 104).frame, 0);
  const attack = { attack: { startedAt: 103, hitAt: 103.3, endsAt: 104, recovery: .3, meleeContacts: [103.3] } };
  assert.deepEqual(unitActionState({ ...corrected, ...attack }, 103.3, options), unitActionState({ ...plain, ...attack }, 103.3, options));
  const ranged = { attack: { startedAt: 103, launchedAt: 103.2, hitAt: 103.6, endsAt: 104, dnaRanged: true } };
  assert.deepEqual(unitActionState({ ...corrected, ...ranged }, 103.2, options), unitActionState({ ...plain, ...ranged }, 103.2, options));
  const completedCombat = { ...corrected, animationStartedAt: 104 };
  assert.equal(unitActionState(completedCombat, 104.2, options).startedAt, 104);
});

// Generated surfaces must carry the source change, not only the module tests.
test('built game, standalone preview and combat share the corrected idle clock and the game worker persists it', () => {
  const source = readFileSync('client/runtime.js', 'utf8');
  const scope = { console, setTimeout, clearTimeout, URL, performance };
  runInNewContext(source, scope);
  const actor = gather({ birthIdleStartedAt: 102.62 });
  assert.equal(scope.Spawner.unitActionArtPose(actor, 102.62).frame, 0);
  assert.equal(scope.Spawner.unitActionArtPose(actor, 103.619).frame, 0);
  assert.equal(scope.Spawner.unitActionArtPose(actor, 103.62).frame, 1);
  // This preview intentionally imports shared seeds from the previously loaded runtime.
  runInNewContext(readFileSync('client/unit-appearance-preview-runtime.js', 'utf8'), scope);
  assert.equal(scope.SpawnerAppearance.unitActionState(actor, 102.62, options).startedAt, 102.62);
  function moduleText(text, name) {
    const start = text.indexOf('modules["' + name + '"]');
    assert.ok(start >= 0, name);
    const end = text.indexOf('\n})();', start);
    assert.ok(end > start, name);
    return text.slice(start, end).replace(/\s+/g, '');
  }
  assert.equal(moduleText(readFileSync('Combat.html', 'utf8'), 'client/unit-appearance-state.mjs'),
    moduleText(source, 'client/unit-appearance-state.mjs'));
  assert.equal(moduleText(readFileSync('client/unit-appearance-preview-runtime.js', 'utf8'), 'client/unit-appearance-state.mjs'),
    moduleText(source, 'client/unit-appearance-state.mjs'));
  const worker = JSON.parse(source.match(/^const workerSource = (.+);$/m)[1]);
  assert.ok(moduleText(worker, 'server/game.mjs').includes('agent.birthIdleStartedAt=agent.birth.readyAt;'));
});
