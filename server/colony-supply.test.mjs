import test from "node:test";
import assert from "node:assert/strict";
import { colonySupply, colonyForagers, recordColonyIncome, restoreColonyIncome } from "./colony-supply.mjs";
import { createUtilityAI } from "./utility.mjs";
import { attributeCounts, unitStats } from "./attributes.mjs";

function fixture(points) {
  const attributes = attributeCounts(["feet"]);
  const agent = { id:"supply", x:4, y:4, bornAt:180, lifespan:180, health:100, cost:8, carrying:0,
    slots:["feet"], attributes, stats:unitStats(attributes, "pebble"), stepCount:0,
    personality:{boldness:.5,aggression:.5,curiosity:1}, visited:new Set(["4,4"]), preciseHarvestTimes:new Map() };
  const food = { x:10, y:4, amount:1, resourceType:"pebbles" };
  const state = { simSeconds:200, nestLevel:2, evolutionPoints:points, agents:[agent], markers:[],
    knownFood:new Map([["10,4", food]]), explored:new Set() };
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) state.explored.add(y * 32 + x);
  const context = { state, size:32, permanentVisionSources:()=>[{x:4,y:3,radius:6}],
    homeCells:()=>[{x:4,y:3}], deliveryCells:()=>[{x:4,y:3}],
    walkable:(x,y)=>x>=0&&y>=0&&x<32&&y<32&&state.explored.has(y*32+x), hazardAt:()=>0,
    enemies:()=>[], synergy:()=>false, canHarvest:()=>true, isFood:type=>type==="pebbles",
    resourceType:food=>food.resourceType, harvestSeconds:()=>2.5, materialSpace:()=>100 };
  const ai = createUtilityAI(context);
  return { state, agent, ai, context };
}

test("최후 개체의 복제 자금이 부족하면 성향보다 안전한 자원 수급을 우선한다", () => {
  const f = fixture(0), poor = f.ai.evaluate(f.agent, true);
  assert.equal(poor[0].action, "collect");
  assert.equal(colonySupply(f.state).urgency, 1);
  f.state.evolutionPoints = 490;
  const rich = f.ai.evaluate(f.agent, true);
  assert.equal(colonySupply(f.state).urgency, 0);
  assert.ok(poor.find(candidate=>candidate.action==="collect").score > rich.find(candidate=>candidate.action==="collect").score);
  assert.ok(poor.every(candidate=>candidate.action!=="explore"));
  assert.ok(rich.every(candidate=>candidate.action!=="explore"));
});

test("자원을 모르면 수급 위기에도 탐색을 중단하지 않는다", () => {
  const f = fixture(2);
  f.state.knownFood.clear();
  assert.equal(f.ai.evaluate(f.agent, false)[0].action, "explore");
});

test("수급이 급해도 퇴각·회복 우선순위는 유지한다", () => {
  const f = fixture(2);
  f.agent.health = 5;
  const plans = f.ai.evaluate(f.agent, false);
  assert.ok(["recover", "flee"].includes(plans[0].action));
});

test("교체 잔액이 남아도 납품 중단을 감지하고 수급이 안정될 때까지 유지한다", () => {
  const f=fixture(12);
  f.state.lastFoodAt=100;
  assert.equal(colonySupply(f.state).interruption,1);
  assert.equal(f.ai.evaluate(f.agent,false)[0].action,"collect");
  f.state.lastFoodAt=200;
  assert.ok(colonySupply(f.state).interruption>0);
  f.state.evolutionPoints=24;
  assert.equal(colonySupply(f.state).interruption,0);
});

test("위기 채집은 나이와 무관하게 일부 개체에 맡기고 전문 재료 채집 개체를 남긴다", () => {
  const f=fixture(12), foods=[{x:10,y:4}], homes=[{x:4,y:3}];
  f.state.agents=Array.from({length:4},(_,i)=>({...f.agent,id:String(i),stats:{...f.agent.stats,capacity:i===2?3:1}}));
  f.state.agents[0].bornAt=25;
  f.state.agents[2].attributes={blade:1};
  const assigned=colonyForagers(f.state,foods,homes);
  assert.equal(assigned.has("0"),true);
  assert.equal(assigned.has("2"),false);
  assert.equal(assigned.size,2);
});

test("마지막 재료 채집 개체도 자원 수급이 급하면 자원을 먼저 납품한다", () => {
  const f=fixture(0);
  f.agent.attributes={blade:1};f.state.lastFoodAt=100;
  f.context.constructionMaterials=()=>({tree:4});
  f.state.knownFood.set("5,4",{x:5,y:4,amount:30,resourceType:"tree"});
  assert.equal(f.ai.evaluate(f.agent,false)[0].target.key,"10,4");
});

test("최근 60초 실수령률과 개체 교체 유지율은 별개로 계산하며 오래된 납품을 제외한다", () => {
  const f = fixture(0);
  f.state.foodIncomeStartedAt = 0;
  f.state.foodIncome = [];
  f.state.simSeconds = 30;
  recordColonyIncome(f.state, 3);
  f.state.simSeconds = 60;
  recordColonyIncome(f.state, 3);
  const current = colonySupply(f.state, "pebble");
  assert.equal(current.incomeRate, .1);
  assert.equal(current.maintenanceRate,0);
  assert.equal(current.rateDeficit, 0);
  f.state.simSeconds = 121;
  const starved = colonySupply(f.state, "pebble");
  assert.equal(starved.incomeRate, 0);
  assert.equal(starved.rateDeficit,0);
  assert.ok(starved.urgency > 0);
});

test("낮은 수급률도 보유 포인트로 교체를 감당하면 긴급 확장으로 오인하지 않는다", () => {
  const f = fixture(500);
  f.state.foodIncomeStartedAt = 0;
  f.state.foodIncome = [];
  f.state.lastFoodAt = 0;
  const supply = colonySupply(f.state, "pebble");
  assert.equal(supply.rateDeficit,0);
  assert.ok(supply.forecastBalance > 0);
  assert.equal(supply.urgency, 0);
});

test("복원 수급 이력은 미래·음수·기한 밖 항목을 제거하고 관측 시작 시각을 복원한다", () => {
  const state = { simSeconds:100 };
  restoreColonyIncome(state, { foodIncomeStartedAt:10, foodIncome:[[0,10],[50,2],[101,3],[90,-2]] });
  assert.deepEqual(state.foodIncome, [[50,2]]);
  assert.equal(state.foodIncomeStartedAt, 10);
  restoreColonyIncome(state, {});
  assert.deepEqual(state.foodIncome, []);
  assert.equal(state.foodIncomeStartedAt, 100);
});
