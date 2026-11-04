import test from "node:test";
import assert from "node:assert/strict";
import { createWelcomeRoster, welcomeCreatureScale, prepareWelcomeChoice, welcomeTravelMotion } from "./welcome-presentation.mjs";
import { CREATURE_IDLE_ANIMATIONS, unitMovementPosition, creatureAnimationSpeed } from "./unit-animation.mjs";
import { unitStats } from "../server/attributes.mjs";

test("opening base forms consume four identities from a full appearance bag", () => {
  let seed = 37;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const tribes = ["bean", "spore", "pebble", "spring"];
  const species = ["boar", "toad", "weasel", "white-paw"];
  const expected = [...tribes.flatMap(key => [0, 1, 2, 3].map(variant => key + ":" + variant)), ...species.map(key => key + ":0")].sort();
  const next = createWelcomeRoster(tribes, species, 4, random);
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

test("all 35 appearance identities complete every round across different shuffle seeds", () => {
  const tribes = ["bean", "spore", "pebble", "spring"];
  const species = [...Object.keys(CREATURE_IDLE_ANIMATIONS), "talon-owl", "spiny-back-beetle"];
  const expected = [...tribes.flatMap(key => [0, 1, 2, 3].map(variant => key + ":" + variant)), ...species.map(key => key + ":0")].sort();
  assert.equal(expected.length, 35);
  const initialOrders = new Set();
  for (const initialSeed of [37, 749, 123456]) {
    let seed = initialSeed;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const next = createWelcomeRoster(tribes, species, 4, random);
    const choices = Array.from({ length: 35 * 12 }, next);
    const identities = choices.map(choice => choice.key + ":" + choice.variant);
    assert.deepEqual(choices.slice(0, 4), tribes.map(key => ({ key, variant: 0 })));
    const remainder = choices.slice(4, 35);
    assert.equal(remainder.filter(choice => tribes.includes(choice.key) && choice.variant > 0).length, 12);
    assert.deepEqual(remainder.filter(choice => species.includes(choice.key)).map(choice => choice.key).sort(), [...species].sort());
    assert.deepEqual(identities.slice(4, 35).sort(), expected.filter(identity => !tribes.some(key => identity === key + ":0")));
    initialOrders.add(identities.slice(4, 35).join(","));
    for (let start = 0; start < choices.length; start += 35) assert.deepEqual(identities.slice(start, start + 35).sort(), expected);
    for (let i = 4; i < choices.length; i++) {
      assert.notEqual(identities[i], identities[i - 1]);
      assert.notEqual(identities[i], identities[i - 2]);
      const recent = choices.slice(i - 2, i).map(choice => choice.key);
      const remaining = choices.slice(i, Math.ceil((i + 1) / 35) * 35);
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


test("failed antenna rig falls back to loaded basic art without stopping later choices", async () => {
  const calls=[],errors=[];
  const choice=await prepareWelcomeChoice({key:"pebble",variant:2},async value=>{calls.push(value.variant);if(value.variant)throw new Error("rig unavailable")},{onError:error=>errors.push(error)});
  assert.deepEqual(choice,{key:"pebble",variant:0});assert.deepEqual(calls,[2,0]);assert.equal(errors.length,1);
  assert.deepEqual(await prepareWelcomeChoice({key:"spring",variant:1},async()=>{}),{key:"spring",variant:1});
});
test("rejected neutral sources can retry, and permanently unavailable ones can be skipped",async()=>{
  let calls=0;
  assert.equal((await prepareWelcomeChoice({key:"dew-rabbit",variant:0},async()=>{if(++calls===1)throw new Error("decode") })).key,"dew-rabbit");
  assert.equal(await prepareWelcomeChoice({key:"soil-mole",variant:0},async()=>{throw new Error("404")}),null);
});
test("a never-settling lazy source releases the rotation after its deadline",async()=>{
  const value=await prepareWelcomeChoice({key:"pebble",variant:2},v=>v.variant?new Promise(()=>{}):Promise.resolve(),{timeoutMs:5});
  assert.equal(value.variant,0);
});
