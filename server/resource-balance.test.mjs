import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ATTRIBUTES, ATTRIBUTE_COMBINATIONS, ATTRIBUTE_SYNERGIES_ENABLED, attributeCounts, birthCost, hasSynergy, unitStats } from "./attributes.mjs";
import { RESOURCE_TYPES } from "./resources.mjs";
import { generateWorld } from "./world.mjs";
import { populateResourceNodes, populateForestResources } from "./resources.mjs";

const harvestSeconds = { nutrients:5, tree:6, dew:2, pebbles:6, clay:4, sand:4, "grass-fiber":4, "iron-ore":12, "copper-ore":10, quartz:16 };

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
  const prices = { bean:[3,4,5,6,7], spore:[2,2,3,4,5], pebble:[4,5,6,8,10], spring:[3,4,5,6,7] };
  for (const [tribe,expected] of Object.entries(prices)) {
    for (let count=0;count<=4;count++) assert.equal(birthCost({slots:slots.slice(0,count)},tribe),expected[count]);
  }
  assert.deepEqual(Object.fromEntries(RESOURCE_TYPES.map(resource=>[resource.key,resource.harvestSeconds])),harvestSeconds);
});

test("브라우저와 내부 워커도 시너지를 중지하고 동일한 자원 채집 시간을 사용한다", () => {
  const source = readFileSync(new URL("../client/runtime.js",import.meta.url),"utf8"),browser={};
  runInNewContext(source,browser);
  const workerSource = JSON.parse(source.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const worker = { Map,Set,Uint8Array,setTimeout,clearTimeout,performance };
  runInNewContext(workerSource.slice(0,workerSource.indexOf('modules["client/worker.mjs"]'))+
    'globalThis.rules = {...modules["server/attributes.mjs"],...modules["server/resources.mjs"]}; })();',worker);
  for (const rules of [browser.Spawner,worker.rules]) {
    assert.equal(rules.ATTRIBUTE_SYNERGIES_ENABLED,false);
    assert.equal(rules.ATTRIBUTE_COMBINATIONS.length,0);
    assert.equal(rules.hasSynergy({strength:4,antenna:4,feet:4},["strength","antenna"]),false);
    for (const [key,seconds] of Object.entries(harvestSeconds)) assert.equal(rules.resourceDefinition(key).harvestSeconds,seconds,key);
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