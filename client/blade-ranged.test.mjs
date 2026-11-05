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

test("all four dominant blade bodies cue each recorded launch without a melee swing or arrival cue", () => {
  for (const tribe of tribes) for (const facing of [-1, 1]) for (const gap of [.03, .12, .6]) {
    const unit = agent(tribe, { facing });
    unit.attack.shotLaunches = Array.from({ length: 4 }, (_, i) => 10.3 + i * gap);
    unit.attack.endsAt = unit.attack.shotLaunches.at(-1) + .4;
    const before = JSON.stringify(unit);
    for (const [index, time] of unit.attack.shotLaunches.entries()) {
      const pose = combatEvolutionPose(unit, time, animations(tribe));
      assert.equal(pose.action, "ranged"); assert.equal(pose.animation, animations(tribe).idle);
      assert.equal(pose.frame, 0); assert.equal(pose.ranged.shotIndex, index);
      close(pose.ranged.elapsed, 200); assert.equal(pose.ranged.frame, 10);
      close(pose.ranged.launchAt, time);
      assert.ok(bladeRangedShear(pose.ranged.sampleTime) > 0, "release recoils backwards");
      const recoveryEnd = index < 3 ? time + gap * 2 / 3 : unit.attack.endsAt;
      assert.ok(bladeRangedPose(unit, time + (recoveryEnd - time) / 2).elapsed > 200);
      assert.deepEqual(bladeRangedPose(JSON.parse(before), time), bladeRangedPose(unit, time));
    }
    assert.equal(combatEvolutionPose(unit, unit.attack.endsAt, animations(tribe)).action, "idle");
    assert.equal(JSON.stringify(unit), before, "render state never changes the agent or its schedule");
  }
});

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

test("missing launch clocks stay neutral, and death, birth, melee and legacy rigs keep their action", () => {
  const unit = agent();
  for (const attack of [{ ...unit.attack, launchedAt: undefined }, { ...unit.attack, launchedAt: NaN },
    { ...unit.attack, launchedAt: 11.3 }, { ...unit.attack, endsAt: 10.3 }]) {
    assert.equal(bladeRangedPose({ ...unit, attack }, 10.4), null);
    assert.equal(combatEvolutionPose({ ...unit, attack }, 10.4, animations("bean")).action, "idle");
  }
  for (const shotLaunches of [[], [10.4], [10.3, 10.2], [10.3, 10.3], [10.3, NaN], [10.3, 12]])
    assert.equal(bladeRangedPose({ ...unit, attack: { ...unit.attack, shotLaunches } }, 10.6).shotIndex, 0);
  for (const overrides of [{ health: 0, diedAt: 10 }, { birth: { startedAt: 10, readyAt: 12 } },
    { attributes: { secretion: 1 } }, { attributes: { blade: 1, strength: 1 } }, { species: "toad" },
    { attack: { ...unit.attack, mode: "melee" } }, { attack: null }]) assert.equal(bladeRangedPose({ ...unit, ...overrides }, 10.3), null);
  assert.equal(combatEvolutionPose({ ...unit, health: 0, diedAt: 10 }, 10.3, animations("bean")).action, "death");
  assert.equal(combatEvolutionPose({ ...unit, birth: { startedAt: 10, readyAt: 12 } }, 10.3, animations("bean")).action, "birth");
  assert.equal(combatEvolutionPose({ ...unit, attack: { startedAt: 10, speed: 1 } }, 10.3, animations("bean")).action, "attack");
  assert.equal(bladeRangedPose(unit, 9.9), null);
  assert.equal(bladeRangedPose(unit, NaN), null);
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

test("actual compositor deforms only the blade idle sheet, never a melee sheet or effect, for ranged actions", async () => {
  const source = path => new URL("../" + path, import.meta.url).href;
  const saved = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await fs.readFile(new URL(url), "utf8")) });
  const surface = (width, height) => {
    const result = { width, height, calls: [] }, methods = ["save", "restore", "translate", "scale", "transform", "drawImage", "beginPath", "moveTo", "lineTo", "rect", "closePath", "clip"];
    const context = Object.fromEntries(methods.map(key => [key, (...args) => result.calls.push({ key, args })]));
    result.getContext = () => context; return result;
  };
  const load = async path => ({ src: path, width: 512, height: 512 });
  try {
    const art = createCombatEvolutionArt(source, surface, load);
    for (const tribe of tribes) {
      await art.prepare(tribe);
      const unit = agent(tribe), image = animations(tribe).idle.image;
      for (const launch of unit.attack.shotLaunches) {
        const sprite = art.frame(unit, launch);
        const draws = sprite.calls.filter(call => call.key === "drawImage");
        assert.equal(draws.length, 55, "bounded mesh reuses one neutral source and the unchanged support strip");
        for (const draw of draws) {
          assert.equal(draw.args[0].src, image); assert.deepEqual(draw.args.slice(1, 3), [0, 0]);
        }
        assert.deepEqual(sprite.calls.find(call => call.key === "rect").args, [0, 432, 512, 80]);
        assert.equal(art.frame(unit, launch + .000001), sprite, "one bounded cache entry per sampled motion frame");
      }
      const neutral = art.frame({ ...unit, attack: null }, 0);
      assert.equal(neutral.calls.some(call => call.key === "transform"), false);
    }
  } finally { globalThis.fetch = saved; }
});

