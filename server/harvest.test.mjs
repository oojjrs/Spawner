import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { resourceDefinition } from "./resources.mjs";

function fixture(resourceType, amount, slots) {
  const colony = { id: 1, ownerId: "harvest-test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const food = { x: 46, y: 42, amount, initialAmount: amount, terrain: "grassland",
    kind: resourceType === "meat" ? "corpse" : resourceDefinition(resourceType).category === "material" ? "resource" : "food",
    resourceType };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(),
    food: new Map([["46,42", food]]), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 4;
  Object.assign(saved.state.agents[0], {
    x: 46, y: 42, renderFromX: 46, renderFromY: 42, slots, rulesVersion: 2, carrying: 0,
    carryingType: null, birth: null, mode: "approach", moveStartedAt: 0, moveDuration: 0, moveBudget: 0,
    harvestResult: null, decisionPending: null, nextDecisionAt: 1000,
    personality: { boldness: 0, aggression: 0, curiosity: 0 },
    utility: { action: "collect", target: { x: 46, y: 42, key: "46,42" },
      route: [{ x: 46, y: 42 }], plannedCargo: 8 }
  });
  game.restore(JSON.stringify(saved));
  const result = { game, environment, food, agent: game.agents[0] };
  advanceTo(result, 0);
  assert.equal(result.agent.mode, "harvest");
  assert.equal(result.agent.harvestReady, 1);
  return result;
}

function advanceTo(fixture, seconds) {
  const elapsed = seconds - fixture.environment.simSeconds;
  fixture.environment.simSeconds = seconds;
  fixture.game.prepare(seconds);
  fixture.game.tick(elapsed);
}

test("준비 1초와 버섯 채집 주기를 지킨 성공 틱에 수량·적재물·결과가 함께 바뀐다", () => {
  for (const resourceType of ["honey-mushrooms"]) {
    const f = fixture(resourceType, 5, []);
    advanceTo(f, 0.999);
    assert.equal(f.agent.harvestResult, null);
    assert.equal(f.food.amount, 5);
    assert.equal(f.agent.carrying, 0);
    advanceTo(f, 1);
    assert.equal(f.agent.harvestPrepared, true);
    assert.equal(f.agent.harvestResult, null);
    const completedAt = 1 + resourceDefinition(resourceType).harvestSeconds;
    advanceTo(f, completedAt - 0.001);
    assert.equal(f.agent.harvestResult, null);
    assert.equal(f.food.amount, 5);
    assert.equal(f.agent.carrying, 0);
    advanceTo(f, completedAt + 0.001);
    assert.equal(f.food.amount, 4);
    assert.equal(f.agent.carrying, 1);
    assert.equal(f.agent.carryingType, resourceType);
    assert.deepEqual(f.agent.harvestResult, {
      sequence: 1, resourceType, x: 46, y: 42, amount: 1, remaining: 4, initialAmount: 5,
      kind: f.food.kind, terrain: "grassland", completedAt
    });
    assert.deepEqual(f.game.snapshot().agents[0].harvestResult, f.agent.harvestResult);
  }
});

test("마지막 수량이 0이 되어 노드가 시야 목록에서 사라져도 성공 결과는 남는다", () => {
  const f = fixture("honey-mushrooms", 1, []);
  advanceTo(f, 1);
  advanceTo(f, 2.5);
  assert.equal(f.food.amount, 0);
  assert.equal(f.agent.carrying, 1);
  const result = f.agent.harvestResult;
  assert.equal(result.remaining, 0);
  assert.equal(result.amount, 1);
  assert.equal(result.completedAt, 2.5);
  assert.ok(!f.game.snapshot().food.some(food => food.x === 46 && food.y === 42));
  advanceTo(f, 2.6);
  assert.deepEqual(f.game.snapshot().agents[0].harvestResult, result);
});

test("수확을 중단하면 이전 결과를 유지하고 다음 예정 시각에도 새 성공을 만들지 않는다", () => {
  const f = fixture("honey-mushrooms", 6, []);
  advanceTo(f, 1);
  advanceTo(f, 2.5);
  const result = f.agent.harvestResult;
  const amount = f.food.amount;
  const carrying = f.agent.carrying;
  const ready = f.agent.harvestReady;
  Object.assign(f.agent, { mode: "search", utility: null, decisionPending: null, nextDecisionAt: 1000 });
  advanceTo(f, ready + 0.1);
  assert.equal(f.food.amount, amount);
  assert.equal(f.agent.carrying, carrying);
  assert.strictEqual(f.agent.harvestResult, result);
});

