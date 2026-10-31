import test from "node:test";
import assert from "node:assert/strict";
import { tribeConstructionNeeds, tribeConstructionMaterials } from "./tribe-construction.mjs";
import { unitStats, attributeCounts } from "./attributes.mjs";
import { tribeLifespan } from "./lifespan.mjs";

function fixture(tribe) {
  const native = { bean:"clay", spore:"tree", pebble:"pebbles", spring:"dew" }[tribe];
  const agents = Array.from({length:6}, (_,index) => {
    const slots = index === 0 ? ["construction"] : ["strength"];
    const attributes = attributeCounts(slots);
    return { id:String(index), tribe, x:40 + index, y:50, health:100, bornAt:20, lifespan:tribeLifespan(tribe),
      slots, attributes, stats:unitStats(attributes, tribe), carrying:0 };
  });
  const state = { simSeconds:60, nestLevel:2, evolutionPoints:500, lastFoodAt:60, colonyFood:60,
    foodIncomeStartedAt:0, foodIncome:[[30,30],[60,30]], agents,
    buildings:[{id:"store-a",key:"storage",x:30,y:30,width:3,height:3,health:120},
      {id:"store-b",key:"storage",x:30,y:34,width:3,height:3,health:120}],
    resourceInventory:{clay:20,tree:20,pebbles:20,dew:20,"grass-fiber":20},
    templates:[{slots:["antenna"],attributeLevels:{antenna:1}}], explored:new Set(),
    knownFood:new Map([["near",{x:44,y:49,amount:200,resourceType:native}],
      ["far",{x:76,y:42,amount:300,resourceType:native}]]) };
  for (let y=20;y<=90;y++) for (let x=20;x<=90;x++) state.explored.add(y*320+x);
  const nests = [{x:40,y:40,width:5,height:5}];
  return {state,tribe,nests,native};
}

function needs(f, threats) {
  return tribeConstructionNeeds(f.state,f.tribe,f.nests,threats || [],[]);
}

test("몽돌은 같은 강화 준비에서 진화실을 다른 종족보다 높게 평가한다", () => {
  const pebble=fixture("pebble"), bean=fixture("bean"), spore=fixture("spore");
  const score=f=>needs(f).find(need=>need.buildingKey==="evolution-lab").score;
  assert.ok(score(pebble)>score(bean));
  assert.ok(score(bean)>score(spore));
  assert.equal(needs(pebble)[0].buildingKey,"evolution-lab");
});

test("샘방울은 실제 운반 거리 절감이 있는 전초를 표준 종족보다 높게 평가한다", () => {
  const spring=fixture("spring"), bean=fixture("bean");
  const candidate=f=>needs(f).find(need=>need.buildingKey==="outpost");
  assert.ok(candidate(spring).score>candidate(bean).score);
  assert.ok(candidate(spring).benefits.expansion>0);
});

test("포자버섯은 출생 공간 부족 해소에 몽돌보다 높은 가치를 둔다", () => {
  const spore=fixture("spore"), pebble=fixture("pebble");
  const candidate=f=>tribeConstructionNeeds(f.state,f.tribe,f.nests,[],[],undefined,
    f.state.agents.map(agent=>({x:agent.x,y:agent.y}))).find(need=>need.buildingKey==="outpost");
  assert.ok(candidate(spore).benefits.production>0.9);
  assert.ok(candidate(spore).score>candidate(pebble).score);
});

test("탐색 기록이 있어도 상시 시야 밖의 영역을 감시봉으로 확보하며 10개 이후에도 계속 평가한다", () => {
  const f=fixture("bean");
  for (let index=0;index<11;index++) f.state.buildings.push({key:"watchpost",x:180+index*3,y:180,width:3,height:3,health:80});
  const watches=needs(f).filter(need=>need.buildingKey==="watchpost");
  assert.ok(watches.length>0);
  assert.ok(watches[0].benefits.information>0);
});

