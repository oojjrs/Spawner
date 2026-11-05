import test from "node:test";
import assert from "node:assert/strict";
import { createSimulationTrial } from "./combat-simulation.mjs";
import { attackAnimationElapsed, AGENT_ATTACK_HIT_TIME } from "../server/attack.mjs";
import { UNIT_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, unitAnimationPose, unitAnimationFrame, creatureAttackPose } from "./unit-animation.mjs";
import { CREATURE_ATTACK_TIMINGS } from "../server/creature-attack.mjs";
import { BEETLE_ANIMATIONS, BEETLE_ATTACK_SPRITE, beetleAnimationPose } from "../server/beetle-animation.mjs";
import { createCombatStage } from "./combat-stage.mjs";

const tribes = ["bean", "spore", "pebble", "spring"];
const keys = [...tribes, "spiny-back-beetle", "cotton-sheep", "bubble-toad", "soil-boar"];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function fixture(key, reverse = false, counts = {}, rules = {}) {
  const source = { key, counts: { vitality: 80, ...counts } };
  const target = { key: "bean", organs: { attack: 0, ranged: 0 }, counts: { vitality: 80 } };
  return createSimulationTrial({ left: reverse ? target : source, right: reverse ? source : target,
    first: reverse ? "right" : "left", distance: 1, random: false, rules });
}
const at = (trial, time) => trial.advance(Math.max(0, time - trial.time));
function clip(key) {
  if (key === "spiny-back-beetle") return { animation: BEETLE_ATTACK_SPRITE,
    hit: BEETLE_ANIMATIONS.attack.hitTimeMs / 1000, duration: BEETLE_ANIMATIONS.attack.durationMs / 1000, frame: 3 };
  const animation = UNIT_ANIMATIONS[key]?.attack || CREATURE_ATTACK_ANIMATIONS[key];
  const hit = tribes.includes(key) ? AGENT_ATTACK_HIT_TIME : CREATURE_ATTACK_TIMINGS[key].hitTimeMs / 1000;
  return { animation, hit, duration: animation.durationMs / 1000, frame: unitAnimationFrame(animation, hit * 1000) };
}
function pose(agent, time) {
  return agent.species === "spiny-back-beetle" ? beetleAnimationPose(agent, time) :
    creatureAttackPose(agent, time) || unitAnimationPose(agent, time);
}

test("laboratory melee contacts retain the impact pose and then recover for every hit", () => {
  for (const key of keys) for (const reverse of [false, true])
    for (const counts of [{}, { multiHit: 3 }, { multiHit: 7, focus: 20, hitSpeed: 20, haste: 20 }]) {
      const trial = fixture(key, reverse, counts), source = trial.agents[Number(reverse)], animation = clip(key);
      at(trial, .001);
      const attack = source.attack, start = attack.startedAt;
      const contacts = Array.from({ length: source.stats.hitCount }, (_, index) => start + source.stats.windup + index * source.stats.hitGap);
      assert.deepEqual(attack.meleeContacts, contacts.slice(0, 1));
      for (const [index, contact] of contacts.entries()) {
        at(trial, contact);
        assert.equal(source.attack, attack, "all hits belong to one action");
        assert.equal(attack.startedAt, start, "a follow-up must not reset the action epoch");
        assert.deepEqual(attack.meleeContacts, contacts.slice(0, Math.min(contacts.length, index + 2)));
        near(attackAnimationElapsed(attack, trial.time, animation.hit, animation.duration), animation.hit);
        assert.equal(pose(source, trial.time).action, "attack");
        assert.equal(pose(source, trial.time).frame, animation.frame, key + " contact " + index);
        const recoveryEnd = index + 1 < contacts.length ? contact + source.stats.hitGap *
          (animation.duration - animation.hit) / animation.duration : attack.endsAt;
        at(trial, contact + (recoveryEnd - contact) * .5);
        assert.ok(attackAnimationElapsed(attack, trial.time, animation.hit, animation.duration) > animation.hit);
        near(attackAnimationElapsed(JSON.parse(JSON.stringify(attack)), trial.time, animation.hit, animation.duration),
          attackAnimationElapsed(attack, trial.time, animation.hit, animation.duration));
      }
      const hits = trial.history.filter(row => row.attackerId === source.id && row.kind === "hit");
      assert.deepEqual(hits.map(row => row.time), contacts);
      assert.deepEqual(hits.map(row => row.hitIndex), contacts.map((_, index) => index));
    }
});

