import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import * as death from '../../../client/combat-detail-death.mjs';
import { unitDisplayAttributes, unitDominantAppearanceMask } from '../../../client/unit-display-appearance.mjs';
import { agentDeathAnimation, agentDeathFrame } from '../../../client/agent-death.mjs';
import { unitRangedLifecycleAnimation } from '../../../client/unit-ranged.mjs';
import { imageFrameGeometry } from '../../../client/image-geometry.mjs';
import { createDetailCombatVfx } from '../../../client/combat-detail-vfx.mjs';
const source = readFileSync(new URL('../../../client/game.js', import.meta.url), 'utf8');
const before = readFileSync(new URL('./baseline-draw-agent-corpse.js', import.meta.url), 'utf8');
const extract = (name, text = source) => {
 const value = text.match(new RegExp('^    function ' + name + '\\([^]*?^    }', 'm'))?.[0];
 assert.ok(value, name); return value;
};
const actor = (id = 'a', extra = {}) => ({ id, tribe: 'bean', health: 10, x: 100, y: 100, stats: { health: 10 }, attributes: {}, combat: { id: 'fight', side: 0, targetId: 'b' }, ...extra });
const body = (id = 'a', extra = {}) => ({ kind: 'corpse', id: 'corpse:' + id, agentId: id, tribe: 'bean', x: 100, y: 100, attributes: {}, facing: -1, diedAt: 1, decaysAt: 4, ...extra });
const viewport = { scope: 'fight', roomId: 'room', streamId: 'stream', width: 1040, height: 480 };
const camera = { width: 1040, height: 480, cell: 200 };
const location = { x: 405.6, y: 364.8, width: 100, height: 160 };
function tracking(extra = {}) {
 const track = death.createDetailCombatDeath(), unit = actor('a', extra);
 track.begin(.99, { ...viewport, visibleIds: ['a'], livingAgents: [unit] });
 track.observe(unit, location, { scale: 1.75, facing: 1 });
 track.begin(1.01, { ...viewport, visibleIds: [], livingAgents: [] });
 return track;
}
function modal({ units = [actor(), actor('b', { combat: { id: 'fight', side: 1, targetId: 'a' } })] } = {}) {
 let matrix = { x: 0, y: 0, sx: 1, sy: 1 }, state = { globalAlpha: 1, filter: 'none' };
 const images = [], shadows = [], live = [], stack = [];
 const context = new Proxy({
  get globalAlpha() { return state.globalAlpha; }, set globalAlpha(value) { state.globalAlpha = value; },
  get filter() { return state.filter; }, set filter(value) { state.filter = value; },
  setTransform() { matrix = { x: 0, y: 0, sx: 1, sy: 1 }; },
  save() { stack.push({ matrix: { ...matrix }, state: { ...state } }); },
  restore() { ({ matrix, state } = stack.pop()); },
  translate(x, y) { matrix.x += x * matrix.sx; matrix.y += y * matrix.sy; },
  scale(x, y) { matrix.sx *= x; matrix.sy *= y; },
  drawImage(image, ...args) { images.push({ path: image.path, args, matrix: { ...matrix }, state: { ...state } }); },
  ellipse(...args) { shadows.push({ args, matrix: { ...matrix } }); }
 }, { get: (target, key) => target[key] ?? (() => {}) });
 const sheets = new Map(['bean', 'spore', 'pebble', 'spring'].map(tribe => [tribe,
  new Map([['death', { sprite: { path: agentDeathAnimation(body('a', { tribe })).image, complete: true, naturalWidth: 2048 }, scale: 1 }]])]));
 const canvas = { clientWidth: 1040, clientHeight: 480, dataset: {}, style: {}, getContext: () => context };
 const scope = createContext({
  state: { agents: units, rivals: [], simSeconds: .99, corpses: [], combatVfx: { version: 1, streamId: 'stream' } },
  connection: { roomId: 'room' }, Spawner: { ...death, unitDisplayAttributes, agentDeathAnimation, unitRangedLifecycleAnimation, imageFrameGeometry,
    combatProfile: () => ({ attackInterval: 1 }), combatPrimary: () => 'blade', CREATURE_ATTACK_ANIMATIONS: {}, hasCombatEvolution: () => false },
  selectedCombatUnits: () => units.filter(unit => unit.health > 0), combatOpen: {}, evolutionPanel: { hidden: true }, welcome: { hidden: true },
  combatPanel: { open: true }, combatWatch: { id: 'fight' }, combatSelected: 'a', combatSummary: {}, combatRoster: { dataset: {}, children: [], replaceChildren() {} },
  combatHeading: {}, combatDetail: {}, combatGauge: {}, combatCanvas: canvas, combatStatsText: () => '',
  combatBackgroundAt: () => 'grassland', combatBackgrounds: { grassland: 'ground.png' }, combatUnitScale: unit => unit.testScale || 1.75,
  unitDisplayBounds: new Map(['bean', 'spore', 'pebble', 'spring'].map(key => [key, { width: .5, height: .8 }])), unitDisplayScales: new Map(),
  appearanceWorld: { prepare: () => new Map(), draw: () => false }, drawAgentAppearanceLayer(_ctx, _now, agent, cell) { live.push({ id: agent.id, matrix: { ...matrix }, cell }); },
  idleMotion: { matches: false }, window: { devicePixelRatio: 2 }, AGENT_HEIGHT: .7, clamp: (n, a, b) => Math.min(b, Math.max(a, n)),
  combatVfxFrame: { active: [], projectiles: [] }, detailCombatVfx: createDetailCombatVfx(),
  document: { createElement: () => ({ dataset: {}, addEventListener() {} }) },
  unitAnimationSheets: sheets, agentDeathFrame, combatAttributeArt: { ready: () => false }, tribeArt: { animationFrame: () => null },
  agentRangedImage: path => ({ path, complete: true, naturalWidth: 2048 }), drawSelectionOutline() {},
  drawCreatureCorpse: () => { throw new Error('Excluded creature reached corpse renderer'); }, endingOffset: 0,
 });
 scope.corpsePlaybackTime = () => scope.state.simSeconds + scope.endingOffset;
 for (const name of ['combatVisualEvent', 'combatArenaUnits', 'drawCombatPanel', 'drawAgentCorpse']) runInContext(extract(name), scope);
 function draw(time) {
  images.length = shadows.length = live.length = 0; scope.state.simSeconds = time; scope.drawCombatPanel(time * 1000);
  assert.equal(stack.length, 0, 'canvas state balanced'); return { images: [...images], shadows: [...shadows], live: [...live] };
 }
 function kill(id = 'a', extra = {}) {
  const unit = units.find(unit => unit.id === id); unit.health = 0;
  scope.state.corpses.push(body(id, { tribe: unit.tribe, attributes: structuredClone(unit.attributes), ...extra }));
 }
 return { scope, units, canvas, draw, kill, sheets };
}

