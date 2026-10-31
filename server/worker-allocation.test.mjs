import test from "node:test";
import assert from "node:assert/strict";
import { allocateWorkers } from "./worker-allocation.mjs";
import { attributeCounts, birthCost, unitStats } from "./attributes.mjs";
import { resourceDefinition } from "./resources.mjs";

function fixture(foodX, points) {
  const attributes = attributeCounts(["strength"]);
  const workers = Array.from({ length: 4 }, (_, index) => ({ id: "worker:" + index, tribe: "bean", x: 0, y: 0,
    bornAt: 0, lifespan: 160, slots: ["strength"], attributeLevels: {}, attributes, stats: unitStats(attributes, "bean"), health: 100,
    carrying: 0, carryingType: null }));
  const food = { x: foodX, y: 0, resourceType: "clay", amount: 1000 };
  const state = { simSeconds: 0, nestLevel: 2, evolutionPoints: points, agents: workers, knownFood: new Map([[foodX + ",0", food]]) };
  const context = { state, colony: { tribe: "bean" }, isFood: type => type === "clay", deliveryCells: () => [{ x: 0, y: 0 }],
    harvestSeconds: () => 2, canHarvest: () => true, deliveryCapacity: () => 1000,
    route: (agent, target) => {
      const cells = [{ x: agent.x, y: agent.y }];
      while (cells.at(-1).x !== target.x) cells.push({ x: cells.at(-1).x + Math.sign(target.x - cells.at(-1).x), y: agent.y });
      return cells;
    } };
  return { context, state, workers, food };
}

test("같은 네 일꾼도 먹이 왕복 거리로 예상 수급을 계산해 채집 인력을 1→2→4명으로 늘린다", () => {
  for (const [x, count] of [[1, 1], [4, 2], [6, 4]]) {
    const { context, workers } = fixture(x, 5.4);
    const allocation = allocateWorkers(context, workers, new Set());
    assert.equal(allocation.ids.size, count);
    assert.ok(allocation.productionRate >= allocation.requiredRate);
    for (const agent of workers) assert.ok(allocation.ids.has(agent.id) ? allocation.weights.get(agent.id) >= 1 : allocation.weights.get(agent.id) < 1);
  }
});

test("같은 경로에서도 비축이 부족하면 복구에 필요한 채집 인력을 추가한다", () => {
  const rich = fixture(1, 200), poor = fixture(1, 0);
  const stable = allocateWorkers(rich.context, rich.workers, new Set());
  const shortage = allocateWorkers(poor.context, poor.workers, new Set());
  assert.equal(stable.ids.size, 1);
  assert.equal(shortage.ids.size, 2);
  assert.ok(shortage.requiredRate > stable.requiredRate);
  assert.ok(shortage.productionRate >= shortage.requiredRate);
});

test("오는 중인 먹이는 비축 복구에 한 번만 반영하고 해당 일꾼의 다음 채집을 따로 예측한다", () => {
  const { context, state, workers } = fixture(1, 0);
  for (const agent of workers.slice(0, 3)) { agent.carrying = 2; agent.carryingType = "clay"; }
  const pending = allocateWorkers(context, workers, new Set());
  assert.equal(pending.incomingFood, 6);
  assert.equal(pending.ids.size, 1);
  state.evolutionPoints = 6;
  for (const agent of workers) { agent.carrying = 0; agent.carryingType = null; }
  const deposited = allocateWorkers(context, workers, new Set());
  assert.equal(deposited.incomingFood, 0);
  assert.equal(deposited.requiredRate, pending.requiredRate);
});

test("같은 먹이 잔량을 여러 일꾼의 생산량으로 중복 계산하지 않는다", () => {
  const { context, workers, food } = fixture(1, 0);
  food.amount = 2;
  const allocation = allocateWorkers(context, workers, new Set());
  assert.equal(allocation.productionRate, 2 / 60);
  assert.ok(allocation.productionRate < allocation.requiredRate);
  assert.equal(allocation.ids.size, workers.length);
  assert.ok(allocation.forecastBalance < 0);
});

