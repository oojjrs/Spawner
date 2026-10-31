import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { buildingCost, materialCapacity, buildingAt, buildingDefinition, constructionSeconds } from "./buildings.mjs";
import { attributeUpgradeCost } from "./attributes.mjs";

function fixture() {
  const occupiedCells = new Set(["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"]);
  const colony = { id: 1, ownerId: "building-test", x: 40, y: 40, tribe: "bean", occupiedCells };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 2; saved.state.evolutionPoints = 200;
  saved.state.resourceInventory = { clay: 50, tree: 50, pebbles: 50, dew: 20, "grass-fiber": 20 };
  saved.state.agents = [saved.state.agents[0]];
  saved.state.agents[0].slots = ["construction"];
  saved.state.agents[0].attributeLevels = { construction: 1 };
  Object.assign(saved.state.agents[0], { x: 46, y: 42, renderFromX: 46, renderFromY: 42, moveDuration: 0, birth: null });
  saved.state.agents[0].lifespan = 1000;
  saved.state.explored = { collection: "Set", entries: [] };
  for (let y = 34; y <= 55; y++) for (let x = 34; x <= 55; x++) saved.state.explored.entries.push(y * 320 + x);
  game.restore(JSON.stringify(saved));
  return { game, environment, agentId: game.agents[0].id };
}

function advance(context, seconds) {
  const until = context.environment.simSeconds + seconds;
  while (context.environment.simSeconds < until) {
    context.environment.simSeconds = Math.min(until, context.environment.simSeconds + .25);
    context.game.prepare(context.environment.simSeconds);
    context.game.tick(.25);
  }
}

function advanceUntil(context, complete) {
  const deadline = context.environment.simSeconds + 180;
  while (!complete() && context.environment.simSeconds < deadline) advance(context, .25);
  assert.ok(complete(), JSON.stringify(context.game.snapshot().agents.map(agent => ({
    id: agent.id, mode: agent.mode, construction: agent.construction, transport: agent.transport
  }))));
}

function addCouriers(context) {
  const { game } = context;
  if (game.snapshot().templates.some(template => template.name === "자재 운반 테스트")) return;
  const { templateId } = game.command({ type: "design", templateId: null, name: "자재 운반 테스트", slots: ["strength", "feet"], birth: false });
  for (const [x, y] of [[40, 40], [44, 40], [40, 44]]) {
    const { agentId } = game.command({ type: "birth", templateId });
    const agent = game.agents.find(candidate => candidate.id === agentId);
    Object.assign(agent, { x, y, renderFromX: x, renderFromY: y, birth: null, moveStartedAt: 0, moveDuration: 0,
      nextDecisionAt: 0, decisionPending: "restore", personality: { boldness: 0, aggression: 0, curiosity: 0 } });
  }
}

function laboratory(game) {
  const saved = JSON.parse(game.save());
  saved.state.buildings = [{ id: "building:1:lab", key: "evolution-lab", x: 51, y: 51, health: 100 }];
  game.restore(JSON.stringify(saved));
}

function restoreConstructionPlan(context, agentId, buildingKey, x, y) {
  addCouriers(context);
  const { game } = context;
  const saved = JSON.parse(game.save());
  const agent = saved.state.agents.find(candidate => candidate.id === agentId);
  const route = [{ x: agent.x, y: agent.y }];
  while (route.at(-1).x !== x) route.push({ x: route.at(-1).x + Math.sign(x - route.at(-1).x), y: route.at(-1).y });
  while (route.at(-1).y !== y) route.push({ x, y: route.at(-1).y + Math.sign(y - route.at(-1).y) });
  agent.construction = { buildingKey, x, y, route, routeIndex: 0, state: "moving", startedAt: null, readyAt: null, orderedAt: saved.state.simSeconds };
  agent.utility = null; agent.decisionPending = null; agent.mode = "build"; agent.moveBudget = 0;
  game.restore(JSON.stringify(saved));
}

