import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTRIBUTE_DNA as M } from './dna.mjs';
import { nestUpgradeCost } from './nests.mjs';
import { PLAYER_STARTING_POINTS, startingWorkerDna } from './tribe-start.mjs';
const soldier=[{"gene":"blade","grade":2,"shape":[0,1,5],"rotation":0},{"gene":"power","grade":2,"shape":[0,0,0],"rotation":4},{"gene":"health","grade":1,"shape":[0,4],"rotation":3},{"gene":"health","grade":1,"shape":[0,4],"rotation":3},{"gene":"movement","grade":1,"shape":[0,5],"rotation":2}];
test('opening budget supports real level-two modest military without changing combat stats',()=>{
 assert.equal(PLAYER_STARTING_POINTS,30);assert.equal(M.cost(soldier),37);
 assert.equal(M.stats(soldier).health,50);
 for(const tribe of ['bean','spore','pebble','spring']){
  assert.equal(M.cost(startingWorkerDna(tribe).pieces),26);
  assert.equal(nestUpgradeCost(1,tribe),tribe==='pebble'?30:40);
  assert.ok(PLAYER_STARTING_POINTS<=nestUpgradeCost(1,tribe));
  const additionalIncome=26+nestUpgradeCost(1,tribe)+2*M.cost(soldier)-PLAYER_STARTING_POINTS;
  assert.equal(additionalIncome,tribe==='pebble'?100:110);
 }
});

test('capacity and gathering speed improve throughput while preserving one resource per cycle',()=>{
 const pieces=genes=>genes.map(gene=>({gene,grade:M.lookup.get(gene).grade}));
 const basic=pieces(['gather']),hauler=pieces(['gather','capacity','capacity','health']);
 assert.equal(M.cost(basic),11);assert.equal(M.stats(basic).capacity,1);assert.equal(M.stats(basic).harvest,1);
 assert.equal(M.cost(hauler),26);assert.equal(M.stats(hauler).capacity,3);assert.equal(M.stats(hauler).harvest,1);
 assert.equal(M.stats(hauler).harvestTime,3);
 const advanced=pieces(['gather','capacity','capacity','capacity','harvestSpeed']);
 assert.equal(M.stats(advanced).capacity,4);assert.equal(M.stats(advanced).harvest,1);
 assert.equal(M.stats(advanced).harvestTime,3/1.1);
 for(const tribe of ['bean','spore','pebble','spring']) {
  assert.equal(nestUpgradeCost(2,tribe),tribe==='pebble'?75:100);
  assert.equal(nestUpgradeCost(3,tribe),tribe==='pebble'?225:300);
 }
});
