import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createUtilityAI } from "./utility.mjs";
import { attributeCounts, unitStats, hasSynergy } from "./attributes.mjs";

function frontierFixture() {
  const size = 19;
  const explored = new Set(), passable = new Set();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (x < 13 && !(x === 8 && y === 4)) explored.add(y * size + x);
  }
  for (let x = 8; x <= 12; x++) passable.add(8 * size + x);
  for (let y = 5; y <= 8; y++) passable.add(y * size + 8);
  const agent = { id: "scout", templateId: null, slots: [],
    x: 8, y: 8, health: 12, cost: 3, carrying: 0, stepCount: 0,
    stats: { health: 12, speed: 1, capacity: 2, vision: 2, attack: 1, resistance: 1 },
    personality: { boldness: 0.5, aggression: 0.5, curiosity: 0.5 }, visited: new Set(["8,8"]) };
  const state = { simSeconds: 0, nestLevel: 1, evolutionPoints: 0, explored, knownFood: new Map(), agents: [agent] };
  state.markers = [];
  const sources = [{ x: 8, y: 8, radius: 6 }];
  const ai = createUtilityAI({ state, size, permanentVisionSources: () => sources, homeCells: () => [{ x: agent.x, y: agent.y }],
    deliveryCells: () => [{ x: agent.x, y: agent.y }],
    walkable(x, y) {
      assert.ok(state.explored.has(y * size + x), "통행 판단은 탐색한 칸에만 요청해야 합니다.");
      return passable.has(y * size + x);
    },
    hazardAt(x, y) {
      assert.ok(state.explored.has(y * size + x), "위험 판단은 탐색한 칸에만 요청해야 합니다.");
      return 0;
    },
    enemies: () => [], synergy: () => false, canHarvest: () => true });
  return { ai, agent, state, passable, size, sources };
}

