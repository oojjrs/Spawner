import test from "node:test";
import assert from "node:assert/strict";
import { createSimulationTrial } from "./combat-simulation.mjs";
import { attackAnimationElapsed, AGENT_ATTACK_HIT_TIME } from "../server/attack.mjs";
import { UNIT_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, unitAnimationPose, unitAnimationFrame, creatureAttackPose } from "./unit-animation.mjs";
import { CREATURE_ATTACK_TIMINGS } from "../server/creature-attack.mjs";
import { BEETLE_ANIMATIONS, BEETLE_ATTACK_SPRITE, beetleAnimationPose } from "../server/beetle-animation.mjs";
import { unitActionArtDefinition } from "./unit-action-art.mjs";
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
function startAttack(trial, source) {
  while (!source.attack && trial.time < 20 && !trial.reason) trial.advance(.01);
  assert.ok(source.attack, "source reaches attack range within 20 simulated seconds");
  return source.attack;
}

function authoredFrame(animation, atMs) {
  let elapsed = atMs, index = 0;
  while (index < animation.durationsMs.length - 1 && elapsed + 1e-7 >= animation.durationsMs[index]) elapsed -= animation.durationsMs[index++];
  return animation.frames?.[index] ?? index;
}

function clip(key) {
  if (key === "spiny-back-beetle") return { animation: BEETLE_ATTACK_SPRITE,
    hit: BEETLE_ANIMATIONS.attack.hitTimeMs / 1000, duration: BEETLE_ANIMATIONS.attack.durationMs / 1000, frame: 3 };
  const animation = UNIT_ANIMATIONS[key]?.attack || CREATURE_ATTACK_ANIMATIONS[key];
  const hit = tribes.includes(key) ? AGENT_ATTACK_HIT_TIME : CREATURE_ATTACK_TIMINGS[key].hitTimeMs / 1000;
  return { animation, hit, duration: animation.durationMs / 1000, frame: unitAnimationFrame(animation, hit * 1000) };
}
function pose(agent, time) {
  if (!tribes.includes(agent.key)) agent = { ...agent, species: agent.key };
  return agent.species === "spiny-back-beetle" ? beetleAnimationPose(agent, time) :
    creatureAttackPose(agent, time) || unitAnimationPose(agent, time);
}

test("laboratory melee contacts retain the impact pose and then recover for every hit", () => {
  for (const key of keys) for (const reverse of [false, true])
    for (const counts of [{}, { multiHit: 3 }, { multiHit: 7, focus: 20, hitSpeed: 20, haste: 20 }]) {
      const trial = fixture(key, reverse, counts), source = trial.agents[Number(reverse)], animation = clip(key);
      startAttack(trial, source);
      const attack = source.attack, start = attack.startedAt;
      const contacts = Array.from({ length: source.stats.hitCount }, (_, index) => start + source.stats.windup + index * source.stats.hitGap);
      assert.deepEqual(attack.meleeContacts, contacts.slice(0, 1));
      for (const [index, contact] of contacts.entries()) {
        at(trial, contact + 1 / 60);
        assert.equal(source.attack, attack, "all hits belong to one action");
        assert.equal(attack.startedAt, start, "a follow-up must not reset the action epoch");
        assert.equal(attack.meleeContacts.length, Math.min(contacts.length, index + 2));
        attack.meleeContacts.forEach((at, hit) => near(at, contacts[hit]));
        near(attackAnimationElapsed(attack, contact, animation.hit, animation.duration), animation.hit);
        assert.equal(pose(source, contact).action, "attack");
        assert.equal(pose(source, contact).frame, animation.frame, key + " contact " + index);
        const recoveryEnd = index + 1 < contacts.length ? contact + source.stats.hitGap *
          (animation.duration - animation.hit) / animation.duration : attack.endsAt;
        at(trial, contact + (recoveryEnd - contact) * .5);
        assert.ok(attackAnimationElapsed(attack, trial.time, animation.hit, animation.duration) > animation.hit);
        near(attackAnimationElapsed(JSON.parse(JSON.stringify(attack)), trial.time, animation.hit, animation.duration),
          attackAnimationElapsed(attack, trial.time, animation.hit, animation.duration));
      }
      const hits = trial.history.filter(row => row.attackerId === source.id && row.kind === "hit");
      assert.equal(hits.length, contacts.length);
      hits.forEach((row, index) => near(row.time, contacts[index]));
      assert.deepEqual(hits.map(row => row.hitIndex), contacts.map((_, index) => index));
    }
});

