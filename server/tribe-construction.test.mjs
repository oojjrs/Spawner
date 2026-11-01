import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { buildingCost } from "./buildings.mjs";
import { tribeExpansion, tribeConstructionNeeds } from "./tribe-construction.mjs";

function fixture(tribe, slots) {
  const colony = { id: 1, ownerId: "metamorphosis", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.agents = saved.state.agents.slice(0, 2);
  saved.state.nestLevel = 2;
  saved.state.evolutionPoints = 200;
  const native = { bean: "clay", spore: "tree", pebble: "pebbles", spring: "dew" }[tribe];
  saved.state.resourceInventory = { [native]: 250 };
  saved.state.explored = { collection: "Set", entries: [] };
  for (let y = 34; y <= 55; y++) for (let x = 34; x <= 55; x++) saved.state.explored.entries.push(y * 320 + x);
  Object.assign(saved.state.agents[0], { slots, attributeLevels: Object.fromEntries(slots.map(key => [key, 1])),
    x: 47, y: 42, renderFromX: 47, renderFromY: 42, moveDuration: 0, birth: null, lifespan: 1000,
    actionPriorities: [], personality: { boldness: .5, aggression: .5, curiosity: 0 }, utility: null, decisionPending: "restore", nextDecisionAt: 0 });
  Object.assign(saved.state.agents[1], { slots: ["strength"], x: 40, y: 45, renderFromX: 40, renderFromY: 45,
    moveDuration: 0, birth: null, lifespan: 1000, utility: null, decisionPending: null, nextDecisionAt: 1000 });
  game.restore(JSON.stringify(saved));
  return { game, environment, native, agentId: game.agents[0].id };
}

function advance(context, seconds) {
  const until = context.environment.simSeconds + seconds;
  while (context.environment.simSeconds < until) {
    context.environment.simSeconds = Math.min(until, context.environment.simSeconds + .25);
    context.game.prepare(context.environment.simSeconds);
    context.game.tick(.25);
  }
}

test("자원이 고갈되면 종족별 자원 군집을 전초 후보로 삼고 재료 부족분을 계산한다", () => {
  for(const [tribe,native] of Object.entries({bean:"clay",spore:"tree",pebble:"pebbles",spring:"dew"})) {
    const state={nestLevel:2,simSeconds:200,lastFoodAt:100,evolutionPoints:12,agents:[{health:100},{health:100}],
      buildings:[],templates:[],resourceInventory:{[native]:30},
      knownFood:new Map([["food",{x:75,y:42,amount:12,resourceType:native}],["ore",{x:90,y:42,amount:500,resourceType:"iron-ore"}]])};
    const nests=[{x:40,y:40,width:5,height:5}];
    const expansion=tribeExpansion(state,tribe,nests);
    assert.equal(expansion.anchor.resourceType,native,tribe);
    assert.equal(expansion.materials[native],Math.max(0,buildingCost("outpost",tribe).materials[native]-30),tribe);
    for(const [key,amount] of Object.entries(buildingCost("outpost",tribe).materials)) state.resourceInventory[key]=amount;
    const needs=tribeConstructionNeeds(state,tribe,nests,[]);
    assert.equal(needs[0].buildingKey,"outpost",tribe);
    assert.equal(needs[0].anchor.x,75,tribe);
  }
});

test("자원이 줄어들면 새 자원 발견 전에도 재료를 준비하고 엉뚱한 자원으로 전초를 짓지 않는다", () => {
  const state={nestLevel:2,simSeconds:200,lastFoodAt:100,evolutionPoints:12,agents:[{health:100},{health:100}],
    buildings:[],templates:[],resourceInventory:{dew:12,tree:4,pebbles:4},
    knownFood:new Map([["ore",{x:90,y:42,amount:500,resourceType:"iron-ore"}]])};
  const nests=[{x:40,y:40,width:5,height:5}];
  assert.equal(tribeExpansion(state,"spring",nests).anchor,null);
  assert.equal(tribeConstructionNeeds(state,"spring",nests,[]).length,0);
});

test("아직 새 자원을 못 찾았으면 실제 탐색 중인 전방 경계로 전초를 전진시킨다", () => {
  const state={nestLevel:2,simSeconds:200,lastFoodAt:100,colonyFood:100,evolutionPoints:20,
    agents:[{health:100,utility:{action:"explore",target:{x:75,y:42}}}],buildings:[],templates:[],resourceInventory:{dew:30,tree:4},knownFood:new Map()};
  const nests=[{x:40,y:40,width:5,height:5}], expansion=tribeExpansion(state,"spring",nests);
  assert.equal(expansion.anchor.x,75);
  assert.equal(expansion.gains.informationGain,80);
  assert.equal(tribeConstructionNeeds(state,"spring",nests,[])[0].buildingKey,"outpost");
  nests.push({key:"outpost",x:54,y:42,width:3,height:3});
  state.agents[0].utility.target={x:100,y:42};
  assert.equal(tribeExpansion(state,"spring",nests).anchor,null);
});

test("건설 개체의 수명으로 자원까지 못 가면 알려진 경로 중간에 전초를 완성한다", () => {
  const context=fixture("spring",["construction"]), {game,environment,agentId}=context;
  const saved=JSON.parse(game.save());
  environment.simSeconds=100; saved.state.simSeconds=100; saved.state.lastFoodAt=0;
  saved.state.resourceInventory={dew:50,tree:12,pebbles:12};
  const agent=saved.state.agents.find(a=>a.id===agentId);
  agent.bornAt=0; agent.lifespan=200;
  for(let y=34;y<=55;y++)for(let x=56;x<=104;x++)saved.state.explored.entries.push(y*320+x);
  const food={x:100,y:42,amount:120,resourceType:"dew",kind:"resource"};
  saved.state.knownFood.entries.push(["100,42",food]);environment.food.set("100,42",food);
  game.restore(JSON.stringify(saved));
  advance(context,.25);
  const plan=game.agents.find(a=>a.id===agentId).construction;
  assert.equal(plan?.buildingKey,"outpost");
  assert.ok(plan.x>55&&plan.x<90);
  assert.equal(game.snapshot().resourceInventory.dew,50);
  advance(context,90);
  assert.ok(game.buildings.some(b=>b.key==="outpost"));
  assert.equal(game.agents.some(a=>a.id===agentId),false);
  assert.equal(game.snapshot().resourceInventory.dew,50-buildingCost("outpost","spring").materials.dew);
  assert.equal(JSON.parse(game.save()).state.lastFoodAt,0);
});

test("네 종족은 변태 속성 개체로 필요한 창고와 장소를 자동 선택하고 한 번만 변태한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const context = fixture(tribe, ["construction"]), { game, agentId, native } = context;
    advance(context, .25);
    const plan = game.agents.find(agent => agent.id === agentId).construction;
    assert.equal(plan?.buildingKey, "storage", tribe);
    assert.equal(game.snapshot().resourceInventory[native], 250, tribe);
    game.restore(game.save());
    advance(context, 40);
    assert.equal(game.buildings.length, 1, tribe);
    assert.equal(game.buildings[0].key, "storage", tribe);
    assert.equal(game.agents.some(agent => agent.id === agentId), false, tribe);
    assert.equal(game.snapshot().resourceInventory[native], 250 - buildingCost("storage", tribe).materials[native], tribe);
    assert.equal(game.agents.length, 1, tribe);
  }
});

