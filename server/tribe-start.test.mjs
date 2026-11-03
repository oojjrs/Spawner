import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { PLAYER_STARTING_POINTS, TRIBE_STARTING_UNITS } from "./tribe-start.mjs";

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

const workerDna = {version:3,level:1,budget:30,pieces:[{gene:"gather",grade:1,rotation:0,shape:[0,0]}]};

test("네 부족 모두 시작 지원금으로 채집 DNA 일꾼 두 마리를 만들고 4P를 남긴다",()=>{
  assert.equal(PLAYER_STARTING_POINTS,30);
  for(const tribe of ["bean","spore","pebble","spring"]){
    const {game}=fixture(tribe);
    assert.equal(game.snapshot().evolutionPoints,30,tribe);
    assert.equal(game.agents.length,TRIBE_STARTING_UNITS[tribe].length,tribe);
    const {templateId}=game.command({type:"design",templateId:null,name:"채집 DNA",dna:workerDna,birth:false});
    assert.equal(game.snapshot().evolutionPoints,30,tribe);
    for(let i=0;i<2;i++){
      const {agentId}=game.command({type:"birth",templateId});
      assert.equal(game.agents.find(agent=>agent.id===agentId).cost,13,tribe);
    }
    assert.equal(game.snapshot().evolutionPoints,4,tribe);
    assert.throws(()=>game.command({type:"birth",templateId}));
    assert.equal(game.snapshot().evolutionPoints,4,tribe);
  }
});

test("기존 플레이어 저장에는 진행을 보존하면서 한 번만 30P를 지급한다",()=>{
  const {game,environment,colony}=fixture();
  game.command({type:"design",templateId:null,name:"보존할 설계",dna:workerDna,birth:false});
  const legacy=JSON.parse(game.save());
  delete legacy.state.startingPointsGranted;
  legacy.state.evolutionPoints=7;legacy.state.simSeconds=123;
  legacy.state.agents[0].health-=2;
  const restored=createGame(environment,colony,JSON.stringify(legacy));
  assert.equal(restored.snapshot().evolutionPoints,37);
  assert.equal(restored.snapshot().simSeconds,123);
  assert.deepEqual(restored.agents.map(agent=>agent.id),legacy.state.agents.map(agent=>agent.id));
  assert.equal(restored.agents[0].health,legacy.state.agents[0].health);
  assert.equal(restored.snapshot().templates[0].name,"보존할 설계");
  const saved=restored.save();
  assert.equal(JSON.parse(saved).state.startingPointsGranted,true);
  assert.equal(createGame(environment,colony,saved).snapshot().evolutionPoints,37);
  restored.restore(saved);assert.equal(restored.snapshot().evolutionPoints,37);
  game.restore(JSON.stringify(legacy));assert.equal(game.snapshot().evolutionPoints,37);
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
