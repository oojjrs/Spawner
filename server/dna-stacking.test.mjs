import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA as M } from "./dna.mjs";
import { birthCost, unitTravelSpeed } from "./attributes.mjs";
import { validateDna, dnaUnitStats } from "./dna-unit.mjs";
import { createGame } from "./game.mjs";

const piece=id=>{const g=M.lookup.get(id);return {gene:id,grade:g.grade,rotation:0,q:0,r:0};};
const build=n=>({version:4,pieces:M.pack(Array.from({length:n},()=>({gene:"gather",grade:1,rotation:0})),2),level:2,budget:500});

test("stack prices are order independent and every split pays extra body bases",()=>{
  assert.equal(birthCost({dna:build(0)},"bean"),3);
  for(let n=1;n<=6;n++){
    assert.equal(birthCost({dna:build(n)},"bean"),3+5*n);
    if(n>1)assert.ok(birthCost({dna:build(n)},"bean")<8*n);
    for(let left=1;left<n;left++)assert.equal(birthCost({dna:build(left)},"bean")+birthCost({dna:build(n-left)},"bean")-birthCost({dna:build(n)},"bean"),3);
  }
  const mixed=[piece("gather"),piece("antenna"),piece("rangedPower"),piece("health")];
  assert.equal(M.price(mixed),M.price([...mixed].reverse()));
  assert.equal(M.price([piece("antenna")]),7);
  assert.equal(M.price([piece("rangedPower")]),4);
  assert.equal(validateDna(build(6),1,60),null);
  assert.deepEqual(M.validate(build(6)),build(6));
  assert.equal(validateDna(build(4),1,100),null);assert.equal(validateDna(build(5),1,100),null);assert.equal(birthCost({dna:build(5)},"bean"),28);
});

test("physical organ copies preserve basic role throughput without extra hits or attack rate",()=>{
  const six=id=>M.stats(Array.from({length:6},()=>piece(id)));
  const gather=six("gather"),blade=six("blade"),ranged=six("secretion"),antenna=six("antenna");
  assert.equal(gather.capacity,6);assert.equal(gather.harvest,6);assert.equal(gather.harvestTime,4);assert.equal(gather.loadSpeed,75);assert.equal(gather.health,10);
  assert.equal(blade.meleePower,12);assert.equal(blade.meleeSpeed,.5);assert.equal(blade.hits,1);assert.equal(blade.rangedPower,0);
  assert.ok(Math.abs(ranged.rangedPower-8.4)<1e-9);assert.equal(ranged.rangedSpeed,.5);assert.equal(ranged.hits,1);assert.equal(ranged.meleePower,0);
  assert.equal(antenna.vision,7);
  const capped=M.stats(Array.from({length:20},()=>piece("antenna")));assert.equal(capped.vision,12);
});

function gameFixture(n){
  const occupiedCells=new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"]);
  const colony={id:1,ownerId:"stack-test",x:40,y:40,tribe:"bean",occupiedCells};
  const environment={simSeconds:0,world:{seed:13,generationVersion:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,colony);environment.games.set(colony.ownerId,game);
  const saved=JSON.parse(game.save());saved.state.evolutionPoints=500-(3+5*n);saved.state.nestLevel=2;
  saved.state.templates=[{id:1,name:"stack",slots:[],attributeLevels:{},dna:build(n)}];
  saved.state.agents=[{...saved.state.agents[0],dna:build(n),templateId:1,slots:[],attributeLevels:{},cost:3+5*n}];
  game.restore(JSON.stringify(saved));
  const agent=game.agents[0];assert.equal(game.snapshot().evolutionPoints,500-(3+5*n));assert.deepEqual(agent.dna,build(n));
  const food={key:"38,40",x:38,y:40,resourceType:"clay",kind:"resource",amount:20,initialAmount:20};environment.food.set(food.key,food);
  Object.assign(agent,{x:38,y:40,renderFromX:38,renderFromY:40,birth:null,moveStartedAt:0,moveDuration:0,mode:"harvest",harvestReady:1,harvestPrepared:false,harvestStarted:0,nextDecisionAt:100000,decisionPending:null,utility:{action:"collect",target:{key:food.key,x:38,y:40},plannedCargo:n,route:[]}});
  const tick=at=>{environment.simSeconds=at;game.prepare(at);game.tick(1);};return {game,agent,food,tick,environment};
}

test("real gather loop removes and carries six resources and deposits six points",()=>{
  for(const n of [1,6]){
    const f=gameFixture(n);f.tick(1);assert.equal(f.agent.carrying,0);f.tick(5);
    assert.equal(f.food.amount,20-n);assert.equal(f.agent.carrying,n);assert.equal(f.agent.harvestResult.amount,n);
    assert.equal(unitTravelSpeed(f.agent,n,"clay"),.1875);
    Object.assign(f.agent,{x:40,y:40,renderFromX:40,renderFromY:40,mode:"unload",unloadReady:6,nextDecisionAt:100000,decisionPending:null,moveDuration:0,utility:{action:"return",target:{x:40,y:40},route:[]}});
    const before=f.game.snapshot().evolutionPoints;f.tick(6);assert.equal(f.agent.carrying,0);assert.equal(f.game.snapshot().evolutionPoints,before+n);assert.equal(f.agent.foodDelivery.amount,n);
    const paid=f.agent.cost;f.game.restore(f.game.save());assert.equal(f.game.agents.find(a=>a.id===f.agent.id).cost,paid);
  }
});

test("historical paid cost and DNA survive restore while new births require the current catalog",()=>{
  const f=gameFixture(6);f.agent.cost=143;const id=f.agent.id;f.game.restore(f.game.save());
  const restored=f.game.agents.find(a=>a.id===id);assert.equal(restored.cost,143);assert.deepEqual(restored.dna,build(6));
  const before=f.game.snapshot().evolutionPoints,count=f.game.agents.length;
  assert.throws(()=>f.game.command({type:"birth",agentId:id}),/설계를 수정/);
  assert.equal(f.game.agents.length,count);assert.equal(f.game.snapshot().evolutionPoints,before);assert.equal(restored.cost,143);
});
