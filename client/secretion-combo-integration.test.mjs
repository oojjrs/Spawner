import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNIT_APPEARANCE_BITS, UNIT_APPEARANCE_TRIBES, unitAppearanceMaskFromAttributes } from '../server/unit-appearance.mjs';
import { UNIT_COMBINATION_FORMS, UNIT_COMBINATION_MASKS } from './unit-combination-forms.mjs';
import { unitCombinationAppearance, unitDisplayAttributes, unitDominantAppearanceMask, UNIT_DISPLAY_FORM_COUNT } from './unit-display-appearance.mjs';
import { SECRETION_COMBO_ACTION_ART } from './secretion-combo-assets.mjs';
import { unitActionArtDefinition, unitActionArtPose } from './unit-action-art.mjs';
import { beanHeldHurtSource } from './bean-held-hurt.mjs';
import { speciesHeldHurtSource } from './species-held-hurt.mjs';
import { WELCOME_UNIT_APPEARANCES, welcomeUnitPerformance } from './welcome-presentation.mjs';
import { COMBAT_LAB_APPEARANCES, combatLabAppearance, combatLabCombinationDna, combatLabWithAppearance } from './combat-lab-appearances.mjs';
import { validateDna, dnaAppearance } from '../server/dna-unit.mjs';
import { ATTRIBUTE_DNA } from '../server/dna.mjs';
import { deriveSimulationStats, createSimulationTrial } from './combat-simulation.mjs';
const forms = UNIT_COMBINATION_FORMS.filter(form => form.attributes.secretion);
const make = (tribe, form) => ({ tribe, attributes: form.attributes, health: 20, bornAt: 0 });

test('exact authored masks select 40 silhouettes without changing extra-trait or legacy routing', () => {
  const seen = new Set();
  for (const tribe of UNIT_APPEARANCE_TRIBES) for (let mask = 0; mask < 32; mask++) {
    const form = UNIT_COMBINATION_FORMS.find(row => row.mask === mask);
    const attributes = Object.fromEntries(Object.entries(UNIT_APPEARANCE_BITS).filter(([, bit]) => mask & bit).map(([key]) => [key, 2]));
    const unit = { tribe, attributes }, original = JSON.stringify(unit);
    const expected = form?.mask ?? [1, 16, 2, 4, 8].find(bit => mask & bit) ?? 0;
    assert.equal(unitCombinationAppearance(unit), form?.key || null);
    assert.equal(unitDominantAppearanceMask(mask), expected);
    assert.equal(unitAppearanceMaskFromAttributes(unitDisplayAttributes(unit)), expected);
    assert.equal(JSON.stringify(unit), original); seen.add(tribe + '/' + expected);
    if (form?.attributes.secretion) assert.equal(unitActionArtDefinition(unit), SECRETION_COMBO_ACTION_ART[tribe + '/' + form.key]);
  }
  assert.equal(seen.size, 40); assert.equal(UNIT_DISPLAY_FORM_COUNT, 40);
  for (const form of forms) {
    const unit = make('bean', form);
    assert.equal(unitCombinationAppearance({ ...unit, appearanceAttributes: {} }), null);
    assert.equal(unitCombinationAppearance({ tribe: 'bean', dna: combatLabCombinationDna(form.key) }), form.key);
    for (const key of ['strength', 'arms', 'piercing', 'guard', 'legs', 'feet', 'antenna'])
      assert.equal(unitCombinationAppearance({ ...unit, attributes: { ...unit.attributes, [key]: 1 } }), null, key);
    assert.equal(unitCombinationAppearance({ ...unit, species: 'spiny-back-beetle' }), null);
  }
});

