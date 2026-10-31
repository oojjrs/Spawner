import test from "node:test";
import assert from "node:assert/strict";
import { createResourceStorage } from "./resource-storage.mjs";
import { createConstructionSupply } from "./construction-supply.mjs";
import { attributeCounts, unitStats } from "./attributes.mjs";
import { createGame } from "./game.mjs";
import { constructionMorphPose } from "../client/construction-animation.mjs";

function fixture(key) {
  const colony = { id: 1, tribe: "bean", x: 40, y: 40 };
  const agent = (id, slots, x, y) => ({ id, tribe: "bean", health: 100, x, y, bornAt: 0, lifespan: 1000,
    attributes: attributeCounts(slots), stats: unitStats(attributeCounts(slots), "bean"), carrying: 0, carryingType: null });
  const builder = agent("builder", ["construction"], 50, 42);
  builder.construction = { buildingKey: key, x: 49, y: 41, state: "transforming", startedAt: 0, readyAt: 15, orderedAt: 0 };
  const couriers = [agent("a", ["strength"], 44, 40), agent("b", ["strength"], 44, 44),
    agent("c", ["strength"], 40, 44), agent("d", ["strength"], 40, 40)];
  const state = { simSeconds: 0, nestHealth: 100, nestLevel: 2, resourceInventory: { clay: 30, tree: 6, "grass-fiber": 4 },
    agents: [builder, ...couriers], buildings: [], knownFood: new Map(), evolutionPoints: 200, colonyFood: 0, lastFoodAt: 0 };
  const storage = createResourceStorage(state, colony);
  storage.restore();
  const supply = createConstructionSupply({ state, colony, storage, walkable: () => true, isFood: type => type === "clay",
    deliveryCells: () => storage.cells(storage.refresh()[0]), route: (agent, target) => {
      const cells = [{ x: agent.x, y: agent.y }];
      while (cells.at(-1).x !== target.x) cells.push({ x: cells.at(-1).x + Math.sign(target.x - cells.at(-1).x), y: cells.at(-1).y });
      while (cells.at(-1).y !== target.y) cells.push({ x: target.x, y: cells.at(-1).y + Math.sign(target.y - cells.at(-1).y) });
      return cells;
    } });
  supply.refresh();
  return { state, colony, storage, supply, builder, couriers };
}

function transfer(context, courier, job) {
  context.supply.assign(courier, job);
  courier.utility = { action: "supply", target: job.target };
  Object.assign(courier, { x: job.target.x, y: job.target.y });
  context.supply.interact(courier);
  context.state.simSeconds += 1;
  return context.supply.interact(courier);
}

test("새 용량을 시설별로 적용하고 초과 재고와 파괴된 창고의 회수 재료를 보존한다", () => {
  const context = fixture("storage"), { state, storage } = context;
  storage.refresh()[0].inventory.clay += 10;
  storage.refresh();
  assert.equal(storage.refresh()[0].capacity, 40);
  assert.equal(state.resourceInventory.clay, 40);
  state.buildings.push({ id: "warehouse", key: "storage", x: 60, y: 40, width: 3, height: 3, health: 100 });
  const warehouse = storage.refresh().find(store => store.id === "warehouse");
  assert.equal(storage.deposit(warehouse, "tree", 90), 60);
  assert.equal(state.resourceInventory.tree, 66);
  state.buildings[0].health = 0;
  storage.refresh();
  assert.equal(state.resourceInventory.tree, 6);
  assert.equal(warehouse.kind, "remains");
  assert.equal(warehouse.inventory.tree, 60);
});

test("예약→출고→현장 납품→흡수를 구분하고 공급 중단 시간은 성장 시간에 쌓지 않는다", () => {
  const context = fixture("storage"), { state, supply, builder, couriers } = context;
  const courier = couriers[0];
  assert.equal(supply.available().clay, 20);
  const pickup = supply.plans(courier)[0];
  assert.equal(state.resourceInventory.clay, 30);
  transfer(context, courier, pickup);
  assert.equal(courier.carrying, 2);
  assert.equal(state.resourceInventory.clay, 28);
  assert.equal(builder.construction.delivered.clay || 0, 0);
  transfer(context, courier, supply.plans(courier)[0]);
  assert.equal(builder.construction.delivered.clay, 2);
  supply.advance(builder, 100);
  assert.equal(builder.construction.progress, .2);
  assert.equal(builder.construction.consumed.clay, 2);
  supply.advance(builder, 100);
  assert.equal(builder.construction.progress, .2);
  builder.construction.delivered.clay = 10;
  supply.advance(builder, 1);
  assert.ok(Math.abs(builder.construction.progress - (.2 + 1 / 15)) < 1e-8);
});

