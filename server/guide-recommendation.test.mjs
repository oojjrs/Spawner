import test from "node:test";
import assert from "node:assert/strict";
import { constructionHelp } from "./beginner-help.mjs";
import { createGame } from "./game.mjs";
import { attributeCounts, birthCost, isAttributeUnlocked } from "./attributes.mjs";
import { canHarvestResource } from "./resources.mjs";
import { militaryAgent } from "./conquest-pacing.mjs";
import { colonyDefenseTarget } from "./combat.mjs";

const natives = {bean:"clay",spore:"tree",pebble:"pebbles",spring:"dew"};
const requirements = {nutrients:"butchery",tree:"blade",dew:"butchery",pebbles:"piercing",clay:"excavation",sand:"excavation",
  "grass-fiber":"blade","iron-ore":"piercing","copper-ore":"piercing",quartz:"piercing"};
const world = {generationVersion:38};

for (const tribe of Object.keys(natives)) test(tribe + " 자원별 추천은 보충 여부와 둥지 단계에 관계없이 필수 속성을 보존한다", () => {
  for (const nestLevel of [1,2,3,4]) for (const [type,key] of Object.entries(requirements)) for (const support of [false,true]) {
    const state = {tribe,nestLevel,evolutionPoints:1000,simSeconds:0,agents:[],templates:[],nextTemplateId:1};
    const goal = {buildingKey:"storage",cost:{materials:{[type]:10}}};
    const offer = constructionHelp(state,tribe,true,goal,{},world,support,new Set());
    const expected = type === natives[tribe] ? [] : [key];
    assert.equal(offer.kind,"harvest");
    assert.deepEqual(offer.resources,[type]);
    assert.deepEqual(offer.slots,expected,tribe + ":" + nestLevel + ":" + type + ":" + support);
    assert.equal(canHarvestResource({resourceType:type},world,attributeCounts(offer.slots),tribe),true);
    assert.equal(offer.canProduce,expected.every(slot => isAttributeUnlocked(slot,nestLevel,tribe)));
    assert.equal(offer.cost,birthCost({slots:expected},tribe));
  }
});

test("운반 보충은 채집 인력이 이미 담당하는 자원에 한해 무속성을 유지한다", () => {
  const state = {tribe:"bean",nestLevel:2,evolutionPoints:20,simSeconds:0,templates:[],nextTemplateId:1,
    agents:[{id:"worker",health:100,bornAt:0,lifespan:180,slots:[]}]};
  const goal = {buildingKey:"storage",cost:{materials:{clay:10}}};
  const offer = constructionHelp(state,"bean",true,goal,{},world,true,new Set());
  assert.equal(offer.kind,"transport");assert.deepEqual(offer.slots,[]);
});

test("슬롯이 부족하면 담당 자원을 나누고 선택한 자원의 요구 속성을 자르지 않는다", () => {
  const state = {tribe:"bean",nestLevel:1,evolutionPoints:20,simSeconds:0,templates:[],nextTemplateId:1,agents:[]};
  const offer = constructionHelp(state,"bean",true,{buildingKey:"outpost",cost:{materials:{tree:12,pebbles:12}}},{},world,true,new Set());
  assert.deepEqual(offer.resources,["tree"]);assert.deepEqual(offer.slots,["blade"]);
  assert.equal(offer.canProduce,false);assert.match(offer.issue,/둥지.*성장/);
});