for (const tribe of UNIT_APPEARANCE_TRIBES) for (const form of forms) test(`${tribe}/${form.key} owns all required poses and no forbidden attack`, () => {
  const unit = make(tribe, form), definition = unitActionArtDefinition(unit), clips = definition.actions;
  const expected = ['idle', 'walk', 'ranged', 'hurt', 'birth', 'death', ...(form.attributes.blade ? ['attack'] : [])];
  assert.deepEqual(Object.keys(clips).sort(), expected.sort());
  const samples = {
    idle: {}, walk: { moveStartedAt: 0, moveDuration: 1 },
    ranged: { attack: { startedAt: 0, launchedAt: .2, hitAt: .8, endsAt: 1, mode: 'ranged' } },
    attack: { attack: { startedAt: 0, hitAt: .3, endsAt: 1, mode: 'melee' } },
    hurt: { hurtStartedAt: 0 }, birth: { birth: { startedAt: 0, readyAt: 5 } }, death: { health: 0, diedAt: 0 },
  };
  for (const action of expected) {
    const pose = unitActionArtPose({ ...unit, ...samples[action] }, .1);
    assert.equal(pose.action, action); assert.equal(pose.animation, clips[action]); assert.equal(pose.missing, false);
  }
  const rangedAtRelease = unitActionArtPose({ ...unit, ...samples.ranged }, .2);
  const cue = clips.ranged.launchAtMs;
  let index = 0, elapsed = cue;
  while (index < clips.ranged.durationsMs.length - 1 && elapsed >= clips.ranged.durationsMs[index]) elapsed -= clips.ranged.durationsMs[index++];
  assert.equal(rangedAtRelease.frame, clips.ranged.frames?.[index] ?? index);
  const after = unitActionArtPose({ ...unit, ...samples.ranged }, 1);
  assert.equal(after.action, 'idle');
  const death = unitActionArtPose({ ...unit, ...samples.death }, 100);
  assert.equal(death.frame, clips.death.frames?.at(-1) ?? clips.death.frameCount - 1);
  const carrying = unitActionArtPose({ ...unit, ...samples.walk, carrying: 2 }, .1);
  assert.equal(carrying.animation, clips.walk);
  assert.equal(beanHeldHurtSource(unit), null); assert.equal(speciesHeldHurtSource(unit), null);
  assert.equal(clips.birth.worldTravelIncludedInPixels, true);
  if (!form.attributes.blade) assert.equal(unitActionArtPose({ ...unit, ...samples.attack }, .1).missing, true);
});

test('all four laboratory choices use independently valid DNA and correct attack capabilities', () => {
  assert.equal(COMBAT_LAB_APPEARANCES.length, 5);
  for (const form of UNIT_COMBINATION_FORMS) {
    const dna = combatLabCombinationDna(form.key), other = combatLabCombinationDna(form.key);
    assert.ok(validateDna(dna, dna.level, dna.budget)); assert.ok(ATTRIBUTE_DNA.trace(dna.pieces, dna.level).valid);
    assert.deepEqual(dnaAppearance(dna), form.attributes); assert.notEqual(dna.pieces[0].shape, other.pieces[0].shape);
    for (const key of UNIT_APPEARANCE_TRIBES) {
      const build = combatLabWithAppearance({ key }, form.key), stats = deriveSimulationStats(build);
      assert.equal(combatLabAppearance(build), form.key);
      assert.equal(stats.dna.melee, !!form.attributes.blade); assert.equal(stats.dna.ranged, !!form.attributes.secretion);
      assert.equal(stats.dna.armor > 0, !!form.attributes.carapace);
      const trial = createSimulationTrial({ left: build, right: build, distance: form.attributes.secretion ? 2 : 1, random: false });
      for (const actor of trial.agents) assert.equal(unitCombinationAppearance(actor), form.key);
      trial.finish(); assert.ok(trial.result());
      const shots = trial.vfx.events.filter(event => event.kind === 'shoot');
      assert.equal(shots.length > 0, !!form.attributes.secretion);
      if (form.attributes.secretion && !form.attributes.blade) assert.equal(trial.vfx.events.some(event => event.mode === 'melee'), false);
    }
  }
});

test('observing combo poses never changes combat outcomes or launch-event streams', () => {
  for (const form of forms) {
    const build = combatLabWithAppearance({ key: 'bean' }, form.key), settings = { left: build, right: build, distance: 2, random: false };
    const observed = createSimulationTrial(settings), control = createSimulationTrial(settings);
    for (let i = 0; i < 40; i++) {
      observed.advance(.1); control.advance(.1);
      for (const actor of observed.agents) { unitActionArtPose(actor, observed.time); unitDisplayAttributes(actor); }
    }
    assert.deepEqual(observed.history, control.history); assert.deepEqual(observed.agents, control.agents);
    const clean = trial => JSON.stringify(trial.vfx).replaceAll(trial.vfx.streamId, 'stream');
    assert.equal(clean(observed), clean(control));
  }
});