test("new actions replace the melee clock and cancellation cannot replay queued contacts", () => {
  const trial = fixture("bean", false, { multiHit: 3 });
  at(trial, .001);
  const source = trial.agents[0], first = source.attack;
  at(trial, source.combat.nextAttackAt + .001);
  assert.notEqual(source.attack, first);
  assert.ok(source.attack.meleeContacts[0] > first.meleeContacts.at(-1));
  at(trial, source.attack.hitAt);
  assert.equal(pose(source, trial.time).frame, 5);
  const stopped = fixture("spring", false, { multiHit: 7 }, { maxSeconds: .4 });
  at(stopped, .4);
  assert.equal(stopped.reason, "time-limit");
  assert.equal(stopped.agents[0].attack, null);
  assert.equal(pose(stopped.agents[0], stopped.time).action, "idle");
  const history = structuredClone(stopped.history);
  stopped.advance(1);
  assert.deepEqual(stopped.history, history);
});

function withStage(run, reduced = false) {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets };
  globalThis.window = { matchMedia: () => ({ matches: reduced }), devicePixelRatio: 1 };
  globalThis.Image = class { complete = true; naturalWidth = 4096; naturalHeight = 4096; };
  globalThis.SpawnerAssets = { source: path => path };
  try {
    const calls = [], context = new Proxy({}, { get: (target, key) => target[key] || ((...args) => calls.push({ key, args })) });
    const stage = createCombatStage({ clientWidth: 1040, clientHeight: 480, getContext: () => context });
    run({ stage, calls });
  } finally { globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets; }
}
function bodyDraw(calls, animation, side) {
  const draws = calls.map((call, index) => ({ ...call, index })).filter(call =>
    call.key === "drawImage" && call.args[0]?.src === animation.image);
  const draw = draws.length === 2 ? draws[side] : draws[0];
  assert.ok(draw, "the approved attack sheet is drawn");
  const translated = calls.slice(0, draw.index).findLast(call => call.key === "translate");
  return { draw, position: translated.args };
}

test("the actual stage draws each combo contact cell and reaches the same lunge position", () => {
  for (const key of keys) for (const reverse of [false, true]) withStage(({ stage, calls }) => {
    const trial = fixture(key, reverse, { multiHit: 3 }), source = trial.agents[Number(reverse)], { animation, frame } = clip(key);
    stage.render(trial, 0, true); at(trial, .001);
    const contacts = Array.from({ length: 4 }, (_, index) => source.attack.startedAt + source.stats.windup + index * source.stats.hitGap);
    let contactPosition;
    for (const contact of contacts) {
      at(trial, contact); calls.length = 0;
      const before = JSON.stringify(trial.agents);
      stage.render(trial, contact * 1000, true);
      const { draw, position } = bodyDraw(calls, animation, Number(reverse));
      assert.deepEqual(draw.args.slice(1, 5), [frame % animation.columns * animation.frameSize,
        Math.floor(frame / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize]);
      if (contactPosition) position.forEach((value, i) => near(value, contactPosition[i]));
      contactPosition = position;
      assert.equal(JSON.stringify(trial.agents), before, "rendering cannot change gameplay state");
      // Every hit, including one that just scheduled another, begins recovery
      // from contact rather than teleporting to the next windup.
      at(trial, contact + .001); calls.length = 0;
      stage.render(trial, (contact + .001) * 1000, true);
      const recovery = bodyDraw(calls, animation, Number(reverse)).position;
      assert.ok(Math.abs(recovery[0] - contactPosition[0]) < 1.2, "recovery starts continuously from contact");
    }
  });
});

test("stage combo root motion keeps legacy single-hit endpoints and respects reduced motion", () => {
  for (const reduced of [false, true]) withStage(({ stage, calls }) => {
    const trial = fixture("spring", false, { multiHit: 3 }), source = trial.agents[0], { animation } = clip("spring");
    at(trial, .3); stage.render(trial, 300, true);
    const comboPosition = bodyDraw(calls, animation, 0).position;
    const original = source.attack;
    source.attack = { ...original, startedAt: original.actionStartedAt, hitAt: .3, endsAt: .6 };
    delete source.attack.meleeContacts; calls.length = 0;
    stage.render(trial, 300, true);
    const singlePosition = bodyDraw(calls, animation, 0).position;
    comboPosition.forEach((value, index) => near(value, singlePosition[index]));
  }, reduced);
});
