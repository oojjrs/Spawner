import test from "node:test";
import assert from "node:assert/strict";
import { unitStats } from "./attributes.mjs";
import { createGame } from "./game.mjs";
import { createUtilityAI } from "./utility.mjs";
import { colonyForagers } from "./colony-supply.mjs";
import { resourceHarvestSeconds } from "./resources.mjs";

function movementGame(tribe, load, slots, terrain) {
  const occupiedCells=new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"]);
  const colony={id:1,ownerId:"movement-test",tribe,x:40,y:40,occupiedCells};
  const environment={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(terrain),hazards:new Uint8Array(320*320)},
    colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,colony);
  environment.games.set(colony.ownerId,game);
  const saved=JSON.parse(game.save()); saved.state.agents=[]; saved.state.evolutionPoints=30;
  saved.state.nestLevel=Math.max(1,slots.length);
  game.restore(JSON.stringify(saved));
  const {agentId}=game.command({type:"design",templateId:null,name:"이동",slots,birth:true});
  const agent=game.agents.find(entry=>entry.id===agentId);
  Object.assign(agent,{x:47,y:42,renderFromX:47,renderFromY:42,birth:null,moveStartedAt:0,moveDuration:0,
    moveAnimationStartedAt:0,decisionPending:null,nextDecisionAt:1000000,survivalState:"stable",mode:"search",
    carrying:agent.stats.capacity*load,carryingType:load>0?"clay":null,
    utility:{action:"explore",target:{x:45,y:42},route:[{x:47,y:42},{x:46,y:42},{x:47,y:42}]}});
  const explored=game.decisionSnapshot().state.explored;
  for (let y=35;y<51;y++) for (let x=35;x<55;x++) explored.add(y*320+x);
  return {game,agent,environment};
}

function advanceMovement(fixture,elapsed) {
  fixture.environment.simSeconds+=elapsed;
  fixture.game.prepare(fixture.environment.simSeconds);
  fixture.game.tick(elapsed);
}

function nextStep(fixture) {
  const previous=fixture.agent.stepCount;
  for (let step=0;step<200 && fixture.agent.stepCount===previous;step++) advanceMovement(fixture,.1);
  assert.equal(fixture.agent.stepCount,previous+1,fixture.agent.tribe);
}

test("네 종족 기본형·운반형은 빈손·절반 적재·만재에서도 1초 이동과 남은 휴식으로 전체 이속을 맞춘다",()=>{
  for (const [tribe,speeds] of [["bean",[.5,.45,.4]],["spring",[.9,.5875,.275]],
    ["pebble",[.35,.325,.3]],["spore",[.5,.45,.4]]]) {
    for (const slots of [[],["strength"]]) for (const [index,load] of [0,.5,1].entries()) {
      const fixture=movementGame(tribe,load,slots,4),{game,agent}=fixture;
      assert.equal(agent.stats.speed,speeds[0]);
      assert.equal(agent.stats.capacity,slots.length?2:1);
      nextStep(fixture);
      assert.equal(agent.moveDuration,1,tribe+":"+load);
      assert.equal(agent.moveAnimationStartedAt,agent.moveStartedAt);
      const startedAt=agent.moveStartedAt;
      nextStep(fixture);
      const period=agent.moveStartedAt-startedAt;
      assert.ok(Math.abs(period-1/speeds[index])<1e-8,tribe+":"+load);
      assert.equal(agent.moveDuration,1);
      assert.equal(agent.moveAnimationStartedAt,agent.moveStartedAt);
      if (tribe==="bean" && load===0) assert.ok(Math.abs(period-agent.moveDuration-1)<1e-8);
      const snapshot=JSON.parse(JSON.stringify(game.snapshot())).agents[0];
      assert.equal(snapshot.moveAnimationStartedAt,agent.moveAnimationStartedAt);
    }
  }
});

