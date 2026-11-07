import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const clientRoot = process.env.SPAWNER_REPO ? new URL("file://" + process.env.SPAWNER_REPO + "/client/") : new URL("./", import.meta.url);
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(blocked, touchActivation = false, mediaActivation = false, seeded, seedPromise) {
  const sounds = [], starts = [], listeners = new Map(), buttonListeners = new Map(), resumes = [], timers = new Map();
  const gains = [], intervals = new Map();
  const contexts = [];
  let resumeCalls = 0;
  let clock = null;
  let userActivated = false;
  let playbackActivated = false;
  let timerId = 0;
  const button = { setAttribute() {}, addEventListener: (type, callback) => buttonListeners.set(type, callback) };
  const document = { hidden: false, body: { dataset: { screen: "welcome" } }, getElementById: () => button,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    } };
  class AudioContext {
    constructor() { clock = this; contexts.push(this); this.state = blocked ? "suspended" : "running"; this.currentTime = 0; }
    resume() {
      resumeCalls++;
      if (touchActivation) {
        if (!userActivated) return new Promise(() => {});
        this.state = "running";
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => resumes.push({resolve, reject}));
    }
    async decodeAudioData(data) { return data; }
    createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} }; }
    createWaveShaper() { return { connect() {} }; }
    createGain() { const gain = { gain: { value: 1 }, connect() {}, disconnect() {} }; gains.push(gain); return gain; }
    createMediaElementSource() { return { connect() {} }; }
    createAnalyser() { return { getFloatTimeDomainData(samples) { samples.fill(0); } }; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() {}, stop() {} }; }
  }
  class Audio {
    constructor() { this.volume = 0; this.currentTime = 0; this.paused = true; this.plays = 0; sounds.push(this); }
    load() { assert.equal(this.crossOrigin, "anonymous", "CORS must be set before loading a Web Audio track"); }
    pause() { this.paused = true; }
    play() {
      if (mediaActivation && !playbackActivated)
        return Promise.reject(Object.assign(new Error("A user gesture is required"), { name: "NotAllowedError" }));
      this.paused = false; this.plays++; starts.push(this.src); return Promise.resolve();
    }
  }
  const envelope = Buffer.from([...Array(20).fill(32), ...Array(10).fill(255), ...Array(20).fill(32)]).toString("base64");
  const entryContext = seeded ? new AudioContext() : null;
  const entryAudio = entryContext ? { context: entryContext, resumed: seedPromise || entryContext.resume() } : null;
  const context = createContext({ document, AudioContext, Audio, SpawnerEntryAudio: entryAudio, location: { protocol: "http:" }, window: { addEventListener() {}, confirm: () => true },
    SpawnerCombatAudio: { sources: {} }, SpawnerAssets: { source: value => value },
    atob: value => Buffer.from(value, "base64").toString("binary"),
    SpawnerMusicCatalog: { peace: [{ file: "peace.mp3", envelope }, { file: "peace-next.mp3", envelope }, { file: "peace-last.mp3", envelope }], combat: [{ file: "combat.mp3", envelope }] },
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }), performance,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval: callback => { const id = ++timerId; intervals.set(id, callback); return id; },
    clearInterval: id => intervals.delete(id) });
  for (const file of ["music.js", "audio.js"]) {
    runInContext(readFileSync(file === "audio.js" && process.env.AUDIO_SOURCE ? process.env.AUDIO_SOURCE : new URL(file, clientRoot), "utf8"), context);
  }
  const audio = context.SpawnerAudio.create();
  return { context, audio, document, sounds, starts, button, buttonListeners, timers, contexts, resumeCount: () => resumeCalls,
    effectLevel: () => gains[1].gain.value,
    advance(seconds) {
      clock.currentTime += seconds;
      for (const sound of sounds) if (!sound.paused) sound.currentTime += seconds;
      for (const callback of [...intervals.values()]) callback();
    },
    dispatch(type) {
      userActivated = type === "pointerup" || type === "click" || type === "keydown";
      if (userActivated) playbackActivated = true;
      for (const callback of listeners.get(type) || []) callback({ target: { closest: () => null } });
      userActivated = false;
    },
    activate() { clock.state = "running"; for (const request of resumes) request.resolve(); },
    resolveResume(index) { clock.state = "running"; resumes[index].resolve(); },
    rejectResume(index) { resumes[index].reject(new Error("Resume request failed")); },
    playing: () => sounds.filter(sound => !sound.paused).map(sound => sound.src) };
}


// Conditional state-machine regressions, not proof of an Android device failure.
test("a later touch retries while the entry resume promise remains unresolved", async () => {
  const sound = fixture(true, true, false, true);
  await settle();
  assert.deepEqual(sound.playing(), []);
  const before = sound.resumeCount();
  sound.dispatch("pointerup");
  assert.equal(sound.resumeCount(), before + 1, "resume must run inside the new gesture before an await");
  assert.equal(sound.contexts[0].state, "running");
  await settle();
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
  assert.equal(sound.contexts.length, 1, "reuse the original AudioContext");
});

test("running context is not held behind an obsolete pending entry resume", async () => {
  const sound = fixture(true, true, false, true);
  await settle();
  sound.contexts[0].state = "running";
  const before = sound.resumeCount();
  sound.dispatch("pointerup");
  await settle();
  assert.equal(sound.resumeCount(), before);
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
});

