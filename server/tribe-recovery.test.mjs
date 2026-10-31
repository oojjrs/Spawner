import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { canHarvestResource } from "./resources.mjs";

function fixture(tribe) {
  const occupiedCells = new Set(["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"]);
  const colony = { id:1, ownerId:"recovery-test", tribe, x:40, y:40, occupiedCells };
  const environment = { simSeconds:0, world:{ seed:13, generationVersion:15,
    terrain:new Uint8Array(320 * 320).fill(0), hazards:new Uint8Array(320 * 320) },
    colonies:[colony], games:new Map(), food:new Map(), foodSpots:new Map() };
  for (let y=35;y<55;y++) for (let x=35;x<55;x++) environment.world.terrain[y*320+x]=4;
  const game = createGame(environment,colony);
  environment.games.set(colony.ownerId,game);
  const saved = JSON.parse(game.save());
  saved.state.agents=[]; saved.state.evolutionPoints=30;
  game.restore(JSON.stringify(saved));
  const {agentId} = game.command({type:"design",templateId:null,name:"회수",slots:["butchery"],birth:true});
  const harvester=game.agents.find(agent=>agent.id===agentId);
  Object.assign(harvester,{x:46,y:42,renderFromX:46,renderFromY:42,birth:null,
    moveStartedAt:0,moveDuration:0,personality:Object.freeze({boldness:0,aggression:0,curiosity:0})});
  const born = game.command({type:"design",templateId:null,name:"개체",slots:[],birth:true});
  const victim=game.agents.find(agent=>agent.id===born.agentId);
  Object.assign(victim,{x:47,y:42,renderFromX:47,renderFromY:42,birth:null,moveStartedAt:0,moveDuration:0});
  const explored=JSON.parse(game.save());
  explored.state.explored={collection:"Set",entries:[]};
  for (let y=25;y<65;y++) for (let x=25;x<65;x++) explored.state.explored.entries.push(y*320+x);
  game.restore(JSON.stringify(explored));
  return {game,environment,harvesterId:agentId,victimId:born.agentId};
}

function advance(fixture) {
  fixture.environment.simSeconds=Math.round((fixture.environment.simSeconds+.1)*10)/10;
  fixture.game.prepare(fixture.environment.simSeconds);
  fixture.game.tick(.1);
}

function recover(fixture, expected) {
  for (let step=0;step<1000 && (fixture.game.snapshot().resourceInventory.meat || 0)<expected;step++) advance(fixture);
  assert.equal(fixture.game.snapshot().resourceInventory.meat,expected);
}

test("네 종족의 전사·자연사 모두 실제 생산비의 20% 또는 70%만 남기고 AI가 소수 양분까지 반납한다",()=>{
  for (const [tribe,amount] of [["bean",.6],["spore",.4],["pebble",2.8],["spring",2.1]]) {
    for (const cause of ["combat","age"]) {
      const f=fixture(tribe), victim=f.game.agents.find(agent=>agent.id===f.victimId);
      const before=f.game.snapshot().evolutionPoints, paid=victim.cost;
      if (cause==="age") { victim.bornAt=-victim.lifespan; f.game.tick(0); }
      else f.game.receiveDamage(victim,1000);
      const corpse=f.game.snapshot().corpses.find(cell=>cell.agentId===f.victimId);
      assert.equal(corpse.cost,paid,tribe);
      assert.equal(corpse.initialAmount,amount,tribe);
      assert.equal(corpse.amount,amount,tribe);
      assert.equal(f.game.snapshot().evolutionPoints,before);
      assert.equal(f.game.snapshot().resourceInventory.meat,undefined);
      recover(f,amount);
      assert.equal(f.game.snapshot().evolutionPoints,Math.round((before+amount)*10)/10,tribe);
      assert.equal(f.game.snapshot().colonyFood,amount,tribe);
      assert.equal(f.game.snapshot().corpses.length,0,tribe);
      assert.equal(f.game.agents.find(agent=>agent.id===f.harvesterId).carrying,0,tribe);
    }
  }
});