test("변태 속성이 없으면 군락에 건물이 필요해도 변태하지 못한다", () => {
  const context = fixture("bean", ["strength"]);
  advance(context, 10);
  assert.equal(context.game.buildings.length, 0);
  assert.ok(context.game.agents.every(agent => !agent.construction));
  assert.equal(context.game.agents.length, 2);
});

test("종족 판단은 저장 공간보다 설계 강화가 필요한 상황에서 진화실을 선택한다", () => {
  const context = fixture("bean", ["construction"]), { game, agentId } = context;
  const saved = JSON.parse(game.save());
  saved.state.resourceInventory = { clay:16, tree:8, pebbles:4, "grass-fiber":4 };
  game.restore(JSON.stringify(saved));
  game.command({ type: "design", templateId: null, name: "강화할 설계", slots: ["antenna"], birth: false });
  advance(context, .25);
  assert.equal(game.agents.find(agent => agent.id === agentId).construction?.buildingKey, "evolution-lab");
});

test("변태 재료가 없거나 마지막 개체이면 자율 변태를 시작하지 않는다", () => {
  for (const condition of ["materials", "last-agent"]) {
    const context = fixture("bean", ["construction"]), saved = JSON.parse(context.game.save());
    if (condition === "materials") saved.state.resourceInventory = {};
    else saved.state.agents.splice(1);
    context.game.restore(JSON.stringify(saved));
    advance(context, 5);
    assert.equal(context.game.buildings.length, 0, condition);
    assert.ok(context.game.agents.every(agent => !agent.construction), condition);
  }
});

