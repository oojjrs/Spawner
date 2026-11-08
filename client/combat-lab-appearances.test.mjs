import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { COMBAT_LAB_APPEARANCES, combatLabPlayable, combatLabAppearance, combatLabWithAppearance, combatLabBladeCarapaceDna } from './combat-lab-appearances.mjs';
import { ATTRIBUTE_DNA } from '../server/dna.mjs';
import { validateDna, dnaAppearance, dnaUnitStats } from '../server/dna-unit.mjs';
import { startingWorkerDna } from '../server/tribe-start.mjs';
import { COMBAT_LAB_UNITS } from './combat-lab.mjs';
import { SIMULATION_STATS, DEFAULT_SIMULATION_RULES, deriveSimulationStats, createSimulationTrial } from './combat-simulation.mjs';
import { unitActionArtDefinition } from './unit-action-art.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
test('lab combo uses valid independently owned DNA and real melee/armor mechanics', () => {
  const first = combatLabBladeCarapaceDna(), second = combatLabBladeCarapaceDna();
  assert.equal(first.version, 6);
  assert.ok(validateDna(first, first.level, first.budget));
  assert.ok(ATTRIBUTE_DNA.trace(first.pieces, first.level).valid);
  assert.equal(ATTRIBUTE_DNA.price(first.pieces), first.budget);
  assert.notEqual(first.pieces, second.pieces); assert.notEqual(first.pieces[0], second.pieces[0]);
  assert.deepEqual(dnaAppearance(first), { blade: 1, carapace: 1 });
  for (const key of ['bean', 'spore', 'pebble', 'spring']) {
    const build = combatLabWithAppearance({ key, name: key }, 'blade-carapace');
    const stats = deriveSimulationStats(build);
    assert.equal(combatLabAppearance(build), 'blade-carapace');
    assert.ok(stats.dna.melee); assert.equal(stats.dna.ranged, false); assert.ok(stats.dna.armor > 0);
    const trial = createSimulationTrial({ left: build, right: build, random: false });
    for (const agent of trial.agents) assert.match(unitActionArtDefinition(agent).reference.image, /BladeCarapaceV1/);
    trial.finish(); assert.ok(trial.history.length > 0); assert.ok(trial.result());
    const native = combatLabWithAppearance(build, 'native');
    assert.equal(native.dna, undefined); assert.equal(deriveSimulationStats(native).health, dnaUnitStats(startingWorkerDna(key), key).health);
  }
  const neutral = COMBAT_LAB_UNITS.find(unit => !combatLabPlayable(unit.key)).key;
  assert.deepEqual(combatLabWithAppearance({ key: neutral, dna: first }, 'blade-carapace'), { key: neutral });
});

