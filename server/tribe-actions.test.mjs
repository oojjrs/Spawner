import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { tribeProductionTemplate } from "./tribe-production.mjs";
import { birthCost, attributeUpgradeCost } from "./attributes.mjs";
import { NEST_LEVELS, nestUpgradeCost } from "./nests.mjs";
import { CONQUEST_PACING } from "./conquest-pacing.mjs";
import { tickRoom } from "../client/room.mjs";

function fixture(tribe, at) {
  if (at === undefined) at = 0;
  const size = 80, colony = {id:1,ownerId:"ai",tribe,name:"AI",x:20,y:20,
    occupiedCells:new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"])};
  const room = {hostId:"human",simSeconds:at,revision:0,beginnerHelpEnabled:false,
    world:{seed:13,size,generationVersion:36,burrows:[],terrain:new Uint8Array(size*size).fill(4),hazards:new Uint8Array(size*size),treeCells:new Uint8Array(size*size)},
    colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map(),creatureSystem:{agents:[],tick(){}}};
  const game = createGame(room,colony);
  room.games.set("ai",game);
  return {game,room,colony};
}

function change(game, update) {
  const saved = JSON.parse(game.save());
  update(saved.state);
  game.restore(JSON.stringify(saved));
}

for (const tribe of ["bean","spore","pebble","spring"]) {
  test(tribe + " 모든 둥지 단계에서 시간 제한과 추가 예비금 없이 플레이어와 같은 비용으로 성장한다", () => {
    for (const level of [1,2,3]) for (const at of [0,1500]) {
      const {game} = fixture(tribe,at), cost = nestUpgradeCost(level,tribe);
      change(game,state => {state.nestLevel=level;state.nestHealth=NEST_LEVELS[level-1].health;state.evolutionPoints=cost;});
      const count = game.agents.length;
      assert.equal(game.produce(),null);
      assert.equal(game.nestLevel,level+1);
      assert.equal(game.snapshot().evolutionPoints,0);
      assert.equal(game.agents.length,count);
      assert.equal(game.produce(),null);
      assert.equal(game.nestLevel,level+1);
    }
  });
}

test("200개체와 막힌 탄생 공간은 생산만 제한하며 둥지 성장을 막지 않는다", () => {
  for (const condition of ["limit","expiring-limit","blocked"]) {
    const {game,room} = fixture("bean");
    change(game,state => {
      state.evolutionPoints=20;
      if (condition !== "blocked") {
        state.agents=Array.from({length:200},(_,index)=>({...structuredClone(state.agents[0]),id:"1:"+(index+1)}));
        state.nextAgentId=201;
        if (condition === "expiring-limit") for (const agent of state.agents) agent.lifespan=1;
      }
    });
    if (condition === "blocked") room.world.terrain.fill(0);
    game.produce();
    assert.equal(game.nestLevel,2,condition);
    assert.equal(game.snapshot().evolutionPoints,0,condition);
  }
});

test("전멸한 군락은 성장보다 실제 비용을 지불한 재생산을 우선한다", () => {
  const {game} = fixture("pebble");
  change(game,state => {state.agents=[];state.evolutionPoints=15;});
  const id=game.produce(), agent=game.agents.find(candidate=>candidate.id===id);
  assert.ok(agent?.birth);
  assert.equal(game.nestLevel,1);
  assert.equal(game.snapshot().evolutionPoints,15-birthCost(agent,"pebble"));
});

test("본둥지 출입구가 막혀도 살아 있는 전초둥지에서 정상 비용으로 생산한다", () => {
  const {game,room} = fixture("bean");
  change(game,state => {
    state.nestLevel=2;state.nestHealth=200;state.evolutionPoints=30;state.agents=[];
    state.buildings=[{id:"outpost",key:"outpost",x:50,y:50,health:200}];
  });
  for(let y=17;y<28;y++)for(let x=17;x<28;x++)room.world.terrain[y*80+x]=0;
  const id=game.produce(), agent=game.agents.find(candidate=>candidate.id===id);
  assert.equal(agent?.birth?.buildingId,"outpost");
  assert.ok(agent.x>=49&&agent.x<=53&&agent.y>=49&&agent.y<=53);
  assert.equal(game.snapshot().evolutionPoints,30-birthCost(agent,"bean"));
});

test("생존 개체의 복제로 초기 설계를 저장하고 탄생 단계와 소유권을 유지한다", () => {
  const {game} = fixture("spore");
  change(game,state => {state.agents=state.agents.filter(agent=>agent.slots.includes("blade"));state.evolutionPoints=10;});
  const source=game.agents[0], id=game.produce(), agent=game.agents.find(candidate=>candidate.id===id);
  assert.ok(agent?.birth);
  assert.deepEqual(agent.slots,source.slots);
  assert.equal(agent.ownerId,"ai");
  const template=game.snapshot().templates.find(candidate=>candidate.id===agent.templateId);
  assert.equal(template.automatic,true);
  assert.equal(template.productionRole,"worker");
});

test("둥지 성장 후 AI 소유 설계를 재설계하고 플레이어 설계를 보존한다", () => {
  const {game} = fixture("bean",60);
  change(game,state => {
    state.nestLevel=2;state.evolutionPoints=30;state.foodIncomeStartedAt=0;state.foodIncome=[[55,60]];
    state.templates=[{id:1,name:"AI",slots:["excavation"],attributeLevels:{excavation:1},revision:1,productionRole:"worker",automatic:true},
      {id:2,name:"Player",slots:["antenna"],attributeLevels:{antenna:1},revision:1}];
    state.nextTemplateId=3;
  });
  const player=game.snapshot().templates.find(template=>template.id===2);
  const id=game.produce(), after=game.snapshot(), design=after.templates.find(template=>template.id===1);
  assert.ok(id);
  assert.deepEqual(design.slots,["excavation","strength"]);
  assert.equal(design.revision,2);
  assert.equal(design.automatic,true);
  assert.deepEqual(after.templates.find(template=>template.id===2),player);
  assert.equal(after.evolutionPoints,30-birthCost(game.agents.find(agent=>agent.id===id),"bean"));
});

test("설계가 가득 차면 미사용 AI 설계만 정리하고 플레이어 설계는 유지한다", () => {
  const {game} = fixture("bean");
  change(game,state => {
    state.agents=[];state.evolutionPoints=10;
    state.templates=Array.from({length:100},(_,index)=>({id:index+1,name:"Design "+index,slots:["antenna"],attributeLevels:{antenna:1},revision:1,
      ...(index===99?{automatic:true,productionRole:"scout"}:{})}));
    state.nextTemplateId=101;
  });
  const id=game.produce(), after=game.snapshot();
  assert.ok(id);
  assert.equal(after.templates.length,100);
  for(let index=1;index<=99;index++)assert.ok(after.templates.some(template=>template.id===index));
  assert.ok(!after.templates.some(template=>template.id===100));
});

test("완공할 수명이 남지 않은 변태는 정상 취소 명령으로 중단한다", () => {
  const {game} = fixture("bean",100);
  change(game,state => {
    state.evolutionPoints=0;
    const builder=state.agents[0];
    Object.assign(builder,{slots:["construction"],attributeLevels:{construction:1},bornAt:0,lifespan:101,birth:null,
      construction:{buildingKey:"storage",x:30,y:30,state:"moving",orderedAt:90,route:[{x:20,y:20},{x:30,y:30}],routeIndex:0,progress:0}});
  });
  game.produce();
  assert.equal(game.agents[0].construction,null);
  assert.equal(game.agents[0].constructionRetryAt,105);
  assert.equal(game.snapshot().evolutionPoints,0);
});

test("AI는 알림 확인과 이름 복구에도 같은 관리 명령과 소유권 검사를 적용한다", () => {
  const {game,colony} = fixture("bean");
  change(game,state => {
    state.evolutionPoints=0;state.discoveries=[{key:"test",name:"test"}];state.discoveryReadCount=0;
    state.agents[0].automatic=true;state.agents[0].name="";
  });
  colony.name="";
  game.produce();
  assert.equal(game.snapshot().discoveryReadCount,1);
  assert.ok(game.agents[0].name.trim());
  assert.ok(colony.name.trim());
  assert.throws(()=>game.command({type:"rename-colony",colonyId:2,name:"Other"}),/자신의 둥지/);
});

test("정찰 개체가 사라지면 정찰 설계를 보충하고 군사는 공격과 지원 조합을 모두 선택한다", () => {
  const {game} = fixture("bean",500);
  change(game,state => {
    state.nestLevel=4;state.evolutionPoints=100;state.foodIncomeStartedAt=0;state.foodIncome=[[490,100]];
    state.agents=state.agents.filter(agent=>!agent.slots.includes("antenna"));
    state.agents=Array.from({length:12},(_,index)=>({...structuredClone(state.agents[index%state.agents.length]),id:"1:"+(index+1),bornAt:450,productionRole:"worker"}));
  });
  const state=JSON.parse(game.save()).state;
  assert.equal(tribeProductionTemplate(state,"bean").productionRole,"scout");
  state.agents[0].slots=["antenna","feet"];
  const military=tribeProductionTemplate(state,"bean");
  assert.equal(military.productionRole,"military");
  state.agents.push({id:"soldier",health:100,slots:military.slots,productionRole:"military",bornAt:450,lifespan:360});
  const next=tribeProductionTemplate(state,"bean");
  assert.ok(next.slots.includes("piercing")||next.slots.includes("regeneration")||next.slots.includes("guard"));
  assert.notDeepEqual(next.slots,military.slots);
});

test("플레이어에게 비활성화된 속성 강화는 AI도 비용을 차감하거나 예외를 내지 않는다", () => {
  const {game} = fixture("bean",500);
  change(game,state => {
    state.nestLevel=4;state.evolutionPoints=0;state.buildings=[{id:"lab",key:"evolution-lab",x:40,y:40,health:100}];
    state.templates=[{id:1,name:"Design",slots:["strength"],attributeLevels:{strength:1},revision:1}];
  });
  assert.equal(attributeUpgradeCost("strength",2),null);
  assert.doesNotThrow(()=>game.produce());
  assert.equal(game.snapshot().evolutionPoints,0);
  assert.equal(game.snapshot().templates[0].attributeLevels.strength,1);
});

test("실제 방 틱에서도 비용을 모은 AI만 순서대로 4레벨까지 성장한다", () => {
  const {game,room,colony} = fixture("pebble");
  const human = {...colony,id:2,ownerId:"human",tribe:"bean",name:"Human",x:50,y:20};
  room.colonies.push(human);
  const player = createGame(room,human);
  room.games.set("human",player);
  for (const level of [1,2,3]) {
    change(game,state=>{state.evolutionPoints=nestUpgradeCost(level,"pebble");});
    tickRoom(room,CONQUEST_PACING.productionInterval);
    assert.equal(game.nestLevel,level+1);
    assert.equal(game.snapshot().evolutionPoints,0);
    assert.equal(player.nestLevel,1);
    assert.equal(player.snapshot().evolutionPoints,0);
  }
});

test("플레이어와 동일하게 1레벨에서도 필요한 창고의 변태 개체를 생산한다", () => {
  const {game} = fixture("bean",60);
  change(game,state=>{
    state.evolutionPoints=19;state.resourceInventory={clay:30};delete state.resourceStores;
    state.explored={collection:"Set",entries:[]};
    for(let y=14;y<35;y++)for(let x=14;x<35;x++)state.explored.entries.push(y*80+x);
  });
  const id=game.produce(), builder=game.agents.find(agent=>agent.id===id);
  assert.ok(builder?.slots.includes("construction"));
  assert.equal(builder.productionRole,"builder");
  assert.equal(game.nestLevel,1);
  assert.equal(game.snapshot().evolutionPoints,19-birthCost(builder,"bean"));
});
