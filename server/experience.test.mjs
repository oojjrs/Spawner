import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_EXPERIENCE, addAgentExperience, combatExperienceMultiplier, recordCombatExperience } from "./experience.mjs";
import { agentGrowth, growthThreshold } from "./growth.mjs";
import { createGame } from "./game.mjs";
import { createCombat } from "./combat.mjs";

function fixture() {
  const colony = { id: 1, ownerId: "experience-test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  return { game, environment, agent: game.agents[0] };
}

test("행동 경험치는 소수점을 누적하며 생존 시간과 나이 상한 없이 레벨을 결정한다", () => {
  const agent = { bornAt: 0, growthActivity: 0, slots: [] };
  assert.equal(agentGrowth(agent, 10000).level, 1);
  for (let index = 0; index < 150; index++) addAgentExperience(agent, AGENT_EXPERIENCE.exploration);
  assert.equal(agent.growthActivity, 15);
  assert.equal(agentGrowth(agent, 0).level, 2);
  assert.deepEqual(agentGrowth(agent, 0), agentGrowth(agent, 180));
  assert.deepEqual(Array.from({ length: 11 }, (_, index) => growthThreshold(index + 1)),
    [0, 15, 33, 54, 78, 105, 135, 168, 204, 243, 285]);
  agent.growthActivity = 104.999;
  assert.equal(agentGrowth(agent, 0).level, 5);
  addAgentExperience(agent, .001);
  assert.equal(agentGrowth(agent, 0).level, 6);
});

test("출생 시야는 경험치가 없고 새로운 탐색·종류별 발견만 보상하며 복원 후 재지급하지 않는다", () => {
  const { game, environment, agent } = fixture();
  assert.ok(game.agents.every(agent => agent.growthActivity === 0));
  const before = game.snapshot().explored.length;
  Object.assign(agent, { x: 100, y: 100, renderFromX: 100, renderFromY: 100, moveDuration: 0 });
  environment.food.set("100,100", { x: 100, y: 100, amount: 2, initialAmount: 2, kind: "resource", resourceType: "pebbles" });
  const after = game.snapshot();
  assert.equal(agent.growthActivity, (after.explored.length - before) / 10 + 5);
  const earned = agent.growthActivity;
  environment.food.set("100,101", { x: 100, y: 101, amount: 2, initialAmount: 2, kind: "resource", resourceType: "pebbles" });
  game.snapshot();
  assert.equal(agent.growthActivity, earned);
  const saved = game.save();
  const restored = fixture().game;
  restored.restore(saved);
  restored.snapshot();
  assert.equal(restored.agents[0].growthActivity, earned);
});

test("채집과 납품은 실제 수량에 각각 2점과 3점을 지급한다", () => {
  const { game, environment } = fixture();
  const saved = JSON.parse(game.save());
  saved.state.agents.splice(1);
  Object.assign(saved.state.agents[0], { x: 46, y: 42, renderFromX: 46, renderFromY: 42,
    slots: ["strength"], attributeLevels: { strength: 1 }, growthActivity: 0,
    moveStartedAt: 0, moveDuration: 0, moveBudget: 0, birth: null, mode: "harvest",
    harvestStarted: 0, harvestReady: 1, harvestPrepared: false, decisionPending: null, nextDecisionAt: 1000,
    utility: { action: "collect", target: { x: 46, y: 42, key: "46,42" }, route: [{ x: 46, y: 42 }], plannedCargo: 2 } });
  environment.food.set("46,42", { x: 46, y: 42, amount: 2, initialAmount: 2, kind: "resource", resourceType: "clay" });
  game.restore(JSON.stringify(saved));
  game.prepare(1); game.tick(1);
  // Two clay harvests take four seconds each after preparation.
  game.prepare(9); game.tick(8);
  assert.equal(game.agents[0].carrying, 2);
  assert.equal(game.agents[0].growthActivity, 4);
  game.prepare(9); game.tick(0);
  const beforeDelivery = game.agents[0].growthActivity;
  const delivery = game.agents[0].utility.route.at(-1);
  const unloading = JSON.parse(game.save());
  Object.assign(unloading.state.agents[0], { x: delivery.x, y: delivery.y, renderFromX: delivery.x, renderFromY: delivery.y,
    mode: "unload", moveDuration: 0, unloadReady: 9, decisionPending: null, nextDecisionAt: 1000 });
  game.restore(JSON.stringify(unloading));
  game.prepare(9); game.tick(0);
  assert.equal(game.agents[0].carrying, 0);
  assert.equal(game.agents[0].growthActivity, beforeDelivery + 6);
});

test("전투 배율은 대상 종류의 기본 전투력과 유니크 여부를 따른다", () => {
  assert.equal(combatExperienceMultiplier({ species: "dew-rabbit" }), .5);
  assert.equal(combatExperienceMultiplier({ species: "spiny-back-beetle" }), 1);
  assert.equal(combatExperienceMultiplier({ species: "soil-boar" }), 2);
  assert.equal(combatExperienceMultiplier({ species: "white-paw" }), 4);
  assert.equal(combatExperienceMultiplier({ tribe: "pebble", stats: { combatStrength: 100 } }), 1);
});

test("처치 보너스는 저장된 피해 기여도 70대30으로 분배하고 막타에 몰아주지 않는다", () => {
  const first = { id: "a", ownerId: "allies", health: 100 }, second = { id: "b", ownerId: "allies", health: 100 };
  const target = { id: "enemy", ownerId: "enemy", health: 30 };
  recordCombatExperience(first, target, 70, [first, second]);
  const restored = JSON.parse(JSON.stringify(target));
  restored.health = 0;
  recordCombatExperience(second, restored, 30, [first, second]);
  assert.equal(first.growthActivity, 10.5);
  assert.equal(second.growthActivity, 4.5);
  recordCombatExperience(second, restored, 0, [first, second]);
  assert.equal(second.growthActivity, 4.5);
});

test("실제 전투는 초과 피해를 제외하고 한 번만 피해·처치 경험치를 지급한다", () => {
  const attacker = { id: "attacker", ownerId: "left", tribe: "bean", health: 100, combatDisposition: "aggressive",
    x: 100, y: 100, stats: { health: 100, speed: 1, combatStrength: 20 }, attributes: {}, mode: "idle" };
  const target = { ...attacker, id: "target", ownerId: "right", health: 10, combatDisposition: "passive" };
  const environment = { colonies: [], games: new Map(), world: { terrain: new Uint8Array(320 * 320).fill(4) },
    combatRandom: () => .99, damageRandom: () => .5 };
  for (const agent of [attacker, target]) environment.games.set(agent.ownerId, { agents: [agent],
    receiveDamage(unit, damage) { unit.health = Math.max(0, unit.health - damage); } });
  const combat = createCombat(environment);
  combat.update(attacker, 0);
  combat.update(target, 0);
  const hitAt = attacker.attack.hitAt;
  combat.update(attacker, hitAt);
  assert.equal(target.health, 0);
  assert.equal(attacker.growthActivity, 6);
  combat.update(attacker, hitAt);
  assert.equal(attacker.growthActivity, 6);
});
