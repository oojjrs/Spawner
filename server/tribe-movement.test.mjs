import test from "node:test";
import assert from "node:assert/strict";
import { unitStats } from "./attributes.mjs";
import { createGame } from "./game.mjs";
import { createUtilityAI } from "./utility.mjs";
import { colonyForagers } from "./colony-supply.mjs";
import { resourceHarvestSeconds } from "./resources.mjs";

function firstStep(tribe, load, slots) {
  const occupiedCells=new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"]);
  const colony={id:1,ownerId:"movement-test",tribe,x:40,y:40,occupiedCells};
  const environment={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},
    colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,colony);
  environment.games.set(colony.ownerId,game);
  const saved=JSON.parse(game.save()); saved.state.agents=[]; saved.state.evolutionPoints=30;
  game.restore(JSON.stringify(saved));
  const {agentId}=game.command({type:"design",templateId:null,name:"이동",slots:slots || [],birth:true});
  const agent=game.agents.find(entry=>entry.id===agentId);
  Object.assign(agent,{x:48,y:42,renderFromX:48,renderFromY:42,birth:null,moveStartedAt:0,moveDuration:0,
    carrying:agent.stats.capacity*load,carryingType:load>0?"nutrients":null});
  for (let step=0;step<80 && !agent.stepCount;step++) {
    environment.simSeconds+=.1; game.prepare(environment.simSeconds); game.tick(.1);
  }
  assert.ok(agent.stepCount>0,tribe);
  return {game,agent};
}

test("네 종족은 빈손·절반 적재·만재에서도 이동 동작과 휴지 시간으로 전체 이속을 맞춘다",()=>{
  for (const [tribe,speeds] of [["bean",[.5,.45,.4]],["spring",[.9,.5875,.275]],
    ["pebble",[.35,.325,.3]],["spore",[.5,.45,.4]]]) {
    for (const [index,load] of [0,.5,1].entries()) {
      const {game,agent}=firstStep(tribe,load);
      assert.ok(Math.abs(agent.moveDuration-.5/speeds[index])<1e-10,tribe+":"+load);
      const duration=agent.moveDuration;
      game.restore(game.save()); game.restore(game.save());
      assert.equal(game.agents[0].moveDuration,duration);
      assert.equal(game.agents[0].stats.speed,speeds[0]);
    }
  }
});

test("이속 속성이 붙은 네 종족은 기존처럼 휴지 없이 보행한다",()=>{
  for (const [tribe,speeds] of [["bean",[.8,.75,.7]],["spring",[1.2,.8875,.575]],
    ["pebble",[.65,.625,.6]],["spore",[.8,.75,.7]]]) {
    for (const [index,load] of [0,.5,1].entries()) {
      const {agent}=firstStep(tribe,load,["feet"]);
      assert.ok(Math.abs(agent.moveDuration-1/speeds[index])<1e-10,tribe+":"+load);
    }
  }
});

function worker(tribe,id) {
  return {id,tribe,x:1,y:1,carrying:0,carryingType:null,health:100,bornAt:0,lifespan:180,cost:3,slots:[],
    stats:{...unitStats({},tribe),capacity:4},attributes:{},personality:{boldness:0,aggression:0,curiosity:0}};
}

