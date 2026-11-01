import test from "node:test";
import assert from "node:assert/strict";
import {constructionHelp,constructionHelpTemplate} from "./beginner-help.mjs";
import {buildingCost} from "./buildings.mjs";
import {attributeCounts,birthCost} from "./attributes.mjs";

function fixture(tribe) {
  return {tribe,simSeconds:0,nestLevel:2,evolutionPoints:40,nextTemplateId:1,templates:[],constructionHelpBuildings:[],
    agents:[{id:"native",health:100,bornAt:0,lifespan:300,slots:[],attributes:{}}]};
}
const world={generationVersion:33};
for(const tribe of ["bean","spore","pebble","spring"])test(tribe+" 감시봉의 기본 자원 예외를 반영하고 칼날 채집을 먼저 안내한다",()=>{
  const state=fixture(tribe),goal={buildingKey:"watchpost",cost:buildingCost("watchpost",tribe)};
  const offer=constructionHelp(state,tribe,true,goal,{},world,false);
  assert.equal(offer.kind,"harvest");assert.deepEqual(offer.slots,["blade"]);
  assert.deepEqual(offer.resources,tribe==="spore"?["grass-fiber"]:["tree","grass-fiber"]);
  assert.equal(offer.cost,birthCost({slots:offer.slots},tribe));
  state.agents.push({id:"harvester",health:100,bornAt:0,lifespan:300,slots:["blade"],attributes:attributeCounts(["blade"]),birth:{readyAt:3}});
  assert.equal(constructionHelp(state,tribe,true,goal,{},world,false),null);
  assert.equal(constructionHelp(state,tribe,true,goal,goal.cost.materials,world,false).kind,"construction");
});

test("재료가 일부만 모였을 때 건설 개체를 먼저 권하지 않는다",()=>{
  const state=fixture("bean"),goal={buildingKey:"watchpost",cost:buildingCost("watchpost","bean")};
  state.agents.push({health:100,bornAt:0,lifespan:300,slots:["blade"],attributes:attributeCounts(["blade"])});
  assert.equal(constructionHelp(state,"bean",true,goal,{clay:8,tree:6},world,false),null);
});

test("채집 가능한 기존 설계는 이름과 강화를 유지하고 변태가 든 설계는 채집용으로 쓰지 않는다",()=>{
  const state=fixture("bean");state.templates=[{id:1,name:"내 벌목꾼",slots:["blade"],attributeLevels:{blade:2}},
    {id:2,name:"몸을 바꾸는 칼날",slots:["blade","construction"],attributeLevels:{blade:1,construction:1}},
    {id:3,name:"날쌘 벌목꾼",slots:["blade","feet"],attributeLevels:{blade:1,feet:1}}];
  const template=constructionHelpTemplate(state,["blade"],"harvest");
  assert.equal(template,state.templates[0]);assert.equal(template.name,"내 벌목꾼");assert.equal(template.attributeLevels.blade,2);
  state.templates.shift();assert.deepEqual(constructionHelpTemplate(state,["blade"],"harvest").slots,["blade"]);
});

test("기본 자원만 쓰는 창고에는 다른 채집 속성을 요구하지 않는다",()=>{
  for(const tribe of ["bean","spore","pebble","spring"]){const state=fixture(tribe),goal={buildingKey:"storage",cost:buildingCost("storage",tribe)};
    assert.equal(constructionHelp(state,tribe,true,goal,{},world,false),null);
    assert.equal(constructionHelp(state,tribe,true,goal,goal.cost.materials,world,false).kind,"construction");}
});

test("과거 완공 기록이 있어도 현재 필요한 재건과 추가 건설을 안내한다",()=>{
  const state=fixture("bean");state.constructionHelpBuildings=["storage"];
  const goal={buildingKey:"storage",cost:buildingCost("storage","bean")};
  assert.equal(constructionHelp(state,"bean",true,goal,goal.cost.materials,world,false).kind,"construction");
  assert.equal(constructionHelp(state,"bean",true,goal,{},world,true).kind,"transport");
  assert.equal(constructionHelp(state,"bean",true,{buildingKey:"watchpost",cost:buildingCost("watchpost","bean")},{},world,false).kind,"harvest");
});