test('welcome includes twelve new identities with authored ranged or melee performance', () => {
  assert.equal(WELCOME_UNIT_APPEARANCES.length, 11);
  for (const tribe of UNIT_APPEARANCE_TRIBES) for (const form of forms) {
    assert.ok(WELCOME_UNIT_APPEARANCES.some(attributes => unitCombinationAppearance({ attributes }) === form.key));
    const performance = welcomeUnitPerformance(make(tribe, form), 10);
    assert.equal(performance.action, form.attributes.blade ? 'attack' : 'ranged');
    assert.equal(unitActionArtPose(performance.agent, 10.1).animation, performance.animation);
  }
});

test('built runtime and lab carry new registry and all four visible combination choices', () => {
  const runtime = readFileSync(new URL('./runtime.js', import.meta.url), 'utf8');
  const lab = readFileSync(new URL('../Combat.html', import.meta.url), 'utf8');
  for (const form of forms) {
    assert.ok(runtime.includes('"bean/' + form.key + '"'));
    assert.ok(lab.includes(form.label));
  }
});


test('work aliases replay the same combo body without adding combat state or projectile events', () => {
  for (const tribe of UNIT_APPEARANCE_TRIBES) for (const form of UNIT_COMBINATION_FORMS) {
    const unit = make(tribe, form), definition = unitActionArtDefinition(unit);
    const attack = definition.actions.attack || definition.actions.ranged;
    const harvesting = { ...unit, mode: 'harvest', harvestStarted: 0 };
    const throwing = { ...unit, mode: 'unload', foodDelivery: { startedAt: 0, arrivesAt: .6 } };
    const source = JSON.stringify([harvesting, throwing]);
    const harvest = unitActionArtPose(harvesting, .2), repeated = unitActionArtPose(harvesting, 20.2);
    assert.equal(harvest.action, 'harvest'); assert.equal(harvest.animation.image, attack.image);
    assert.equal(harvest.animation.loop, true); assert.equal(repeated.missing, false);
    const food = unitActionArtPose(throwing, .2);
    assert.equal(food.action, 'throw'); assert.equal(food.animation.image, attack.image);
    assert.ok(food.animation.releaseAtMs > 0 && food.animation.releaseAtMs < food.animation.durationMs);
    assert.equal(food.missing, false);
    assert.equal(JSON.stringify([harvesting, throwing]), source);
    assert.equal(harvesting.attack, undefined); assert.equal(throwing.attack, undefined);
    assert.equal(definition.actions.harvest, undefined, 'authored asset inventory remains honest');
  }
});

test('planning lists all sixteen forms, 104 authored clips and 48 matching work previews', async () => {
  const { runInNewContext } = await import('node:vm');
  let html = '';
  runInNewContext(readFileSync(new URL('../DesignAssets/sections/unit-appearance.js', import.meta.url), 'utf8'), { document: { write: value => { html += value; } } });
  let authored = 0, work = 0;
  for (const tribe of UNIT_APPEARANCE_TRIBES) for (const form of UNIT_COMBINATION_FORMS) {
    const row = html.match(new RegExp('<tr id="unit-' + tribe + '-' + form.key + '"[^]*?</tr>'))?.[0];
    assert.ok(row, tribe + '/' + form.key);
    const clips = unitActionArtDefinition(make(tribe, form)).actions;
    for (const action of Object.keys(clips)) {
      const key = action === 'ranged' ? 'ranged-attack' : action;
      const cell = row.match(new RegExp('<td data-action="' + key + '"[^]*?</td>'))?.[0];
      assert.ok(cell?.includes('<img'), tribe + '/' + form.key + '/' + key); authored++;
    }
    for (const action of ['harvest', 'carry', 'throw']) {
      const expected = action === 'carry' ? 'walk' : form.attributes.blade ? 'attack' : 'ranged-attack';
      assert.ok(row.includes('data-work-action="' + action + '" data-work-source="' + expected + '"')); work++;
    }
    if (!form.attributes.secretion) assert.match(row, /<td data-action="ranged-attack"[^>]*><\/td>/);
    if (!form.attributes.blade) assert.match(row, /<td data-action="attack"[^>]*><\/td>/);
  }
  assert.equal(authored, 104); assert.equal(work, 48);
  assert.ok(html.includes('16개 외형의 기본 동작 104개'));
  assert.ok(html.includes('pebble-blade-carapace-walk-grounded-v2-20261107'));
});
