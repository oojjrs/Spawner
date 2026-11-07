import test from "node:test";
import assert from "node:assert/strict";
import { combatProfile, UNIT_COMBAT_STATS, unitCombatStats, migrateCombatStats } from "./combat-stats.mjs";
import { deriveSimulationStats } from "../client/combat-simulation.mjs";

const chances = {
  "flower-tail-bird": 10, "dew-rabbit": 8, "soil-mole": 12, "bundle-snail": 5, "cotton-sheep": 5,
  "rolling-acorn": 8, "bubble-toad": 10, "snare-vine": 8, "spiny-back-beetle": 8, "soil-boar": 12,
  "vine-turtle": 5, "shadow-weasel": 20, "talon-owl": 18, "spring-keeper": 15, "lantern-keeper": 15,
  "old-garden-snail": 5, "walking-forest": 8, "white-paw": 20, "spiny-back-leader": 12
};

test("all nineteen neutral species use the approved critical chance and shared multiplier", () => {
  assert.equal(Object.keys(chances).length, 19);
  for (const [species, percent] of Object.entries(chances)) {
    const base = unitCombatStats(species), actual = combatProfile({ species, stats: {} }), laboratory = deriveSimulationStats({ key: species });
    assert.equal(base.criticalChance, percent / 100); assert.equal(base.criticalMultiplier, 1.5);
    for (const profile of [actual, laboratory]) {
      assert.equal(profile.criticalChance, percent / 100); assert.equal(profile.criticalMultiplier, 1.5);
    }
    assert.equal(laboratory.critChance, percent / 100); assert.equal(laboratory.critMultiplier, 1.5);
  }
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    assert.equal(UNIT_COMBAT_STATS[tribe].criticalChance, 0);
    assert.equal(combatProfile({ tribe, stats: {} }).criticalChance, 0);
  }
});

test("DNA critical percentages and custom multipliers retain their existing values", () => {
  for (const [critical, criticalPower] of [[0, 150], [25, 175], [75, 400], [100, 500]]) {
    const dna = { melee: true, meleePower: 10, meleeSpeed: 1, critical, criticalPower };
    const profile = combatProfile({ tribe: "bean", stats: { dna, criticalChance: .01, criticalMultiplier: 1.1 } });
    assert.equal(profile.criticalChance, critical / 100); assert.equal(profile.criticalMultiplier, criticalPower / 100);
  }
});

test("native critical overrides are bounded while missing values fall back to the species", () => {
  for (const [chance, multiplier, expectedChance, expectedMultiplier] of [[0, 1, 0, 1], [.3, 2.5, .3, 2.5], [-2, -3, 0, 1], [8, 9, .75, 4], [NaN, Infinity, .2, 1.5]]) {
    const profile = combatProfile({ species: "white-paw", stats: { criticalChance: chance, criticalMultiplier: multiplier } });
    assert.equal(profile.criticalChance, expectedChance); assert.equal(profile.criticalMultiplier, expectedMultiplier);
  }
  const missing = combatProfile({ species: "white-paw" });
  assert.equal(missing.criticalChance, .2); assert.equal(missing.criticalMultiplier, 1.5);
});

test("neutral save migration fills only missing critical values and preserves health and timing", () => {
  const saved = { species: "talon-owl", health: 37, attackReady: 19, stats: { health: 100, combatStrength: 44 } };
  migrateCombatStats(saved);
  assert.equal(saved.stats.criticalChance, .18); assert.equal(saved.stats.criticalMultiplier, 1.5);
  assert.equal(saved.health, 37); assert.equal(saved.attackReady, 19);
  saved.stats.criticalChance = 0; saved.stats.criticalMultiplier = 2.1;
  const before = structuredClone(saved); migrateCombatStats(saved);
  assert.deepEqual(saved, before);
});