test("방벽을 해제하면 저장된 방벽과 변태 계획을 제거하고 재료를 보존한다", () => {
  const { game, agentId, environment } = fixture();
  const saved = JSON.parse(game.save()), inventory = { ...saved.state.resourceInventory };
  saved.state.buildings = [{ id: "retired-barrier", key: "barrier", x: 53, y: 45, health: 240 }];
  saved.state.agents[0].construction = { buildingKey: "barrier", x: 46, y: 42,
    route: [{ x: 46, y: 42 }], routeIndex: 0, state: "transforming", startedAt: 0, readyAt: 3 };
  game.restore(JSON.stringify(saved));
  assert.equal(buildingDefinition("barrier"), undefined);
  assert.equal(buildingCost("barrier", "bean"), null);
  assert.equal(game.buildings.length, 0);
  assert.equal(buildingAt(environment, 53, 45), null);
  assert.equal(game.agents.find(agent => agent.id === agentId).construction, null);
  assert.deepEqual(game.snapshot().resourceInventory, inventory);
});

test("변태는 기본 15초와 최소 10초를 보장하며 감시봉은 1×1칸을 점유한다", () => {
  for (const key of ["storage", "evolution-lab", "outpost", "watchpost"]) {
    assert.deepEqual([buildingDefinition(key).width, buildingDefinition(key).height], key === "watchpost" ? [1, 1] : key === "outpost" ? [3, 3] : [2, 2]);
    assert.deepEqual([1, 2, 3, 4].map(level => constructionSeconds(key, level)), [15, 12.75, 10.5, 10]);
  }
});

test("예전 3초짜리 변태 저장은 공급 진척을 유지하며 15초 구간으로 복원한다", () => {
  const context = fixture(), { game, agentId } = context;
  const builder = game.agents[0]; builder.x = 48; builder.y = 42; builder.moveDuration = 0;
  restoreConstructionPlan(context, agentId, "storage", 48, 42);
  advance(context, .25);
  advanceUntil(context, () => game.agents.find(agent => agent.id === agentId).construction?.progress > 0);
  const saved = JSON.parse(game.save()), plan = saved.state.agents[0].construction;
  plan.startedAt = saved.state.simSeconds - 1; plan.readyAt = plan.startedAt + 3;
  game.restore(JSON.stringify(saved));
  const restored = game.agents[0].construction;
  assert.equal(restored.readyAt - restored.startedAt, 15);
  assert.ok(Math.abs((context.environment.simSeconds - restored.startedAt) / 15 - 1 / 3) < 1e-8);
  assert.equal(restored.progress, plan.progress);
  advance(context, 9.5); game.restore(game.save());
  assert.equal(game.buildings.length, 0);
  advanceUntil(context, () => game.buildings.length === 1);
  assert.equal(game.buildings.length, 1);
  assert.equal(game.snapshot().resourceInventory.clay, 40);
});

test("전초둥지의 기존 모서리 경로를 복원해도 부지 가운데 칸에 도착한 뒤 변태한다", () => {
  const context = fixture(), { game, agentId } = context;
  restoreConstructionPlan(context, agentId, "outpost", 48, 42);
  advance(context, .25);
  assert.deepEqual(game.agents.find(agent => agent.id === agentId).construction.route.at(-1), { x: 49, y: 43 });
  advanceUntil(context, () => game.buildings.length === 1);
  assert.equal(game.buildings.length, 1);
  assert.deepEqual([game.buildings[0].x, game.buildings[0].y], [48, 42]);
  assert.equal(game.agents.some(agent => agent.id === agentId), false);
});

