import test from "node:test";
import assert from "node:assert/strict";
import { colonyRaidCadence } from "./raid-pressure.mjs";
import { createBeetleRaids } from "./raids.mjs";

function fixture(restoring) {
  const colony={id:1,ownerId:"owner",x:98,y:98,occupiedCells:new Set(["2,2"])};
  const world={size:320,sites:[[100,100]],burrows:[{id:"large:1",type:"large",x:148,y:100,width:3,height:1,entrance:{x:149,y:101}}]};
  const environment={world,simSeconds:0,colonies:[colony],games:new Map([["owner",{agents:[],nest:{health:100}}]])};
  const state={burrows:[{id:"large:1",health:60,nextRaidAt:300,raidSequence:0}],agents:Array.from({length:12},(_,index)=>({id:"beetle:"+index,burrowId:"large:1",health:100,x:149,y:101,moveStartedAt:0,moveDuration:0,mode:"idle"})),raidCooldowns:[{colonyId:1,nextRaidAt:120}]};
  const actions={noise:()=>0,reinforce:()=>{},walkable:(x,y)=>x>=0&&y>=0&&x<320&&y<320,occupied:()=>false,idle:()=>{},move:()=>{}};
  const raids=createBeetleRaids(environment,state,actions,restoring);
  return {environment,state,actions,raids};
}

test("단계 경계와 압력 양끝·중간은 고정된 간격과 상한을 반환한다",()=>{
  for(const [time,low,middle,high,concurrent] of [[300,150,135,120,1],[479.999,150,135,120,1],[480,120,105,90,2],[719.999,120,105,90,2],[720,90,75,60,3]]){
    for(const [pressure,interval] of [[0,low],[.5,middle],[1,high],[undefined,middle]])assert.deepEqual(colonyRaidCadence(time,pressure),{interval,concurrent});
  }
  assert.equal(colonyRaidCadence(300,.3).interval,140);
});

test("구저장 예약 시각은 보존하며 300초 전에는 실제 출정하지 않는다",()=>{
  const {environment,state,raids}=fixture(true);
  assert.equal(state.raidCooldowns[0].nextRaidAt,120);
  environment.simSeconds=299.999;raids.dispatch();assert.ok(state.agents.every(agent=>!agent.raid));
  environment.simSeconds=300;raids.dispatch();
  assert.equal(state.agents.filter(agent=>agent.raid).length,1);
  assert.equal(state.raidCooldowns[0].nextRaidAt,480);
});

test("이동 중 개체를 포함한 생존 습격 상한은 1·2·3이며 사망 뒤에만 자리가 빈다",()=>{
  const {environment,state,raids}=fixture(false);
  for(const [time,count] of [[300,1],[305,1],[310,1],[480,2],[485,2],[720,3],[725,3]]){
    state.raidCooldowns[0].nextRaidAt=0;environment.simSeconds=time;raids.dispatch();
    assert.equal(state.agents.filter(agent=>agent.health>0&&agent.raid).length,count);
  }
  state.agents.find(agent=>agent.raid).health=0;
  state.raidCooldowns[0].nextRaidAt=0;environment.simSeconds=730;raids.dispatch();
  assert.equal(state.agents.filter(agent=>agent.health>0&&agent.raid).length,3);
  assert.equal(state.raidCooldowns[0].nextRaidAt,805);
});

test("상한을 넘는 구저장 습격을 보존하고 추가 출정만 대기한다",()=>{
  const setup=fixture(true),{environment,state,raids}=setup;
  for(const agent of state.agents.slice(0,4))agent.raid={colonyId:1,phase:"active",departedAt:120};
  environment.simSeconds=300;raids.dispatch();
  assert.equal(state.agents.filter(agent=>agent.raid).length,4);
  assert.equal(state.raidCooldowns[0].nextRaidAt,120);
});

test("소진 병력은 재생성하지 않고 경로 차단 해제 후 성공 시각에서만 예약한다",()=>{
  for(const reason of ["guards","path"]){
    const {environment,state,actions,raids}=fixture(false);
    if(reason==="guards")for(const agent of state.agents)agent.health=0;
    else actions.walkable=()=>false;
    environment.simSeconds=900;raids.dispatch();assert.ok(state.agents.every(agent=>!agent.raid));
    if(reason==="guards"){ environment.simSeconds=910;raids.dispatch();assert.ok(state.agents.every(agent=>!agent.raid));continue; }
    actions.walkable=(x,y)=>x>=0&&y>=0&&x<320&&y<320;
    environment.simSeconds=910;raids.dispatch();
    assert.equal(state.agents.filter(agent=>agent.raid).length,1);
    assert.equal(state.raidCooldowns[0].nextRaidAt,985);
    raids.dispatch();assert.equal(state.agents.filter(agent=>agent.raid).length,1);
  }
});

test("기존 opening 기록과 다음 예약은 복원 시 그대로이며 새 간격만 파생된다",()=>{
  const first=fixture(true),opening={version:1,rate:20,pressure:1,nearby:2,interval:60,arrivalAt:300};
  first.state.raidCooldowns[0]={colonyId:1,nextRaidAt:600,opening};
  const restored=createBeetleRaids(first.environment,first.state,first.actions,true);
  assert.equal(first.state.raidCooldowns[0].nextRaidAt,600);
  first.environment.simSeconds=599;restored.dispatch();assert.ok(first.state.agents.every(agent=>!agent.raid));
  first.environment.simSeconds=600;restored.dispatch();
  assert.equal(first.state.raidCooldowns[0].nextRaidAt,720);
  assert.deepEqual(first.state.raidCooldowns[0].opening,opening);
});