test('independent complete 4 x 32 dominance matrix admits exactly base and secretion silhouettes', () => {
 const keys = ['blade', 'carapace', 'antenna', 'feet', 'secretion'];
 for (const tribe of ['bean', 'spore', 'pebble', 'spring']) for (let mask = 0; mask < 32; mask++) {
  const attributes = Object.fromEntries(keys.filter((_, bit) => mask & 1 << bit).map(key => [key, 1]));
  const dominant = unitDominantAppearanceMask(mask);
  assert.equal(death.detailDeathForm(actor('a', { tribe, attributes })), dominant === 0 ? tribe + '/base' : dominant === 16 ? tribe + '/secretion' : null);
  assert.equal(death.detailDeathForm(actor('a', { tribe, attributes: { ...attributes, strength: 1 } })), null);
 }
 assert.equal(death.detailDeathForm(actor('a', { attributes: { secretion: 1 }, appearanceAttributes: { blade: 1 } })), null);
 assert.equal(death.detailDeathForm(actor('a', { attributes: { blade: 1 }, appearanceAttributes: { secretion: 1 } })), 'bean/secretion');
});

test('frozen authoritative inputs are read-only; duplicate and unrelated corpses cannot mint extra commands', () => {
 const record = Object.freeze({ ...body(), attributes: Object.freeze({}) });
 const tracked = tracking();
 assert.equal(tracked.commands(Object.freeze([body('other'), record, record]), 1.01, camera).length, 1);
 assert.equal(record.facing, -1); assert.equal(record.health, undefined); assert.equal(record.attributes.secretion, undefined);
});

