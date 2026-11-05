// Independent offline review. Reads current production functions; no before/game fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createContext, runInContext } from 'node:vm';
import { createDetailCombatDeath, detailDeathForm, detailCreatureDeathShadow, DETAIL_DEATH_CREATURES } from '../../../client/combat-detail-death.mjs';
import { CREATURE_IDLE_ANIMATIONS, CREATURE_DEATH_ANIMATIONS, unitAnimationFrame } from '../../../client/unit-animation.mjs';
import { imageFrameGeometry } from '../../../client/image-geometry.mjs';
import { UNIT_DISPLAY_SIZES } from '../../../client/unit-size.mjs';

const audit = JSON.parse(readFileSync(new URL('./approved-deaths-fixture.json', import.meta.url)));
const candidates = ['cotton-sheep', 'lantern-keeper', 'spiny-back-leader'];
const audited = species => audit.species.find(row => row.species === species);
const root = new URL('../../../', import.meta.url);
const hash = path => createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');
const source = readFileSync(new URL('../../../client/game.js', import.meta.url), 'utf8');
const extract = name => { const match = source.match(new RegExp('^    function ' + name + '\\([^]*?^    }', 'm')); assert.ok(match, name); return match[0]; };
const freeze = object => { for (const item of Object.values(object)) if (item && typeof item === 'object') freeze(item); return Object.freeze(object); };
const viewport = { scope: 'fight', roomId: 'room', streamId: 'stream', width: 1040, height: 480, snapshotTime: .9 };
const camera = { width: 1040, height: 480, cell: 180 };
const point = freeze({ x: 730, y: 360, width: 150, height: 180 });
const actor = species => freeze({ id: 'victim', species, health: 10, x: 100, y: 100, combat: { id: 'fight', side: 1 }, attributes: {} });
const corpse = (species, changes = {}) => freeze({ id: 'corpse:victim', kind: 'corpse', agentId: 'victim', species, health: 0, x: 100, y: 100, diedAt: 1, decaysAt: 4, facing: 1, ...changes });
function watched(species, facing = -1, scale = 1.3) {
  const tracker = createDetailCombatDeath(), living = actor(species);
  tracker.begin(.95, { ...viewport, visibleIds: ['victim'], livingAgents: [living] });
  tracker.observe(living, point, { scale, facing });
  tracker.begin(1.01, { ...viewport, snapshotTime: 1, visibleIds: [], livingAgents: [] });
  return tracker;
}
const rows = (tracker, record, time = 1.01) => tracker.commands(record ? [record] : [], time, camera);

test('strict creature allowlist and prior tribe eligibility remain separate', () => {
  assert.deepEqual(DETAIL_DEATH_CREATURES, ['vine-turtle', 'walking-forest', ...candidates]);
  assert.ok(Object.isFrozen(DETAIL_DEATH_CREATURES));
  for (const species of [...Object.keys(CREATURE_DEATH_ANIMATIONS), 'spiny-back-beetle', 'unknown'])
    assert.equal(detailDeathForm({ species, tribe: 'bean' }), DETAIL_DEATH_CREATURES.includes(species) ? `creature/${species}` : null);
  for (const tribe of ['bean', 'spore', 'pebble', 'spring']) {
    assert.equal(detailDeathForm({ tribe, attributes: {} }), `${tribe}/base`);
    assert.equal(detailDeathForm({ tribe, attributes: { secretion: 1 } }), `${tribe}/secretion`);
    for (const key of ['blade', 'carapace', 'antenna', 'feet', 'strength', 'arms', 'piercing', 'guard'])
      assert.equal(detailDeathForm({ tribe, attributes: { [key]: 1 } }), null);
  }
});

