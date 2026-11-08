import { UNIT_COMBINATION_FORMS } from "./unit-combination-forms.mjs";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
import { WELCOME_UNIT_APPEARANCES, WELCOME_NEUTRAL_SHARE, WELCOME_IDLE_DURATION_MS, welcomeDisplaySize, welcomeUnitPerformance, createWelcomeRoster, welcomeCreatureScale, prepareWelcomeChoice, welcomeTravelMotion, drawWelcomeChoice } from "./welcome-presentation.mjs";
import { CREATURE_IDLE_ANIMATIONS, unitMovementPosition, creatureAnimationSpeed, unitAnimationPose } from "./unit-animation.mjs";
import { unitStats } from "../server/attributes.mjs";
import { unitActionArtDefinition, unitActionArtPose } from "./unit-action-art.mjs";
import { UNIT_ACTION_ART } from "./unit-action-art-assets.mjs";

const tribes = ["bean", "spore", "pebble", "spring"];
const species = [...Object.keys(CREATURE_IDLE_ANIMATIONS), "talon-owl", "spiny-back-beetle"];
const seeded = initial => { let seed=initial; return () => ((seed=(seed*1664525+1013904223)>>>0)/2**32); };
test("first four remain fixed and later categories favor neutral species independently of variant count", () => {
  assert.equal(WELCOME_NEUTRAL_SHARE,.8);
  for (const variants of [1, WELCOME_UNIT_APPEARANCES.length, 80]) for (const seed of [37,749,123456]) {
    const next=createWelcomeRoster(tribes,species,variants,seeded(seed));
    assert.deepEqual(Array.from({length:4},next),tribes.map(key=>({key,variant:0})));
    const choices=Array.from({length:10000},next),neutral=choices.filter(choice=>species.includes(choice.key));
    assert.ok(neutral.length>7800&&neutral.length<8200,variants+" variants: "+neutral.length);
    assert.ok(choices.every(choice=>Object.isFrozen(choice)));
  }
});
test("category threshold, duplicate inputs and missing categories have deterministic behavior",()=>{
  for(const [value,expected]of [[.799999,"neutral"],[.8,"playable"]]){
    const next=createWelcomeRoster([...tribes,"bean"],[...species,"bean",species[0]],17,()=>value);
    Array.from({length:4},next);for(let i=0;i<40;i++)assert.equal(tribes.includes(next().key),expected==="playable");
  }
  const onlyNeutral=createWelcomeRoster([],species,17,seeded(1));assert.ok(Array.from({length:100},onlyNeutral).every(choice=>species.includes(choice.key)));
  const onlyPlayable=createWelcomeRoster(tribes,[],17,seeded(1));assert.ok(Array.from({length:100},onlyPlayable).every(choice=>tribes.includes(choice.key)));
  assert.equal(createWelcomeRoster([],[],17,seeded(1))(),null);
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

test("independent bags retain all 87 identities and deterministic sequence diversity",()=>{
 const allPlayable=tribes.flatMap(key=>WELCOME_UNIT_APPEARANCES.map((_,variant)=>key+":"+variant)).sort();
 const firstPlayable=allPlayable.filter(identity=>!tribes.some(key=>identity===key+":0"));
 const orders=new Set();
 for(const seed of [37,749,123456]){
  const next=createWelcomeRoster(tribes,species,17,seeded(seed)),repeat=createWelcomeRoster(tribes,species,17,seeded(seed));
  const choices=Array.from({length:3000},next);assert.deepEqual(choices,Array.from({length:3000},repeat));
  const later=choices.slice(4),neutrals=later.filter(choice=>species.includes(choice.key)),players=later.filter(choice=>tribes.includes(choice.key));
  for(let i=0;i+species.length<=neutrals.length;i+=species.length)assert.deepEqual(neutrals.slice(i,i+species.length).map(choice=>choice.key).sort(),[...species].sort());
  assert.deepEqual(players.slice(0,firstPlayable.length).map(choice=>choice.key+":"+choice.variant).sort(),firstPlayable);
  for(let i=firstPlayable.length;i+allPlayable.length<=players.length;i+=allPlayable.length)assert.deepEqual(players.slice(i,i+allPlayable.length).map(choice=>choice.key+":"+choice.variant).sort(),allPlayable);
  assert.equal(new Set(choices.map(choice=>choice.key+":"+choice.variant)).size,87);
  orders.add(choices.slice(4,24).map(choice=>choice.key+":"+choice.variant).join(","));
 }
 assert.equal(orders.size,3);
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


test("welcome tribe forms face left along their entry and exit direction", () => {
  const model = { unitStats, creatureAnimationSpeed, unitMovementPosition };
  const variants = WELCOME_UNIT_APPEARANCES;
  for (const key of ["bean", "spore", "pebble", "spring"]) for (const attributes of variants)
    for (const phase of ["enter", "perform", "rest", "exit"]) {
      const motion = welcomeTravelMotion(model, { key, attributes, width: 480, size: 146, worldPixels: 364,
        elapsedMs: 250, timeline: 10.25, startedAt: 10, phase, reducedMotion: false, id: "native-facing" });
      assert.equal(motion.agent.facing, -1);
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
  const forms = ["base", "gather", "antenna", "blade", "secretion", "carapace", ...UNIT_COMBINATION_FORMS.map(form => form.key)];
  assert.equal(WELCOME_UNIT_APPEARANCES.length, forms.length);
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const [variant, attributes] of WELCOME_UNIT_APPEARANCES.entries()) {
    const agent = { tribe, attributes, health: 1 };
    const definition = UNIT_ACTION_ART[tribe + "/" + forms[variant]];
    assert.equal(unitActionArtDefinition(agent), definition);
    const performance = welcomeUnitPerformance(agent, 10);
    const pose = unitActionArtPose(performance.agent, 10.001);
    assert.equal(performance.action, "idle");
    assert.equal(performance.agent.mode, "idle");
    assert.equal(performance.agent.attack, null);
    assert.equal(performance.agent.jumpStartedAt, undefined);
    assert.equal(pose.animation, definition.actions[performance.action] || definition.reference);
    assert.equal(performance.durationMs, 1500);
    assert.equal(performance.agent.attributes, attributes);
    assert.equal(agent.mode, undefined);
  }
});


test("actual welcome header uses idle in the center for tribes and neutral species", () => {
  const source = readFileSync(new URL("./welcome-header.js", import.meta.url), "utf8");
  const travel = source.slice(source.indexOf("  function travelMotion("), source.indexOf("  function presentDeparture("));
  const duration = source.slice(source.indexOf("  function phaseDuration("), source.indexOf("  function advance("));
  const model = { unitStats, creatureAnimationSpeed, unitMovementPosition, welcomeTravelMotion, welcomeUnitPerformance, WELCOME_IDLE_DURATION_MS };
  for (const key of ["bean", "spore", "pebble", "spring", "boar", "talon-owl"]) {
    const scope = { globalThis: { Spawner: model }, model, current: { key, variant: 0 }, appearances: [{}],
      tribes: ["bean", "spore", "pebble", "spring"], width: 480, motionSize: () => 100, worldPixels: () => 144,
      phase: "perform", phaseStartedAt: 10, timeline: 10.5, elapsed: 500, appearanceNumber: 0,
      reducedMotion: { matches: false }, restDuration: 2000,
      neutralAnimations: () => ({ idle: { durationsMs: [400, 600] }, attack: { durationsMs: [9000] } }),
      duration: a => a.durationsMs.reduce((x, y) => x + y, 0) };
    runInNewContext(travel + duration + "\nresult = { motion: travelMotion(), duration: phaseDuration() };", scope);
    assert.equal(scope.result.motion.agent.mode, "idle");
    assert.ok(!scope.result.motion.agent.attack);
    assert.equal(scope.result.motion.agent.facing, -1);
    assert.equal(scope.result.motion.x, 240);
    assert.equal(scope.result.duration, 1500);
    for (const phase of ["enter", "exit"]) {
      scope.phase = phase;
      runInNewContext("result = travelMotion();", scope);
      assert.equal(scope.result.agent.mode, "walk");
      assert.equal(scope.result.agent.facing, -1);
      assert.ok(!scope.result.agent.attack);
    }
  }
});

test("compiled welcome sequence matches the weighted source roster exactly",()=>{
 const scope={console,setTimeout,clearTimeout,URL,performance};
 runInNewContext(readFileSync(new URL('./runtime.js',import.meta.url),'utf8'),scope);
 assert.equal(scope.Spawner.WELCOME_IDLE_DURATION_MS, 1500);
 for (const size of [.33, .4, .92]) assert.equal(scope.Spawner.welcomeDisplaySize(size), welcomeDisplaySize(size));
 const actual=scope.Spawner.createWelcomeRoster(tribes,species,WELCOME_UNIT_APPEARANCES.length,seeded(20261107));
 const expected=createWelcomeRoster(tribes,species,WELCOME_UNIT_APPEARANCES.length,seeded(20261107));
 assert.deepEqual(JSON.parse(JSON.stringify(Array.from({length:2000},actual))),Array.from({length:2000},expected));
});


test("welcome display sizes preserve species order with a balanced showcase spread", () => {
  const sizes = [.33, .345, .36, .375, .38, .39, .4, .41, .44, .46, .49, .51, .53, .56, .59, .64, .66, .7, .76, .82, .92];
  const displayed = sizes.map(welcomeDisplaySize);
  assert.equal(welcomeDisplaySize(.4), .4);
  assert.ok(displayed.at(-1) / displayed[0] < 1.4, "smallest and largest introductions remain comparable");
  for (let index = 1; index < sizes.length; index++) assert.ok(displayed[index] > displayed[index - 1]);
  for (const width of [320, 480, 720]) {
    const height = width * 280 / 480;
    const base = Math.min(288, width * .58, height * .54);
    for (const size of sizes) {
      const cell = base * welcomeDisplaySize(size) / size;
      assert.ok(Math.abs(size * cell - base * welcomeDisplaySize(size)) < 1e-10);
      assert.ok(size * cell <= height * .3, "all reference bodies fit mobile and desktop");
    }
  }
});
