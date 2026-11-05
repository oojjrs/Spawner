import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createCombat } from '../server/combat.mjs';
import { ATTRIBUTE_DNA } from '../server/dna.mjs';
import { snapshotCombatVfx } from '../server/combat-vfx-journal.mjs';
import { createCombatVfxCursor } from './combat-vfx-events.mjs';
import { createCombatStage } from './combat-stage.mjs';
import { createSimulationTrial } from './combat-simulation.mjs';
import { createDetailCombatVfx, DETAIL_COMBAT_VFX, DETAIL_COMBAT_VFX_ASSETS, DETAIL_DEFENSE_VFX,
  drawDetailVfxCell, drawDetailVitalEffect, detailDefenseImageReady,
  drawDetailDefenseEffect, drawDetailDefenseFallback, drawDetailDefenseLabels } from './combat-detail-vfx.mjs';
import { combatDodgePose, drawCombatDodgeTrails, drawCombatDodgeGhosts, drawCombatDodgeLabel } from './combat-dodge-vfx.mjs';

const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const helperFile = readFileSync(new URL('./combat-detail-dodge.test.mjs', import.meta.url), 'utf8').split('const event = ')[0];
const helper = helperFile.slice(helperFile.indexOf('function extract('))
  .replace('key: "source,target"', 'key: agents.map(agent => agent.id).join(",")');
const box = { assert, source, createContext, runInContext, createCombatVfxCursor, createDetailCombatVfx,
  DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect };
createContext(box); runInContext(helper, box);
const drawHelpers = { detailDefenseImageReady, drawDetailDefenseEffect, drawDetailDefenseFallback, drawDetailDefenseLabels,
  combatDodgePose, drawCombatDodgeTrails, drawCombatDodgeGhosts, drawCombatDodgeLabel };
const labelFor = { block: '방어', parry: '패링', miss: '회피' };
const tribes = ['bean', 'spore', 'pebble', 'spring'];
const dna = genes => ATTRIBUTE_DNA.stats(genes.map(id => {
  const gene = ATTRIBUTE_DNA.lookup.get(id);
  return { gene: id, grade: gene.grade, shape: [...gene.steps], rotation: 0 };
}));

// These are actual combat outcomes, not authored outcome packets. Each defender
// has precisely the defensive trait under test; zero RNG selects its chance.
function scene(kind, mode, tribe, reverse) {
  const unit = (id, side, genes, x) => ({ id, ownerId: side ? 'right' : 'left', tribe, x, y: 100,
    health: 100, attributes: { blade: 1 }, combatDisposition: 'aggressive', moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, vision: 4, dna: dna(genes) } });
  const source = unit('source', Number(reverse), mode === 'ranged' ? ['blade', 'secretion'] : ['blade'], reverse ? 102 : 100);
  const target = unit('target', Number(!reverse), ['blade', { block: 'carapace', parry: 'parry', miss: 'legs' }[kind]],
    mode === 'ranged' ? reverse ? 100 : 102 : source.x);
  const units = reverse ? [target, source] : [source, target];
  let rolls = 0;
  const environment = { world: { terrain: new Uint8Array(320 * 320).fill(4) },
    games: new Map(['left', 'right'].map(owner => [owner, { agents: units.filter(agent => agent.ownerId === owner),
      receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } }])),
    combatRandom: () => { rolls++; return 0; }, damageRandom: () => .5 };
  const combat = createCombat(environment); combat.update(source, 0);
  const attack = source.attack, at = attack.hitAt;
  const snapshot = time => snapshotCombatVfx(environment, time);
  return { units, source, target, at, attack, snapshot, rolls: () => rolls,
    launch() { if (mode === 'ranged') combat.update(source, attack.launchedAt); },
    resolve() { combat.update(mode === 'ranged' ? target : source, at); } };
}

function detailView(live) {
  const modal = box.modal({ units: live.units, initialSnapshot: live.snapshot(0) });
  Object.assign(modal.sandbox.Spawner, drawHelpers);
  const bodies = [];
  modal.sandbox.drawAgentAppearanceLayer = (_ctx, _now, agent) => bodies.push(agent.id);
  return { draw(time, snapshot) { bodies.length = 0; return { ...modal.draw(time, snapshot), bodies: [...bodies] }; } };
}

