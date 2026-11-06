import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld, WORLD_GENERATION_VERSION } from './world.mjs';
import { starterFoodAccess } from './resource-camps.mjs';
const primary={bean:'clay',spore:'tree',pebble:'pebbles',spring:'dew'};
test('new maps provide two safe level-one food nodes for every tribe after clearing',()=>{
 for(const seed of [13,413,731047,1165626204,1,2,3,4,5,42]){
  const world=generateWorld(seed);
  assert.equal(world.generationVersion,41);
  for(const camp of world.camps){const a=starterFoodAccess(world,camp,primary[camp.tribe]);assert.ok(a.nodes>=2,`${seed} ${camp.tribe}: ${JSON.stringify(a)}`);}
 }
});
test('seed 731047 no longer strands pebble workers without local food',()=>{
 const old=generateWorld(731047,39),world=generateWorld(731047);
 assert.equal(starterFoodAccess(old,old.camps.find(c=>c.tribe==='pebble'),'pebbles').nodes,0);
 assert.ok(starterFoodAccess(world,world.camps.find(c=>c.tribe==='pebble'),'pebbles').nodes>=2);
 const repeat=generateWorld(731047,WORLD_GENERATION_VERSION);
 assert.deepEqual(world.camps,repeat.camps);assert.deepEqual(world.resources,repeat.resources);
});
test('starter food ignores blocked paths, footprint resources and cleared spore trees',()=>{
 const size=21,camp={x:10,y:10,tribe:'spore'},world={size,camps:[],burrows:[],terrain:new Uint8Array(size*size).fill(4),hazards:new Uint8Array(size*size),resources:[[10,10,100,'tree'],[10,14,100,'tree'],[10,15,100,'tree'],[15,10,100,'tree'],[16,10,100,'tree']]};
 assert.equal(starterFoodAccess(world,camp,'tree').nodes,2);
 world.terrain[15*size+10]=0;assert.equal(starterFoodAccess(world,camp,'tree').nodes,1);
});
