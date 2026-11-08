import { drawUnitAttackRing } from "./unit-attack-ring.mjs";
import { combatViewLayout, unitDisplaySize } from "./unit-size.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createCombatVfxCursor } from './combat-vfx-events.mjs';
import { createDetailCombatVfx, DETAIL_COMBAT_VFX, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect } from './combat-detail-vfx.mjs';
import { createCombat } from '../server/combat.mjs';
import { snapshotCombatVfx } from '../server/combat-vfx-journal.mjs';

const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const helper = readFileSync(new URL('./combat-detail-dodge.test.mjs', import.meta.url), 'utf8').split('const event = ')[0];
const box = { combatViewLayout, unitDisplaySize, drawUnitAttackRing, assert, source, createContext, runInContext, createCombatVfxCursor, createDetailCombatVfx,
  DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect };
createContext(box); runInContext(helper.slice(helper.indexOf('function extract(')), box);
function modal(options = {}) {
  const view = box.modal(options), scope = view.sandbox, context = view.canvas.getContext('2d');
  const points = new Map(), stack = []; let point = { x: 0, y: 0 };
  const save = context.save.bind(context), restore = context.restore.bind(context);
  context.setTransform = () => { point = { x: 0, y: 0 }; };
  context.save = () => { save(); stack.push({ ...point }); };
  context.restore = () => { restore(); point = stack.pop(); };
  context.translate = (x, y) => { point.x += x; point.y += y; };
  scope.drawAgentAppearanceLayer = (_ctx, _now, agent) => points.set(agent.id, { ...point });
  const draw = (time, events = []) => { points.clear(); const result = view.draw(time, events); return { ...result, points: new Map(points) }; };
  return { ...view, draw };
}
const counter = (reverse = false, extra = {}) => ({ id: 'counter', kind: 'counter', at: 1, endsAt: 1.12,
  amount: 0, sourceId: reverse ? 'target' : 'source', targetId: reverse ? 'source' : 'target', mode: 'melee', ...extra });

for (const canonical of [true, false]) test(`${canonical ? 'canonical' : 'legacy'} counter preparation belongs only to its actor and never hits or recoils its intended victim`, () => {
  for (const tribe of ['bean', 'spore', 'pebble', 'spring']) for (const reverse of [false, true]) {
    const view = modal(), event = counter(reverse), { sandbox, agents } = view;
    agents.forEach(agent => { agent.tribe = tribe; });
    const baseline = view.draw(.99), before = structuredClone(agents);
    if (!canonical) { sandbox.state.combatVfx = undefined; agents.forEach(agent => { agent.combat.lastEvent = { ...event, damage: 0 }; }); }
    const simulation = structuredClone(agents), result = view.draw(1.05, canonical ? [event] : []);
    const victim = agents.find(agent => agent.id === event.targetId), actor = agents.find(agent => agent.id === event.sourceId);
    assert.equal(sandbox.combatVisualEvent(victim), null, 'prepare is not an incoming result');
    assert.equal(sandbox.combatVisualEvent(actor)?.kind, 'counter');
    assert.equal(result.hits.length, 0); assert.equal(result.art.length, 0); assert.equal(result.commands.length, 0);
    assert.deepEqual(result.points.get(victim.id), baseline.points.get(victim.id));
    assert.deepEqual(structuredClone(agents), simulation); assert.equal(victim.health, before.find(a => a.id === victim.id).health);
    sandbox.combatSelected = victim.id; view.draw(1.05, canonical ? [event] : []); assert.match(sandbox.combatDetail.textContent, /교전 중$/);
    sandbox.combatSelected = actor.id; view.draw(1.05, canonical ? [event] : []); assert.match(sandbox.combatDetail.textContent, /반격$/);
  }
});

test('counter windup keeps the actor lunge, then the real later hit retains approved art and missing-art fallback', () => {
  for (const reverse of [false, true]) for (const unavailable of [[], [DETAIL_COMBAT_VFX.hit.image]]) {
    const view = modal({ unavailable }), event = counter(reverse), actor = view.agents.find(agent => agent.id === event.sourceId);
    const still = view.draw(.99);
    actor.attack = { counter: true, startedAt: 1, hitAt: 1.12, endsAt: 1.4, targetId: event.targetId };
    const prepare = view.draw(1.05, [event]);
    assert.notEqual(prepare.points.get(actor.id).x, still.points.get(actor.id).x, 'existing counter body lunge remains');
    assert.deepEqual(prepare.points.get(event.targetId), still.points.get(event.targetId));
    assert.equal(prepare.hits.length, 0); assert.equal(prepare.art.length, 0);
    const hit = { ...event, id: 'actual-hit', kind: 'hit', at: 1.12, amount: 2, counter: true };
    const result = view.draw(1.15, [event, hit]);
    assert.equal(result.commands.filter(row => row.kind === 'impact').length, 1);
    assert.equal(result.art.length, unavailable.length ? 0 : 1);
    assert.equal(result.hits.length, unavailable.length ? 1 : 0);
    assert.notEqual(result.points.get(event.targetId).x, still.points.get(event.targetId).x, 'actual received hit still recoils');
  }
});

test('simultaneous incoming damage or defense keeps priority over an outgoing counter prepare', () => {
  for (const kind of ['hit', 'block', 'parry', 'stun']) for (const reverse of [false, true]) {
    const view = modal(), event = counter(reverse), incoming = { ...event, id: 'incoming', kind,
      sourceId: event.targetId, targetId: event.sourceId, amount: kind === 'hit' || kind === 'block' ? 2 : 0 };
    view.draw(1.05, [incoming, event]);
    assert.equal(view.sandbox.combatVisualEvent(view.agents.find(agent => agent.id === event.sourceId)).kind, kind);
    assert.notEqual(view.sandbox.combatVisualEvent(view.agents.find(agent => agent.id === event.targetId))?.kind, 'counter');
  }
});

