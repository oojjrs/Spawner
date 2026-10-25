import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

function audioFixture() {
  const starts = [], stops = [], listeners = new Map();
  let clock = null;
  const document = { hidden: false, getElementById: () => ({ setAttribute() {}, addEventListener() {} }),
    addEventListener: (name, callback) => listeners.set(name, callback) };
  class AudioContext {
    constructor() { clock = this; this.state = "running"; this.currentTime = 1; }
    async decodeAudioData(data) { return data; }
    createGain() { return { gain: {}, connect() {} }; }
    createBufferSource() {
      return { connect() {}, disconnect() {}, start() { starts.push(this); },
        stop() { stops.push(this); queueMicrotask(() => this.onended?.()); } };
    }
  }
  const context = createContext({ document, AudioContext, window: { addEventListener() {} },
    SpawnerCombatAudio: { sources: { "unit-death": "death.mp3" } },
    SpawnerMusic: { create: () => ({ update() {}, unlock() {}, suspend() {} }) },
    SpawnerAssets: { source: value => value },
    fetch: async source => ({ ok: true, arrayBuffer: async () => ({ source }) }), setTimeout, performance });
  runInContext(readFileSync(new URL("./audio.js", import.meta.url), "utf8"), context);
  return { api: context.SpawnerAudio.create(), starts, stops, listeners, document, clock: () => clock };
}

test("비옥토는 선택한 흙 움켜쥐기 원본을 반복 재생하며 볼륨 갱신으로 중첩하지 않는다", async () => {
  const sound = audioFixture();
  await sound.api.playClick();
  sound.api.setHarvest(0, 1);
  const soil = sound.starts.at(-1);
  assert.equal(soil.buffer.source, "DesignAssets/Audio/clay-harvest-handful.mp3");
  assert.equal(soil.loop, true);
  const count = sound.starts.length;
  sound.api.setHarvest(0, .5);
  assert.equal(sound.starts.length, count);
  sound.api.setHarvest(.7, .5);
  const other = sound.starts.at(-1);
  assert.equal(other.buffer.source, "DesignAssets/Audio/mushroom-harvest-loop.mp3");
  sound.api.setHarvest(.7, 0);
  assert.ok(sound.stops.includes(soil));
  assert.ok(!sound.stops.includes(other));
  sound.document.hidden = true;
  sound.listeners.get("visibilitychange")();
  assert.ok(sound.stops.includes(other));
  sound.api.setHarvest(0, 1);
  assert.equal(sound.starts.length, count + 1);
});

test("전투음이 비옥토 채널을 선점한 후 빈 채널이 생기면 비옥토 채집음이 복구된다", async () => {
  const sound = audioFixture();
  await sound.api.playClick();
  sound.api.setHarvest(0, 1);
  const soil = sound.starts.at(-1);
  for (let index = 0; index < 7; index++) {
    sound.clock().currentTime += .2;
    sound.api.play("catch", 1);
  }
  const released = sound.starts.at(-1);
  sound.clock().currentTime += .2;
  sound.api.play("unit-death", 1);
  assert.ok(sound.stops.includes(soil));
  await Promise.resolve();
  released.onended();
  const count = sound.starts.length;
  sound.api.setHarvest(0, 1);
  assert.equal(sound.starts.length, count + 1);
  assert.equal(sound.starts.at(-1).buffer.source, "DesignAssets/Audio/clay-harvest-handful.mp3");
  sound.api.setActive(false);
});

test("화면의 비옥토 채집 개체만 흙 채널에 합산하며 채집 종료 시 흙 소리를 멈춘다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const declaration = source.match(/^    function updateAudio\([^]*?^    }/m)[0];
  const calls = [];
  const units = [10, 11, 12].map(x => ({ id: "worker:" + x, x, y: 20, health: 1, mode: "harvest",
    moveStartedAt: 0, moveDuration: 0, stepCount: 0, attributes: {} }));
  const state = { simSeconds: 1.1, camera: { layer: 0 }, agents: units, rivals: [], corpses: [] };
  const context = createContext({ state, connection: { active: true, online: true }, audioTime: 1,
    audio: { available: () => true, play() {}, setHarvest: (...volumes) => calls.push(volumes) },
    SpawnerCombatAudio: { update: () => [] }, combatAudio: {},
    Spawner: { resourceTypeForCell: food => food.resourceType }, worldMap: {},
    foodCellAt: x => ({ resourceType: x === 12 ? "grass-fiber" : "clay" }),
    displayedAgent: value => value, interpolatedAgentPosition: value => value,
    audioVolume: x => x < 11 ? .7 : x < 12 ? .9 : .4,
    agentBirthPose: () => null, isHarvestingFood: unit => unit.mode === "harvest",
    agentAudio: new Map(), deliveryAudio: new Map(), foodDeliveries: new Map(),
    resetAudio() { throw new Error("Unexpected reset"); } });
  runInContext(declaration, context);
  context.updateAudio();
  assert.deepEqual(calls.at(-1), [.4, .9]);
  state.agents = [units[2]];
  context.updateAudio();
  assert.deepEqual(calls.at(-1), [.4, 0]);
  state.agents = [];
  context.updateAudio();
  assert.deepEqual(calls.at(-1), [0, 0]);
});
