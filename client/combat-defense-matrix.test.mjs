import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat } from '../server/combat.mjs';
import { ATTRIBUTE_DNA } from '../server/dna.mjs';
import { snapshotCombatVfx } from '../server/combat-vfx-journal.mjs';
import { createCombatStage } from './combat-stage.mjs';
import { createSimulationTrial } from './combat-simulation.mjs';
import { combatViewLayout } from './unit-size.mjs';
import { DETAIL_DEFENSE_VFX } from './combat-detail-vfx.mjs';

const labelFor = { block: '방어', parry: '패링', miss: '회피' };
const tribes = ['bean', 'spore', 'pebble', 'spring'];
const dna = genes => ATTRIBUTE_DNA.stats(genes.map(id => {
  const gene = ATTRIBUTE_DNA.lookup.get(id);
  return { gene: id, grade: gene.grade, q: 0, r: 0, rotation: 0 };
}));

// These are actual combat outcomes, not authored outcome packets. Each defender
// has precisely the defensive trait under test; zero RNG selects its chance.
function scene(kind, mode, tribe, reverse) {
  const unit = (id, side, genes, x) => ({ id, ownerId: side ? 'right' : 'left', tribe, x, y: 100,
    health: 100, attributes: { blade: 1 }, combatDisposition: 'aggressive', moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, vision: 4, dna: dna(genes) } });
  const source = unit('source', Number(reverse), mode === 'ranged' ? ['blade', 'secretion'] : ['blade'], reverse ? 102 : 100);
  const target = unit('target', Number(!reverse), ['blade', { block: 'block', parry: 'parry', miss: 'evasion' }[kind]],
    mode === 'ranged' ? reverse ? 100 : 102 : source.x);
  Object.assign(source.stats.dna, { critical: 0 });
  Object.assign(target.stats.dna, { block: 0, parry: 0, evasion: 0, counter: 0, [kind === 'miss' ? 'evasion' : kind]: 100 });
  target.attackReady = 1000;
  const units = reverse ? [target, source] : [source, target];
  let rolls = 0;
  const environment = { world: { terrain: new Uint8Array(320 * 320).fill(4) },
    games: new Map(['left', 'right'].map(owner => [owner, { agents: units.filter(agent => agent.ownerId === owner),
      receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } }])),
    combatRandom: () => { rolls++; return 0; }, damageRandom: () => .5 };
  const combat = createCombat(environment); combat.update(source, 0);
  for (let time = .05; !source.attack && time <= 20; time += .05) combat.update(source, time);
  assert.ok(source.attack, 'source reaches attack range within 20 simulated seconds');
  const attack = source.attack, at = attack.hitAt;
  const snapshot = time => snapshotCombatVfx(environment, time);
  return { units, source, target, at, attack, snapshot, rolls: () => rolls,
    launch() { if (mode === 'ranged') combat.update(source, attack.launchedAt); },
    resolve() { combat.update(mode === 'ranged' ? target : source, at); } };
}

async function withLab(live, run, actualTrial) {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets, document: globalThis.document };
  const calls = [];
  globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
  delete globalThis.SpawnerAssets;
  globalThis.Image = class {
    constructor() { this.complete = true; this.naturalWidth = 4096; this.naturalHeight = 4096; }
    set src(value) { this.path = value; }
    get src() { return this.path; }
    async decode() {}
  };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {},
    getImageData(x, y, width, height) { return { data: new Uint8ClampedArray(width * height * 4).fill(255) }; } }) }) };
  const context = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push({ name: key, args })) });
  const stage = createCombatStage({ clientWidth: 1040, clientHeight: 480, getContext: () => context });
  const trial = actualTrial || { agents: live.units.map((agent, side) => ({ ...agent, combat: { ...agent.combat, side } })),
    history: [], projectiles: [], time: 0, result: () => null, vfx: live.snapshot(0) };
  const layout = combatViewLayout(1040, 480, trial.agents);
  let now = 100;
  const draw = (time, snapshot) => {
    if (!actualTrial) { trial.time = time; trial.vfx = snapshot; }
    calls.length = 0; stage.render(trial, now, true); now += 100;
    const art = calls.filter(c => c.name === 'drawImage').map(c => ({ image: c.args[0].src, args: c.args.slice(1) }));
    return { art, texts: calls.filter(c => c.name === 'fillText').map(c => ({ text: c.args[0], x: c.args[1], y: c.args[2] })),
      flight: art.filter(c => c.image.includes('CombatVfxV4/') && c.args[0] === 0 && c.args[1] === 0),
      impacts: art.filter(c => c.image.includes('CombatVfxV4/') && (c.args[0] > 0 || c.args[1] > 0)) };
  };
  try { await stage.prepare(trial); draw(0, trial.vfx); await run({ draw, trial, targetX: id => layout.positions.get(String(id)).x }); }
  finally { globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets; globalThis.document = saved.document; }
}