test("hidden, muted, inactive state blocks retry and music", async () => {
  for (const kind of ["hidden", "muted", "inactive"]) {
    const sound = fixture(true, true, false, true);
    await settle();
    if (kind === "hidden") sound.document.hidden = true;
    else if (kind === "muted") sound.buttonListeners.get("click")();
    else sound.audio.setActive(false);
    const before = sound.resumeCount();
    sound.dispatch("pointerup");
    await settle();
    assert.equal(sound.resumeCount(), before, kind);
    assert.deepEqual(sound.playing(), [], kind);
  }
});

for (const kind of ["hidden", "muted", "inactive"]) test(kind + " during resume prevents music after resolution", async () => {
  const sound = fixture(true, false, false, true);
  await settle();
  sound.dispatch("pointerup");
  if (kind === "hidden") { sound.document.hidden = true; sound.dispatch("visibilitychange"); }
  else if (kind === "muted") sound.buttonListeners.get("click")();
  else sound.audio.setActive(false);
  sound.activate();
  await settle();
  assert.deepEqual(sound.playing(), []);
});

test("repeated activated touches do not restart BGM or add a context", async () => {
  const sound = fixture(true, true, false, true);
  await settle(); sound.dispatch("pointerup"); await settle();
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
  const track = sound.sounds.find(channel => !channel.paused);
  track.currentTime = 17;
  const plays = track.plays, resumes = sound.resumeCount();
  for (const type of ["click", "pointerup", "click"]) { sound.dispatch(type); await settle(); }
  assert.equal(track.currentTime, 17); assert.equal(track.plays, plays);
  assert.equal(sound.resumeCount(), resumes); assert.equal(sound.contexts.length, 1);
});

test("a closed context is not resumed", async () => {
  const sound = fixture(true, true, false, true);
  await settle(); sound.contexts[0].state = "closed";
  const before = sound.resumeCount(); sound.dispatch("pointerup"); await settle();
  assert.equal(sound.resumeCount(), before); assert.deepEqual(sound.playing(), []);
});

test("media autoplay rejection remains retryable without changing settings", async () => {
  const sound = fixture(false, false, true);
  await settle(); assert.deepEqual(sound.playing(), []);
  sound.dispatch("pointerup"); await settle();
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
});

test("peaceful game entry and combat BGM selection are unchanged", async () => {
  const sound = fixture(false);
  await settle();
  sound.audio.updateMusic({simSeconds:1, agents:[{id:1,health:1,action:"idle"}],rivals:[]});
  await settle(); assert.deepEqual(sound.playing(), ["peace.mp3"]);
  sound.audio.updateMusic({simSeconds:2, agents:[{id:1,health:1,action:"fight"}],rivals:[]});
  await settle(); assert.ok(sound.playing().includes("combat.mp3"));
});

test("late rejection of the old seed does not disable a successful user retry", async () => {
  const seed = Promise.withResolvers(); seed.promise.catch(() => {});
  const sound = fixture(true, true, false, true, seed.promise);
  await settle(); sound.dispatch("pointerup"); await settle();
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
  seed.reject(Object.assign(new Error("Old attempt was not allowed"), {name:"NotAllowedError"}));
  await settle();
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
  sound.dispatch("click"); await settle();
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
});

test("old seed rejection during a newer pending resume cannot disable recovery", async () => {
  const seed = Promise.withResolvers(); seed.promise.catch(() => {});
  const sound = fixture(true, false, false, true, seed.promise);
  await settle(); sound.dispatch("pointerup");
  seed.reject(new Error("Old seed failed")); await settle();
  assert.equal(sound.button.disabled, false);
  sound.activate(); await settle();
  assert.equal(sound.button.disabled, false);
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
});

test("later gesture B can succeed without being disabled by gesture A's late rejection", async () => {
  const seed = new Promise(() => {});
  const sound = fixture(true, false, false, true, seed);
  await settle(); sound.dispatch("pointerup"); sound.dispatch("click");
  assert.equal(sound.resumeCount(), 2, "two independent gesture attempts must be possible");
  sound.resolveResume(1); await settle();
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
  const track = sound.sounds.find(channel => !channel.paused); track.currentTime = 23;
  sound.rejectResume(0); await settle();
  assert.equal(sound.button.disabled, false);
  assert.deepEqual(sound.playing(), ["peace.mp3"]); assert.equal(track.currentTime, 23);
});

test("older gesture rejection cannot disable a newer still-pending gesture", async () => {
  const sound = fixture(true, false, false, true, new Promise(() => {}));
  await settle(); sound.dispatch("pointerup"); sound.dispatch("click");
  sound.rejectResume(0); await settle(); assert.equal(sound.button.disabled, false);
  sound.resolveResume(1); await settle(); assert.deepEqual(sound.playing(), ["peace.mp3"]);
});

test("a rejected resume cannot disable a context already made running by another attempt", async () => {
  const sound = fixture(true, false, false, true, new Promise(() => {}));
  await settle(); sound.dispatch("pointerup"); sound.dispatch("click");
  sound.resolveResume(0); await settle(); assert.deepEqual(sound.playing(), ["peace.mp3"]);
  sound.rejectResume(1); await settle(); assert.equal(sound.button.disabled, false);
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
});

test("the current failed resume still surfaces failure when no attempt has recovered", async () => {
  const sound = fixture(true, false, false, true, new Promise(() => {}));
  await settle(); sound.dispatch("pointerup");
  sound.rejectResume(0); await settle();
  assert.equal(sound.button.disabled, true); assert.deepEqual(sound.playing(), []);
});
