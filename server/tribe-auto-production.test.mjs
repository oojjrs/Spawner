import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { birthCost } from "./attributes.mjs";
import { CONQUEST_PACING } from "./conquest-pacing.mjs";
import { tickRoom, commandRoom } from "../client/room.mjs";

function fixture() {
  const tribes = ["bean","spore","pebble","spring"], sites = [[20,20],[110,20],[20,110],[110,110]];
  const room = { hostId:"bean", simSeconds:0, revision:0, beginnerHelpEnabled:false, games:new Map(), colonies:[],
    food:new Map(), foodSpots:new Map(), world:{seed:13,size:160,generationVersion:36,sites,burrows:[],
      terrain:new Uint8Array(160*160).fill(4),hazards:new Uint8Array(160*160),treeCells:new Uint8Array(160*160)},
    creatureSystem:{agents:[],tick() {}} };
  room.colonies = tribes.map((tribe,index) => ({id:index+1,ownerId:tribe,tribe,x:sites[index][0],y:sites[index][1],
    occupiedCells:new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"])}));
  for (const colony of room.colonies) room.games.set(colony.ownerId,createGame(room,colony));
  return room;
}

function change(game, update) {
  const saved = JSON.parse(game.save());
  update(saved.state);
  game.restore(JSON.stringify(saved));
}

test("비선택 종족만 틱에서 생산하고 선택 변경 직후 자동 생산 대상도 바뀐다", () => {
  const room = fixture();
  for (const game of room.games.values()) change(game,state => {state.agents=[];state.evolutionPoints=30;});
  tickRoom(room,.1);
  assert.equal(room.games.get("bean").agents.length,0);
  for (const tribe of ["spore","pebble","spring"]) assert.equal(room.games.get(tribe).agents.length,1,tribe);
  commandRoom(room,{type:"cheat-switch-tribe",tribe:"spore"});
  room.simSeconds=1.1;
  tickRoom(room,.1);
  assert.equal(room.games.get("bean").agents.length,1);
  assert.equal(room.games.get("spore").agents.length,1);
  assert.equal(room.unitIndex,null);
});

test("모든 종족의 AI 생산은 실제 속성 비용을 지불하고 탄생 단계를 거친다", () => {
  const room = fixture();room.hostId="manual";
  for (const [tribe,game] of room.games) {
    change(game,state => {state.agents=[];state.evolutionPoints=30;});
    const id=game.produce(), agent=game.agents.find(agent=>agent.id===id);
    assert.ok(agent,tribe);
    assert.ok(agent.birth,tribe);
    assert.equal(agent.ownerId,tribe);
    assert.equal(agent.cost,birthCost(agent,tribe));
    assert.equal(game.snapshot().evolutionPoints,Math.round((30-agent.cost)*10)/10);
  }
});

test("포인트가 없으면 부활시키지 않고 기본 개체 비용만 있으면 그 비용으로 재생산한다", () => {
  const room=fixture();room.hostId="manual";
  for (const [tribe,game] of room.games) {
    change(game,state=>{state.agents=[];state.evolutionPoints=0;});
    assert.equal(game.produce(),null,tribe);
    assert.equal(game.agents.length,0);
    const cost=birthCost({slots:[]},tribe);
    change(game,state=>{state.evolutionPoints=cost;state.productionReadyAt=0;});
    assert.ok(game.produce(),tribe);
    assert.deepEqual(game.agents[0].slots,tribe === "spore" ? ["blade"] : []);
    assert.equal(game.snapshot().evolutionPoints,0);
  }
});

test("수명 경고에 들어온 초기 개체를 만료 전에 보충하며 같은 시간에 연속 생산하지 않는다", () => {
  const room=fixture(), game=room.games.get("bean");room.hostId="manual";
  change(game,state=>{state.evolutionPoints=19;for(const agent of state.agents){agent.bornAt=0;agent.lifespan=180;}});
  game.prepare(120);
  assert.ok(game.produce());
  assert.equal(game.agents.length,5);
  assert.equal(game.agents.at(-1).bornAt,120);
  assert.equal(game.produce(),null);
  game.prepare(120 + CONQUEST_PACING.productionInterval);
  assert.ok(game.produce());
});

test("수입이 관측되기 전에는 건강한 초기 군락을 유지하고 수입 여유가 생기면 증식한다", () => {
  const room=fixture(), game=room.games.get("bean");room.hostId="manual";
  change(game,state=>{state.evolutionPoints=19;});
  assert.equal(game.produce(),null);
  change(game,state=>{state.simSeconds=60;state.foodIncomeStartedAt=0;state.foodIncome=[[55,60]];state.productionReadyAt=0;});
  assert.ok(game.produce());
  assert.equal(game.agents.length,5);
});

test("둥지가 파괴되거나 탄생 공간이 없거나 200개 제한에 닿으면 비용을 차감하지 않는다", () => {
  for (const condition of ["destroyed","blocked","limit"]) {
    const room=fixture(), game=room.games.get("bean");room.hostId="manual";
    change(game,state=>{
      state.evolutionPoints=100;
      state.nestLevel=4;
      if(condition==="limit") state.agents=Array.from({length:200},(_,index)=>({...structuredClone(state.agents[0]),id:"1:"+(index+1)}));
      else state.agents=[];
      if(condition==="destroyed") state.nestHealth=0;
    });
    if(condition==="blocked") room.world.terrain.fill(0);
    assert.equal(game.produce(),null,condition);
    assert.equal(game.snapshot().evolutionPoints,100,condition);
  }
});

test("자동 생산 대기 시간은 저장 복원 후 유지하고 이전 저장에는 새 기본값을 적용한다", () => {
  const room=fixture(), game=room.games.get("bean");room.hostId="manual";
  change(game,state=>{state.agents=[];state.evolutionPoints=30;});
  assert.ok(game.produce());
  const saved=game.save(), colony=room.colonies[0], restored=createGame(room,colony,saved);
  room.games.set("bean",restored);
  restored.prepare(.5);
  assert.equal(restored.produce(),null);
  restored.prepare(CONQUEST_PACING.productionInterval);
  assert.equal(restored.produce(),null);
  assert.equal(restored.nestLevel,2);
  change(restored,state=>{delete state.productionReadyAt;state.agents=[];});
  assert.ok(restored.produce());
});

test("선택 종족은 자동 생산 API를 직접 호출해도 생산하지 않는다", () => {
  const room=fixture(), game=room.games.get("bean");
  change(game,state=>{state.agents=[];state.evolutionPoints=100;});
  assert.equal(game.produce(),null);
  assert.equal(game.agents.length,0);
  assert.equal(game.snapshot().evolutionPoints,100);
});
