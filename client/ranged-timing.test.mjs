import test from "node:test";
import assert from "node:assert/strict";
import { createSimulationTrial } from "./combat-simulation.mjs";
import { unitRangedPose, UNIT_RANGED_FORMS } from "./unit-ranged.mjs";
import { unitAnimationFrame } from "./unit-animation.mjs";

function fixture(tribe, reverse, counts = {}, rules = {}) {
  const shooter = { key: tribe, organs: { attack: 0, ranged: 1 }, counts: { vitality: 80, ...counts } };
  const target = { key: "bean", organs: { attack: 0, ranged: 0 }, counts: { vitality: 80 } };
  return createSimulationTrial({ left: reverse ? target : shooter, right: reverse ? shooter : target,
    distance: 2, first: reverse ? "right" : "left", random: false, rules });
}

function at(trial, time) { trial.advance(Math.max(0, time - trial.time)); }

test("laboratory ranged combos retain every launch and recovery pose for four tribes and both sides", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const reverse of [false, true])
    for (const counts of [{}, { multiHit: 3 }, { multiHit: 7, focus: 20, hitSpeed: 20, rangedHaste: 20 }]) {
      const trial = fixture(tribe, reverse, counts), shooter = trial.agents[Number(reverse)];
      at(trial, .001);
      const attack = shooter.attack, start = attack.startedAt, { hitCount, windup, hitGap } = shooter.stats;
      const launches = Array.from({ length: hitCount }, (_, index) => start + windup + index * hitGap);
      const animation = UNIT_RANGED_FORMS[tribe].animation;
      const launchFrame = unitAnimationFrame(animation, animation.launchAtMs);
      assert.deepEqual(attack.shotLaunches, launches, tribe + " exposes the actual schedule");
      for (const [index, launch] of launches.entries()) {
        at(trial, launch);
        assert.equal(shooter.attack, attack, "shots remain one action");
        assert.equal(attack.startedAt, start, "launching does not rewind the animation epoch");
        assert.equal(attack.launchedAt, launches[0]);
        assert.equal(attack.hitAt, launches[0], "laboratory contact clock stays at the first launch");
        const pose = unitRangedPose(shooter, trial.time);
        assert.equal(pose.action, "shoot");
        assert.equal(pose.frame, launchFrame, tribe + " launch " + index);
        assert.equal(pose.mirrorX, reverse);
        const recoveryEnd = index + 1 < launches.length ? launch + hitGap *
          (animation.durationMs - animation.launchAtMs) / animation.durationMs : attack.endsAt;
        at(trial, launch + (recoveryEnd - launch) * .5);
        assert.ok(unitRangedPose(shooter, trial.time).frame > launchFrame, "each shot gets recovery, not another windup");
        assert.deepEqual(unitRangedPose(JSON.parse(JSON.stringify(shooter)), trial.time), unitRangedPose(shooter, trial.time));
      }
      const shots = trial.history.filter(event => event.kind === "shoot" && event.attackerId === shooter.id);
      assert.deepEqual(shots.map(event => event.time), launches);
      assert.deepEqual(shots.map(event => event.hitIndex), launches.map((_, index) => index));
      at(trial, attack.endsAt + 1e-6);
      if (!shooter.attack) assert.equal(unitRangedPose(shooter, trial.time).action, "idle");
    }
});

test("new ranged actions receive fresh clocks and terminating a trial cannot replay queued launches", () => {
  const trial = fixture("bean", false, { multiHit: 3 });
  at(trial, .001);
  const shooter = trial.agents[0], first = shooter.attack;
  at(trial, shooter.combat.nextAttackAt + .001);
  const next = shooter.attack;
  assert.notEqual(next, first);
  assert.ok(next.shotLaunches[0] > first.shotLaunches.at(-1));
  at(trial, next.launchedAt);
  assert.equal(unitRangedPose(shooter, trial.time).frame, 8);

  const stopped = fixture("spring", false, { multiHit: 7 }, { maxSeconds: .4 });
  at(stopped, .4);
  assert.ok(stopped.result());
  assert.equal(stopped.agents[0].attack, null);
  assert.equal(unitRangedPose(stopped.agents[0], stopped.time).action, "idle");
  const shots = stopped.history.filter(event => event.kind === "shoot").length;
  stopped.advance(1);
  assert.equal(stopped.history.filter(event => event.kind === "shoot").length, shots);
});

test("legacy one-shot clocks and rejected appearance or death remain unchanged", () => {
  const agent = { tribe: "bean", health: 10, facing: -1, stats: { ranged: true }, attributes: {},
    attack: { mode: "ranged", startedAt: 0, hitAt: .3, endsAt: .6 } };
  assert.equal(unitRangedPose(agent, .3).frame, 8);
  assert.equal(unitRangedPose(agent, .6).action, "idle");
  assert.equal(unitRangedPose({ ...agent, health: 0 }, .3), null);
  assert.equal(unitRangedPose({ ...agent, attributes: { blade: 1 } }, .3), null);
});

test("the actual combat stage draws the launch cell after every simulated combo shot", async () => {
  const { createCombatStage } = await import("./combat-stage.mjs");
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets };
  globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
  globalThis.Image = class {
    complete = true;
    naturalWidth = 4096;
    naturalHeight = 4096;
  };
  globalThis.SpawnerAssets = { source: path => path };
  try {
    for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const reverse of [false, true]) {
      const calls = [], context = new Proxy({}, { get: (target, key) => target[key] || ((...args) => calls.push({ key, args })) });
      const canvas = { clientWidth: 1040, clientHeight: 480, getContext: () => context };
      const stage = createCombatStage(canvas), trial = fixture(tribe, reverse, { multiHit: 3 });
      const shooter = trial.agents[Number(reverse)], animation = UNIT_RANGED_FORMS[tribe].animation;
      const frame = unitAnimationFrame(animation, animation.launchAtMs);
      stage.render(trial, 0, true);
      at(trial, .001);
      for (const launch of shooter.attack.shotLaunches) {
        at(trial, launch); calls.length = 0;
        const before = JSON.stringify(trial.agents);
        stage.render(trial, launch * 1000, true);
        const draw = calls.find(call => call.key === "drawImage" && call.args[0]?.src === animation.image);
        assert.ok(draw, tribe + " approved shoot art is rendered");
        assert.deepEqual(draw.args.slice(1, 5), [frame % animation.columns * animation.frameSize,
          Math.floor(frame / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize]);
        assert.equal(JSON.stringify(trial.agents), before, "rendering does not change simulation state");
      }
    }
  } finally {
    globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets;
  }
});
