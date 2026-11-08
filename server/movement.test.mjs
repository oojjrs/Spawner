import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createUtilityAI } from "./utility.mjs";

test("현재 시작 DNA 일꾼은 틱 간격이 달라도 1초 이동 후 쉬면서 실제 이속을 유지한다", () => {
  const colony = { id: 1, ownerId: "test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set("test", game);
  game.agents.splice(1);
  const agent = game.agents[0];
  assert.equal(agent.stats.speed, .5);
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
    assert.equal(agent.moveAnimationStartedAt, agent.moveStartedAt);
    if (previous) assert.ok(Math.abs(agent.moveStartedAt - previous.readyAt) < 1e-7,
      "이동 후 휴지 시간을 지키면서 틱 대기 시간이 누적되면 안 됩니다.");
    previous = { step: agent.stepCount, endsAt: agent.moveStartedAt + agent.moveDuration,
      readyAt: agent.moveStartedAt + 1.5 };
    moves++;
  }
  assert.ok(moves >= 5);
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
  assert.equal(agent.stats.speed, .5);
  let startedAt = null;
  for (let index = 0; index < 240; index++) {
    const previous = agent.stepCount;
    environment.simSeconds += 0.1;
    game.prepare(environment.simSeconds);
    game.tick(0.1);
    if (agent.stepCount === previous) continue;
    assert.equal(agent.moveDuration, 1);
    assert.equal(agent.moveAnimationStartedAt, agent.moveStartedAt);
    if (startedAt !== null) return agent.moveStartedAt - startedAt;
    startedAt = agent.moveStartedAt;
  }
  assert.fail("산지에서도 이동 동작 사이의 휴식으로 두 걸음을 이어가야 합니다.");
}

test("지상 개체는 동작을 1초로 유지하고 저산 60%·고산 40%·능선 90%에 맞춰 이동 간격을 늘린다", () => {
  assert.ok(Math.abs(firstStep(4, undefined, undefined) - 1.5) < 1e-7);
  for (const [terrain, period] of [[6, (1 + 2 / .6) / 2], [7, 3], [8, (1 + 2 / .9) / 2]])
    assert.ok(Math.abs(firstStep(terrain, undefined, undefined) - period) < 1e-7);
});

test("비행 이동 방식과 비행 종은 동작을 1초로 유지하고 숲·고산에서만 이동 간격을 늘린다", () => {
  for (const [terrain, period] of [[5, 1.75], [6, 1.5], [7, 1.75], [8, 1.5]]) {
    assert.ok(Math.abs(firstStep(terrain, "flying", undefined) - period) < 1e-7);
    for (const species of ["flower-tail-bird", "talon-owl"])
      assert.ok(Math.abs(firstStep(terrain, undefined, species) - period) < 1e-7);
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
    terrainAt: (x, y) => y === 1 && x > 0 && x < 6 ? 7 : 4, canHarvest: () => true });
  const target = { x: 6, y: 1 };
  const ground = ai.nextStep(agent, target);
  assert.notEqual(ground.y, 1);
  agent.movementType = "flying";
  assert.deepEqual(ai.nextStep(agent, target), { x: 1, y: 1 });
});