test("건물 종류와 위치를 지정하는 수동 명령은 받지 않는다", () => {
  const { game, agentId } = fixture("bean", ["construction"]);
  assert.throws(() => game.command({ type: "build", agentId, buildingKey: "storage", x: 48, y: 42 }), /지원하지 않는 요청/);
});

test("속성이 있어도 해금하지 않은 건물이나 위험한 장소로 변태하지 않는다", () => {
  for (const condition of ["level", "hazard"]) {
    const context = fixture("bean", ["construction"]), saved = JSON.parse(context.game.save());
    if (condition === "level") {
      saved.state.nestLevel = 1;
      saved.state.resourceInventory = { clay: 50, tree: 50, pebbles: 50 };
      saved.state.templates = [{ id: 10, name: "미해금 강화", slots: ["antenna"], attributeLevels: { antenna: 1 }, revision: 1 }];
    } else context.environment.world.hazards.fill(1);
    context.game.restore(JSON.stringify(saved));
    advance(context, .25);
    assert.ok(context.game.agents.every(agent => !agent.construction), condition);
    assert.equal(context.game.buildings.length, 0, condition);
  }
});

test("저장된 변태 계획도 속성이 없으면 취소하고 개체와 자원을 보존한다", () => {
  const context = fixture("bean", ["construction"]);
  advance(context, .25);
  const saved = JSON.parse(context.game.save());
  assert.ok(saved.state.agents[0].construction);
  saved.state.agents[0].slots = ["strength"];
  saved.state.agents[0].attributeLevels = { strength: 1 };
  context.game.restore(JSON.stringify(saved));
  assert.equal(context.game.agents[0].construction, null);
  advance(context, 5);
  assert.equal(context.game.buildings.length, 0);
  assert.equal(context.game.snapshot().resourceInventory.clay, 250);
});


test("건물 파괴는 대기 중인 변태 개체의 판단을 즉시 깨우며 진행 중인 계획은 보존한다", () => {
  const { game, agentId } = fixture("bean", ["construction"]);
  const saved = JSON.parse(game.save());
  saved.state.buildings = [{ id:"watch-lost", key:"watchpost", x:52, y:52, health:80 }];
  const builder = saved.state.agents.find(agent => agent.id === agentId);
  builder.decisionPending = null; builder.nextDecisionAt = 999;
  game.restore(JSON.stringify(saved));
  game.receiveBuildingDamage("watch-lost", 80);
  assert.equal(game.agents.find(agent => agent.id === agentId).decisionPending, "targetLost");
  assert.equal(game.agents.find(agent => agent.id === agentId).nextDecisionAt, 0);
});

test("납품 수급 이력은 저장 복원하며 구형 저장에는 과거 수급을 지어내지 않는다", () => {
  const { game } = fixture("bean", ["construction"]);
  const saved = JSON.parse(game.save());
  saved.state.simSeconds = 100;
  saved.state.foodIncomeStartedAt = 20;
  saved.state.foodIncome = [[50, 3], [95, 2]];
  game.restore(JSON.stringify(saved));
  const restored = JSON.parse(game.save()).state;
  assert.deepEqual(restored.foodIncome, [[50,3],[95,2]]);
  assert.equal(restored.foodIncomeStartedAt, 20);
  delete saved.state.foodIncome;
  delete saved.state.foodIncomeStartedAt;
  game.restore(JSON.stringify(saved));
  const legacy = JSON.parse(game.save()).state;
  assert.deepEqual(legacy.foodIncome, []);
  assert.equal(legacy.foodIncomeStartedAt, 100);
});


test("재료와 운반 일손이 준비되면 건설 점수의 최상위 후보를 현장 공급 계획으로 시작한다", () => {
  const context=fixture("bean",["construction"]),{game,agentId}=context;
  const saved=JSON.parse(game.save());
  saved.state.resourceInventory={clay:40};
  const builder=saved.state.agents[0],worker=saved.state.agents[1];
  saved.state.agents=[builder,...Array.from({length:4},(_,index)=>({...worker,id:"courier-"+index,
    x:39+index,y:46,renderFromX:39+index,renderFromY:46,bornAt:0,lifespan:1000,
    nextDecisionAt:0,decisionPending:"restore",utility:null,transport:null,transportCargo:null}))];
  game.restore(JSON.stringify(saved));
  advance(context,.25);
  const plan=game.agents.find(agent=>agent.id===agentId).construction;
  assert.equal(plan?.buildingKey,"storage");
  assert.equal(plan.supplyVersion,1);
  assert.equal(plan.required.clay,10);
  assert.equal(game.snapshot().resourceInventory.clay,40);
});