for (const kind of ['block', 'parry', 'miss']) for (const mode of ['melee', 'ranged']) for (const reverse of [false, true]) {
  test(`real world ${kind} / ${mode} / defender ${reverse ? 'left' : 'right'} in the shared stage`, async () => {
    for (const tribe of tribes) {
      const live = scene(kind, mode, tribe, reverse);
      await withLab(live, lab => {
        live.launch();
        const beforeTime = live.at - .001, before = live.snapshot(beforeTime);
        assert.equal(live.rolls(), 0, 'defense is not rolled before contact');
        const pending = lab.draw(beforeTime, before);
        assert.equal(pending.flight.length, mode === 'ranged' ? 1 : 0);
        assert.ok(!pending.texts.some(t => Object.values(labelFor).includes(t.text)));
        live.resolve();
        const journal = live.snapshot(live.at);
        const reaction = kind === 'parry' && mode === 'ranged' ? 'hit' : kind;
        const outcome = journal.events.find(e => e.kind === reaction && e.targetId === 'target');
        assert.ok(outcome, tribe); assert.equal(outcome.at, live.at); assert.equal(outcome.mode, mode);
        assert.equal(outcome.amount > 0, kind === 'block' || kind === 'parry' && mode === 'ranged');
        assert.ok(Math.abs((100 - live.target.health) - outcome.amount) < 1e-9);
        if (!outcome.amount) assert.equal(live.target.hurtStartedAt, undefined);
        const unchanged = JSON.stringify({ units: live.units, journal, rolls: live.rolls() });
        const result = lab.draw(live.at + .08, journal);
        if (reaction === 'hit') {
          assert.equal(journal.events.some(event => event.kind === 'parry'), false);
          assert.equal(result.texts.some(row => row.text === labelFor.parry), false);
          assert.equal(result.texts.filter(row => row.text === '−' + outcome.amount.toFixed(1)).length, 1);
          assert.equal(result.flight.length, 0);
          assert.ok(result.impacts.length > 0);
          assert.equal(JSON.stringify({ units: live.units, journal, rolls: live.rolls() }), unchanged);
          return;
        }
        assert.equal(result.texts.filter(t => t.text === labelFor[kind]).length, 1);
        assert.equal(result.texts.filter(t => t.text.startsWith('−')).length, kind === 'block' ? 1 : 0);
        if (kind === 'block') assert.ok(result.texts.some(t => t.text === '−' + outcome.amount.toFixed(1)));
        assert.equal(result.impacts.length, 0, 'defense does not invent a hit burst');
        assert.equal(result.art.filter(c => c.image === DETAIL_DEFENSE_VFX[kind]).length, kind === 'miss' ? 0 : 1);
        assert.equal(result.texts.find(t => t.text === labelFor[kind]).x < 520, lab.targetX('target') < 520, 'label follows the actual defender position');
        assert.equal(result.flight.length, 0);
        assert.equal(JSON.stringify({ units: live.units, journal, rolls: live.rolls() }), unchanged,
          'rendering never changes HP, game state, event evidence or RNG');
      });
    }
  });
}

