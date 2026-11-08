import test from 'node:test';
import assert from 'node:assert/strict';
import { recordWorkerRoute } from './worker-route.mjs';
import { tribeTerrainSpeedMultiplier } from './tribe-environment.mjs';

const agent = () => ({ x: 2, y: 0, carrying: 4, returnPath: [{x:0,y:0},{x:1,y:0},{x:2,y:0}] });
test('completed route uses both travel directions and tribe terrain costs', () => {
 for (const tribe of ['bean','spore','spring']) {
  const state = {simSeconds: 60};
  recordWorkerRoute(state, agent(), cell => tribeTerrainSpeedMultiplier(tribe,cell.x === 1 ? 9 : 4));
  assert.equal(state.workerRouteSamples.length,1);
  assert.equal(state.workerRouteSamples[0].distance,1+1/tribeTerrainSpeedMultiplier(tribe,9));
  assert.equal(state.workerRouteMeasuredAt,0);
 }
});
test('uncompleted, teleporting, empty and combat routes cannot train production', () => {
 for (const changes of [{x:3},{carrying:0},{combat:{}},{retreat:true},{returnPath:[{x:0,y:0},{x:2,y:0}]}]) {
  const state={simSeconds:60};recordWorkerRoute(state,{...agent(),...changes},()=>1);
  assert.equal(state.workerRouteSamples,undefined);
 }
 for (const multiplier of [0,NaN,Infinity,-1]) {
  const state={simSeconds:60};recordWorkerRoute(state,agent(),()=>multiplier);
  assert.equal(state.workerRouteSamples,undefined);
 }
});
test('route history is bounded and discards stale or invalid saved samples', () => {
 const state={simSeconds:1000,workerRouteSamples:[{at:600,distance:4},{at:1100,distance:4},{at:999,distance:NaN}]};
 for(let i=0;i<12;i++){state.simSeconds++;recordWorkerRoute(state,agent(),()=>1);}
 assert.equal(state.workerRouteSamples.length,8);assert.equal(state.workerRouteSamples[0].at,1005);
 assert.ok(state.workerRouteSamples.every(sample=>sample.distance===2));
});

test('actual unloading records a paid gatherer journey and preserves it across saves', async () => {
 const { createGame } = await import('./game.mjs');
 const colony={id:1,ownerId:'test',tribe:'bean',x:10,y:10,occupiedCells:new Set(['2,2'])};
 const environment={hostId:'test',simSeconds:60,world:{size:40,seed:13,generationVersion:41,
  terrain:new Uint8Array(1600).fill(4),hazards:new Uint8Array(1600)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
 const game=createGame(environment,colony);environment.games.set('test',game);
 const saved=JSON.parse(game.save());saved.state.evolutionPoints=0;saved.state.agents.splice(1);
 Object.assign(saved.state.agents[0],{x:10,y:10,renderFromX:10,renderFromY:10,carrying:2,carryingType:'clay',
  mode:'unload',unloadReady:60,birth:null,moveDuration:0,moveStartedAt:0,decisionPending:null,nextDecisionAt:1000,
  returnPath:[{x:8,y:10},{x:9,y:10},{x:10,y:10}],utility:{action:'return',target:{x:10,y:10,key:'home'},route:[{x:10,y:10}]}});
 environment.world.terrain[409]=9;game.restore(JSON.stringify(saved));
 environment.simSeconds+=.1;game.prepare(environment.simSeconds);game.tick(.1);
 assert.equal(game.snapshot().colonyFood,2);
 assert.deepEqual(game.decisionSnapshot().state.workerRouteSamples,[{at:60.1,distance:6}]);
 game.restore(game.save());assert.equal(game.decisionSnapshot().state.workerRouteSamples[0].distance,6);
});
