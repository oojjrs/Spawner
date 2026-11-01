import test from "node:test";
import assert from "node:assert/strict";
import { applyAgentGrowth } from "./growth.mjs";
import { attributeCounts, unitStats, unitMovementSpeed } from "./attributes.mjs";
import { unitCombatStats } from "./combat-stats.mjs";
import { createGame } from "./game.mjs";

function fixture(tribe) {
  const colony = { id: 1, ownerId: "growth-test", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  return { game, environment };
}

test("Lv.5는 모든 부족의 설계에 이동 8%·채집 20%·전투력 2를 더하고 다른 능력과 체력을 유지한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const slots = ["feet", "strength", "antenna", "lifespan", "construction"];
    const base = unitStats(attributeCounts(slots), tribe);
    const agent = { tribe, slots, stats: { ...base }, health: 43, lifespan: base.lifespan, growthActivity: 100 };
    applyAgentGrowth(agent, 0);
    assert.equal(agent.level, 5);
    assert.ok(Math.abs(unitMovementSpeed(agent.stats) / unitMovementSpeed(base) - 1.08) < 1e-12);
    assert.equal(agent.stats.harvestSpeedMultiplier, 1.2);
    assert.equal(agent.stats.combatStrength, unitCombatStats(tribe).combatStrength + 2);
    for (const key of ["capacity", "vision", "health", "lifespan", "resistance"]) assert.equal(agent.stats[key], base[key]);
    assert.equal(agent.health, 43);
    assert.equal(agent.lifespan, base.lifespan);
    const once = { ...agent.stats };
    assert.equal(applyAgentGrowth(agent, 100), false);
    assert.deepEqual(agent.stats, once);
    agent.level = 0;
    applyAgentGrowth(agent, 100);
    assert.deepEqual(agent.stats, once);
  }
});

test("실제 게임은 저장·복원 때 레벨 보너스를 한 번 적용하고 부상 체력을 회복시키지 않는다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const { game } = fixture(tribe);
    const baseline = unitMovementSpeed(game.agents[0].stats);
    const saved = JSON.parse(game.save());
    saved.state.agents[0].growthActivity = 100;
    saved.state.agents[0].health = 43;
    game.restore(JSON.stringify(saved));
    const agent = game.agents[0];
    assert.equal(agent.level, 5);
    assert.ok(Math.abs(unitMovementSpeed(agent.stats) - baseline * 1.08) < 1e-12);
    assert.equal(agent.stats.harvestSpeedMultiplier, 1.2);
    assert.equal(agent.stats.combatStrength, unitCombatStats(tribe).combatStrength + 2);
    const once = { ...agent.stats };
    game.restore(game.save());
    assert.deepEqual(game.agents[0].stats, once);
    assert.equal(game.agents[0].health, 43);
  }
});

test("Lv.5 채집 속도 20%는 준비 시간 뒤의 실제 채집 주기를 1.2로 나눈다", () => {
  const { game, environment } = fixture("bean");
  const saved = JSON.parse(game.save());
  saved.state.agents.splice(1);
  Object.assign(saved.state.agents[0], { x: 46, y: 42, renderFromX: 46, renderFromY: 42,
    slots: ["strength"], attributeLevels: { strength: 1 }, growthActivity: 100,
    moveStartedAt: 0, moveDuration: 0, moveBudget: 0, birth: null, mode: "harvest",
    harvestStarted: 0, harvestReady: 1, harvestPrepared: false, decisionPending: null, nextDecisionAt: 1000,
    utility: { action: "collect", target: { x: 46, y: 42, key: "46,42" }, route: [{ x: 46, y: 42 }], plannedCargo: 2 } });
  environment.food.set("46,42", { x: 46, y: 42, amount: 2, initialAmount: 2, kind: "resource", resourceType: "clay" });
  game.restore(JSON.stringify(saved));
  game.prepare(1); game.tick(1);
  const firstHarvest = 1 + 4 / 1.2;
  assert.ok(Math.abs(game.agents[0].harvestReady - firstHarvest) < 1e-12);
  game.prepare(firstHarvest - .001); game.tick(firstHarvest - 1 - .001);
  assert.equal(game.agents[0].carrying, 0);
  game.prepare(firstHarvest); game.tick(.001);
  assert.equal(game.agents[0].carrying, 1);
  assert.equal(game.agents[0].growthActivity, 102);
});
