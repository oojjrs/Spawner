import test from 'node:test';
import assert from 'node:assert/strict';
import { combatDamage, unitCombatStats } from './combat-stats.mjs';
import { NEUTRAL_UNIT_STATS } from './neutral-unit-stats.mjs';
import { createCombat } from './combat.mjs';
import { dnaCombatStats } from './dna-combat-stats.mjs';
import { attackAnimationElapsed } from './attack.mjs';
import { unitActionState, createUnitAppearanceEventPlayback } from '../client/unit-appearance-state.mjs';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, actual + ' != ' + expected);
const clips = { attack: { durationsMs: [300, 700], hitTimeMs: 300 }, ranged: { durationsMs: [300, 700], launchAtMs: 300 } };

for (const sourceFull of [false, true]) for (const targetFull of [false, true])
  test('중립 피해는 스탯 저장 형태에 관계없이 관통·방어·감소·반격을 한 번씩 적용한다 ' + sourceFull + '/' + targetFull, () => {
    const attacker = { species: 'white-paw', stats: { ...(sourceFull ? unitCombatStats('white-paw') : {}), attackPower: 100 } };
    const defender = { species: 'walking-forest', stats: targetFull ? unitCombatStats('walking-forest') : {} };
    const source = NEUTRAL_UNIT_STATS['white-paw'], target = NEUTRAL_UNIT_STATS['walking-forest'];
    const expected = 100 * 100 / (100 + target.armor - source.penetration) * (1 - target.reduction / 100);
    near(combatDamage(attacker, defender, .5), expected);
    near(combatDamage(attacker, defender, 0), expected * .8);
    near(combatDamage(attacker, defender, 1), expected * 1.2);
    attacker.attack = { counter: true };
    near(combatDamage(attacker, defender, .5), expected * source.counterPower / 100);
  });

test('발사 기록이 아직 없는 원거리 준비 프레임도 유한한 시간으로 전진한다', () => {
  const agent = { id: 'a', health: 100, combat: { version: 2 }, attack: { startedAt: 0, launchedAt: .3,
    hitAt: .3, endsAt: 1, recovery: .7, dnaRanged: true, shotLaunches: [] } };
  const pose = unitActionState(agent, .15, { animations: clips });
  assert.equal(pose.action, 'ranged'); near(pose.elapsedMs, 150);
  assert.ok(pose.segments.flat().every(Number.isFinite));
});

test('연타 사이에 직전 접촉과 후딜을 보여 주고 마지막 접촉 뒤 원본 후딜을 보존한다', () => {
  const attack = { startedAt: 0, hitAt: .54, endsAt: 1.24, recovery: .7, meleeContacts: [.3, .42, .54] };
  for (const hit of attack.meleeContacts) {
    near(attackAnimationElapsed(attack, hit, .3, 1), .3);
    near(attackAnimationElapsed(attack, hit + .01, .3, 1), .31);
  }
  near(attackAnimationElapsed(attack, .74, .3, 1), .5);
  near(attackAnimationElapsed(attack, 1.24, .3, 1), 1);
});

function fixture(mode) {
  const dna = { ...dnaCombatStats({ blade: 1 }, {}), melee: mode === 'melee', ranged: mode === 'ranged',
    meleePower: 10, rangedPower: 10, meleeSpeed: 4, rangedSpeed: 4, power: 10, hits: 3, comboPower: 50, comboSpeed: .12 };
  const source = { id: 'a', ownerId: 'left', tribe: 'bean', x: 100, y: 100, health: 1000,
    stats: { health: 1000, speed: 1, dna }, attributes: {}, combatDisposition: 'aggressive', moveDuration: 0 };
  const target = { id: 'b', ownerId: 'right', tribe: 'bean', x: 100, y: 100, health: 1000,
    stats: { health: 1000, speed: 1, dna: dnaCombatStats({}, {}) }, attributes: {}, moveDuration: 0 };
  const events = [], environment = { games: new Map(), colonies: [], simSeconds: 0, combatSimulation: true,
    world: { terrain: new Uint8Array(320 * 320).fill(4) }, damageRandom: () => .5, combatRandom: () => .99,
    onCombatEvent(event) { events.push(event); } };
  for (const unit of [source, target]) environment.games.set(unit.ownerId, { agents: [unit],
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const combat = createCombat(environment); combat.engage(source, target, 0);
  for (const [index, unit] of [source, target].entries()) Object.assign(unit.combat.position,
    { x: index ? .4 : -.4, y: 0, fromX: index ? .4 : -.4, fromY: 0 });
  return { source, target, events, tick(time) { environment.simSeconds = time; combat.update(source, time); combat.update(target, time); } };
}

for (const mode of ['melee', 'ranged']) test(mode + ' 실제 3타의 준비·접촉·피해와 종료 후 0.25초 대기를 보존한다', () => {
  const f = fixture(mode), action = mode === 'melee' ? 'attack' : 'ranged';
  const frames = [], playback = createUnitAppearanceEventPlayback(), cues = [];
  const clip = { ...clips[action], sourceId: mode, events: [{ type: mode === 'melee' ? 'contact' : 'launch', atMs: 300 }] };
  for (let frame = 0; frame <= 89; frame++) {
    const time = frame / 60; f.tick(time);
    if (!f.source.attack) continue;
    const state = unitActionState(f.source, time, { animations: clips });
    assert.ok(Number.isFinite(state.elapsedMs));
    if (state.action !== action) continue;
    frames.push({ time, elapsed: state.elapsedMs });
    cues.push(...playback.update(state, clip, time));
  }
  for (const hit of [.3, .42, .54]) assert.ok(frames.some(frame => frame.time >= hit && frame.time < hit + .05 && frame.elapsed >= 300), String(hit));
  const hits = f.events.filter(event => event.kind === 'hit' && event.sourceId === f.source.id);
  assert.equal(hits.length, 3); assert.deepEqual(hits.map(event => event.amount), [10, 5, 5]);
  assert.equal(cues.length, 3); cues.forEach((cue, index) => near(cue.at, [.3, .42, .54][index]));
  assert.equal(f.source.attack, null); near(f.source.attackReady, 1.49);
  f.tick(1.489); assert.equal(f.source.attack, null);
  f.tick(1.49); near(f.source.attack.startedAt, 1.49);
  assert.equal(f.events.filter(event => event.kind === 'attack' && event.sourceId === f.source.id).length, 2);
});
