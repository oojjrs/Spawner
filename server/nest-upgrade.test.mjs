import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { colonySupply } from "./colony-supply.mjs";
import { createUtilityAI } from "./utility.mjs";
import { colonyRaidPressure } from "./raid-pressure.mjs";

function fixture(tribe,level,points) {
  const colony={id:1,ownerId:"nest-upgrade-test",tribe,x:40,y:40,occupiedCells:new Set(["2,2"])};
  const environment={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},
    colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,colony); environment.games.set(colony.ownerId,game);
  const saved=JSON.parse(game.save()); saved.state.nestLevel=level; saved.state.evolutionPoints=points;
  saved.state.nestHealth=[100,200,400,800][level-1]-17;
  game.restore(JSON.stringify(saved));
  return game;
}

test("몽돌만 15·300·1500포인트로 성장하며 부족하면 차감하지 않고 다른 세 종족은 표준 비용을 쓴다",()=>{
  for (const [tribe,costs] of [["pebble",[15,300,1500]],["bean",[20,400,2000]],
    ["spring",[20,400,2000]],["spore",[20,400,2000]]]) {
    for (const [index,cost] of costs.entries()) {
      const level=index+1,game=fixture(tribe,level,cost-.1);
      assert.throws(()=>game.command({type:"upgrade"}),/진화 포인트/,tribe);
      assert.equal(game.snapshot().evolutionPoints,cost-.1,tribe);
      assert.equal(game.snapshot().nestLevel,level,tribe);
      const saved=JSON.parse(game.save()); saved.state.evolutionPoints=cost+1.2;
      game.restore(JSON.stringify(saved));
      const agents=game.agents.map(agent=>({id:agent.id,slots:[...agent.slots],lifespan:agent.lifespan}));
      game.command({type:"upgrade"});
      assert.equal(game.snapshot().evolutionPoints,1.2,tribe);
      assert.equal(game.snapshot().nestLevel,level+1,tribe);
      assert.equal(game.snapshot().nestHealth,[200,400,800][index]-17,tribe);
      assert.deepEqual(game.agents.map(agent=>({id:agent.id,slots:agent.slots,lifespan:agent.lifespan})),agents);
      game.restore(game.save());
      assert.equal(game.snapshot().evolutionPoints,1.2,tribe);
      assert.equal(game.snapshot().nestLevel,level+1,tribe);
    }
  }
});

test("기존 몽돌 저장의 레벨과 잔액을 유지하고 다음 성장부터 할인하며 최고 레벨은 추가 차감하지 않는다",()=>{
  const game=fixture("pebble",2,350);
  game.restore(game.save());
  assert.equal(game.snapshot().nestLevel,2);
  assert.equal(game.snapshot().evolutionPoints,350);
  game.command({type:"upgrade"});
  assert.equal(game.snapshot().evolutionPoints,50);
  const maximum=fixture("pebble",4,1500);
  assert.throws(()=>maximum.command({type:"upgrade"}),/최고 둥지/);
  assert.equal(maximum.snapshot().evolutionPoints,1500);
  assert.equal(maximum.snapshot().nestLevel,4);
});

test("몽돌의 수급 전망과 첫 습격 준비 자금도 할인된 첫 성장 비용을 반영한다",()=>{
  const agent={health:100,bornAt:0,lifespan:300,slots:["strength"]};
  const state={simSeconds:60,nestLevel:1,evolutionPoints:10,colonyFood:5,lastFoodAt:60,agents:[agent]};
  assert.ok(Math.abs(colonySupply(state,"pebble").urgency-(1-30/33))<1e-12);
  assert.equal(colonyRaidPressure(20,120,[90,120],120,"pebble").arrivalAt,225);
});

test("AI의 성장 목표 자금은 몽돌 300포인트와 표준 400포인트에 맞춰 먹이 가치를 계산한다",()=>{
  for (const [tribe,weight] of [["pebble",1],["bean",1.125],["spring",1.125],["spore",1.125]]) {
    const size=8,agent={id:"worker",tribe,x:1,y:1,carrying:0,slots:[],cost:4,health:100,bornAt:0,lifespan:300,
      attributes:{},stats:{speed:1,capacity:2,health:100,resistance:1,vision:3},personality:{boldness:0,aggression:0,curiosity:0}};
    const home={x:1,y:1},food={x:4,y:1,key:"4,1",resourceType:"pebbles",amount:20};
    const state={simSeconds:0,evolutionPoints:150,colonyFood:0,lastFoodAt:0,nestLevel:2,agents:[agent],
      knownFood:new Map([[food.key,food]]),resourceInventory:{},markers:[],
      explored:new Set(Array.from({length:size*size},(_,index)=>index))};
    const ai=createUtilityAI({state,size,tribe,homeCells:()=>[home],deliveryCells:()=>[home],
      walkable:(x,y)=>y===1,hazardAt:()=>0,enemies:()=>[],synergy:()=>false,canHarvest:()=>true,
      terrainAt:()=>4,materialSpace:()=>200,isFood:()=>true});
    const collect=ai.evaluate(agent,false).find(candidate=>candidate.action==="collect");
    assert.ok(collect,tribe);
    assert.ok(Math.abs(collect.score/collect.foodGain-weight)<1e-12,tribe);
  }
});