function fixture(tribe, at) {
  const size=64,colony={id:1,ownerId:"host",tribe,x:20,y:20,occupiedCells:new Set()};
  for(let y=0;y<5;y++)for(let x=0;x<5;x++)if(!([0,4].includes(x)&&[0,4].includes(y)))colony.occupiedCells.add(x+","+y);
  const room={hostId:"host",beginnerHelpEnabled:true,simSeconds:at,world:{seed:13,size,generationVersion:38,
    terrain:new Uint8Array(size*size).fill(4),hazards:new Uint8Array(size*size)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(room,colony);room.games.set("host",game);return {game,room};
}

const armies = {bean:[["blade"],["blade","carapace"],["blade","carapace","guard"]],
  spore:[["blade"],["blade","regeneration"],["blade","regeneration"]],
  pebble:[["piercing","blade"],["piercing","carapace","blade"],["piercing","carapace","blade","guard"]],
  spring:[["blade","piercing"],["blade","piercing","regeneration"],["blade","piercing","regeneration"]]};
for (const [tribe,levels] of Object.entries(armies)) test(tribe + " 군사 안내와 신규·재사용 설계의 실제 전투 자격이 일치한다", () => {
  for (const [index,slots] of levels.entries()) for (const reuse of [false,true]) {
    const {game}=fixture(tribe,400),saved=JSON.parse(game.save());
    Object.assign(saved.state,{nestLevel:index+2,evolutionPoints:50,nextTemplateId:8});
    saved.state.agents=saved.state.agents.slice(0,1);
    Object.assign(saved.state.agents[0],{slots:[],attributeLevels:{},productionRole:"worker",bornAt:350,birth:null});
    saved.state.templates=reuse?[{id:7,name:"기존 일꾼",slots,attributeLevels:Object.fromEntries(slots.map(key=>[key,1])),revision:1,productionRole:"worker"}]:[];
    game.restore(JSON.stringify(saved));
    const offer=game.snapshot().constructionHelp;
    assert.equal(offer?.kind,"military");assert.deepEqual(offer.slots,slots);assert.equal(offer.canProduce,true);
    const result=game.command({type:"beginner-construction",expectedStep:offer.step,expectedBuildingKey:offer.buildingKey});
    const agent=game.agents.find(value=>value.id===result.agentId);
    assert.deepEqual(agent.slots,slots);assert.equal(agent.productionRole,"military");assert.equal(militaryAgent(agent,tribe),true);
    const ally=game.agents.find(value=>value.id!==agent.id);
    assert.equal(colonyDefenseTarget(agent,{id:"enemy",ownerId:"rival",health:100,attack:{targetId:ally.id}},game.agents,[]),true);
    if(reuse)assert.equal(JSON.parse(game.save()).state.templates.find(value=>value.id===7).productionRole,"worker");
  }
});

test("기존 일꾼 분류는 실제 전투 슬롯의 방어 자격을 가리지 않고 기본 채집 일꾼은 유지한다", () => {
  assert.equal(militaryAgent({productionRole:"worker",slots:["blade","feet"]},"spore"),true);
  assert.equal(militaryAgent({productionRole:"worker",slots:["blade"]},"spore"),false);
  assert.equal(militaryAgent({productionRole:"worker",slots:["blade","construction"]},"bean"),false);
});

test("식량 담당이 유일한 칼날 개체여도 최종 가이드는 무속성으로 바꾸지 않고 실제 칼날을 생산한다", () => {
  const {game,room}=fixture("bean",200),saved=JSON.parse(game.save()),base=saved.state.agents[0];
  Object.assign(saved.state,{nestLevel:2,evolutionPoints:50,resourceInventory:{},templates:[],nextTemplateId:1});
  saved.state.agents=[{...base,id:"1:1",slots:["construction"],attributeLevels:{construction:1},productionRole:"worker",bornAt:150,birth:null,x:30,y:25,
    construction:{buildingKey:"watchpost",x:30,y:25,state:"transforming",orderedAt:170,startedAt:170,readyAt:173,route:[{x:30,y:25}],routeIndex:0,supplyVersion:1,id:"site",
      required:{clay:8,tree:6,"grass-fiber":4},delivered:{clay:8},consumed:{},progress:0,stage:1}},
    {...base,id:"1:2",slots:["butchery","blade"],attributeLevels:{butchery:1,blade:1},productionRole:"worker",bornAt:150,birth:null,x:25,y:24}];
  const foods=[{key:"food",x:25,y:25,amount:100,resourceType:"nutrients",kind:"corpse"},
    {key:"wood",x:27,y:25,amount:100,resourceType:"tree",kind:"resource"},
    {key:"fiber",x:28,y:25,amount:100,resourceType:"grass-fiber",kind:"resource"}];
  for(const food of foods)room.food.set(food.key,food);
  saved.state.knownFood={collection:"Map",entries:foods.map(food=>[food.key,food])};
  saved.state.explored={collection:"Set",entries:Array.from({length:64*64},(_,i)=>i)};
  saved.state.nextAgentId=3;
  game.restore(JSON.stringify(saved));
  const offer=game.snapshot().constructionHelp;
  assert.equal(offer?.kind,"harvest");assert.deepEqual(offer.slots,["blade"]);
  assert.ok(game.foragerMemory.ids.includes("1:2"));
  assert.deepEqual(offer.resources,["tree","grass-fiber"]);assert.equal(offer.canProduce,true);
  const result=game.command({type:"beginner-construction",expectedStep:offer.step,expectedBuildingKey:offer.buildingKey});
  const agent=game.agents.find(value=>value.id===result.agentId);
  assert.deepEqual(agent.slots,offer.slots);
  for(const type of offer.resources)assert.equal(canHarvestResource({resourceType:type},world,agent.attributes,"bean"),true);
});
