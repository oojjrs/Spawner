import test from "node:test";
import assert from "node:assert/strict";
import { dnaUnitStats, validateDna } from "./dna-unit.mjs";
import { createGame } from "./game.mjs";
import { PLAYER_STARTING_POINTS, TRIBE_STARTING_UNITS, startingWorkerDna } from "./tribe-start.mjs";
import { NEST_LEVELS, nestUpgradeCost } from "./nests.mjs";

function fixture(tribe = "bean", player = true) {
  const colony = { id:1, ownerId:player ? "player" : "rival", tribe, x:40, y:40,
    occupiedCells:new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"]) };
  const environment = { hostId:"player", simSeconds:0,
    world:{ seed:13, terrain:new Uint8Array(320*320).fill(4), hazards:new Uint8Array(320*320) },
    colonies:[colony], games:new Map(), food:new Map(), foodSpots:new Map() };
  const game = createGame(environment,colony);
  environment.games.set(colony.ownerId,game);
  return {game,environment,colony};
}

const workerDna = {...startingWorkerDna(),pieces:startingWorkerDna().pieces.slice(0,1)};

test("네 부족 모두 시작 지원금으로 채집 DNA 일꾼 여섯 마리를 만들고 2P를 남긴다",()=>{
  assert.equal(PLAYER_STARTING_POINTS,50);
  for(const tribe of ["bean","spore","pebble","spring"]){
    const {game}=fixture(tribe);
    assert.equal(game.snapshot().evolutionPoints,50,tribe);
    assert.equal(game.agents.length,TRIBE_STARTING_UNITS[tribe].length,tribe);
    const {templateId}=game.command({type:"design",templateId:null,name:"채집 DNA",dna:workerDna,birth:false});
    assert.equal(game.snapshot().evolutionPoints,50,tribe);
    for(let i=0;i<6;i++){
      const {agentId}=game.command({type:"birth",templateId});
      assert.equal(game.agents.find(agent=>agent.id===agentId).cost,8,tribe);
    }
    assert.equal(game.snapshot().evolutionPoints,2,tribe);
    assert.throws(()=>game.command({type:"birth",templateId}));
    assert.equal(game.snapshot().evolutionPoints,2,tribe);
  }
});

test("기존 플레이어 저장에는 진행을 보존하면서 한 번만 50P를 지급한다",()=>{
  const {game,environment,colony}=fixture();
  game.command({type:"design",templateId:null,name:"보존할 설계",dna:workerDna,birth:false});
  const legacy=JSON.parse(game.save());
  delete legacy.state.startingPointsGranted;
  legacy.state.evolutionPoints=7;legacy.state.simSeconds=123;
  legacy.state.agents[0].health-=2;
  const restored=createGame(environment,colony,JSON.stringify(legacy));
  assert.equal(restored.snapshot().evolutionPoints,57);
  assert.equal(restored.snapshot().simSeconds,123);
  assert.deepEqual(restored.agents.map(agent=>agent.id),legacy.state.agents.map(agent=>agent.id));
  assert.equal(restored.agents[0].health,legacy.state.agents[0].health);
  assert.equal(restored.snapshot().templates[0].name,"보존할 설계");
  const saved=restored.save();
  assert.equal(JSON.parse(saved).state.startingPointsGranted,true);
  assert.equal(createGame(environment,colony,saved).snapshot().evolutionPoints,57);
  restored.restore(saved);assert.equal(restored.snapshot().evolutionPoints,57);
  game.restore(JSON.stringify(legacy));assert.equal(game.snapshot().evolutionPoints,57);
});

test("지원금을 쓴 뒤 재접속해도 다시 지급하지 않는다",()=>{
  const {game,environment,colony}=fixture();
  const saved=JSON.parse(game.save());saved.state.evolutionPoints=0;
  const restored=createGame(environment,colony,JSON.stringify(saved));
  assert.equal(restored.snapshot().evolutionPoints,0);
  restored.restore(restored.save());assert.equal(restored.snapshot().evolutionPoints,0);
});

test("AI 부족에는 새 게임과 기존 저장 모두 지원금을 지급하지 않는다",()=>{
  const {game,environment,colony}=fixture("bean",false);
  assert.equal(game.snapshot().evolutionPoints,0);
  const legacy=JSON.parse(game.save());delete legacy.state.startingPointsGranted;legacy.state.evolutionPoints=7;
  assert.equal(createGame(environment,colony,JSON.stringify(legacy)).snapshot().evolutionPoints,7);
});

test("초반 둥지 성장은 지원금으로 선택 가능하고 이후 비용은 보관한도 안에 있다",()=>{
  for(const tribe of ["bean","spore","pebble","spring"]){
    const {game}=fixture(tribe,true);
    assert.equal(game.snapshot().evolutionPoints,PLAYER_STARTING_POINTS,tribe);
    assert.ok(nestUpgradeCost(1,tribe)<PLAYER_STARTING_POINTS,tribe);
    game.command({type:"upgrade"});
    assert.equal(game.snapshot().nestLevel,2,tribe);
    assert.equal(game.snapshot().evolutionPoints,PLAYER_STARTING_POINTS-nestUpgradeCost(1,tribe),tribe);
    for(const level of [1,2,3])assert.ok(nestUpgradeCost(level,tribe)<=NEST_LEVELS[level-1].pointCapacity,tribe+":"+level);
  }
});


test("시작 개체는 특별 능력치 없는 기본 채집 DNA이며 복제·저장에도 보존된다",()=>{
  for(const tribe of ["bean","spore","pebble","spring"]){
    const {game}=fixture(tribe);
    const dna=startingWorkerDna(tribe),stats=dnaUnitStats(dna);
    assert.ok(validateDna(dna,1,30));
    for(const agent of game.agents){
      assert.deepEqual(agent.dna,dna);
      assert.deepEqual(agent.stats.dna,stats.dna);
      assert.equal(agent.stats.vision,1);
      assert.equal(agent.stats.capacity,stats.capacity);
      assert.equal(agent.stats.dna.roaming,false);
      assert.equal(agent.stats.dna.melee,false);
      assert.equal(agent.stats.dna.ranged,false);
      assert.equal(agent.cost,17);
    }
    const source=game.agents[0];
    const {agentId}=game.command({type:"birth",agentId:source.id});
    const born=game.agents.find(agent=>agent.id===agentId);
    assert.deepEqual(born.dna,source.dna);
    assert.deepEqual(born.stats.dna,source.stats.dna);
    assert.equal(game.snapshot().evolutionPoints,33);
    const before=game.agents.map(agent=>({id:agent.id,dna:agent.dna,stats:agent.stats.dna}));
    game.restore(game.save());
    assert.deepEqual(game.agents.map(agent=>({id:agent.id,dna:agent.dna,stats:agent.stats.dna})),before);
  }
});
