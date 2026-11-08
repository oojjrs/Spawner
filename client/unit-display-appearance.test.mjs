import { unitPresentationTestSource } from "./unit-presentation-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { UNIT_APPEARANCE_BITS, UNIT_APPEARANCE_TRIBES, unitAppearanceMaskFromAttributes } from "../server/unit-appearance.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { dnaAppearance, dnaUnitStats } from "../server/dna-unit.mjs";
import { dnaAttackMode } from "../server/dna-actions.mjs";
import { unitDisplayAttributes, unitDisplayAttributesFrom, unitDominantAppearanceMask, UNIT_DISPLAY_MASKS, UNIT_DISPLAY_FORM_COUNT, unitDisplayAbilityMask } from "./unit-display-appearance.mjs";
import { unitAppearanceInventory, unitAppearanceForAgent, unitAppearanceDefinition, unitAppearanceRequiredWorldActions } from "./unit-appearance.mjs";
import { unitAnimationPose } from "./unit-animation.mjs";
import { unitAppearanceStatePose } from "./unit-appearance-state.mjs";
import { unitRangedAppearance, unitRangedPose, unitRangedDisplaySize, UNIT_RANGED_FORMS } from "./unit-ranged.mjs";
import { combatAttributeKeys, hasCombatEvolution } from "./combat-attributes.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";

const attributesFor = mask => Object.fromEntries(Object.entries(UNIT_APPEARANCE_BITS).filter(([, bit]) => mask & bit).map(([key]) => [key, 3]));
const plain = value => JSON.parse(JSON.stringify(value));
function design(ids) {
  const pieces = ATTRIBUTE_DNA.pack(ids.map(id => {
    const gene = ATTRIBUTE_DNA.lookup.get(id);
    return { gene: id, grade: gene.grade, rotation: 0 };
  }), 4);
  assert.ok(pieces);
  const dna = { version: 6, pieces, level: 4, budget: 10000 };
  assert.ok(ATTRIBUTE_DNA.validate(dna));
  return dna;
}

test("all 128 current trait combinations deterministically collapse to exactly 64 display forms", () => {
  const forms = new Set();
  for (const tribe of UNIT_APPEARANCE_TRIBES) {
    const groups = new Map();
    for (let actual = 0; actual < 32; actual++) {
      const attributes = Object.freeze(attributesFor(actual)), unit = Object.freeze({ tribe, attributes });
      const visual = unitDisplayAttributes(unit), mask = unitAppearanceMaskFromAttributes(visual);
      assert.equal(mask, unitDominantAppearanceMask(actual));
      assert.ok(Object.values(visual).every(value => value === 1));
      assert.deepEqual(attributes, attributesFor(actual));
      forms.add(tribe + "/" + mask); groups.set(mask, (groups.get(mask) || 0) + 1);
    }
    assert.deepEqual(UNIT_DISPLAY_MASKS.map(mask => groups.get(mask)), Array(16).fill(2));
  }
  assert.equal(forms.size, 64); assert.equal(UNIT_DISPLAY_FORM_COUNT, 64);
  for (const invalid of [null, undefined, NaN, -1, 32, .5]) assert.equal(unitDominantAppearanceMask(invalid), null);
});

test("projection does not mutate actual DNA, mechanical attributes, hidden abilities or serialized state", () => {
  const dna = design(["blade", "secretion", "carapace", "antenna", "legs"]);
  const unit = { tribe: "bean", dna, attributes: dnaAppearance(dna), stats: dnaUnitStats(dna) };
  const saved = JSON.stringify(unit), stats = dnaUnitStats(dna);
  assert.deepEqual(unitDisplayAttributes(unit), { blade: 1, secretion: 1, carapace: 1, antenna: 1 });
  assert.equal(dnaAttackMode(stats, 1), "melee"); assert.equal(dnaAttackMode(stats, 2), "ranged");
  assert.ok(stats.armor > 0); assert.ok(stats.evasion > 0);
  assert.deepEqual(dnaUnitStats(dna), stats); assert.equal(JSON.stringify(unit), saved);
  assert.deepEqual(unitDisplayAttributes(JSON.parse(saved)), { blade: 1, secretion: 1, carapace: 1, antenna: 1 });
  assert.deepEqual(unitDisplayAttributes({ dna }), { blade: 1, secretion: 1, carapace: 1, antenna: 1 });
});

