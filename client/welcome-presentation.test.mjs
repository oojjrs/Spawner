import test from "node:test";
import assert from "node:assert/strict";
import { WELCOME_UNIT_APPEARANCES, welcomeUnitPerformance, createWelcomeRoster, welcomeCreatureScale, prepareWelcomeChoice, welcomeTravelMotion, drawWelcomeChoice } from "./welcome-presentation.mjs";
import { CREATURE_IDLE_ANIMATIONS, unitMovementPosition, creatureAnimationSpeed, unitAnimationPose } from "./unit-animation.mjs";
import { unitStats } from "../server/attributes.mjs";
import { unitActionArtDefinition, unitActionArtPose } from "./unit-action-art.mjs";
import { UNIT_ACTION_ART } from "./unit-action-art-assets.mjs";

test("opening base forms consume four identities from a full appearance bag", () => {
  let seed = 37;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const tribes = ["bean", "spore", "pebble", "spring"];
  const species = ["boar", "toad", "weasel", "white-paw"];
  const expected = [...tribes.flatMap(key => WELCOME_UNIT_APPEARANCES.map((_, variant) => key + ":" + variant)), ...species.map(key => key + ":0")].sort();
  const next = createWelcomeRoster(tribes, species, WELCOME_UNIT_APPEARANCES.length, random);
  const choices = Array.from({ length: expected.length * 40 }, next);
  const identities = choices.map(choice => choice.key + ":" + choice.variant);
  assert.deepEqual(choices.slice(0, 4), tribes.map(key => ({ key, variant: 0 })));
  assert.deepEqual(identities.slice(4, expected.length).sort(), expected.filter(identity => !tribes.some(key => identity === key + ":0")));
  for (let i = 0; i < choices.length; i += expected.length)
    assert.deepEqual(identities.slice(i, i + expected.length).sort(), expected);
  for (let i = 4; i < choices.length; i++) {
    assert.notEqual(identities[i], identities[i - 1]);
    assert.notEqual(identities[i], identities[i - 2]);
    const recent = choices.slice(i - 2, i).map(choice => choice.key);
    const remaining = choices.slice(i, Math.ceil((i + 1) / expected.length) * expected.length);
    if (remaining.some(choice => !recent.includes(choice.key))) assert.ok(!recent.includes(choices[i].key));
  }
});

test("creatures keep their relative sizes while tall poses fit the mobile header", () => {
  const idle = { frameSize: 300, pivotY: 270, registrationScale: 1.2 };
  const bounds = { width: 220, height: 100 };
  const small = welcomeCreatureScale(idle, bounds, 170, .52, 330, 204);
  const weasel = welcomeCreatureScale(idle, bounds, 170, .72, 330, 204);
  const leader = welcomeCreatureScale(idle, bounds, 100, 1.44, 330, 204);
  assert.ok(weasel > small);
  assert.ok(leader > weasel);
  assert.ok(leader * idle.registrationScale * (idle.pivotY - 100) / idle.frameSize <= 168 + 1e-6);
});

test("all 63 appearance identities complete every round across different shuffle seeds", () => {
  const tribes = ["bean", "spore", "pebble", "spring"];
  const species = [...Object.keys(CREATURE_IDLE_ANIMATIONS), "talon-owl", "spiny-back-beetle"];
  const expected = [...tribes.flatMap(key => WELCOME_UNIT_APPEARANCES.map((_, variant) => key + ":" + variant)), ...species.map(key => key + ":0")].sort();
  assert.equal(expected.length, 63);
  const initialOrders = new Set();
  for (const initialSeed of [37, 749, 123456]) {
    let seed = initialSeed;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const next = createWelcomeRoster(tribes, species, WELCOME_UNIT_APPEARANCES.length, random);
    const choices = Array.from({ length: expected.length * 12 }, next);
    const identities = choices.map(choice => choice.key + ":" + choice.variant);
    assert.deepEqual(choices.slice(0, 4), tribes.map(key => ({ key, variant: 0 })));
    const remainder = choices.slice(4, expected.length);
    assert.equal(remainder.filter(choice => tribes.includes(choice.key) && choice.variant > 0).length, 40);
    assert.deepEqual(remainder.filter(choice => species.includes(choice.key)).map(choice => choice.key).sort(), [...species].sort());
    assert.deepEqual(identities.slice(4, expected.length).sort(), expected.filter(identity => !tribes.some(key => identity === key + ":0")));
    initialOrders.add(identities.slice(4, expected.length).join(","));
    for (let start = 0; start < choices.length; start += expected.length) assert.deepEqual(identities.slice(start, start + expected.length).sort(), expected);
    for (let i = 4; i < choices.length; i++) {
      assert.notEqual(identities[i], identities[i - 1]);
      assert.notEqual(identities[i], identities[i - 2]);
      const recent = choices.slice(i - 2, i).map(choice => choice.key);
      const remaining = choices.slice(i, Math.ceil((i + 1) / expected.length) * expected.length);
      if (remaining.some(choice => !recent.includes(choice.key))) assert.ok(!recent.includes(choices[i].key));
    }
  }
  assert.equal(initialOrders.size, 3);
});

