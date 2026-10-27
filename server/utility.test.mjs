import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createPersonality, personalityLabels, actionScore, riskValue } from "./utility.mjs";

function fixture(slots) {
  const colony = { id: 1, ownerId: "test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 120, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set("test", game);
  const saved = JSON.parse(game.save());
  saved.state.agents = [];
  saved.state.nestLevel = 2;
  saved.state.evolutionPoints = 20;
  game.restore(JSON.stringify(saved));
  const result = game.command({ type: "design", name: "동일 설계", templateId: null, slots, birth: true });
  assert.ok(result.agentId, "검사할 설계 개체가 실제로 생성되어야 합니다.");
  assert.equal(game.agents.length, 1);
  const agent = game.agents.find(candidate => candidate.id === result.agentId);
  Object.assign(agent, { x: 43, y: 42, renderFromX: 43, renderFromY: 42, bornAt: 0, birth: null,
    utility: null, decisionPending: "restore", nextDecisionAt: environment.simSeconds,
    path: [{ x: 43, y: 42 }], visited: new Set(["43,42"]) });
  game.restore(game.save());
  return { game, environment, agent: game.agents.find(candidate => candidate.id === result.agentId) };
}

function advance(fixture, seconds) {
  const steps = Math.round(seconds / 0.1);
  for (let index = 0; index < steps; index++) {
    fixture.environment.simSeconds += 0.1;
    fixture.game.prepare(fixture.environment.simSeconds);
    fixture.game.tick(0.1);
  }
}

function enemy(fixture, x, y) {
  const agent = { id: "rival:1", x, y, health: 12, cost: 3, carrying: 0, attributes: {},
    stats: { health: 12, attack: 1, speed: 1, vision: 3 }, moveStartedAt: 0, moveDuration: 0 };
  fixture.environment.games.set("rival", { agents: [agent], receiveDamage(target, amount) { target.health -= amount; } });
  return agent;
}

test("논의한 같은 상황에서 성향별로 귀환·채집·전투·탐색을 고른다", () => {
  const plans = [
    { action: "collect", foodGain: 40, riskReduction: -20 },
    { action: "return", foodGain: 20, riskReduction: 5 },
    { action: "explore", informationGain: 30, riskReduction: -8 },
    { action: "fight", combatGain: 40, riskReduction: -25 },
    { action: "recover", healingGain: 7, riskReduction: 8 },
    { action: "flee", riskReduction: 15 }
  ].map(plan => ({ foodGain: 0, combatGain: 0, informationGain: 0, healingGain: 0, ...plan }));
  for (const [boldness, aggression, curiosity, expected] of [[0.5, 0.5, 0.5, "return"], [0.8, 0.2, 0.2, "collect"],
    [0.8, 0.8, 0.2, "fight"], [0.5, 0.5, 0.8, "explore"], [0.2, 0.8, 0.2, "return"]]) {
    const personality = { boldness, aggression, curiosity };
    const ranked = plans.toSorted((a, b) => actionScore(personality, { food: 1, defense: 1, information: 1 }, b) -
      actionScore(personality, { food: 1, defense: 1, information: 1 }, a));
    assert.equal(ranked[0].action, expected);
  }
});

test("출생 단계는 세 축에서 독립적으로 균등하고 성향 객체는 고정한다", () => {
  let draw = 0;
  const counts = { boldness: [0, 0, 0], aggression: [0, 0, 0], curiosity: [0, 0, 0] };
  for (let index = 0; index < 300; index++) {
    const personality = createPersonality(() => (++draw % 900) / 900);
    assert.ok(Object.isFrozen(personality));
    for (const key of Object.keys(counts)) counts[key][Math.floor(personality[key] * 3)]++;
  }
  for (const values of Object.values(counts)) assert.deepEqual(values, [100, 100, 100]);
});

test("같은 설계의 성향은 다르고 저장·복원과 설계 수정에도 유지한다", () => {
  const f = fixture([]);
  f.game.command({ type: "birth", templateId: 1 });
  const personalities = f.game.agents.map(agent => ({ ...agent.personality }));
  assert.notDeepEqual(personalities[0], personalities[1]);
  f.game.command({ type: "design", templateId: 1, name: "설계 수정", slots: ["strength"], birth: false });
  const saved = f.game.save();
  f.game.restore(saved);
  assert.deepEqual(f.game.agents.map(agent => ({ ...agent.personality })), personalities);
  const snapshot = f.game.snapshot().agents[0];
  assert.deepEqual(snapshot.personalityLabels, personalityLabels(personalities[0]));
  assert.equal("personality" in snapshot, false);
  assert.equal("utility" in snapshot, false);
  const legacy = JSON.parse(saved);
  for (const agent of legacy.state.agents) delete agent.personality;
  f.game.restore(JSON.stringify(legacy));
  const migrated = f.game.agents.map(agent => ({ ...agent.personality }));
  f.game.restore(JSON.stringify(legacy));
  assert.deepEqual(f.game.agents.map(agent => ({ ...agent.personality })), migrated);
});

test("안개 속 적·먹이는 판단에 쓰지 않고 군락의 새 적 발견은 즉시 재판단한다", () => {
  const f = fixture([]);
  const rival = enemy(f, 65, 42);
  f.environment.food.set("65,43", { x: 65, y: 43, amount: 999, terrain: "grassland", kind: "resource", resourceType: "clay" });
  advance(f, 0.1);
  assert.ok(!f.agent.utility.scores.some(score => score.action === "fight" || score.key === "65,43"));
  const count = f.agent.decisionCount;
  const next = f.agent.nextDecisionAt;
  Object.assign(rival, { x: f.agent.x + 2, y: f.agent.y });
  advance(f, 0.1);
  assert.ok(f.agent.decisionCount > count);
  assert.ok(f.agent.lastDecisionAt < next);
  assert.equal(f.agent.lastDecisionReason, "enemyDiscovered");
});

test("다른 개체가 가한 피격은 다음 주기를 기다리지 않고 바로 재판단한다", () => {
  const f = fixture([]);
  advance(f, 0.1);
  const count = f.agent.decisionCount;
  const next = f.agent.nextDecisionAt;
  f.game.receiveDamage(f.agent, 1);
  assert.equal(f.agent.decisionCount, count + 1);
  assert.equal(f.agent.lastDecisionReason, "damage");
  assert.ok(f.agent.lastDecisionAt < next);
});

test("먹이 목표가 고갈되면 즉시 다른 후보를 선택한다", () => {
  const f = fixture(["strength"]);
  f.environment.food.set("43,42", { x: 43, y: 42, amount: 10, terrain: "grassland", kind: "resource", resourceType: "clay" });
  advance(f, 0.1);
  assert.equal(f.agent.utility.action, "collect");
  const count = f.agent.decisionCount;
  f.environment.food.get("43,42").amount = 0;
  advance(f, 0.1);
  assert.ok(f.agent.decisionCount > count);
  assert.notEqual(f.agent.utility.action, "collect");
  assert.equal(f.agent.lastDecisionReason, "targetLost");
});

test("실제 이동·시간제 채집·하역으로만 포인트를 얻는다", () => {
  const f = fixture(["strength", "antenna"]);
  f.environment.food.set("43,42", { x: 43, y: 42, amount: 12, terrain: "grassland", kind: "resource", resourceType: "clay" });
  const before = f.game.snapshot().evolutionPoints;
  advance(f, 1);
  assert.equal(f.game.snapshot().evolutionPoints, before);
  advance(f, 30);
  assert.ok(f.game.snapshot().colonyFood > 0);
  assert.ok(f.game.snapshot().evolutionPoints > before);
  assert.ok(f.environment.food.get("43,42").amount < 12);
});

test("회복은 둥지에서만 적용되고 부분 회복 뒤에도 다시 판단한다", () => {
  const f = fixture([]);
  f.agent.health = 4;
  f.agent.personality = Object.freeze({ boldness: 0, aggression: 0, curiosity: 0 });
  advance(f, 0.1);
  assert.equal(f.agent.utility.action, "recover");
  advance(f, 14);
  assert.ok(f.agent.health > 7);
  assert.ok(f.agent.decisionCount >= 5);
});

test("체력·생산 비용·먹이가 손실 위험을 높인다", () => {
  const agent = { health: 12, cost: 3, carrying: 0 };
  const base = riskValue(agent, 3);
  assert.ok(riskValue({ ...agent, health: 3 }, 3) > base);
  assert.ok(riskValue({ ...agent, cost: 8 }, 3) > base);
  assert.ok(riskValue({ ...agent, carrying: 8 }, 3) > base);
});

test("적 처치는 6번째 프레임에 소유 군락에 전달하고 교전 종료 후 목표를 갱신한다", () => {
  const f = fixture([]);
  f.agent.combatDisposition = "aggressive";
  f.game.agents.splice(1);
  f.agent.personality = Object.freeze({ boldness: 1, aggression: 1, curiosity: 0 });
  const colony = { id: 2, ownerId: "second", x: 70, y: 70, occupiedCells: new Set(["2,2"]) };
  f.environment.colonies.push(colony);
  const other = createGame(f.environment, colony);
  f.environment.games.set("second", other);
  other.agents.splice(1);
  const target = other.agents[0];
  Object.assign(target, { x: f.agent.x, y: f.agent.y, health: 1, renderFromX: f.agent.x, renderFromY: f.agent.y });
  other.prepare(0);
  advance(f, 0.1);
  assert.equal(target.health, 1);
  advance(f, 0.2);
  assert.equal(target.health, 1);
  advance(f, 0.1);
  assert.equal(other.agents.length, 0);
  assert.ok([...f.environment.food.values()].some(food => food.kind === "corpse"));
  const finishedAt = f.agent.attack.exchangeEndsAt;
  advance(f, finishedAt - f.environment.simSeconds);
  assert.equal(f.agent.lastDecisionReason, "combatEnded");
});

test("이동이 끝나기 전에는 도착 칸의 채집을 시작하지 않는다", () => {
  const f = fixture(["strength", "antenna"]);
  f.environment.food.set("46,42", { x: 46, y: 42, amount: 10, terrain: "grassland", kind: "resource", resourceType: "clay" });
  let moving = false;
  for (let step = 0; step < 120 && f.agent.mode !== "harvest"; step++) {
    advance(f, 0.1);
    if (f.environment.simSeconds + 1e-8 < f.agent.moveStartedAt + f.agent.moveDuration) {
      moving = true;
      assert.equal(f.agent.carrying, 0);
      assert.notEqual(f.agent.mode, "harvest");
    }
  }
  assert.ok(moving, "도착 전 실제 이동 중인 상태를 검사해야 합니다.");
  assert.equal(f.agent.mode, "harvest");
  assert.ok(f.agent.harvestStarted >= f.agent.moveStartedAt + f.agent.moveDuration - 0.000001);
  advance(f, 1.1);
  assert.ok(f.agent.carrying >= 2);
});

test("상태 요청마다 저장·복원해도 채집과 하역을 이어간다", () => {
  const f = fixture(["strength", "antenna"]);
  f.environment.food.set("46,42", { x: 46, y: 42, amount: 50, terrain: "grassland", kind: "resource", resourceType: "clay" });
  const before = f.game.snapshot().evolutionPoints;
  for (let request = 0; request < 80; request++) {
    const saved = f.game.save();
    f.game = createGame(f.environment, f.environment.colonies[0]);
    f.game.restore(saved);
    f.environment.games.set("test", f.game);
    f.agent = f.game.agents[0];
    advance(f, 0.5);
  }
  assert.ok(f.environment.food.get("46,42").amount < 50);
  assert.ok(f.game.snapshot().colonyFood > 0);
  assert.ok(f.game.snapshot().evolutionPoints > before);
});

test("식량 비축량과 무관하게 부족 먹이를 모으고 잠긴 재료는 선택하지 않는다", () => {
  const f = fixture([]);
  f.game.agents.splice(1);
  Object.assign(f.agent, { actionPriorities: ["collect", "explore"],
    personality: Object.freeze({ boldness: 0, aggression: 0, curiosity: 0 }) });
  f.environment.food.set("43,42", { x: 43, y: 42, amount: 30, terrain: "grassland", kind: "resource", resourceType: "clay" });
  f.environment.food.set("42,43", { x: 42, y: 43, amount: 30, terrain: "grassland", kind: "resource", resourceType: "tree" });
  let saved = JSON.parse(f.game.save());
  saved.state.evolutionPoints = 0;
  saved.state.agents[0].decisionPending = "completed";
  f.game.restore(JSON.stringify(saved));
  f.agent = f.game.agents[0];
  advance(f, 0.1);
  assert.equal(f.agent.utility.action, "collect");
  assert.equal(f.agent.utility.target.key, "43,42");
  saved = JSON.parse(f.game.save());
  saved.state.evolutionPoints = 25;
  saved.state.agents[0].decisionPending = "completed";
  f.game.restore(JSON.stringify(saved));
  f.agent = f.game.agents[0];
  advance(f, 0.1);
  assert.equal(f.agent.utility.action, "collect");
  assert.equal(f.agent.utility.target.key, "43,42");
  assert.ok(!f.agent.utility.scores.some(score => score.action === "collect" && score.key === "42,43"));
});
