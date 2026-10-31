import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const gameSource = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(blocked) {
  const sounds = [], starts = [], listeners = new Map(), buttonListeners = new Map(), resumes = [];
  let clock = null;
  const button = { setAttribute() {}, addEventListener: (type, callback) => buttonListeners.set(type, callback) };
  const document = { hidden: false, body: { dataset: { screen: "welcome" } }, getElementById: () => button,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    } };
  class AudioContext {
    constructor() { clock = this; this.state = blocked ? "suspended" : "running"; this.currentTime = 0; }
    resume() { return new Promise(resolve => resumes.push(resolve)); }
    async decodeAudioData(data) { return data; }
    createGain() { return { gain: {}, connect() {} }; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() {}, stop() {} }; }
  }
  class Audio {
    constructor() { this.volume = 0; this.paused = true; this.plays = 0; sounds.push(this); }
    load() {}
    pause() { this.paused = true; }
    play() { this.paused = false; this.plays++; starts.push(this.src); return Promise.resolve(); }
  }
  const context = createContext({ document, AudioContext, Audio, window: { addEventListener() {}, confirm: () => true },
    SpawnerCombatAudio: { sources: {} }, SpawnerAssets: { source: value => value },
    SpawnerMusicCatalog: { peace: [{ file: "peace.mp3" }], combat: [{ file: "combat.mp3" }] },
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }), performance,
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {} });
  for (const file of ["music.js", "audio.js"]) {
    runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), context);
  }
  const audio = context.SpawnerAudio.create();
  return { context, audio, document, sounds, starts, buttonListeners,
    dispatch(type) { for (const callback of listeners.get(type) || []) callback(); },
    activate() { clock.state = "running"; for (const resolve of resumes) resolve(); },
    playing: () => sounds.filter(sound => !sound.paused).map(sound => sound.src) };
}

test("웰컴 첫 진입부터 평화 브금을 시작하고 입력으로 중첩 재생하지 않는다", async () => {
  const sound = fixture(false);
  await settle();
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
  sound.dispatch("pointerdown");
  sound.dispatch("keydown");
  await settle();
  assert.equal(sound.sounds.reduce((count, channel) => count + channel.plays, 0), 1);
});

test("자동 재생이 막힌 웰컴에서도 첫 사용자 입력으로 평화 브금을 시작한다", async () => {
  const sound = fixture(true);
  await settle();
  assert.deepEqual(sound.playing(), []);
  sound.activate();
  sound.dispatch("pointerdown");
  await settle();
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
  assert.equal(sound.sounds.reduce((count, channel) => count + channel.plays, 0), 1);
});

test("멸망한 방에서 나오는 즉시 평화 브금으로 전환하고 삭제 후 알트탭해도 전투 브금이 살아나지 않는다", async () => {
  const sound = fixture(false);
  await settle();
  sound.audio.updateMusic({ simSeconds: 10, agents: [{ id: "last", health: 1, action: "fight" }], rivals: [] });
  await settle();
  const combatPlays = () => sound.starts.filter(file => file === "combat.mp3").length;
  assert.equal(combatPlays(), 1);
  const commands = [], app = { hidden: false, inert: false };
  Object.assign(sound.context, {
    audio: sound.audio, connection: { busy: false, active: true, online: true, roomId: "ended" },
    state: { ending: { endedAt: 10 } }, welcome: { hidden: true }, welcomeStatus: {}, lobbyBusy: false,
    endedRoomIds: ["ended"], endingReport: { querySelectorAll: () => [] }, endingToolbar: { querySelectorAll: () => [] },
    client: { async call(type) { commands.push(type); return { roomIds: ["ended"] }; } },
    resetEnding() {}, closeCodex() {}, closeEvolutionPanel() {}, closeColonyMenu() {}, closeUnitPanel() {},
    refreshRooms: async () => {}, setLobbyBusy(value) { sound.context.lobbyBusy = value; },
    renderFrame: null, resetAudio() {}, scheduleRender() {}
  });
  sound.document.getElementById = () => ({ focus() {} });
  sound.document.querySelector = () => app;
  function load(name, indent) {
    const match = gameSource.match(new RegExp("^" + indent + "(?:async )?function " + name + "\\([^]*?^" + indent + "}", "m"));
    assert.ok(match, name);
    runInContext(match[0], sound.context);
  }
  load("leaveEndedRoom", "    ");
  load("deleteEndedRooms", "    ");
  load("updateVisibility", "      ");
  await sound.context.leaveEndedRoom();
  await settle();
  assert.equal(sound.document.body.dataset.screen, "welcome");
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
  await sound.context.deleteEndedRooms();
  assert.equal(sound.context.connection.roomId, null);
  assert.deepEqual(commands, ["pause", "delete-ended"]);
  for (const hidden of [true, false, true, false]) {
    sound.document.hidden = hidden;
    sound.dispatch("visibilitychange");
    sound.context.updateVisibility(!hidden);
    await settle();
    assert.deepEqual(sound.playing(), hidden ? [] : ["peace.mp3"]);
  }
  assert.equal(combatPlays(), 1);
});

test("웰컴에서 음소거하면 알트탭 복귀에도 유지하고 해제할 때만 평화 브금을 재개한다", async () => {
  const sound = fixture(false);
  await settle();
  sound.buttonListeners.get("click")();
  assert.deepEqual(sound.playing(), []);
  for (const hidden of [true, false]) {
    sound.document.hidden = hidden;
    sound.dispatch("visibilitychange");
    await settle();
    assert.deepEqual(sound.playing(), []);
  }
  sound.buttonListeners.get("click")();
  await settle();
  assert.deepEqual(sound.playing(), ["peace.mp3"]);
});
