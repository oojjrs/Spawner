// Offline reviewer probe: executes the real modal renderer with recorded canvas
// calls, real server snapshots, and a compact copy of only the former selector.
// No browser, product mutation, or dependency on the whole before/game.js file.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createCombat } from '../../../server/combat.mjs';
import { snapshotCombatVfx } from '../../../server/combat-vfx-journal.mjs';
import { createCombatVfxCursor, combatVfxAt } from '../../../client/combat-vfx-events.mjs';
import { createDetailCombatVfx, DETAIL_COMBAT_VFX, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect } from '../../../client/combat-detail-vfx.mjs';

const source = readFileSync(new URL('../../../client/game.js', import.meta.url), 'utf8');
const oldSelector = `    function combatVisualEvent(agent) {
      if (!agent?.combat) return null;
      if (state.combatVfx?.version === 1) {
        const matches = combatVfxFrame.active.filter(cue => ["impact", "defense", "prepare", "status"].includes(cue.channel) &&
          ["hit", "critical", "followup", "area", "reflect", "counter", "dodge", "parry", "block", "stun"].includes(cue.kind) &&
          (cue.kind !== "dodge" || String(cue.targetId) === String(agent.id)) &&
          (String(cue.sourceId) === String(agent.id) || String(cue.targetId) === String(agent.id)));
        const cue = matches.findLast(cue => ["defense", "status"].includes(cue.channel) && cue.kind !== "dodge" && String(cue.targetId) === String(agent.id)) ||
          matches.findLast(cue => cue.channel === "impact" && String(cue.targetId) === String(agent.id)) ||
          matches.findLast(cue => cue.kind === "dodge") || matches.at(-1);
        return cue ? { ...cue, kind: ["critical", "followup", "area", "reflect"].includes(cue.kind) ? "hit" : cue.kind, damage: cue.amount } : null;
      }
      const relevant = event => event && (String(event.sourceId) === String(agent.id) || String(event.targetId) === String(agent.id)) && ["hit", "counter", "parry", "block", "stun"].includes(event.kind);
      const reaction = agent.combat.lastReaction;
      if (relevant(reaction) && String(reaction.targetId) === String(agent.id) && state.simSeconds >= reaction.at && state.simSeconds - reaction.at < .5) return reaction;
      const event = agent.combat.lastEvent;
      return relevant(event) ? event : null;
    }
`;
const helper = readFileSync(new URL('../../../client/combat-detail-dodge.test.mjs', import.meta.url), 'utf8').split('const event = ')[0];
const selectorStart = source.indexOf('    function combatVisualEvent('), selectorEnd = source.indexOf('    function combatBackgroundAt(', selectorStart);
assert.ok(selectorStart >= 0 && selectorEnd > selectorStart);
function makeModal({ old = false, ...options } = {}) {
  const game = old ? (source.slice(0, selectorStart) + oldSelector + source.slice(selectorEnd))
    .replace('["hit", "stun"].includes(impact.kind)', '["hit", "counter", "stun"].includes(impact.kind)')
    .replace('!["dodge", "counter"].includes(impact.kind)', 'impact.kind !== "dodge"') : source;
  const box = { assert, source: game, createContext, runInContext, createCombatVfxCursor,
    createDetailCombatVfx, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect };
  createContext(box); runInContext(helper.slice(helper.indexOf('function extract(')), box);
  const view = box.modal(options), ctx = view.canvas.getContext('2d'), points = new Map(), stack = [];
  let point = { x: 0, y: 0 };
  const save = ctx.save.bind(ctx), restore = ctx.restore.bind(ctx);
  ctx.setTransform = () => { point = { x: 0, y: 0 }; };
  ctx.save = () => { save(); stack.push({ ...point }); };
  ctx.restore = () => { restore(); point = stack.pop(); };
  ctx.translate = (x, y) => { point.x += x; point.y += y; };
  view.sandbox.drawAgentAppearanceLayer = (_ctx, _now, agent) => points.set(agent.id, { ...point });
  const draw = view.draw;
  view.draw = (...args) => { points.clear(); return { ...draw(...args), points: new Map(points) }; };
  return view;
}
function scene(tribe = 'bean', reverse = false) {
  const unit = (id, ownerId) => ({ id, ownerId, tribe, combatDisposition: 'aggressive', combatPrimary: 'carapace',
    attributes: { carapace: 1 }, x: 100, y: 100, health: 10000,
    stats: { health: 10000, speed: 1, vision: 3 }, moveDuration: 0, moveStartedAt: 0 });
  const units = [unit('source', 'left'), unit('target', 'right')], order = reverse ? units.toReversed() : units;
  let rolls = 0;
  const environment = { games: new Map(), colonies: [], simSeconds: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(4) },
    combatRandom: () => { rolls++; return .99; }, damageRandom: () => { rolls++; return .5; } };
  for (const actor of units) environment.games.set(actor.ownerId, { agents: [actor],
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const combat = createCombat(environment); combat.engage(order[0], order[1], 0);
  const tick = at => { environment.simSeconds = at; for (const unit of order) combat.update(unit, at); };
  tick(0); const initialSnapshot = snapshotCombatVfx(environment, 0); tick(.4);
  const snapshot = snapshotCombatVfx(environment, .4), counter = snapshot.events.find(event => event.kind === 'counter');
  assert.ok(counter); assert.equal(counter.amount, 0); assert.equal(counter.at, .4); assert.equal(counter.endsAt, .52);
  return { units, environment, tick, initialSnapshot, snapshot, counter, rolls: () => rolls };
}
function setSelection(view, id, canonical, reverse = false) {
  if (reverse) view.agents.forEach(agent => { agent.combat.side = 1 - agent.combat.side; });
  view.sandbox.combatSelected = id;
  if (!canonical) view.sandbox.state.combatVfx = undefined;
}
function sync(view, live) {
  view.agents.forEach((agent, i) => Object.assign(agent, live.units[i], { combat: { ...live.units[i].combat, id: 'fight', side: agent.combat.side } }));
}
const rows = [];
for (const canonical of [true, false]) for (const tribe of ['bean', 'spore', 'pebble', 'spring']) for (const reverse of [false, true]) {
  const live = scene(tribe, reverse), control = scene(tribe, reverse), targetId = live.counter.targetId;
  const snapshot = canonical ? live.snapshot : [], old = makeModal({ old: true, units: live.units, initialSnapshot: live.initialSnapshot }),
    view = makeModal({ units: live.units, initialSnapshot: live.initialSnapshot });
  setSelection(old, targetId, canonical, reverse); setSelection(view, targetId, canonical, reverse);
  const before = structuredClone(live.units), rolls = live.rolls();
  const was = old.draw(.45, snapshot), now = view.draw(.45, snapshot);
  assert.equal(was.hits.length, 1, 'former modal falsely paints one gold burst before damage');
  assert.equal(now.hits.length, 0, 'whole server snapshot no longer paints phantom damage');
  assert.notDeepEqual(was.points.get(targetId), now.points.get(targetId), 'former target recoil removed');
  assert.match(old.sandbox.combatDetail.textContent, /반격$/);
  assert.doesNotMatch(view.sandbox.combatDetail.textContent, /반격$/);
  const actor = live.units.find(agent => agent.id === live.counter.sourceId);
  assert.deepEqual(was.points.get(actor.id), now.points.get(actor.id), 'counter actor motion unchanged');
  assert.equal(now.commands.filter(command => command.kind === 'impact' && command.targetId === targetId).length, 0);
  assert.deepEqual(live.units, before); assert.equal(live.rolls(), rolls);
  rows.push({ channel: canonical ? 'canonical' : 'legacy', tribe, reversedCanvasSideAndUpdateOrder: reverse,
    futureVictim: targetId, prepareAt: live.counter.at, hitAt: live.counter.endsAt,
    beforeGold: was.hits.length, afterGold: now.hits.length,
    beforeStatus: old.sandbox.combatDetail.textContent, afterStatus: view.sandbox.combatDetail.textContent,
    beforeVictimX: was.points.get(targetId).x, afterVictimX: now.points.get(targetId).x });
  const victim = live.units.find(agent => agent.id === targetId), hp = victim.health;
  live.tick(.519999); control.tick(.519999); assert.equal(victim.health, hp);
  live.tick(.52); control.tick(.52); assert.ok(victim.health < hp);
  assert.deepEqual(live.units, control.units); assert.equal(live.rolls(), control.rolls());
  const realSnapshot = snapshotCombatVfx(live.environment, .52), hit = realSnapshot.events.find(event => event.kind === 'hit' && event.counter);
  assert.ok(hit); assert.equal(hit.targetId, targetId); assert.ok(hit.amount > 0);
  sync(view, live);
  const landed = view.draw(.55, canonical ? realSnapshot : []);
  assert.equal(view.sandbox.combatVisualEvent(view.agents.find(agent => agent.id === targetId)).kind, 'hit');
  assert.ok(canonical ? landed.art.length >= 1 : landed.hits.length === 1, 'real hit remains visible');
  if (canonical) {
    const missing = makeModal({ units: before, initialSnapshot: live.initialSnapshot, unavailable: [DETAIL_COMBAT_VFX.hit.image] });
    setSelection(missing, targetId, true, reverse); missing.draw(.45, live.snapshot); sync(missing, live);
    const fallback = missing.draw(.55, realSnapshot);
    assert.equal(fallback.hits.length, 1, 'actual counter hit retains missing-art fallback');
  }
}
// Independently enumerate canonical source/recipient ownership and incoming priority.
const box = { state: { combatVfx: { version: 1 }, simSeconds: 1.05 }, combatVfxFrame: { active: [] } };
createContext(box); runInContext(source.slice(selectorStart, selectorEnd), box);
const a = { id: 'a', combat: {} }, b = { id: 'b', combat: {} };
const event = (kind, extra = {}) => ({ id: kind, kind, at: 1, sourceId: 'a', targetId: 'b', amount: 0, ...extra });
for (const kind of ['counter', 'parry', 'block', 'stun', 'dodge', 'hit', 'critical', 'area', 'reflect']) {
  box.combatVfxFrame = combatVfxAt([event(kind, { amount: ['hit', 'critical', 'area', 'reflect'].includes(kind) ? 2 : 0 })], 1.05);
  assert.equal(!!box.combatVisualEvent(a), ['counter', 'hit', 'critical', 'area', 'reflect'].includes(kind));
  assert.equal(!!box.combatVisualEvent(b), kind !== 'counter');
}
for (const incoming of ['hit', 'critical', 'area', 'reflect', 'parry', 'block', 'stun']) for (const order of [false, true]) {
  const events = [event('counter', { sequence: order ? 1 : 2 }),
    event(incoming, { id: 'incoming', sourceId: 'b', targetId: 'a', amount: 2, sequence: order ? 2 : 1 })];
  box.combatVfxFrame = combatVfxAt(events, 1.05);
  assert.equal(box.combatVisualEvent(a).eventId, 'incoming');
}
box.state.combatVfx = undefined;
for (const kind of ['parry', 'block', 'stun']) {
  a.combat = { lastEvent: event('counter'), lastReaction: event(kind, { sourceId: 'b', targetId: 'a' }) };
  assert.equal(box.combatVisualEvent(a).kind, kind, 'legacy recent received reaction keeps priority');
}
const output = { result: 'PASS', renderer: 'actual drawCombatPanel in Node VM; canvas call recording, not pixel/browser QA',
  scenarios: rows.length, actualServerWholeSnapshot: true, preservesRealHitAndMissingArtFallback: true,
  preservesIncomingAndLegacyReactionPriority: true, serverStateAndRandomCallsUnchanged: true, rows };
writeFileSync(new URL('./counter-owner-evidence.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ ...output, rows: undefined }, null, 2));