test("welcome movement keeps exact cue stamps and exposes the final landing cell", () => {
  const model = { unitStats, creatureAnimationSpeed, unitMovementPosition };
  for (const key of ["bean", "spore", "spring-keeper", "talon-owl"]) {
    const request = { key, attributes: {}, width: 480, size: 184, elapsedMs: 0, timeline: 91.1,
      startedAt: 91.1, phase: "enter", reducedMotion: false, id: "cue-unit" };
    const first = welcomeTravelMotion(model, request);
    const next = welcomeTravelMotion(model, { ...request, elapsedMs: 16, timeline: 91.11600000000001 });
    assert.equal(first.agent.moveStartedAt, request.startedAt);
    assert.equal(next.agent.moveStartedAt, first.agent.moveStartedAt);
    assert.equal(next.agent.flightStartedAt, first.agent.flightStartedAt);
    const duration = first.durationMs;
    const final = welcomeTravelMotion(model, { ...request, elapsedMs: duration, timeline: request.startedAt + duration / 1000 });
    assert.ok(final.agent.moveDuration > 0);
    assert.equal(final.agent.mode, "walk");
    assert.ok(Math.abs(final.x - request.width / 2) < .00001);
    const end = final.agent.moveStartedAt + final.agent.moveDuration;
    assert.ok(Math.abs(end - (request.startedAt + duration / 1000)) < 1e-12);
    assert.ok(Math.abs(unitMovementPosition(final.agent, end, false).progress - 1) < 1e-10);
  }
});


test("an unavailable appearance retries its own assets without changing identity", async () => {
  const calls = [], errors = [];
  const selected = Object.freeze({ key: "pebble", variant: 2 });
  const choice = await prepareWelcomeChoice(selected, async value => {
    calls.push(value);
    if (calls.length === 1) throw new Error("rig unavailable");
  }, { onError: error => errors.push(error) });
  assert.equal(choice, selected);
  assert.deepEqual(calls, [selected, selected]);
  assert.equal(errors.length, 1);
  assert.equal(await prepareWelcomeChoice(selected, async () => { throw new Error("404"); }), null);
});

test("a never-settling appearance releases the rotation without substituting base art", async () => {
  const calls = [];
  const choice = Object.freeze({ key: "pebble", variant: 2 });
  assert.equal(await prepareWelcomeChoice(choice, value => {
    calls.push(value);
    return new Promise(() => {});
  }, { timeoutMs: 5 }), null);
  assert.deepEqual(calls, [choice, choice]);
});

test("a failed pose uses a fallback pose of the same immutable appearance", () => {
  const choice = createWelcomeRoster(["pebble"], [], 4, () => 0)();
  assert.ok(Object.isFrozen(choice));
  assert.throws(() => { choice.variant = 2; }, TypeError);
  const attempts = [], failures = [];
  const variant = Object.freeze({ key: "pebble", variant: 2 });
  const drawn = drawWelcomeChoice(variant, candidate => {
    attempts.push(candidate);
    throw new Error("jump rasterization failed");
  }, { fallback: candidate => attempts.push(candidate), onError: error => failures.push(error) });
  assert.equal(drawn, variant);
  assert.deepEqual(attempts, [variant, variant]);
  assert.equal(failures.length, 1);
  assert.equal(drawWelcomeChoice(variant, () => { throw new Error("jump"); }, {
    fallback: () => { throw new Error("idle"); }
  }), null);
  assert.equal(variant.variant, 2);
  const next = Object.freeze({ key: "spring", variant: 1 });
  assert.equal(drawWelcomeChoice(next, () => {}), next);
});


