import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createContext, runInContext } from "node:vm";
import * as units from "./unit-animation.mjs";
import * as beetle from "../server/beetle-animation.mjs";

const context = createContext({});
runInContext(readFileSync(new URL("./movement-audio.js", import.meta.url), "utf8"), context);
const audio = context.SpawnerMovementAudio;
const animations = { ...units, ...beetle };

function agent(key) {
  const creature = key === "spiny-back-beetle" || !!units.CREATURE_WALK_ANIMATIONS[key];
  return { id: key, ...(creature ? { species: key } : { tribe: key }), health: 10,
    mode: creature ? "walk" : "search", attributes: {}, moveStartedAt: 0, moveDuration: 2, stepCount: 1 };
}

test("이동음 22종은 생성 원본 그대로 게임 로더와 기획서에 연결한다", () => {
  const design = readFileSync(new URL("../Design.html", import.meta.url), "utf8");
  const loaders = readFileSync(new URL("./local-assets.js", import.meta.url), "utf8");
  assert.equal(Object.keys(audio.definitions).length, 22);
  for (const [key, definition] of Object.entries(audio.definitions)) {
    const bytes = readFileSync(new URL("../" + definition.source, import.meta.url));
    const record = JSON.parse(readFileSync(new URL("../" + definition.source.replace(/\.mp3$/, ".json"), import.meta.url), "utf8"));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), record.sha256);
    assert.equal(record.processing, "none");
    const loader = "client/local-assets/" + definition.source.slice("DesignAssets/".length) + ".js";
    assert.ok(loaders.includes(loader));
    assert.ok(existsSync(new URL("../" + loader, import.meta.url)));
    const rowKey = { spore: "spore-tribe", pebble: "pebble-tribe", spring: "spring-tribe" }[key] || key;
    const row = design.match(new RegExp('<tr id="unit-' + rowKey + '"[^>]*>([^]*?)</tr>'))[1];
    const cell = row.match(/<td data-action="walk"[^>]*>([^]*?)<\/td>/)[1];
    const cue = JSON.parse(cell.match(/data-audio-cues='([^']+)'/)[1])[0];
    assert.equal(cue.src, definition.source);
    assert.equal(cue.volume, definition.gain);
  }
});

test("이슬토끼 착지음은 실제 착지 프레임을 따르고 이동 속도가 두 배면 시점도 절반이다", () => {
  for (const duration of [2, 1]) {
    const unit = agent("dew-rabbit"), playback = audio.create();
    unit.moveDuration = duration;
    const contact = duration * units.CREATURE_WALK_ANIMATIONS["dew-rabbit"].travelWindow[1];
    audio.update(playback, [unit], 0, animations);
    const times = [];
    for (let time = .05; time < contact - .01; time += .05) times.push(time);
    for (const time of times) assert.equal(audio.update(playback, [unit], time, animations).length, 0);
    assert.equal(audio.update(playback, [unit], contact - .001, animations).length, 0);
    assert.equal(audio.update(playback, [unit], contact, animations)[0].name, "move-dew-rabbit");
    assert.equal(audio.update(playback, [unit], contact, animations).length, 0);
  }
});

test("정지·사망·탄생·공격·피격에는 이동음이 나오지 않고 재접속 시 지난 소리를 재생하지 않는다", () => {
  for (const key of Object.keys(audio.definitions)) {
    const unit = agent(key), playback = audio.create();
    assert.equal(audio.update(playback, [unit], .7, animations).length, 0);
    assert.equal(audio.update(playback, [unit], 10, animations).length, 0);
    for (const change of [{ health: 0 }, { moveDuration: 0 }, { birth: { startedAt: 0 } },
      { hurtStartedAt: .1 }, { attack: { startedAt: .1, speed: 1 }, attackStartedAt: .1, mode: "attack" }]) {
      const blocked = { ...unit, ...change };
      audio.reset(playback);
      audio.update(playback, [], .1, animations);
      assert.equal(audio.update(playback, [blocked], .15, animations).length, 0, key);
    }
  }
});

test("게임 재생 경로는 22종에 각각 이동음을 내고 콩 착지음을 덧붙이지 않는다", () => {
  const played = [], movementAudio = audio.create();
  const state = { simSeconds: 0, camera: { layer: 0 }, agents: Object.keys(audio.definitions).map(agent), rivals: [], corpses: [] };
  const scope = createContext({ Spawner: { ...animations, nestGrowthSounds: () => [] }, nestGrowthPlayback: {},
    SpawnerMovementAudio: audio, movementAudio,
    SpawnerCombatAudio: { update: () => [] }, combatAudio: {}, state, connection: { active: true, online: true },
    audioTime: 0, agentAudio: new Map(), deliveryAudio: new Map(), foodDeliveries: new Map(),
    displayedAgent: unit => unit, interpolatedAgentPosition: unit => unit, audioVolume: () => 1,
    audio: { available: () => true, play: name => played.push(name), setHarvest() {} }, agentBirthPose: () => null,
    AGENT_FOOTSTEPS_PER_CELL: 4, clamp: (value, low, high) => Math.max(low, Math.min(high, value)), resetAudio() {} });
  const game = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  runInContext(game.match(/^    function updateAudio\([^]*?^    }/m)[0], scope);
  for (let frame = 0; frame <= 120; frame++) { state.simSeconds = frame / 60; scope.updateAudio(); }
  assert.deepEqual([...new Set(played)].sort(), Object.values(audio.definitions).map(definition => definition.name).sort());
});

test("기본 콩 발소리는 셀당 네 접지만 재생하고 같은 프레임에 중복하지 않는다", () => {
  const unit = { ...agent("bean"), attributes: { feet: 1 }, x: 1, y: 2 };
  const playback = audio.create();
  assert.equal(audio.update(playback, [unit], 0, animations).length, 0);
  const played = [];
  for (let frame = 1; frame <= 120; frame++) {
    const time = frame / 60;
    played.push(...audio.update(playback, [unit], time, animations));
    assert.equal(audio.update(playback, [unit], time, animations).length, 0);
  }
  assert.equal(played.length, 4);
  assert.ok(played.every(event => event.name === "footstep" && event.unit === unit));
});

test("기본 콩 마지막 착지와 이전 셀 착지 좌표를 유지하고 지난 착지는 재생하지 않는다", () => {
  const unit = { ...agent("bean"), x: 3, y: 4 };
  const playback = audio.create();
  audio.update(playback, [unit], 1.8, animations);
  assert.equal(audio.update(playback, [unit], 2, animations)[0].name, "landing");
  assert.equal(audio.update(playback, [unit], 2, animations).length, 0);
  audio.reset(playback);
  audio.update(playback, [unit], 1.8, animations);
  const next = { ...unit, x: 4, y: 4, moveStartedAt: 2, stepCount: 2 };
  const previous = audio.update(playback, [next], 2.05, animations)[0];
  assert.equal(previous.name, "landing");
  assert.equal(previous.position.x, 3);
  assert.equal(previous.position.y, 4);
  audio.reset(playback);
  audio.update(playback, [unit], 1.95, animations);
  assert.equal(audio.update(playback, [next], 2.4, animations).length, 0);
  audio.reset(playback);
  audio.update(playback, [unit], 1.8, animations);
  assert.equal(audio.update(playback, [unit], 3, animations).length, 0);
  assert.equal(audio.update(playback, [], 3.1, animations).length, 0);
  assert.equal(playback.beans.size, 0);
});
