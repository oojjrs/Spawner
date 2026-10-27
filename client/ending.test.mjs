import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./worker.mjs", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");

function worker() {
  let now = 1000000;
  let nextId = 0;
  let interval;
  let steps = 0;
  let stored;
  let failSaving = false;
  const messages = [];
  const saves = [];
  const room = { id: "ending-room", hostId: "host", simSeconds: 0, revision: 0,
    colonies: [{ ownerId: "host", tribe: "bean" }], games: new Map([["host", { ending: null }]]) };
  const context = createContext({
    Date: { now: () => now }, performance: { timeOrigin: 0, now: () => now },
    navigator: { locks: { request: (name, options, action) => action({}) } },
    openStorage: async () => ({
      async get() { return stored; },
      async list() { return stored ? [stored] : []; },
      async setting() { return room.id; },
      async setSetting() {},
      async put(saved) {
        if (failSaving) throw new Error("disk full");
        stored = structuredClone(saved);
        saves.push(stored);
      }
    }),
    createRoom: () => room, restoreRoom: () => room,
    saveRoom: value => ({ id: value.id, title: "기록", seed: 13, hostId: value.hostId, colonies: value.colonies,
      simSeconds: value.simSeconds, ending: value.games.get("host").ending, updatedAt: now }),
    snapshotRoom: value => ({ roomId: value.id, revision: value.revision,
      state: { simSeconds: value.simSeconds, ending: value.games.get("host").ending } }),
    tickRoom: value => {
      steps++;
      value.simSeconds += .1;
      value.revision++;
      value.games.get("host").ending = { endedAt: value.simSeconds, reason: "extinction" };
    },
    postMessage: value => messages.push(structuredClone(value)),
    setInterval: action => { interval = action; }, self: {}
  });
  runInContext(source, context);
  async function call(type, data) {
    const id = ++nextId;
    context.self.onmessage({ data: { id, type, data } });
    await runInContext("queue", context);
    const reply = messages.find(message => message.id === id);
    if (reply.error) throw new Error(reply.error);
    return reply.result;
  }
  return { call, messages, saves, steps: () => steps, failSaving: value => { failSaving = value; },
    async pulse() { now += 100; interval(); await runInContext("queue", context); } };
}

test("엔딩은 5초 자동 저장을 기다리지 않고 보관되며 둘러보기·재접속·복귀 중 진행되지 않는다", async () => {
  const client = worker();
  await client.call("create", { title: "기록", seed: 13 });
  await client.call("enter", { roomId: "ending-room", visible: true });
  await client.pulse();
  assert.equal(client.saves.at(-1).ending.reason, "extinction");
  assert.equal(client.steps(), 1);
  await client.pulse();
  await client.call("resume", { visible: true });
  await client.pulse();
  assert.equal(client.steps(), 1);
  const rooms = await client.call("list", null);
  assert.equal(rooms[0].ending.reason, "extinction");
  await client.call("pause", null);
  const packet = await client.call("enter", { roomId: "ending-room", visible: true });
  assert.equal(packet.state.ending.endedAt, .1);
  await client.pulse();
  assert.equal(client.steps(), 1);
});

test("엔딩 저장 실패 후 재시도해도 종료된 월드를 다시 진행시키지 않는다", async () => {
  const client = worker();
  await client.call("create", { title: "기록", seed: 13 });
  await client.call("enter", { roomId: "ending-room", visible: true });
  client.failSaving(true);
  await client.pulse();
  assert.equal(client.messages.at(-1).storageError, true);
  client.failSaving(false);
  await client.call("resume", { visible: true });
  await client.pulse();
  assert.equal(client.steps(), 1);
  assert.equal(client.saves.at(-1).ending.reason, "extinction");
});

const gameSource = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function gameDeclaration(name) {
  const match = gameSource.match(new RegExp("^    (?:async )?function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

function presentation() {
  const nodes = new Map();
  const properties = new Map();
  const report = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const state = { simSeconds: 180, ending: { endedAt: 180, reason: "extinction", bornCount: 2,
    exploredCells: 32, discoveryCount: 3, nestLevel: 1, colonyFood: 0 } };
  const context = createContext({ state, connection: { roomId: "test", colonyId: 1, active: true },
    endingReport: report, endingToolbar: { hidden: true },
    endingRoomId: null, endingPlayback: { elapsedMs: 0, pending: false },
    canvas: { style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) } },
    document: { body: { dataset: { screen: "game" } },
      getElementById(id) { if (!nodes.has(id)) nodes.set(id, { focus() {}, replaceChildren() {} }); return nodes.get(id); },
      createDocumentFragment: () => ({ append() {} }), createElement: () => ({ append() {} }) },
    performance: { now: () => 0 }, colonyEntries: [{ id: 1, name: "마지막 둥지" }], idleMotion: { matches: false },
    clamp: (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)),
    closeCodex() {}, closeEvolutionPanel() {}, closeColonyMenu() {}, closeUnitPanel() {}, hideHelpTooltip() {},
    stopMapMovement() {}, clearDiscoveryToasts() {}, agentDeathFrame: (corpse, time) => {
      context.deathTime = time;
      return -1;
    }
  });
  for (const name of ["resetEnding", "openEndingReport", "corpsePlaybackTime", "updateEndingPresentation", "updateEnding", "colonyInactive", "drawAgentCorpse"]) {
    runInContext(gameDeclaration(name), context);
  }
  return { context, state, report, fade: () => Number(properties.get("--ending-fade")),
    start: live => context.updateEnding(live), advance: elapsed => context.updateEndingPresentation(elapsed) };
}