test("필요 재료 한 종류가 빠지면 진척을 제한하고 클라이언트도 서버 진척에 고정된다", () => {
  const { supply, builder } = fixture("watchpost");
  Object.assign(builder.construction.delivered, { clay: 8, tree: 6 });
  supply.advance(builder, 100);
  assert.equal(builder.construction.progress, 0);
  builder.construction.delivered["grass-fiber"] = 2;
  supply.advance(builder, 100);
  assert.equal(builder.construction.progress, .5);
  assert.equal(constructionMorphPose(builder, 1000).progress, .5);
  assert.equal(constructionMorphPose(builder, 1001).progress, .5);
  builder.construction.delivered["grass-fiber"] = 4;
  supply.advance(builder, 100);
  assert.equal(builder.construction.progress, 1);
  assert.equal(constructionMorphPose(builder, 1001).opening, 1);
});

test("다른 운반 예약을 차감해 같은 부족분을 중복 배차하지 않는다", () => {
  const context = fixture("storage"), { supply, builder, couriers } = context;
  builder.construction.delivered.clay = 9;
  const first = supply.plans(couriers[0])[0];
  assert.equal(first.amount, 1);
  supply.assign(couriers[0], first);
  assert.equal(supply.plans(couriers[1]).length, 0);
});

test("먹이 채집 인력을 보호하고 수급이 급하면 운반 인원을 더 줄인다", () => {
  const context = fixture("storage"), { state, supply, couriers } = context;
  state.knownFood.set("food", { x: 46, y: 46, amount: 100, resourceType: "clay" });
  const stable = supply.allocation(), available = couriers.filter(agent => supply.plans(agent).length).length;
  assert.ok(stable.ids.size > 0 && stable.productionRate >= stable.requiredRate);
  state.evolutionPoints = 0;
  state.simSeconds = 100;
  const shortage = supply.allocation();
  assert.ok(shortage.requiredRate > stable.requiredRate);
  assert.ok(shortage.ids.size > stable.ids.size);
  assert.ok(couriers.filter(agent => supply.plans(agent).length).length < available);
});

test("출고한 일꾼이 먹이 근처를 지나도 채집 인력을 유지하며 맡은 자재를 계속 운반한다", () => {
  const context = fixture("watchpost"), { state, supply, couriers } = context;
  state.knownFood.set("food", { x: 46, y: 46, amount: 100, resourceType: "clay" });
  const carriers = couriers.filter(agent => supply.plans(agent).length);
  const foragers = couriers.filter(agent => !carriers.includes(agent));
  for (const courier of carriers) {
    const job = supply.plans(courier)[0];
    supply.assign(courier, job);
    courier.utility = { action: "supply", target: job.target };
    Object.assign(courier, { x: 46, y: 46 });
  }
  state.simSeconds += 1.25;
  for (const courier of carriers) {
    const job = supply.plans(courier)[0];
    assert.equal(job.siteId, courier.transport.siteId);
    assert.equal(job.type, courier.transport.type);
    assert.equal(job.storeId, courier.transport.storeId);
  }
  assert.ok(foragers.every(agent => supply.plans(agent).length === 0));
});

test("감시봉 운반 인력을 비옥토 한 종류에 몰지 않고 예약량까지 고려해 병목 재료를 나눈다", () => {
  const { supply, couriers } = fixture("watchpost"), types = [];
  for (const courier of couriers.slice(0, 3)) {
    const job = supply.plans(courier)[0];
    types.push(job.type);
    supply.assign(courier, job);
    courier.utility = { action: "supply", target: job.target };
  }
  assert.deepEqual(types.sort(), ["clay", "grass-fiber", "tree"]);
});