test('first observation must be recent, within the same room/stream/fight and match world position', () => {
 const cases = [{ diedAt: .1 }, { diedAt: 2 }, { x: 101 }, { y: 99 }, { tribe: 'spring' }, { decaysAt: 1 }, { agentId: null }, { kind: 'resource' }];
 for (const patch of cases) assert.equal(tracking().commands([body('a', patch)], 1.01, camera).length, 0, JSON.stringify(patch));
 for (const patch of [{ scope: 'other' }, { roomId: 'other' }, { streamId: 'other' }]) {
  const track = tracking(); track.begin(1.01, { ...viewport, ...patch }); assert.equal(track.commands([body()], 1.01, camera).length, 0);
 }
 const stale = tracking(); stale.begin(1.85, viewport); assert.equal(stale.commands([body()], 1.85, camera).length, 0);
});

test('real modal captures displaced support, actual facing and last body scale rather than world corpse orientation', () => {
 const view = modal();
 view.units[0].attack = { targetId: 'b', startedAt: .5, hitAt: .9, endsAt: 1.5 };
 const before = view.draw(.99), support = before.live.find(row => row.id === 'a');
 assert.ok(support.matrix.x > view.canvas.clientWidth * .39, 'observe actual lunge support');
 view.kill('a', { facing: -1 });
 const after = view.draw(1.01), image = after.images.find(image => image.path.includes('death-runtime'));
 assert.ok(image); assert.equal(image.matrix.x, support.matrix.x); assert.equal(image.matrix.y, support.matrix.y);
 assert.equal(image.matrix.sx, support.matrix.sx); assert.equal(image.matrix.sy, support.matrix.sy);
 assert.equal(after.live.length, 1); assert.equal(after.live[0].id, 'b');
});

test('real modal all-dead scene continues current authoritative corpses to exact expiry', () => {
 const view = modal(); view.draw(.99); view.kill('a'); view.kill('b');
 assert.equal(view.draw(1.01).images.length, 2); assert.equal(view.scope.combatDetail.textContent, '전투 종료');
 assert.equal(view.draw(3.999).images.length, 2); assert.equal(view.draw(4).images.length, 0);
});

test('real six-slot arena does not later resurrect hidden, departed, or reassigned living participants', () => {
 const units = Array.from({ length: 8 }, (_, index) => actor(String(index), { combat: { id: 'fight', side: index < 4 ? 0 : 1, targetId: index < 4 ? '4' : '0' } }));
 const view = modal({ units }); view.scope.combatSelected = '0'; view.draw(.99);
 view.kill('3'); assert.equal(view.draw(1.01).images.length, 0, 'never-displayed fourth actor');
 view.scope.combatSelected = '2'; view.draw(1.02);
 // A seen actor leaving this combat while alive must lose its anchor.
 units[0].combat = { id: 'new-fight', side: 0 }; view.draw(1.03);
 view.kill('0', { diedAt: 1.04, decaysAt: 4.04 }); assert.equal(view.draw(1.05).images.length, 0);
});

test('actual close hook clears anchors and reopening cannot replay an existing corpse', () => {
 const view = modal(); view.draw(.99); view.kill(); assert.equal(view.draw(1.01).images.length, 1);
 const hook = source.match(/combatPanel\.addEventListener\("close", \(\) => \{([^]*?)\n    \}\);/)?.[1]; assert.ok(hook);
 Object.assign(view.scope, { combatReturnFocus: null, unitPanel: { querySelector: () => null } }); runInContext(hook, view.scope);
 assert.equal(view.draw(1.1).images.length, 0);
});

test('real paused clock freezes death crop; ending playback advances and expires while sim is frozen', () => {
 const view = modal(); view.draw(.99); view.kill();
 const first = view.draw(1.01).images; assert.deepEqual(view.draw(1.01).images, first);
 view.scope.endingOffset = 1.5; const late = view.draw(1.01).images; assert.equal(late.length, 1); assert.notDeepEqual(late[0].args.slice(0, 4), first[0].args.slice(0, 4));
 view.scope.endingOffset = 3; assert.equal(view.draw(1.01).images.length, 0);
});

test('current corpse absence hides immediately and restoration retains original age instead of replaying death', () => {
 const view = modal(); view.draw(.99); view.kill(); const first = view.draw(1.01).images;
 const records = view.scope.state.corpses; view.scope.state.corpses = []; assert.equal(view.draw(1.3).images.length, 0);
 view.scope.state.corpses = records; const restored = view.draw(2).images; assert.equal(restored.length, 1); assert.notDeepEqual(restored[0].args.slice(0, 4), first[0].args.slice(0, 4));
});