test("경로가 끊기거나 남은 수명 안에 납품할 수 없으면 예상 생산량에서 제외한다", () => {
  const { context, workers } = fixture(1, 0);
  context.route = () => null;
  assert.equal(allocateWorkers(context, workers, new Set()).productionRate, 0);
  const short = fixture(12, 0);
  for (const agent of short.workers) agent.lifespan = 20;
  assert.equal(allocateWorkers(short.context, short.workers, new Set()).productionRate, 0);
});

test("건설 자재 화물을 먹이 입고나 새 채집 생산량으로 계산하지 않는다", () => {
  const { context, workers } = fixture(1, 200), agent = workers[0];
  agent.carrying = 2; agent.carryingType = "clay"; agent.transportCargo = { siteId: "site" };
  const allocation = allocateWorkers(context, workers, new Set());
  assert.equal(allocation.incomingFood, 0);
  assert.equal(allocation.ids.has(agent.id), false);
  assert.equal(allocation.rates.has(agent.id), false);
});

test("납품 예정인 먹이와 새 생산량도 실제로 받을 수 있는 용량을 초과하지 않는다", () => {
  const { context, workers } = fixture(1, 0);
  context.deliveryCapacity = () => 3;
  for (const agent of workers.slice(0, 3)) { agent.carrying = 2; agent.carryingType = "clay"; }
  const allocation = allocateWorkers(context, workers, new Set());
  assert.equal(allocation.incomingFood, 3);
  assert.equal(allocation.productionRate, 0);
});

test("네 종족의 실제 생산 비용·수명·적재 이동 속도·기본 먹이 채집 시간을 사용한다", () => {
  for (const [tribe, type] of [["bean", "clay"], ["spore", "tree"], ["pebble", "pebbles"], ["spring", "dew"]]) {
    const { context, workers, food } = fixture(1, 200);
    context.colony.tribe = tribe;
    food.resourceType = type;
    context.isFood = resource => resource === type;
    context.harvestSeconds = resource => resourceDefinition(resource).harvestSeconds;
    for (const agent of workers) {
      agent.tribe = tribe;
      agent.stats = unitStats(agent.attributes, tribe);
      agent.lifespan = agent.stats.lifespan;
    }
    const allocation = allocateWorkers(context, workers, new Set());
    const required = workers.reduce((sum, agent) => sum + birthCost(agent, tribe) / agent.lifespan, 0);
    assert.ok(Math.abs(allocation.maintenanceRate - required) < 1e-8);
    assert.ok(allocation.productionRate >= allocation.requiredRate);
    assert.ok(allocation.ids.size > 0 && allocation.ids.size <= workers.length);
  }
});

test("비축 포인트로 유지 비용을 감당할 때 먹이 담당 한 명을 남기고 자재 채집과 운반 인력을 풀어 준다",()=>{const f=fixture(6,200);f.workers[0].slots=["blade"];f.workers[0].attributes=attributeCounts(f.workers[0].slots);f.workers[0].stats=unitStats(f.workers[0].attributes,"bean");const stocked=allocateWorkers(f.context,f.workers,new Set());assert.equal(stocked.requiredRate,0);assert.equal(stocked.ids.size,1);assert.equal(stocked.ids.has(f.workers[0].id),false);f.state.evolutionPoints=0;const low=allocateWorkers(f.context,f.workers,new Set());assert.ok(low.requiredRate>0);assert.ok(low.ids.size>stocked.ids.size);});

test("첫 먹이 납품이 60초 밖에 있어도 수명 안의 실제 왕복 생산량으로 추가 채집 개체의 비용 회수를 판단한다",()=>{const f=fixture(24,0);for(const a of f.workers)a.lifespan=500;const forecast=allocateWorkers(f.context,f.workers,new Set());assert.equal(forecast.productionRate,0);assert.ok(forecast.foodYields.get(f.workers[0].id)>birthCost(f.workers[0],"bean"));f.workers[0].lifespan=40;assert.equal(allocateWorkers(f.context,f.workers,new Set()).foodYields.get(f.workers[0].id)||0,0);});
