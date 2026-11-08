import test from "node:test";
import assert from "node:assert/strict";
import { createSimulationTrial } from "./combat-simulation.mjs";
import { unitRangedPose, UNIT_RANGED_FORMS } from "./unit-ranged.mjs";
import { unitActionArtDefinition } from "./unit-action-art.mjs";
import { unitFrameMirror } from "./unit-size.mjs";
import { unitAnimationFrame } from "./unit-animation.mjs";

function fixture(tribe, reverse, counts = {}, rules = {}) {
  const shooter = { key: tribe, organs: { attack: 0, ranged: 1 }, counts: { vitality: 80, ...counts } };
  const target = { key: "bean", organs: { attack: 0, ranged: 0 }, counts: { vitality: 80 } };
  return createSimulationTrial({ left: reverse ? target : shooter, right: reverse ? shooter : target,
    distance: 2, first: reverse ? "right" : "left", random: false, rules });
}

function authoredFrame(animation, atMs) {
  let elapsed = atMs, index = 0;
  while (index < animation.durationsMs.length - 1 && elapsed + 1e-7 >= animation.durationsMs[index]) elapsed -= animation.durationsMs[index++];
  return animation.frames?.[index] ?? index;
}

function at(trial, time) { trial.advance(Math.max(0, time - trial.time)); }

function startAttack(trial, source) {
  while (!source.attack && trial.time < 20 && !trial.reason) trial.advance(.01);
  assert.ok(source.attack, "source reaches attack range within 20 simulated seconds");
  return source.attack;
}

test("laboratory ranged combos retain every launch and recovery pose for four tribes and both sides", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const reverse of [false, true])
    for (const counts of [{}, { multiHit: 3 }, { multiHit: 7, focus: 20, hitSpeed: 20, rangedHaste: 20 }]) {
      const trial = fixture(tribe, reverse, counts), shooter = trial.agents[Number(reverse)];
      startAttack(trial, shooter);
      const attack = shooter.attack, start = attack.startedAt, { hitCount, windup, hitGap } = shooter.stats;
      const launches = Array.from({ length: hitCount }, (_, index) => start + windup + index * hitGap);
      const animation = UNIT_RANGED_FORMS[tribe].animation;
      const launchFrame = unitAnimationFrame(animation, animation.launchAtMs);
      assert.deepEqual(attack.shotLaunches, launches.slice(0, 1), tribe + " exposes the first scheduled shot");
      for (const [index, launch] of launches.entries()) {
        at(trial, launch + 1 / 60);
        assert.equal(shooter.attack, attack, "shots remain one action");
        assert.equal(attack.startedAt, start, "launching does not rewind the animation epoch");
        assert.equal(attack.launchedAt, launches[0]);
        assert.equal(attack.shotLaunches.length, Math.min(launches.length, index + 2));
        attack.shotLaunches.forEach((at, hit) => assert.ok(Math.abs(at - launches[hit]) < 1e-9));
        const pose = unitRangedPose(shooter, launch);
        assert.equal(pose.action, "shoot");
        assert.equal(pose.frame, launchFrame, tribe + " launch " + index);
        assert.equal(pose.mirrorX, unitFrameMirror(animation.sourceFacing, reverse ? -1 : 1));
        const recoveryEnd = index + 1 < launches.length ? launch + hitGap *
          (animation.durationMs - animation.launchAtMs) / animation.durationMs : attack.endsAt;
        at(trial, launch + (recoveryEnd - launch) * .5);
        assert.ok(unitRangedPose(shooter, trial.time).frame > launchFrame, "each shot gets recovery, not another windup");
        assert.deepEqual(unitRangedPose(JSON.parse(JSON.stringify(shooter)), trial.time), unitRangedPose(shooter, trial.time));
      }
      const shots = trial.history.filter(event => event.kind === "shoot" && event.attackerId === shooter.id);
      assert.equal(shots.length, launches.length);
      shots.forEach((event, index) => assert.ok(Math.abs(event.time - launches[index]) < 1e-9));
      assert.deepEqual(shots.map(event => event.hitIndex), launches.map((_, index) => index));
      at(trial, attack.endsAt + 1e-6);
      if (!shooter.attack) assert.equal(unitRangedPose(shooter, trial.time).action, "idle");
    }
});

test("new ranged actions receive fresh clocks and a time limit freezes queued launches", () => {
  const trial = fixture("bean", false, { multiHit: 3 });
  const shooter = trial.agents[0], first = startAttack(trial, trial.agents[0]);
  at(trial, shooter.combat.nextAttackAt + 1 / 60);
  startAttack(trial, shooter);
  const next = shooter.attack;
  assert.notEqual(next, first);
  assert.ok(next.shotLaunches[0] > first.shotLaunches.at(-1));
  at(trial, next.launchedAt);
  assert.equal(unitRangedPose(shooter, trial.time).frame, 8);

  const stopped = fixture("spring", false, { multiHit: 7 }, { maxSeconds: .4 });
  for (const unit of stopped.agents) Object.assign(unit.combat.position,
    { x: unit.combat.side ? .4 : -.4, y: 0, fromX: unit.combat.side ? .4 : -.4, fromY: 0 });
  const pending = startAttack(stopped, stopped.agents[0]);
  assert.ok(pending.endsAt > .4, "the time limit interrupts a pending combo");
  at(stopped, .4);
  assert.equal(stopped.reason, "time-limit");
  assert.ok(pending.hitAt > stopped.time, "the remaining shot is beyond the frozen time");
  const history = structuredClone(stopped.history), agents = structuredClone(stopped.agents), result = stopped.result();
  stopped.advance(1);
  assert.deepEqual(stopped.history, history);
  assert.deepEqual(stopped.agents, agents);
  assert.deepEqual(stopped.result(), result);
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
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets, document: globalThis.document };
  globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
  globalThis.Image = class {
    complete = true;
    naturalWidth = 4096;
    naturalHeight = 4096;
    async decode() {}
  };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData(x,y,width,height) { return { data: new Uint8ClampedArray(width * height * 4).fill(255) }; } }) }) };
  globalThis.SpawnerAssets = { source: path => path };
  try {
    for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const reverse of [false, true]) {
      const calls = [], context = new Proxy({}, { get: (target, key) => target[key] || ((...args) => calls.push({ key, args })) });
      const canvas = { clientWidth: 1040, clientHeight: 480, getContext: () => context };
      const stage = createCombatStage(canvas), trial = fixture(tribe, reverse, { multiHit: 3 });
      const shooter = trial.agents[Number(reverse)], animation = unitActionArtDefinition(trial.agents[Number(reverse)]).actions.ranged;
      const frame = authoredFrame(animation, animation.launchAtMs ?? 200);
      await stage.prepare(trial); stage.render(trial, 0, true);
      startAttack(trial, shooter);
      for (const launch of Array.from({ length: shooter.stats.hitCount }, (_, index) => shooter.attack.startedAt + shooter.stats.windup + index * shooter.stats.hitGap)) {
        at(trial, launch); calls.length = 0;
        const before = JSON.stringify(trial.agents);
        stage.render({ ...trial, time: launch }, launch * 1000, true);
        const draw = calls.find(call => call.key === "drawImage" && call.args[0]?.src === animation.image);
        assert.ok(draw, tribe + " approved shoot art is rendered");
        assert.deepEqual(draw.args.slice(1, 5), [frame % animation.columns * animation.frameSize,
          Math.floor(frame / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize]);
        assert.equal(JSON.stringify(trial.agents), before, "rendering does not change simulation state");
      }
    }
  } finally {
    globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets; globalThis.document = saved.document;
  }
});