test("이속 속성이 붙은 네 종족 기본형·운반형도 느린 동작은 1초이고 고속 동작은 이동 주기를 넘지 않는다",()=>{
  for (const [tribe,speeds] of [["bean",[.8,.75,.7]],["spring",[1.2,.8875,.575]],
    ["pebble",[.65,.625,.6]],["spore",[.8,.75,.7]]]) {
    for (const slots of [["feet"],["feet","strength"]]) for (const [index,load] of [0,.5,1].entries()) {
      const fixture=movementGame(tribe,load,slots,4),{agent}=fixture;
      assert.ok(Math.abs(agent.stats.speed-speeds[0])<1e-10);
      nextStep(fixture);
      const duration=tribe==="spring" && load===0?5/6:1;
      assert.ok(Math.abs(agent.moveDuration-duration)<1e-10,tribe+":"+load);
      const startedAt=agent.moveStartedAt;
      nextStep(fixture);
      assert.ok(Math.abs(agent.moveStartedAt-startedAt-1/speeds[index])<1e-8,tribe+":"+load);
      assert.ok(agent.moveDuration<=1/speeds[index]+1e-10);
      assert.equal(agent.moveAnimationStartedAt,duration<1?startedAt:agent.moveStartedAt);
    }
  }
});

test("네 종족 만재·발 속성·운반형은 산지에서도 동작을 늘이지 않고 기존 지형별 이동 주기를 유지한다",()=>{
  for (const [tribe,speed,multipliers] of [["bean",.7,[.6,.4,.9]],["spring",.575,[.6,.4,.9]],
    ["pebble",.6,[.8,.6,1]],["spore",.7,[.6,.4,.9]]]) {
    for (const [index,terrain] of [6,7,8].entries()) {
      const fixture=movementGame(tribe,1,["feet","strength"],terrain),{agent}=fixture;
      nextStep(fixture);
      assert.equal(agent.moveDuration,1,tribe+":"+terrain);
      const startedAt=agent.moveStartedAt;
      nextStep(fixture);
      assert.equal(agent.moveDuration,1);
      assert.ok(Math.abs(agent.moveStartedAt-startedAt-1/(speed*multipliers[index]))<1e-8,tribe+":"+terrain);
      assert.equal(agent.moveAnimationStartedAt,agent.moveStartedAt);
    }
  }
});

test("고속 연속 이동은 저장·복원과 snapshot에서도 애니메이션 시작 시각을 유지한다",()=>{
  const fixture=movementGame("spring",0,["feet"],4);
  nextStep(fixture);
  const epoch=fixture.agent.moveAnimationStartedAt;
  for (let index=0;index<4;index++) {
    const previousEnd=fixture.agent.moveStartedAt+fixture.agent.moveDuration;
    nextStep(fixture);
    assert.ok(Math.abs(fixture.agent.moveStartedAt-previousEnd)<1e-8);
    assert.equal(fixture.agent.moveAnimationStartedAt,epoch);
    fixture.game.restore(fixture.game.save());
    fixture.agent=fixture.game.agents[0];
    assert.equal(fixture.agent.moveAnimationStartedAt,epoch);
    assert.ok(Math.abs(fixture.agent.moveDuration-5/6)<1e-10);
    const snapshot=JSON.parse(JSON.stringify(fixture.game.snapshot())).agents[0];
    assert.equal(snapshot.moveAnimationStartedAt,epoch);
    assert.equal(snapshot.moveStartedAt,fixture.agent.moveStartedAt);
  }
});

test("기존 저장에 애니메이션 시각이 없으면 이동 시작 시각으로 복원하고 다음 연속 이동에 이어 쓴다",()=>{
  const fixture=movementGame("spring",0,["feet"],4);
  nextStep(fixture);
  nextStep(fixture);
  const saved=JSON.parse(fixture.game.save());
  delete saved.state.agents[0].moveAnimationStartedAt;
  fixture.game.restore(JSON.stringify(saved));
  fixture.agent=fixture.game.agents[0];
  const epoch=fixture.agent.moveStartedAt;
  assert.equal(fixture.agent.moveAnimationStartedAt,epoch);
  assert.equal(fixture.game.snapshot().agents[0].moveAnimationStartedAt,epoch);
  nextStep(fixture);
  assert.equal(fixture.agent.moveAnimationStartedAt,epoch);
});

