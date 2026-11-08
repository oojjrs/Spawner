import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { bladeRangedPose, bladeRangedShear, applyBladeRangedRecoil, bladeRangedExpression, bladeRangedSample } from "./blade-ranged.mjs";
import { workPoint, workTriangles } from "./dominant-resource-motion.mjs";
import { combatEvolutionPose, createCombatEvolutionArt } from "./combat-evolution.mjs";
import { COMBAT_EVOLUTION_CATALOG } from "./combat-evolution-assets.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX } from "./combat-detail-vfx.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";

const tribes = ["bean", "spore", "pebble", "spring"];
const animations = tribe => COMBAT_EVOLUTION_CATALOG[(tribe === "bean" ? "sprout" : tribe) + "/blade"].animations;
const agent = (tribe = "bean", overrides = {}) => ({ id: "blade", tribe, health: 10,
  attributes: { blade: 1, secretion: 1, feet: 1 }, bornAt: 0, hurtStartedAt: -Infinity,
  combat: { version: 2 }, attack: { mode: "ranged", startedAt: 10, launchedAt: 10.3,
    hitAt: 10.65, endsAt: 11.2, shotLaunches: [10.3, 10.42, 10.54, 10.66] }, ...overrides });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);


test("zero-final-recovery schedules keep all launch cues instead of invalidating the combo", () => {
  for (const launches of [[10.3], [10.3, 10.42], [10.3, 10.42, 10.54, 10.66]]) {
    const unit = agent(); unit.attack.shotLaunches = launches; unit.attack.endsAt = launches.at(-1);
    for (const [index, at] of launches.entries()) {
      const pose = bladeRangedPose(unit, at);
      assert.equal(pose.shotIndex, index); close(pose.elapsed, 200);
    }
    assert.equal(bladeRangedPose(unit, unit.attack.endsAt + .00001), null);
  }
});


test("recoil has identity endpoints and leaves every point on the ground support line fixed", () => {
  close(bladeRangedShear(0), 0); close(bladeRangedShear(600), 0);
  for (let ms = 0; ms <= 600; ms += 20) {
    let e = 0, c = 0;
    const context = { translate(x, y) { e += x + c * y; }, transform(a, b, shear) { c += shear; } };
    applyBladeRangedRecoil(context, { sampleTime: ms });
    for (const x of [128, 256, 384]) close(x + c * 448 + e, x);
    assert.ok(Math.abs(c) <= .055);
  }
});

test("shared shoot expression anticipates, releases and settles without moving the authored support band", () => {
  for (const tribe of tribes) {
    for (const ms of [0, 600]) {
      const pose = bladeRangedExpression(tribe, ms);
      assert.equal(pose.compression, 0); assert.equal(pose.sweep, 0);
      for (const y of [0, 200, 432, 448, 512]) assert.deepEqual(workPoint(pose, 300, y), [300, y]);
    }
    const aim = bladeRangedExpression(tribe, 160), release = bladeRangedExpression(tribe, 200);
    assert.ok(aim.compression > 0 && aim.sweep > 0, "crouch and aim toward target");
    assert.ok(release.compression < 0 && release.sweep < 0, "release stretches back, not a melee lunge");
    assert.ok(bladeRangedExpression(tribe, 320).compression > 0, "recovery settles past neutral");
    for (let ms = 0; ms <= 600; ms += 20) {
      const pose = bladeRangedExpression(tribe, ms);
      for (const y of [432, 448, 452, 511]) for (const x of [0, 128, 256, 384, 512])
        assert.deepEqual(workPoint(pose, x, y), [x, y]);
      assert.ok(workTriangles(pose).every(triangle => triangle.ratio > .5 && triangle.ratio < 1.5));
    }
  }
  assert.ok(bladeRangedExpression("pebble", 160).compression < bladeRangedExpression("spring", 160).compression);
  for (const [tribe, ms] of [["toad", 200], ["constructor", 200], ["bean", NaN], ["bean", -1], ["bean", 601]])
    assert.equal(bladeRangedExpression(tribe, ms), null);
});

test("shoot expression accepts only ready own-source blade idle art", () => {
  for (const tribe of tribes) {
    const name = tribe === "bean" ? "sprout" : tribe, animation = animations(tribe).idle;
    const source = { rig: { tribe: name, variant: "blade", approvedSource: `DesignAssets/Concepts/CombatEvolutionV1/${name}.png` },
      definition: { animations: { idle: animation } }, sheets: new Map([["idle", { width: 512, height: 512 }]]) };
    const requested = { animation, ranged: { sampleTime: 200 } };
    assert.equal(bladeRangedSample(source, requested).pose.tribe, tribe);
    for (const invalid of [{ ...source, rig: { ...source.rig, variant: "carapace" } },
      { ...source, rig: { ...source.rig, approvedSource: "other-art.png" } }, { ...source, definition: null },
      ...[null, { width: 512, height: 512, complete: false }, { width: 1, height: 1 }].map(image => ({ ...source, sheets: new Map([["idle", image]]) }))])
      assert.equal(bladeRangedSample(invalid, requested), null);
    assert.equal(bladeRangedSample(source, { ...requested, animation: { ...animation, image: "melee.png" } }), null);
  }
});
