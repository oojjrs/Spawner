import test from "node:test";
import assert from "node:assert/strict";
import { combatProfile, UNIT_COMBAT_STATS, unitCombatStats, migrateCombatStats } from "./combat-stats.mjs";
import { NEUTRAL_UNIT_STATS } from "./neutral-unit-stats.mjs";
import { deriveSimulationStats } from "../client/combat-simulation.mjs";

const chances = Object.fromEntries(Object.entries(NEUTRAL_UNIT_STATS).map(([species, stats]) => [species, stats.critical]));

test("all nineteen neutral species use the approved critical chance and configured multipliers", () => {
  assert.equal(Object.keys(chances).length, 19);
  for (const [species, percent] of Object.entries(chances)) {
    const base = unitCombatStats(species), actual = combatProfile({ species, stats: {} }), laboratory = deriveSimulationStats({ key: species });
    assert.equal(base.criticalChance, percent / 100); assert.equal(base.criticalMultiplier, NEUTRAL_UNIT_STATS[species].criticalPower / 100);
    for (const profile of [actual, laboratory]) {
      assert.equal(profile.criticalChance, percent / 100); assert.equal(profile.criticalMultiplier, NEUTRAL_UNIT_STATS[species].criticalPower / 100);
    }
    assert.equal(laboratory.critChance, percent / 100); assert.equal(laboratory.critMultiplier, NEUTRAL_UNIT_STATS[species].criticalPower / 100);
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
  for (const [chance, multiplier, expectedChance, expectedMultiplier] of [[0, 1, 0, 1], [.3, 2.5, .3, 2.5], [-2, -3, 0, 1], [8, 9, .75, 4], [NaN, Infinity, NEUTRAL_UNIT_STATS["white-paw"].critical / 100, NEUTRAL_UNIT_STATS["white-paw"].criticalPower / 100]]) {
    const profile = combatProfile({ species: "white-paw", stats: { criticalChance: chance, criticalMultiplier: multiplier } });
    assert.equal(profile.criticalChance, expectedChance); assert.equal(profile.criticalMultiplier, expectedMultiplier);
  }
  const missing = combatProfile({ species: "white-paw" });
  assert.equal(missing.criticalChance, NEUTRAL_UNIT_STATS["white-paw"].critical / 100); assert.equal(missing.criticalMultiplier, NEUTRAL_UNIT_STATS["white-paw"].criticalPower / 100);
});

test("neutral save migration reapplies species stats while preserving health ratio and timing", () => {
  const saved = { species: "talon-owl", health: 37, attackReady: 19, stats: { health: 100, combatStrength: 44 } };
  migrateCombatStats(saved);
  assert.equal(saved.stats.criticalChance, NEUTRAL_UNIT_STATS["talon-owl"].critical / 100); assert.equal(saved.stats.criticalMultiplier, NEUTRAL_UNIT_STATS["talon-owl"].criticalPower / 100);
  assert.equal(saved.health, NEUTRAL_UNIT_STATS["talon-owl"].health * .37); assert.equal(saved.attackReady, 19);
  const before = structuredClone(saved);
  saved.stats.criticalChance = 0; saved.stats.criticalMultiplier = 2.1;
  migrateCombatStats(saved);
  assert.deepEqual(saved, before);
});