test("같은 속성은 한 번만 장착하고 강화는 둥지 단계와 재료를 요구한다", () => {
  const { game } = fixture();
  assert.throws(() => game.command({ type: "design", templateId: null, name: "중복", slots: ["feet", "feet"], birth: false }), /설계 속성/);
  const { templateId } = game.command({ type: "design", templateId: null, name: "광부", slots: ["piercing"], birth: false });
  assert.throws(() => game.command({ type: "upgrade-attribute", templateId, attributeKey: "piercing" }), /진화실/);
  laboratory(game);
  const before = game.snapshot(), cost = attributeUpgradeCost("piercing", 2);
  game.command({ type: "upgrade-attribute", templateId, attributeKey: "piercing" });
  const after = game.snapshot();
  assert.equal(after.templates[0].attributeLevels.piercing, 2);
  assert.equal(after.evolutionPoints, before.evolutionPoints - cost.evolutionPoints);
  for (const [key, amount] of Object.entries(cost.materials)) assert.equal(after.resourceInventory[key], before.resourceInventory[key] - amount);
  assert.throws(() => game.command({ type: "upgrade-attribute", templateId, attributeKey: "piercing" }), /둥지/);
  assert.equal(game.snapshot().templates[0].attributeLevels.piercing, 2);
  const born = game.command({ type: "birth", templateId });
  assert.equal(game.agents.find(agent => agent.id === born.agentId).attributes.piercing, 2);
  assert.equal(game.agents[0].attributes.construction, 1);
});

test("설계 수정으로 강화 단계를 주입하지 못하며 기존 강화는 유지한다", () => {
  const { game } = fixture(); laboratory(game);
  const { templateId } = game.command({ type: "design", templateId: null, name: "광부", slots: ["piercing"], attributeLevels: { piercing: 4 }, birth: false });
  assert.equal(game.snapshot().templates[0].attributeLevels.piercing, 1);
  game.command({ type: "upgrade-attribute", templateId, attributeKey: "piercing" });
  game.command({ type: "design", templateId, name: "광부 수정", slots: ["piercing", "feet"], attributeLevels: { feet: 4 }, birth: false });
  assert.deepEqual(game.snapshot().templates[0].attributeLevels, { piercing: 2, feet: 1 });
  game.command({ type: "design", templateId, name: "광부 수정", slots: ["feet"], birth: false });
  game.restore(game.save());
  game.command({ type: "design", templateId, name: "광부 수정", slots: ["piercing"], unlockedAttributeLevels: { piercing: 4 }, birth: false });
  assert.equal(game.snapshot().templates[0].attributeLevels.piercing, 2);
  assert.equal(game.snapshot().templates[0].unlockedAttributeLevels.piercing, 2);
});

test("변태 계획을 복원한 개체는 현장으로 이동하고 완료할 때 한 번만 소모한다", () => {
  const context = fixture(), { game, agentId } = context;
  const before = game.snapshot();
  restoreConstructionPlan(context, agentId, "storage", 48, 42);
  assert.equal(game.snapshot().agents[0].construction.state, "moving");
  assert.equal(game.snapshot().resourceInventory.clay, before.resourceInventory.clay);
  advanceUntil(context, () => game.buildings.length === 1);
  const after = game.snapshot();
  assert.equal(after.buildings.length, 1);
  assert.equal(after.buildings[0].key, "storage");
  assert.equal(after.agents.some(agent => agent.id === agentId), false);
  assert.equal(after.resourceInventory.clay, before.resourceInventory.clay - buildingCost("storage", "bean").materials.clay);
  assert.equal(after.resourceCapacity, before.resourceCapacity + 300);
});

test("이동과 변신 도중 취소하면 개체와 자원을 보존한다", () => {
  const context = fixture(), { game, agentId } = context;
  const before = game.snapshot().resourceInventory;
  restoreConstructionPlan(context, agentId, "storage", 48, 42);
  game.command({ type: "cancel-build", agentId });
  assert.deepEqual(game.snapshot().resourceInventory, before);
  assert.equal(game.agents[0].construction, null);
  const agent = game.agents[0];
  agent.x = 48; agent.y = 42; agent.moveDuration = 0;
  restoreConstructionPlan(context, agentId, "storage", 48, 42);
  advance(context, .25);
  assert.equal(game.agents[0].construction.state, "transforming");
  game.command({ type: "cancel-build", agentId });
  assert.deepEqual(game.snapshot().resourceInventory, before);
  assert.equal(game.agents.some(candidate => candidate.id === agentId), true);
});