test("일꾼이 한 명뿐이고 먹이가 있으면 건설 운반으로 마지막 채집 인력을 빼앗지 않는다", () => {
  const { state, supply, couriers, builder } = fixture("watchpost");
  state.agents = [builder, couriers[0]];
  state.knownFood.set("food", { x: 46, y: 46, amount: 100, resourceType: "clay" });
  assert.deepEqual(supply.plans(couriers[0]), []);
});

test("목표가 취소된 운반 화물은 실제 저장 시설로 회수하고 포인트를 재생성하지 않는다", () => {
  const context = fixture("storage"), { state, supply, builder, couriers } = context;
  const courier = couriers[0], points = state.evolutionPoints;
  transfer(context, courier, supply.plans(courier)[0]);
  assert.equal(state.resourceInventory.clay, 28);
  supply.stop(builder);
  builder.construction = null;
  const returning = supply.plans(courier)[0];
  assert.equal(returning.phase, "return");
  transfer(context, courier, returning);
  assert.equal(state.resourceInventory.clay, 30);
  assert.equal(state.evolutionPoints, points);
  assert.equal(courier.transportCargo, null);
});

test("창고에 있는 자재는 해당 창고까지 가서 출고하고 파괴 후에도 화물을 보존한다", () => {
  const context = fixture("storage"), { state, storage, supply, couriers } = context;
  storage.remove("clay", 30);
  state.buildings.push({ id: "warehouse", key: "storage", x: 55, y: 40, width: 3, height: 3, health: 100 });
  const warehouse = storage.refresh().find(store => store.id === "warehouse");
  storage.deposit(warehouse, "clay", 10);
  const saved = structuredClone(state);
  saved.buildings[0].health = 0;
  const restored = createResourceStorage(saved, context.colony);
  restored.restore();
  assert.equal(saved.resourceInventory.clay || 0, 0);
  assert.equal(saved.resourceStores.find(store => store.id === "warehouse").inventory.clay, 10);
  const job = supply.plans(couriers[0])[0];
  assert.equal(job.storeId, "warehouse");
  assert.ok(job.target.x >= 54);
  transfer(context, couriers[0], job);
  state.buildings[0].health = 0;
  supply.refresh();
  assert.equal(couriers[0].carrying, 2);
  assert.equal(warehouse.inventory.clay, 8);
  assert.equal(warehouse.kind, "remains");
  assert.equal(supply.plans(couriers[0])[0].phase, "deliver");
});

