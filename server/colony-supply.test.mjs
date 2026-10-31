import test from "node:test";
import assert from "node:assert/strict";
import { colonySupply, colonyForagers, recordColonyIncome, restoreColonyIncome } from "./colony-supply.mjs";
import { createUtilityAI } from "./utility.mjs";
import { attributeCounts, unitStats } from "./attributes.mjs";

function fixture(points) {
  const attributes = attributeCounts(["antenna", "feet"]);
  const agent = { id:"supply", x:4, y:4, bornAt:180, lifespan:180, health:100, cost:8, carrying:0,
    slots:["antenna", "feet"], attributes, stats:unitStats(attributes, "pebble"), stepCount:0,
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

test("최후 개체의 복제 자금이 부족하면 성향보다 안전한 먹이 수급을 우선한다", () => {
  const f = fixture(2), poor = f.ai.evaluate(f.agent, true);
  assert.equal(poor[0].action, "collect");
  assert.equal(colonySupply(f.state).urgency, 1);
  f.state.evolutionPoints = 490;
  const rich = f.ai.evaluate(f.agent, true);
  assert.equal(colonySupply(f.state).urgency, 0);
  assert.ok(poor.find(candidate=>candidate.action==="collect").score > rich.find(candidate=>candidate.action==="collect").score);
  assert.ok(poor.filter(candidate=>candidate.action==="explore")[0].score < rich.filter(candidate=>candidate.action==="explore")[0].score);
});

test("먹이를 모르면 수급 위기에도 탐색을 중단하지 않는다", () => {
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

test("수명 경고·탄생·포인트 변화를 반영하고 교체 여력이 있으면 위기를 해제한다", () => {
  const f = fixture(0);
  f.state.agents = Array.from({length:3}, (_,index)=>({...f.agent,id:String(index),bornAt:0,lifespan:240,slots:["strength"]}));
  f.state.simSeconds = 179;
  assert.equal(colonySupply(f.state).urgency, 0);
  f.state.simSeconds = 180;
  assert.equal(colonySupply(f.state).reserve, 10.8);
  assert.equal(colonySupply(f.state).expiring, 3);
  assert.equal(colonySupply(f.state).urgency, 1);
  f.state.evolutionPoints = 15;
  assert.equal(colonySupply(f.state).urgency, 0);
  f.state.agents.push({...f.agent,id:"child",bornAt:180});
  assert.equal(colonySupply(f.state).living, 4);
});

test("초반 수급 전망이 성장·교체 비용에 못 미치면 수명 경고 전부터 먹이를 확보한다", () => {
  const f = fixture(4);
  f.state.nestLevel = 1; f.state.simSeconds = 60; f.state.colonyFood = 4;
  f.state.agents = Array.from({length:3}, (_,index)=>({...f.agent,id:String(index),bornAt:0,lifespan:240,slots:["strength"]}));
  assert.equal(colonySupply(f.state).expiring, 0);
  assert.ok(colonySupply(f.state).urgency > 0);
  f.state.evolutionPoints = 45; f.state.colonyFood = 45;
  assert.equal(colonySupply(f.state).urgency, 0);
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

test("위기 채집은 수명이 충분한 일부 개체에 맡기고 전문 재료 채집 개체를 남긴다", () => {
  const f=fixture(12), foods=[{x:10,y:4}], homes=[{x:4,y:3}];
  f.state.agents=Array.from({length:4},(_,i)=>({...f.agent,id:String(i),stats:{...f.agent.stats,capacity:i===2?3:1}}));
  f.state.agents[0].bornAt=25;
  f.state.agents[2].attributes={blade:1};
  const assigned=colonyForagers(f.state,foods,homes);
  assert.equal(assigned.has("0"),false);
  assert.equal(assigned.has("2"),false);
  assert.equal(assigned.size,2);
});

test("납품 가능한 수명이 모자라면 위기 역할로 왕복을 강제하지 않는다", () => {
  const f=fixture(12);
  f.state.lastFoodAt=100;
  f.agent.bornAt=25;
  assert.equal(colonyForagers(f.state,[{x:10,y:4}],[{x:4,y:3}]).size,0);
});

test("전초 재료가 필요하면 가까운 다른 재료보다 필요한 재료를 골라 운반한다", () => {
  const f=fixture(12);
  f.agent.attributes={blade:1};
  f.state.agents.push({...f.agent,id:"worker",attributes:{feet:1}});
  f.context.constructionMaterials=()=>({tree:4});
  for(let x=5;x<12;x++)f.state.knownFood.set(x+",5",{x,y:5,amount:30,resourceType:"grass-fiber"});
  f.state.knownFood.set("10,10",{x:10,y:10,amount:30,resourceType:"tree"});
  assert.equal(f.ai.evaluate(f.agent,false)[0].target.key,"10,10");
});

test("마지막 재료 채집 개체도 먹이 수급이 급하면 먹이를 먼저 납품한다", () => {
  const f=fixture(0);
  f.agent.attributes={blade:1};f.state.lastFoodAt=100;
  f.context.constructionMaterials=()=>({tree:4});
  f.state.knownFood.set("5,4",{x:5,y:4,amount:30,resourceType:"tree"});
  assert.equal(f.ai.evaluate(f.agent,false)[0].target.key,"10,4");
});

test("먹이를 알아도 왕복이 길면 반대 방향 대신 그 먹이 주변의 경계를 탐색한다", () => {
  const f=fixture(0);
  f.state.lastFoodAt=100;f.agent.bornAt=60;
  f.state.knownFood.clear();f.state.knownFood.set("22,4",{x:22,y:4,amount:12,resourceType:"pebbles"});
  f.state.explored.clear();
  for(let y=0;y<10;y++)for(let x=0;x<25;x++)f.state.explored.add(y*32+x);
  const plan=f.ai.evaluate(f.agent,false)[0];
  assert.equal(plan.action,"explore");
  assert.ok(Math.abs(plan.target.x - 22) + Math.abs(plan.target.y - 4) < Math.abs(f.agent.x - 22) + Math.abs(f.agent.y - 4));
});

test("먼 거점의 고정 시야 주변 탐색도 짧은 일반 탐색 한도 때문에 누락되지 않는다", () => {
  const f=fixture(0);
  f.state.lastFoodAt=100;f.agent.x=5;f.agent.y=40;f.agent.bornAt=20;f.agent.lifespan=360;
  f.state.knownFood.clear();f.state.knownFood.set("95,40",{x:95,y:40,amount:12,resourceType:"pebbles"});
  f.state.explored.clear();
  for(let y=0;y<80;y++)for(let x=0;x<100;x++)f.state.explored.add(y*128+x);
  f.context.size=128;f.context.homeCells=()=>[{x:5,y:39}];f.context.deliveryCells=f.context.homeCells;
  f.context.permanentVisionSources=()=>[{x:5,y:39,radius:6},{x:95,y:39,radius:6}];
  f.context.walkable=(x,y)=>x>=0&&y>=0&&x<128&&y<128&&f.state.explored.has(y*128+x);
  const plans=createUtilityAI(f.context).evaluate(f.agent,false);
  assert.equal(plans[0]?.action,"explore");
  assert.ok(plans[0].target.x>=82);
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
  assert.ok(current.maintenanceRate > 0);
  assert.equal(current.rateDeficit, 0);
  f.state.simSeconds = 121;
  const starved = colonySupply(f.state, "pebble");
  assert.equal(starved.incomeRate, 0);
  assert.ok(starved.rateDeficit > 0);
  assert.ok(starved.urgency > 0);
});

test("낮은 수급률도 보유 포인트로 교체를 감당하면 긴급 확장으로 오인하지 않는다", () => {
  const f = fixture(500);
  f.state.foodIncomeStartedAt = 0;
  f.state.foodIncome = [];
  f.state.lastFoodAt = 0;
  const supply = colonySupply(f.state, "pebble");
  assert.ok(supply.rateDeficit > 0);
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
