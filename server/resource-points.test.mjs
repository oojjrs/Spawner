import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { dropCarriedResources } from './resources.mjs';
import { RESOURCE_EVOLUTION_POINTS as VALUE } from './resource-points.mjs';

function fixture(tribe, points, cargo=2) {
 const colony={id:1,ownerId:'a',tribe,x:10,y:10,occupiedCells:new Set(['2,2'])};
 const environment={hostId:'a',simSeconds:60,world:{size:40,seed:13,generationVersion:41,terrain:new Uint8Array(1600).fill(4),hazards:new Uint8Array(1600)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
 const game=createGame(environment,colony);environment.games.set('a',game);
 const saved=JSON.parse(game.save());saved.state.evolutionPoints=points;saved.state.agents.splice(1);
 Object.assign(saved.state.agents[0],{x:10,y:10,renderFromX:10,renderFromY:10,carrying:cargo,
  carryingType:{bean:'clay',spore:'tree',pebble:'pebbles',spring:'dew'}[tribe],mode:'unload',unloadReady:60,birth:null,
  moveDuration:0,moveStartedAt:0,decisionPending:null,nextDecisionAt:1000,returnPath:[],
  utility:{action:'return',target:{x:10,y:10,key:'home'},route:[{x:10,y:10}]}});
 game.restore(JSON.stringify(saved));
 const tick=()=>{environment.simSeconds+=.1;game.prepare(environment.simSeconds);game.tick(.1);};
 return {game,environment,tick};
}
for(const tribe of ['bean','spore','pebble','spring'])test(tribe+': 자원 개수와 포인트를 분리하고 두 번 입금하지 않는다',()=>{
 const f=fixture(tribe,20);f.tick();const state=f.game.decisionSnapshot().state,a=f.game.agents[0];
 assert.equal(state.colonyFood,2);assert.equal(state.evolutionPoints,20+2*VALUE);assert.equal(a.carrying,0);
 assert.equal(a.foodDelivery.amount,2);assert.equal(a.foodDelivery.points,2*VALUE);
 assert.equal(state.foodIncome.reduce((sum,entry)=>sum+entry[1],0),2*VALUE);
 f.game.restore(f.game.save());f.tick();assert.equal(f.game.snapshot().evolutionPoints,20+2*VALUE);
});
test('하역은 포인트 상한까지의 실제 공간만 사용하고 남은 원물은 보존한다',()=>{
 const f=fixture('bean',199);f.tick();const a=f.game.agents[0];
 assert.equal(f.game.snapshot().evolutionPoints,200);assert.equal(f.game.snapshot().colonyFood,1/VALUE);
 assert.equal(a.carrying,2-1/VALUE);assert.equal(a.foodDelivery.points,1);f.tick();
 assert.equal(f.game.snapshot().evolutionPoints,200);assert.equal(a.carrying,2-1/VALUE);
});


test('부분 하역 뒤 작은 운반 잔량도 채집과 떨어뜨리기에서 원물 총량을 보존한다',()=>{
 const f=fixture('bean',0,3.55), a=f.game.agents[0];
 const food={key:'9,10',x:9,y:10,amount:100,initialAmount:100,resourceType:'clay',kind:'resource'};
 f.environment.food.set(food.key,food);
 Object.assign(a,{x:9,y:10,renderFromX:9,renderFromY:10,mode:'harvest',harvestReady:60,harvestPrepared:true,
  harvestStarted:56,utility:{action:'collect',target:{key:food.key,x:9,y:10},plannedCargo:4,route:[]}});
 f.tick();assert.equal(a.carrying,4);assert.equal(food.amount,99.55);
 for(let i=0;i<10;i++)dropCarriedResources(f.environment,{x:8,y:10,carrying:.55,carryingType:'clay'});
 assert.equal(f.environment.food.get('drop:clay:8,10').amount,5.5);
});
