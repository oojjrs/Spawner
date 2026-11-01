import test from "node:test";
import assert from "node:assert/strict";
import {createGame} from "./game.mjs";
import {buildingCost} from "./buildings.mjs";
import {tribeExpansion} from "./tribe-construction.mjs";

test("샘방울 전초는 이슬방울 24·목재 12·자갈 12가 필요하고 다른 종족·건물의 비용은 유지한다",()=>{
  assert.deepEqual(buildingCost("outpost","spring"),{evolutionPoints:0,materials:{dew:24,tree:12,pebbles:12}});
  assert.deepEqual(buildingCost("outpost","bean").materials,{clay:24,tree:12,pebbles:12});
  assert.deepEqual(buildingCost("outpost","pebble").materials,{pebbles:36,tree:12});
  assert.deepEqual(buildingCost("outpost","spore").materials,{tree:36,pebbles:12});
  assert.deepEqual(buildingCost("storage","spring").materials,{dew:10});
  assert.deepEqual(buildingCost("evolution-lab","spring").materials,{dew:16,tree:4,pebbles:4});
});

function fixture(slots, foodX, materials) {
  const colony={id:1,ownerId:"outpost-test",tribe:"spring",x:40,y:40,occupiedCells:new Set(["2,2"])};
  const environment={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},
    colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,colony);environment.games.set(colony.ownerId,game);
  const saved=JSON.parse(game.save()),worker=saved.state.agents[0];
  saved.state.agents=slots.map((attributes,index)=>({...structuredClone(worker),id:"courier:"+index,
    slots:attributes,attributeLevels:{},x:46+index,y:45,renderFromX:46+index,renderFromY:45,
    birth:null,utility:null,decisionPending:"restore",nextDecisionAt:0,moveDuration:0}));
  saved.state.nestLevel=2;saved.state.evolutionPoints=200;saved.state.resourceInventory=materials;
  saved.state.explored={collection:"Set",entries:[]};
  for(let y=34;y<=55;y++)for(let x=34;x<=85;x++)saved.state.explored.entries.push(y*320+x);
  game.restore(JSON.stringify(saved));
  const {agentId}=game.command({type:"design",templateId:null,name:"개척",slots:["construction"],birth:true});
  Object.assign(game.agents.find(agent=>agent.id===agentId),{x:foodX-3,y:42,renderFromX:foodX-3,renderFromY:42,birth:null,moveDuration:0});
  const food={x:foodX,y:42,key:foodX+",42",kind:"resource",resourceType:"dew",amount:120};environment.food.set(food.key,food);
  game.snapshot();
  return {game,environment,agentId,food};
}

function tick(context) {
  context.environment.simSeconds+=.25;
  context.game.prepare(context.environment.simSeconds);context.game.tick(.25);
}

test("전초 재료가 한 개라도 부족하면 부족분을 계산하고 자동 착공하지 않는다",()=>{
  const context=fixture(Array.from({length:8},()=>["strength","feet"]),61,{dew:24,tree:11,pebbles:12});
  const {game,agentId,food}=context,state=JSON.parse(game.save()).state;
  state.knownFood=new Map([[food.key,food]]);state.explored=new Set(state.explored.entries);
  assert.deepEqual(tribeExpansion(state,"spring",[{x:40,y:40,width:5,height:5}]).materials,{dew:0,tree:1,pebbles:0});
  for(let step=0;step<20;step++)tick(context);
  assert.equal(!!game.agents.find(agent=>agent.id===agentId).construction,false);
  assert.deepEqual(game.snapshot().resourceInventory,{dew:24,tree:11,pebbles:12});
});

test("재고가 충분해도 먼 현장까지 수명 내에 납품할 인력이 없으면 착공하지 않는다",()=>{
  const context=fixture([["feet"],["feet"]],75,{dew:24,tree:12,pebbles:12});
  for(let step=0;step<20;step++)tick(context);
  assert.equal(!!context.game.agents.find(agent=>agent.id===context.agentId).construction,false);
  assert.equal(context.game.buildings.length,0);
  assert.deepEqual(context.game.snapshot().resourceInventory,{dew:24,tree:12,pebbles:12});
});

test("운반 가능한 일손과 재료가 모이면 AI가 전초를 선택하고 실제 납품으로 완공한다",()=>{
  const context=fixture(Array.from({length:8},()=>["strength","feet"]),61,{dew:24,tree:12,pebbles:12});
  const {game,agentId}=context;
  tick(context);
  const plan=game.agents.find(agent=>agent.id===agentId).construction;
  assert.equal(plan?.buildingKey,"outpost");
  assert.equal(plan.supplyVersion,1);
  assert.deepEqual(plan.required,{dew:24,tree:12,pebbles:12});
  assert.deepEqual(plan.delivered,{});
  assert.deepEqual(game.snapshot().resourceInventory,{dew:24,tree:12,pebbles:12});
  let cargo=false,delivered=false,restored=false;
  const supplied={dew:0,tree:0,pebbles:0};
  for(let step=0;step<960&&game.agents.some(agent=>agent.id===agentId);step++){
    const shipments=game.agents.filter(agent=>agent.transportCargo?.siteId===plan.id&&agent.transport?.phase==="deliver")
      .map(agent=>({id:agent.id,type:agent.carryingType,amount:agent.carrying}));
    tick(context);
    for(const shipment of shipments)supplied[shipment.type]+=shipment.amount-(game.agents.find(agent=>agent.id===shipment.id)?.carrying||0);
    cargo||=game.agents.some(agent=>agent.transportCargo?.siteId===plan.id&&agent.carrying>0);
    const construction=game.agents.find(agent=>agent.id===agentId)?.construction;
    delivered||=!!construction&&Object.values(construction.delivered).some(amount=>amount>0);
    if(!restored&&construction?.progress>0){game.restore(game.save());restored=true;}
  }
  assert.equal(cargo,true);assert.equal(delivered,true);assert.equal(restored,true);
  assert.deepEqual(supplied,{dew:24,tree:12,pebbles:12});
  assert.equal(game.buildings.filter(building=>building.key==="outpost").length,1);
  assert.equal(game.agents.some(agent=>agent.id===agentId),false);
  assert.equal(game.snapshot().resourceInventory.tree,0);
  assert.equal(game.snapshot().resourceInventory.pebbles,0);
  const inventory=game.snapshot().resourceInventory,points=game.snapshot().evolutionPoints;
  game.restore(game.save());
  assert.equal(game.snapshot().evolutionPoints,points);
  assert.deepEqual(game.snapshot().resourceInventory,inventory);
});