function gameFixture(couriers) {
  const colony = { id: 1, ownerId: "supply-test", tribe: "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 2;
  saved.state.evolutionPoints = 200;
  saved.state.resourceInventory = { clay: 40 };
  saved.state.templates = [];
  saved.state.agents = saved.state.agents.slice(0, 1 + couriers);
  saved.state.agents.forEach((agent, index) => Object.assign(agent, {
    slots: index ? ["strength"] : ["construction"], attributeLevels: {}, birth: null, health: 100,
    bornAt: 0, lifespan: 1000, x: index ? 40 + index : 50, y: index ? 45 : 41,
    renderFromX: index ? 40 + index : 50, renderFromY: index ? 45 : 41, moveDuration: 0,
    utility: null, decisionPending: "restore", nextDecisionAt: 0
  }));
  saved.state.agents[0].construction = { buildingKey: "storage", x: 49, y: 40,
    route: [{ x: 50, y: 41 }], routeIndex: 0, state: "moving", startedAt: null, readyAt: null, orderedAt: 0 };
  saved.state.explored = { collection: "Set", entries: [] };
  for (let y = 10; y <= 80; y++) for (let x = 10; x <= 80; x++) saved.state.explored.entries.push(y * 320 + x);
  game.restore(JSON.stringify(saved));
  return { game, environment, builderId: game.agents[0].id };
}

function tick(context) {
  context.environment.simSeconds += .25;
  context.game.prepare(context.environment.simSeconds);
  context.game.tick(.25);
}

function interruptedSupply() {
  const context = gameFixture(3), { game, environment } = context;
  environment.simSeconds = 100;
  environment.world.terrain.fill(4);
  for (let x = 0; x < 320; x++) environment.world.terrain[45 * 320 + x] = 0;
  for (const y of [41, 43]) environment.food.set("37," + y,
    { x: 37, y, amount: 500, initialAmount: 500, resourceType: "clay", kind: "resource", terrain: "grassland" });
  const saved = JSON.parse(game.save()), prototype = saved.state.agents[1];
  saved.state.simSeconds = 100;
  saved.state.nestLevel = 3;
  saved.state.evolutionPoints = 0;
  saved.state.colonyFood = 0;
  saved.state.lastFoodAt = 40;
  saved.state.supplyInterrupted = true;
  saved.state.foodIncome = [];
  saved.state.foodIncomeStartedAt = 100;
  saved.state.agents = [saved.state.agents[0], ...Array.from({ length: 6 }, (_, index) => ({ ...structuredClone(prototype),
    id: "courier:" + index, slots: ["strength", "feet", "lifespan"], attributeLevels: {},
    bornAt: 100, x: 39 + index % 3, y: 40 + Math.floor(index / 3) * 3,
    renderFromX: 39 + index % 3, renderFromY: 40 + Math.floor(index / 3) * 3,
    moveDuration: 0, carrying: 0, carryingType: null, utility: null, transport: null, transportCargo: null,
    personality: { boldness: .5, aggression: 0, curiosity: 0 }, decisionPending: "restore", nextDecisionAt: 100 }))];
  Object.assign(saved.state.agents[0], { bornAt: 100, x: 47, y: 39, renderFromX: 47, renderFromY: 39,
    construction: { buildingKey: "watchpost", x: 47, y: 39, state: "transforming", startedAt: 100, readyAt: 115,
      route: [{ x: 47, y: 39 }], routeIndex: 0,
      orderedAt: 100, supplyVersion: 1, id: "interrupted-watchpost", required: { clay: 8, tree: 6, "grass-fiber": 4 },
      delivered: { clay: 8, tree: 3, "grass-fiber": 2 }, consumed: { clay: 4, tree: 3, "grass-fiber": 2 },
      progress: .5, stage: 2, supplyWaiting: true } });
  saved.state.buildings = [{ id: "warehouse", key: "storage", x: 46, y: 48, width: 3, height: 3, health: 120 }];
  saved.state.resourceStores = [
    { id: "nest:1", kind: "nest", x: 40, y: 40, width: 5, height: 5, capacity: 50, inventory: {} },
    { id: "warehouse", kind: "storage", x: 46, y: 48, width: 3, height: 3, capacity: 60, inventory: { tree: 3, "grass-fiber": 2 } }
  ];
  saved.state.resourceInventory = { tree: 3, "grass-fiber": 2 };
  saved.state.knownFood = { collection: "Map", entries: [...environment.food].map(([key, food]) => [key, { ...food }]) };
  game.restore(JSON.stringify(saved));
  return context;
}

test("공급로 재개 후 먹이를 계속 확보하면서 45초 안에 감시봉 자재를 다시 납품한다", () => {
  const context = interruptedSupply(), { game, environment } = context;
  for (let index = 0; index < 80; index++) tick(context);
  const waiting = game.agents.find(agent => agent.id === context.builderId).construction;
  assert.equal(waiting.progress, .5);
  const foodBefore = game.colonyFood, openedAt = environment.simSeconds;
  environment.world.terrain[45 * 320 + 47] = 10;
  let firstAssignment = null, firstDelivery = null, parallel = false;
  for (let index = 0; index < 180; index++) {
    tick(context);
    const builder = game.agents.find(agent => agent.id === context.builderId);
    if (firstAssignment === null && game.agents.some(agent => agent.transport?.siteId)) firstAssignment = environment.simSeconds - openedAt;
    if (firstDelivery === null && (!builder || builder.construction.progress > .5)) firstDelivery = environment.simSeconds - openedAt;
    parallel ||= game.agents.some(agent => agent.transportCargo) && game.agents.some(agent => agent.utility?.action === "collect");
  }
  assert.ok(firstAssignment !== null && firstAssignment <= 15, "채집한 먹이를 반납한 뒤 운반 인력이 바로 전환되어야 한다: " + firstAssignment);
  assert.ok(firstDelivery !== null && firstDelivery <= 45, "경로가 열린 뒤 다음 자재가 현장에 도착해야 한다: " + firstDelivery);
  assert.ok(game.colonyFood > foodBefore, "건설 자재를 운반하는 동안 먹이 납품도 유지해야 한다");
  assert.equal(parallel, true);
  assert.ok(environment.food.get("37,41").amount + environment.food.get("37,43").amount > 900, "먹이 고갈을 기다려서는 안 된다");
});

test("실제 게임에서 일꾼이 왕복하고 저장·복원 후에도 자재 소모로 창고를 완성한다", () => {
  const context = gameFixture(3), { game } = context;
  let cargo = false, restored = false, grew = false;
  for (let index = 0; index < 600 && !game.buildings.some(building => building.key === "storage"); index++) {
    tick(context);
    const builder = game.agents.find(agent => agent.id === context.builderId);
    cargo ||= game.agents.some(agent => agent.transportCargo && agent.carrying > 0);
    grew ||= builder?.construction?.progress > 0;
    if (!restored && builder?.construction?.progress > 0) { game.restore(game.save()); restored = true; }
  }
  assert.equal(cargo, true);
  assert.equal(grew, true);
  assert.equal(restored, true);
  assert.equal(game.buildings.filter(building => building.key === "storage").length, 1);
  assert.equal(game.agents.some(agent => agent.id === context.builderId), false);
  assert.equal(game.snapshot().resourceInventory.clay, 30);
  assert.equal(game.snapshot().evolutionPoints, 200);
  assert.equal(game.snapshot().resourceCapacity, 100);
});

test("운반 인력이 없으면 재료와 개체를 보존하며 변태가 대기한다", () => {
  const context = gameFixture(0), { game } = context;
  for (let index = 0; index < 120; index++) tick(context);
  assert.equal(game.buildings.length, 0);
  assert.equal(game.agents[0].construction.progress, 0);
  assert.equal(game.snapshot().resourceInventory.clay, 40);
});

test("다른 종족 건설 AI가 고른 신규 현장에도 운반 예측과 예약을 연결한다", () => {
  const context = gameFixture(3), { game } = context;
  const saved = JSON.parse(game.save());
  saved.state.agents[0].construction = null;
  game.restore(JSON.stringify(saved));
  for (let index = 0; index < 20 && !game.agents[0].construction; index++) tick(context);
  assert.equal(game.agents[0].construction?.buildingKey, "storage");
  assert.equal(game.agents[0].construction?.supplyVersion, 1);
  for (let index = 0; index < 600 && !game.buildings.some(building => building.key === "storage"); index++) tick(context);
  assert.equal(game.buildings.filter(building => building.key === "storage").length, 1);
  assert.equal(game.snapshot().resourceInventory.clay, 30);
});

test("건설에 부족한 기본 재료는 가까운 전초에서 포인트만 받지 않고 저장 시설로 가져온다", () => {
  const context = gameFixture(1), { game } = context;
  const saved = JSON.parse(game.save());
  saved.state.resourceInventory = {};
  saved.state.buildings = [{ id: "outpost", key: "outpost", x: 54, y: 45, width: 3, height: 3, health: 200 }];
  Object.assign(saved.state.agents[1], { x: 53, y: 45, renderFromX: 53, renderFromY: 45,
    carrying: 1, carryingType: "clay", utility: null, mode: "return" });
  game.restore(JSON.stringify(saved));
  for (let index = 0; index < 500 && game.snapshot().evolutionPoints === 200; index++) tick(context);
  const snapshot = game.snapshot();
  assert.equal(snapshot.evolutionPoints, 201);
  assert.equal(snapshot.resourceStores.find(store => store.kind === "nest").inventory.clay, 1);
});

test("다른 개체가 현장을 통과할 때 예약과 진척을 유지하고 비워진 뒤 완공한다", () => {
  const context = gameFixture(1), { game } = context;
  const builder = game.agents[0], walker = game.agents[1], plan = builder.construction;
  Object.assign(walker, { x:49, y:40, renderFromX:49, renderFromY:40, moveStartedAt:0, moveDuration:100 });
  for (let index = 0; index < 4; index++) tick(context);
  assert.equal(builder.construction, plan);
  assert.equal(builder.constructionError ?? null, null);
  assert.equal(game.buildings.length, 0);
  Object.assign(walker, { x:44, y:45, renderFromX:44, renderFromY:45, moveDuration:0, utility:null, decisionPending:"completed" });
  for (let index = 0; index < 600 && !game.buildings.length; index++) tick(context);
  assert.equal(game.buildings[0]?.key, "storage");
  assert.equal(game.snapshot().resourceInventory.clay, 30);
});

test("다섯 일꾼의 첫 납품으로 자재 10개가 모이면 불필요한 귀환 왕복을 더하지 않는다",()=>{const f=fixture("storage");delete f.builder.construction;f.builder.lifespan=100;const attributes=attributeCounts(["strength","feet"]);f.state.agents=[f.builder,...Array.from({length:5},(_,index)=>({id:"relay:"+index,tribe:"bean",health:100,x:44,y:40,bornAt:0,lifespan:100,slots:["strength","feet"],attributes,stats:unitStats(attributes,"bean"),carrying:0,carryingType:null}))];const result=f.supply.forecast(f.builder,{buildingKey:"storage",x:74,y:41});assert.ok(result);assert.equal(result.couriers,5);assert.ok(result.deliverySeconds>40&&result.deliverySeconds<60);assert.ok(result.buildSeconds<75);});

test("아홉 운반 개체가 세 자재를 나누어 첫 납품을 하면 각 자재의 도착 시간을 직렬로 더하지 않는다",()=>{const f=fixture("watchpost");delete f.builder.construction;f.builder.lifespan=100;const attributes=attributeCounts(["strength","feet"]);f.state.agents=[f.builder,...Array.from({length:9},(_,index)=>({id:"parallel:"+index,tribe:"bean",health:100,x:44,y:40,bornAt:0,lifespan:100,slots:["strength","feet"],attributes,stats:unitStats(attributes,"bean"),carrying:0,carryingType:null}))];const result=f.supply.forecast(f.builder,{buildingKey:"watchpost",x:74,y:41});assert.ok(result);assert.equal(result.ready,true);assert.equal(result.deliveredUnits,18);assert.ok(result.deliverySeconds>40&&result.deliverySeconds<60);});
test("인력 한 명이 아직 전체 공사를 감당하지 못해도 실제 추가 납품 수량으로 보충 효과를 판단한다",()=>{const f=fixture("storage");delete f.builder.construction;f.builder.lifespan=100;const attributes=attributeCounts(["strength","feet"]),worker=id=>({id,tribe:"bean",health:100,x:44,y:40,bornAt:0,lifespan:100,slots:["strength","feet"],attributes,stats:unitStats(attributes,"bean"),carrying:0,carryingType:null});f.state.agents=[f.builder,worker("one")];const plan={buildingKey:"storage",x:74,y:41},before=f.supply.forecast(f.builder,plan,true);assert.equal(before.ready,false);assert.equal(before.deliveredUnits,2);assert.equal(f.supply.forecast(f.builder,plan),null);f.state.agents=f.state.agents.concat(worker("two"));const after=f.supply.forecast(f.builder,plan,true);assert.equal(after.ready,false);assert.equal(after.deliveredUnits,4);});

test("같은 작업자 배열이 복사돼도 수급 캐시를 유지하며 부상으로 가용 인력이 바뀌면 즉시 재계산한다",()=>{const f=fixture("storage");f.state.knownFood.set("food",{x:46,y:46,amount:100,resourceType:"clay"});let calls=0;const route=(agent,target)=>{calls++;const cells=[{x:agent.x,y:agent.y}];while(cells.at(-1).x!==target.x)cells.push({x:cells.at(-1).x+Math.sign(target.x-cells.at(-1).x),y:cells.at(-1).y});while(cells.at(-1).y!==target.y)cells.push({x:target.x,y:cells.at(-1).y+Math.sign(target.y-cells.at(-1).y)});return cells;};const supply=createConstructionSupply({state:f.state,colony:f.colony,storage:f.storage,walkable:()=>true,isFood:type=>type==="clay",deliveryCells:()=>f.storage.cells(f.storage.refresh()[0]),route});const first=supply.allocation(),count=calls;assert.ok(first.ids.size>0);f.state.agents=[...f.state.agents];f.state.simSeconds=.25;assert.equal(supply.allocation(),first);assert.equal(calls,count);const id=[...first.ids][0];f.state.agents.find(agent=>agent.id===id).health=20;const next=supply.allocation();assert.ok(!next.ids.has(id));assert.ok(calls>count);});
