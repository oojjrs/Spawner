import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createGame } from "../server/game.mjs";
import { createCreatures } from "../server/creatures.mjs";
import { AGENT_ATTACK_HIT_TIME } from "../server/attack.mjs";
import { BEETLE_ANIMATIONS } from "../server/beetle-animation.mjs";

const scope = createContext({});
runInContext(readFileSync(new URL("./combat-audio.js", import.meta.url), "utf8"), scope);
const combat = scope.SpawnerCombatAudio;
const names = events => Array.from(events, event => event.name);

function fixture(tribe) {
  const colony = { id: 1, ownerId: "combat-audio", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), sites: [], burrows: [] },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  return { game, agent: game.agents[0], environment };
}

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
  assert.equal([...design.matchAll(/data-combat-material=/g)].length, 20);
  for (const name of Object.values(combat.sources)) {
    assert.ok(existsSync(new URL("../" + name, import.meta.url)));
    assert.ok(local.SpawnerLocalAssetFiles.includes("./client/local-assets/" + name.slice("DesignAssets/".length) + ".js"));
  }
});

test("이동음이 채널을 채워도 피격·사망음이 우선하며 모든 음원의 재생 게인은 유효하다", async () => {
  const started = [], stopped = [], gains = [], listeners = {};
  let clock;
  class AudioContext {
    constructor() { this.state = "running"; this.currentTime = 1; clock = this; }
    createGain() {
      const gain = { gain: { value: 0 }, connect() {} };
      gains.push(gain);
      return gain;
    }
    createBufferSource() {
      return { connect() {}, disconnect() {}, start() { started.push(this); },
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
  assert.ok(gains.every(gain => Number.isFinite(gain.gain.value)));
  engine.stop();
});
