import test from "node:test";
import assert from "node:assert/strict";
import {createGame} from "./game.mjs";
import {TRIBE_STARTING_UNITS} from "./tribe-start.mjs";

function fixture(tribe) {
  const colony={id:1,ownerId:"host",tribe,x:40,y:40,occupiedCells:new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"])};
  const environment={hostId:"host",beginnerHelpEnabled:true,simSeconds:0,world:{seed:13,generationVersion:33,
    terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,colony);environment.games.set("host",game);return {game,environment};
}

for(const tribe of ["bean","spore","pebble","spring"])test(tribe+" 초기 자원 0에서 해금 전 준비 안내가 나와도 비용과 현재 단계 없이 생산하지 않는다",()=>{
  const {game}=fixture(tribe),before=game.snapshot();
  assert.equal(before.evolutionPoints,0);assert.deepEqual(before.resourceInventory,{});
  assert.equal(before.agents.length,TRIBE_STARTING_UNITS[tribe].length);
  assert.ok(!before.constructionHelp || before.constructionHelp.kind !== "construction" && !before.constructionHelp.canProduce);
  assert.deepEqual(game.command({type:"beginner-construction",expectedBuildingKey:"watchpost",expectedStep:"arbitrary"}),{});
  assert.equal(game.snapshot().templates.length,0);assert.equal(game.agents.length,before.agents.length);
});

test("도움말을 끈 방과 다른 군락은 안내 생산을 실행할 수 없다",()=>{
  const {game,environment}=fixture("bean");environment.beginnerHelpEnabled=false;
  assert.throws(()=>game.command({type:"beginner-construction"}),/지원하지 않는 요청/);
  environment.beginnerHelpEnabled=true;environment.hostId="other";
  assert.throws(()=>game.command({type:"beginner-construction"}),/지원하지 않는 요청/);
});

test("이전 생산 기록을 복원해도 실제 완공 기록으로 취급하지 않는다",()=>{
  const {game}=fixture("bean"),saved=JSON.parse(game.save());
  saved.state.constructionHelpResult={templateId:1,agentId:game.agents[0].id,step:"past-step",kind:"harvest"};
  delete saved.state.constructionHelpBuildings;game.restore(JSON.stringify(saved));
  assert.deepEqual(JSON.parse(game.save()).state.constructionHelpBuildings,[]);
  const before=game.snapshot();
  assert.deepEqual(game.command({type:"beginner-construction",expectedStep:"past-step"}),saved.state.constructionHelpResult);
  assert.equal(game.agents.length,before.agents.length);assert.equal(game.snapshot().evolutionPoints,before.evolutionPoints);
});

test("완공 종류 기록은 저장과 복원에서 유지하며 잘못된 종류를 제거한다",()=>{
  const {game}=fixture("pebble"),saved=JSON.parse(game.save());saved.state.constructionHelpBuildings=["storage","unknown"];
  game.restore(JSON.stringify(saved));assert.deepEqual(JSON.parse(game.save()).state.constructionHelpBuildings,["storage"]);
});

test("안내 생산은 준비 계산에 쓴 첫 둥지에서 태어나며 무작위 다른 전초둥지로 흩어지지 않는다",()=>{const {game}=fixture("bean"),saved=JSON.parse(game.save());saved.state.nestLevel=3;saved.state.nestHealth=0;saved.state.evolutionPoints=100;saved.state.buildings=[{id:"first",key:"outpost",x:45,y:45,width:3,height:3,health:200},{id:"second",key:"outpost",x:90,y:90,width:3,height:3,health:200}];saved.state.agents=saved.state.agents.slice(0,1);Object.assign(saved.state.agents[0],{x:50,y:47});saved.state.explored={collection:"Set",entries:[]};for(let y=35;y<105;y++)for(let x=35;x<105;x++)saved.state.explored.entries.push(y*320+x);game.restore(JSON.stringify(saved));const previous=Math.random;Math.random=()=>.999;try{const offer=game.snapshot().constructionHelp;assert.ok(offer?.canProduce);const result=game.command({type:"beginner-construction",expectedBuildingKey:offer.buildingKey,expectedStep:offer.step});const agent=game.agents.find(agent=>agent.id===result.agentId);assert.ok(agent.x>=44&&agent.x<=48&&agent.y>=44&&agent.y<=48);}finally{Math.random=previous;}});

test("운반 개체의 탄생이 끝나면 필요한 다음 생산을 불필요한 15초 대기로 막지 않는다",()=>{const {game,environment}=fixture("bean"),saved=JSON.parse(game.save());saved.state.simSeconds=30;saved.state.nestLevel=2;saved.state.nestHealth=200;saved.state.evolutionPoints=100;saved.state.resourceInventory={clay:10};delete saved.state.resourceStores;saved.state.agents=saved.state.agents.slice(0,2);const [builder,worker]=saved.state.agents;Object.assign(builder,{x:74,y:41,bornAt:0,lifespan:100,slots:["construction"],attributeLevels:{construction:1},attributes:{construction:1},birth:null,construction:{buildingKey:"storage",x:74,y:41,state:"transforming",orderedAt:0,startedAt:0,supplyVersion:1,id:"active",route:[{x:74,y:41}],routeIndex:0,readyAt:15,required:{clay:10},delivered:{},consumed:{},progress:0,stage:1}});Object.assign(worker,{x:44,y:40,bornAt:25,slots:["strength","feet"],attributeLevels:{strength:1,feet:1},attributes:{strength:1,feet:1},birth:null});saved.state.constructionHelpResult={kind:"transport",agentId:worker.id,step:"completed",producedAt:25};saved.state.explored={collection:"Set",entries:[]};for(let y=30;y<90;y++)for(let x=30;x<90;x++)saved.state.explored.entries.push(y*320+x);environment.simSeconds=30;game.restore(JSON.stringify(saved));const offer=game.snapshot().constructionHelp;assert.equal(offer?.kind,"transport");assert.equal(offer.canProduce,true);const result=game.command({type:"beginner-construction",expectedBuildingKey:offer.buildingKey,expectedStep:offer.step});assert.ok(result.agentId);assert.notEqual(result.agentId,worker.id);});

test("전초둥지와 포인트가 남았으면 개체가 없어도 채집 재생산을 안내하고 정상 비용으로 탄생시킨다",()=>{const {game}=fixture("pebble"),saved=JSON.parse(game.save());saved.state.nestLevel=2;saved.state.nestHealth=0;saved.state.evolutionPoints=18;saved.state.agents=[];saved.state.buildings=[{id:"refuge",key:"outpost",x:45,y:45,width:3,height:3,health:200}];saved.state.explored={collection:"Set",entries:[]};for(let y=30;y<75;y++)for(let x=30;x<75;x++)saved.state.explored.entries.push(y*320+x);game.restore(JSON.stringify(saved));const offer=game.snapshot().constructionHelp;assert.equal(offer?.kind,"transport");assert.ok(offer.canProduce);const result=game.command({type:"beginner-construction",expectedBuildingKey:offer.buildingKey,expectedStep:offer.step});assert.ok(result.agentId);assert.equal(game.agents.length,1);assert.equal(game.snapshot().evolutionPoints,18-offer.cost);});