test("welcome tribe forms preserve native facing across entry, action and exit", () => {
  const model = { unitStats, creatureAnimationSpeed, unitMovementPosition };
  const variants = WELCOME_UNIT_APPEARANCES;
  for (const key of ["bean", "spore", "pebble", "spring"]) for (const attributes of variants)
    for (const phase of ["enter", "perform", "rest", "exit"]) {
      const motion = welcomeTravelMotion(model, { key, attributes, width: 480, size: 146, worldPixels: 364,
        elapsedMs: 250, timeline: 10.25, startedAt: 10, phase, reducedMotion: false, id: "native-facing" });
      assert.equal(motion.agent.facing, 1);
      assert.equal(motion.cell, 364);
      assert.deepEqual(motion.agent.attributes, attributes);
    }
  const neutral = welcomeTravelMotion(model, { key: "talon-owl", attributes: {}, width: 480, size: 146, worldPixels: 364,
    elapsedMs: 250, timeline: 10.25, startedAt: 10, phase: "enter", reducedMotion: false, id: "native-flight" });
  assert.equal(neutral.agent.facing, -1);
});

test("slow welcome entries and exits keep walking between native cell moves", () => {
  const model = { unitStats, creatureAnimationSpeed, unitMovementPosition };
  for (const key of ["spore", "pebble", "spring"]) for (const phase of ["enter", "exit"]) {
    for (const elapsedMs of [1150, 1450, 1750, 2150, 2450]) {
      const motion = welcomeTravelMotion(model, { key, attributes: {}, width: 480, size: 100, worldPixels: 144,
        elapsedMs, timeline: 20 + elapsedMs / 1000, startedAt: 20, phase, reducedMotion: false, id: "continuous" });
      assert.ok(motion.agent.moveStartedAt + motion.agent.moveDuration > 20 + elapsedMs / 1000);
      assert.equal(unitAnimationPose(motion.agent, 20 + elapsedMs / 1000).action, "walk");
      assert.ok(motion.position.progress < 1);
      assert.equal(motion.agent.moveAnimationStartedAt, 20);
    }
  }
});

test("welcome entry and exit share native pose clocks and finish fully landed", () => {
  const model = { unitStats, creatureAnimationSpeed, unitMovementPosition };
  for (const key of ["bean", "spore", "pebble", "spring", "talon-owl", "old-garden-snail"]) {
    const request = { key, attributes: {}, width: 480, size: 100, worldPixels: 144, elapsedMs: 0,
      timeline: 30, startedAt: 30, reducedMotion: false, id: "same-pose" };
    const start = welcomeTravelMotion(model, { ...request, phase: "enter" });
    for (const ratio of [0, .17, .39, .64, .99, 1]) {
      const sample = { ...request, elapsedMs: start.durationMs * ratio, timeline: 30 + start.durationMs * ratio / 1000 };
      const enter = welcomeTravelMotion(model, { ...sample, phase: "enter" });
      const exit = welcomeTravelMotion(model, { ...sample, phase: "exit" });
      assert.deepEqual(enter.agent, exit.agent);
      assert.equal(enter.durationMs, exit.durationMs);
      assert.ok(Math.abs(enter.x - exit.x - (start.x - request.width / 2)) < 1e-8);
      if (ratio === 1) { assert.ok(Math.abs(enter.x - 240) < 1e-8); assert.ok(Math.abs(enter.position.progress - 1) < 1e-8); }
    }
  }
});

test("welcome forms select their own registered body and perform only authored actions", () => {
  const forms = ["base", "gather", "feet", "antenna", "blade", "secretion", "carapace", "blade-carapace", "secretion-carapace", "blade-secretion", "blade-secretion-carapace"];
  assert.equal(WELCOME_UNIT_APPEARANCES.length, forms.length);
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const [variant, attributes] of WELCOME_UNIT_APPEARANCES.entries()) {
    const agent = { tribe, attributes, health: 1 };
    const definition = UNIT_ACTION_ART[tribe + "/" + forms[variant]];
    assert.equal(unitActionArtDefinition(agent), definition);
    const performance = welcomeUnitPerformance(agent, 10);
    const pose = unitActionArtPose(performance.agent, 10.001);
    assert.notEqual(performance.agent.mode, "jump");
    assert.equal(performance.agent.jumpStartedAt, undefined);
    assert.equal(pose.animation, definition.actions[performance.action] || definition.reference);
    assert.equal(performance.durationMs, pose.animation.durationsMs.reduce((sum, value) => sum + value, 0));
    assert.equal(performance.agent.attributes, attributes);
    assert.equal(agent.mode, undefined);
  }
});
