import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createUtilityAI } from "./utility.mjs";
import { unitTravelSpeed } from "./attributes.mjs";

test("기본 정찰은 틱 간격이 달라도 원래 속도로 이동한 뒤 쉬면서 전체 이속을 유지한다", () => {
  const colony = { id: 1, ownerId: "test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set("test", game);
  game.agents.splice(1);
  const agent = game.agents[0];
  const elapsed = [0.07, 0.11, 0.13, 0.09];
  let previous = null, moves = 0, rests = 0;
  for (let index = 0; index < 240; index++) {
    const duration = elapsed[index % elapsed.length];
    environment.simSeconds += duration;
    game.prepare(environment.simSeconds);
    game.tick(duration);
    if (!agent.stepCount) continue;
    if (previous?.step === agent.stepCount) {
      if (environment.simSeconds >= previous.endsAt && environment.simSeconds < previous.readyAt) rests++;
      continue;
    }
    assert.equal(agent.moveDuration, 1);
    if (previous) assert.ok(Math.abs(agent.moveStartedAt - previous.readyAt) < 1e-7,
      "이동 후 휴지 시간을 지키면서 틱 대기 시간이 누적되면 안 됩니다.");
    previous = { step: agent.stepCount, endsAt: agent.moveStartedAt + agent.moveDuration,
      readyAt: agent.moveStartedAt + 1 / unitTravelSpeed(agent, agent.carrying) };
    moves++;
  }
  assert.ok(moves >= 10);
  assert.ok(rests > 0);
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

test("지상 개체는 저산 60%·고산 40%·능선 90%의 속도로 이동한다", () => {
  const plain = firstStep(4, undefined, undefined);
  for (const [terrain, multiplier] of [[6, .6], [7, .4], [8, .9]])
    assert.ok(Math.abs(firstStep(terrain, undefined, undefined) - plain / multiplier) < 1e-7);
});

test("비행 이동 방식과 비행 종은 숲·고산에서만 80%의 속도로 이동한다", () => {
  const plain = firstStep(4, undefined, undefined);
  for (const [terrain, multiplier] of [[5, .8], [6, 1], [7, .8], [8, 1]]) {
    assert.ok(Math.abs(firstStep(terrain, "flying", undefined) - plain / multiplier) < 1e-7);
    for (const species of ["flower-tail-bird", "talon-owl"])
      assert.ok(Math.abs(firstStep(terrain, undefined, species) - plain / multiplier) < 1e-7);
  }
});

test("지상 개체는 빠른 평지 우회로를 고르고 비행 개체는 산지를 가로지른다", () => {
  const size = 7;
  const agent = { x: 0, y: 1, carrying: 0, health: 12, slots: [], stats: { speed: 1, capacity: 2, resistance: 1 },
    personality: { boldness: 0.5 } };
  const state = { simSeconds: 0, evolutionPoints: 20, colonyFood: 0, nestLevel: 1, agents: [agent],
    explored: new Set(Array.from({ length: size * size }, (_, index) => index)) };
  const ai = createUtilityAI({ state, size, homeCells: () => [], deliveryCells: () => [],
    walkable: (x, y) => y >= 0 && y <= 2, hazardAt: () => 0, enemies: () => [], synergy: () => false,
    terrainAt: (x, y) => y === 1 && x > 0 && x < 6 ? 6 : 4, canHarvest: () => true });
  const target = { x: 6, y: 1 };
  const ground = ai.nextStep(agent, target);
  assert.notEqual(ground.y, 1);
  agent.movementType = "flying";
  assert.deepEqual(ai.nextStep(agent, target), { x: 1, y: 1 });
});