test("new actions replace the melee clock and a time limit freezes queued contacts", () => {
  const trial = fixture("bean", false, { multiHit: 3 });
  const source = trial.agents[0], first = startAttack(trial, trial.agents[0]);
  at(trial, source.combat.nextAttackAt + 1 / 60);
  startAttack(trial, source);
  assert.notEqual(source.attack, first);
  assert.ok(source.attack.meleeContacts[0] > first.meleeContacts.at(-1));
  at(trial, source.attack.hitAt);
  assert.equal(pose(source, trial.time).frame, 5);
  const stopped = fixture("spring", false, { multiHit: 7 }, { maxSeconds: .4 });
  for (const unit of stopped.agents) Object.assign(unit.combat.position,
    { x: unit.combat.side ? .4 : -.4, y: 0, fromX: unit.combat.side ? .4 : -.4, fromY: 0 });
  const pending = startAttack(stopped, stopped.agents[0]);
  assert.ok(pending.endsAt > .4, "the time limit interrupts a pending combo");
  at(stopped, .4);
  assert.equal(stopped.reason, "time-limit");
  assert.ok(pending.hitAt > stopped.time, "the remaining contact is beyond the frozen time");
  const history = structuredClone(stopped.history), agents = structuredClone(stopped.agents), result = stopped.result();
  stopped.advance(1);
  assert.deepEqual(stopped.history, history);
  assert.deepEqual(stopped.agents, agents);
  assert.deepEqual(stopped.result(), result);
});

async function withStage(run, reduced) {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets, document: globalThis.document };
  globalThis.window = { matchMedia: () => ({ matches: reduced }), devicePixelRatio: 1 };
  globalThis.Image = class { complete = true; naturalWidth = 4096; naturalHeight = 4096; async decode() {} };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData(x,y,width,height) { return { data: new Uint8ClampedArray(width * height * 4).fill(255) }; } }) }) };
  globalThis.SpawnerAssets = { source: path => path };
  try {
    const calls = [], stack = []; let position = [0, 0];
    const context = new Proxy({
      save() { stack.push([...position]); }, restore() { position = stack.pop(); },
      setTransform() { position = [0, 0]; },
      translate(x, y) { position[0] += x; position[1] += y; },
      drawImage(...args) { calls.push({ key: "drawImage", args, position: [...position] }); }
    }, { get: (target, key) => target[key] || ((...args) => calls.push({ key, args })) });
    const stage = createCombatStage({ clientWidth: 1040, clientHeight: 480, getContext: () => context });
    await run({ stage, calls });
  } finally { globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets; globalThis.document = saved.document; }
}
function bodyDraw(calls, animation, side) {
  const draws = calls.map((call, index) => ({ ...call, index })).filter(call =>
    call.key === "drawImage" && call.args[0]?.src === animation.image);
  const draw = draws.length === 2 ? draws[side] : draws[0];
  assert.ok(draw, "the approved attack sheet is drawn");
  return { draw, position: draw.position };
}

test("the actual stage draws each combo contact cell and preserves the arena position", async () => {
  for (const key of keys) for (const reverse of [false, true]) await withStage(async ({ stage, calls }) => {
    const trial = fixture(key, reverse, { multiHit: 3 }), source = trial.agents[Number(reverse)];
    const animation = tribes.includes(key) ? unitActionArtDefinition(source).actions.attack : clip(key).animation;
    const frame = tribes.includes(key) ? authoredFrame(animation, animation.hitTimeMs ?? 300) : clip(key).frame;
    await stage.prepare(trial); stage.render(trial, 0, true); startAttack(trial, source);
    const contacts = Array.from({ length: 4 }, (_, index) => source.attack.startedAt + source.stats.windup + index * source.stats.hitGap);
    let contactPosition;
    for (const contact of contacts) {
      at(trial, contact); calls.length = 0;
      const before = JSON.stringify(trial.agents);
      stage.render({ ...trial, time: contact }, contact * 1000, true);
      const { draw, position } = bodyDraw(calls, animation, Number(reverse));
      assert.deepEqual(draw.args.slice(1, 5), [frame % animation.columns * animation.frameSize,
        Math.floor(frame / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize]);
      if (contactPosition) position.forEach((value, i) => near(value, contactPosition[i]));
      contactPosition = position;
      assert.equal(JSON.stringify(trial.agents), before, "rendering cannot change gameplay state");
      // Every hit, including one that just scheduled another, begins recovery
      // from contact rather than teleporting to the next windup.
      at(trial, contact + .001); calls.length = 0;
      stage.render({ ...trial, time: contact + .001 }, (contact + .001) * 1000, true);
      const recovery = bodyDraw(calls, animation, Number(reverse)).position;
      assert.ok(Math.abs(recovery[0] - contactPosition[0]) < 1.2, "recovery starts continuously from contact");
    }
  });
});

test("stage combo root motion keeps legacy single-hit endpoints and respects reduced motion", async () => {
  for (const reduced of [false, true]) await withStage(async ({ stage, calls }) => {
    const trial = fixture("spring", false, { multiHit: 3 }), source = trial.agents[0];
    const animation = unitActionArtDefinition(source).actions.attack;
    const action = startAttack(trial, source);
    at(trial, action.hitAt); await stage.prepare(trial); stage.render(trial, trial.time * 1000, true);
    const comboPosition = bodyDraw(calls, animation, 0).position;
    const original = source.attack;
    source.attack = { ...original, startedAt: original.startedAt, hitAt: trial.time, endsAt: original.endsAt };
    delete source.attack.meleeContacts; calls.length = 0;
    stage.render(trial, trial.time * 1000, true);
    const singlePosition = bodyDraw(calls, animation, 0).position;
    comboPosition.forEach((value, index) => near(value, singlePosition[index]));
  }, reduced);
});
