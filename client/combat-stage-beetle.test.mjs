import test from "node:test";
import assert from "node:assert/strict";
import { createCombatStage } from "./combat-stage.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";
import { BEETLE_SPRITE, BEETLE_ATTACK_SPRITE, beetleAnimationPose } from "../server/beetle-animation.mjs";

function withStage(run) {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets };
  const calls = [];
  globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
  globalThis.Image = class {
    set src(value) { this.source = value; this.complete = true; }
    get src() { return this.source; }
    get naturalWidth() { return 4096; }
    get naturalHeight() { return 4096; }
  };
  globalThis.SpawnerAssets = { source: path => path };
  const context = new Proxy({}, { get: (target, key) => target[key] || ((...args) => calls.push({ name: key, args })) });
  const stage = createCombatStage({ clientWidth: 1040, clientHeight: 480, getContext: () => context });
  let now = 100;
  const draw = trial => {
    calls.length = 0; stage.render(trial, now, false); now += 100;
    const bodies = calls.filter(call => call.name === "drawImage" &&
      [BEETLE_SPRITE.image, BEETLE_ATTACK_SPRITE.image].includes(call.args[0]?.src));
    assert.equal(bodies.length, 1, "exactly one beetle body is drawn");
    return bodies[0];
  };
  try { run({ draw, stage }); }
  finally {
    globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets;
  }
}

function scene() {
  const beetle = { id: "left", species: "spiny-back-beetle", health: 100, mode: "attack", facing: 1,
    stats: { health: 100 }, combat: { version: 2, side: 0, stunnedUntil: 0 }, animationStartedAt: .2 };
  const target = { id: "right", tribe: "bean", health: 100, mode: "fight", facing: -1,
    stats: { health: 100 }, combat: { version: 2, side: 1, stunnedUntil: 0 } };
  return { beetle, trial: { agents: [beetle, target], history: [], projectiles: [], time: .2, result: () => null } };
}

function assertPose(draw, trial, beetle, label) {
  const expected = beetleAnimationPose(beetle, trial.time);
  const sprite = expected.action === "attack" ? BEETLE_ATTACK_SPRITE : BEETLE_SPRITE;
  const actual = draw(trial).args;
  assert.equal(actual[0].src, sprite.image, label + " sheet");
  assert.equal(actual[1], expected.frame % sprite.columns * sprite.frameSize, label + " source x");
  assert.equal(actual[2], Math.floor(expected.frame / sprite.columns) * sprite.frameSize, label + " source y");
  return expected;
}

test("laboratory beetle contact uses authoritative fast and slow attack timing", () => {
  for (const [windup, recovery] of [[.08, .3], [.3, .3], [1.6, .8]]) withStage(({ draw }) => {
    const { beetle, trial } = scene();
    beetle.attack = { combatId: "simulation", startedAt: .2, hitAt: .2 + windup,
      endsAt: .2 + windup + recovery, directionX: 1, speed: 1 };
    for (const elapsed of [0, windup / 2, windup - .001, windup, windup + recovery / 2, windup + recovery - .001]) {
      trial.time = .2 + elapsed;
      const pose = assertPose(draw, trial, beetle, `${windup}/${recovery} at ${elapsed}`);
      if (elapsed === windup) assert.equal(pose.frame, 3, "the contact cell coincides with hitAt");
    }
  });
});

test("stale or future beetle attacks do not override idle, and active attacks retain hurt priority rules", () => {
  withStage(({ draw }) => {
    const { beetle, trial } = scene();
    beetle.attack = { combatId: "simulation", startedAt: 1, hitAt: 1.08, endsAt: 1.38, directionX: 1 };
    for (const time of [.5, 1.08, 1.38, 1.5]) {
      trial.time = time;
      const expected = assertPose(draw, trial, beetle, `stale/future ${time}`);
      assert.equal(expected.action, time === 1.08 ? "attack" : "idle");
    }
    beetle.attack = { combatId: "simulation", startedAt: 2, hitAt: 2.08, endsAt: 2.38, directionX: 1 };
    beetle.hurtStartedAt = 2.04; trial.time = 2.08;
    assert.equal(assertPose(draw, trial, beetle, "attack retains priority").action, "attack");
    beetle.attack = null; trial.time = 2.1;
    assert.equal(assertPose(draw, trial, beetle, "hurt after cancellation").action, "hurt");
  });
});

test("actual simulation beetle impact cells match the journal without changing combat", () => {
  withStage(({ draw }) => {
    const settings = { left: { key: "spiny-back-beetle", counts: { focus: 11, vitality: 5 } },
      right: { key: "bean", counts: { vitality: 5 } }, random: false };
    const trial = createSimulationTrial(settings), control = createSimulationTrial(settings);
    draw(trial);
    trial.advance(.08); control.advance(.08);
    const beetle = trial.agents[0];
    assert.equal(beetle.attack.hitAt, .08);
    assert.ok(trial.history.some(event => event.attackerId === beetle.id && event.time === .08 && event.damage > 0));
    assert.equal(assertPose(draw, trial, beetle, "real contact").frame, 3);
    assert.deepEqual(trial.history, control.history);
    assert.deepEqual(trial.agents, control.agents);
    assert.deepEqual(trial.result(), control.result());
  });
});