function gameFixture(terrain) {
  const colony = { id: 1, ownerId: "test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain, hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set("test", game);
  game.agents.splice(1);
  return { game, environment };
}

function advance(fixture, seconds) {
  for (let step = 0; step < Math.round(seconds * 10); step++) {
    fixture.environment.simSeconds += 0.1;
    fixture.game.prepare(fixture.environment.simSeconds);
    fixture.game.tick(0.1);
  }
}

test("정찰은 둥지에 더 가까운 작은 빈틈보다 이동 시간 대비 넓은 미탐색 경계를 선택한다", () => {
  const f = frontierFixture();
  const plans = f.ai.evaluate(f.agent, false);
  assert.equal(plans[0].action, "explore");
  assert.deepEqual({ x: plans[0].target.x, y: plans[0].target.y }, { x: 12, y: 8 });
  for (const plan of plans) for (const cell of plan.route) assert.ok(f.state.explored.has(cell.y * f.size + cell.x));
  assert.equal(f.ai.nextStep(f.agent, { x: 13, y: 8 }), null);
});

test("정찰은 고립된 경계를 건너뛰고 알려진 우회로의 실제 이동 시간을 비교한다", () => {
  const f = frontierFixture();
  f.passable.delete(8 * f.size + 10);
  f.passable.add(2 * f.size + 12);
  for (let y = 9; y <= 16; y++) {
    f.passable.add(y * f.size + 9);
    f.passable.add(y * f.size + 11);
  }
  f.passable.add(16 * f.size + 10);
  const plans = f.ai.evaluate(f.agent, false);
  assert.equal(plans[0].action, "explore");
  assert.deepEqual({ x: plans[0].target.x, y: plans[0].target.y }, { x: 8, y: 5 });
  assert.ok(!plans.some(plan => plan.target.x === 12 && plan.target.y === 2));
  for (const plan of plans) for (const cell of plan.route) assert.ok(f.passable.has(cell.y * f.size + cell.x));
  assert.ok(plans.some(plan => plan.target.x === 12 && plan.route.some(cell => cell.y === 16)));
});

test("탐색 칸 수가 같은 다른 지식을 복원해도 이전 경계를 재사용하지 않는다", () => {
  const f = frontierFixture();
  f.ai.evaluate(f.agent, false);
  const mirror = index => Math.floor(index / f.size) * f.size + f.size - 1 - index % f.size;
  f.state.explored = new Set([...f.state.explored].map(mirror));
  const passable = [...f.passable].map(mirror);
  f.passable.clear();
  for (const index of passable) f.passable.add(index);
  f.agent.x = f.size - 1 - f.agent.x;
  f.sources[0].x = f.size - 1 - f.sources[0].x;
  f.agent.visited = new Set([f.agent.x + "," + f.agent.y]);
  const plan = f.ai.evaluate(f.agent, false)[0];
  assert.deepEqual({ x: plan.target.x, y: plan.target.y }, { x: 6, y: 8 });
});

test("안개 속 지형·위험·버섯 배치가 달라도 발견 전 정찰 판단은 같다", () => {
  const first = gameFixture(new Uint8Array(320 * 320).fill(4));
  const second = gameFixture(new Uint8Array(320 * 320).fill(4));
  const saved = first.game.save();
  second.game.restore(saved);
  const explored = new Set(first.game.snapshot().explored);
  for (let index = 0; index < 320 * 320; index++) {
    if (explored.has(index)) continue;
    first.environment.world.terrain[index] = 0;
    second.environment.world.terrain[index] = 8;
    second.environment.world.hazards[index] = 1;
  }
  first.environment.food.set("60,42", { x: 60, y: 42, amount: 999, terrain: "grassland", resourceType: "honey-mushrooms" });
  second.environment.food.set("42,60", { x: 42, y: 60, amount: 999, terrain: "grassland", resourceType: "honey-mushrooms" });
  for (const fixture of [first, second]) {
    fixture.game.agents[0].decisionPending = "completed";
    advance(fixture, 0.1);
  }
  assert.deepEqual(first.game.agents[0].utility, second.game.agents[0].utility);
  assert.equal(first.game.snapshot().food.length, 0);
  assert.equal(second.game.snapshot().food.length, 0);
});

test("경계를 따라 이동하다 버섯이 실제 시야에 들어온 뒤에만 발견한다", () => {
  const terrain = new Uint8Array(320 * 320);
  for (let x = 40; x <= 70; x++) terrain[42 * 320 + x] = 4;
  terrain[41 * 320 + 42] = terrain[43 * 320 + 42] = 4;
  const f = gameFixture(terrain);
  f.environment.food.set("51,42", { x: 51, y: 42, amount: 10, terrain: "grassland", resourceType: "honey-mushrooms" });
  assert.ok(!f.game.snapshot().food.some(food => food.x === 51 && food.y === 42));
  let discovered = false;
  for (let step = 0; step < 200; step++) {
    advance(f, 0.1);
    const snapshot = f.game.snapshot();
    if (!snapshot.food.some(food => food.x === 51 && food.y === 42)) continue;
    assert.ok(snapshot.visible.includes(42 * 320 + 51));
    assert.ok(["explore", "collect"].includes(f.game.agents[0].utility.action));
    discovered = true;
    break;
  }
  assert.ok(discovered);
});

function terrainFixture(holes) {
  const size = 96, sources = [{ x: 10, y: 40, radius: 6 }];
  const agent = { id: "terrain-scout", x: 26, y: 40, slots: [], bornAt: 0, lifespan: 1000,
    health: 12, cost: 3, carrying: 0, stepCount: 0,
    stats: { health: 12, speed: 1, capacity: 1, vision: 2, attack: 1, resistance: 1 },
    personality: { boldness: .5, aggression: .5, curiosity: .5 }, visited: new Set(), preciseHarvestTimes: new Map() };
  const explored = new Set(Array.from({ length: size * size }, (_, index) => index));
  for (const cell of holes) explored.delete(cell.y * size + cell.x);
  const state = { simSeconds: 100, nestLevel: 1, evolutionPoints: 0, lastFoodAt: 0,
    agents: [agent], markers: [], knownFood: new Map(), explored };
  const context = { state, size, permanentVisionSources: () => sources,
    homeCells: () => [{ x: 10, y: 40 }], deliveryCells: () => [{ x: 10, y: 40 }],
    walkable: () => true, hazardAt: () => 0, enemies: () => [],
    synergy: (unit, keys) => hasSynergy(unit.attributes || attributeCounts(unit.slots), keys), canHarvest: () => true };
  const ai = createUtilityAI(context);
  return { ai, agent, state, sources, size, context };
}

test("이동 조건이 같으면 고정 시야에 가까운 미탐색 지형의 정찰 점수가 높다", () => {
  const f = terrainFixture([{ x: 20, y: 40 }, { x: 32, y: 40 }]);
  const plans = f.ai.evaluate(f.agent, false).filter(plan => plan.action === "explore");
  assert.ok(plans.some(plan => plan.target.x < 26));
  assert.ok(plans.some(plan => plan.target.x > 26));
  assert.ok(plans[0].target.x < 26);
  const near = Math.max(...plans.filter(plan => plan.target.x < 26).map(plan => plan.score));
  const far = Math.max(...plans.filter(plan => plan.target.x > 26).map(plan => plan.score));
  assert.ok(near > far);
});

test("고정 시야 주변을 확보하면 먼 안개와 감지 표식과 기존 정찰 보너스가 있어도 정찰을 끝낸다", () => {
  const f = terrainFixture([{ x: 50, y: 40 }]);
  f.agent.x = 48;
  f.state.markers = [{ x: 50, y: 40 }];
  f.agent.utility = { action: "explore", target: { x: 49, y: 40, key: "frontier:" + (40 * f.size + 49) }, score: 999 };
  assert.deepEqual(f.ai.evaluate(f.agent, true), []);
  f.agent.x = 49;
  assert.deepEqual(f.ai.evaluate(f.agent, true), []);
});

test("반 안개로 확보한 지형은 다시 보러 가지 않고 다른 방향의 진한 안개만 정찰한다", () => {
  const f = terrainFixture([{ x: 20, y: 40 }, { x: 32, y: 40 }]);
  assert.ok(f.ai.evaluate(f.agent, false)[0].target.x < 26);
  f.state.explored.add(40 * f.size + 20);
  const next = f.ai.evaluate(f.agent, true);
  assert.ok(next.length > 0 && next.every(plan => plan.target.x > 26));
  f.state.explored.add(40 * f.size + 32);
  assert.deepEqual(f.ai.evaluate(f.agent, true), []);
});

test("고정 시야가 확장되면 새 주변 정찰을 재개하고 거점이 없어지면 그 범위는 제외한다", () => {
  const f = terrainFixture([{ x: 50, y: 40 }]);
  f.agent.x = 48;
  assert.deepEqual(f.ai.evaluate(f.agent, false), []);
  f.sources.push({ x: 40, y: 40, radius: 6 });
  assert.equal(f.ai.evaluate(f.agent, false)[0].action, "explore");
  f.sources.pop();
  assert.deepEqual(f.ai.evaluate(f.agent, true), []);
  f.sources.length = 0;
  assert.deepEqual(f.ai.evaluate(f.agent, true), []);
});

test("실제 정찰은 지형을 확보한 뒤 대기하고 감시봉 완성과 파괴에 맞춰 재개하고 종료한다", () => {
  const terrain = new Uint8Array(320 * 320);
  for (let x = 40; x <= 130; x++) terrain[42 * 320 + x] = 4;
  terrain[41 * 320 + 42] = terrain[43 * 320 + 42] = 4;
  const f = gameFixture(terrain);
  const saved = JSON.parse(f.game.save());
  saved.state.agents[0].lifespan = 1000;
  f.game.restore(JSON.stringify(saved));
  advance(f, 150);
  const agent = f.game.agents[0];
  assert.ok(agent.x > 50 && agent.x < 73);
  assert.equal(agent.mode, "wait");
  const position = { x: agent.x, y: agent.y };
  advance(f, 10);
  assert.deepEqual({ x: agent.x, y: agent.y }, position);
  const expanded = JSON.parse(f.game.save());
  expanded.state.buildings = [{ id: "scout-watchpost", key: "watchpost", x: 68, y: 39, health: 80 }];
  f.game.restore(JSON.stringify(expanded));
  advance(f, 3.1);
  assert.equal(f.game.agents[0].utility?.action, "explore");
  f.game.buildings[0].health = 0;
  advance(f, 3.1);
  assert.equal(f.game.agents[0].mode, "wait");
});

function scoutTeamFixture() {
  const f = terrainFixture([{ x: 35, y: 40 }]);
  const create = (id, slots) => {
    const attributes = attributeCounts(slots), stats = unitStats(attributes, "bean");
    return { ...f.agent, id, tribe: "bean", slots, attributes, stats, health: stats.health,
      bornAt: f.state.simSeconds, lifespan: stats.lifespan, visited: new Set(), preciseHarvestTimes: new Map() };
  };
  const worker = create("worker", []), single = create("single", ["antenna"]);
  const advanced = create("advanced", ["antenna", "lifespan", "feet"]);
  f.state.agents = [worker, single, advanced];
  f.state.nestLevel = 3;
  f.state.evolutionPoints = 100;
  f.state.lastFoodAt = f.state.simSeconds;
  f.state.knownFood.set("26,40", { x: 26, y: 40, amount: 30, resourceType: "clay" });
  f.context.isFood = type => type === "clay";
  return { ...f, ai: createUtilityAI(f.context), worker, single, advanced };
}

test("같은 감지·이속에서도 남은 수명이 길수록 정찰 점수가 높고 도착할 수명이 없으면 후보에서 제외한다", () => {
  const f = scoutTeamFixture();
  f.state.agents = [f.advanced];
  const scores = [];
  for (const lifespan of [60, 180, 300]) {
    f.advanced.lifespan = lifespan;
    const plans = f.ai.evaluate(f.advanced, false).filter(plan => plan.action === "explore");
    assert.ok(plans.length > 0);
    scores.push(plans[0].score);
  }
  assert.ok(scores[0] < scores[1] && scores[1] < scores[2]);
  f.advanced.lifespan = 5;
  assert.ok(f.ai.evaluate(f.advanced, true).every(plan => plan.action !== "explore"));
});

test("판단 순서와 관계없이 감지·수명·이속 개체가 정찰을 맡고 단속성·무속성 개체는 채집한다", () => {
  for (const reverse of [false, true]) {
    const f = scoutTeamFixture();
    const order = reverse ? [...f.state.agents].reverse() : f.state.agents;
    for (const agent of order) agent.utility = f.ai.evaluate(agent, false)[0];
    assert.equal(f.advanced.utility?.action, "explore");
    assert.equal(f.worker.utility?.action, "collect");
    assert.equal(f.single.utility?.action, "collect");
  }
});

test("식량 수급이 급해도 다른 납품 가능 개체가 있으면 고급 정찰병을 정찰에 남긴다", () => {
  const f = scoutTeamFixture();
  f.state.evolutionPoints = 0;
  f.state.lastFoodAt = 0;
  for (const agent of f.state.agents) agent.utility = f.ai.evaluate(agent, false)[0];
  assert.equal(f.advanced.utility?.action, "explore");
  assert.equal(f.worker.utility?.action, "collect");
});

test("고급 정찰병만 식량을 제때 납품할 수 있으면 정찰보다 수급을 우선한다", () => {
  const f = scoutTeamFixture();
  f.state.agents = [f.worker, f.advanced];
  f.worker.lifespan = 20;
  f.state.evolutionPoints = 0;
  f.state.lastFoodAt = 0;
  assert.equal(f.ai.evaluate(f.advanced, false)[0].action, "collect");
});

test("늙은 고급 정찰병은 남은 수명이 충분한 일반 개체에 정찰을 넘긴다", () => {
  const f = scoutTeamFixture();
  f.state.agents = [f.worker, f.advanced];
  f.advanced.lifespan = 5;
  assert.equal(f.ai.evaluate(f.worker, false)[0].action, "explore");
  assert.ok(f.ai.evaluate(f.advanced, false).every(plan => plan.action !== "explore"));
});

test("길이 끊긴 고급 정찰병은 다른 구역의 일반 개체가 정찰하는 것을 막지 않는다", () => {
  const f = scoutTeamFixture();
  f.state.agents = [f.worker, f.advanced];
  f.state.explored.add(40 * f.size + 35);
  f.state.explored.delete(40 * f.size + 20);
  f.context.walkable = (x, y) => x !== 27;
  f.advanced.x = 30;
  const ai = createUtilityAI(f.context);
  assert.equal(ai.evaluate(f.worker, false)[0].action, "explore");
  assert.ok(ai.evaluate(f.advanced, false).every(plan => plan.action !== "explore"));
});

test("고급 정찰병도 운반 중인 자원은 납품한 뒤 정찰 역할을 다시 선택한다", () => {
  const f = scoutTeamFixture();
  f.advanced.carrying = 1;
  f.advanced.carryingType = "clay";
  assert.equal(f.ai.evaluate(f.advanced, false)[0].action, "return");
});

test("실제 군락은 저장·복원과 다른 개체의 운반 중에도 고급 정찰병의 역할을 유지한다", () => {
  const f = gameFixture(new Uint8Array(320 * 320).fill(4));
  const saved = JSON.parse(f.game.save());
  saved.state.agents = [];
  saved.state.nestLevel = 3;
  saved.state.evolutionPoints = 100;
  f.game.restore(JSON.stringify(saved));
  const ids = [];
  for (const slots of [[], ["antenna"], ["antenna", "lifespan", "feet"]]) {
    const result = f.game.command({ type: "design", templateId: null, name: "정찰 분담 " + ids.length, slots, birth: true });
    ids.push(result.agentId);
  }
  for (const agent of f.game.agents) Object.assign(agent, { x: 46, y: 42, renderFromX: 46, renderFromY: 42,
    birth: null, utility: null, decisionPending: "restore", moveBudget: 0, moveDuration: 0 });
  f.environment.food.set("46,42", { x: 46, y: 42, amount: 100, resourceType: "clay", kind: "resource" });
  f.game.restore(f.game.save());
  advance(f, .1);
  assert.equal(f.game.agents.find(agent => agent.id === ids[2]).utility?.action, "explore");
  for (const id of ids.slice(0, 2)) assert.equal(f.game.agents.find(agent => agent.id === id).utility?.action, "collect");
  f.game.restore(f.game.save());
  advance(f, 3.1);
  assert.equal(f.game.agents.find(agent => agent.id === ids[2]).utility?.action, "explore");
  assert.ok(f.game.agents.filter(agent => agent.id !== ids[2]).every(agent =>
    ["collect", "return"].includes(agent.utility?.action)));
});
