import test from 'node:test';
import { tribeDnaStats } from '../server/tribe-dna-stats.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ANTENNA_COMBINATION_FORMS, UNIT_COMBINATION_FORMS } from './unit-combination-forms.mjs';
import { ANTENNA_COMBO_ACTION_ART, ANTENNA_COMBO_IMAGE_ASSETS } from './antenna-combo-assets.mjs';
import { UNIT_ACTION_ART } from './unit-action-art-assets.mjs';
import { DEFENSIVE_ATTACK_ART } from './defensive-attack-assets.mjs';
import { unitActionArtDefinition, unitActionArtPose, unitActionArtSelection, createUnitActionArt } from './unit-action-art.mjs';
import { unitCombinationAppearance, unitDisplayAttributes, unitDominantAppearanceMask, UNIT_DISPLAY_FORM_COUNT } from './unit-display-appearance.mjs';
import { UNIT_APPEARANCE_BITS, unitAppearanceForm, unitAppearanceMaskFromAttributes } from '../server/unit-appearance.mjs';
import { combatLabCombinationDna, combatLabWithAppearance, COMBAT_LAB_APPEARANCES } from './combat-lab-appearances.mjs';
import { validateDna, dnaAppearance } from '../server/dna-unit.mjs';
import { deriveSimulationStats, createSimulationTrial } from './combat-simulation.mjs';
import { beanHeldHurtSource } from './bean-held-hurt.mjs';
import { speciesHeldHurtSource } from './species-held-hurt.mjs';
import { WELCOME_UNIT_APPEARANCES, welcomeUnitPerformance } from './welcome-presentation.mjs';
import { unitDisplaySize, unitFrameMirror } from './unit-size.mjs';
import { auditImages } from './image-audit.mjs';
import { fileURLToPath } from 'node:url';
const tribes = ['bean', 'spore', 'pebble', 'spring'];
const forms = ANTENNA_COMBINATION_FORMS;
const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(new URL('../' + path, import.meta.url));
const sha = path => createHash('sha256').update(read(path)).digest('hex');
const make = (tribe, form) => ({ tribe, attributes: form.attributes, health: 20, bornAt: 0 });

test('antenna catalogue covers seven exact organ sets and preserves all historical mask inputs', () => {
  assert.deepEqual(forms.map(form => form.mask), [5, 20, 6, 21, 7, 22, 23]);
  assert.equal(UNIT_COMBINATION_FORMS.length, 11);
  assert.equal(UNIT_DISPLAY_FORM_COUNT, 64);
  const selected = new Set();
  for (const tribe of tribes) for (let mask = 0; mask < 32; mask++) {
    const attributes = Object.fromEntries(Object.entries(UNIT_APPEARANCE_BITS).filter(([, bit]) => mask & bit).map(([key]) => [key, 3]));
    const agent = { tribe, attributes }, before = JSON.stringify(agent), orgMask = mask & ~8;
    const form = UNIT_COMBINATION_FORMS.find(form => form.mask === orgMask);
    const expectedMask = form?.mask ?? [1, 16, 2, 4].find(bit => mask & bit) ?? 0;
    assert.equal(unitDominantAppearanceMask(mask), expectedMask);
    assert.equal(unitAppearanceMaskFromAttributes(unitDisplayAttributes(agent)), expectedMask);
    assert.equal(unitCombinationAppearance(agent), form?.key || null);
    const key = tribe + '/' + unitAppearanceForm(agent), definition = { key };
    assert.equal(unitActionArtSelection(agent, { [key]: definition }).definition, definition);
    assert.equal(JSON.stringify(agent), before); selected.add(tribe + '/' + expectedMask);
  }
  assert.equal(selected.size, 64);
  for (const form of forms) {
    const agent = make('bean', form);
    assert.equal(unitCombinationAppearance({ ...agent, appearanceAttributes: {} }), null);
    assert.equal(unitCombinationAppearance({ ...agent, attributes: { ...agent.attributes, feet: 1, strength: 1 } }), form.key);
    assert.equal(unitCombinationAppearance({ ...agent, species: 'soil-boar' }), null);
  }
});

