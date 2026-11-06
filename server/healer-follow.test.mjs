import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from './game.mjs';
import {ATTRIBUTE_DNA} from './dna.mjs';
function fixture() {
const colony={id:1,ownerId:'a',tribe:'bean',x:20,y:20,occupiedCells:new Set(['2,2'])};
const env={simSeconds:0,world:{size:80,seed:13,generationVersion:38,terrain:new Uint8Array(6400).fill(4),hazards:new Uint8Array(6400)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map(),decisionPlanner:{request(){return undefined;}}};
const game=createGame(env,colony);env.games.set('a',game);
const [healer,injured,retreat]=game.agents;
const gene=ATTRIBUTE_DNA.lookup.get('healer');const stats=ATTRIBUTE_DNA.stats([{gene:'healer',grade:gene.grade,shape:[...gene.steps],rotation:0}]);
for(const a of game.agents){Object.assign(a,{birth:null,x:50,y:50,renderFromX:50,renderFromY:50,moveDuration:0,moveStartedAt:0,mode:'wait',utility:null,decisionPending:null,nextDecisionAt:1000,carrying:0,moveBudget:1});a.stats={...a.stats,speed:1,health:100};a.health=100;}
healer.stats={...healer.stats,dna:{...stats,movement:1,roaming:true},vision:4};healer.health=100;
injured.x=53;injured.health=50;retreat.x=50;retreat.y=51;retreat.health=10;retreat.retreat={recoverHealth:80};
for(let y=45;y<60;y++)for(let x=45;x<60;x++)game.decisionSnapshot().state.explored.add(y*80+x);
return {game,healer,injured,retreat};
}
test('healer ignores retreating allies when choosing a visible wounded ally to approach',()=>{
 const {game,healer}=fixture();game.tick(.25);
 assert.deepEqual([healer.x,healer.y],[51,50]);
});
test('healer does not acquire a wounded ally outside its antenna vision',()=>{
 const {game,healer}=fixture();healer.stats.vision=1;game.tick(.25);
 assert.deepEqual([healer.x,healer.y],[50,50]);
});
test('healer stops within healing range and heals without moving closer',()=>{
 const {game,healer,injured}=fixture();injured.x=52;game.tick(.25);
 assert.deepEqual([healer.x,healer.y],[50,50]);assert.equal(injured.health,51);
});