test("고속 이동도 실제로 쉰 뒤에는 새 애니메이션 시작 시각을 쓴다",()=>{
  const fixture=movementGame("spring",0,["feet"],4);
  nextStep(fixture);
  nextStep(fixture);
  const {agent}=fixture,epoch=agent.moveAnimationStartedAt,plan=agent.utility,steps=agent.stepCount;
  const previousEnd=agent.moveStartedAt+agent.moveDuration;
  agent.utility=null;
  for (let index=0;index<15;index++) advanceMovement(fixture,.1);
  assert.equal(agent.stepCount,steps);
  assert.ok(fixture.environment.simSeconds>previousEnd+.1);
  agent.utility=plan;
  nextStep(fixture);
  assert.equal(agent.moveAnimationStartedAt,agent.moveStartedAt);
  assert.ok(agent.moveAnimationStartedAt>epoch);
});

test("연속 이동 시각의 1e-8 이내 반올림은 허용하고 그보다 긴 휴식은 새 애니메이션으로 시작한다",()=>{
  for (const [gap,continuous] of [[5e-9,true],[2e-8,false]]) {
    const fixture=movementGame("spring",0,["feet"],4);
    nextStep(fixture);
    const epoch=fixture.agent.moveAnimationStartedAt;
    fixture.agent.moveDuration-=gap;
    nextStep(fixture);
    assert.equal(fixture.agent.moveAnimationStartedAt,continuous?epoch:fixture.agent.moveStartedAt);
  }
});

function worker(tribe,id) {
  return {id,tribe,x:1,y:1,carrying:0,carryingType:null,health:100,bornAt:0,lifespan:180,cost:3,slots:[],
    stats:{...unitStats({},tribe),capacity:4},attributes:{},personality:{boldness:0,aggression:0,curiosity:0}};
}

test("AI는 빈손 출발과 예상 적재 귀환을 따로 계산하고 샘방울은 긴 왕복에서 만재보다 3개 운반을 고른다",()=>{
  for (const [tribe,empty,loaded,expectedCargo] of [["bean",.5,.4,4],["spring",.9,.275,3],
    ["pebble",.35,.3,4],["spore",.5,.4,4]]) {
    const size=14,agent=worker(tribe,"worker");
    const home={x:1,y:1},food={x:11,y:1,key:"11,1",resourceType:"clay",amount:20};
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
    const expected=10/empty+1+expectedCargo*4+10/returning+1;
    assert.ok(Math.abs(collect.deliverySeconds-expected)<1e-10,tribe);
    for (const load of [.5,1]) {
      Object.assign(agent,{x:11,carrying:4*load,carryingType:"clay",utility:null});
      const returning=ai.evaluate(agent,false).find(candidate=>candidate.action==="return");
      assert.ok(returning,tribe);
      const speed=empty+(loaded-empty)*load;
      assert.ok(Math.abs(returning.deliverySeconds-(10/speed+1))<1e-10,tribe);
    }
  }
});

test("기본 자원 한 개의 AI 왕복 시간에 종족 속도·채집 시간·레벨 보너스를 반영한다",()=>{
  for (const [tribe,type,empty,loaded,harvest] of [["bean","clay",.5,.4,4],["spring","dew",.9,.275,2],
    ["spore","tree",.5,.4,6],["pebble","pebbles",.35,.3,6]]) {
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

test("긴급 수급 인원은 나이 대신 빈손 출발과 만재 귀환의 운반 효율로 고른다",()=>{
  const spring=worker("spring","1"),bean=worker("bean","2");
  for (const agent of [spring,bean]) { agent.x=0; agent.stats.capacity=1; }
  spring.bornAt=-132; bean.bornAt=-129;
  const selected=colonyForagers({simSeconds:0,agents:[spring,bean]},[{x:10,y:1}],[{x:0,y:1}]);
  assert.deepEqual([...selected],["2"]);
});