test("진행 중인 감시봉의 예정 시야는 중복 후보 점수를 낮춘다", () => {
  const f=fixture("bean");
  const watch=needs(f).find(need=>need.buildingKey==="watchpost");
  f.state.agents[0].construction={buildingKey:"watchpost",x:watch.anchor.x,y:watch.anchor.y,state:"moving"};
  const repeated=needs(f).find(need=>need.buildingKey==="watchpost"&&need.anchor.x===watch.anchor.x&&need.anchor.y===watch.anchor.y);
  assert.ok(!repeated||repeated.score<watch.score);
});

test("창고 파괴는 축소된 저장 용량으로 즉시 재평가하며 예정 창고 용량도 반영한다", () => {
  const f=fixture("bean");
  assert.ok(!needs(f).some(need=>need.buildingKey==="storage"&&need.urgent));
  f.state.buildings[1].health=0;
  assert.equal(needs(f)[0].buildingKey,"storage");
  assert.equal(needs(f)[0].urgent,true);
  f.state.agents[0].construction={buildingKey:"storage",x:32,y:35,state:"moving"};
  assert.ok(!needs(f).some(need=>need.buildingKey==="storage"&&need.urgent));
});

test("진화실 파괴 뒤 몽돌은 남은 강화 수요에 따라 재건을 다시 선택한다", () => {
  const f=fixture("pebble");
  const lab={key:"evolution-lab",x:35,y:40,width:3,height:3,health:100};
  f.state.buildings.push(lab);
  assert.ok(!needs(f).some(need=>need.buildingKey==="evolution-lab"));
  lab.health=0;
  assert.equal(needs(f)[0].buildingKey,"evolution-lab");
});

test("전초 파괴 뒤 다시 길어진 먹이 운반을 평가하며 무관한 광물에는 전초를 짓지 않는다", () => {
  const f=fixture("spring");
  const outpost={key:"outpost",x:74,y:41,width:3,height:3,health:200};
  f.state.buildings.push(outpost);f.nests.push(outpost);
  assert.ok(!needs(f).some(need=>need.buildingKey==="outpost"));
  outpost.health=0;f.nests.pop();
  assert.ok(needs(f).some(need=>need.buildingKey==="outpost"));
  f.state.knownFood.delete("far");
  f.state.knownFood.set("ore",{x:80,y:40,amount:1000,resourceType:"iron-ore"});
  f.state.simSeconds+=2;
  assert.ok(!needs(f).some(need=>need.buildingKey==="outpost"));
});

test("최근 수급이 유지율에 못 미치고 잔액도 부족하면 운반을 개선하는 전초를 긴급 선택한다", () => {
  const f=fixture("spring");
  f.state.evolutionPoints=1;f.state.foodIncome=[];f.state.lastFoodAt=60;
  f.state.knownFood.delete("near");
  assert.equal(needs(f)[0].buildingKey,"outpost");
  assert.equal(needs(f)[0].urgent,true);
});

test("재료 부족분은 최고 수요의 실제 조달 목표가 되며 이미 예약한 재료를 중복 사용하지 않는다", () => {
  const f=fixture("bean");f.state.templates=[];f.state.knownFood.delete("far");
  f.state.resourceInventory={clay:8,tree:6,"grass-fiber":0};
  const materials=tribeConstructionMaterials(f.state,f.tribe,f.nests,[],[]);
  assert.equal(materials["grass-fiber"],4);
  assert.ok(!needs(f).some(need=>need.buildingKey==="watchpost"));
  f.state.resourceInventory["grass-fiber"]=4;
  const watch=needs(f).find(need=>need.buildingKey==="watchpost");
  assert.ok(watch);
  f.state.agents[0].construction={buildingKey:"watchpost",x:watch.anchor.x,y:watch.anchor.y,state:"moving"};
  assert.ok(!needs(f).some(need=>need.buildingKey==="watchpost"));
});