test("과거 지불액을 기준으로 회수하고 운반 중 저장·복원해도 반납 전 지급하거나 중복 지급하지 않는다",()=>{
  const f=fixture("bean"), saved=JSON.parse(f.game.save());
  const legacy=saved.state.agents.find(agent=>agent.id===f.victimId);
  legacy.cost=17; legacy.growthActivity=204;
  f.game.restore(JSON.stringify(saved));
  f.game.receiveDamage(f.game.agents.find(agent=>agent.id===f.victimId),1000);
  const before=f.game.snapshot().evolutionPoints;
  for (let step=0;step<1000 && !f.game.agents.find(agent=>agent.id===f.harvesterId).carrying;step++) advance(f);
  assert.equal(f.game.agents.find(agent=>agent.id===f.harvesterId).carrying,1);
  assert.equal(f.game.snapshot().evolutionPoints,before);
  assert.equal(f.game.snapshot().resourceInventory.meat,undefined);
  f.game.restore(f.game.save());
  const corpse=[...f.environment.food.values()].find(cell=>cell.agentId===f.victimId);
  assert.equal(corpse.cost,17); assert.equal(corpse.amount,2.4);
  recover(f,3.4);
  assert.equal(f.game.snapshot().evolutionPoints,Math.round((before+3.4)*10)/10);
  const returned=f.game.snapshot().evolutionPoints;
  f.game.restore(f.game.save()); advance(f);
  assert.equal(f.game.snapshot().evolutionPoints,returned);
  const templateId=f.game.snapshot().templates.find(template=>template.name==="개체").id;
  const {agentId}=f.game.command({type:"birth",templateId});
  const newborn=f.game.agents.find(agent=>agent.id===agentId);
  assert.equal(newborn.level,1); assert.equal(newborn.growthActivity,0);
  assert.deepEqual(newborn.slots,[]);
  assert.equal(f.game.snapshot().evolutionPoints,Math.round((returned-3)*10)/10);
});

test("회수율은 수거 종족이 아닌 사체 종족을 따르고 회수 속성 없이 채집하지 못한다",()=>{
  const f=fixture("spring");
  f.game.receiveDamage(f.game.agents.find(agent=>agent.id===f.victimId),1000);
  const corpse=f.game.snapshot().corpses[0], remaining=corpse.amount;
  corpse.colonyId=2; corpse.tribe="spring";
  f.environment.colonies[0].tribe="bean";
  for (const tribe of ["bean","spore","pebble","spring"]) {
    assert.equal(canHarvestResource(corpse,f.environment.world,{},tribe),false,tribe);
    assert.equal(canHarvestResource(corpse,f.environment.world,{butchery:1},tribe),true,tribe);
  }
  const points=f.game.snapshot().evolutionPoints;
  recover(f,remaining);
  assert.equal(remaining,2.1);
  assert.equal(f.game.snapshot().evolutionPoints,Math.round((points+2.1)*10)/10);
});

test("창고가 가득 차도 반납한 양분만 포인트로 회수하며 소수 재고도 버릴 수 있다",()=>{
  const f=fixture("spore"), saved=JSON.parse(f.game.save());
  saved.state.resourceInventory={clay:200};
  f.game.restore(JSON.stringify(saved));
  f.game.receiveDamage(f.game.agents.find(agent=>agent.id===f.victimId),1000);
  const points=f.game.snapshot().evolutionPoints;
  for (let step=0;step<1000 && f.game.snapshot().evolutionPoints===points;step++) advance(f);
  assert.equal(f.game.snapshot().evolutionPoints,Math.round((points+.4)*10)/10);
  assert.equal(f.game.snapshot().resourceInventory.meat,undefined);
  const stock=JSON.parse(f.game.save()); stock.state.resourceInventory={meat:.4};
  f.game.restore(JSON.stringify(stock));
  assert.throws(()=>f.game.command({type:"discard-resource",resourceType:"meat",amount:.01}));
  assert.deepEqual(f.game.command({type:"discard-resource",resourceType:"meat",amount:.4}),{resourceType:"meat",discarded:.4});
  assert.equal(f.game.snapshot().resourceInventory.meat,0);
});
