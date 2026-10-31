import test from "node:test";
import assert from "node:assert/strict";
import { creatureSpawnPose } from "./creature-spawn.mjs";
import { createEncounters } from "../server/encounters.mjs";
import { ENCOUNTER_TYPES } from "../server/encounter-types.mjs";

function fixture(species) {
  const x = 40, y = 40, cells = [];
  for (let cy = 32; cy < 48; cy++) for (let cx = 32; cx < 48; cx++) cells.push(cy * 320 + cx);
  const game = { agents: [], discoveredKinds: new Set(), colonyFood: 0, isVisible: () => false };
  const room = { simSeconds: 0, colonies: [], games: new Map([["test", game]]), food: new Map(), world: {
    terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), encounters: [
      { key: species, x, y, radius: 8, safeRadius: 0, terrains: [4], nearWater: false,
        cells, route: [], spawnPoints: [y * 320 + x], populationLimit: 1, homeId: null }
    ] } };
  const system = createEncounters(room, null, []);
  room.creatureSystem = { get agents() { return system.agents; }, burrowAt() { return null; } };
  return { room, system, game };
}

test("두 유닛은 관측 중인 서식지의 보충을 보류하고 시야 밖에서 연출 없이 생성한다", () => {
  for (const species of ["soil-mole", "snare-vine"]) {
    const f = fixture(species), first = f.system.agents[0];
    f.system.receiveDamage(first, 1000);
    f.room.food.clear();
    f.room.simSeconds = ENCOUNTER_TYPES.find(type => type.key === species).respawnSeconds;
    f.game.isVisible = () => true;
    f.system.tick();
    assert.equal(f.system.agents.length, 0);
    f.game.isVisible = () => false;
    f.system.tick();
    assert.equal(f.system.agents.length, 1);
    assert.equal(f.system.agents[0].spawn, undefined);
  }
});

test("흙두더지의 잠복 반응에 전용 등장 연출이나 대기를 추가하지 않는다", () => {
  const f = fixture("soil-mole"), mole = f.system.agents[0];
  f.game.agents.push({ id: "gatherer", ownerId: "test", health: 10, x: 41, y: 40, mode: "gather", attributes: {} });
  f.room.simSeconds = 1;
  f.system.tick();
  assert.equal(mole.hidden, false);
  assert.equal(mole.spawn, undefined);
  assert.equal(mole.mode, "idle");
});

test("이전 저장의 전용 등장 상태도 해제한다", () => {
  for (const species of ["soil-mole", "snare-vine"]) {
    const f = fixture(species), agent = f.system.agents[0];
    agent.spawn = { kind: species, startedAt: 0, readyAt: 3, fromX: 40, fromY: 40 };
    agent.mode = "spawn"; agent.nextActionAt = 3;
    assert.equal(creatureSpawnPose(agent, 1), null);
    const restored = createEncounters(f.room, f.system.save(), []);
    assert.equal(restored.agents[0].spawn, undefined);
    assert.equal(restored.agents[0].mode, "idle");
    assert.equal(restored.agents[0].nextActionAt, 0);
  }
});

test("시간 조건으로 처음 등장하는 일반종도 관측 중인 서식지에서는 보류한다", () => {
  const f = fixture("shadow-weasel");
  assert.equal(f.system.agents.length, 0);
  f.game.isVisible = () => true;
  f.room.simSeconds = ENCOUNTER_TYPES.find(type => type.key === "shadow-weasel").firstSpawnAt;
  f.system.tick();
  assert.equal(f.system.agents.length, 0);
  f.game.isVisible = () => false;
  f.system.tick();
  assert.equal(f.system.agents.length, 1);
  assert.equal(f.system.agents[0].spawn, undefined);
});

test("유니크는 보장 시각의 최초 등장 규칙을 유지한다", () => {
  const f = fixture("old-garden-snail");
  assert.equal(f.system.agents.length, 0);
  f.game.isVisible = () => true;
  f.room.simSeconds = ENCOUNTER_TYPES.find(type => type.key === "old-garden-snail").guaranteedAt;
  f.system.tick();
  assert.equal(f.system.agents.length, 1);
});
