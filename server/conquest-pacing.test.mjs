import {createUtilityAI} from "./utility.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {createGame} from "./game.mjs";
import {CONQUEST_PACING,TRIBE_PACING,colonyWorkerShare} from "./conquest-pacing.mjs";
import {simulateConquestBuild,colonyWorkerRate} from "./conquest-economy.mjs";
import {tribeProductionTemplate} from "./tribe-production.mjs";
import {birthCost} from "./attributes.mjs";
import {ENCOUNTER_TYPES} from "./encounter-types.mjs";
import {BEETLE_RAIDS} from "./raids.mjs";
import {agentGrowth} from "./growth.mjs";

function fixture(selected) {
 const colony={id:1,ownerId:"colony",tribe:"bean",x:40,y:40,occupiedCells:new Set()};
 for(let y=0;y<5;y++)for(let x=0;x<5;x++)if(!([0,4].includes(x)&&[0,4].includes(y)))colony.occupiedCells.add(x+","+y);
 const room={hostId:selected?"colony":"host",beginnerHelpEnabled:true,simSeconds:0,world:{seed:13,size:160,generationVersion:38,
  terrain:new Uint8Array(160*160).fill(4),hazards:new Uint8Array(160*160)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
 const game=createGame(room,colony);room.games.set(colony.ownerId,game);return {game,room,colony};
}
function change(game,update){const saved=JSON.parse(game.save());update(saved.state);game.restore(JSON.stringify(saved));}

test("기본 수명은 네 종족 모두 1분이고 새 개체도 같은 규칙을 따른다",()=>{
 const {game}=fixture(true);assert.ok(game.agents.every(agent=>agent.lifespan===60));
 for(const tribe of Object.values(TRIBE_PACING))assert.equal(tribe.lifespan,60);
});

test("자원이 충분해도 AI 성장 시점은 4분30초·11분30초·20분 이전으로 당겨지지 않는다",()=>{
 for(const [level,at]of[[1,270],[2,690],[3,1200]]){
  for(const offset of [-1,0]){const {game}=fixture(false);change(game,state=>{state.nestLevel=level;state.evolutionPoints=1000;state.productionReadyAt=0;});
   game.prepare(at+offset);game.produce();assert.equal(game.nestLevel,level+(offset===0?1:0),level+":"+offset);}
 }
});

test("선택한 종족에는 성장과 생산을 자동 실행하지 않는다",()=>{
 const {game}=fixture(true);change(game,state=>{state.evolutionPoints=1000;});game.prepare(1400);
 const before=game.agents.length;assert.equal(game.produce(),null);assert.equal(game.nestLevel,1);assert.equal(game.agents.length,before);
});

test("안내는 160초 이전에 숨기고 300초 이후에는 군사 생산을 정상 비용으로 안내한다",()=>{
 const {game}=fixture(true);change(game,state=>{state.nestLevel=2;state.evolutionPoints=100;});
 game.prepare(159);assert.equal(game.snapshot().constructionHelp,null);
 game.prepare(300);const offer=game.snapshot().constructionHelp;assert.equal(offer?.kind,"military");assert.ok(offer.canProduce);
 const before=game.snapshot().evolutionPoints,result=game.command({type:"beginner-construction",expectedStep:offer.step,expectedBuildingKey:offer.buildingKey});
 const agent=game.agents.find(agent=>agent.id===result.agentId);assert.equal(agent.productionRole,"military");assert.equal(game.snapshot().evolutionPoints,before-birthCost(agent,"bean"));
 assert.equal(JSON.parse(game.save()).state.militaryGuidanceCompleted,true);
});

test("초반 80:20과 후반 30:70의 고정 편성을 따르고 상대 편성은 읽지 않는다",()=>{
 const {game}=fixture(false);const state=JSON.parse(game.save()).state;
 Object.assign(state,{simSeconds:310,nestLevel:2,evolutionPoints:100,foodIncomeStartedAt:0,foodIncome:[[305,60]]});
 const base=state.agents[0];state.agents=Array.from({length:16},(_,index)=>({...base,id:"1:"+(index+1),bornAt:300,lifespan:360,productionRole:"worker",slots:["excavation","strength"]}));
 assert.equal(colonyWorkerShare(2,310,"bean"),.8);assert.equal(tribeProductionTemplate(state,"bean")?.productionRole,"military");
 Object.assign(state,{simSeconds:1200,nestLevel:4,foodIncome:[[1195,100]]});state.agents=state.agents.slice(0,10).map(agent=>({...agent,bornAt:1190}));
 assert.equal(colonyWorkerShare(4,1200,"bean"),.3);assert.equal(tribeProductionTemplate(state,"bean")?.productionRole,"military");
});

test("습격과 일반 적대 생물의 초반 강제 전투를 늦추고 개체 성장은 10레벨에 닿는다",()=>{
 assert.equal(BEETLE_RAIDS.firstAt,300);assert.ok(ENCOUNTER_TYPES.filter(type=>type.hostile&&!type.unique).every(type=>type.firstSpawnAt>=240));
 assert.equal(agentGrowth({growthActivity:1e9,slots:[]},0).level,10);
});

test("속성·성장·동선 최적화로 후기 일꾼 12마리가 초기 32마리의 수입을 감당한다",()=>{
 const early=colonyWorkerRate("bean",[],{},6,1),late=colonyWorkerRate("bean",["excavation","strength","feet","lifespan"],{excavation:3,strength:3,feet:2,lifespan:1},6,6);
 assert.ok(late.perSecond*12>=early.perSecond*32);assert.ok(late.lifespan>early.lifespan);
});

test("경제 모델은 운영별 성장 차이와 AI 성장 시각 하한을 유지한다",()=>{
 const expert=simulateConquestBuild("bean","expert",6),ai=simulateConquestBuild("bean","ai",6),basic=simulateConquestBuild("bean","basic",6);
 const expertTime=expert.milestones.find(entry=>entry.level===4)?.seconds;
 const aiTime=ai.milestones.find(entry=>entry.level===4)?.seconds;
 const basicTime=basic.milestones.find(entry=>entry.level===4)?.seconds;
 assert.ok(Number.isFinite(expertTime)&&expertTime>0);
 assert.ok(aiTime>=CONQUEST_PACING.aiLevelFourAt);
 assert.ok(basicTime===undefined||basicTime>expertTime);
 assert.ok(expert.workers+expert.military>=30&&expert.workers+expert.military<=40);
});

test("고급 정찰과 군사는 정해진 단계 이후 거점 시야 밖 경계로 나갈 수 있다",()=>{
 for(const role of ["scout","military"]){const size=64,explored=new Set();for(let y=0;y<size;y++)for(let x=0;x<50;x++)explored.add(y*size+x);
  const attributes=role==="scout"?{antenna:1,feet:1}:{blade:1,feet:1};
  const agent={id:"test",tribe:"bean",productionRole:role==="military"?"military":null,slots:Object.keys(attributes),attributes,
   x:48,y:32,health:100,cost:5,carrying:0,stepCount:0,bornAt:100,lifespan:360,visited:new Set(),
   stats:{health:100,speed:1.5,capacity:1,vision:3,attack:1,resistance:1},personality:{boldness:.5,aggression:.5,curiosity:.5}};
  const at=role==="scout"?160:300,state={simSeconds:at-1,nestLevel:2,evolutionPoints:100,explored,knownFood:new Map(),agents:[agent],markers:[]};
  const ai=createUtilityAI({state,size,tribe:"bean",permanentVisionSources:()=>[{x:3,y:32,radius:1}],homeCells:()=>[{x:3,y:32}],deliveryCells:()=>[{x:3,y:32}],
   walkable:(x,y)=>x>=0&&y>=0&&x<50&&y<size,hazardAt:()=>0,enemies:()=>[],synergy:()=>false,canHarvest:()=>true});
  assert.ok(!ai.evaluate(agent,false).some(plan=>plan.action==="explore"));state.simSeconds=at;
  assert.ok(ai.evaluate(agent,false).some(plan=>plan.action==="explore"),role);
 }
});