test('DNA v6 antenna combinations preserve actual ability rules and independent board pieces', () => {
  assert.equal(COMBAT_LAB_APPEARANCES.length, 14);
  for (const form of forms) {
    const dna = combatLabCombinationDna(form.key), other = combatLabCombinationDna(form.key);
    assert.equal(dna.version, 6); assert.ok(validateDna(dna, dna.level, dna.budget));
    assert.deepEqual(dnaAppearance(dna), form.attributes); assert.notEqual(dna.pieces, other.pieces); assert.notEqual(dna.pieces[0], other.pieces[0]);
    for (const tribe of tribes) {
      const build = combatLabWithAppearance({ key: tribe }, form.key), stats = deriveSimulationStats(build);
      assert.equal(!!stats.dna.melee, !!form.attributes.blade);
      assert.equal(!!stats.dna.ranged, !!form.attributes.secretion);
      assert.equal(stats.dna.armor > tribeDnaStats(tribe).base.armor, !!form.attributes.carapace);
      assert.equal(stats.dna.roaming, undefined);
      assert.equal(stats.dna.hunting, true);
      assert.equal(!!stats.canAttack, true);
      assert.equal(!!stats.canInitiate, !!(form.attributes.blade || form.attributes.secretion));
    }
  }
});

test('all 28 antenna forms are complete with 172 byte-exact clips and 28 portraits', () => {
  assert.equal(Object.keys(ANTENNA_COMBO_ACTION_ART).length, 28);
  const originalImages = new Set(Object.values(ANTENNA_COMBO_ACTION_ART).flatMap(definition => [definition.portrait, ...Object.values(definition.actions).map(clip => clip.image)]));
  assert.equal(originalImages.size, 200);
  assert.equal(ANTENNA_COMBO_IMAGE_ASSETS.length, 224);
  let clips = 0;
  for (const tribe of tribes) for (const form of forms) {
    const key = tribe + '/' + form.key, definition = ANTENNA_COMBO_ACTION_ART[key];
    const source = JSON.parse(read(definition.sourceManifest));
    assert.deepEqual(UNIT_ACTION_ART[key], DEFENSIVE_ATTACK_ART[key] ? { ...definition, actions: { ...definition.actions, attack: DEFENSIVE_ATTACK_ART[key] } } : definition); assert.equal(definition.mask, form.mask);
    const expected = ['idle', 'walk', ...(form.attributes.blade ? ['attack'] : []), ...(form.attributes.secretion ? ['ranged'] : []), 'hurt', 'birth', 'death'];
    assert.deepEqual(Object.keys(definition.actions), expected);
    assert.deepEqual(definition.reference, definition.actions.idle);
    for (const [action, clip] of Object.entries(definition.actions)) {
      const record = source.actions[action] || source.actions['ranged-attack'];
      assert.equal(sha(clip.image), record.sheetSHA256, key + '/' + action);
      const reviewHold = tribe === 'bean' && action === 'birth';
      if (reviewHold) { assert.equal(record.durationsMs.at(-1), 650); assert.equal(record.durationMs, 4500); }
      assert.deepEqual(clip.durationsMs, reviewHold ? record.durationsMs.slice(0, -1) : record.durationsMs);
      assert.equal(clip.durationMs, reviewHold ? 3850 : record.durationMs);
      assert.equal(clip.loop, ['idle', 'walk'].includes(action)); clips++;
    }
  }
  assert.equal(clips, 172); assert.equal(auditImages(root, ANTENNA_COMBO_IMAGE_ASSETS), 224);
});

