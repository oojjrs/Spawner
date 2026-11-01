import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createGame } from "../server/game.mjs";
import { createCreatures } from "../server/creatures.mjs";
import { AGENT_ATTACK_HIT_TIME } from "../server/attack.mjs";
import { BEETLE_ANIMATIONS } from "../server/beetle-animation.mjs";
import { ENCOUNTER_TYPES } from "../server/encounter-types.mjs";

const scope = createContext({});
runInContext(readFileSync(new URL("./combat-audio.js", import.meta.url), "utf8"), scope);
const combat = scope.SpawnerCombatAudio;
const names = events => Array.from(events, event => event.name);

test("일반·유니크 18종은 몸 재질에 맞는 기존 피격음을 한 번씩 재생한다", () => {
  const agents = ENCOUNTER_TYPES.map((type, index) => ({ id: "hurt-" + index, species: type.key, health: 100 }));
  assert.equal(agents.length, 18);
  const playback = combat.create();
  combat.update(playback, agents, [], 9.9);
  for (const agent of agents) {
    agent.hurtStartedAt = 10;
    agent.hurtCount = 1;
    assert.equal(combat.cue(combat.material(agent), "hurt", 1).name, agent.species === "spiny-back-leader" ? "beetle-hurt" : "sprout-hurt");
  }
  assert.equal(combat.update(playback, agents, [], 10.019).length, 0);
  assert.deepEqual(names(combat.update(playback, agents, [], 10.02)), agents.map(agent => agent.species === "spiny-back-leader" ? "beetle-hurt" : "sprout-hurt"));
  assert.equal(combat.update(playback, agents, [], 10.03).length, 0);
  const corpses = agents.map(agent => ({ ...agent, agentId: agent.id, diedAt: 10.01 }));
  assert.equal(combat.update(playback, [], corpses, 10.04).length, 0);
});

test("일반·유니크 18종 공격음은 작화 타격 직전에 종별로 한 번씩 재생한다", () => {
  for (const type of ENCOUNTER_TYPES) {
    const animation = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/CreatureAttackV2/" + type.key + "/attack.json", import.meta.url), "utf8"));
    const hitTime = animation.durationsMs.slice(0, animation.impactFrame).reduce((sum, duration) => sum + duration, 0) / 1000;
    const unit = { id: type.key, species: type.key, health: 100 };
    assert.equal(combat.material(unit), type.key);
    for (const speed of [1, 2]) {
      const sound = combat.cue(type.key, "attack", speed);
      assert.equal(sound.name, type.key + "-attack");
      const mastering = JSON.parse(readFileSync(new URL("../DesignAssets/Audio/CreatureAttackV2/" + type.key + ".json", import.meta.url), "utf8"));
      assert.equal(sound.at, (hitTime - mastering.audioLeadMs / 1000) / speed);
      assert.equal(combat.sources[sound.name], "DesignAssets/Audio/CreatureAttackV2/" + type.key + ".mp3");
      const playback = combat.create();
      unit.attack = null;
      combat.update(playback, [unit], [], 10);
      unit.attack = { startedAt: 10, speed };
      assert.equal(combat.update(playback, [unit], [], 10 + sound.at / 2).length, 0);
      assert.equal(combat.update(playback, [unit], [], 10 + sound.at - .001).length, 0);
      assert.deepEqual(names(combat.update(playback, [unit], [], 10 + sound.at)), [sound.name]);
      assert.equal(combat.update(playback, [unit], [], 10 + sound.at + .01).length, 0);
    }
  }
});

function fixture(tribe) {
  const colony = { id: 1, ownerId: "combat-audio", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), sites: [], burrows: [] },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  return { game, agent: game.agents[0], environment };
}

