import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { expireCorpses } from "./corpses.mjs";

function fixture() {
  const colony = { id: 1, ownerId: "lifecycle-test", tribe: "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  return { game, environment, agent: game.agents[0] };
}

test("새 개체는 모든 속성을 즉시 적용하고 저장·복원 후에도 설계 순서를 보존한다", () => {
  const { game } = fixture();
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 3;
  saved.state.evolutionPoints = 100;
  game.restore(JSON.stringify(saved));
  const result = game.command({ type: "design", templateId: null, name: "속성 시험", slots: ["strength", "feet"], birth: true });
  const agent = game.agents.find(candidate => candidate.id === result.agentId);
  assert.deepEqual(agent.slots, ["strength", "feet"]);
  assert.equal(agent.attributes.strength, 1);
  game.prepare(35);
  game.tick(0);
  assert.deepEqual(agent.slots, ["strength", "feet"]);
  assert.equal(agent.attributes.strength, 1);
  game.restore(game.save());
  const restored = game.agents.find(candidate => candidate.id === result.agentId);
  assert.deepEqual(restored.slots, ["strength", "feet"]);
  game.prepare(120);
  game.tick(0);
  assert.deepEqual(restored.slots, ["strength", "feet"]);
});

test("사망 시각 없는 저장과 이미 3초 지난 사체는 다시 수명을 부여하지 않는다", () => {
  const food = new Map([
    ["1,1", { kind: "corpse", x: 1, y: 1, amount: 4 }],
    ["2,2", { kind: "corpse", agentId: "old", x: 2, y: 2, amount: 4, diedAt: 10, decaysAt: 610 }]
  ]);
  expireCorpses(food, 100); assert.equal(food.size, 0);
});

test("DNA 개체는 이전 개인 진행 상태를 버리고 부상·설계 능력을 보존한다", () => {
  const { game } = fixture();
  const before = { ...game.agents[0].stats };
  const health = before.health / 2;
  const saved = JSON.parse(game.save());
  Object.assign(saved.state.agents[0], { level: 10, growthActivity: 999999, health,
    perceptionExperienceReady: true, experienceContributions: [{ agentId: "old", damage: 10 }], experienceKillAwarded: true });
  saved.state.nestExperienceContributions = [{ agentId: "old", damage: 10 }];
  game.restore(JSON.stringify(saved));
  assert.deepEqual(game.agents[0].stats, before);
  assert.equal(game.agents[0].health, health);
  game.prepare(35); game.tick(0);
  const restored = JSON.parse(game.save());
  for (const key of ["level", "growthActivity", "activeSlots", "perceptionExperienceReady", "experienceContributions", "experienceKillAwarded"]) {
    assert.equal(Object.hasOwn(restored.state.agents[0], key), false, key);
  }
  assert.equal(Object.hasOwn(restored.state, "nestExperienceContributions"), false);
});

test("채집·운반은 설계 능력을 유지하며 개인 진행 상태를 생성하지 않는다", () => {
  const { game, environment } = fixture();
  const saved = JSON.parse(game.save());
  Object.assign(saved.state.agents[0], { x: 46, y: 42, renderFromX: 46, renderFromY: 42,
    moveStartedAt: 0, moveDuration: 0, moveBudget: 0, birth: null, mode: "harvest",
    harvestStarted: 0, harvestReady: 1, harvestPrepared: false, decisionPending: null, nextDecisionAt: 1000,
    utility: { action: "collect", target: { x: 46, y: 42, key: "46,42" }, route: [{ x: 46, y: 42 }], plannedCargo: 2 } });
  environment.food.set("46,42", { x: 46, y: 42, amount: 2, initialAmount: 2, kind: "resource", resourceType: "clay" });
  game.restore(JSON.stringify(saved));
  const baseline = { ...game.agents[0].stats };
  game.prepare(1); game.tick(1);
  assert.equal(game.agents[0].harvestReady, 1 + baseline.dna.harvestTime);
  const completeAt = 1 + baseline.dna.harvestTime * 2;
  game.prepare(completeAt); game.tick(completeAt - 1);
  assert.equal(game.agents[0].carrying, 2);
  game.prepare(completeAt); game.tick(0);
  const delivery = game.agents[0].utility.route.at(-1);
  const unloading = JSON.parse(game.save());
  Object.assign(unloading.state.agents[0], { x: delivery.x, y: delivery.y, renderFromX: delivery.x, renderFromY: delivery.y,
    mode: "unload", moveDuration: 0, unloadReady: completeAt, decisionPending: null, nextDecisionAt: 1000 });
  game.restore(JSON.stringify(unloading));
  game.prepare(completeAt); game.tick(0);
  assert.equal(game.agents[0].carrying, 0);
  assert.deepEqual(game.agents[0].stats, baseline);
  assert.equal(Object.hasOwn(game.agents[0], "level"), false);
  assert.equal(Object.hasOwn(game.agents[0], "growthActivity"), false);
});
