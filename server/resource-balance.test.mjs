import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";
import { ATTRIBUTES, ATTRIBUTE_COMBINATIONS, ATTRIBUTE_SYNERGIES_ENABLED, attributeCounts, birthCost, hasSynergy, unitStats } from "./attributes.mjs";
import { RESOURCE_TYPES } from "./resources.mjs";
import { generateWorld } from "./world.mjs";
import { populateResourceNodes, populateForestResources } from "./resources.mjs";

const harvestSeconds = { tree:6, dew:2, pebbles:6, clay:4 };

test("속성 조합 보너스는 모두 중지하고 개별 속성 효과와 생산비는 유지한다", () => {
  assert.equal(ATTRIBUTE_SYNERGIES_ENABLED, false);
  assert.deepEqual(ATTRIBUTE_COMBINATIONS, []);
  const counts = Object.fromEntries(ATTRIBUTES.map(attribute => [attribute.key,4]));
  for (const first of ATTRIBUTES) for (const second of ATTRIBUTES) {
    assert.equal(hasSynergy(counts,[first.key,second.key]), false);
  }
  assert.equal(unitStats(attributeCounts(["strength","antenna"]),"bean").capacity,2);
  assert.equal(unitStats(attributeCounts(["strength","antenna"]),"bean").vision,6);
  const slots = ["strength","antenna","feet","lifespan"];
  const prices = { bean:[3,5,8,12,17], spore:[2,3,5,8,12], pebble:[4,7,11,16,22], spring:[3,5,7,10,14] };
  for (const [tribe,expected] of Object.entries(prices)) {
    for (let count=0;count<=4;count++) assert.equal(birthCost({slots:slots.slice(0,count)},tribe),expected[count]);
  }
  assert.deepEqual(Object.fromEntries(RESOURCE_TYPES.map(resource=>[resource.key,resource.harvestSeconds])),harvestSeconds);
});

test("브라우저와 내부 워커도 속성 개수별 생산비와 자원 채집 시간을 동일하게 사용한다", () => {
  const source = readFileSync(new URL("../client/runtime.js",import.meta.url),"utf8"),browser={};
  runInNewContext(source,browser);
  const workerSource = JSON.parse(source.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const worker = { Map,Set,Uint8Array,setTimeout,clearTimeout,performance };
  runInNewContext(workerSource.slice(0,workerSource.indexOf('modules["client/worker.mjs"]'))+
    'globalThis.rules = {...modules["server/attributes.mjs"],...modules["server/resources.mjs"]}; })();',worker);
  const slots = ["strength","antenna","feet","lifespan"];
  const prices = { bean:[3,5,8,12,17], spore:[2,3,5,8,12], pebble:[4,7,11,16,22], spring:[3,5,7,10,14] };
  for (const rules of [browser.Spawner,worker.rules]) {
    for (const [tribe,expected] of Object.entries(prices)) for (let count=0;count<=4;count++) {
      assert.equal(rules.birthCost({slots:slots.slice(0,count)},tribe),expected[count],tribe + ":" + count);
    }
    assert.equal(rules.ATTRIBUTE_SYNERGIES_ENABLED,false);
    assert.equal(rules.ATTRIBUTE_COMBINATIONS.length,0);
    assert.equal(rules.hasSynergy({strength:4,antenna:4,feet:4},["strength","antenna"]),false);
    for (const [key,seconds] of Object.entries(harvestSeconds)) assert.equal(rules.resourceDefinition(key).harvestSeconds,seconds,key);
  }
});

test("새 설계와 속성을 추가한 기존 설계는 목록 가격과 실제 생산 비용을 함께 갱신한다", () => {
  for (const [tribe, one, two] of [["bean",5,8],["spore",3,5],["pebble",7,11],["spring",5,7]]) {
    const colony = { id:1, ownerId:"design-price", tribe, x:40, y:40, occupiedCells:new Set(["2,2"]) };
    const environment = { simSeconds:0, world:{ seed:13, terrain:new Uint8Array(160*160).fill(4),
      hazards:new Uint8Array(160*160) }, colonies:[colony], games:new Map(), food:new Map(), foodSpots:new Map() };
    const game = createGame(environment,colony);
    environment.games.set(colony.ownerId,game);
    const saved = JSON.parse(game.save());
    saved.state.nestLevel = 2;
    saved.state.evolutionPoints = 100;
    saved.state.agents = [];
    game.restore(JSON.stringify(saved));
    const original = game.command({type:"design",templateId:null,name:"원본",slots:["antenna"],birth:true});
    assert.equal(game.agents.find(agent=>agent.id===original.agentId).cost,one,tribe);
    game.command({type:"design",templateId:original.templateId,name:"수정",slots:["antenna","strength"],birth:false});
    const template = game.snapshot().templates.find(template=>template.id===original.templateId);
    assert.equal(birthCost(template,tribe),two,tribe);
    let before = game.snapshot().evolutionPoints;
    const copy = game.command({type:"birth",templateId:template.id});
    assert.equal(game.agents.find(agent=>agent.id===copy.agentId).cost,two,tribe);
    assert.equal(game.snapshot().evolutionPoints,before-two,tribe);
    assert.equal(game.agents.find(agent=>agent.id===original.agentId).cost,one,tribe);
    before = game.snapshot().evolutionPoints;
    const fresh = game.command({type:"design",templateId:null,name:"신규",slots:["antenna","strength"],birth:true});
    assert.equal(game.agents.find(agent=>agent.id===fresh.agentId).cost,two,tribe);
    assert.equal(game.snapshot().evolutionPoints,before-two,tribe);
    game.restore(game.save());
    assert.equal(birthCost(game.snapshot().templates.find(candidate=>candidate.id===original.templateId),tribe),two,tribe);
  }
});

test("새 맵은 포자버섯 중심 반경 4칸의 숲과 목재를 비우고 다른 배치를 보존한다", () => {
  const seed=1165626204,before=generateWorld(seed,38),after=generateWorld(seed),camp=after.camps.find(entry=>entry.tribe==="spore");
  assert.equal(after.generationVersion,39);
  assert.deepEqual(after.camps,before.camps);
  const inside=(x,y)=>(x-camp.x)**2+(y-camp.y)**2<=16;
  assert.ok(before.resources.some(([x,y,,key])=>key==="tree"&&inside(x,y)));
  assert.ok(!after.resources.some(([x,y,,key])=>key==="tree"&&inside(x,y)));
  assert.deepEqual(after.resources.filter(point=>point[3]!=="tree"),before.resources.filter(point=>point[3]!=="tree"));
  assert.deepEqual(after.resources.filter(([x,y])=>!inside(x,y)),before.resources.filter(([x,y])=>!inside(x,y)));
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
    if(dx*dx+dy*dy>16)continue;
    const index=(camp.y+dy)*after.size+camp.x+dx;
    assert.notEqual(after.terrain[index],5);
    assert.equal(after.hydrology.forestMask[index],0);
  }
  const room={world:after,food:new Map(after.food.map(([x,y,amount,resourceType])=>[x+","+y,{x,y,amount,initialAmount:amount,resourceType}]))};
  populateResourceNodes(room);populateForestResources(room);
  for(const cell of room.food.values())if(cell.resourceType==="tree")assert.equal(inside(cell.x,cell.y),false);
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
    if(dx*dx+dy*dy<=16)assert.equal(after.treeCells[(camp.y+dy)*after.size+camp.x+dx],0);
  }
});