test('offline file builds include all original and layered antenna image wrappers', () => {
  const scope = {};
  runInNewContext(read('client/local-assets.js').toString(), scope);
  const files = new Set(scope.SpawnerLocalAssetFiles);
  for (const path of ANTENNA_COMBO_IMAGE_ASSETS) {
    const wrapper = 'client/local-assets/' + path.slice('DesignAssets/'.length) + '.js';
    assert.ok(files.has('./' + wrapper), wrapper + ' is discoverable offline');
    const source = read(wrapper).toString();
    assert.ok(source.startsWith('globalThis.SpawnerLocalAssetSources[' + JSON.stringify(path) + '] = '));
    const payload = source.match(/"data:image\/png;base64,([A-Za-z0-9+/=]+)";/);
    assert.ok(payload, wrapper);
    assert.equal(createHash('sha256').update(Buffer.from(payload[1], 'base64')).digest('hex'), sha(path), wrapper);
  }
});

for (const tribe of tribes) for (const form of forms) test(`${tribe}/${form.key}: same body, allowed attacks, birth and work clocks`, () => {
  const agent = make(tribe, form), definition = UNIT_ACTION_ART[tribe + '/' + form.key];
  assert.ok(definition); assert.equal(unitActionArtDefinition(agent), definition);
  assert.equal(beanHeldHurtSource(agent), null); assert.equal(speciesHeldHurtSource(agent), null);
  const clips = definition.actions, samples = {
    idle: {}, walk: { moveStartedAt: 0, moveDuration: 2 }, hurt: { hurtStartedAt: 0 },
    attack: { attack: { startedAt: 0, hitAt: .3, endsAt: 1, mode: 'melee' } },
    ranged: { attack: { startedAt: 0, launchedAt: .2, hitAt: .6, endsAt: 1, mode: 'ranged' } },
    birth: { birth: { startedAt: 0, readyAt: 5 } }, death: { health: 0, diedAt: 0 },
  };
  for (const [action, patch] of Object.entries(samples)) {
    const pose = unitActionArtPose({ ...agent, ...patch }, .05);
    assert.equal(pose.action, action); assert.equal(pose.missing, !clips[action]);
    assert.equal(pose.animation, clips[action] || definition.reference);
  }
  assert.equal(clips.birth.fullScene, true); assert.equal(clips.birth.worldTravelIncludedInPixels, true);
  assert.equal(clips.birth.sceneAnchor, 'final-body-floor');
  const corpse = unitActionArtPose({ ...agent, ...samples.death }, 1000);
  assert.equal(corpse.frame, clips.death.frameCount - 1);
  const work = clips.attack || clips.ranged || clips.walk;
  for (const [mode, patch] of [['harvest', { harvestStarted: 0 }], ['unload', { foodDelivery: { startedAt: 0, arrivesAt: .7 } }]]) {
    const worker = { ...agent, mode, ...patch }, before = JSON.stringify(worker), pose = unitActionArtPose(worker, .2);
    assert.equal(pose.animation.image, work.image); assert.equal(pose.missing, false); assert.equal(JSON.stringify(worker), before);
  }
  assert.equal(unitActionArtPose({ ...agent, ...samples.walk, carrying: 2 }, .2).animation, clips.walk);
  const welcome = welcomeUnitPerformance(agent, 10);
  assert.equal(welcome.action, 'idle');
  assert.equal(unitActionArtPose(welcome.agent, 10.05).animation, welcome.animation);
});

