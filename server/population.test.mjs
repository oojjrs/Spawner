import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { NEST_LEVELS } from "./nests.mjs";
import { tribeProductionTemplate } from "./tribe-production.mjs";

function fixture(tribe, level, count) {
  const colony = { id:1, ownerId:"population", tribe, x:20, y:20, occupiedCells:new Set(["2,2"]) };
  const room = { simSeconds:0, world:{ size:80, seed:13, generationVersion:38,
    terrain:new Uint8Array(6400).fill(4), hazards:new Uint8Array(6400) }, colonies:[colony], games:new Map(), food:new Map(), foodSpots:new Map() };
  const game = createGame(room,colony); room.games.set(colony.ownerId,game);
  const saved = JSON.parse(game.save()), original = saved.state.agents[0];
  saved.state.nestLevel = level; saved.state.evolutionPoints = 12500; saved.state.nextAgentId = 100;
  saved.state.agents = Array.from({length:count}, (_,index) => ({...structuredClone(original), id:"saved:" + index,
    x:30 + index % 10, y:30 + Math.floor(index / 10), slots:[], birth:null, lifespan:1}));
  game.restore(JSON.stringify(saved));
  const design = game.command({type:"design",templateId:null,name:"개체",slots:[],birth:false});
  return {game,room,templateId:design.templateId};
}

test("네 종족 모두 둥지 단계별 생존 한도 10·20·30·40을 탄생 중 개체까지 센다", () => {
  assert.deepEqual(NEST_LEVELS.map(level => level.unitCapacity),[10,20,30,40]);
  for (const tribe of ["bean","spore","pebble","spring"]) for (const level of [1,2,3,4]) {
    const cap = NEST_LEVELS[level-1].unitCapacity, {game,templateId} = fixture(tribe,level,cap-1);
    const result = game.command({type:"birth",templateId});
    assert.ok(game.agents.find(agent => agent.id === result.agentId).birth);
    assert.equal(game.agents.length,cap); assert.equal(game.snapshot().unitCapacity,cap);
    const points = game.snapshot().evolutionPoints;
    assert.throws(() => game.command({type:"birth",templateId}),/한도/);
    assert.throws(() => game.command({type:"birth",agentId:game.agents[0].id}),/한도/);
    assert.equal(game.snapshot().evolutionPoints,points);
  }
});

test("둥지 성장 즉시 한도가 늘고 기존 초과 저장은 죽이지 않고 신규 탄생만 막는다", () => {
  const {game,templateId} = fixture("bean",1,12);
  assert.equal(game.agents.length,12);
  assert.throws(() => game.command({type:"birth",templateId}),/한도/);
  game.command({type:"upgrade"});
  assert.equal(game.snapshot().unitCapacity,20);
  assert.ok(game.command({type:"birth",templateId}).agentId);
  const clone = fixture("spring",4,43);
  clone.room.hostId = "human";
  assert.equal(clone.game.produce(),null);
  assert.equal(clone.game.agents.length,43);
  const state = JSON.parse(clone.game.save()).state;
  assert.equal(tribeProductionTemplate(state,"spring"),null);
});

test("시간 경과는 자연사를 만들지 않고 구버전 건물·변태·수명 상태는 저장에서 제거한다", () => {
  const {game} = fixture("bean",2,1), saved = JSON.parse(game.save());
  Object.assign(saved.state,{buildings:[{id:"old",key:"outpost",health:200}],nextBuildingId:2,constructionMaterialNeeds:{tree:10},foragerMemory:{ids:["saved:0"]}});
  Object.assign(saved.state.agents[0],{lifespan:1,construction:{state:"transforming",buildingKey:"outpost"},
    mode:"transform",utility:{action:"build",target:{key:"build:old"}},appearanceAttributes:{lifespan:1,construction:1}});
  saved.state.agents[0].slots = ["lifespan","construction","strength"];
  game.restore(JSON.stringify(saved));
  game.prepare(10000); game.tick(0);
  assert.equal(game.agents.length,1); assert.ok(game.agents[0].health > 0);
  const state = JSON.parse(game.save()).state;
  for (const key of ["buildings","nextBuildingId","constructionMaterialNeeds","foragerMemory"]) assert.equal(key in state,false);
  const agent = state.agents[0];
  for (const key of ["lifespan","construction","constructionIntent","transport","transportCargo"]) assert.equal(key in agent,false);
  assert.equal("lifespan" in agent.stats,false);
  assert.deepEqual(agent.slots,["strength"]);
  assert.throws(() => game.command({type:"build",agentId:agent.id,buildingKey:"storage",x:40,y:40}),/지원하지 않는/);
  assert.equal("buildings" in game.snapshot(),false);
});