test("자재 공급이 끊기면 개체와 현장 진척을 보존하고 납품 후 완공한다", () => {
  const context = fixture(), { game, agentId } = context;
  restoreConstructionPlan(context, agentId, "storage", 48, 42);
  const saved = JSON.parse(game.save()); saved.state.resourceInventory.clay = 0;
  game.restore(JSON.stringify(saved));
  advance(context, 30);
  assert.equal(game.snapshot().buildings.length, 0);
  assert.equal(game.agents.some(agent => agent.id === agentId), true);
  const plan = game.agents.find(agent => agent.id === agentId).construction;
  assert.equal(plan.supplyWaiting, true);
  assert.equal(plan.progress, 0);
  assert.equal(game.agents.find(agent => agent.id === agentId).constructionError ?? null, null);
  const supplied = JSON.parse(game.save()); supplied.state.resourceInventory.clay = 50;
  game.restore(JSON.stringify(supplied));
  advanceUntil(context, () => game.buildings.length === 1);
  assert.equal(game.snapshot().resourceInventory.clay, 40);
  assert.equal(game.agents.some(agent => agent.id === agentId), false);
});

test("변신 중 저장과 복원을 거쳐도 완료·재료 소모는 한 번만 발생한다", () => {
  const context = fixture(), { game, agentId } = context;
  const agent = game.agents[0]; agent.x = 48; agent.y = 42; agent.moveDuration = 0;
  restoreConstructionPlan(context, agentId, "storage", 48, 42);
  advanceUntil(context, () => game.agents.find(agent => agent.id === agentId).construction?.progress > 0);
  const before = game.agents.find(agent => agent.id === agentId).construction;
  const progress = before.progress, delivered = { ...before.delivered }, consumed = { ...before.consumed };
  game.restore(game.save());
  const restored = game.agents.find(agent => agent.id === agentId).construction;
  assert.equal(restored.progress, progress);
  assert.deepEqual(restored.delivered, delivered);
  assert.deepEqual(restored.consumed, consumed);
  advanceUntil(context, () => game.buildings.length === 1);
  assert.equal(game.snapshot().resourceInventory.clay, 40);
  assert.equal(game.snapshot().buildings.length, 1);
  game.restore(game.save()); advance(context, 4);
  assert.equal(game.snapshot().resourceInventory.clay, 40);
  assert.equal(game.snapshot().buildings.length, 1);
});

test("감시봉은 수동 철거를 거부하고 피해로 파괴되면 통행 점유를 해제한다", () => {
  const { game, environment } = fixture();
  const saved = JSON.parse(game.save());
  saved.state.buildings = [{ id: "building:1:watch", key: "watchpost", x: 53, y: 45, health: 80 }];
  game.restore(JSON.stringify(saved));
  assert.equal(game.isVisible(62, 45), true);
  assert.equal(buildingAt(environment, 53, 45).id, "building:1:watch");
  assert.throws(() => game.command({ type: "demolish-building", buildingId: "building:1:watch" }), /지원하지 않는 요청/);
  assert.equal(game.snapshot().buildings[0].health, 80);
  assert.equal(game.receiveBuildingDamage("building:1:watch", 80), 0);
  assert.equal(buildingAt(environment, 53, 45), null);
  assert.equal(game.snapshot().buildings[0].health, 0);
  assert.deepEqual([1, 2, 3, 4].map(level => materialCapacity(level, [])), [30, 40, 50, 60]);
});

