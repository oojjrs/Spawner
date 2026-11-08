import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = name => readFileSync(new URL(name, import.meta.url), "utf8");
const settle = () => new Promise(resolve => setImmediate(resolve));
const key = "spawner.audio-settings.v1";
function fixture(saved, blockedStorage = false) {
  const values = new Map(saved === undefined ? [] : [[key, saved]]), elements = new Map(), events = new Map();
  function element(id) {
    const handlers = new Map();
    const node = { id, hidden: id === "sound-settings", attrs: {}, value: "100", handlers,
      setAttribute(name, value) { this.attrs[name] = value; },
      addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
      fire(type, event = {}) { for (const fn of handlers.get(type) || []) fn(event); },
      focus() { document.activeElement = node; },
      contains(other) { return [...elements.values()].includes(other); }
    };
    elements.set(id, node); return node;
  }
  for (const id of ["sound-controls", "sound-settings-toggle", "sound-settings", "sound-toggle", "sound-effects-volume", "sound-effects-volume-value", "sound-music-volume", "sound-music-volume-value"]) element(id);
  const document = { hidden: false, activeElement: null, body: { dataset: { screen: "welcome" } },
    getElementById: id => elements.get(id),
    addEventListener(type, fn) { if (!events.has(type)) events.set(type, []); events.get(type).push(fn); }
  };
  const scope = createContext({ document, localStorage: {
    getItem(name) { if (blockedStorage) throw new Error("blocked"); return values.get(name) ?? null; },
    setItem(name, value) { if (blockedStorage) throw new Error("blocked"); values.set(name, value); }
  } });
  runInContext(source("audio-settings.js"), scope);
  return { scope, settings: scope.SpawnerSoundSettings, document, elements, values,
    dispatch(type, event = {}) { for (const fn of events.get(type) || []) fn(event); } };
}

test("채널 음량·전체 음소거는 별도로 저장하고 모두 0%에서 켜면 마지막 음량으로 복원한다", () => {
  const f = fixture(), s = f.settings;
  assert.equal(s.read().effectiveEffectsVolume, 1);
  s.setVolume("effects", .37); s.toggleMute();
  assert.equal(s.read().effectsVolume, .37);
  assert.equal(s.read().effectiveEffectsVolume, 0);
  assert.equal(f.elements.get("sound-effects-volume").attrs["aria-valuetext"], "37% (음소거)");
  const reload = fixture(f.values.get(key));
  assert.equal(reload.settings.read().muted, true);
  reload.settings.toggleMute();
  assert.equal(reload.settings.read().effectiveEffectsVolume, .37);
  s.setVolume("effects", 0); s.setVolume("music", 0);
  assert.equal(s.read().effectiveEffectsVolume, 0);
  const zeroReload = fixture(f.values.get(key));
  zeroReload.settings.toggleMute();
  assert.equal(zeroReload.settings.read().effectsVolume, .37);
  s.toggleMute(); s.toggleMute(); s.setVolume("effects", .21);
  assert.equal(s.read().effectiveEffectsVolume, .21);
  assert.equal(s.read().muted, false);
});

test("손상되거나 차단된 저장소와 잘못된 음량에도 설정창은 안전하게 동작한다", () => {
  for (const saved of ["{broken", "null", '"old"', '{"volume":"0.2","muted":"false","lastVolume":null}'])
    assert.equal(fixture(saved).settings.read().effectiveEffectsVolume, 1);
  assert.equal(fixture('{"volume":-10}').settings.read().effectsVolume, 0);
  assert.equal(fixture('{"volume":10}').settings.read().effectsVolume, 1);
  const s = fixture(undefined, true).settings;
  s.setVolume("effects", .45); s.toggleMute();
  assert.equal(s.read().effectiveEffectsVolume, 0);
  s.toggleMute(); s.setVolume("effects", NaN); s.setVolume("effects", Infinity); s.setVolume("effects", "0.1");
  assert.equal(s.read().effectiveEffectsVolume, .45);
});