test("위험한 감시봉 부지는 제외하며 적이 점유한 자리에 반복 재건하지 않는다", () => {
  const f=fixture("bean");
  const watch=needs(f).find(need=>need.buildingKey==="watchpost");
  const threat={id:"enemy",x:watch.anchor.x,y:watch.anchor.y,health:100};
  const watches=needs(f,[threat]).filter(need=>need.buildingKey==="watchpost");
  assert.ok(watches.every(need=>Math.hypot(need.anchor.x-threat.x,need.anchor.y-threat.y)>5));
});


test("현장에 도착하거나 운반 중인 자재를 창고 재고에서 이중 예약하지 않는다", () => {
  const f=fixture("bean");f.state.templates=[];f.state.knownFood.delete("far");
  f.state.resourceInventory={clay:8,tree:6,"grass-fiber":4};
  const watch=needs(f).find(need=>need.buildingKey==="watchpost");
  f.state.agents[0].construction={id:"site-a",buildingKey:"watchpost",x:watch.anchor.x,y:watch.anchor.y,state:"transforming",
    delivered:{clay:8,tree:6,"grass-fiber":4}};
  assert.ok(needs(f).some(need=>need.buildingKey==="watchpost"));
  f.state.agents[0].construction.delivered={clay:8,tree:6};
  f.state.agents[1].transportCargo={siteId:"site-a"};
  f.state.agents[1].carryingType="grass-fiber";f.state.agents[1].carrying=4;
  assert.ok(needs(f).some(need=>need.buildingKey==="watchpost"));
  f.state.agents[1].transportCargo={siteId:"other-site"};
  assert.ok(!needs(f).some(need=>need.buildingKey==="watchpost"));
});

test("실제 보관 시설 용량을 사용하고 현장행 자재는 창고 예상 입고에서 제외한다", () => {
  const f=fixture("bean");
  f.state.resourceInventory={clay:31};
  f.state.resourceStores=[{id:"nest",kind:"nest",x:40,y:40,width:5,height:5,capacity:40,inventory:{clay:31}}];
  f.state.agents[1].transportCargo={siteId:"remote-site"};
  f.state.agents[1].utility={action:"return",target:{x:40,y:40}};
  f.state.agents[1].carrying=20;
  assert.ok(!needs(f).some(need=>need.buildingKey==="storage"&&need.urgent));
  f.state.agents[1].transportCargo={siteId:null};
  assert.equal(needs(f)[0].buildingKey,"storage");
  assert.equal(needs(f)[0].urgent,true);
  f.state.agents[1].transportCargo=null;
  f.state.agents[1].carryingType=f.native;
  assert.ok(!needs(f).some(need=>need.buildingKey==="storage"&&need.urgent));
  f.state.agents[1].carryingType="grass-fiber";
  assert.equal(needs(f)[0].buildingKey,"storage");
  assert.equal(needs(f)[0].urgent,true);
});


test("총 저장 공간이 남아도 먼 자원지의 현장 운반을 위한 창고를 평가하고 예정 창고와 중복하지 않는다", () => {
  const f=fixture("bean");
  f.state.resourceInventory={clay:20,tree:6,"grass-fiber":4};
  f.state.resourceStores=[{id:"nest",kind:"nest",x:40,y:40,width:5,height:5,capacity:160,inventory:{...f.state.resourceInventory}}];
  const forward=needs(f).find(need=>need.buildingKey==="storage"&&need.anchor.x===76);
  assert.ok(forward);
  assert.ok(forward.benefits.production>0);
  assert.equal(forward.benefits.expansion,undefined);
  assert.equal(forward.urgent,false);
  f.state.agents[0].construction={buildingKey:"storage",x:75,y:41,state:"moving"};
  assert.ok(!needs(f).some(need=>need.buildingKey==="storage"&&Math.hypot(need.anchor.x-76,need.anchor.y-42)<12));
});
