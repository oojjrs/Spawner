import { UNIT_COMBINATION_MASKS } from "./unit-combination-forms.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { UNIT_APPEARANCE_BITS, unitAppearanceMaskFromAttributes } from '../server/unit-appearance.mjs';
import { unitBladeCarapaceAppearance, unitDisplayAttributes, unitDominantAppearanceMask, UNIT_DISPLAY_FORM_COUNT, unitDisplayAbilityMask } from './unit-display-appearance.mjs';
import { unitActionArtDefinition, unitActionArtPose } from './unit-action-art.mjs';
import { BLADE_CARAPACE_ACTION_ART } from './blade-carapace-assets.mjs';
import { beanHeldHurtSource } from './bean-held-hurt.mjs';
import { speciesHeldHurtSource } from './species-held-hurt.mjs';
import { WELCOME_UNIT_APPEARANCES, welcomeUnitPerformance, createWelcomeRoster } from './welcome-presentation.mjs';

const tribes = ['bean', 'spore', 'pebble', 'spring'];
const agentFor = tribe => ({ tribe, attributes: { blade: 1, carapace: 1 }, health: 20, bornAt: 0 });
const definitionFor = tribe => BLADE_CARAPACE_ACTION_ART[tribe + '/blade-carapace'];
const source = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function declaration(text, name, indent) {
  const match = text.match(new RegExp('^' + ' '.repeat(indent) + 'function ' + name + '\\([^]*?^' + ' '.repeat(indent) + '}', 'm'));
  assert.ok(match, name); return match[0];
}

test('blade-carapace matches the exact current organ set across all tribes and historical masks', () => {
  const forms = new Set();
  for (const tribe of tribes) for (let mask = 0; mask < 32; mask++) {
    const attributes = Object.fromEntries(Object.entries(UNIT_APPEARANCE_BITS).filter(([, bit]) => mask & bit).map(([key]) => [key, 3]));
    const agent = { tribe, attributes }, before = JSON.stringify(agent);
    const expected = UNIT_COMBINATION_MASKS.includes(mask & ~8) ? mask & ~8 : [1, 16, 2, 4].find(bit => mask & bit) || 0;
    assert.equal(unitDominantAppearanceMask(mask), expected);
    assert.equal(unitAppearanceMaskFromAttributes(unitDisplayAttributes(agent)), expected);
    assert.equal(unitBladeCarapaceAppearance(agent), (mask & ~8) === 3);
    assert.equal(unitActionArtDefinition(agent) === definitionFor(tribe), (mask & ~8) === 3);
    assert.equal(JSON.stringify(agent), before);
    forms.add(tribe + '/' + expected);
  }
  assert.equal(forms.size, 64); assert.equal(UNIT_DISPLAY_FORM_COUNT, 64);
  assert.equal(unitDisplayAbilityMask(3), 11);
  assert.equal(unitDisplayAbilityMask(1) & 16, 0, 'ranged combinations now own distinct bodies');
});

test('snapshot, DNA, retired organs and legs aliases preserve exact-mask boundaries', () => {
  const base = agentFor('bean');
  assert.ok(unitBladeCarapaceAppearance({ ...base, attributes: { blade: 5, carapace: 7, legs: 0 } }));
  assert.ok(unitBladeCarapaceAppearance({ tribe: 'bean', dna: { pieces: [{ gene: 'blade' }, { gene: 'carapace' }, { gene: 'gather' }] } }));
  assert.ok(unitBladeCarapaceAppearance({ ...base, attributes: { secretion: 1 }, appearanceAttributes: base.attributes }));
  for (const extra of ['antenna', 'secretion']) {
    const agent = { ...base, attributes: { ...base.attributes, [extra]: 1 } };
    assert.equal(unitBladeCarapaceAppearance(agent), false, extra);
    assert.notEqual(unitActionArtDefinition(agent), definitionFor('bean'), extra);
  }
  for (const agent of [{ ...base, appearanceAttributes: {} }, { ...base, appearanceAttributes: { blade: 1 } },
    { ...base, species: 'bubble-toad' }]) {
    assert.equal(unitBladeCarapaceAppearance(agent), false);
  }
  assert.equal(unitActionArtDefinition({ ...base, species: 'bubble-toad' }), null);
});

