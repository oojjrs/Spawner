import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const context = createContext({});
runInContext(readFileSync(new URL("./combat-audio.js", import.meta.url), "utf8"), context);
const combat = context.SpawnerCombatAudio;
const names = events => Array.from(events, event => event.name);

test("brief visibility loss never replays an already heard attack, hurt, death or reaction", () => {
  const cases = [
    { unit: { id: "attack", tribe: "bean", health: 10, attack: { startedAt: 10, speed: 1 } }, at: 10.24, name: "unit-attack" },
    { unit: { id: "hurt", tribe: "spore", health: 10, hurtStartedAt: 10, hurtCount: 1 }, at: 10.02, name: "spore-hurt" },
    { unit: { agentId: "dead", tribe: "pebble", diedAt: 10 }, at: 10.12, name: "pebble-death", corpse: true },
    { unit: { id: "parry", tribe: "spring", health: 10,
      combat: { lastReaction: { id: "r1", targetId: "parry", kind: "parry", at: 10.1 } } }, at: 10.1, name: "unit-attack" },
    { unit: { id: "block", tribe: "spring", health: 10,
      combat: { lastReaction: { id: "r2", targetId: "block", kind: "block", at: 10.1 } } }, at: 10.1, name: "beetle-hurt" }
  ];
  for (const { unit, at, name, corpse } of cases) {
    const playback = combat.create();
    combat.update(playback, [], [], 9.9);
    const agents = corpse ? [] : [unit], corpses = corpse ? [unit] : [];
    assert.deepEqual(names(combat.update(playback, agents, corpses, at)), [name]);
    for (const offset of [.01, .03, .05]) {
      assert.deepEqual(names(combat.update(playback, [], [], at + offset)), []);
      assert.deepEqual(names(combat.update(playback, agents, corpses, at + offset + .01)), []);
    }
  }
});

test("a new injury after visibility loss still plays and survives corpse handoff", () => {
  const playback = combat.create();
  const unit = { id: "victim", tribe: "spore", health: 10, hurtStartedAt: 10, hurtCount: 1 };
  combat.update(playback, [], [], 9.9);
  assert.deepEqual(names(combat.update(playback, [unit], [], 10.02)), ["spore-hurt"]);
  combat.update(playback, [], [], 10.03);
  unit.hurtStartedAt = 10.04;
  unit.hurtCount++;
  assert.deepEqual(names(combat.update(playback, [unit], [], 10.06)), ["spore-hurt"]);
  combat.update(playback, [], [], 10.07);
  const corpse = { ...unit, agentId: unit.id, diedAt: 10.06 };
  assert.deepEqual(names(combat.update(playback, [], [corpse], 10.08)), []);
  assert.deepEqual(names(combat.update(playback, [], [corpse], 10.18)), ["spore-death"]);
});

test("future cues are not consumed when a visible unit briefly leaves view", () => {
  const playback = combat.create();
  const unit = { id: "attacker", tribe: "bean", health: 10, attack: { startedAt: 10, speed: 1 } };
  combat.update(playback, [unit], [], 10.1);
  combat.update(playback, [], [], 10.15);
  assert.deepEqual(names(combat.update(playback, [unit], [], 10.24)), ["unit-attack"]);
  assert.deepEqual(names(combat.update(playback, [unit], [], 10.25)), []);
});

test("initial past cues remain suppressed after visibility loss and unseen recent cues remain eligible", () => {
  const playback = combat.create();
  const unit = { id: "seen", tribe: "spore", health: 10, hurtStartedAt: 10, hurtCount: 1 };
  assert.deepEqual(names(combat.update(playback, [unit], [], 10.03)), []);
  combat.update(playback, [], [], 10.04);
  const unseen = { ...unit, id: "unseen" };
  assert.deepEqual(names(combat.update(playback, [unit, unseen], [], 10.05)), ["spore-hurt"]);
});

test("hidden cue history expires after its playback window without reviving old sounds", () => {
  const playback = combat.create();
  const unit = { id: "gone", tribe: "spore", health: 10, hurtStartedAt: 10, hurtCount: 1 };
  combat.update(playback, [], [], 9.9);
  combat.update(playback, [unit], [], 10.02);
  combat.update(playback, [], [], 10.1);
  assert.equal(playback.events.size, 1);
  combat.update(playback, [], [], 10.221);
  assert.equal(playback.events.size, 0);
  assert.deepEqual(names(combat.update(playback, [unit], [], 10.23)), []);
  combat.reset(playback);
  assert.equal(playback.events.size, 0);
  assert.deepEqual(names(combat.update(playback, [unit], [], 10.24)), []);
});
