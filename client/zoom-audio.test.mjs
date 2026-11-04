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
      const node = { gain: { value: 1 }, outputs: new Set(),
        connect(output) { this.output = output; this.outputs.add(output); },
        disconnect() { this.output = null; this.outputs.clear(); } };
      gains.push(node);
      return node;
    }
    createBufferSource() {
      return { connect(output) { this.output = output; }, disconnect() {},
        start() { started.push(this); }, stop() { this.stopped = true; queueMicrotask(() => this.onended?.()); } };
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
  const state = { camera: { x: 0, y: 0, zoom: layers[1] } };
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

test("3단계와 그보다 먼 줌은 무음이며 3단계보다 가까워질 때만 공간음을 허용한다", async () => {
  const sound = await fixture();
  const state = loadCamera(sound);
  sound.audio.play("beetle-attack", 1);
  const world = sound.started.at(-1).output.output;
  for (const zoom of layers.slice(0, 2)) {
    state.camera.zoom = zoom;
    sound.scope.updateZoom(0);
    assert.equal(world.gain.value, 1);
  }
  for (const zoom of [layers[2], 18, layers[3], 4]) {
    state.camera.zoom = zoom;
    sound.scope.updateZoom(0);
    assert.equal(world.gain.value, 0);
  }
  state.camera.zoom = layers[2] + .001;
  sound.scope.updateZoom(0);
  assert.ok(world.gain.value > 0 && world.gain.value < 1);
  const nearBoundary = world.gain.value;
  state.camera.zoom = 72;
  sound.scope.updateZoom(0);
  assert.ok(world.gain.value > nearBoundary && world.gain.value < 1);
});

test("휠 줌과 대상 추적 카메라 모두 3단계 경계에서 같은 프레임에 공간음을 차단·복원한다", async () => {
  const sound = await fixture();
  const state = loadCamera(sound);
  sound.audio.play("beetle-attack", 1);
  const attack = sound.started.at(-1);
  const world = attack.output.output;
  sound.scope.zoomTransition = { from: 144, to: 8, startedAt: 0, center: null, anchorX: 0, anchorY: 0 };
  sound.scope.updateZoom(40);
  assert.ok(state.camera.zoom > 36 && state.camera.zoom < 144);
  assert.ok(world.gain.value > 0 && world.gain.value < 1);
  sound.scope.updateZoom(120);
  assert.ok(state.camera.zoom < 36);
  assert.equal(world.gain.value, 0);
  assert.equal(attack.stopped, true);
  sound.scope.updateZoom(240);
  assert.equal(state.camera.zoom, 8);
  assert.equal(world.gain.value, 0);
  sound.scope.cameraTransition = { from: { x: 0, y: 0, zoom: 8 }, to: { x: 0, y: 0, zoom: 144 }, startedAt: 240, duration: 240 };
  sound.scope.updateCameraTransition(260);
  assert.ok(state.camera.zoom < 36);
  assert.equal(world.gain.value, 0);
  sound.scope.updateCameraTransition(360);
  assert.ok(state.camera.zoom > 36 && state.camera.zoom < 144);
  assert.ok(world.gain.value > 0 && world.gain.value < 1);
  sound.scope.updateCameraTransition(480);
  assert.equal(world.gain.value, 1);
});

test("원거리에서는 재생 중인 공간음을 정지하고 새 효과음을 만들지 않으며 줌인 후 지난 소리를 재생하지 않는다", async () => {
  const sound = await fixture();
  const click = sound.started.at(-1);
  sound.audio.play("discovery", 1);
  const discovery = sound.started.at(-1);
  sound.audio.play("beetle-attack", 1);
  const attack = sound.started.at(-1);
  sound.audio.setHarvest(new Map([["clay", .5]]));
  const harvest = sound.started.at(-1);
  sound.audio.setWorldVolume(0);
  assert.equal(attack.stopped, true);
  assert.equal(harvest.stopped, true);
  assert.equal(click.stopped, undefined);
  assert.equal(discovery.stopped, undefined);
  const before = sound.started.length;
  sound.clock.currentTime += 2;
  sound.audio.play("beetle-attack", 1);
  sound.audio.setHarvest(new Map([["clay", .5]]));
  assert.equal(sound.started.length, before);
  await sound.audio.playClick();
  sound.audio.play("discovery", 1);
  assert.equal(sound.started.length, before + 2);
  const afterUi = sound.started.length;
  sound.audio.setWorldVolume(1);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sound.started.length, afterUi);
  sound.audio.play("beetle-attack", 1);
  assert.equal(sound.started.length, afterUi + 1);
  assert.equal(sound.started.at(-1).buffer.file, "beetle-attack.mp3");
});

test("웰컴 효과음은 게임 줌과 독립이고 채널 재사용은 출력 한 곳만 연결한다", async () => {
  const sound = await fixture();
  sound.audio.setWorldVolume(0);
  sound.audio.playWelcome("footstep", 1);
  const welcome = sound.started.at(-1);
  const channel = welcome.output;
  assert.equal(welcome.buffer.file, "DesignAssets/Audio/bean-footstep.mp3");
  assert.equal(channel.gain.value, .6);
  assert.equal(channel.output.output, sound.clock.destination);
  assert.equal(channel.output.gain.value, 1);
  assert.equal(channel.outputs.size, 1);
  sound.audio.setWorldVolume(1);
  sound.audio.play("beetle-attack", 1);
  const world = sound.started.at(-1);
  assert.notEqual(world.output.output, channel.output);
  sound.audio.stopWelcome();
  assert.equal(welcome.stopped, true);
  assert.equal(world.stopped, undefined);
  sound.audio.play("landing", 1);
  const landing = sound.started.at(-1);
  assert.equal(landing.output, channel);
  assert.equal(channel.output, world.output.output);
  assert.equal(channel.outputs.size, 1);
});

test("게임 줌의 공간음 정지는 웰컴을 유지하고 전체 비활성화는 두 그룹을 정지한다", async () => {
  const sound = await fixture();
  sound.audio.play("beetle-attack", 1);
  const world = sound.started.at(-1);
  sound.audio.playWelcome("footstep", 1);
  const welcome = sound.started.at(-1);
  sound.audio.setWorldVolume(0);
  assert.equal(world.stopped, true);
  assert.equal(welcome.stopped, undefined);
  sound.audio.setActive(false);
  assert.equal(welcome.stopped, true);
  const before = sound.started.length;
  sound.audio.playWelcome("landing", 1);
  assert.equal(sound.started.length, before);
});