test('all five creatures require current matching corpses and clear safely across repeated, departed and reset flows', () => {
  for (const species of DETAIL_DEATH_CREATURES) {
    const record = corpse(species), tracker = watched(species);
    assert.deepEqual(rows(tracker, record), rows(tracker, record));
    assert.equal(tracker.commands([record, record], 1.1, camera).length, 1);
    assert.equal(rows(tracker, null, 1.2).length, 0);
    assert.equal(rows(tracker, record, 1.6)[0].age, .6000000000000001);
    assert.equal(rows(tracker, corpse(species, { diedAt: 1.2, decaysAt: 4.2 }), 1.6).length, 0);
    for (const patch of [{ agentId: 'other' }, { kind: 'food' }, { species: 'bubble-toad' }, { species: undefined },
      { species: species === 'vine-turtle' ? 'walking-forest' : 'vine-turtle' }, { x: 101 }, { y: 101 },
      { diedAt: .8 }, { diedAt: 2 }, { diedAt: NaN }, { decaysAt: NaN }, { decaysAt: 1 }])
      assert.equal(rows(watched(species), corpse(species, patch)).length, 0, JSON.stringify(patch));
    assert.equal(rows(watched(species), record, 1.85).length, 0, 'late first discovery cannot replay');
    for (const patch of [{ scope: 'other' }, { roomId: 'other' }, { streamId: 'other' }, { snapshotTime: .8 }, { width: 0 }]) {
      const reset = watched(species); reset.begin(1.1, { ...viewport, snapshotTime: 1.1, ...patch });
      assert.equal(rows(reset, record, 1.1).length, 0);
    }
    const departed = watched(species);
    departed.begin(1.1, { ...viewport, livingAgents: [actor(species)], visibleIds: [] });
    assert.equal(rows(departed, record, 1.1).length, 0);
    const stillAlive = watched(species);
    stillAlive.begin(1.1, { ...viewport, livingAgents: [actor(species)], visibleIds: ['victim'] });
    assert.equal(rows(stillAlive, record, 1.1).length, 0);
    const cleared = watched(species); cleared.clear(); cleared.clear(); cleared.begin(1.1, viewport);
    assert.equal(rows(cleared, record, 1.1).length, 0);
    tracker.begin(3.999, { ...viewport, snapshotTime: 3.999 });
    assert.equal(rows(tracker, record, 3.999).length, 1);
    assert.equal(rows(tracker, record, 4).length, 0);
    const corrected = createDetailCombatDeath();
    corrected.begin(1.14, { ...viewport, snapshotTime: .95 }); corrected.observe(actor(species), point, { scale: 1.3, facing: -1 });
    corrected.begin(1, { ...viewport, snapshotTime: 1 }); assert.equal(rows(corrected, record, 1).length, 1);
  }
});

