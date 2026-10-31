import test from "node:test";
import assert from "node:assert/strict";
import {createGame} from "./game.mjs";
import {buildingCost} from "./buildings.mjs";
import {tribeExpansion} from "./tribe-construction.mjs";

test("샘방울 전초만 이슬 12·목재 6·자갈 6가 필요하고 다른 종족·건물의 비용은 유지한다",()=>{
  assert.deepEqual(buildingCost("outpost","spring"),{evolutionPoints:0,materials:{dew:12,tree:6,pebbles:6}});
  assert.deepEqual(buildingCost("outpost","bean").materials,{clay:24,tree:12,pebbles:12});
  assert.deepEqual(buildingCost("outpost","pebble").materials,{pebbles:36,tree:12});
  assert.deepEqual(buildingCost("outpost","spore").materials,{tree:36,pebbles:12});
  assert.deepEqual(buildingCost("storage","spring").materials,{dew:10});
  assert.deepEqual(buildingCost("evolution-lab","spring").materials,{dew:16,tree:4,pebbles:4});
});

test("AI는 할인된 부족분을 준비하고 재료가 모인 뒤 자율 변태를 완료할 때 한 번만 차감한다",()=>{
  const colony={id:1,ownerId:"outpost-test",tribe:"spring",x:40,y:40,occupiedCells:new Set(["2,2"])};
  const environment={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},
    colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,colony);environment.games.set(colony.ownerId,game);
  const saved=JSON.parse(game.save());saved.state.agents=saved.state.agents.slice(0,2);
  saved.state.nestLevel=2;saved.state.evolutionPoints=20;saved.state.resourceInventory={dew:12,tree:5,pebbles:6};
  saved.state.explored={collection:"Set",entries:[]};
  for(let y=34;y<=55;y++)for(let x=34;x<=85;x++)saved.state.explored.entries.push(y*320+x);
  game.restore(JSON.stringify(saved));
  for(const [index,agent]of game.agents.entries())Object.assign(agent,{x:46+index,y:45,renderFromX:46+index,renderFromY:45,moveDuration:0});
  const {agentId}=game.command({type:"design",templateId:null,name:"개척",slots:["construction"],birth:true});
  Object.assign(game.agents.find(agent=>agent.id===agentId),{x:72,y:42,renderFromX:72,renderFromY:42,birth:null,moveDuration:0});
  const food={x:75,y:42,key:"75,42",kind:"resource",resourceType:"dew",amount:120};environment.food.set(food.key,food);
  game.snapshot();
  const state=JSON.parse(game.save()).state;
  state.knownFood=new Map([[food.key,food]]);state.explored=new Set(state.explored.entries);
  assert.deepEqual(tribeExpansion(state,"spring",[{x:40,y:40,width:5,height:5}]).materials,{dew:0,tree:1,pebbles:0});
  game.prepare(.25);game.tick(.25);
  assert.equal(!!game.agents.find(agent=>agent.id===agentId).construction,false);
  const funded=JSON.parse(game.save());funded.state.resourceInventory={dew:12,tree:6,pebbles:6};game.restore(JSON.stringify(funded));
  game.prepare(.5);game.tick(.25);
  let step=3;
  for(;step<=20&&!game.agents.find(agent=>agent.id===agentId).construction;step++){
    environment.simSeconds=step/4;game.prepare(environment.simSeconds);game.tick(.25);
  }
  assert.equal(game.agents.find(agent=>agent.id===agentId).construction?.buildingKey,"outpost");
  assert.deepEqual(game.snapshot().resourceInventory,{dew:12,tree:6,pebbles:6});
  for(;step<=240 && game.agents.some(agent=>agent.id===agentId);step++){
    environment.simSeconds=step/4;game.prepare(environment.simSeconds);game.tick(.25);
  }
  assert.equal(game.buildings.filter(building=>building.key==="outpost").length,1);
  assert.equal(game.agents.some(agent=>agent.id===agentId),false);
  assert.equal(game.snapshot().resourceInventory.dew,0);
  assert.equal(game.snapshot().resourceInventory.tree,0);
  const points=game.snapshot().evolutionPoints;game.restore(game.save());
  assert.equal(game.snapshot().evolutionPoints,points);
  assert.equal(game.snapshot().resourceInventory.dew,0);
});
