import test from "node:test";
import assert from "node:assert/strict";
import { creatureSpawnPose } from "./creature-spawn.mjs";
import { createEncounters } from "../server/encounters.mjs";
import { WORLD_SIZE } from "../server/world-size.mjs";
import { ENCOUNTER_TYPES } from "../server/encounter-types.mjs";

function fixture(species, simSeconds = 0) {
  const x = 40, y = 40, cells = [];
  for (let cy = 32; cy < 48; cy++) for (let cx = 32; cx < 48; cx++) cells.push(cy * WORLD_SIZE + cx);
  const game = { agents: [], discoveredKinds: new Set(), colonyFood: 0, isVisible: () => false };
  const room = { simSeconds, colonies: [], games: new Map([["test", game]]), food: new Map(), world: {
    size: WORLD_SIZE, terrain: new Uint8Array(WORLD_SIZE * WORLD_SIZE).fill(4), hazards: new Uint8Array(WORLD_SIZE * WORLD_SIZE), encounters: [
      { key: species, x, y, radius: 8, safeRadius: 0, terrains: [4], nearWater: false,
        cells, route: [], spawnPoints: [y * WORLD_SIZE + x], populationLimit: 1, homeId: null }
    ] } };
  const system = createEncounters(room, null, []);
  room.creatureSystem = { get agents() { return system.agents; }, burrowAt() { return null; } };
  return { room, system, game };
}

test("소모한 중립 유닛은 관측 여부와 관계없이 보충하지 않는다", () => {
  for (const species of ["soil-mole", "snare-vine"]) {
    const type = ENCOUNTER_TYPES.find(type => type.key === species);
    const f = fixture(species, type.firstSpawnAt), first = f.system.agents[0];
    assert.ok(first, "현재 등장 시각에서 검증할 유닛이 생성된다");
    f.system.receiveDamage(first, 1000);
    f.room.food.clear();
    f.room.simSeconds += type.respawnSeconds;
    f.game.isVisible = () => true;
    f.system.tick();
    assert.equal(f.system.agents.length, 0);
    f.game.isVisible = () => false;
    f.system.tick();
    assert.equal(f.system.agents.length, 0);
    assert.equal(createEncounters(f.room, f.system.save(), []).agents.length, 0);
  }
});

test("흙두더지의 잠복 반응에 전용 등장 연출이나 대기를 추가하지 않는다", () => {
  const f = fixture("soil-mole"), mole = f.system.agents[0];
  f.game.agents.push({ id: "gatherer", ownerId: "test", health: 10, x: 41, y: 40, mode: "gather", attributes: {} });
  f.room.simSeconds = 1;
  f.system.tick();
  assert.equal(mole.hidden, false);
  assert.equal(mole.spawn, undefined);
  assert.equal(mole.mode, "walk");
  assert.ok(mole.moveDuration > 0, "등장 대기 없이 즉시 움직인다");
});

test("이전 저장의 전용 등장 상태도 해제한다", () => {
  for (const species of ["soil-mole", "snare-vine"]) {
    const now = ENCOUNTER_TYPES.find(type => type.key === species).firstSpawnAt;
    const f = fixture(species, now), agent = f.system.agents[0];
    agent.spawn = { kind: species, startedAt: 0, readyAt: 3, fromX: 40, fromY: 40 };
    agent.mode = "spawn"; agent.nextActionAt = 3;
    assert.equal(creatureSpawnPose(agent, 1), null);
    const restored = createEncounters(f.room, f.system.save(), []);
    assert.equal(restored.agents[0].spawn, undefined);
    assert.equal(restored.agents[0].mode, "idle");
    assert.equal(restored.agents[0].nextActionAt, now);
  }
});

test("일반종의 최초 배치가 관측으로 막혀도 재시도하지 않는다", () => {
  const f = fixture("shadow-weasel");
  assert.equal(f.system.agents.length, 0);
  f.game.isVisible = () => true;
  f.room.simSeconds = ENCOUNTER_TYPES.find(type => type.key === "shadow-weasel").firstSpawnAt;
  f.system.tick();
  assert.equal(f.system.agents.length, 0);
  f.game.isVisible = () => false;
  f.system.tick();
  f.room.simSeconds += 60; f.system.tick();
  assert.equal(f.system.agents.length, 0);
  const unseen = fixture("shadow-weasel");
  unseen.room.simSeconds = f.room.simSeconds; unseen.system.tick();
  assert.equal(unseen.system.agents.length, 1);
  assert.equal(unseen.system.agents[0].spawn, undefined);
});

test("유니크는 보장 시각의 최초 등장 규칙을 유지한다", () => {
  const f = fixture("old-garden-snail");
  assert.equal(f.system.agents.length, 0);
  f.game.isVisible = () => true;
  f.room.simSeconds = ENCOUNTER_TYPES.find(type => type.key === "old-garden-snail").guaranteedAt;
  f.system.tick();
  assert.equal(f.system.agents.length, 1);
});