function nativeModal(species, facing, outerScale, pixelRatio = 1) {
  const calls = [], stack = [], shadowCalls = [];
  const context = new Proxy({ globalAlpha: 1, filter: 'none', matrix: { x: 0, y: 0, sx: 1, sy: 1 },
    save() { stack.push({ globalAlpha: this.globalAlpha, filter: this.filter, matrix: { ...this.matrix } }); },
    restore() { Object.assign(this, stack.pop()); },
    setTransform(a, b, c, d, x, y) { assert.equal(b + c, 0); this.matrix = { x, y, sx: a, sy: d }; },
    translate(x, y) { this.matrix.x += x * this.matrix.sx; this.matrix.y += y * this.matrix.sy; },
    scale(x, y) { this.matrix.sx *= x; this.matrix.sy *= y; },
    drawImage(image, ...args) { calls.push({ path: image.path, args, matrix: { ...this.matrix }, alpha: this.globalAlpha, filter: this.filter }); }
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const animation = CREATURE_DEATH_ANIMATIONS[species], entry = { animation, sprite: { path: animation.image, complete: true, naturalWidth: animation.columns * animation.frameSize } };
  const tracker = watched(species, facing, outerScale), record = corpse(species), canvas = { clientWidth: 1040, clientHeight: 480, dataset: {}, style: {}, getContext: () => context };
  const scope = createContext({ state: { agents: [], rivals: [], corpses: [record], simSeconds: 1, combatVfx: { streamId: 'stream' }, camera: { zoom: 0 } },
    Spawner: { createDetailCombatDeath, detailCreatureDeathShadow, CREATURE_DEATH_ANIMATIONS, unitAnimationFrame, imageFrameGeometry, UNIT_DISPLAY_SIZES },
    creatureDeathSheets: new Map([[species, entry]]), unitDisplayScales: new Map(), unitDisplayBounds: new Map(), unitGroundShapes: new Map(),
    // Current image hashes and decoded bounds are checked separately below.
    tribeArt: { bounds: sprite => sprite === entry.sprite ? audited(species).deathBounds : audited(species).idleBounds },
    idleMotion: { matches: false }, window: { devicePixelRatio: pixelRatio }, groundShadow: { path: 'existing-ground-shadow' },
    connection: { roomId: 'room', simSeconds: 1 }, endingOffset: 0,
    combatWatch: { id: 'fight', deaths: tracker, maxWidth: .8, maxHeight: .7 }, combatSelected: null,
    combatPanel: { open: true }, combatOpen: {}, evolutionPanel: { hidden: true }, welcome: { hidden: true },
    combatCanvas: canvas, combatRoster: { dataset: { key: '' }, children: [] }, combatHeading: {}, combatDetail: {}, combatSummary: {}, combatGauge: {},
    selectedCombatUnits: () => [], combatArenaUnits: units => units, combatVisualEvent: () => null, combatBackgroundAt: () => 'grassland', combatBackgrounds: { grassland: 'ground' },
    appearanceWorld: { prepare: () => new Map() }, detailCombatVfx: { commands: () => [], vitalCommands: () => [], clearView() {} },
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)), drawGroundShadow: (...args) => shadowCalls.push(args)
  });
  scope.corpsePlaybackTime = () => scope.state.simSeconds + scope.endingOffset;
  for (const name of ['prepareUnitDisplaySize', 'prepareCreatureDeathSize', 'drawCreatureDeath', 'drawCreatureCorpse', 'drawAgentCorpse', 'drawCorpseGroundShadow', 'drawCombatPanel']) runInContext(extract(name), scope);
  const cached = audited(species), idle = CREATURE_IDLE_ANIMATIONS[species];
  const idleScale = idle.frameSize / 512 * 480 / Math.max(cached.idleBounds.width, cached.idleBounds.height);
  assert.equal(idleScale, cached.idleScale);
  scope.prepareUnitDisplaySize(species, {}, idle, 1.4 * idleScale * (idle.registrationScale || 1));
  assert.equal(scope.unitDisplayScales.get(species), cached.outerBaseScale);
  scope.prepareCreatureDeathSize(species, entry);
  // Bounds must only be read at preparation, never once per death frame.
  scope.tribeArt.bounds = () => { throw new Error('death playback remeasured art'); };
  const preparedScale = entry.scale;
  assert.equal(preparedScale, cached.preparedEntryScale);
  assert.equal(preparedScale, UNIT_DISPLAY_SIZES[species] * animation.viewSize /
    (1.4 * cached.outerBaseScale * Math.max(cached.deathBounds.width, cached.deathBounds.height)));
  function draw(time) { calls.length = 0; scope.state.simSeconds = time; scope.drawCombatPanel(time * 1000); assert.equal(stack.length, 0); assert.equal(context.globalAlpha, 1); assert.equal(context.filter, 'none'); assert.equal(entry.scale, preparedScale); return structuredClone(calls); }
  return { scope, entry, draw, tracker, record, canvas, shadowCalls, pixelRatio, outerScale };
}