test('every antenna state draws exactly one full-body cell with measured floor and facing', async () => {
  function surface(width, height) {
    const context = { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4).fill(255) }) };
    return { getContext: () => context };
  }
  const art = createUnitActionArt(path => path, surface, async image => ({ image }));
  for (const key of Object.keys(ANTENNA_COMBO_ACTION_ART)) {
    const definition = UNIT_ACTION_ART[key];
    const [tribe, name] = key.split('/'), form = forms.find(form => form.key === name), agent = make(tribe, form);
    const samples = { idle: {}, walk: { moveStartedAt: 0, moveDuration: 2 }, attack: { attack: { startedAt: 0, hitAt: .3, endsAt: 1, mode: 'melee' } },
      ranged: { attack: { startedAt: 0, launchedAt: .2, endsAt: 1, mode: 'ranged' } }, hurt: { hurtStartedAt: 0 },
      birth: { birth: { startedAt: 0, readyAt: 5 } }, death: { health: 0, diedAt: 0 },
      harvest: { mode: 'harvest', harvestStarted: 0 }, carry: { moveStartedAt: 0, moveDuration: 2, carrying: 2 },
      throw: { mode: 'unload', foodDelivery: { startedAt: 0, arrivesAt: .7 } } };
    for (const [action, state] of Object.entries(samples)) {
      if (['attack', 'ranged'].includes(action) && !definition.actions[action]) continue;
      const actor = { ...agent, ...state }, pose = unitActionArtPose(actor, .05), clip = pose.animation;
      await art.prepare(actor, .05);
      for (const mirror of [false, true]) {
        const calls = [], transforms = [], context = { save() {}, restore() {}, translate: (...args) => transforms.push(['translate', ...args]),
          scale: (...args) => transforms.push(['scale', ...args]), drawImage: (...args) => calls.push(args) };
        assert.equal(art.draw(context, actor, .05, 240, 420, 100, mirror), true, key + '/' + action);
        const visibleLayers = clip.sceneLayers?.layers.filter(layer => layer.samples[pose.frame]);
        if (visibleLayers) {
          assert.equal(calls.length, visibleLayers.length, 'one environment and at most one whole body');
          assert.ok(visibleLayers.filter(layer => layer.role === 'body').length <= 1);
          const scale = 100 * unitDisplaySize(actor) / clip.referenceLength;
          visibleLayers.forEach((layer, index) => {
            const { frame, destination: [x, y, width, height] } = layer.samples[pose.frame];
            assert.equal(calls[index][0].image, layer.image);
            assert.deepEqual(calls[index].slice(1), [frame % layer.columns * layer.frameSize, Math.floor(frame / layer.columns) * layer.frameHeight, layer.frameSize, layer.frameHeight, (x - clip.pivotX) * scale, (y - clip.pivotY) * scale, width * scale, height * scale]);
          });
          assert.deepEqual(transforms, [['translate', 240, 420], ['scale', unitFrameMirror(clip.sourceFacing, mirror ? -1 : 1) ? -1 : 1, 1]]);
          continue;
        }
        assert.equal(calls.length, 1, 'no runtime organ overlays');
        const draw = calls[0], height = clip.frameHeight || clip.frameSize, scale = 100 * unitDisplaySize(actor) / clip.referenceLength;
        assert.equal(draw[0].image, clip.image);
        assert.deepEqual(draw.slice(1, 5), [pose.frame % clip.columns * clip.frameSize, Math.floor(pose.frame / clip.columns) * height, clip.frameSize, height]);
        assert.deepEqual(draw.slice(5), [-clip.pivotX * scale, -clip.pivotY * scale, clip.frameSize * scale, height * scale]);
        assert.deepEqual(transforms, [['translate', 240, 420], ['scale', unitFrameMirror(clip.sourceFacing, mirror ? -1 : 1) ? -1 : 1, 1]]);
      }
    }
  }
});