function fixture() {
  const nodes = [];
  class Element {
    constructor(tag, text) { this.tag = tag; this.textContent = text || ''; this.children = []; this.listeners = {}; this.dataset = {}; this.style = {}; this.value = ''; nodes.push(this); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
    addEventListener(kind, fn) { this.listeners[kind] = fn; }
    get options() { return this.children; }
    fire(kind, value) { if (value !== undefined) this.value = value; this.listeners[kind]?.(); }
  }
  const main = new Element('main');
  const scope = { COMBAT_LAB_UNITS, SIMULATION_STATS, DEFAULT_SIMULATION_RULES, deriveSimulationStats: build => deriveSimulationStats(plain(build)), createSimulationTrial: settings => createSimulationTrial(plain(settings)),
    COMBAT_LAB_APPEARANCES, combatLabPlayable, combatLabAppearance, combatLabWithAppearance, structuredClone,
    SpawnerCombatAudio: { createPlayer: () => ({ resume() {}, stop() {} }), create: () => ({}), reset() {} },
    document: { querySelector: () => main, createElement: tag => new Element(tag) },
    Option: class extends Element { constructor(label, value) { super('option', label); this.value = value; } },
    requestAnimationFrame() {}, createCombatStage: () => ({ render() {}, prepare: async () => {} }) };
  const code = readFileSync(new URL('./combat-lab.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  runInNewContext(code + '\nglobalThis.api = { inputs, rosters, selected, builds, elements, reset, getTrial: () => trial };', scope);
  return { ...scope.api, nodes };
}

test('DNA appearance controls preserve roster edits, cloning, reset, switching and neutral exclusions', () => {
  const f = fixture(), control = f.inputs.left.dnaAppearance;
  const buttons = label => f.nodes.filter(node => node.tag === 'button' && node.textContent === label);
  assert.equal(control.value, 'blade-carapace'); assert.equal(control.disabled, false);
  assert.deepEqual(control.options.map(option => option.value), COMBAT_LAB_APPEARANCES.filter(([key]) => key !== 'native').map(([key]) => key));
  control.fire('change', 'blade-carapace');
  assert.equal(combatLabAppearance(f.rosters.left[0]), 'blade-carapace');
  assert.match(unitActionArtDefinition(f.getTrial().agents[0]).reference.image, /BladeCarapaceV1/);
  buttons('유닛 추가')[0].fire('click');
  assert.equal(f.rosters.left.length, 2); assert.equal(control.value, 'blade-carapace');
  assert.notEqual(f.rosters.left[0].dna, f.rosters.left[1].dna);
  control.fire('change', 'native');
  assert.ok(f.rosters.left[1].dna); assert.ok(f.rosters.left[0].dna);
  assert.ok(deriveSimulationStats(plain(f.rosters.left[1])).canAttack);
  const roster = f.nodes.find(node => node.tag === 'select' && node.options[0]?.textContent === '왼쪽 1');
  roster.fire('change', '0'); assert.equal(control.value, 'blade-carapace');
  const saved = plain(f.rosters.left); f.reset(); assert.deepEqual(plain(f.rosters.left), saved);
  buttons('유닛 제거')[0].fire('click'); assert.equal(f.rosters.left.length, 1); assert.equal(control.value, 'blade-carapace');
  control.fire('change', 'blade-carapace');
  const neutral = COMBAT_LAB_UNITS.find(unit => !combatLabPlayable(unit.key)).key;
  f.inputs.left.appearance.fire('change', neutral);
  assert.equal(control.disabled, true); assert.equal(control.value, 'native'); assert.equal(f.rosters.left[0].dna, undefined);
  control.fire('change', 'blade-carapace'); // Even a synthetic disabled-control event cannot assign neutral DNA.
  assert.equal(f.rosters.left[0].dna, undefined);
  f.inputs.left.appearance.fire('change', 'spring');
  assert.equal(control.disabled, false); assert.equal(control.value, 'blade-carapace');
  control.fire('change', 'blade-carapace'); buttons('🎲')[0].fire('click');
  for (const side of ['left', 'right']) {
    assert.equal(f.rosters[side].length, 5);
    assert.ok(f.rosters[side].every(build => deriveSimulationStats(plain(build)).canAttack));
    assert.equal(f.inputs[side].dnaAppearance.value, combatLabAppearance(f.rosters[side][0]));
    assert.equal(f.inputs[side].dnaAppearance.disabled, !combatLabPlayable(f.rosters[side][0].key));
  }
});


test('lab range control changes only real start distance and resets the current trial', () => {
  const f = fixture();
  f.inputs.left.dnaAppearance.fire('change', 'blade-carapace');
  f.inputs.right.dnaAppearance.fire('change', 'blade-carapace');
  const before = plain(f.rosters);
  assert.equal(f.elements.distance.value, '1');
  let trial = f.getTrial(); assert.equal(trial.agents[0].x, trial.agents[1].x);
  const separation = Math.abs(trial.agents[1].combat.position.x - trial.agents[0].combat.position.x);
  f.elements.distance.fire('change', '2');
  trial = f.getTrial(); assert.equal(trial.agents[0].x, trial.agents[1].x);
  assert.equal(trial.agents[0].combat.initialDistance, 2);
  assert.ok(Math.abs(Math.abs(trial.agents[1].combat.position.x - trial.agents[0].combat.position.x) - separation - 1) < 1e-9);
  assert.deepEqual(plain(f.rosters), before);
  f.elements.distance.fire('change', '1');
  assert.equal(f.getTrial().time, 0); assert.equal(f.getTrial().agents[0].x, f.getTrial().agents[1].x);
});
