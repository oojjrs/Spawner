import test from "node:test";
import assert from "node:assert/strict";
import {createGame} from "./game.mjs";
import {constructionHelpTemplate} from "./beginner-help.mjs";
import {TRIBE_STARTING_UNITS} from "./tribe-start.mjs";
import {CONQUEST_PACING,TRIBE_PACING} from "./conquest-pacing.mjs";

function fixture(tribe, simSeconds) {
  if (simSeconds === undefined) simSeconds = 0;
  const colony={id:1,ownerId:"host",tribe,x:40,y:40,occupiedCells:new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"])};
  const environment={hostId:"host",beginnerHelpEnabled:true,simSeconds,world:{seed:13,generationVersion:33,
    terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,colony);environment.games.set("host",game);return {game,environment};
}

for(const tribe of ["bean","spore","pebble","spring"])test(tribe+" 초기 자원 0에서 해금 전 준비 안내가 나와도 비용과 현재 단계 없이 생산하지 않는다",()=>{
  const {game}=fixture(tribe),before=game.snapshot();
  assert.equal(before.evolutionPoints,0);assert.deepEqual(before.resourceInventory,{});
  assert.equal(before.agents.length,TRIBE_STARTING_UNITS[tribe].length);
  assert.ok(!before.constructionHelp || before.constructionHelp.kind !== "construction" && !before.constructionHelp.canProduce);
  assert.deepEqual(game.command({type:"beginner-construction",expectedBuildingKey:"watchpost",expectedStep:"arbitrary"}),{});
  assert.equal(game.snapshot().templates.length,0);assert.equal(game.agents.length,before.agents.length);
});

test("도움말을 끈 방과 다른 군락은 안내 생산을 실행할 수 없다",()=>{
  const {game,environment}=fixture("bean");environment.beginnerHelpEnabled=false;
  assert.throws(()=>game.command({type:"beginner-construction"}),/지원하지 않는 요청/);
  environment.beginnerHelpEnabled=true;environment.hostId="other";
  assert.throws(()=>game.command({type:"beginner-construction"}),/지원하지 않는 요청/);
});

test("이전 생산 기록을 복원해도 실제 완공 기록으로 취급하지 않는다",()=>{
  const {game}=fixture("bean"),saved=JSON.parse(game.save());
  saved.state.constructionHelpResult={templateId:1,agentId:game.agents[0].id,step:"past-step",kind:"harvest"};
  delete saved.state.constructionHelpBuildings;game.restore(JSON.stringify(saved));
  assert.deepEqual(JSON.parse(game.save()).state.constructionHelpBuildings,[]);
  const before=game.snapshot();
  assert.deepEqual(game.command({type:"beginner-construction",expectedStep:"past-step"}),saved.state.constructionHelpResult);
  assert.equal(game.agents.length,before.agents.length);assert.equal(game.snapshot().evolutionPoints,before.evolutionPoints);
});

test("완공 종류 기록은 저장과 복원에서 유지하며 잘못된 종류를 제거한다",()=>{
  const {game}=fixture("pebble"),saved=JSON.parse(game.save());saved.state.constructionHelpBuildings=["storage","unknown"];
  game.restore(JSON.stringify(saved));assert.deepEqual(JSON.parse(game.save()).state.constructionHelpBuildings,["storage"]);
});

test("안내 생산은 준비 계산에 쓴 첫 둥지에서 태어나며 무작위 다른 전초둥지로 흩어지지 않는다",()=>{const {game}=fixture("bean",CONQUEST_PACING.guidanceAt*TRIBE_PACING.bean.tempo),saved=JSON.parse(game.save());saved.state.nestLevel=3;saved.state.nestHealth=0;saved.state.evolutionPoints=100;saved.state.buildings=[{id:"first",key:"outpost",x:45,y:45,width:3,height:3,health:200},{id:"second",key:"outpost",x:90,y:90,width:3,height:3,health:200}];saved.state.agents=saved.state.agents.slice(0,1);Object.assign(saved.state.agents[0],{x:50,y:47});saved.state.explored={collection:"Set",entries:[]};for(let y=35;y<105;y++)for(let x=35;x<105;x++)saved.state.explored.entries.push(y*320+x);game.restore(JSON.stringify(saved));const previous=Math.random;Math.random=()=>.999;try{const offer=game.snapshot().constructionHelp;assert.ok(offer?.canProduce);const result=game.command({type:"beginner-construction",expectedBuildingKey:offer.buildingKey,expectedStep:offer.step});const agent=game.agents.find(agent=>agent.id===result.agentId);assert.ok(agent.x>=44&&agent.x<=48&&agent.y>=44&&agent.y<=48);}finally{Math.random=previous;}});

test("운반 개체의 탄생이 끝나면 필요한 다음 생산을 불필요한 15초 대기로 막지 않는다",()=>{const {game,environment}=fixture("bean",CONQUEST_PACING.guidanceAt*TRIBE_PACING.bean.tempo),saved=JSON.parse(game.save());saved.state.simSeconds=environment.simSeconds+30;saved.state.nestLevel=2;saved.state.nestHealth=200;saved.state.evolutionPoints=79;saved.state.resourceInventory={clay:10};delete saved.state.resourceStores;saved.state.agents=saved.state.agents.slice(0,2);const [builder,worker]=saved.state.agents;Object.assign(builder,{x:74,y:41,bornAt:environment.simSeconds,lifespan:100,slots:["construction"],attributeLevels:{construction:1},attributes:{construction:1},birth:null,construction:{buildingKey:"storage",x:74,y:41,state:"transforming",orderedAt:environment.simSeconds,startedAt:environment.simSeconds,supplyVersion:1,id:"active",route:[{x:74,y:41}],routeIndex:0,readyAt:environment.simSeconds+15,required:{clay:10},delivered:{},consumed:{},progress:0,stage:1}});Object.assign(worker,{x:44,y:40,bornAt:environment.simSeconds+25,slots:["strength","feet"],attributeLevels:{strength:1,feet:1},attributes:{strength:1,feet:1},birth:null});saved.state.constructionHelpResult={kind:"transport",agentId:worker.id,step:"completed",producedAt:environment.simSeconds+25};saved.state.explored={collection:"Set",entries:[]};for(let y=30;y<90;y++)for(let x=30;x<90;x++)saved.state.explored.entries.push(y*320+x);environment.simSeconds=saved.state.simSeconds;game.restore(JSON.stringify(saved));const offer=game.snapshot().constructionHelp;assert.equal(offer?.kind,"transport");assert.equal(offer.canProduce,true);const result=game.command({type:"beginner-construction",expectedBuildingKey:offer.buildingKey,expectedStep:offer.step});assert.ok(result.agentId);assert.notEqual(result.agentId,worker.id);assert.deepEqual(game.agents.find(agent=>agent.id===result.agentId).slots,[]);assert.notEqual(game.snapshot().constructionHelp?.kind,"transport");});

test("전초둥지와 포인트가 남았으면 개체가 없어도 채집 재생산을 안내하고 정상 비용으로 탄생시킨다",()=>{const {game}=fixture("pebble",CONQUEST_PACING.guidanceAt*TRIBE_PACING.pebble.tempo),saved=JSON.parse(game.save());saved.state.nestLevel=2;saved.state.nestHealth=0;saved.state.evolutionPoints=18;saved.state.agents=[];saved.state.buildings=[{id:"refuge",key:"outpost",x:45,y:45,width:3,height:3,health:200}];saved.state.explored={collection:"Set",entries:[]};for(let y=30;y<75;y++)for(let x=30;x<75;x++)saved.state.explored.entries.push(y*320+x);game.restore(JSON.stringify(saved));const offer=game.snapshot().constructionHelp;assert.equal(offer?.kind,"harvest");assert.ok(offer.canProduce);const result=game.command({type:"beginner-construction",expectedBuildingKey:offer.buildingKey,expectedStep:offer.step});assert.ok(result.agentId);assert.equal(game.agents.length,1);assert.deepEqual(game.agents[0].slots,offer.slots);assert.equal(game.snapshot().evolutionPoints,18-offer.cost);});

for (const [tribe, costs] of [["bean", [20,80,360]], ["spore", [20,80,360]], ["pebble", [15,60,270]], ["spring", [20,80,360]]]) {
  test(tribe + " 성장 비용이 모이면 대기 시간 없이 안내하고 같은 비용으로 한 단계만 성장한다", () => {
    for (const [index, cost] of costs.entries()) {
      const {game} = fixture(tribe), saved = JSON.parse(game.save());
      saved.state.nestLevel = index + 1;
      saved.state.nestHealth = [100,200,400][index];
      saved.state.evolutionPoints = cost - .1;
      game.restore(JSON.stringify(saved));
      assert.notEqual(game.snapshot().constructionHelp?.kind, "upgrade");
      saved.state.evolutionPoints = cost;
      game.restore(JSON.stringify(saved));
      const before = game.snapshot(), offer = before.constructionHelp;
      assert.equal(offer?.kind, "upgrade");
      assert.equal(offer.cost, cost);
      assert.equal(offer.level, index + 2);
      const action = {type:"beginner-construction",expectedBuildingKey:offer.buildingKey,expectedStep:offer.step};
      const result = game.command(action), after = game.snapshot();
      assert.equal(result.nestLevel, index + 2);
      assert.equal(after.nestLevel, index + 2);
      assert.equal(after.evolutionPoints, 0);
      assert.deepEqual(after.agents, before.agents);
      assert.deepEqual(after.templates, before.templates);
      assert.deepEqual(game.command(action), {});
      assert.equal(game.snapshot().nestLevel, index + 2);
    }
  });
}

test("군사 안내 시점에도 가능한 둥지 성장을 먼저 표시하고 오래된 안내로 생산하지 않는다", () => {
  const {game} = fixture("bean", 400), saved = JSON.parse(game.save());
  saved.state.nestLevel = 2;
  saved.state.nestHealth = 200;
  saved.state.evolutionPoints = 80;
  game.restore(JSON.stringify(saved));
  const offer = game.snapshot().constructionHelp;
  assert.equal(offer?.kind, "upgrade");
  saved.state.evolutionPoints = 10;
  game.restore(JSON.stringify(saved));
  const before = game.snapshot();
  assert.deepEqual(game.command({type:"beginner-construction",expectedBuildingKey:offer.buildingKey,expectedStep:offer.step}), {});
  const after = game.snapshot();
  for (const key of ["evolutionPoints", "nestLevel", "agents", "templates"]) assert.deepEqual(after[key], before[key]);
});

test("성장 안내는 최고 레벨과 파괴·종료·비선택·도움말 해제 상태에 표시하지 않는다", () => {
  for (const condition of ["maximum", "destroyed", "ended", "other", "disabled"]) {
    const {game, environment} = fixture("bean"), saved = JSON.parse(game.save());
    saved.state.evolutionPoints = 100;
    if (condition === "maximum") saved.state.nestLevel = 4;
    if (condition === "destroyed") saved.state.nestHealth = 0;
    if (condition === "ended") saved.state.ending = {endedAt:0,reason:"extinction"};
    game.restore(JSON.stringify(saved));
    if (condition === "other") environment.hostId = "other";
    if (condition === "disabled") environment.beginnerHelpEnabled = false;
    assert.notEqual(game.snapshot().constructionHelp?.kind, "upgrade", condition);
  }
});

for (const tribe of ["bean", "spore", "pebble", "spring"]) test(tribe + " 군사 안내는 내부 분류 대신 실제 전투 속성과 보유 수를 확인한다", () => {
  for (const count of [1, 12]) for (const productionRole of ["worker", "military", null]) {
    const {game} = fixture(tribe, 400), saved = JSON.parse(game.save());
    Object.assign(saved.state, {nestLevel:2, nestHealth:200, evolutionPoints:10});
    const base = saved.state.agents[0];
    saved.state.agents = Array.from({length:count}, (_, index) => ({...base, id:"1:" + (index + 1),
      slots:["blade", "feet"], attributeLevels:{blade:1, feet:1}, productionRole, health:100, birth:null, construction:null}));
    game.restore(JSON.stringify(saved));
    assert.notEqual(game.snapshot().constructionHelp?.kind, "military", count + ":" + productionRole);
  }
});

test("군사 분류나 과거 생산 기록만 있고 전투 속성 개체가 없으면 현재 부족을 안내한다", () => {
  const {game} = fixture("bean", 400), saved = JSON.parse(game.save());
  Object.assign(saved.state, {nestLevel:2, nestHealth:200, evolutionPoints:10, militaryGuidanceCompleted:true});
  saved.state.agents = saved.state.agents.slice(0,1);
  Object.assign(saved.state.agents[0], {slots:["feet"], attributeLevels:{feet:1}, productionRole:"military", birth:null});
  game.restore(JSON.stringify(saved));
  const offer = game.snapshot().constructionHelp;
  assert.equal(offer?.kind, "military");
  assert.deepEqual(offer.slots, ["blade"]);
  assert.deepEqual(offer.attributes, ["칼날"]);
  const before = game.snapshot().evolutionPoints;
  const result = game.command({type:"beginner-construction", expectedBuildingKey:offer.buildingKey, expectedStep:offer.step});
  assert.deepEqual(game.agents.find(agent => agent.id === result.agentId).slots, ["blade"]);
  assert.equal(game.snapshot().evolutionPoints, before - offer.cost);
});

test("사망 개체와 건물로 변태할 개체는 방어 전력 수에 포함하지 않는다", () => {
  for (const condition of ["dead", "construction"]) {
    const {game} = fixture("bean", 400), saved = JSON.parse(game.save());
    Object.assign(saved.state, {nestLevel:2, nestHealth:200, evolutionPoints:10});
    saved.state.agents = saved.state.agents.slice(0,1);
    Object.assign(saved.state.agents[0], {slots:condition === "dead" ? ["blade"] : ["blade", "construction"],
      attributeLevels:{blade:1, construction:1}, health:condition === "dead" ? 0 : 100, birth:null});
    game.restore(JSON.stringify(saved));
    assert.equal(game.snapshot().constructionHelp?.kind, "military", condition);
  }
});

test("보유 전투 개체로 부족이 해소되면 이전 군사 안내로 추가 생산하지 않는다", () => {
  const {game} = fixture("bean", 400), saved = JSON.parse(game.save());
  Object.assign(saved.state, {nestLevel:2, nestHealth:200, evolutionPoints:10});
  game.restore(JSON.stringify(saved));
  const offer = game.snapshot().constructionHelp;
  assert.equal(offer?.kind, "military");
  Object.assign(saved.state.agents[0], {slots:["blade", "feet"], attributeLevels:{blade:1, feet:1}, productionRole:"worker"});
  game.restore(JSON.stringify(saved));
  const before = game.snapshot();
  assert.deepEqual(game.command({type:"beginner-construction", expectedBuildingKey:offer.buildingKey, expectedStep:offer.step}), {});
  const after = game.snapshot();
  assert.equal(after.evolutionPoints, before.evolutionPoints);
  assert.equal(after.agents.length, before.agents.length);
});

test("군사 안내는 필수 전투 속성의 기존 설계도를 내부 분류와 관계없이 재사용한다", () => {
  const template = {id:7, name:"전사", slots:["blade"], productionRole:"worker"};
  const custom = {id:8, name:"날쌘 전사", slots:["blade", "feet", "lifespan"], productionRole:"military"};
  const state = {tribe:"spore", nestLevel:3, templates:[custom, template], nextTemplateId:9};
  assert.equal(constructionHelpTemplate(state, ["blade", "feet"], "military"), template);
  state.templates = [custom];
  const fresh = constructionHelpTemplate(state, ["blade", "feet", "lifespan"], "military");
  assert.deepEqual(fresh.slots, ["blade"]);
  assert.notEqual(fresh, custom);
  assert.deepEqual(custom.slots, ["blade", "feet", "lifespan"]);
});