test('defense and stun indicators belong to the actual recipient in canonical and legacy views', () => {
  for (const canonical of [true, false]) for (const kind of ['parry', 'block', 'stun']) for (const reverse of [false, true]) {
    const view = modal(), event = counter(reverse, { kind });
    if (!canonical) { view.sandbox.state.combatVfx = undefined; view.agents.forEach(agent => { agent.combat.lastEvent = { ...event, damage: 0 }; }); }
    view.draw(1.05, canonical ? [event] : []);
    const actor = view.agents.find(agent => agent.id === event.sourceId), recipient = view.agents.find(agent => agent.id === event.targetId);
    assert.equal(view.sandbox.combatVisualEvent(actor), null, 'causing a status is not receiving it');
    assert.equal(view.sandbox.combatVisualEvent(recipient)?.kind, kind);
  }
});

test('repeated prepare events expire normally and never replay hit flashes across pause or narrow/reduced views', () => {
  const view = modal({ width: 320, height: 240 }), event = counter(); view.sandbox.idleMotion.matches = true;
  const first = view.draw(1.05, [event]); assert.equal(first.hits.length, 0);
  assert.deepEqual(view.draw(1.05, [event, event]).points, first.points);
  assert.equal(view.draw(1.11, [event]).hits.length, 0);
  assert.equal(view.draw(1.12, [event]).hits.length, 0);
  assert.equal(view.sandbox.combatVisualEvent(view.agents[0]), null);
});

test('counter preparation leaves the victim attack clock alone while a real hit retains existing hit-stop', () => {
  const view = modal(), victim = view.agents[0], event = counter(true), drawn = new Map();
  victim.attack = { startedAt: .8, hitAt: 1.2, endsAt: 1.5, targetId: 'target', meleeContacts: [1.2] };
  const saved = structuredClone(victim.attack);
  view.sandbox.drawAgentAppearanceLayer = (_ctx, _now, agent) => drawn.set(agent.id, structuredClone(agent.attack));
  view.draw(1.03, [event]);
  assert.deepEqual(drawn.get(victim.id), { ...saved, directionX: 1 });
  assert.deepEqual(victim.attack, saved);
  const hit = { ...event, id: 'real-hit', kind: 'hit', at: 1.03, amount: 2, counter: true };
  view.draw(1.04, [event, hit]);
  assert.ok(drawn.get(victim.id).hitAt > saved.hitAt, 'the existing brief hit-stop remains for actual received damage');
  assert.deepEqual(victim.attack, saved);
});

function serverScene(tribe, reverse = false) {
  const unit = (id, ownerId, attributes) => ({ id, ownerId, tribe, attributes, combatDisposition: 'aggressive',
    x: 100, y: 100, health: 100, stats: { health: 100, attack: 1, speed: 1, vision: 4 }, moveStartedAt: 0, moveDuration: 0 });
  const a = unit('source', 'a', {}), b = unit('target', 'b', { carapace: 1 }), units = reverse ? [b, a] : [a, b];
  let rolls = 0;
  const environment = { games: new Map(), colonies: [], simSeconds: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(4) }, combatRandom: () => { rolls++; return .99; }, damageRandom: () => { rolls++; return .5; } };
  for (const actor of units) environment.games.set(actor.ownerId, { agents: [actor], receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const combat = createCombat(environment); combat.engage(a, b, 0);
  b.combat.nextAttackAt = Infinity;
  const tick = time => { environment.simSeconds = time; for (const actor of units) if (actor.health > 0) combat.update(actor, time); };
  tick(0);
  for (let time = .05; !a.attack && time < 10; time += .05) tick(time);
  assert.ok(a.attack, "접근을 끝낸 공격자가 공격을 시작한다");
  const firstAt = a.attack.hitAt; tick(firstAt);
  return { environment, a, b, units, tick, firstAt, rolls: () => rolls };
}

test('real server counter preparation cannot preempt its later damage and rendering never changes server outcomes', () => {
  for (const tribe of ['bean', 'spore', 'pebble', 'spring']) for (const reverse of [false, true]) {
    const live = serverScene(tribe, reverse), control = serverScene(tribe, reverse);
    const snapshot = snapshotCombatVfx(live.environment, live.firstAt), event = snapshot.events.find(row => row.kind === 'counter');
    assert.ok(event); assert.equal(event.amount, 0); assert.ok(event.endsAt > event.at);
    const actor = live.units.find(agent => agent.id === event.sourceId), victim = live.units.find(agent => agent.id === event.targetId);
    const hp = victim.health, beforeDraw = JSON.stringify(live.units), rolls = live.rolls(), view = modal({ units: [live.a, live.b] });
    // Use real counter evidence, isolating its prepare channel from the prior defended hit.
    view.draw(event.at - .001); const drawn = view.draw(event.at + .01, [event]);
    assert.equal(drawn.hits.length, 0); assert.equal(drawn.art.length, 0);
    assert.equal(JSON.stringify(live.units), beforeDraw); assert.equal(live.rolls(), rolls);
    live.tick(actor.attack.hitAt - 1e-6); control.tick(control.units.find(a => a.id === event.sourceId).attack.hitAt - 1e-6);
    assert.equal(victim.health, hp);
    const hitAt = actor.attack.hitAt; live.tick(hitAt); control.tick(hitAt);
    const result = snapshotCombatVfx(live.environment, hitAt).events.find(row => row.kind === 'hit' && row.counter && row.sourceId === actor.id);
    assert.ok(result); assert.ok(result.amount > 0); assert.ok(victim.health < hp);
    assert.deepEqual(live.units, control.units); assert.equal(live.rolls(), control.rolls());
  }
});