for (const tribe of tribes) test(`${tribe}: six authored actions, carry fallback, birth ownership and terminal death`, () => {
  const agent = agentFor(tribe), definition = definitionFor(tribe);
  assert.equal(unitActionArtDefinition(agent), definition);
  assert.deepEqual(Object.keys(definition.actions).sort(), ['attack', 'birth', 'death', 'hurt', 'idle', 'walk']);
  const states = {
    idle: {}, walk: { moveStartedAt: 0, moveDuration: 1 },
    attack: { attack: { startedAt: 0, endsAt: 1, hitAt: .3 } },
    hurt: { hurtStartedAt: 0 }, birth: { birth: { startedAt: 0, readyAt: 10 } },
    death: { health: 0, diedAt: 0 }
  };
  for (const [action, state] of Object.entries(states)) {
    const pose = unitActionArtPose({ ...agent, ...state }, .1);
    assert.equal(pose.action, action); assert.equal(pose.animation, definition.actions[action]); assert.equal(pose.missing, false);
    assert.ok(existsSync(new URL('../' + pose.animation.image, import.meta.url)));
    assert.ok(pose.frame >= 0 && pose.frame < pose.animation.frameCount);
  }
  const carry = unitActionArtPose({ ...agent, carrying: 2, moveStartedAt: 0, moveDuration: 1 }, .1);
  assert.equal(carry.action, 'carry'); assert.equal(carry.animation, definition.actions.walk); assert.equal(carry.missing, false);
  const death = unitActionArtPose({ ...agent, health: 0, diedAt: 0 }, 1000), clip = definition.actions.death;
  assert.equal(death.frame, clip.frames?.at(-1) ?? clip.frameCount - 1);
  const ranged = unitActionArtPose({ ...agent, attack: { startedAt: 0, endsAt: 1, mode: 'ranged' } }, .1);
  assert.equal(ranged.action, 'ranged'); assert.equal(ranged.missing, true); assert.equal(ranged.animation, definition.reference);
  assert.equal(beanHeldHurtSource(agent), null); assert.equal(speciesHeldHurtSource(agent), null);
  const ordinary = { ...agent, attributes: { blade: 1 } };
  assert.ok(tribe === 'bean' ? beanHeldHurtSource(ordinary) : speciesHeldHurtSource(ordinary));
});

test('welcome roster includes all four combinations and shows their own idle', () => {
  assert.equal(WELCOME_UNIT_APPEARANCES.length, 17);
  const index = WELCOME_UNIT_APPEARANCES.findIndex(attributes => unitBladeCarapaceAppearance({ attributes }));
  assert.ok(index >= 0);
  const next = createWelcomeRoster(tribes, [], WELCOME_UNIT_APPEARANCES.length, () => .5), selected = new Set();
  for (let i = 0; i < 72; i++) { const choice = next(); if (choice.variant === index) selected.add(choice.key); }
  assert.deepEqual([...selected].sort(), [...tribes].sort());
  for (const tribe of tribes) {
    const performance = welcomeUnitPerformance(agentFor(tribe), 10);
    assert.equal(performance.action, 'idle'); assert.equal(performance.animation, definitionFor(tribe).actions.idle);
    assert.equal(unitActionArtPose(performance.agent, 10.1).animation, performance.animation);
  }
});

test('world full-scene birth cancels external travel exactly once at either scale', () => {
  const drawSource = declaration(source('./unit-presentation.mjs'), 'drawAgentAppearanceBody', 2);
  for (const tribe of tribes) for (const scale of [1, 2]) for (const position of [{ x: 2, y: 3 }, { x: 5, y: 6 }]) {
    const agent = { ...agentFor(tribe), birth: { startedAt: 0, readyAt: 10 } }, animation = unitActionArtPose(agent, .1).animation;
    assert.equal(animation.worldTravelIncludedInPixels, true);
    let drawn;
    const draw = new Function('unitActionArtPose', 'state', 'options', 'drawAgentAnimation',
      `const AGENT_HEIGHT=.7; ${drawSource}; return drawAgentAppearanceBody;`)(unitActionArtPose, { simSeconds: .1 },
      { displayScale: () => scale }, (...args) => { drawn = args; return true; });
    const cell = 100, topLeft = { x: 20, y: 30 }, birth = { targetX: 5, targetY: 6, x: 2, y: 3, outlet: { x: -20, y: -20 } };
    assert.equal(draw({}, 0, agent, cell, topLeft, position, birth, null), true);
    assert.equal(drawn[2], topLeft.x + cell / 2 + (birth.targetX - position.x) * cell / scale);
    assert.equal(drawn[3], topLeft.y + cell * (.5 + .7 * .44) + (birth.targetY - position.y) * cell / scale);
  }
});

test('DOM portraits select the combo-owned image without entering legacy composition', () => {
  const body = declaration(source('./game.js'), 'agentImageSource', 4);
  const imageSource = new Function('Spawner', 'assetSource', 'agentSprite', 'agentImageSources', `${body}; return agentImageSource;`)(
    { unitActionArtDefinition, unitRangedAppearance() { throw new Error('unexpected ranged portrait'); } },
    path => 'resolved:' + path, () => { throw new Error('unexpected legacy composition'); }, new Map());
  for (const tribe of tribes) {
    const definition = definitionFor(tribe);
    assert.ok(existsSync(new URL('../' + definition.portrait, import.meta.url)));
    assert.equal(imageSource(agentFor(tribe)), 'resolved:' + definition.portrait);
  }
});
