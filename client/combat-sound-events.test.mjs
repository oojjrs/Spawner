import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

function fixture() {
  const started = [], listeners = new Map();
  class AudioContext {
    constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; }
    async resume() { this.state = "running"; }
    async decodeAudioData(data) { return { file: data }; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
    createBufferSource() { return { connect() {}, disconnect() {}, stop() {}, start() { started.push(this.buffer.file); } }; }
  }
  const scope = createContext({ AudioContext, performance, setTimeout, clearTimeout,
    fetch: async file => ({ ok: true, arrayBuffer: async () => file }),
    SpawnerAssets: { load: async file => file, welcomeReady: Promise.resolve(), ready: Promise.resolve() },
    SpawnerMusic: { create: () => ({ unlock() {}, suspend() {}, update() {} }) },
    document: { hidden: false, addEventListener() {}, getElementById: () => ({ setAttribute() {}, addEventListener(kind, handler) { listeners.set(kind, handler); } }) },
    window: { addEventListener() {} } });
  runInContext(readFileSync(new URL("./combat-audio.js", import.meta.url), "utf8"), scope);
  return { scope, combat: scope.SpawnerCombatAudio, started, listeners };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test("actual combat journal produces each attack, shot, impact, defense and death sound once", () => {
  const { combat } = fixture(), playback = combat.create();
  const source = { id: "source", tribe: "bean", health: 100 }, target = { id: "target", species: "vine-turtle", health: 100 };
  const events = [
    { kind: "attack", at: 0, endsAt: .3, mode: "melee" }, { kind: "shoot", at: .6 },
    { kind: "hit", at: .65, amount: 3, critical: true }, { kind: "miss", at: .7 }, { kind: "parry", at: .75 },
    { kind: "block", at: .8, amount: 1, critical: true }, { kind: "stun", at: .9 }, { kind: "death", at: 1 }
  ].map((event, index) => ({ id: "event-" + index, sequence: index + 1, sourceId: "source", targetId: "target", amount: 0, ...event }));
  const journal = time => ({ version: 1, streamId: "test", events: events.filter(event => event.at <= time) });
  combat.update(playback, [source, target], [], 0, journal(0));
  const sounds = [];
  for (const time of [.25, .6, .65, .7, .75, .8, .9, 1.12]) {
    sounds.push(...combat.update(playback, [source, target], [], time, journal(time)).map(event => event.name));
    assert.equal(combat.update(playback, [source, target], [], time, journal(time)).length, 0);
  }
  assert.deepEqual(sounds, ["unit-attack", "unit-attack", "sprout-hurt", "unit-attack", "unit-attack", "beetle-hurt", "beetle-hurt", "sprout-death"]);
});

test("rapid contacts remain distinct without duplicating the latest legacy injury", () => {
  const { combat } = fixture(), playback = combat.create();
  const target = { id: "target", tribe: "spore", health: 100, hurtStartedAt: .18, hurtCount: 3 };
  const journal = { version: 1, streamId: "combo", events: [] };
  combat.update(playback, [target], [], 0, journal);
  journal.events = [.1, .14, .18].map((at, i) => ({ id: "hit-" + i, kind: "hit", at, targetId: "target", sourceId: "source", amount: 3 }));
  assert.deepEqual(Array.from(combat.update(playback, [target], [], .18, journal), event => event.name), ["spore-hurt", "spore-hurt", "spore-hurt"]);
  assert.equal(combat.update(playback, [target], [], .2, journal).length, 0);
});

test("ranged preparation stays silent until its actual launch", () => {
  const { combat } = fixture(), playback = combat.create();
  const source = { id: "source", tribe: "bean", health: 10, attack: { combatId: "fight", startedAt: 0, hitAt: .3, speed: 1 } };
  const journal = { version: 1, streamId: "ranged", events: [{ id: "prepare", kind: "attack", mode: "ranged", at: 0, endsAt: .3, sourceId: "source" }] };
  combat.update(playback, [source], [], 0, journal);
  assert.equal(combat.update(playback, [source], [], .25, journal).length, 0);
  journal.events.push({ id: "shot", kind: "shoot", at: .3, sourceId: "source" });
  assert.deepEqual(Array.from(combat.update(playback, [source], [], .3, journal), event => event.name), ["unit-attack"]);
});

test("laboratory player unlocks and starts separate voices for simultaneous events", async () => {
  const { combat, started } = fixture(), player = combat.createPlayer();
  player.play("unit-attack", 1); assert.equal(started.length, 0);
  player.resume(); await settle();
  player.play("unit-attack", 1); player.play("unit-attack", 1); player.play("beetle-hurt", 1);
  await settle();
  assert.deepEqual(started, [combat.sources["unit-attack"], combat.sources["unit-attack"], combat.sources["beetle-hurt"]]);
});

test("in-game combat voices preserve simultaneous same-name sounds and respect mute", async () => {
  const { scope, combat, started, listeners } = fixture();
  runInContext(readFileSync(new URL("./audio.js", import.meta.url), "utf8"), scope);
  const audio = scope.SpawnerAudio.create();
  await audio.prepare(["unit-attack"]);
  audio.playCombat("unit-attack", 1); audio.playCombat("unit-attack", 1); await settle();
  assert.deepEqual(started, [combat.sources["unit-attack"], combat.sources["unit-attack"]]);
  listeners.get("click")(); audio.playCombat("unit-attack", 1); await settle();
  assert.equal(started.length, 2);
});