test("마지막 사망 후 2초는 원래 화면, 다음 2초는 회색 전환, 4초 이후에만 보고서를 연다", () => {
  const scene = presentation();
  scene.start(true);
  assert.equal(scene.fade(), 0);
  scene.context.openEndingReport();
  assert.equal(scene.report.open, false);
  scene.advance(1999);
  assert.equal(scene.fade(), 0);
  assert.equal(scene.report.open, false);
  scene.advance(1);
  assert.equal(scene.fade(), 0);
  scene.advance(1000);
  assert.equal(scene.fade(), .5);
  assert.equal(scene.report.open, false);
  scene.advance(999);
  assert.equal(scene.report.open, false);
  scene.advance(1);
  assert.equal(scene.fade(), 1);
  assert.equal(scene.report.open, true);
  assert.equal(scene.context.endingToolbar.hidden, false);
  assert.equal(scene.state.simSeconds, 180);
  scene.report.close();
  scene.advance(1000);
  assert.equal(scene.report.open, false);
});

test("월드가 멈춰도 사망 그리기에는 별도 시간이 흐르고 재접속 시 마지막 자세를 표시한다", () => {
  const scene = presentation();
  scene.start(true);
  scene.advance(1000);
  scene.context.drawAgentCorpse(null, {}, 0, 0, 0, null, 1);
  assert.equal(scene.context.deathTime, 181);
  scene.advance(3000);
  scene.context.drawAgentCorpse(null, {}, 0, 0, 0, null, 1);
  assert.equal(scene.context.deathTime, 184);
  assert.equal(scene.state.simSeconds, 180);
  scene.context.resetEnding();
  scene.start(false);
  assert.equal(scene.report.open, true);
  assert.equal(scene.fade(), 1);
  assert.equal(scene.context.corpsePlaybackTime(), 184);
});

test("멸망한 자기 둥지만 파괴 표현으로 멈추고 다른 생존 둥지는 idle을 유지한다", () => {
  const scene = presentation();
  assert.equal(scene.context.colonyInactive({ id: 1, nestHealth: 100 }), true);
  assert.equal(scene.context.colonyInactive({ id: 2, nestHealth: 100 }), false);
  assert.equal(scene.context.colonyInactive({ id: 2, nestHealth: 0 }), true);
  scene.state.ending = null;
  assert.equal(scene.context.colonyInactive({ id: 1, nestHealth: 100 }), false);
});

test("엔딩 진입은 재생 중인 브금을 정지하거나 다른 곡으로 바꾸지 않는다", async () => {
  const sounds = [];
  class Sound {
    constructor() { this.volume = 0; this.pauses = 0; this.plays = 0; sounds.push(this); }
    load() {}
    pause() { this.pauses++; }
    play() { this.plays++; return Promise.resolve(); }
  }
  const context = createContext({ Audio: Sound, SpawnerMusicCatalog: {
    peace: [{ file: "peace.mp3" }], combat: [{ file: "combat.mp3" }] },
    setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {} });
  runInContext(readFileSync(new URL("./music.js", import.meta.url), "utf8"), context);
  const music = context.SpawnerMusic.create();
  music.update({ simSeconds: 1, agents: [{ id: "last", health: 1, action: "fight" }], rivals: [] });
  music.unlock({ currentTime: 0, state: "running" });
  await Promise.resolve();
  await Promise.resolve();
  const before = sounds.map(sound => [sound.src, sound.pauses, sound.plays]);
  assert.ok(sounds.some(sound => sound.src === "combat.mp3" && sound.plays === 1));
  music.update({ simSeconds: 20, agents: [], rivals: [], ending: { endedAt: 20 } });
  assert.deepEqual(sounds.map(sound => [sound.src, sound.pauses, sound.plays]), before);
});
