import test from 'node:test';
import { approvedArtSource, approvedArtClip, approvedAttackSource } from './test-support/approved-art-source.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { DEFENSIVE_ATTACK_ART, DEFENSIVE_ATTACK_IMAGE_ASSETS } from './defensive-attack-assets.mjs';
import { UNIT_ACTION_ART } from './unit-action-art-assets.mjs';
import { unitActionArtDefinition, unitActionArtPose, createUnitActionArt } from './unit-action-art.mjs';
import { unitDisplaySize, unitFrameMirror } from './unit-size.mjs';
import { combatLabWithAppearance, combatLabAppearance, COMBAT_LAB_APPEARANCES } from './combat-lab-appearances.mjs';
import { welcomeUnitPerformance } from './welcome-presentation.mjs';
import { createSimulationTrial, deriveSimulationStats } from './combat-simulation.mjs';
import { validateDna } from '../server/dna-unit.mjs';
const tribes = ['bean', 'spore', 'pebble', 'spring'];
const forms = ['carapace', 'antenna', 'carapace-antenna'];
const read = path => readFileSync(new URL('../' + path, import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const attributes = form => Object.fromEntries(form.split('-').map(key => [key, 1]));
const actor = (tribe, form) => ({ tribe, attributes: attributes(form), health: 10, bornAt: 0 });

test('all twelve defensive attacks are registered as transparent native own-body clips', () => {
  assert.equal(Object.keys(DEFENSIVE_ATTACK_ART).length, 12);
  assert.equal(DEFENSIVE_ATTACK_IMAGE_ASSETS.length, 12);
  for (const tribe of tribes) for (const form of forms) {
    const key = tribe + '/' + form, clip = DEFENSIVE_ATTACK_ART[key], agent = actor(tribe, form);
    assert.ok(clip, key); assert.equal(clip.defensiveRetaliation, true); assert.equal(clip.loop, false);
    const source = JSON.parse(read(clip.sourceManifest)), original = source.actions.attack;
    assert.deepEqual(Object.keys(source.actions), ['attack']);
    const approved = approvedAttackSource(clip.image, original.sheetSHA256);
    assert.equal(hash(read(clip.image)), approved.sha256);
    assert.equal(clip.durationMs, original.durationMs); assert.deepEqual(clip.durationsMs, original.durationsMs);
    assert.equal(clip.hitTimeMs, original.hitTimeMs); assert.equal(clip.sourceFacing, approved.repaired ? 'left' : approved.mirrored ? (original.sourceFacing === 'left' ? 'right' : 'left') : original.sourceFacing);
    assert.ok(clip.durationsMs.some((_, index) => clip.durationsMs.slice(0, index).reduce((a, b) => a + b, 0) === clip.hitTimeMs));
    assert.equal(unitActionArtDefinition(agent).actions.attack, clip);
    assert.equal(unitActionArtDefinition(agent).actions.ranged, undefined);
    const welcome = welcomeUnitPerformance(agent, 10);
    assert.equal(welcome.action, 'idle'); assert.equal(welcome.animation, unitActionArtDefinition(agent).actions.idle);
  }
});

test('defensive bodies preserve other slots except explicitly audited birth and carry slots', () => {
  const baseline = JSON.parse(read('tools/defensive-attacks-integration-20261107/existing-art-baseline.json'));
  const replacements = JSON.parse(read('AnimationCandidates/bean-combo-walk-approved-v2-20261107/approval.json')).approvedForms;
  const sourceHash = path => replacements.find(entry => UNIT_ACTION_ART['bean/' + entry.form].actions.walk.image === path)?.sha256 || baseline.sourceImages[path];
  for (const [key, before] of Object.entries(baseline.definitions)) {
    const after = UNIT_ACTION_ART[key];
    assert.deepEqual(after.reference, approvedArtClip(before.reference, baseline.sourceImages[before.reference.image]), key);
    for (const [name, clip] of Object.entries(before.actions)) if (name !== 'attack') {
      if (key === 'bean/antenna' && name === 'carry') {
        assert.deepEqual(after.actions.carry, after.actions.walk); continue;
      }
      if (key === 'pebble/carapace-antenna' && name === 'birth') {
        const corrected = JSON.parse(read('AnimationCandidates/pebble-carapace-antenna-birth-proportion-v2-20261107/publication-manifest.json')).actions.birth;
        assert.equal(hash(read(after.actions.birth.image)), corrected.sheetSHA256);
        assert.deepEqual(after.actions.birth.durationsMs, clip.durationsMs);
        assert.equal(after.actions.birth.referenceLength, 155); assert.equal(after.actions.birth.pivotX, after.actions.birth.frameSize - 392.5); assert.equal(after.actions.birth.pivotY, 439);
        continue;
      }
      const { sceneLayers, ...preserved } = after.actions[name];
      let expected = key === 'bean/carapace-antenna' && name === 'birth' ?
        { ...clip, frameCount: 116, durationMs: 3850, durationsMs: clip.durationsMs.slice(0, -1) } : clip;
      expected = approvedArtClip(expected, sourceHash(clip.image));
      if (key.startsWith('spring/') && name === 'birth') expected.sourceFacing = 'left';
      assert.deepEqual(preserved, expected, key + '/' + name);
      if (sceneLayers) { assert.equal(name, 'birth'); assert.ok(['bean/carapace-antenna', 'spore/carapace-antenna'].includes(key)); }
    }
    assert.deepEqual(Object.keys(after.actions).sort(), [...new Set([...Object.keys(before.actions), 'attack'])].sort());
  }
  for (const [path, sha] of Object.entries(baseline.sourceImages)) {
    if (path === UNIT_ACTION_ART['pebble/carapace-antenna'].actions.birth.image) continue; // Audited v2 hash is checked above.
    const repaired = JSON.parse(read('AnimationCandidates/bean-combo-walk-approved-v2-20261107/approval.json')).approvedForms
      .find(entry => UNIT_ACTION_ART['bean/' + entry.form].actions.walk.image === path);
    assert.equal(hash(read(path)), approvedArtSource(path,repaired?.sha256 || sha).sha256, path);
  }
});

for (const tribe of tribes) for (const form of forms) test(`${tribe}/${form}: actual defensive attack drives its own hit frame without gameplay writes`, () => {
  const left = combatLabWithAppearance({ key: tribe }, form), right = combatLabWithAppearance({ key: 'bean' }, 'blade-carapace');
  assert.equal(combatLabAppearance(left), form); assert.ok(validateDna(left.dna, left.dna.level, left.dna.budget));
  const stats = deriveSimulationStats(left); assert.equal(stats.canAttack, true); assert.equal(stats.canInitiate, form.includes('carapace'));
  assert.equal(stats.dna.power, 1); assert.equal(stats.dna.melee, false); assert.equal(stats.dna.ranged, false);
  const trial = createSimulationTrial({ left, right, distance: 1, random: false });
  for (let i = 0; i < 1000 && !trial.agents[0].attack && !trial.result().reason; i++) trial.advance(.05);
  const agent = trial.agents[0]; assert.ok(agent.attack, 'real defensive attack begins after engagement');
  if (!stats.canInitiate) assert.ok(trial.history.some(event => event.targetId === agent.id && event.kind === 'attack'), 'incoming attack is announced before the defensive response');
  const before = JSON.stringify(agent), pose = unitActionArtPose(agent, agent.attack.hitAt), clip = DEFENSIVE_ATTACK_ART[tribe + '/' + form];
  assert.equal(pose.action, 'attack'); assert.equal(pose.animation, clip); assert.equal(pose.missing, false);
  assert.equal(clip.durationsMs.slice(0, pose.frame).reduce((a, b) => a + b, 0), clip.hitTimeMs);
  assert.equal(JSON.stringify(agent), before);
});

test('defensive attacks draw one native cell with the authored facing at every sampled time', async () => {
  const surface = (width, height) => ({ getContext: () => ({ drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4).fill(255) }) }) });
  const art = createUnitActionArt(path => path, surface, async image => ({ image }));
  for (const tribe of tribes) for (const form of forms) {
    const clip = DEFENSIVE_ATTACK_ART[tribe + '/' + form];
    const agent = { ...actor(tribe, form), combat: { version: 2 }, attack: { startedAt: 0, hitAt: clip.hitTimeMs / 1000, endsAt: clip.durationMs / 1000, mode: 'melee' } };
    await art.prepare(agent, .001);
    for (const time of [0, clip.hitTimeMs / 1000, clip.durationMs / 1000 - .00001]) for (const mirror of [false, true]) {
      const calls = [], transforms = [], ctx = { save() {}, restore() {}, translate: (...a) => transforms.push(['translate', ...a]), scale: (...a) => transforms.push(['scale', ...a]), drawImage: (...a) => calls.push(a) };
      assert.equal(art.draw(ctx, agent, time, 200, 300, 100, mirror), true);
      assert.equal(calls.length, 1); assert.equal(calls[0][0].image, clip.image);
      assert.deepEqual(transforms, [['translate', 200, 300], ['scale', unitFrameMirror(clip.sourceFacing, mirror ? -1 : 1) ? -1 : 1, 1]]);
      const scale = 100 * unitDisplaySize(agent) / clip.referenceLength;
      assert.deepEqual(calls[0].slice(5), [-clip.pivotX * scale, -clip.pivotY * scale, clip.frameSize * scale, clip.frameHeight * scale]);
    }
  }
});

