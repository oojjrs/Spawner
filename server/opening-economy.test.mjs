import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTRIBUTE_DNA as M } from './dna.mjs';
import { nestUpgradeCost } from './nests.mjs';
import { PLAYER_STARTING_POINTS, startingWorkerDna } from './tribe-start.mjs';
const soldier=[{"gene":"blade","grade":2,"shape":[0,1,5],"rotation":0},{"gene":"power","grade":2,"shape":[0,0,0],"rotation":4},{"gene":"health","grade":1,"shape":[0,4],"rotation":3},{"gene":"health","grade":1,"shape":[0,4],"rotation":3},{"gene":"movement","grade":1,"shape":[0,5],"rotation":2}];
test('opening budget supports real level-two modest military without changing combat stats',()=>{
 assert.equal(PLAYER_STARTING_POINTS,50);assert.equal(M.cost(soldier),23);
 assert.equal(M.stats(soldier).health,30);
 for(const tribe of ['bean','spore','pebble','spring']){
  assert.equal(M.cost(startingWorkerDna(tribe).pieces),17);
  assert.equal(nestUpgradeCost(1,tribe),tribe==='pebble'?15:20);
  const additionalIncome=17+nestUpgradeCost(1,tribe)+2*M.cost(soldier)-PLAYER_STARTING_POINTS;
  assert.equal(additionalIncome,tribe==='pebble'?28:33);
 }
});