test("a failed shoot mesh retries original recoil once and recovers on the next sample", async () => {
  const source = path => new URL("../" + path, import.meta.url).href, saved = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await fs.readFile(new URL(url), "utf8")) });
  let failClip = true;
  const surface = (width, height) => {
    const result = { width, height, calls: [] }, methods = ["save", "restore", "translate", "scale", "transform", "drawImage", "beginPath", "moveTo", "lineTo", "rect", "closePath"];
    const context = Object.fromEntries(methods.map(key => [key, (...args) => result.calls.push({ key, args })]));
    context.clip = () => { if (failClip) { failClip = false; throw new Error("Temporary mesh failure"); } };
    result.getContext = () => context; return result;
  };
  try {
    const art = createCombatEvolutionArt(source, surface, async path => ({ src: path, width: 512, height: 512 }));
    await art.prepare("bean");
    const unit = agent(), fallback = art.frame(unit, 10.3);
    assert.equal(fallback.calls.filter(call => call.key === "drawImage").length, 1);
    close(fallback.calls.find(call => call.key === "transform").args[2], .045);
    const recovered = art.frame(unit, 10.3);
    assert.notEqual(recovered, fallback);
    assert.equal(recovered.calls.filter(call => call.key === "drawImage").length, 55);
    assert.equal(art.frame(unit, 10.3), recovered);
  } finally { globalThis.fetch = saved; }
});

test("real mixed-build multishots retain authoritative shoot events, species flight, and unchanged gameplay", () => {
  for (const tribe of tribes) for (const reverse of [false, true]) {
    const shooter = { key: tribe, organs: { attack: 1, ranged: 1 }, counts: { multiHit: 3, vitality: 80 } };
    const target = { key: "bean", organs: { attack: 0, ranged: 0 }, counts: { vitality: 80 } };
    const settings = { left: reverse ? target : shooter, right: reverse ? shooter : target,
      distance: 2, first: reverse ? "right" : "left", random: false };
    const trial = createSimulationTrial(settings), control = createSimulationTrial(settings), index = Number(reverse);
    const detail = createDetailCombatVfx(), cursor = createCombatVfxCursor();
    detail.consume(cursor.consume(trial.vfx, 0), 0);
    trial.advance(.001); control.advance(.001);
    const firing = trial.agents[index], schedule = [...firing.attack.shotLaunches];
    for (const launch of schedule) {
      trial.advance(launch - trial.time); control.advance(launch - control.time);
      const local = { ...firing, tribe, appearanceAttributes: { blade: 1, secretion: 1 } };
      assert.deepEqual(unitDisplayAttributes(local), { blade: 1 });
      assert.equal(combatEvolutionPose(local, launch, animations(tribe)).action, "ranged");
      const event = trial.vfx.events.find(event => event.kind === "shoot" && event.sourceId === firing.id && Math.abs(event.at - launch) < 1e-8);
      assert.ok(event, "only an actual launch triggers the species flight");
      detail.consume(cursor.consume(trial.vfx, launch), launch);
      const agents = trial.agents.map((value, i) => i === index ? local : value);
      const positions = new Map(agents.map((value, i) => [value.id, { x: i ? 820 : 180, y: 350, width: 100, height: 140 }]));
      assert.ok(detail.commands(agents, positions, launch, 250).some(command => command.kind === "flight" && command.image === DETAIL_COMBAT_VFX[tribe].image));
      assert.deepEqual(trial.agents, control.agents); assert.deepEqual(trial.history, control.history);
    }
    assert.equal(trial.history.filter(event => event.kind === "shoot" && event.attackerId === firing.id).length, schedule.length);
  }
});