test('compiled game and combat lab include the exact antenna catalogue and native clips', () => {
  const scope = { console, setTimeout, clearTimeout, URL, performance };
  runInNewContext(read('client/runtime.js').toString(), scope);
  const lab = read('Combat.html').toString();
  for (const form of forms) assert.ok(lab.includes(form.label), form.label);
  const start = lab.indexOf('const modules = Object.create(null);'), end = lab.lastIndexOf('modules[\"client/combat-lab.js\"] = (() => {');
  assert.ok(start >= 0 && end > start, 'embedded lab bundle');
  const labScope = { console, setTimeout, clearTimeout, URL, performance };
  runInNewContext(lab.slice(start, end) + '\nglobalThis.labArt = modules[\"client/unit-action-art.mjs\"];', labScope);
  for (const key of Object.keys(ANTENNA_COMBO_ACTION_ART)) {
    const definition = UNIT_ACTION_ART[key];
    const [tribe, name] = key.split('/'), form = forms.find(form => form.key === name), agent = make(tribe, form);
    for (const renderer of [scope.Spawner, labScope.labArt]) {
      const actual = renderer.unitActionArtDefinition(agent);
      assert.equal(actual.reference.image, definition.reference.image, key);
      assert.deepEqual(JSON.parse(JSON.stringify(actual.actions)), definition.actions);
    }
    for (const patch of [{}, { mode: 'harvest', harvestStarted: 0 }, { mode: 'unload', foodDelivery: { startedAt: 0, arrivesAt: .7 } }, { birth: { startedAt: 0, readyAt: 5 } }]) {
      const native = unitActionArtPose({ ...agent, ...patch }, .05), compiled = scope.Spawner.unitActionArtPose({ ...agent, ...patch }, .05);
      const labPose = labScope.labArt.unitActionArtPose({ ...agent, ...patch }, .05);
      for (const result of [compiled, labPose]) {
        assert.equal(result.animation.image, native.animation.image); assert.equal(result.frame, native.frame); assert.equal(result.missing, false);
      }
    }
  }
});

test('antenna world births anchor their final body once at both facing directions and display scales', () => {
  const source = read('client/unit-presentation.mjs').toString().replace(/\r\n/g, '\n');
  const drawSource = source.match(/^  function drawAgentAppearanceBody\([^]*?^  }/m)?.[0];
  assert.ok(drawSource);
  for (const key of Object.keys(ANTENNA_COMBO_ACTION_ART)) {
    const [tribe, name] = key.split('/'), form = forms.find(form => form.key === name);
    for (const scale of [.75, 1, 2]) for (const facing of [-1, 1]) for (const position of [{ x: 2, y: 3 }, { x: 5, y: 6 }, null]) {
      const agent = { ...make(tribe, form), facing, birth: { startedAt: 0, readyAt: 10 } }, before = JSON.stringify(agent);
      let drawn;
      const draw = new Function('unitActionArtPose', 'state', 'options', 'drawAgentAnimation',
        `const AGENT_HEIGHT=.7; ${drawSource}; return drawAgentAppearanceBody;`)(unitActionArtPose, { simSeconds: .1 },
        { displayScale: () => scale }, (...args) => { drawn = args; return true; });
      const cell = 100, topLeft = { x: 20, y: 30 }, birth = { targetX: 5, targetY: 6, x: 2, y: 3, outlet: { x: -20, y: -20 } };
      assert.equal(draw({}, 0, agent, cell, topLeft, position, birth, null), true);
      assert.equal(drawn[2], topLeft.x + cell / 2 + (birth.targetX - (position?.x ?? birth.x)) * cell / scale);
      assert.equal(drawn[3], topLeft.y + cell * (.5 + .7 * .44) + (birth.targetY - (position?.y ?? birth.y)) * cell / scale);
      assert.equal(drawn[4], cell * .7); assert.equal(JSON.stringify(agent), before);
    }
  }
});

test('antenna pose observation leaves combat events and outcomes unchanged', () => {
  for (const form of forms) {
    const build = combatLabWithAppearance({ key: 'bean' }, form.key), settings = { left: build, right: build, distance: form.attributes.secretion ? 2 : 1, random: false };
    const trial = createSimulationTrial(settings), control = createSimulationTrial(settings);
    for (let i = 0; i < 30; i++) {
      trial.advance(.1); control.advance(.1);
      for (const actor of trial.agents) { unitActionArtPose(actor, trial.time); unitDisplayAttributes(actor); }
    }
    assert.deepEqual(trial.agents, control.agents); assert.deepEqual(trial.history, control.history); assert.deepEqual(trial.result(), control.result());
    const clean = model => JSON.stringify(model.vfx).replaceAll(model.vfx.streamId, 'stream');
    assert.equal(clean(trial), clean(control));
  }
});