test("기본자원 납품은 필요한 원재료와 진화 포인트로 한 번씩 적재한다", () => {
  const context = fixture(), { game } = context;
  const saved = JSON.parse(game.save()); saved.state.resourceInventory = { clay: 8 };
  game.restore(JSON.stringify(saved));
  const agent = game.agents[0];
  agent.x = 40; agent.y = 40; agent.mode = "unload"; agent.carrying = 2; agent.carryingType = "clay";
  agent.utility = { action: "return", target: { key: "home", x: 40, y: 40 }, route: [{ x: 40, y: 40 }], recoverHealth: 1 };
  agent.decisionPending = null; agent.nextDecisionAt = 100; agent.unloadReady = 0; agent.moveDuration = 0;
  advance(context, .25);
  assert.equal(game.snapshot().resourceInventory.clay, 10);
  assert.equal(game.snapshot().evolutionPoints, 202);
  advance(context, .25);
  assert.equal(game.snapshot().resourceInventory.clay, 10);
  assert.equal(game.snapshot().evolutionPoints, 202);
});

test("가득 찬 창고의 자원은 필요한 수량만 버리고 저장 공간을 되찾는다", () => {
  const { game } = fixture();
  const saved = JSON.parse(game.save()); saved.state.resourceInventory = { tree: 40 };
  game.restore(JSON.stringify(saved));
  assert.throws(() => game.command({ type: "discard-resource", resourceType: "tree", amount: 0 }), /개수/);
  assert.throws(() => game.command({ type: "discard-resource", resourceType: "tree", amount: 41 }), /개수/);
  assert.throws(() => game.command({ type: "discard-resource", resourceType: "unknown", amount: 1 }), /종류/);
  const before = game.snapshot();
  assert.deepEqual(game.command({ type: "discard-resource", resourceType: "tree", amount: 10 }), { resourceType: "tree", discarded: 10 });
  assert.equal(game.snapshot().resourceInventory.tree, 30);
  assert.equal(game.snapshot().evolutionPoints, before.evolutionPoints);
  game.restore(game.save());
  assert.equal(game.snapshot().resourceInventory.tree, 30);
});

test("변신한 전초둥지는 본둥지가 파괴되어도 탄생·납품과 군락 생존을 유지한다", () => {
  const context = fixture(), { game, agentId } = context;
  const builder = game.agents[0]; builder.x = 49; builder.y = 43; builder.moveDuration = 0;
  restoreConstructionPlan(context, agentId, "outpost", 48, 42);
  advanceUntil(context, () => game.buildings.length === 1);
  const outpost = game.snapshot().buildings[0];
  assert.equal(outpost.key, "outpost");
  const { templateId } = game.command({ type: "design", templateId: null, name: "새 개체", slots: [], birth: false });
  game.receiveNestDamage(10000);
  assert.equal(game.checkEnding(), null);
  const born = game.command({ type: "birth", templateId, buildingId: outpost.id });
  const agent = game.agents.find(candidate => candidate.id === born.agentId);
  assert.equal(agent.birth.buildingId, outpost.id);
  assert.equal(agent.birth.sourceX, 48);
  assert.equal(agent.birth.sourceWidth, 3);
  assert.ok(agent.x >= 47 && agent.x <= 51 && agent.y >= 41 && agent.y <= 45);
  agent.birth = null; agent.x = 48; agent.y = 41; agent.moveDuration = 0;
  agent.mode = "unload"; agent.carrying = 2; agent.carryingType = "clay"; agent.unloadReady = 0;
  agent.utility = { action: "return", target: { key: "home", x: 48, y: 41 }, route: [{ x: 48, y: 41 }] };
  agent.decisionPending = null; agent.nextDecisionAt = 100;
  const before = game.snapshot();
  advance(context, .25);
  assert.equal(game.snapshot().resourceInventory.clay, (before.resourceInventory.clay || 0) + 2);
  assert.equal(game.snapshot().evolutionPoints, before.evolutionPoints + 2);
  assert.equal(agent.foodDelivery.buildingId, outpost.id);
  assert.equal(agent.foodDelivery.targetX, 49.5);
  assert.equal(agent.foodDelivery.targetY, 43.5);
  game.restore(game.save());
  assert.equal(game.checkEnding(), null);
  assert.equal(game.snapshot().buildings[0].id, outpost.id);
});
