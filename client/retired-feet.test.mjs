import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { UNIT_APPEARANCE_BITS, unitAppearanceForm, unitAppearanceMaskFromDna } from "../server/unit-appearance.mjs";
import { UNIT_ACTION_ART, UNIT_ACTION_ART_ASSETS } from "./unit-action-art-assets.mjs";
import { UNIT_APPEARANCE_ASSETS } from "./unit-appearance-assets.mjs";
import { UNIT_DISPLAY_MASKS, unitDisplayAttributes, unitDominantAppearanceMask } from "./unit-display-appearance.mjs";
import { unitActionArtDefinition } from "./unit-action-art.mjs";
import { WELCOME_UNIT_APPEARANCES } from "./welcome-presentation.mjs";
import { BEAN_HELD_HURT_ASSETS, beanHeldHurtSource } from "./bean-held-hurt.mjs";
import { SPECIES_HELD_HURT_ASSETS, speciesHeldHurtSource } from "./species-held-hurt.mjs";
import { TRIBE_MINOR_ANIMATIONS } from "./tribe-minor-animations.mjs";

const tribes = ["bean", "spore", "pebble", "spring"];
const retired = /(?:\/feet(?:\/|\.)|[-/]feet\.webp|UnitAppearanceV1\/[^/]+\/(?:0[89a-f]|1[89a-f])\/)/;

test("retired legged bodies are absent from live catalogues, welcome rotation and lazy artwork", () => {
  assert.ok(Object.keys(UNIT_ACTION_ART).every(key => !key.endsWith("/feet")));
  assert.ok(Object.keys(UNIT_APPEARANCE_ASSETS).every(key => !(parseInt(key.split("/")[1], 16) & UNIT_APPEARANCE_BITS.feet)));
  assert.ok(UNIT_DISPLAY_MASKS.every(mask => !(mask & UNIT_APPEARANCE_BITS.feet)));
  assert.ok(WELCOME_UNIT_APPEARANCES.every(attributes => !attributes.feet && !attributes.legs));
  for (const forms of Object.values(TRIBE_MINOR_ANIMATIONS)) assert.equal(forms.feet, undefined);
  const scope = {};
  runInNewContext(readFileSync(new URL("./unit-appearance-lazy-assets.js", import.meta.url), "utf8"), scope);
  for (const path of [...UNIT_ACTION_ART_ASSETS, ...BEAN_HELD_HURT_ASSETS, ...SPECIES_HELD_HURT_ASSETS,
    ...Object.keys(scope.SpawnerUnitAppearanceFiles)]) assert.equal(retired.test(path), false, path);
});

test("legacy feet and legs retain serialized mechanics but render the current base, gather or organ body", () => {
  for (const tribe of tribes) for (const retiredKey of ["feet", "legs"]) for (const corpse of [false, true]) {
    const saved = { tribe, health: corpse ? 0 : 10, attributes: { [retiredKey]: 3 },
      ...(corpse ? { kind: "corpse", appearanceAttributes: { [retiredKey]: 3 } } : {}),
      dna: { version: 3, pieces: [{ gene: "legs" }] }, stats: { evasion: 17, speed: 2.3 } };
    const before = JSON.stringify(saved);
    assert.equal(unitAppearanceMaskFromDna(saved.dna), UNIT_APPEARANCE_BITS.feet);
    assert.equal(unitDominantAppearanceMask(UNIT_APPEARANCE_BITS.feet), 0);
    assert.equal(unitAppearanceForm(saved), "base");
    assert.deepEqual(unitDisplayAttributes(saved), {});
    assert.equal(unitActionArtDefinition(saved), UNIT_ACTION_ART[tribe + "/base"]);
    assert.equal(JSON.stringify(saved), before);
  }
  for (const tribe of tribes) {
    const agent = { tribe, health: 10, attributes: { feet: 2, strength: 1 } };
    assert.equal(unitAppearanceForm(agent), "gather");
    assert.deepEqual(unitDisplayAttributes(agent), { strength: 1 });
    for (const organ of ["blade", "secretion", "carapace", "antenna"]) {
      const combined = { ...agent, attributes: { [organ]: 1, feet: 2 } };
      assert.equal(unitActionArtDefinition(combined), UNIT_ACTION_ART[tribe + "/" + organ]);
      assert.deepEqual(unitDisplayAttributes(combined), { [organ]: 1 });
    }
    const source = tribe === "bean" ? beanHeldHurtSource : speciesHeldHurtSource;
    assert.equal(source({ tribe, attributes: { feet: 1 } }), source({ tribe, attributes: {} }));
  }
});

test("ordinary animal limbs and current unit artwork are not retired", () => {
  const attributes = { feet: 1, legs: 2 };
  assert.equal(unitDisplayAttributes({ species: "moss-turtle", attributes }), attributes);
  assert.equal(unitAppearanceForm({ species: "moss-turtle", attributes }), null);
  for (const tribe of tribes) for (const form of ["base", "gather", "blade", "secretion", "carapace", "antenna"])
    assert.ok(UNIT_ACTION_ART[tribe + "/" + form]);
});