test('antenna planning has 28 complete rows and 84 matching work previews', () => {
  let html = '';
  runInNewContext(read('DesignAssets/sections/unit-appearance.js').toString(), { document: { write: value => { html += value; } } });
  let count = 0;
  for (const tribe of tribes) for (const form of forms) {
    const row = html.match(new RegExp('<tr id="unit-' + tribe + '-' + form.key + '"[^]*?</tr>'))?.[0]; assert.ok(row);
    for (const action of ['harvest', 'carry', 'throw']) {
      const clips = UNIT_ACTION_ART[tribe + '/' + form.key].actions;
      const from = action === 'carry' ? 'walk' : clips.attack ? 'attack' : clips.ranged ? 'ranged-attack' : 'walk';
      assert.ok(row.includes('data-work-action="' + action + '" data-work-source="' + from + '"')); count++;
    }
  }
  assert.equal(count, 84); assert.ok(html.includes('44개 복합 외형·280개 기본 동작'));
  assert.equal(WELCOME_UNIT_APPEARANCES.length, 17);
});

test('existing combinations and antenna singles preserve original actions except audited attack and carry fixes', async () => {
  const { UNIT_BIRTH_ART } = await import('./unit-birth-art-assets.mjs');
  const baseline = JSON.parse(read('tools/antenna-combo-integration-20261107/existing-art-baseline.json'));
  assert.equal(Object.keys(baseline.definitions).length, 20);
  const native28 = JSON.parse(read('tools/spring-native-facing-20261108/bean-spore-image-changes.json')).changes;
  const selected28 = new Set(JSON.parse(read('tools/spring-native-facing-20261108/bean-spore-technical-plan.json')).candidateForms);
  const newAttacks = new Set(JSON.parse(read('tools/spring-native-facing-20261108/followup13-integration-map.json')).items.map(row=>row.source));
  const expectedLeft = (key, original) => {
    const clip=structuredClone(original), change=native28[clip.image];
    if(selected28.has(key)&&change){
      clip.image=change.afterPath||change.newImage;clip.sourceFacing='left';clip.pivotX=clip.frameSize-clip.pivotX;
      if(clip.scene?.outletX!==undefined)clip.scene.outletX=clip.frameSize-clip.scene.outletX;
      for(const layer of clip.sceneLayers?.layers||[]){const layerChange=native28[layer.image];if(layerChange)layer.image=layerChange.afterPath||layerChange.newImage;for(const sample of layer.samples)if(sample)sample.destination[0]=clip.frameSize-sample.destination[0]-sample.destination[2];}
    }
    if(newAttacks.has(clip.image))clip.sourceFacing='left';
    return clip;
  };

  for (const [key, definition] of Object.entries(baseline.definitions)) {
    const expected = DEFENSIVE_ATTACK_ART[key] ? { ...definition, actions: { ...definition.actions, attack: DEFENSIVE_ATTACK_ART[key] } } : definition;
    if (key === 'bean/antenna') expected.actions.carry = definition.actions.walk;
    if (key.startsWith('bean/') && expected.actions.birth?.durationMs === 4500) {
      expected.actions.birth = { ...expected.actions.birth, frameCount: 116, durationMs: 3850,
        durationsMs: expected.actions.birth.durationsMs.slice(0, -1) };
    }
    if (key.startsWith('pebble/') && ['blade-carapace', 'blade-secretion', 'secretion-carapace', 'blade-secretion-carapace'].includes(key.split('/')[1])) {
      const approved = JSON.parse(read('AnimationCandidates/pebble-combo-birth-roll-v2-20261107/' + key.split('/')[1] + '/publication-manifest.json')).actions.birth;
      expected.actions.birth = { ...expected.actions.birth, frameCount: approved.frameCount, durationsMs: approved.durationsMs };
    }
    if (key === 'pebble/blade-carapace') {
      for (const clip of new Set([expected.reference, ...Object.values(expected.actions)])) {
        clip.sourceFacing = 'left'; clip.pivotX = clip.frameSize - clip.pivotX;
      }
    }
    const labelAudit = [...JSON.parse(read('tools/spring-native-facing-20261108/original-clips.json')), ...JSON.parse(read('tools/spring-native-facing-20261108/additional-original-clips.json'))];
    const correctedImages = new Set(labelAudit.map(row => row.before.image));
    for (const clip of new Set([expected.reference, ...Object.values(expected.actions)]))
      if (correctedImages.has(clip.image)) clip.sourceFacing = 'left';
    const furtherNormalized = JSON.parse(read('tools/secretion-source-normalization-20261108/pixel-changes.json')).changes;
    for (const clip of new Set([expected.reference, ...Object.values(expected.actions)]))
      if (furtherNormalized[clip.image]) { clip.sourceFacing='left'; clip.pivotX=clip.frameSize-clip.pivotX; }
    expected.reference=expectedLeft(key,expected.reference);
    expected.actions=Object.fromEntries(Object.entries(expected.actions).map(([action,clip])=>[action,expectedLeft(key,clip)]));
    if(DEFENSIVE_ATTACK_ART[key])expected.actions.attack=DEFENSIVE_ATTACK_ART[key];
    assert.deepEqual(UNIT_ACTION_ART[key], expected, key);
  }
  const restoredBirth = JSON.parse(read('tools/birth-resolution-20261108/registered-clips.json'));
  for (const [key, clip] of Object.entries(baseline.birth)) {
    if (restoredBirth[key]) {
      const {sceneLayers,...nativeGeometry} = UNIT_BIRTH_ART[key];
      assert.deepEqual(nativeGeometry,expectedLeft(key,clip),key+' preserves native registration under source reflection');
      assert.deepEqual(sceneLayers,expectedLeft(key,restoredBirth[key]).sceneLayers,key+' verified source layers');
    } else assert.deepEqual(UNIT_BIRTH_ART[key],expectedLeft(key,clip),key);
  }
  const approvedHashes = new Map();
  for (const form of ['blade-carapace', 'blade-secretion', 'secretion-carapace', 'blade-secretion-carapace']) {
    const approved = JSON.parse(read('AnimationCandidates/pebble-combo-birth-roll-v2-20261107/' + form + '/publication-manifest.json'));
    approvedHashes.set(UNIT_ACTION_ART['pebble/' + form].actions.birth.image, approved.actions.birth.sheetSHA256);
  }
  for (const entry of JSON.parse(read('AnimationCandidates/bean-combo-walk-approved-v2-20261107/approval.json')).approvedForms)
    approvedHashes.set(UNIT_ACTION_ART['bean/' + entry.form].actions.walk.image, entry.sha256);
  const normalized = {...JSON.parse(read('tools/source-facing-normalization-20261108/pixel-changes.json')).changes, ...JSON.parse(read('tools/secretion-source-normalization-20261108/pixel-changes.json')).changes, ...JSON.parse(read('tools/spring-native-facing-20261108/attack-metadata-changes.json')).changes, ...native28, ...Object.fromEntries(JSON.parse(read('tools/spring-native-facing-20261108/followup13-integration-map.json')).items.map(row=>[row.source,{afterSha256:row.candidateSHA256}]))};
  for (const [image, hash] of Object.entries(baseline.sourceImages))
    assert.equal(sha(image), normalized[image]?.afterSha256 || approvedHashes.get(image) || hash, image);
});