test('actual modal and native corpse renderer preserve all 52 new registered cells, prepared scale, both directions and DPR/world support', () => {
  let checked = 0;
  for (const species of candidates) for (const facing of [-1, 1]) for (const growth of [1, 1.37]) for (const ratio of [1, 2]) {
    const scale = audited(species).outerBaseScale * growth;
    const view = nativeModal(species, facing, scale, ratio), animation = view.entry.animation;
    if (species === 'lantern-keeper') assert.equal(animation.viewSize, 248.71174377224202);
    if (species === 'spiny-back-leader') assert.deepEqual(animation.durationsMs, [80, 120, 520]);
    let elapsed = 0;
    for (let frame = 0; frame < animation.frameCount; frame++) {
      const time = 1 + (elapsed + .5) / 1000, draws = view.draw(time), [shadow, body] = draws;
      assert.equal(draws.length, 2); assert.equal(shadow.path, 'existing-ground-shadow'); assert.equal(body.path, animation.image);
      assert.deepEqual(body.args.slice(0, 4), [frame % animation.columns * animation.frameSize, Math.floor(frame / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize]);
      const cell = Math.min(1040 * .31, 1040 * .22 / .8, 480 * .43 / .7), geometry = imageFrameGeometry(animation, frame);
      const size = cell * 1.4 * view.entry.scale * animation.frameSize / animation.viewSize;
      assert.deepEqual(body.args.slice(4), [-size * geometry.pivotX / animation.frameSize, -size * geometry.pivotY / animation.frameSize, size, size]);
      assert.equal(body.matrix.sx, (facing > 0 ? -1 : 1) * scale * ratio); assert.equal(body.matrix.sy, scale * ratio);
      assert.equal(body.matrix.x, point.x * ratio); assert.equal(body.matrix.y, point.y * ratio);
      view.scope.state.camera.zoom = cell; view.scope.drawCorpseGroundShadow(view.record, { x: point.x, y: point.y });
      const world = view.shadowCalls.at(-1);
      assert.ok(Math.abs(shadow.args[2] / 2 - world[2] * scale) < 1e-9); assert.ok(Math.abs(shadow.args[3] / 2 - world[3] * scale) < 1e-9);
      assert.ok(Math.abs(shadow.alpha - world[4]) < 1e-12); assert.equal(shadow.matrix.sx, ratio);
      elapsed += animation.durationsMs[frame]; checked++;
    }
    assert.equal(view.draw(3.999)[1].args[0], (animation.frameCount - 1) % animation.columns * animation.frameSize);
    assert.equal(view.draw(4).length, 0);
  }
  assert.equal(checked, 416);
});

test('actual modal supports pause, resize, authoritative absence/recovery, missing art, reduced motion, ending clock and repeated close', () => {
  for (const species of candidates) {
    const view = nativeModal(species, 1, audited(species).outerBaseScale * 1.37), animation = view.entry.animation;
    const first = view.draw(1.1); assert.deepEqual(view.draw(1.1), first);
    view.scope.state.corpses = []; assert.equal(view.draw(1.2).length, 0);
    view.scope.state.corpses = [view.record]; assert.equal(view.draw(1.3)[1].args[0], unitAnimationFrame(animation, 300) % animation.columns * animation.frameSize);
    view.entry.sprite.complete = false; assert.equal(view.draw(1.4).filter(row => row.path === animation.image).length, 0);
    view.entry.sprite.complete = true; view.scope.idleMotion.matches = true;
    const last = animation.frameCount - 1; assert.equal(view.draw(1.5)[1].args[0], last % animation.columns * animation.frameSize);
    view.scope.idleMotion.matches = false;
    const full = view.draw(1.6); view.canvas.clientWidth /= 2; view.canvas.clientHeight /= 2;
    const half = view.draw(1.6); assert.equal(half[1].matrix.x, full[1].matrix.x / 2); assert.equal(half[1].matrix.y, full[1].matrix.y / 2); assert.equal(half[1].args[6], full[1].args[6] / 2);
    view.scope.endingOffset = 1; assert.equal(view.draw(1.6)[1].args[0], unitAnimationFrame(animation, 1600) % animation.columns * animation.frameSize);
    view.scope.endingOffset = 2.4; assert.equal(view.draw(1.6).length, 0);
    view.scope.endingOffset = 0;
    let close; view.scope.combatPanel.addEventListener = (name, callback) => { if (name === 'close') close = callback; };
    view.scope.combatReturnFocus = null; view.scope.unitPanel = { querySelector: () => null };
    const start = source.indexOf('    combatPanel.addEventListener("close", () => {');
    runInContext(source.slice(start, source.indexOf('\n    });', start) + 8), view.scope);
    assert.equal(typeof close, 'function'); close(); close(); assert.equal(view.draw(1.7).length, 0);
    view.scope.combatWatch = { id: 'fight' }; assert.equal(view.draw(1.8).length, 0, 'reopen cannot replay a corpse never seen alive in new view');
  }
});

// Optional evidence dependency only; no package installation or product import.
async function loadSharp() {
  try { return (await import('sharp')).default; }
  catch (packageError) {
    try { return (await import('/opt/codex/cua_node/lib/node_modules/sharp/dist/index.mjs')).default; }
    catch (fallbackError) {
      throw new AggregateError([packageError, fallbackError],
        'Optional pixel evidence requires sharp, either resolvable as a package or already installed at the documented /opt fallback. No decoder checks were skipped and nothing was installed.');
    }
  }
}

async function firstBounds(sharp, path, size) {
  const { data, info } = await sharp(new URL(path, root).pathname).extract({ left: 0, top: 0, width: size, height: size }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = size, y0 = size, x1 = 0, y1 = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[(y * size + x) * info.channels + 3] >= 16) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

test('approved current images, source frames, metadata and offline bytes retain audited identity and measured first-frame bounds', async () => {
  const sharp = await loadSharp();
  for (const species of candidates) {
    const row = audited(species), animation = CREATURE_DEATH_ANIMATIONS[species], idle = CREATURE_IDLE_ANIMATIONS[species];
    assert.equal(animation.image, row.image); assert.equal(hash(row.image), row.runtimeSha256); assert.equal(hash(row.sourceImage), row.sourceSha256);
    for (const frame of row.sourceFrames) assert.equal(hash(frame.path), frame.sha256, frame.path);
    const local = readFileSync(new URL(row.localImage, root), 'utf8').match(/data:image\/webp;base64,([^\"]+)/)[1];
    assert.equal(createHash('sha256').update(Buffer.from(local, 'base64')).digest('hex'), row.runtimeSha256);
    assert.deepEqual(await firstBounds(sharp, animation.image, animation.frameSize), row.deathBounds);
    assert.deepEqual(await firstBounds(sharp, idle.image, idle.frameSize), row.idleBounds);
    const dir = new URL(animation.image.slice(0, animation.image.lastIndexOf('/') + 1), root);
    const original = JSON.parse(readFileSync(new URL('death.json', dir))), runtimePath = new URL('runtime.json', dir);
    const metadata = existsSync(runtimePath) ? JSON.parse(readFileSync(runtimePath)) : { ...original.runtime, ...original.runtimeRegistration };
    for (const key of ['frameSize', 'viewSize', 'pivotX', 'pivotY', 'columns', 'groundRadiusX', 'groundRadiusY']) assert.equal(animation[key], metadata[key], species + '/' + key);
    assert.deepEqual(animation.frameGeometry, metadata.frameGeometry); assert.deepEqual(animation.durationsMs, original.durationsMs);
    assert.equal(animation.durationMs, original.durationMs); assert.equal(animation.frameCount, original.frameCount); assert.equal(animation.loop, false);
    assert.equal(unitAnimationFrame(animation, 2999), animation.frameCount - 1); assert.ok(animation.durationMs < 3000);
    if (metadata.sourceAtlasSha256) assert.equal(metadata.sourceAtlasSha256, row.sourceSha256);
    const dimensions = await sharp(new URL(animation.image, root).pathname).metadata();
    assert.deepEqual([dimensions.width, dimensions.height], row.dimensions);
  }
});
