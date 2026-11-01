import test from "node:test";
import assert from "node:assert/strict";
import { tribeHazardKind, tribeTerrainWalkable } from "./tribe-environment.mjs";
import { unitTerrainSpeedMultiplier } from "./attributes.mjs";
import { createUtilityAI } from "./utility.mjs";
import { createGame } from "./game.mjs";

test("늪·수역 통행은 종족의 기본 특성으로 구분하고 제거된 위험 요소는 무시한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    assert.equal(tribeTerrainWalkable(tribe, 0), false);
    assert.equal(tribeTerrainWalkable(tribe, 1), false);
    assert.equal(unitTerrainSpeedMultiplier({ tribe }, 1), 0);
    assert.equal(tribeTerrainWalkable(tribe, 10), true);
    assert.equal(tribeTerrainWalkable(tribe, 9), tribe !== "pebble");
    assert.equal(tribeHazardKind(tribe, 2), 0);
    assert.equal(tribeHazardKind(tribe, 1), 0);
  }
  assert.equal(unitTerrainSpeedMultiplier({ movementType: "flying" }, 1), 1);
  assert.equal(unitTerrainSpeedMultiplier({ tribe: "spring" }, 10), 1);
  assert.equal(unitTerrainSpeedMultiplier({ tribe: "spore" }, 9), .6);
  assert.equal(unitTerrainSpeedMultiplier({ tribe: "pebble" }, 7), .6);
});

test("모든 종족의 일반 개체는 얕은 물을 통과하지 않고 우회한다", () => {
  const size = 5, terrain = (x, y) => y === 1 && x > 0 && x < 4 ? 1 : 4;
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const state = { simSeconds: 0, evolutionPoints: 0, colonyFood: 0, nestLevel: 1, agents: [],
      explored: new Set(Array.from({ length: size * size }, (_, index) => index)) };
    const ai = createUtilityAI({ state, size, homeCells: () => [], deliveryCells: () => [],
      terrainAt: terrain, walkable: (x, y) => y <= 2 && tribeTerrainWalkable(tribe, terrain(x, y)),
      hazardAt: () => 0, enemies: () => [], synergy: () => false, canHarvest: () => true });
    const agent = { x: 0, y: 1, tribe, carrying: 0, health: 20,
      stats: { speed: 1, capacity: 1, resistance: 1 }, personality: { boldness: .5 } };
    const step = ai.nextStep(agent, { x: 4, y: 1 });
    assert.ok(step, tribe);
    assert.notEqual(step.y, 1, tribe);
  }
});

test("몽돌 AI는 늪을 우회하고 샘방울 AI는 빠른 습지 경로를 이용한다", () => {
  const size = 5, terrain = (x, y) => y === 1 && x > 0 && x < 4 ? 9 : 4;
  for (const tribe of ["pebble", "spring"]) {
    const state = { simSeconds: 0, evolutionPoints: 0, colonyFood: 0, nestLevel: 1, agents: [],
      explored: new Set(Array.from({ length: size * size }, (_, index) => index)) };
    const ai = createUtilityAI({ state, size, homeCells: () => [], deliveryCells: () => [],
      terrainAt: terrain, walkable: (x, y) => y <= 2 && tribeTerrainWalkable(tribe, terrain(x, y)),
      hazardAt: () => 0, enemies: () => [], synergy: () => false, canHarvest: () => true });
    const agent = { x: 0, y: 1, tribe, carrying: 0, health: 20,
      stats: { speed: 1, capacity: 1, resistance: 1 }, personality: { boldness: .5 } };
    const step = ai.nextStep(agent, { x: 4, y: 1 });
    if (tribe === "pebble") assert.notEqual(step.y, 1);
    else assert.deepEqual(step, { x: 1, y: 1 });
  }
});

test("기존 월드의 가시 뿌리와 독 포자를 지우고 모든 종족의 채집 피해를 제거한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const colony = { id: 1, ownerId: "test", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
    const environment = { simSeconds: 0, world: { seed: 1, terrain: new Uint8Array(320 * 320).fill(4),
      hazards: new Uint8Array(320 * 320).fill(2) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
    environment.world.hazards[0] = 1;
    const game = createGame(environment, colony);
    environment.games.set("test", game);
    assert.ok(environment.world.hazards.every(kind => kind === 0));
    game.agents.splice(1);
    const agent = game.agents[0], before = agent.health;
    agent.birth = null; agent.mode = "harvest"; agent.harvestReady = 100;
    environment.simSeconds = .25;
    game.prepare(.25); game.tick(.25);
    assert.equal(agent.health, before);
  }
});
