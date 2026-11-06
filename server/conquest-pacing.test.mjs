import {createUtilityAI} from "./utility.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {createGame} from "./game.mjs";
import {CONQUEST_PACING,TRIBE_PACING,colonyWorkerShare} from "./conquest-pacing.mjs";
import {simulateConquestBuild} from "./conquest-economy.mjs";
import {tribeProductionTemplate} from "./tribe-production.mjs";
import {birthCost} from "./attributes.mjs";
import {nestUpgradeCost} from "./nests.mjs";
import {ENCOUNTER_TYPES} from "./encounter-types.mjs";
import {BEETLE_RAIDS} from "./raids.mjs";

function fixture(selected) {
 const colony={id:1,ownerId:"colony",tribe:"bean",x:40,y:40,occupiedCells:new Set()};
 for(let y=0;y<5;y++)for(let x=0;x<5;x++)if(!([0,4].includes(x)&&[0,4].includes(y)))colony.occupiedCells.add(x+","+y);
 const room={hostId:selected?"colony":"host",beginnerHelpEnabled:true,simSeconds:0,world:{seed:13,size:160,generationVersion:38,
  terrain:new Uint8Array(160*160).fill(4),hazards:new Uint8Array(160*160)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
 const game=createGame(room,colony);room.games.set(colony.ownerId,game);return {game,room,colony};
}
function change(game,update){const saved=JSON.parse(game.save());update(saved.state);game.restore(JSON.stringify(saved));}

test("개체와 종족 설정에 수명 제한을 두지 않는다",()=>{
 const {game}=fixture(true);assert.ok(game.agents.every(agent=>!("lifespan" in agent)));
 for(const tribe of Object.values(TRIBE_PACING))assert.equal("lifespan" in tribe,false);
});

test("AI 둥지는 시간 하한 없이 현재 성장 비용이 모이면 한 단계만 성장한다",()=>{
 for(const level of [1,2,3])for(const enough of [false,true]){
  const {game}=fixture(false),cost=nestUpgradeCost(level,"bean"),points=cost-(enough?0:1);
  change(game,state=>{state.nestLevel=level;state.evolutionPoints=points;state.simSeconds=60;state.productionReadyAt=0;state.constructionProductionReadyAt=1000;});
  game.prepare(60);game.produce();
  assert.equal(game.nestLevel,level+(enough?1:0),level+":"+enough);
 }
});

test("선택한 종족에는 성장과 생산을 자동 실행하지 않는다",()=>{
 const {game}=fixture(true);change(game,state=>{state.evolutionPoints=1000;});game.prepare(1400);
 const before=game.agents.length;assert.equal(game.produce(),null);assert.equal(game.nestLevel,1);assert.equal(game.agents.length,before);
});

test("목표 편성은 초반 80:20·후반 30:70이며 부족한 정찰을 먼저 보충한다",()=>{
 const {game}=fixture(false);const state=JSON.parse(game.save()).state;
 Object.assign(state,{simSeconds:310,nestLevel:2,evolutionPoints:100,foodIncomeStartedAt:0,foodIncome:[[305,60]]});
 const base={...state.agents[0],dna:null};state.agents=Array.from({length:16},(_,index)=>({...base,id:"1:"+(index+1),bornAt:300,lifespan:360,productionRole:"worker",slots:["strength"]}));
 assert.equal(colonyWorkerShare(2,310,"bean"),.8);
 assert.equal(tribeProductionTemplate(state,"bean")?.productionRole,"scout");
 state.agents[0].slots=["antenna","strength"];
 assert.equal(tribeProductionTemplate(state,"bean")?.productionRole,"military");
 Object.assign(state,{simSeconds:1200,nestLevel:4,foodIncome:[[1195,100]]});state.agents=state.agents.slice(0,12).map(agent=>({...agent,bornAt:1190}));
 assert.equal(colonyWorkerShare(4,1200,"bean"),.3);assert.equal(tribeProductionTemplate(state,"bean")?.productionRole,"military");
});

test("습격과 일반 적대 생물의 초반 강제 전투를 늦춘다",()=>{
 assert.equal(BEETLE_RAIDS.firstAt,300);assert.ok(ENCOUNTER_TYPES.filter(type=>type.hostile&&!type.unique).every(type=>type.firstSpawnAt>=240));
});

test("운반 거리를 제외한 경제 모델은 정책별 성장 차이와 AI 모델의 시간 하한을 유지한다",()=>{
 const expert=simulateConquestBuild("bean","expert",0),ai=simulateConquestBuild("bean","ai",0),basic=simulateConquestBuild("bean","basic",0);
 const expertTime=expert.milestones.find(entry=>entry.level===4)?.seconds;
 const aiTime=ai.milestones.find(entry=>entry.level===4)?.seconds;
 const basicTime=basic.milestones.find(entry=>entry.level===4)?.seconds;
 assert.ok(Number.isFinite(expertTime)&&expertTime>0);
 assert.ok(Number.isFinite(aiTime)&&aiTime>=CONQUEST_PACING.aiLevelFourAt);
 assert.ok(Number.isFinite(basicTime)&&basicTime>expertTime);
 assert.ok(expert.workers+expert.military>=30&&expert.workers+expert.military<=40);
 for(const policy of ["expert","ai","basic"])for(const distance of [6,1e6]){
  const result=simulateConquestBuild("bean",policy,distance);
  for(const value of [result.delivered,result.spent,result.points,result.workers,result.military])assert.ok(Number.isFinite(value)&&value>=0,policy+":"+distance);
  assert.ok(result.spent+result.points<=result.delivered,policy+":"+distance);
  if(distance===1e6){
   assert.deepEqual(result.milestones,[{level:1,seconds:0}]);
   assert.equal(result.delivered,0);assert.equal(result.spent,0);assert.equal(result.points,0);
   assert.equal(result.workers+result.military,4);
  }
 }
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