test('compiled game, combat laboratory and offline files contain every defensive attack', () => {
  const scope = { console, setTimeout, clearTimeout, URL, performance };
  runInNewContext(read('client/runtime.js').toString(), scope);
  const html = read('Combat.html').toString(), start = html.indexOf('const modules = Object.create(null);'), end = html.lastIndexOf('modules["client/combat-lab.js"] = (() => {');
  const lab = { console, setTimeout, clearTimeout, URL, performance };
  runInNewContext(html.slice(start, end) + '\nglobalThis.art = modules["client/unit-action-art.mjs"];', lab);
  const files = {}; runInNewContext(read('client/local-assets.js').toString(), files);
  for (const tribe of tribes) for (const form of forms) {
    const clip = DEFENSIVE_ATTACK_ART[tribe + '/' + form], agent = actor(tribe, form);
    for (const renderer of [scope.Spawner, lab.art]) assert.deepEqual(JSON.parse(JSON.stringify(renderer.unitActionArtDefinition(agent).actions.attack)), clip);
    const wrapper = 'client/local-assets/' + clip.image.slice('DesignAssets/'.length) + '.js';
    assert.ok(files.SpawnerLocalAssetFiles.includes('./' + wrapper));
    const payload = read(wrapper).toString().match(/"data:image\/png;base64,([A-Za-z0-9+/=]+)";/);
    assert.ok(payload); assert.equal(hash(Buffer.from(payload[1], 'base64')), hash(read(clip.image)));
  }
  assert.equal(COMBAT_LAB_APPEARANCES.length, 14);
});

test('design has all defensive previews and a generic no image placeholder for missing slots', () => {
  let html = ''; runInNewContext(read('DesignAssets/sections/unit-appearance.js').toString(), { document: { write: value => { html += value; } } });
  const headings = html.match(/<thead>[^]*?<\/thead>/)?.[0];
  assert.equal((headings.match(/<th\b/g) || []).length, 13, 'existing columns only');
  assert.equal(headings.includes('반격'), false);
  for (const form of forms) {
    const group = html.match(new RegExp('<tbody[^>]*data-appearance-gene="' + form + '"[^>]*>[^]*?</tbody>'))?.[0]; assert.ok(group);
    const cells = [...group.matchAll(/<td[^>]*data-action="attack"[^>]*>([^]*?)<\/td>/g)].map(match => match[1]);
    assert.equal(cells.length, 4); assert.ok(cells.every(cell => cell.includes(' · 공격') && cell.includes('data-preview=')));
  }
  const css = read('DesignAssets/design.css').toString();
  assert.match(css, /\.appearance-table tbody td:empty::before\{content:"no image"/);
  assert.ok(html.includes('플레이어블 기본 공격력은 1'));
  assert.ok(html.includes('44개 복합 외형·280개 기본 동작'));
});