function withLab(live, run, actualTrial = null) {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets };
  const calls = [];
  globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
  delete globalThis.SpawnerAssets;
  globalThis.Image = class {
    constructor() { this.complete = true; this.naturalWidth = 4096; this.naturalHeight = 4096; }
    set src(value) { this.path = value; }
    get src() { return this.path; }
  };
  const context = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push({ name: key, args })) });
  const stage = createCombatStage({ clientWidth: 1040, clientHeight: 480, getContext: () => context });
  const trial = actualTrial || { agents: live.units.map((agent, side) => ({ ...agent, combat: { ...agent.combat, side } })),
    history: [], projectiles: [], time: 0, result: () => null, vfx: live.snapshot(0) };
  let now = 100;
  const draw = (time, snapshot) => {
    if (!actualTrial) { trial.time = time; trial.vfx = snapshot; }
    calls.length = 0; stage.render(trial, now, true); now += 100;
    const art = calls.filter(c => c.name === 'drawImage').map(c => ({ image: c.args[0].src, args: c.args.slice(1) }));
    return { art, texts: calls.filter(c => c.name === 'fillText').map(c => ({ text: c.args[0], x: c.args[1], y: c.args[2] })),
      flight: art.filter(c => c.image.includes('CombatVfxV4/') && c.args[0] === 0 && c.args[1] === 0),
      impacts: art.filter(c => c.image.includes('CombatVfxV4/') && (c.args[0] > 0 || c.args[1] > 0)) };
  };
  try { draw(0, trial.vfx); run({ draw, trial }); }
  finally { globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets; }
}

for (const kind of ['block', 'parry', 'miss']) for (const mode of ['melee', 'ranged']) for (const reverse of [false, true]) {
  test(`real world ${kind} / ${mode} / defender ${reverse ? 'left' : 'right'} in detail and lab`, () => {
    for (const tribe of tribes) {
      const live = scene(kind, mode, tribe, reverse), detail = detailView(live);
      withLab(live, lab => {
        live.launch();
        const beforeTime = live.at - .001, before = live.snapshot(beforeTime);
        assert.equal(live.rolls(), 0, 'defense is not rolled before contact');
        const a = detail.draw(beforeTime, before), b = lab.draw(beforeTime, before);
        assert.equal(a.commands.filter(c => c.kind === 'flight').length, mode === 'ranged' ? 1 : 0);
        assert.equal(b.flight.length, mode === 'ranged' ? 1 : 0);
        assert.ok(!a.texts.some(t => Object.values(labelFor).includes(t.text)));
        assert.ok(!b.texts.some(t => Object.values(labelFor).includes(t.text)));
        live.resolve();
        const journal = live.snapshot(live.at), outcome = journal.events.find(e => e.kind === kind && e.targetId === 'target');
        assert.ok(outcome, tribe); assert.equal(outcome.at, live.at); assert.equal(outcome.mode, mode);
        assert.equal(outcome.amount > 0, kind === 'block');
        assert.ok(Math.abs((100 - live.target.health) - outcome.amount) < 1e-9);
        if (kind !== 'block') assert.equal(live.target.hurtStartedAt, undefined);
        const unchanged = JSON.stringify({ units: live.units, journal, rolls: live.rolls() });
        const results = [detail.draw(live.at + .08, journal), lab.draw(live.at + .08, journal)];
        const unrelatedDamage = journal.events.filter(e => e.amount > 0 && e.id !== outcome.id);
        for (const result of results) {
          assert.equal(result.texts.filter(t => t.text === labelFor[kind]).length, 1);
          const directCount = result === results[0] ? unrelatedDamage.length : 0;
          assert.equal(result.texts.filter(t => t.text.startsWith('−')).length, (kind === 'block' ? 1 : 0) + directCount,
            'detail also labels actual reciprocal damage; the defense result itself is unchanged');
          if (result === results[0]) for (const event of unrelatedDamage)
            assert.ok(result.texts.some(t => t.text === '−' + event.amount.toFixed(1)), 'actual unrelated damage is labeled once');
          if (kind === 'block') assert.ok(result.texts.some(t => t.text === '−' + outcome.amount.toFixed(1)),
            'block damage label uses only the actual residual damage');
          assert.equal(result.art.filter(c => c.image.includes('CombatVfxV4/')).length, unrelatedDamage.length,
            'defense has no hit burst, while actual reciprocal damage still renders');
          assert.equal(result.art.filter(c => c.image === DETAIL_DEFENSE_VFX[kind]).length, kind === 'miss' ? 0 : 1);
          const label = result.texts.find(t => t.text === labelFor[kind]);
          assert.equal(label.x < 520, reverse, 'label follows the actual defending faction');
        }
        if (kind === 'miss') {
          assert.equal(results[0].bodies.filter(id => id === 'target').length, 4, 'defender body plus three echoes');
          assert.equal(results[0].bodies.filter(id => id === 'source').length, 1, 'no attacker dodge');
        }
        assert.equal(results[0].commands.filter(c => c.kind === 'flight').length, 0);
        assert.equal(results[1].flight.length, 0);
        assert.equal(JSON.stringify({ units: live.units, journal, rolls: live.rolls() }), unchanged,
          'rendering never changes HP, game state, event evidence or RNG');
      });
    }
  });
}

