import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createUtilityAI } from "./utility.mjs";

test("연속 정찰 이동은 틱 간격이 달라도 직전 이동 종료 시각에 이어진다", () => {
  const colony = { id: 1, ownerId: "test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set("test", game);
  game.agents.splice(1);
  const agent = game.agents[0];
  const elapsed = [0.07, 0.11, 0.13, 0.09];
  let previous = null, moves = 0;
  for (let index = 0; index < 500; index++) {
    const duration = elapsed[index % elapsed.length];
    environment.simSeconds += duration;
    game.prepare(environment.simSeconds);
    game.tick(duration);
    if (!agent.stepCount || previous?.step === agent.stepCount) continue;
    if (previous) assert.ok(Math.abs(agent.moveStartedAt - previous.endsAt) < 1e-7,
      "정찰 중 다음 칸을 시작하기 전에 틱 대기 시간이 누적되면 안 됩니다.");
    previous = { step: agent.stepCount, endsAt: agent.moveStartedAt + agent.moveDuration };
    moves++;
  }
  assert.ok(moves >= 20);
  assert.ok(agent.moveBudget >= 0);
});

function firstStep(terrain, movementType, species) {
  const colony = { id: 1, ownerId: "test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(terrain),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set("test", game);
  game.agents.splice(1);
  const agent = game.agents[0];
  agent.movementType = movementType;
  agent.species = species;
  for (let index = 0; index < 60 && agent.stepCount === 0; index++) {
    environment.simSeconds += 0.1;
    game.prepare(environment.simSeconds);
    game.tick(0.1);
  }
  assert.ok(agent.stepCount > 0, "산지에서도 이동할 수 있어야 합니다.");
  return agent.moveDuration;
}

test("산지 3종에서 지상 개체는 평지 속도의 60%로 이동한다", () => {
  const plain = firstStep(4, undefined, undefined);
  for (const terrain of [6, 7, 8]) assert.ok(Math.abs(firstStep(terrain, undefined, undefined) - plain / 0.6) < 1e-7);
});

test("비행 이동 방식과 비행 종은 산지 감속을 받지 않는다", () => {
  const plain = firstStep(4, undefined, undefined);
  for (const terrain of [6, 7, 8]) {
    assert.equal(firstStep(terrain, "flying", undefined), plain);
    for (const species of ["flower-tail-bird", "talon-owl"]) assert.equal(firstStep(terrain, undefined, species), plain);
  }
});

test("지상 개체는 빠른 평지 우회로를 고르고 비행 개체는 산지를 가로지른다", () => {
  const size = 7;
  const agent = { x: 0, y: 1, carrying: 0, health: 12, stats: { speed: 1, capacity: 2, resistance: 1 },
    personality: { boldness: 0.5 } };
  const state = { explored: new Set(Array.from({ length: size * size }, (_, index) => index)) };
  const ai = createUtilityAI({ state, size, homeCells: () => [], deliveryCells: () => [],
    walkable: (x, y) => y >= 0 && y <= 2, hazardAt: () => 0, enemies: () => [], synergy: () => false,
    terrainAt: (x, y) => y === 1 && x > 0 && x < 6 ? 6 : 4, canHarvest: () => true });
  const target = { x: 6, y: 1 };
  const ground = ai.nextStep(agent, target);
  assert.notEqual(ground.y, 1);
  agent.movementType = "flying";
  assert.deepEqual(ai.nextStep(agent, target), { x: 1, y: 1 });
});