test('missing secretion death sheet uses unchanged shared fallback, recovery keeps authoritative age', () => {
 assert.equal(extract('drawAgentCorpse'), extract('drawAgentCorpse', before), 'fallback is inherited, not modified by this batch');
 const view = modal(); view.units[0].attributes.secretion = 1; view.draw(.99); view.kill();
 view.scope.agentRangedImage = () => null; const pending = view.draw(1.01).images;
 assert.equal(pending.length, 1); assert.equal(pending[0].path, agentDeathAnimation(body()).image);
 view.scope.agentRangedImage = path => ({ path, complete: true, naturalWidth: 2048 }); const recovered = view.draw(1.5).images;
 assert.equal(recovered.length, 1); assert.ok(recovered[0].path.includes('UnitRangedV1/bean/death.png'));
 assert.notDeepEqual(recovered[0].args.slice(0, 4), pending[0].args.slice(0, 4));
});

test('non-proportional resize keeps body support normalized and preserves uniform body scale', () => {
 const view = modal(); view.draw(.99); view.kill(); const before = view.draw(1.01).images[0];
 view.canvas.clientWidth = 520; const after = view.draw(1.1).images[0];
 assert.equal(after.matrix.x, before.matrix.x / 2); assert.equal(after.matrix.y, before.matrix.y);
 assert.equal(after.matrix.sx, after.matrix.sy, 'body never stretches nonuniformly');
});

test('reduced motion renders the final authored death cell without changing snapshot data', () => {
 const view = modal(); view.draw(.99); view.kill(); view.scope.idleMotion.matches = true;
 const snapshot = JSON.stringify(view.scope.state), image = view.draw(1.01).images[0], animation = agentDeathAnimation(body());
 assert.deepEqual(image.args.slice(0, 4), [(animation.frameCount - 1) % animation.columns * animation.frameSize, Math.floor((animation.frameCount - 1) / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize]);
 assert.equal(JSON.stringify(view.scope.state), snapshot.replace('"simSeconds":0.99', '"simSeconds":1.01'));
});

test('delayed authoritative corpse is not rejected when the interpolated living paint led its death time', () => {
 const view = modal(); view.scope.connection.simSeconds = 1;
 view.draw(1.14); // Last received living sample is 1.00; interpolation can reach 1.15.
 view.kill('a', { diedAt: 1.05, decaysAt: 4.05 });
 view.scope.connection.simSeconds = 1.05; // applySnapshot retains renderedAt=1.14.
 const result = view.draw(1.14);
 assert.equal(result.images.length, 1, 'valid death after observed snapshot must survive a render-clock lead');
 assert.equal(result.images[0].matrix.x, view.canvas.clientWidth * .39);
});

test('repainting an old living snapshot does not refresh the authoritative freshness boundary', () => {
 const view = modal(); view.scope.connection.simSeconds = 1;
 view.draw(1.15); view.draw(1.15);
 view.kill('a', { diedAt: 1.9, decaysAt: 4.9 }); view.scope.connection.simSeconds = 1.95;
 assert.equal(view.draw(1.95).images.length, 0, 'death over .85s after the last authoritative living observation is not eligible');
});

test('terminal ending snapshot preserves a witnessed death when authoritative time corrects a leading render clock backward', () => {
 const view = modal(); view.scope.connection.simSeconds = 1;
 view.draw(1.14);
 view.kill('a', { diedAt: 1.05, decaysAt: 4.05 });
 view.scope.connection.simSeconds = 1.05; view.scope.state.ending = { endedAt: 1.05 };
 // applySnapshot does not preserve renderedAt for ending; render uses ending.endedAt.
 assert.equal(view.draw(1.05).images.length, 1, 'terminal authoritative correction is not a user backseek');
 view.scope.endingOffset = 1; assert.equal(view.draw(1.05).images.length, 1);
 view.scope.endingOffset = 3; assert.equal(view.draw(1.05).images.length, 0);
});

test('authoritative rewind clears observed anchors even when display time stays monotonic', () => {
 const view = modal(); view.scope.connection.simSeconds = 1; view.draw(1.14);
 view.kill('a', { diedAt: 1.05, decaysAt: 4.05 });
 view.scope.connection.simSeconds = .9;
 assert.equal(view.draw(1.15).images.length, 0, 'rewind in authority cannot be hidden by a preserved display timestamp');
});
