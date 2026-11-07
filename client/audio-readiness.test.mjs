import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

function fixture(options) {
  const ready = Promise.withResolvers();
  const resumed = Promise.withResolvers();
  const contexts = [], created = [], started = [], fetches = new Map(), decodes = new Map();
  const music = { unlocks: 0, suspends: 0, unlock() { this.unlocks++; }, suspend() { this.suspends++; }, update() {} };
  let musicCreated = 0, resumeCalls = 0;
  class AudioContext {
    constructor() { this.state = options.muted ? "suspended" : "running"; this.currentTime = 1; this.destination = {}; contexts.push(this); }
    resume() { resumeCalls++; return resumed.promise; }
    createGain() { return { gain: { value: 1 }, connect(output) { this.output = output; }, disconnect() { this.output = null; } }; }
    createBufferSource() {
      const source = { connect(output) { this.output = output; }, disconnect() {}, start() { started.push(this); }, stop() {} };
      created.push(source);
      return source;
    }
    async decodeAudioData(file) {
      decodes.set(file, (decodes.get(file) || 0) + 1);
      if (file === "slow.mp3" && options.slow) return options.slow;
      if (file === "DesignAssets/Audio/bean-landing.mp3" && options.prioritySlow) return options.prioritySlow;
      if (file === "retry.mp3" && options.failure === "decode" && decodes.get(file) === 1) throw new Error("decode unavailable");
      return { file };
    }
  }
  const seed = options.muted ? new AudioContext() : null;
  const button = { addEventListener() {}, setAttribute() {} };
  const document = { hidden: false, getElementById: () => button, addEventListener() {} };
  const scope = createContext({ AudioContext: options.unsupported ? undefined : AudioContext, performance, setTimeout, clearTimeout,
    SpawnerEntryAudio: seed ? { context: seed, resumed: resumed.promise, muted: true, music } : null,
    SpawnerWelcomeLoading: true,
    SpawnerCombatAudio: { sources: {} },
    SpawnerMovementAudio: { sources: { "move-fast": "fast.mp3", "move-slow": "slow.mp3", "move-retry": "retry.mp3" }, levels: {} },
    SpawnerMusic: { create() { musicCreated++; return music; } },
    SpawnerAssets: { source: file => file, load: async file => file, welcomeReady: Promise.resolve(), ready: ready.promise },
    fetch: async file => {
      fetches.set(file, (fetches.get(file) || 0) + 1);
      return { ok: !(file === "retry.mp3" && options.failure === "fetch" && fetches.get(file) === 1), arrayBuffer: async () => file };
    }, document, window: { addEventListener() {} } });
  runInContext(readFileSync(new URL("./audio.js", import.meta.url), "utf8"), scope);
  const audio = scope.SpawnerAudio.create();
  return { audio, ready, contexts, created, started, fetches, decodes, music, button,
    musicCreated: () => musicCreated, resumeCalls: () => resumeCalls };
}

test("음원 준비는 파일 준비 경계와 이름별 채널 완료를 지키고 느린 다른 음원을 기다리지 않는다", async () => {
  const slow = Promise.withResolvers();
  const prioritySlow = Promise.withResolvers();
  const sound = fixture({ slow: slow.promise, prioritySlow: prioritySlow.promise });
  await sound.audio.playClick();
  assert.equal(sound.started.at(-1).buffer.file, "DesignAssets/Audio/ui-click.wav");
  const pending = sound.audio.prepare(["move-slow"]);
  const duplicate = sound.audio.prepare(["move-slow"]);
  let completed = false;
  pending.then(() => { completed = true; });
  assert.equal(await sound.audio.prepare(["footstep", "spring-landing"]), true);
  assert.equal(sound.fetches.has("slow.mp3"), false);
  assert.equal(sound.created.filter(source => source.buffer?.file === "DesignAssets/Audio/spring-landing.mp3").length, 8);
  sound.ready.resolve();
  assert.equal(await sound.audio.prepare(["move-fast"]), true);
  assert.equal(completed, false);
  assert.equal(sound.created.filter(source => source.buffer?.file === "fast.mp3").length, 8);
  sound.audio.setWorldVolume(0);
  sound.audio.playWelcome("move-fast", 1);
  assert.equal(sound.started.at(-1).buffer.file, "fast.mp3");
  assert.equal(sound.started.at(-1).output.output.gain.value, 1);
  slow.resolve({ file: "slow.mp3" });
  assert.equal(await pending, true);
  assert.equal(await duplicate, true);
  assert.equal(sound.fetches.get("slow.mp3"), 1);
  assert.equal(sound.decodes.get("slow.mp3"), 1);
  assert.equal(sound.created.filter(source => source.buffer?.file === "slow.mp3").length, 8);
  sound.audio.playWelcome("move-slow", 1);
  assert.equal(sound.started.at(-1).buffer.file, "slow.mp3");
  prioritySlow.resolve({ file: "DesignAssets/Audio/bean-landing.mp3" });
});

test("개별 fetch·decode 실패는 재시도할 수 있고 준비된 효과음과 브금을 중단하지 않는다", async () => {
  for (const failure of ["fetch", "decode"]) {
    const sound = fixture({ failure });
    const pending = sound.audio.prepare(["move-retry"]);
    const rejected = assert.rejects(pending);
    sound.ready.resolve();
    await rejected;
    assert.equal(await sound.audio.prepare(["move-fast"]), true);
    assert.equal(sound.audio.available(), true);
    assert.equal(sound.button.disabled, false);
    assert.equal(sound.music.suspends, 0);
    assert.equal(sound.music.unlocks, 1);
    sound.audio.playWelcome("move-fast", 1);
    assert.equal(sound.started.at(-1).buffer.file, "fast.mp3");
    assert.equal(await sound.audio.prepare(["move-retry"]), true);
    assert.equal(sound.fetches.get("retry.mp3"), 2);
    assert.equal(sound.created.filter(source => source.buffer?.file === "retry.mp3").length, 8);
    sound.audio.playWelcome("move-retry", 1);
    assert.equal(sound.started.at(-1).buffer.file, "retry.mp3");
    assert.equal(sound.music.suspends, 0);
  }
});

test("음소거 중 준비는 입장 context와 음악을 재사용하며 미완료 resume을 기다리지 않는다", async () => {
  const sound = fixture({ muted: true });
  assert.equal(await sound.audio.prepare(["footstep", "spring-landing", "footstep"]), true);
  assert.equal(sound.contexts.length, 1);
  assert.equal(sound.resumeCalls(), 0);
  assert.equal(sound.musicCreated(), 0);
  assert.equal(sound.music.unlocks, 0);
  assert.equal(sound.audio.available(), false);
  assert.equal(sound.created.filter(source => source.buffer?.file === "DesignAssets/Audio/bean-footstep.mp3").length, 8);
  assert.equal(sound.created.filter(source => source.buffer?.file === "DesignAssets/Audio/spring-landing.mp3").length, 8);
  assert.equal(await sound.audio.prepare(["footstep"]), true);
  assert.equal(sound.fetches.get("DesignAssets/Audio/bean-footstep.mp3"), 1);
  sound.audio.playWelcome("footstep", 1);
  assert.equal(sound.started.length, 0);
});

test("AudioContext 미지원 환경의 준비는 false로 완료한다", async () => {
  const sound = fixture({ unsupported: true });
  assert.equal(await sound.audio.prepare(["footstep"]), false);
  assert.equal(sound.contexts.length, 0);
  assert.equal(sound.button.disabled, true);
});