test("저장 복원은 최근 성공과 sequence를 보존하고 다음 성공에서 한 번만 증가한다", () => {
  const f = fixture("honey-mushrooms", 6, []);
  advanceTo(f, 1);
  advanceTo(f, 2.5);
  const first = structuredClone(f.agent.harvestResult);
  const saved = f.game.save();
  f.game = createGame(f.environment, f.environment.colonies[0]);
  f.game.restore(saved);
  f.environment.games.set("harvest-test", f.game);
  f.agent = f.game.agents[0];
  assert.deepEqual(f.agent.harvestResult, first);
  advanceTo(f, 3.999);
  assert.deepEqual(f.agent.harvestResult, first);
  advanceTo(f, 4);
  assert.equal(f.agent.harvestResult.sequence, 2);
  assert.equal(f.agent.harvestResult.completedAt, 4);
  assert.equal(f.agent.carrying, 2);
  assert.equal(f.food.amount, 4);
  assert.equal(f.agent.harvestResult.remaining, 4);
});

test("정밀 수확의 즉시 2개 채집은 늦은 틱에서도 준비 완료 예정 시각의 단일 결과다", () => {
  const f = fixture("honey-mushrooms", 6, ["strength", "antenna"]);
  advanceTo(f, 0.999);
  assert.equal(f.agent.harvestResult, null);
  advanceTo(f, 1.2);
  assert.equal(f.food.amount, 4);
  assert.equal(f.agent.carrying, 2);
  assert.equal(f.agent.harvestResult.sequence, 1);
  assert.equal(f.agent.harvestResult.amount, 2);
  assert.equal(f.agent.harvestResult.remaining, 4);
  assert.equal(f.agent.harvestResult.completedAt, 1);
  assert.equal(f.agent.harvestReady, 2.5);
});

test("밀린 수확 여러 건은 실제 예정 시각마다 sequence를 증가시키고 마지막 결과를 남긴다", () => {
  const f = fixture("honey-mushrooms", 20, ["strength"]);
  advanceTo(f, 1);
  advanceTo(f, 6.1);
  assert.equal(f.food.amount, 17);
  assert.equal(f.agent.carrying, 3);
  assert.equal(f.agent.harvestResult.sequence, 3);
  assert.equal(f.agent.harvestResult.completedAt, 5.5);
  assert.equal(f.agent.harvestResult.amount, 1);
  assert.equal(f.agent.harvestResult.remaining, 17);
  assert.equal(f.agent.harvestReady, 7);
});

test("잠긴 먹이와 자원의 기존 접근·수확 명령은 복원 후 수확하지 않는다", () => {
  for (const resourceType of ["berry-bush", "root-bulbs", "nutrient-moss", "seed-pods", "quartz", "meat"]) {
    for (const mode of ["approach", "harvest"]) {
      const f = fixture("honey-mushrooms", 6, ["strength", "antenna"]);
      f.food.resourceType = resourceType;
      f.agent.mode = mode;
      f.agent.harvestPrepared = true;
      f.game.restore(f.game.save());
      f.agent = f.game.agents[0];
      advanceTo(f, 10);
      assert.equal(f.food.amount, 6, resourceType + ": " + mode);
      assert.equal(f.agent.carrying, 0);
      assert.equal(f.agent.harvestResult, null);
      assert.notEqual(f.agent.utility?.action, "collect");
    }
  }
});

test("한 개만 남은 같은 노드를 두 일꾼이 수확하면 실제로 받은 개체만 성공한다", () => {
  const f = fixture("honey-mushrooms", 1, []);
  const second = structuredClone(f.agent);
  second.id = "harvest-test:second";
  f.game.agents.push(second);
  advanceTo(f, 1);
  advanceTo(f, 2.5);
  assert.equal(f.food.amount, 0);
  assert.equal(f.agent.carrying + second.carrying, 1);
  const results = f.game.agents.map(agent => agent.harvestResult).filter(Boolean);
  assert.equal(results.length, 1);
  assert.equal(results[0].sequence, 1);
  assert.equal(results[0].amount, 1);
  assert.equal(results[0].remaining, 0);
});
