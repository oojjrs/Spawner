import test from "node:test";
import assert from "node:assert/strict";
import { combatVfxCues, combatVfxAt, createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";

const event = (kind, at = 1, extra = {}) => ({ id: kind + ":" + at, kind, at,
  sourceId: "attacker", targetId: "victim", amount: 3, ...extra });
const packet = (events, streamId = "world-a", extra = {}) => ({ streamId, events, ...extra });

test("one impact carries critical/followup/counter tags; defenses and stun do not duplicate damage", () => {
  const critical = combatVfxCues(event("hit", 1, { critical: true, hitIndex: 2, counter: true }));
  assert.equal(critical.length, 1); assert.equal(critical[0].kind, "critical");
  assert.deepEqual(critical[0].tags, ["critical", "followup", "counter"]);
  assert.equal(combatVfxCues(event("hit", 1, { hitIndex: 1 }))[0].kind, "followup");
  for (const kind of ["miss", "dodge", "parry"]) {
    const cues = combatVfxCues(event(kind));
    assert.equal(cues.length, 1); assert.equal(cues[0].channel, "defense"); assert.equal(cues[0].amount, 0);
  }
  assert.deepEqual(combatVfxCues(event("block")).map(cue => [cue.channel, cue.amount]), [["defense", 0], ["impact", 3]]);
  assert.deepEqual(combatVfxCues(event("block", 1, { amount: 0 })).map(cue => cue.channel), ["defense"]);
  const stun = combatVfxCues({ kind: "stun", at: 1, sourceId: "a", targetId: "b", damage: 12, endsAt: 2 });
  assert.equal(stun.length, 1); assert.equal(stun[0].amount, 0); assert.equal(stun[0].endsAt, 2);
  assert.equal(combatVfxCues(event("unknown-effect")).length, 0);
});

test("drain arrives at the healed attacker and reflection arrives at the damaged attacker", () => {
  for (const [kind, channel] of [["drain", "restore"], ["reflect", "impact"]]) {
    const cue = combatVfxCues(event(kind, 2, { targetId: "attacker", fromId: "victim", toId: "attacker" }))[0];
    assert.equal(cue.anchorId, "attacker"); assert.equal(cue.phase, "arrival"); assert.equal(cue.at, 2);
    assert.equal(cue.channel, channel); assert.equal(cue.amount, 3);
  }
  for (const kind of ["bleed", "area", "heal", "regeneration", "death", "bleed-apply", "counter", "attack"])
    assert.equal(combatVfxCues(event(kind)).length, 1, kind + " has an explicit semantic mapping");
});

test("live cursor queues future render times and ages cues from the actual incident", () => {
  const cursor = createCombatVfxCursor();
  cursor.consume(packet([]), 0);
  const hit = event("hit", 1);
  assert.equal(cursor.consume(packet([hit, hit]), .9).started.length, 0);
  const due = cursor.consume(packet([hit]), 1.1);
  assert.equal(due.started.length, 1); assert.ok(Math.abs(due.started[0].age - .1) < 1e-9);
  assert.equal(cursor.consume(packet([hit]), 1.12).started.length, 0);
  assert.equal(cursor.consume(packet([hit]), 1.5).active.length, 0);
  assert.equal(cursor.consume(packet([event("hit", .5)]), 1.6).started.length, 0, "late packets cannot start stale impacts");
});

test("reconnect/backseek/stream changes restore ongoing states without bursting old impacts", () => {
  const shot = event("shoot", 1, { amount: 0, projectileId: "p", arrivesAt: 2 });
  const inputs = [shot, event("hit", 1.1), event("stun", 1, { endsAt: 4 })];
  const cursor = createCombatVfxCursor();
  const initial = cursor.consume(packet(inputs), 1.3);
  assert.equal(initial.reset, true); assert.equal(initial.started.length, 0);
  assert.deepEqual(initial.active.map(cue => cue.kind), ["stun"]);
  assert.equal(initial.projectiles.length, 1); assert.ok(Math.abs(initial.projectiles[0].progress - .3) < 1e-9);
  cursor.consume(packet(inputs), 1.4);
  const rewind = cursor.consume(packet(inputs), 1.2);
  assert.equal(rewind.reset, true); assert.equal(rewind.started.length, 0);
  assert.equal(cursor.consume(packet(inputs, "world-b"), 1.2).started.length, 0);
  assert.ok(combatVfxAt(inputs, 1.2).active.some(cue => cue.kind === "hit"), "explicit review seek can show the actual past frame");
});

test("launch, flight, arrival and cancellation are separate and never synthesize a hit", () => {
  const launch = event("shoot", 1, { amount: 0, projectileId: "p", arrivesAt: 2 });
  assert.equal(combatVfxAt([launch], .99).projectiles.length, 0);
  assert.equal(combatVfxAt([launch], 1).projectiles[0].progress, 0);
  assert.equal(combatVfxAt([launch], 1.5).projectiles[0].progress, .5);
  assert.equal(combatVfxAt([launch], 2).projectiles.length, 1);
  assert.equal(combatVfxAt([launch], 2.1).projectiles[0].progress, 1,
    "ETA clamps position but cannot invent a terminal outcome");
  assert.equal(combatVfxAt([launch], 2).active.length, 0);
  const blocked = event("parry", 2, { amount: 0, projectileId: "p" });
  assert.deepEqual(combatVfxAt([launch, blocked], 2).active.map(cue => cue.kind), ["parry"]);
  assert.equal(combatVfxAt([launch, blocked], 2).projectiles.length, 0);
  const cancel = event("projectile-cancel", 1.2, { amount: 0, projectileId: "p" });
  assert.equal(combatVfxAt([launch, cancel], 1.3).projectiles.length, 0);
  assert.equal(combatVfxAt([launch, cancel], 1.3).active.length, 0);
  assert.equal(combatVfxCues({ kind: "ranged", at: 1, sourceId: "a", targetId: "b", damage: 4 })[0].channel, "impact",
    "legacy ranged means resolved impact, never launch");
});

test("same-time heal recipients stay distinct while duplicated source/target copies deduplicate", () => {
  const cursor = createCombatVfxCursor(); cursor.consume(packet([]), 0);
  const first = { kind: "heal", at: 1, sourceId: "healer", targetId: "ally-a", damage: -1 };
  const second = { ...first, targetId: "ally-b", damage: -.5 };
  const result = cursor.consume(packet([first, second, first, second]), 1);
  assert.deepEqual(result.started.map(cue => [cue.anchorId, cue.amount]), [["ally-a", 1], ["ally-b", .5]]);
  assert.equal(cursor.consume(packet([first, second]), 1).started.length, 0);
});

test("cursor reports retained-history gaps and bounds a large incoming burst", () => {
  const cursor = createCombatVfxCursor({ maxEvents: 2 });
  cursor.consume(packet([], "a", { latestSequence: 1, oldestSequence: 1 }), 0);
  const rows = Array.from({ length: 6 }, (_, index) => event("hit", 1, { id: "hit-" + index, sequence: index + 10 }));
  const result = cursor.consume(packet(rows, "a", { latestSequence: 15, oldestSequence: 10 }), 1);
  assert.equal(result.gap, true); assert.equal(result.started.length, 2);
  assert.equal(cursor.consume(packet(rows, "b", { latestSequence: 15, oldestSequence: 10 }), 1).gap, false);
  assert.equal(cursor.consume(packet([], "b", { latestSequence: 30, oldestSequence: 1, droppedThroughSequence: 25 }), 2).gap, true,
    "an old ongoing status must not conceal missing events in the middle of the journal");
});

test("real simulation launches before damage and emits actual capped drain separately from history", () => {
  const trial = createSimulationTrial({ left: { key: "bean", organs: { ranged: 1, attack: 0 }, counts: { drain: 1 } },
    right: { key: "spore", organs: { attack: 1 }, counts: {} }, distance: 2, random: false,
    rules: { maxSeconds: .7 } });
  trial.advance(.31);
  const shot = trial.vfx.events.find(item => item.kind === "shoot");
  assert.ok(shot); assert.ok(shot.arrivesAt > shot.at);
  assert.equal(trial.vfx.events.some(item => item.kind === "hit"), false);
  trial.advance(.39);
  const impact = trial.vfx.events.find(item => item.projectileId === shot.projectileId && item.kind === "hit");
  assert.ok(impact); assert.equal(impact.at, shot.arrivesAt);
  assert.equal(trial.vfx.events.filter(item => item.kind === "drain").length, 0, "full health has no actual drain recovery");
  const melee = createSimulationTrial({ left: { key: "bean", counts: { drain: 3, vitality: 2 } }, right: { key: "spore", counts: { vitality: 2 } }, random: false,
    rules: { maxSeconds: .31 } });
  melee.finish();
  const drain = melee.vfx.events.find(item => item.kind === "drain");
  assert.ok(drain); assert.equal(drain.targetId, drain.toId); assert.notEqual(drain.fromId, drain.toId);
  assert.ok(melee.vfx.events.some(item => item.id === drain.causeId && item.kind === "hit"));
  assert.equal(melee.history.some(item => item.kind === "drain"), false, "presentation evidence does not rewrite experiment history");
});

test("bounded cursor never restarts impacts when an oversized packet repeats or reorders", () => {
  const cursor = createCombatVfxCursor({ maxEvents: 2 });
  cursor.consume(packet([]), 0);
  const rows = Array.from({ length: 6 }, (_, index) => event("hit", 1, { id: "hit-" + index, sequence: index + 1 }));
  assert.deepEqual(cursor.consume(packet(rows), 1).started.map(cue => cue.eventId), ["hit-4", "hit-5"]);
  for (let index = 1; index <= 5; index++) {
    const result = cursor.consume(packet(index % 2 ? rows.toReversed() : rows), 1 + index / 100);
    assert.equal(result.started.length, 0);
    assert.deepEqual(result.active.map(cue => cue.eventId), ["hit-4", "hit-5"]);
  }
  const next = event("hit", 1.1, { id: "hit-6", sequence: 7 });
  assert.deepEqual(cursor.consume(packet([next, ...rows]), 1.1).started.map(cue => cue.eventId), ["hit-6"]);
});

test("late older impacts cannot supersede the latest reaction through arrival order", () => {
  const cursor = createCombatVfxCursor(); cursor.consume(packet([]), 0);
  const newer = event("hit", 1.1, { id: "new", sequence: 2 });
  const older = event("hit", 1, { id: "old", sequence: 1 });
  cursor.consume(packet([newer]), 1.1);
  const result = cursor.consume(packet([newer, older]), 1.2);
  assert.deepEqual(result.active.map(cue => cue.eventId), ["old", "new"]);
  assert.deepEqual(combatVfxAt([newer, older], 1.2).active.map(cue => cue.eventId), ["old", "new"]);
});