test("기어는 설정창을 열고 바깥 클릭·Tab 이탈·Esc로 닫으며 Esc는 포커스를 돌려준다", () => {
  const f = fixture(), e = id => f.elements.get(id);
  e("sound-settings-toggle").fire("click");
  assert.equal(e("sound-settings").hidden, false);
  assert.equal(e("sound-settings-toggle").attrs["aria-expanded"], "true");
  assert.equal(f.document.activeElement, e("sound-toggle"));
  e("sound-effects-volume").value = "26"; e("sound-effects-volume").fire("input");
  assert.equal(f.settings.read().effectsVolume, .26);
  let prevented = false, stopped = false;
  e("sound-controls").fire("keydown", { key: "Escape", preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.ok(prevented && stopped);
  assert.equal(e("sound-settings").hidden, true);
  assert.equal(f.document.activeElement, e("sound-settings-toggle"));
  e("sound-settings-toggle").fire("click");
  f.dispatch("pointerdown", { target: {} });
  assert.equal(e("sound-settings").hidden, true);
  e("sound-settings-toggle").fire("click");
  e("sound-controls").fire("focusout", { relatedTarget: e("sound-effects-volume") });
  assert.equal(e("sound-settings").hidden, false);
  e("sound-controls").fire("focusout", { relatedTarget: null });
  assert.equal(e("sound-settings").hidden, false, "설정창 안의 빈 곳 클릭은 창을 닫지 않는다");
  e("sound-controls").fire("focusout", { relatedTarget: {} });
  assert.equal(e("sound-settings").hidden, true);
});

async function audioFixture(saved) {
  const f = fixture(saved), started = [], gains = [], musicLevels = [], musicCalls = [];
  class AudioContext {
    constructor() { this.state = "running"; this.currentTime = 1; this.destination = {}; }
    createGain() {
      const gain = { gain: { value: 1 }, connect(output) { this.output = output; }, disconnect() {} };
      gains.push(gain); return gain;
    }
    createBufferSource() { return { connect(output) { this.output = output; }, disconnect() {},
      start() { started.push(this); }, stop() { this.stopped = true; } }; }
    async decodeAudioData(file) { return { file }; }
  }
  Object.assign(f.scope, { AudioContext, performance, setTimeout, clearTimeout,
    SpawnerCombatAudio: { sources: { "beetle-attack": "attack.wav" } },
    SpawnerMusic: { create: () => ({ update() {}, unlock() { musicCalls.push("unlock"); }, suspend() { musicCalls.push("suspend"); }, setVolume(value) { musicLevels.push(value); } }) },
    SpawnerAssets: { source: file => file, load: async file => file },
    fetch: async file => ({ ok: true, arrayBuffer: async () => file }), window: { addEventListener() {} } });
  runInContext(source("audio.js"), f.scope);
  const audio = f.scope.SpawnerAudio.create();
  await audio.prepare(["beetle-attack", "harvest-soil", "click", "discovery", "footstep", "dna-place"]);
  return { ...f, audio, started, gains, musicLevels, musicCalls };
}

test("효과음과 음악 음량은 독립적으로 적용하고 전체 음소거·줌 감쇠·기존 밸런스를 유지한다", async () => {
  const f = await audioFixture();
  f.audio.play("beetle-attack", 1); const attack = f.started.at(-1);
  f.audio.setHarvest(new Map([["clay", .5]])); const harvest = f.started.at(-1);
  f.audio.playWelcome("footstep", 1); const welcome = f.started.at(-1);
  await f.audio.playClick(); const click = f.started.at(-1);
  f.audio.play("discovery", 1); const discovery = f.started.at(-1);
  await f.audio.playDna("place"); const dna = f.started.at(-1);
  f.audio.playCombat("beetle-attack", .8); await settle(); const combat = f.started.at(-1);
  const master = attack.output.output.output, world = attack.output.output;
  for (const voice of [harvest, welcome, combat]) assert.equal(voice.output.output.output, master);
  for (const voice of [click, discovery, dna]) assert.equal(voice.output.output, master);
  const starts = f.started.length, unlocks = f.musicCalls.length;
  f.settings.setVolume("effects", .35);
  assert.equal(master.gain.value, .35);
  assert.equal(f.musicLevels.at(-1), 1);
  f.settings.setVolume("music", .18);
  assert.equal(f.musicLevels.at(-1), .18);
  assert.equal(master.gain.value, .35);
  assert.equal(f.started.length, starts);
  assert.equal(f.musicCalls.length, unlocks, "음량 조정만으로 음악을 재시작하지 않는다");
  f.audio.setWorldVolume(.25);
  assert.equal(world.gain.value, .25);
  assert.equal(master.gain.value, .35);
  assert.equal(click.output.gain.value, .3);
  assert.equal(discovery.output.gain.value, .65);
  assert.equal(dna.output.gain.value, .65);
  f.settings.toggleMute();
  assert.equal(master.gain.value, 0);
  assert.equal(f.audio.available(), false);
  assert.ok([attack, harvest, welcome, click, discovery, dna, combat].every(voice => voice.stopped));
  f.document.hidden = true; f.dispatch("visibilitychange");
  f.document.hidden = false; f.dispatch("visibilitychange");
  assert.equal(f.audio.available(), false);
  f.settings.toggleMute(); await settle();
  assert.equal(master.gain.value, .35);
  assert.equal(world.gain.value, .25);
  assert.equal(f.audio.available(), true);
  assert.equal(f.musicLevels.at(-1), .18);
});

test("저장된 음소거·0%는 초기 웰컴과 후속 음악 재개에서 새 소리를 막는다", async () => {
  for (const saved of [{ volume: .4, muted: true }, { volume: 0, muted: false, lastVolume: .4 }]) {
    const f = await audioFixture(JSON.stringify(saved));
    await f.audio.playClick(); f.audio.play("discovery", 1);
    assert.equal(f.started.length, 0);
    assert.equal(f.musicLevels.at(-1), 0);
    assert.equal(f.elements.get("sound-toggle").textContent, "꺼짐");
    f.elements.get("sound-toggle").fire("click"); await settle();
    assert.equal(f.settings.read().effectiveEffectsVolume, .4);
    assert.equal(f.musicLevels.at(-1), .4);
  }
});

test("음악 출력 gain은 페이드·트랙 위치를 바꾸지 않고 저장 음량을 첫 재생 전부터 적용한다", async () => {
  const gains = [], sounds = [], intervals = [];
  class Audio {
    constructor() { this.volume = 0; this.currentTime = 17; this.paused = true; sounds.push(this); }
    load() {} pause() { this.paused = true; }
    play() { this.paused = false; this.plays = (this.plays || 0) + 1; return Promise.resolve(); }
  }
  const context = { state: "running", currentTime: 0, destination: {},
    createGain() { const gain = { gain: { value: 1 }, connect() {} }; gains.push(gain); return gain; },
    createMediaElementSource: () => ({ connect() {} }) };
  const scope = createContext({ Audio, location: { protocol: "http:" },
    SpawnerMusicCatalog: { peace: [{ file: "peace.mp3" }], combat: [{ file: "combat.mp3" }] },
    setInterval(fn) { intervals.push(fn); return 1; }, clearInterval() {}, setTimeout: () => 1, clearTimeout() {} });
  runInContext(source("music.js"), scope);
  const music = scope.SpawnerMusic.create();
  music.setVolume(.42); music.update(null); music.unlock(context); await settle();
  assert.equal(gains[0].gain.value, .42);
  context.currentTime = 3; intervals.forEach(fn => fn());
  const active = sounds.find(sound => !sound.paused); active.currentTime = 19;
  assert.equal(active.volume, .28);
  music.setVolume(.2);
  assert.equal(gains[0].gain.value, .2);
  assert.equal(active.plays, 1);
  assert.equal(active.currentTime, 19);
  assert.equal(active.volume, .28);
  music.setVolume(0);
  music.update({ simSeconds: 1, agents: [{ id: "a", health: 1, action: "fight" }], rivals: [] }); await settle();
  assert.equal(gains[0].gain.value, 0);
  music.setVolume(.7); music.suspend(); music.unlock(context); await settle();
  assert.equal(gains[0].gain.value, .7);
});

test("설정창은 단일 제어를 화면마다 함께 옮기고 방 처리 중에도 소리 조작을 허용한다", () => {
  const html = source("../Spawner.html"), game = source("game.js"), css = source("game.css");
  assert.equal((html.match(/id="sound-controls"/g) || []).length, 1);
  assert.match(html, /id="sound-settings-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="sound-settings"/);
  assert.match(html, /id="sound-settings"[^>]*aria-labelledby="sound-settings-title" hidden/);
  assert.match(html, /<label for="sound-effects-volume">효과음<\/label>/);
  assert.match(html, /<label for="sound-music-volume">BGM<\/label>/);
  for (const channel of ["effects", "music"])
    assert.ok(html.includes('id="sound-' + channel + '-volume" type="range" min="0" max="100" step="1"'));
  assert.ok(html.indexOf('src="./client/audio-settings.js"') < html.indexOf('src="./client/entry.js"'));
  assert.equal((game.match(/appendChild\(document\.getElementById\("sound-controls"\)\)/g) || []).length, 4);
  assert.equal((game.match(/globalThis\.SpawnerSoundSettings\?\.close\(\);/g) || []).length, 4);
  assert.match(game, /input:not\(\.sound-volume\), button:not\(#sound-toggle\):not\(#sound-settings-toggle\)/);
  assert.match(css, /\.sound-settings \{[^}]*width: min\(276px, calc\(100vw - 32px\)\)/);
  assert.match(css, /\.sound-volume \{[^}]*height: 44px/);
  assert.match(css, /\.sound-mute-toggle:focus-visible, \.sound-volume:focus-visible/);
});

test("입장 초기 음악도 저장된 음량·음소거를 먼저 적용하고 전체 오디오로 넘길 때 임시 구독을 해제한다", async () => {
  const entry = source("entry.js");
  const declaration = entry.slice(entry.indexOf("  async function prepareWelcome()"), entry.indexOf('  button.addEventListener("click"'));
  for (const saved of [{ volume: .31, muted: false }, { volume: .31, muted: true }, { volume: 0, muted: false },
    { effectsVolume: 0, musicVolume: .6, muted: false }, { effectsVolume: .2, musicVolume: 0, muted: false }]) {
    const f = fixture(JSON.stringify(saved)), musicLevels = [], events = [], handedOff = [];
    for (const node of f.elements.values()) node.removeEventListener = (type, fn) => {
      node.handlers.set(type, (node.handlers.get(type) || []).filter(callback => callback !== fn));
    };
    f.document.removeEventListener = () => {};
    const seed = { context: { resume: async () => { events.push("resume"); } } };
    const music = { ready: Promise.resolve(true), waveform: {},
      setVolume(value) { musicLevels.push(value); },
      unlock() { events.push("unlock"); }, suspend() { events.push("suspend"); }, update() {} };
    Object.assign(f.scope, {
      welcome: { querySelector: selector => selector === ".welcome-stage" ? { style: {} } : {} },
      loaded: new Set(), loadScript: async () => {}, location: { protocol: "https:" },
      Image: class { decode() { return Promise.resolve(); } },
      window: { addEventListener() {}, removeEventListener() {} },
      SpawnerEntryAudio: seed, SpawnerMusic: { create: () => music },
      SpawnerAudio: { create() {
        handedOff.push({ muted: seed.muted, level: musicLevels.at(-1) });
        seed.cleanup();
        return { playClick() {} };
      } },
      SpawnerWelcomeWaveform: { create() {} }
    });
    runInContext(declaration, f.scope);
    await f.scope.prepareWelcome();
    const expected = saved.muted ? 0 : saved.musicVolume ?? saved.volume;
    assert.deepEqual(handedOff, [{ muted: f.settings.read().effectiveMuted, level: expected }]);
    assert.equal(seed.cleanup, null);
    assert.equal(seed.resumeMusic, null);
    assert.equal(f.elements.get("sound-toggle").handlers.get("click").length, 0);
    const levelsBefore = musicLevels.length;
    f.settings.setVolume("effects", .2);
    assert.equal(musicLevels.length, levelsBefore, "임시 입장 구독이 남아 음악을 중복 재개하지 않는다");
  }
});

test("기존 단일 음량은 양쪽에 이관하고 각 채널의 값과 무음 선택은 재실행·전체 음소거 후에도 보존한다", () => {
  const f = fixture(JSON.stringify({ volume: .43, muted: false, lastVolume: .7 }));
  assert.equal(f.settings.read().effectsVolume, .43);
  assert.equal(f.settings.read().musicVolume, .43);
  const effects = f.elements.get("sound-effects-volume"), music = f.elements.get("sound-music-volume");
  effects.value = "23"; effects.fire("input");
  music.value = "0"; music.fire("input");
  assert.equal(f.settings.read().effectsVolume, .23);
  assert.equal(f.settings.read().musicVolume, 0);
  assert.equal(f.elements.get("sound-effects-volume-value").textContent, "23%");
  assert.equal(f.elements.get("sound-music-volume-value").textContent, "0%");
  const reload = fixture(f.values.get(key));
  reload.settings.toggleMute();
  assert.equal(reload.settings.read().effectiveEffectsVolume, 0);
  reload.settings.toggleMute();
  assert.equal(reload.settings.read().effectiveEffectsVolume, .23);
  assert.equal(reload.settings.read().effectiveMusicVolume, 0);
  assert.equal(reload.settings.read().effectiveMuted, false);
});

test("효과음 0%는 음악을 끊지 않고 BGM 0%는 효과음을 막지 않는다", async () => {
  const f = await audioFixture(JSON.stringify({ effectsVolume: .4, musicVolume: .6 }));
  f.audio.play("beetle-attack", 1);
  const attack = f.started.at(-1), effects = attack.output.output.output;
  const calls = f.musicCalls.length;
  f.settings.setVolume("effects", 0);
  assert.equal(effects.gain.value, 0);
  assert.equal(attack.stopped, true);
  assert.equal(f.musicLevels.at(-1), .6);
  assert.equal(f.musicCalls.length, calls);
  assert.equal(f.elements.get("sound-toggle").textContent, "켜짐");
  const starts = f.started.length;
  await f.audio.playClick(); await f.audio.playDna("place"); f.audio.play("discovery", 1);
  assert.equal(f.started.length, starts);
  assert.equal(f.musicCalls.includes("suspend"), false);
  f.settings.setVolume("effects", .4);
  const musicCalls = f.musicCalls.length;
  f.settings.setVolume("music", 0);
  assert.equal(effects.gain.value, .4);
  assert.equal(f.musicLevels.at(-1), 0);
  assert.equal(f.musicCalls.length, musicCalls);
  await f.audio.playClick();
  assert.equal(f.started.length, starts + 1);
  f.settings.toggleMute(); f.settings.toggleMute(); await settle();
  assert.equal(effects.gain.value, .4);
  assert.equal(f.musicLevels.at(-1), 0);
});
