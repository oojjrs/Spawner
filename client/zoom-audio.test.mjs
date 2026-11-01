import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const game = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const layers = JSON.parse(game.match(/const ZOOM_LAYERS = (\[[^\]]+\]);/)[1]);

async function fixture() {
  const started = [], gains = [];
  let clock;
  class AudioContext {
    constructor() { this.state = "running"; this.currentTime = 1; this.destination = {}; clock = this; }
    createGain() {
      const node = { gain: { value: 1 }, connect(output) { this.output = output; } };
      gains.push(node);
      return node;
    }
    createBufferSource() {
      return { connect(output) { this.output = output; }, disconnect() {},
        start() { started.push(this); }, stop() {} };
    }
    async decodeAudioData(file) { return { file }; }
  }
  const button = { addEventListener() {}, setAttribute() {} };
  const scope = createContext({ AudioContext, performance, setTimeout, clearTimeout,
    SpawnerCombatAudio: { sources: { "beetle-attack": "beetle-attack.mp3" } },
    SpawnerMusic: { create: () => ({ unlock() {}, suspend() {}, update() {} }) },
    SpawnerAssets: { source: file => file },
    fetch: async file => ({ ok: true, arrayBuffer: async () => file }),
    document: { hidden: false, getElementById: () => button, addEventListener() {} },
    window: { addEventListener() {} } });
  runInContext(readFileSync(new URL("./audio.js", import.meta.url), "utf8"), scope);
  const audio = scope.SpawnerAudio.create();
  await audio.playClick();
  return { scope, audio, started, gains, clock };
}

function loadCamera(sound) {
  const state = { camera: { x: 0, y: 0, zoom: layers[2] } };
  Object.assign(sound.scope, { audio: sound.audio, state, ZOOM_LAYERS: layers,
    zoomTransition: null, cameraTransition: null, clampCamera() {},
    clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
    setZoom: value => { state.camera.zoom = value; } });
  for (const name of ["updateZoom", "updateCameraTransition"]) {
    const declaration = game.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
    assert.ok(declaration, name);
    runInContext(declaration[0], sound.scope);
  }
  return state;
}

test("줌 음량 변경은 재생 중인 전투·채집음에 즉시 반영하고 클릭·발견음은 유지한다", async () => {
  const sound = await fixture();
  const click = sound.started.at(-1);
  sound.audio.play("discovery", 1);
  const discovery = sound.started.at(-1);
  sound.audio.play("beetle-attack", 1);
  const attack = sound.started.at(-1);
  sound.audio.setHarvest(new Map([["clay", .5]]));
  const harvest = sound.started.at(-1);
  const world = attack.output.output;
  const attackLevel = attack.output.gain.value;
  assert.equal(harvest.output.output, world);
  assert.equal(world.output, sound.clock.destination);
  assert.equal(click.output.output, sound.clock.destination);
  assert.equal(discovery.output.output, sound.clock.destination);
  const starts = sound.started.length;
  sound.audio.setWorldVolume(.25);
  assert.equal(attack.output.gain.value * world.gain.value, attackLevel * .25);
  assert.equal(harvest.output.gain.value * world.gain.value, .1);
  assert.equal(click.output.gain.value, .3);
  assert.equal(discovery.output.gain.value, .65);
  assert.equal(sound.started.length, starts);
  sound.audio.setWorldVolume(1);
  assert.equal(attack.output.gain.value * world.gain.value, attackLevel);
  assert.equal(harvest.output.gain.value * world.gain.value, .4);
});

test("둥지·유닛·상세 줌의 음량은 같고 더 멀리 줌아웃할수록 공간음이 감소한다", async () => {
  const sound = await fixture();
  const state = loadCamera(sound);
  sound.audio.play("beetle-attack", 1);
  const world = sound.started.at(-1).output.output;
  for (const zoom of layers.slice(0, 3)) {
    state.camera.zoom = zoom;
    sound.scope.updateZoom(0);
    assert.equal(world.gain.value, 1);
  }
  state.camera.zoom = 18;
  sound.scope.updateZoom(0);
  assert.equal(world.gain.value, .25);
  state.camera.zoom = 8;
  sound.scope.updateZoom(0);
  assert.ok(world.gain.value > 0 && world.gain.value < .25);
  const previous = world.gain.value;
  state.camera.zoom = 4;
  sound.scope.updateZoom(0);
  assert.ok(world.gain.value > 0 && world.gain.value < previous);
});

test("휠 줌과 대상 추적 카메라 이동 모두 현재 프레임의 거리를 공간음에 반영한다", async () => {
  const sound = await fixture();
  const state = loadCamera(sound);
  sound.audio.play("beetle-attack", 1);
  const world = sound.started.at(-1).output.output;
  sound.scope.zoomTransition = { from: 36, to: 8, startedAt: 0, center: null, anchorX: 0, anchorY: 0 };
  sound.scope.updateZoom(120);
  assert.ok(state.camera.zoom > 8 && state.camera.zoom < 36);
  assert.equal(world.gain.value, (state.camera.zoom / 36) ** 2);
  sound.scope.updateZoom(240);
  assert.equal(state.camera.zoom, 8);
  assert.equal(world.gain.value, (8 / 36) ** 2);
  sound.scope.cameraTransition = { from: { x: 0, y: 0, zoom: 8 }, to: { x: 0, y: 0, zoom: 36 }, startedAt: 240, duration: 240 };
  sound.scope.updateCameraTransition(360);
  assert.ok(state.camera.zoom > 8 && state.camera.zoom < 36);
  assert.equal(world.gain.value, (state.camera.zoom / 36) ** 2);
  sound.scope.updateCameraTransition(480);
  assert.equal(world.gain.value, 1);
});