test("수명이 다해가는 채집 개체와 없는 채집 능력을 구분하여 보충한다",()=>{
  const state=fixture("bean");state.simSeconds=280;
  state.agents.push({health:100,bornAt:0,lifespan:300,slots:["blade"],attributes:attributeCounts(["blade"])});
  const offer=constructionHelp(state,"bean",true,{buildingKey:"watchpost",cost:buildingCost("watchpost","bean")},{clay:8},world,false);
  assert.equal(offer.kind,"harvest");assert.deepEqual(offer.slots,["blade"]);
});

test("회복과 수명 때문에 작업할 수 없는 기존 건설 개체가 후속 생산 안내를 막지 않는다",()=>{
  const state=fixture("pebble"),goal={buildingKey:"storage",cost:buildingCost("storage","pebble")};
  const first=constructionHelp(state,"pebble",true,goal,goal.cost.materials,world,false);
  const builder={id:"builder",health:100,stats:{health:100},bornAt:0,lifespan:300,slots:["construction"]};
  state.agents.push(builder);
  assert.equal(constructionHelp(state,"pebble",true,goal,goal.cost.materials,world,false),null);
  builder.health=30;
  const replacement=constructionHelp(state,"pebble",true,goal,goal.cost.materials,world,false);
  assert.equal(replacement.kind,"construction");assert.notEqual(replacement.step,first.step);
  builder.health=100;state.simSeconds=250;
  assert.equal(constructionHelp(state,"pebble",true,goal,goal.cost.materials,world,false).kind,"construction");
});

test("장기 회복 중인 채집 개체는 자재 수급 가능한 인력으로 세지 않는다",()=>{
  const state=fixture("bean"),goal={buildingKey:"watchpost",cost:buildingCost("watchpost","bean")};
  state.agents.push({id:"injured",health:20,stats:{health:100},bornAt:0,lifespan:300,slots:["blade"],attributes:attributeCounts(["blade"])});
  const offer=constructionHelp(state,"bean",true,goal,{clay:8},world,false);
  assert.equal(offer.kind,"harvest");assert.deepEqual(offer.slots,["blade"]);
});

test("자원 유지 담당을 외부 건설 자재 채집 인력으로 중복 계산하지 않는다",()=>{
  const state=fixture("bean"),goal={buildingKey:"watchpost",cost:buildingCost("watchpost","bean")};
  state.agents.push({id:"food-worker",health:100,bornAt:0,lifespan:300,slots:["blade"],attributes:attributeCounts(["blade"])});
  const offer=constructionHelp(state,"bean",true,goal,{clay:8},world,false,new Set(["food-worker"]));
  assert.equal(offer.kind,"harvest");assert.deepEqual(offer.slots,["blade"]);
  const native={buildingKey:"storage",cost:buildingCost("storage","bean")};
  assert.equal(constructionHelp(state,"bean",true,native,{},world,false,new Set(["native","food-worker"])),null);
});

test("운반은 둥지 레벨과 기존 선택 속성 설계에 관계없이 무속성으로 추천한다",()=>{
  for(const tribe of ["bean","spore","pebble","spring"])for(const nestLevel of [1,2,3,4]){
    const state=fixture(tribe);state.nestLevel=nestLevel;
    const custom={id:7,name:"내 수송꾼",slots:["strength","feet","lifespan"]};state.templates=[custom];
    const design=constructionHelpTemplate(state,custom.slots,"transport");
    assert.deepEqual(design.slots,[]);assert.equal(design.name,"일꾼");
    assert.deepEqual(custom.slots,["strength","feet","lifespan"]);
    const empty={id:8,name:"내 일꾼",slots:[]};state.templates.push(empty);
    assert.equal(constructionHelpTemplate(state,custom.slots,"transport"),empty);
    const goal={buildingKey:"storage",cost:buildingCost("storage",tribe)};
    const offer=constructionHelp(state,tribe,true,goal,{},world,true);
    assert.deepEqual(offer.slots,[]);assert.deepEqual(offer.attributes,[]);assert.equal(offer.cost,birthCost({slots:[]},tribe));
  }
});