test('a real delayed terminal packet keeps flight visible after ETA until its actual outcome is observed', async () => {
  for (const kind of ['block', 'parry', 'miss']) {
    const live = scene(kind, 'ranged', 'spore', false);
    await withLab(live, lab => {
      live.launch(); const launched = live.snapshot(live.attack.launchedAt);
      lab.draw(live.attack.launchedAt + .05, launched);
      live.resolve(); const resolved = live.snapshot(live.at);
      for (const time of [live.at, live.at + .02, live.at + .09]) {
        const result = lab.draw(time, launched);
        assert.equal(result.flight.length, 1, 'the stage does not substitute ETA for a result');
        assert.ok(!result.texts.some(t => Object.values(labelFor).includes(t.text)));
      }
      const result = lab.draw(live.at + .1, resolved);
      assert.equal(result.flight.length, 0);
      assert.equal(result.texts.filter(t => t.text === labelFor[kind]).length, kind === 'parry' ? 0 : 1);
    });
  }
});

for (const kind of ['block', 'parry', 'dodge']) for (const mode of ['melee', 'ranged']) for (const reverse of [false, true]) {
  test(`real laboratory ${kind} / ${mode} / defender ${reverse ? 'left' : 'right'}`, async () => {
    for (const tribe of tribes) {
      const attacker = { key: tribe, organs: { attack: mode === 'melee' ? 1 : 0, ranged: mode === 'ranged' ? 1 : 0 }, counts: { vitality: 4 } };
      const defender = { key: tribe, organs: { attack: 0, ranged: 0 }, counts: { vitality: 4 } };
      const trial = createSimulationTrial({ left: reverse ? defender : attacker, right: reverse ? attacker : defender,
        distance: mode === 'ranged' ? 2 : 1, random: false, rules: { maxSeconds: 20 } });
      const source = trial.agents[Number(reverse)], target = trial.agents[Number(!reverse)], hp = target.health;
      Object.assign(source.stats.dna, { critical: 0 });
      Object.assign(target.stats.dna, { block: 0, parry: 0, evasion: 0, counter: 0, [kind === 'dodge' ? 'evasion' : kind]: 100 });
      await withLab(null, ({ draw }) => {
        while (!source.attack && trial.time < 20 && !trial.reason) trial.advance(.01);
        assert.ok(source.attack, 'source reaches attack range within 20 simulated seconds');
        const contact = source.attack.hitAt;
        trial.advance(Math.max(0, contact - trial.time - .001));
        if (mode === 'ranged') {
          trial.advance(1 / 60);
          assert.ok(trial.vfx.events.some(event => event.kind === 'shoot'));
        }
        const before = draw(trial.time, trial.vfx);
        assert.equal(before.flight.length, mode === 'ranged' ? 1 : 0);
        assert.equal(target.health, hp);
        assert.ok(!before.texts.some(t => ['방어', '패링', '회피'].includes(t.text)));
        const arrival = trial.vfx.events.find(event => event.kind === 'shoot')?.arrivesAt ?? contact;
        trial.advance(arrival - trial.time + 1 / 60);
        const reaction = kind === 'parry' && mode === 'ranged' ? 'hit' : kind === 'dodge' ? 'miss' : kind;
        const outcome = trial.vfx.events.find(e => e.kind === reaction && e.targetId === target.id);
        assert.ok(outcome, `${tribe}/${kind}/${mode}/${reverse}`); assert.equal(outcome.mode, mode);
        assert.equal(outcome.amount > 0, kind === 'block' || reaction === 'hit');
        assert.ok(Math.abs(hp - target.health - outcome.amount) < 1e-9);
        const unchanged = JSON.stringify(trial), after = draw(trial.time, trial.vfx);
        if (reaction === 'hit') {
          assert.equal(trial.vfx.events.some(event => event.kind === 'parry'), false);
          assert.equal(after.texts.some(row => row.text === labelFor.parry), false);
          assert.equal(after.texts.filter(row => row.text === '−' + outcome.amount.toFixed(1)).length, 1);
          assert.equal(after.flight.length, 0);
          assert.ok(after.impacts.length > 0);
          assert.equal(JSON.stringify(trial), unchanged);
          return;
        }
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
