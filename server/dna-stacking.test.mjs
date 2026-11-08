import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA as M } from "./dna.mjs";
import { birthCost, unitTravelSpeed } from "./attributes.mjs";
import { validateDna, dnaUnitStats } from "./dna-unit.mjs";
import { createGame } from "./game.mjs";
import { createUtilityAI } from "./utility.mjs";

const piece=id=>{const g=M.lookup.get(id);return {gene:id,grade:g.grade,rotation:0,q:0,r:0};};
const build=n=>({version:6,pieces:M.pack(Array.from({length:n},()=>({gene:"gather",grade:1,rotation:0})),2),level:2,budget:500});

test("stack prices are order independent and every split pays extra body bases",()=>{
  assert.equal(birthCost({dna:build(0)},"bean"),3);
  for(let n=1;n<=6;n++){
    assert.equal(birthCost({dna:build(n)},"bean"),3+8*n);
    if(n>1)assert.ok(birthCost({dna:build(n)},"bean")<11*n);
    for(let left=1;left<n;left++)assert.equal(birthCost({dna:build(left)},"bean")+birthCost({dna:build(n-left)},"bean")-birthCost({dna:build(n)},"bean"),3);
  }
  const mixed=[piece("gather"),piece("antenna"),piece("rangedPower"),piece("health")];
  assert.equal(M.price(mixed),M.price([...mixed].reverse()));
  assert.equal(M.price([piece("antenna")]),12);
  assert.equal(M.price([piece("rangedPower")]),7);
  assert.equal(validateDna(build(6),1,60),null);
  assert.deepEqual(M.validate(build(6)),build(6));
  assert.equal(validateDna(build(4),1,100),null);assert.equal(validateDna(build(5),1,100),null);assert.equal(birthCost({dna:build(5)},"bean"),43);
});

test("physical organ copies preserve basic role throughput without extra hits or attack rate",()=>{
  const six=id=>M.stats(Array.from({length:6},()=>piece(id)));
  const gather=six("gather"),blade=six("blade"),ranged=six("secretion"),antenna=six("antenna");
  assert.equal(gather.capacity,6);assert.equal(gather.harvest,1);assert.equal(gather.harvestTime,3);assert.equal(gather.loadSpeed,75);assert.equal(gather.health,10);
  assert.equal(blade.meleePower,12);assert.equal(blade.meleeSpeed,.5);assert.equal(blade.hits,1);assert.equal(blade.rangedPower,0);
  assert.ok(Math.abs(ranged.rangedPower-8.4)<1e-9);assert.equal(ranged.rangedSpeed,.5);assert.equal(ranged.hits,1);assert.equal(ranged.meleePower,0);
  assert.equal(antenna.vision,1);
  const capped=M.stats(Array.from({length:20},()=>piece("antenna")));assert.equal(capped.vision,1);
});