test("가시등 우두머리는 딱정벌레의 공격·피격 음원을 공유한다", () => {
  const base = readFileSync(new URL("../DesignAssets/Audio/beetle-attack.mp3", import.meta.url));
  const leader = readFileSync(new URL("../DesignAssets/Audio/CreatureAttackV2/spiny-back-leader.mp3", import.meta.url));
  assert.deepEqual(leader, base);
  assert.equal(combat.cue("spiny-back-leader", "hurt", 1).name, combat.cue("beetle", "hurt", 1).name);
  const sourceLead = BEETLE_ANIMATIONS.attack.hitTimeMs / 1000 - combat.cue("beetle", "attack", 1).at;
  assert.ok(Math.abs(.53 - combat.cue("spiny-back-leader", "attack", 1).at - sourceLead) < 1e-9);
});

test("공격 예비 동작은 명중 프레임에 앞서며 공격 속도에 따라 함께 빨라진다", () => {
  assert.equal(combat.cue("sprout", "attack", 1).at, AGENT_ATTACK_HIT_TIME - .06);
  assert.equal(combat.cue("spring", "attack", 2).at, (AGENT_ATTACK_HIT_TIME - .06) / 2);
  assert.equal(combat.cue("beetle", "attack", 1).at, BEETLE_ANIMATIONS.attack.hitTimeMs / 1000 - .08);
  for (const speed of [1, 2]) {
    const playback = combat.create();
    const agent = { id: "attacker", tribe: "bean", health: 10 };
    combat.update(playback, [agent], [], 10);
    agent.attack = { startedAt: 10, speed };
    assert.equal(combat.update(playback, [agent], [], 10 + .24 / speed - .001).length, 0);
    assert.deepEqual(names(combat.update(playback, [agent], [], 10 + .24 / speed)), ["unit-attack"]);
    assert.equal(combat.update(playback, [agent], [], 10 + .24 / speed + .01).length, 0);
  }
});

test("서버가 기록한 피해 대상 종족으로 피격음을 고르고 치명타도 사체에서 이어받는다", () => {
  for (const [tribe, sound] of [["bean", "sprout"], ["spore", "spore"], ["pebble", "pebble"], ["spring", "spring"]]) {
    const { game, agent } = fixture(tribe);
    const playback = combat.create();
    combat.update(playback, game.agents, [], 9.9);
    game.prepare(10);
    game.receiveDamage(agent, 1);
    assert.equal(agent.hurtStartedAt, 10);
    assert.equal(agent.hurtCount, 1);
    assert.equal(combat.update(playback, game.agents, [], 10.019).length, 0);
    assert.deepEqual(names(combat.update(playback, game.agents, [], 10.02)), [sound + "-hurt"]);
    game.prepare(10.1);
    game.receiveDamage(agent, 10000);
    const corpses = game.snapshot().corpses;
    assert.equal(game.agents.length, 0);
    assert.equal(corpses[0].hurtStartedAt, 10.1);
    assert.equal(corpses[0].hurtCount, 2);
    assert.deepEqual(names(combat.update(playback, [], corpses, 10.12)), [sound + "-hurt"]);
    const at = 10.1 + combat.cue(sound, "death", 1).at;
    assert.deepEqual(names(combat.update(playback, [], corpses, at)), [sound + "-death"]);
    assert.equal(combat.update(playback, [], corpses, at + .01).length, 0);
  }
});

test("보호막이 전부 흡수한 타격과 피해량 0에는 몸 재질 피격음을 만들지 않는다", () => {
  const { game, agent } = fixture("pebble");
  game.prepare(10);
  agent.shield = 10;
  agent.shieldUntil = 20;
  game.receiveDamage(agent, 1);
  game.receiveDamage(agent, 0);
  assert.equal(agent.hurtStartedAt, undefined);
  assert.equal(agent.hurtCount, undefined);
});