test("AI는 빈손 출발과 예상 적재 귀환을 따로 계산하고 샘방울은 긴 왕복에서 만재보다 3개 운반을 고른다",()=>{
  for (const [tribe,empty,loaded,expectedCargo] of [["bean",1,.8,4],["spring",1.8,.55,3],
    ["pebble",.7,.6,4],["spore",1,.8,4]]) {
    const size=14,agent=worker(tribe,"worker");
    const home={x:1,y:1},food={x:11,y:1,key:"11,1",resourceType:"nutrients",amount:20};
    const state={simSeconds:0,evolutionPoints:0,colonyFood:0,lastFoodAt:0,nestLevel:1,agents:[agent],
      knownFood:new Map([[food.key,food]]),resourceInventory:{},markers:[],
      explored:new Set(Array.from({length:size*size},(_,index)=>index))};
    const ai=createUtilityAI({state,size,tribe,homeCells:()=>[home],deliveryCells:()=>[home],
      walkable:(x,y)=>y===1,hazardAt:()=>0,enemies:()=>[],synergy:()=>false,canHarvest:()=>true,
      terrainAt:()=>4,materialSpace:()=>200,isFood:()=>true});
    const collect=ai.evaluate(agent,false).find(candidate=>candidate.action==="collect");
    assert.ok(collect,tribe);
    assert.equal(collect.plannedCargo,expectedCargo,tribe);
    const returning=empty+(loaded-empty)*expectedCargo/4;
    const expected=10/(.5*empty)+1+expectedCargo*1.5+10/(.5*returning)+1;
    assert.ok(Math.abs(collect.deliverySeconds-expected)<1e-10,tribe);
    for (const load of [.5,1]) {
      Object.assign(agent,{x:11,carrying:4*load,carryingType:"nutrients",utility:null});
      const returning=ai.evaluate(agent,false).find(candidate=>candidate.action==="return");
      assert.ok(returning,tribe);
      const speed=.5*(empty+(loaded-empty)*load);
      assert.ok(Math.abs(returning.deliverySeconds-(10/speed+1))<1e-10,tribe);
    }
  }
});

test("기본 자원 한 개의 AI 왕복 시간에 종족 속도·채집 시간·레벨 보너스를 반영한다",()=>{
  for (const [tribe,type,empty,loaded,harvest] of [["bean","clay",.5,.4,2],["spring","dew",.9,.275,.8],
    ["spore","tree",.5,.4,1],["pebble","pebbles",.35,.3,4]]) {
    for (const ranks of [0,5]) {
      const size=14,agent=worker(tribe,"native-worker"),home={x:1,y:1};
      agent.stats.capacity=1;
      agent.stats.movementMultiplier=1+ranks*.02;
      agent.stats.harvestSpeedMultiplier=1+ranks*.03;
      const food={x:11,y:1,key:"11,1",resourceType:type,amount:1};
      const state={simSeconds:0,evolutionPoints:0,colonyFood:0,lastFoodAt:0,nestLevel:1,agents:[agent],
        knownFood:new Map([[food.key,food]]),resourceInventory:{},markers:[],
        explored:new Set(Array.from({length:size*size},(_,index)=>index))};
      const ai=createUtilityAI({state,size,tribe,homeCells:()=>[home],deliveryCells:()=>[home],
        walkable:(x,y)=>y===1,hazardAt:()=>0,enemies:()=>[],synergy:()=>false,canHarvest:()=>true,
        terrainAt:()=>4,materialSpace:()=>200,isFood:()=>true,
        harvestSeconds:(resource,unit)=>resourceHarvestSeconds(resource,{generationVersion:32})/unit.stats.harvestSpeedMultiplier});
      const collect=ai.evaluate(agent,false).find(candidate=>candidate.action==="collect");
      assert.ok(collect,tribe);
      assert.equal(collect.plannedCargo,1,tribe);
      const expected=10/(empty*(1+ranks*.02))+1+harvest/(1+ranks*.03)+10/(loaded*(1+ranks*.02))+1;
      assert.ok(Math.abs(collect.deliverySeconds-expected)<1e-9,tribe+":"+ranks);
    }
  }
});

test("긴급 수급 인원은 샘방울의 빠른 출발보다 느린 만재 귀환을 포함한 남은 수명을 기준으로 고른다",()=>{
  const spring=worker("spring","1"),bean=worker("bean","2");
  for (const agent of [spring,bean]) { agent.x=0; agent.stats.capacity=1; }
  spring.bornAt=-132; bean.bornAt=-129;
  const selected=colonyForagers({simSeconds:0,agents:[spring,bean]},[{x:10,y:1}],[{x:0,y:1}]);
  assert.deepEqual([...selected],["2"]);
});
