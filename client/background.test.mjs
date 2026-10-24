import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const workerSource = readFileSync(new URL("./worker.mjs", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
const audioSource = readFileSync(new URL("./audio.js", import.meta.url), "utf8");

function worker() {
  let now = 1000000;
  let cpu = 0;
  let nextId = 0;
  let interval;
  let failSaving = false;
  let yields = 0;
  const messages = [];
  const steps = [];
  const saves = [];
  const rooms = new Map();
  const settings = new Map();
  const storage = {
    async put(room) {
      if (failSaving) throw new Error("storage full");
      rooms.set(room.id, structuredClone(room));
      saves.push(structuredClone(room));
    },
    async get(id) { return structuredClone(rooms.get(id)); },
    async list() { return [...rooms.values()]; },
    async setting(key) { return settings.get(key); },
    async setSetting(key, value) { settings.set(key, value); }
  };
  const context = createContext({
    Date: { now: () => now },
    performance: { now: () => cpu, timeOrigin: 1000000 },
    crypto: { getRandomValues: values => values.fill(1) },
    navigator: { locks: { request: (name, options, action) => action({}) } },
    openStorage: async () => storage,
    createRoom: title => ({ id: "room", title, simSeconds: 0, revision: 0, orders: [] }),
    saveRoom: room => structuredClone(room),
    restoreRoom: room => structuredClone(room),
    snapshotRoom: room => ({ roomId: room.id, revision: room.revision, state: { simSeconds: room.simSeconds } }),
    tickRoom: (room, elapsed) => {
      room.simSeconds += elapsed;
      room.revision++;
      steps.push(elapsed);
      cpu += 0.25;
    },
    commandRoom: (room, action) => { room.orders.push({ action, time: room.simSeconds }); return room.simSeconds; },
    importRooms: value => value.rooms,
    postMessage: message => messages.push(structuredClone(message)),
    setInterval: action => { interval = action; },
    setTimeout: action => { yields++; setImmediate(action); },
    self: {}
  });
  runInContext(workerSource, context);

  async function call(type, data) {
    const id = ++nextId;
    context.self.onmessage({ data: { id, type, data } });
    await runInContext("queue", context);
    const response = messages.find(message => message.id === id);
    assert.ok(response, "worker replies to each request");
    if (response.error) throw new Error(response.error);
    return response.result;
  }

  return {
    call, messages, saves, steps,
    jump: milliseconds => { now += milliseconds; },
    failSaving: value => { failSaving = value; },
    yields: () => yields,
    async pulse() { interval(); await runInContext("queue", context); },
    async start() {
      await call("create", { title: "test" });
      await call("enter", { roomId: "room", visible: false });
      await call("resume", { visible: true });
      messages.length = 0;
    },
    async saved() { return JSON.parse((await call("export", { roomId: "room" })).text).rooms[0]; }
  };
}

test("숨겨진 탭에서도 시간이 진행되고 자동 저장하며 화면 상태는 보내지 않는다", async () => {
  const client = worker();
  await client.start();
  await client.call("visibility", { visible: false });
  client.messages.length = 0;
  client.jump(6000);
  await client.pulse();
  assert.ok(Math.abs(client.saves.at(-1).simSeconds - 6) < 1e-9);
  assert.equal(client.messages.some(message => message.type === "state"), false);
  await client.call("visibility", { visible: true });
  const packet = client.messages.find(message => message.type === "state").packet;
  assert.ok(Math.abs(packet.state.simSeconds - 6) < 1e-9);
});

test("한 시간 동안 실행이 중단되어도 누락 없이 작은 단계로 따라잡고 처리 사이에 양보한다", async () => {
  const client = worker();
  await client.start();
  client.jump(3600325);
  await client.pulse();
  const packets = client.messages.filter(message => message.type === "state").map(message => message.packet);
  assert.equal(packets[0].catchingUp, true);
  assert.ok(Math.abs(packets.at(-1).state.simSeconds - 3600.325) < 1e-7);
  assert.ok(client.steps.every(step => step > 0 && step <= 0.1));
  assert.ok(client.yields() > 0);
  await client.pulse();
  assert.ok(Math.abs((await client.saved()).simSeconds - 3600.325) < 1e-7);
});

test("복귀와 조작이 타이머보다 먼저 도착해도 중단 시간을 먼저 반영한다", async () => {
  const client = worker();
  await client.start();
  await client.call("visibility", { visible: false });
  client.jump(1250);
  await client.call("visibility", { visible: true });
  client.jump(3750);
  const time = await client.call("command", { roomId: "room", action: { type: "harvest" } });
  assert.ok(Math.abs(time - 5) < 1e-9);
  const saved = await client.saved();
  assert.ok(Math.abs(saved.orders[0].time - 5) < 1e-9);
});

test("숨김 전환과 중복 복귀가 진행 시간을 버리거나 두 번 더하지 않는다", async () => {
  const client = worker();
  await client.start();
  client.jump(125);
  await client.call("visibility", { visible: false });
  client.jump(2500);
  await client.call("resume", { visible: true });
  await client.call("visibility", { visible: true });
  client.jump(375);
  await client.pulse();
  assert.ok(Math.abs((await client.saved()).simSeconds - 3) < 1e-9);
});

test("명시적으로 일시정지한 구간과 월드를 처음 여는 동안은 따라잡지 않는다", async () => {
  const client = worker();
  await client.call("create", { title: "test" });
  client.jump(60000);
  await client.call("enter", { roomId: "room", visible: false });
  client.jump(10000);
  await client.call("resume", { visible: true });
  client.jump(1000);
  await client.call("pause", null);
  client.jump(60000);
  await client.call("resume", { visible: true });
  client.jump(1000);
  await client.pulse();
  assert.ok(Math.abs((await client.saved()).simSeconds - 2) < 1e-9);
});

test("시스템 시계가 뒤로 바뀌어도 진행이 역행하거나 장시간 멈추지 않는다", async () => {
  const client = worker();
  await client.start();
  client.jump(1000);
  await client.pulse();
  client.jump(-60000);
  await client.pulse();
  client.jump(1000);
  await client.pulse();
  assert.ok(Math.abs((await client.saved()).simSeconds - 2) < 1e-9);
});

test("백그라운드 저장 실패 시 진행을 멈추고 오류를 알린다", async () => {
  const client = worker();
  await client.start();
  await client.call("visibility", { visible: false });
  client.failSaving(true);
  client.jump(6000);
  await client.pulse();
  assert.match(client.messages.find(message => message.type === "error").error, /저장하지 못해 진행을 멈췄습니다/);
  const count = client.steps.length;
  client.jump(10000);
  await client.pulse();
  assert.equal(client.steps.length, count);
});

function audio() {
  const listeners = new Map();
  const starts = [];
  const stops = [];
  let suspensions = 0;
  let unlocks = 0;
  const document = {
    hidden: false,
    getElementById: () => ({ setAttribute() {}, addEventListener() {} }),
    addEventListener: (name, action) => listeners.set(name, action)
  };
  class AudioContext {
    state = "running";
    currentTime = 1;
    async decodeAudioData() { return {}; }
    createGain() { return { gain: {}, connect() {} }; }
    createBufferSource() {
      const source = { connect() {}, disconnect() {}, start() { starts.push(source); }, stop() { stops.push(source); } };
      return source;
    }
  }
  const context = createContext({
    document, AudioContext,
    window: { addEventListener() {} },
    SpawnerMusic: { create: () => ({ update() {}, unlock() { unlocks++; }, suspend() { suspensions++; } }) },
    SpawnerAssets: { source: value => value },
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
    setTimeout, performance
  });
  runInContext(audioSource, context);
  return { api: context.SpawnerAudio.create(), document, listeners, starts, stops,
    suspensions: () => suspensions, unlocks: () => unlocks };
}

test("숨겨지면 효과음과 음악을 멈추고 숨김 상태에서는 새 소리를 재생하지 않는다", async () => {
  const sound = audio();
  await sound.api.playClick();
  sound.api.setHarvest(1);
  assert.equal(sound.starts.length, 2);
  sound.document.hidden = true;
  sound.listeners.get("visibilitychange")();
  assert.equal(sound.stops.length, 2);
  assert.equal(sound.suspensions(), 1);
  await sound.api.playClick();
  sound.api.play("landing", 1);
  assert.equal(sound.starts.length, 2);
});

test("복귀 후에도 따라잡기가 끝나기 전에는 음악과 효과음을 재개하지 않는다", async () => {
  const sound = audio();
  await sound.api.playClick();
  sound.api.setActive(false);
  const count = sound.unlocks();
  sound.listeners.get("visibilitychange")();
  await sound.api.playClick();
  assert.equal(sound.unlocks(), count);
  assert.equal(sound.starts.length, 1);
  sound.api.setActive(true);
  await sound.api.playClick();
  assert.equal(sound.starts.length, 2);
  assert.ok(sound.unlocks() > count);
});