test("딱정벌레는 피격과 사망을 기록하고 사체 전환 후 다시 재생하지 않는다", () => {
  const { environment } = fixture("bean");
  environment.world.burrows = [{ id: "burrow:small:64130", type: "small", x: 130, y: 200, width: 1, height: 1, entrance: { x: 130, y: 201 } }];
  environment.world.creatureDensity = new Uint8Array(320 * 320).fill(255);
  const system = createCreatures(environment, null);
  const agent = system.agents[0];
  const playback = combat.create();
  combat.update(playback, [agent], [], 9.9);
  environment.simSeconds = 10;
  system.receiveDamage(agent, 1);
  assert.deepEqual(names(combat.update(playback, [agent], [], 10.04)), ["beetle-hurt"]);
  environment.simSeconds = 10.1;
  system.receiveDamage(agent, 10000);
  assert.deepEqual(names(combat.update(playback, [agent], [], 10.1)), ["beetle-death"]);
  assert.deepEqual(names(combat.update(playback, [agent], [], 10.14)), ["beetle-hurt"]);
  const corpse = { kind: "corpse", species: agent.species, agentId: agent.id, diedAt: agent.deathStartedAt,
    hurtStartedAt: agent.hurtStartedAt, hurtCount: agent.hurtCount };
  assert.equal(combat.update(playback, [], [corpse], 10.2).length, 0);
});

test("재접속·음소거 해제·되감기와 오래된 사체는 지난 소리를 다시 재생하지 않는다", () => {
  const unit = { id: "unit", tribe: "spring", health: 10, hurtStartedAt: 10, hurtCount: 1 };
  const corpse = { agentId: "old", tribe: "pebble", diedAt: 1 };
  const playback = combat.create();
  assert.equal(combat.update(playback, [unit], [corpse], 10.02).length, 0);
  combat.reset(playback);
  assert.equal(combat.update(playback, [unit], [corpse], 10.03).length, 0);
  assert.equal(combat.update(playback, [unit], [corpse], 9).length, 0);
  assert.equal(combat.update(playback, [unit], [corpse], 20).length, 0);
});

test("게임 재생 경로는 공격자가 다른 종족이어도 피해자 위치와 재질로 재생한다", () => {
  const attacker = { id: "attacker", tribe: "bean", health: 10, x: 1, y: 1, attributes: {}, moveDuration: 0 };
  const victim = { id: "victim", tribe: "spore", health: 9, x: 8, y: 9, attributes: {}, moveDuration: 0 };
  const played = [], volumes = [];
  const context = createContext({ SpawnerCombatAudio: combat, combatAudio: combat.create(),
    Spawner: { nestGrowthSounds: () => [] }, nestGrowthPlayback: {},
    connection: { active: true, online: true }, state: { simSeconds: 10, camera: { layer: 0 }, agents: [attacker, victim], rivals: [], corpses: [] },
    audio: { available: () => true, play: (name, volume) => played.push({ name, volume }), stop() {}, setHarvest() {} },
    audioTime: null, agentAudio: new Map(), deliveryAudio: new Map(), foodDeliveries: new Map(), AGENT_FOOTSTEPS_PER_CELL: 4,
    displayedAgent: unit => unit, interpolatedAgentPosition: unit => ({ x: unit.x, y: unit.y }), agentBirthPose: () => null,
    isHarvestingFood: () => false, audioVolume: (x, y) => { volumes.push({ x, y }); return .7; } });
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  for (const name of ["resetAudio", "updateAudio"]) runInContext(source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0], context);
  context.updateAudio();
  victim.hurtStartedAt = 10;
  victim.hurtCount = 1;
  context.state.simSeconds = 10.02;
  context.updateAudio();
  assert.deepEqual(played, [{ name: "spore-hurt", volume: .7 }]);
  assert.ok(volumes.some(point => point.x === 8.5 && point.y === 9.5));
  context.updateAudio();
  assert.equal(played.length, 1);
  context.connection.online = false;
  context.updateAudio();
  context.connection.online = true;
  context.updateAudio();
  assert.equal(played.length, 1);
});