test("snapshotted appearance and historical retired-organ rigs keep their compatibility contracts", () => {
  const attributes = { blade: 1, secretion: 1, carapace: 1, feet: 1 };
  const unit = { attributes, appearanceAttributes: { antenna: 2, feet: 3 } };
  assert.deepEqual(unitDisplayAttributes(unit), { antenna: 1 });
  assert.deepEqual(unitDisplayAttributes({ ...unit, appearanceAttributes: {} }), {});
  const legacy = { blade: 1, antenna: 1, strength: 1, feet: 1 };
  assert.deepEqual(unitDisplayAttributesFrom(legacy), { blade: 1, antenna: 1, strength: 1 });
  assert.equal(legacy.feet, 1, "saved mechanics remain untouched");
  assert.equal(unitDisplayAttributes({ species: "bubble-toad", attributes }), attributes);
  assert.deepEqual(unitDisplayAttributesFrom(null), {});
  assert.deepEqual(combatAttributeKeys(null), []);
  assert.deepEqual(unitDisplayAttributesFrom({ legs: 3, dnaGather: true }), { dnaGather: true });
});

test("production inventory has 64 targets, keeps archival 128 sources and never upgrades readiness", () => {
  const inventory = unitAppearanceInventory();
  assert.equal(inventory.length, 64); assert.equal(unitAppearanceInventory({ includeLegacyCombinations: true }).length, 128);
  assert.equal(inventory.filter(row => row.worldReady).length, 0);
  assert.ok(inventory.find(row => row.key === "bean/15").missingActions.includes("ranged"));
  assert.equal(unitDisplayAbilityMask(1), 9); assert.equal(unitDisplayAbilityMask(16), 24);
  assert.equal(unitDisplayAbilityMask(3), 11);
});


test("single secretion retains its approved shooting art and combinations never borrow that body", () => {
  for (const tribe of UNIT_APPEARANCE_TRIBES) {
    const unit = { tribe, attributes: { secretion: 3, feet: 2 }, stats: { ranged: true }, health: 10,
      attack: { startedAt: 0, launchedAt: .2, hitAt: .4, endsAt: .6, mode: "ranged", dnaRanged: true } };
    assert.equal(unitRangedAppearance(unit), UNIT_RANGED_FORMS[tribe]);
    assert.equal(unitRangedPose(unit, .2).action, "shoot");
    for (const extra of [{ blade: 1 }, { carapace: 2, antenna: 1 }])
      assert.equal(unitRangedAppearance({ ...unit, attributes: { ...unit.attributes, ...extra } }), null);
    assert.deepEqual(combatAttributeKeys(unitDisplayAttributes(unit)), []);
  }
});

test("render-only observation preserves deterministic mixed-build combat, true events and hidden abilities", () => {
  const settings = { left: { key: "bean", organs: { attack: 1, ranged: 1 }, counts: {} },
    right: { key: "pebble", organs: { attack: 1, ranged: 1 }, counts: {} }, distance: 2, random: false, rules: { maxSeconds: 4 } };
  const observed = createSimulationTrial(settings), control = createSimulationTrial(settings);
  for (let step = 0; step < 40; step++) {
    observed.advance(.1); control.advance(.1);
    for (const unit of observed.agents) { unitDisplayAttributes(unit); unitRangedPose(unit, observed.time); }
  }
  assert.deepEqual(observed.agents, control.agents); assert.deepEqual(observed.history, control.history);
  assert.deepEqual(JSON.parse(JSON.stringify(observed.vfx).replaceAll(observed.vfx.streamId, "stream")),
    JSON.parse(JSON.stringify(control.vfx).replaceAll(control.vfx.streamId, "stream"))); assert.deepEqual(observed.result(), control.result());
  assert.ok(observed.vfx.events.some(event => event.kind === "shoot"));
});




test("design and template portrait sources accept loaded secretion Images and existing canvases", () => {
  const source = unitPresentationTestSource(readFileSync(new URL("./game.js", import.meta.url), "utf8"));
  const code = source.match(/^    function agentImageSource\([^]*?^    }/m)[0];
  let sprite = { currentSrc: "approved-secretion.png", src: "fallback.png" }, encodes = 0;
  const scope = createContext({ Spawner: { unitRangedAppearance }, assetSource: path => "assets/" + path,
    agentSprite: () => sprite, agentImageSources: new WeakMap() });
  runInContext(code, scope);
  assert.equal(scope.agentImageSource({}), "approved-secretion.png");
  sprite = { src: "approved-secretion.png" };
  assert.equal(scope.agentImageSource({}), "approved-secretion.png");
  sprite = { toDataURL: () => { encodes++; return "data:image/png;base64,canvas"; } };
  assert.equal(scope.agentImageSource({}), "data:image/png;base64,canvas");
  assert.equal(scope.agentImageSource({}), "data:image/png;base64,canvas");
  assert.equal(encodes, 1);
  scope.agentSprite = () => { throw new Error("DOM image must not use a cold-load canvas fallback"); };
  assert.equal(scope.agentImageSource({ tribe: "bean", attributes: { secretion: 1 } }),
    "assets/" + UNIT_RANGED_FORMS.bean.idle.image);
});