test('a real delayed terminal packet keeps flight visible after ETA until its actual outcome is observed', () => {
  for (const kind of ['block', 'parry', 'miss']) {
    const live = scene(kind, 'ranged', 'spore', false), detail = detailView(live);
    withLab(live, lab => {
      live.launch(); const launched = live.snapshot(live.attack.launchedAt);
      detail.draw(live.attack.launchedAt + .05, launched); lab.draw(live.attack.launchedAt + .05, launched);
      live.resolve(); const resolved = live.snapshot(live.at);
      // Actual server resolution already exists, but its packet has not arrived.
      for (const time of [live.at, live.at + .02, live.at + .09]) {
        const a = detail.draw(time, launched), b = lab.draw(time, launched);
        assert.equal(a.commands.filter(c => c.kind === 'flight').length, 1, 'detail does not substitute ETA for a result');
        assert.equal(b.flight.length, 1, 'lab does not substitute ETA for a result');
        assert.ok(!a.texts.some(t => Object.values(labelFor).includes(t.text)));
        assert.ok(!b.texts.some(t => Object.values(labelFor).includes(t.text)));
      }
      const time = live.at + .1, a = detail.draw(time, resolved), b = lab.draw(time, resolved);
      assert.equal(a.commands.filter(c => c.kind === 'flight').length, 0); assert.equal(b.flight.length, 0);
      for (const result of [a, b]) assert.equal(result.texts.filter(t => t.text === labelFor[kind]).length, 1);
    });
  }
});

for (const kind of ['block', 'parry', 'dodge']) for (const mode of ['melee', 'ranged']) for (const reverse of [false, true]) {
  test(`real laboratory ${kind} / ${mode} / defender ${reverse ? 'left' : 'right'}`, () => {
    for (const tribe of tribes) {
      const attacker = { key: tribe, organs: { attack: mode === 'melee' ? 1 : 0, ranged: mode === 'ranged' ? 1 : 0 }, counts: { vitality: 4 } };
      const defender = { key: tribe, organs: { attack: 0, ranged: 0 }, counts: { vitality: 4, [kind === 'dodge' ? 'evasion' : kind]: 20 } };
      const trial = createSimulationTrial({ left: reverse ? defender : attacker, right: reverse ? attacker : defender,
        distance: mode === 'ranged' ? 2 : 1, seed: kind === 'parry' && !reverse ? 2 : 1, random: false,
        rules: { maxSeconds: 1 } });
      const target = trial.agents[Number(!reverse)], hp = target.health;
      withLab(null, ({ draw }) => {
        trial.advance(mode === 'ranged' ? .4 : .29);
        const before = draw(trial.time, trial.vfx);
        assert.equal(before.flight.length, mode === 'ranged' ? 1 : 0);
        assert.equal(target.health, hp);
        assert.ok(!before.texts.some(t => ['방어', '패링', '회피'].includes(t.text)));
        trial.advance((mode === 'ranged' ? .7 : .38) - trial.time);
        const outcome = trial.vfx.events.find(e => e.kind === kind && e.targetId === target.id);
        assert.ok(outcome, `${tribe}/${kind}/${mode}/${reverse}`); assert.equal(outcome.mode, mode);
        assert.equal(outcome.amount > 0, kind === 'block');
        assert.ok(Math.abs(hp - target.health - outcome.amount) < 1e-9);
        const unchanged = JSON.stringify(trial), after = draw(trial.time, trial.vfx);
        const label = { block: '방어', parry: '패링', dodge: '회피' }[kind];
        assert.equal(after.texts.filter(t => t.text === label).length, 1);
        assert.equal(after.texts.find(t => t.text === label).x < 520, reverse);
        assert.equal(after.flight.length, 0); assert.equal(after.impacts.length, 0);
        assert.equal(after.texts.filter(t => t.text.startsWith('−')).length, kind === 'block' ? 1 : 0);
        if (kind === 'block') assert.ok(after.texts.some(t => t.text === '−' + outcome.amount.toFixed(1)));
        assert.equal(after.art.filter(c => c.image === DETAIL_DEFENSE_VFX[kind]).length, kind === 'dodge' ? 0 : 1);
        assert.equal(JSON.stringify(trial), unchanged, 'render leaves the actual simulation untouched');
      }, trial);
    }
  });
}