test("게임·기획서와 로컬 실행 목록이 같은 전투 음원을 참조한다", () => {
  const local = createContext({});
  runInContext(readFileSync(new URL("./local-assets.js", import.meta.url), "utf8"), local);
  const design = readFileSync(new URL("../Design.html", import.meta.url), "utf8");
  const html = readFileSync(new URL("../Spawner.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("client/combat-audio.js") < html.indexOf("client/audio.js"));
  assert.ok(design.includes('src="client/combat-audio.js"'));
  assert.equal([...design.matchAll(/data-combat-material=/g)].length, 51);
  for (const name of Object.values(combat.sources)) {
    assert.ok(existsSync(new URL("../" + name, import.meta.url)));
    assert.ok(local.SpawnerLocalAssetFiles.includes("./client/local-assets/" + name.slice("DesignAssets/".length) + ".js"));
  }
});

test("이동음이 채널을 채워도 피격·사망음이 우선하며 모든 음원의 재생 게인은 유효하다", async () => {
  const started = [], stopped = [], gains = [], compressors = [], limiters = [], listeners = {};
  let clock;
  class AudioContext {
    constructor() { this.state = "running"; this.currentTime = 1; this.destination = {}; clock = this; }
    createDynamicsCompressor() {
      const node = { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect(target) { this.destination = target; } };
      compressors.push(node);
      return node;
    }
    createWaveShaper() {
      const node = { connect(target) { this.destination = target; } };
      limiters.push(node);
      return node;
    }
    createGain() {
      const gain = { gain: { value: 1 }, connect(target) { this.destination = target; } };
      gains.push(gain);
      return gain;
    }
    createBufferSource() {
      return { connect(target) { this.destination = target; }, disconnect() {}, start() { started.push(this); },
        stop() { stopped.push(this); queueMicrotask(() => this.onended?.()); } };
    }
    async decodeAudioData(encoded) { return { name: new TextDecoder().decode(encoded) }; }
  }
  const button = { addEventListener() {}, setAttribute() {} };
  const context = createContext({ SpawnerCombatAudio: combat, AudioContext,
    SpawnerMusic: { create: () => ({ unlock() {}, suspend() {}, update() {} }) },
    SpawnerAssets: { source: value => value },
    fetch: async name => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(name).buffer }),
    document: { hidden: false, getElementById: () => button, addEventListener: (name, callback) => { listeners[name] = callback; } },
    window: { addEventListener() {} }, performance, setTimeout, clearTimeout });
  runInContext(readFileSync(new URL("./audio.js", import.meta.url), "utf8"), context);
  const engine = context.SpawnerAudio.create();
  await listeners.pointerdown();
  assert.ok(engine.available());
  for (let index = 0; index < 6; index++) { clock.currentTime += .2; engine.play("footstep", 1); }
  engine.play("landing", 1);
  engine.play("throw", 1);
  assert.equal(started.length, 8);
  engine.play("spore-hurt", 1);
  engine.play("pebble-death", 1);
  assert.ok(started.some(source => source.buffer.name.endsWith("spore-hurt.mp3")));
  assert.ok(started.some(source => source.buffer.name.endsWith("pebble-death.mp3")));
  assert.equal(stopped.length, 2);
  engine.stop();
  await engine.playClick();
  engine.play("discovery", 1);
  engine.setHarvest(new Map([["clay", 1]]));
  assert.ok(gains.every(gain => Number.isFinite(gain.gain.value)));
  assert.equal(compressors.length, 1);
  assert.equal(limiters.length, 1);
  for (const source of started) assert.equal(source.destination.destination, gains[0]);
  assert.equal(gains[0].destination, compressors[0]);
  assert.equal(compressors[0].destination, limiters[0]);
  assert.equal(limiters[0].destination, gains[1]);
  assert.equal(gains[1].destination, clock.destination);
  assert.ok(limiters[0].curve.every(value => Math.abs(value) <= 10 ** (-31.99 / 20)));
  engine.stop();
});