function gameFixture(n,dna,tribe){
  if(!dna)dna=build(n);const cost=M.cost(dna.pieces);
  const occupiedCells=new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"]);
  const colony={id:1,ownerId:"stack-test",x:40,y:40,tribe,occupiedCells};
  const environment={simSeconds:0,world:{seed:13,generationVersion:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,colony);environment.games.set(colony.ownerId,game);
  const saved=JSON.parse(game.save());saved.state.evolutionPoints=500-cost;saved.state.nestLevel=dna.level;
  saved.state.templates=[{id:1,name:"stack",slots:[],attributeLevels:{},dna}];
  saved.state.agents=[{...saved.state.agents[0],dna,templateId:1,slots:[],attributeLevels:{},cost}];
  game.restore(JSON.stringify(saved));
  const agent=game.agents[0];assert.equal(game.snapshot().evolutionPoints,500-cost);assert.deepEqual(agent.dna,dna);
  const food={key:"38,40",x:38,y:40,resourceType:({bean:"clay",spore:"tree",pebble:"pebbles",spring:"dew"})[tribe],kind:"resource",amount:20,initialAmount:20};environment.food.set(food.key,food);
  Object.assign(agent,{x:38,y:40,renderFromX:38,renderFromY:40,birth:null,moveStartedAt:0,moveDuration:0,mode:"harvest",harvestReady:1,harvestPrepared:false,harvestStarted:0,nextDecisionAt:100000,decisionPending:null,utility:{action:"collect",target:{key:food.key,x:38,y:40},plannedCargo:n,route:[]}});
  const tick=at=>{environment.simSeconds=at;game.prepare(at);game.tick(1);};return {game,agent,food,tick,environment};
}

test("real gather loop collects one at a time until full and deposits the whole load",()=>{
  for(const n of [1,6]){
    const f=gameFixture(n,undefined,'bean');f.tick(1);assert.equal(f.agent.carrying,0);for(let count=1;count<=n;count++){f.tick(1+3*count);assert.equal(f.agent.carrying,count);assert.equal(f.food.amount,20-count);assert.equal(f.agent.harvestResult.amount,1);}
    assert.equal(f.food.amount,20-n);assert.equal(f.agent.carrying,n);assert.equal(f.agent.harvestResult.amount,1);
    assert.equal(unitTravelSpeed(f.agent,n,"clay"),.1875);
    Object.assign(f.agent,{x:40,y:40,renderFromX:40,renderFromY:40,mode:"unload",unloadReady:2+3*n,nextDecisionAt:100000,decisionPending:null,moveDuration:0,utility:{action:"return",target:{x:40,y:40},route:[]}});
    const before=f.game.snapshot().evolutionPoints;f.tick(2+3*n);assert.equal(f.agent.carrying,0);assert.equal(f.game.snapshot().evolutionPoints,before+n);assert.equal(f.agent.foodDelivery.amount,n);
    const paid=f.agent.cost;f.game.restore(f.game.save());assert.equal(f.game.agents.find(a=>a.id===f.agent.id).cost,paid);
  }
});

test("historical paid cost and DNA survive restore while new births require the current catalog",()=>{
  const f=gameFixture(6,undefined,'bean');f.agent.cost=143;const id=f.agent.id;f.game.restore(f.game.save());
  const restored=f.game.agents.find(a=>a.id===id);assert.equal(restored.cost,143);assert.deepEqual(restored.dna,build(6));
  const before=f.game.snapshot().evolutionPoints,count=f.game.agents.length;
  assert.throws(()=>f.game.command({type:"birth",agentId:id}),/설계를 수정/);
  assert.equal(f.game.agents.length,count);assert.equal(f.game.snapshot().evolutionPoints,before);assert.equal(restored.cost,143);
});

test("운반은 한도만 늘리고 채집 속도는 1개를 캐는 시간을 줄인다",()=>{
  for(const [capacity,speed] of [[1,0],[4,0],[4,2]]){
    const genes=['gather',...Array(capacity-1).fill('capacity'),...Array(speed).fill('harvestSpeed')],dna={version:6,pieces:M.pack(genes.map(piece),1),level:1,budget:500};assert.ok(validateDna(dna,1,500));
    const stats=M.stats(dna.pieces),f=gameFixture(capacity,dna,'bean'),interval=3*(100-10*speed)/100;assert.equal(stats.harvest,1);assert.equal(stats.capacity,capacity);assert.equal(stats.harvestTime,interval);f.tick(1);
    for(let count=1;count<=capacity;count++){f.tick(1+interval*count-.001);assert.equal(f.agent.carrying,count-1);f.tick(1+interval*count+.001);assert.equal(f.agent.carrying,count);assert.equal(f.food.amount,20-count);assert.equal(f.agent.harvestResult.amount,1);if(count<capacity)assert.equal(f.agent.mode,'harvest');}
  }
  assert.equal(M.stats([piece('capacity')]).harvest,0);assert.equal(M.stats([piece('gather'),piece('harvest'),piece('capacity')]).harvest,1);assert.equal(M.catalog.some(g=>g.id==='harvest'),false);
});

test("DNA 수집 계획은 한도까지 1개씩 캐는 시간과 자원 부족을 반영한다",()=>{
  const dna={version:6,pieces:M.pack(['gather','capacity','capacity','capacity'].map(piece),1),level:1,budget:500},size=14,stats=dnaUnitStats(dna),agent={id:'worker',tribe:'bean',x:1,y:1,dna,stats,attributes:{},slots:[],carrying:0,health:stats.health,bornAt:0,lifespan:180,cost:28,personality:{boldness:0,aggression:0,curiosity:0}},food={x:3,y:1,key:'3,1',resourceType:'clay',amount:20},home={x:1,y:1};
  const state={simSeconds:0,evolutionPoints:0,colonyFood:0,lastFoodAt:0,nestLevel:1,agents:[agent],knownFood:new Map([[food.key,food]]),resourceInventory:{},markers:[],explored:new Set(Array.from({length:size*size},(_,index)=>index))};
  const ai=createUtilityAI({state,size,tribe:'bean',homeCells:()=>[home],deliveryCells:()=>[home],walkable:(x,y)=>y===1,hazardAt:()=>0,enemies:()=>[],synergy:()=>false,canHarvest:()=>true,terrainAt:()=>4,materialSpace:()=>200,isFood:()=>true,harvestSeconds:()=>stats.dna.harvestTime});
  const full=ai.evaluate(agent,false).find(p=>p.action==='collect');assert.ok(full);assert.equal(full.plannedCargo,4);assert.ok(Math.abs(full.deliverySeconds-(2/.25+1+3*4+2/.1875+1))<1e-9);
  food.amount=2;const partial=ai.evaluate(agent,false).find(p=>p.action==='collect');assert.equal(partial.plannedCargo,2);
  food.amount=20;stats.dna.harvestTime=0;const instant=ai.evaluate(agent,false).find(p=>p.action==='collect');assert.equal(instant.plannedCargo,4);assert.ok(Math.abs(instant.deliverySeconds-(2/.25+1+2/.1875+1))<1e-9);
});


test("종족별 채집 간격은 기본 시간의 백분율로 줄고 100%부터 즉시 한도까지 채집한다",()=>{
  for(const [tribe,base] of [['bean',3],['spore',3],['pebble',3],['spring',3]])for(const speed of [0,1,5,9,10,11]){
    const genes=['gather','capacity','capacity','capacity',...Array(speed).fill('harvestSpeed')];
    const dna={version:6,pieces:M.pack(genes.map(piece),4),level:4,budget:1000};assert.ok(validateDna(dna,4,1000));
    const f=gameFixture(4,dna,tribe),interval=base*Math.max(0,100-speed*10)/100;
    assert.equal(f.agent.stats.dna.harvestTime,interval);assert.equal(f.agent.stats.dna.harvestReduction,Math.min(100,speed*10));
    f.tick(.999);assert.equal(f.agent.carrying,0);f.tick(1);
    if(interval===0){assert.equal(f.agent.carrying,4);assert.equal(f.food.amount,16);f.tick(1.001);assert.equal(f.agent.carrying,4);}
    else {assert.equal(f.agent.carrying,0);f.tick(1+interval-.00001);assert.equal(f.agent.carrying,0);f.tick(1+interval+.00001);assert.equal(f.agent.carrying,1);}
    if(speed===10){const depleted=gameFixture(4,dna,tribe);depleted.food.amount=2;depleted.tick(1);assert.equal(depleted.agent.carrying,2);assert.equal(depleted.food.amount,0);}
  }
});
