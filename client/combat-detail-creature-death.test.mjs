import { combatViewLayout, unitDisplaySize, unitFrameMirror } from "./unit-size.mjs";
import { drawUnitAttackRing } from "./unit-attack-ring.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createDetailCombatDeath, detailDeathForm, DETAIL_DEATH_CREATURES, detailCreatureDeathShadow } from './combat-detail-death.mjs';
import { createCombatVfxCursor } from './combat-vfx-events.mjs';
import { createDetailCombatVfx, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect } from './combat-detail-vfx.mjs';
import { CREATURE_IDLE_ANIMATIONS, CREATURE_DEATH_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, unitAnimationFrame, creatureHurtPose, creatureAttackPose, creatureWalkPose } from './unit-animation.mjs';
import { imageFrameGeometry } from './image-geometry.mjs';
import { imageDimensions } from './image-audit.mjs';
import { createEncounters } from '../server/encounters.mjs';

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const extract = name => source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0];
const corpse=(species,extra={})=>({kind:'corpse',agentId:'target',id:'corpse:target',species,x:100,y:100,diedAt:1,decaysAt:4,facing:1,attributes:{},...extra});
const sprite=animation=>({path:animation.image,complete:true,naturalWidth:imageDimensions(animation.image)[0],naturalHeight:imageDimensions(animation.image)[1]});

// The approved list is deliberately narrower than the existing registry.
test('only the five approved creature deaths join the existing eight tribe routes',()=>{
 assert.deepEqual(DETAIL_DEATH_CREATURES,['vine-turtle','walking-forest','cotton-sheep','lantern-keeper','spiny-back-leader']);assert.ok(Object.isFrozen(DETAIL_DEATH_CREATURES));
 for(const species of Object.keys(CREATURE_DEATH_ANIMATIONS))assert.equal(detailDeathForm({species}),DETAIL_DEATH_CREATURES.includes(species)?'creature/'+species:null,species);
 for(const species of ['spiny-back-beetle','unknown'])assert.equal(detailDeathForm({species,tribe:'bean'}),null);
 for(const tribe of ['bean','spore','pebble','spring'])for(const secretion of [false,true])assert.equal(detailDeathForm({tribe,attributes:secretion?{secretion:1}:{}}),tribe+(secretion?'/secretion':'/base'));
});


test('creature support uses the exact existing world radii and death-age opacity, including registration and reduced motion',()=>{
 for(const species of DETAIL_DEATH_CREATURES)for(const age of [.01,.22,.6,1.2,2.8])for(const reducedMotion of [false,true]){
  const animation=CREATURE_DEATH_ANIMATIONS[species],entry={animation,scale:.47},record=corpse(species),scale=1.35,cell=190;
  const value=detailCreatureDeathShadow({corpse:record,age,scale,cell},entry,reducedMotion),calls=[];
  const scope={creatureDeathSheets:new Map([[species,entry]]),idleMotion:{matches:reducedMotion},state:{camera:{zoom:cell}},corpsePlaybackTime:()=>1+age,
   Spawner:{unitAnimationFrame,imageFrameGeometry},drawGroundShadow:(...args)=>calls.push(args),clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};
  createContext(scope);runInContext(extract('drawCorpseGroundShadow'),scope);scope.drawCorpseGroundShadow(record,{x:100,y:200});
  assert.ok(Math.abs(value.radiusX-calls[0][2]*scale)<1e-8);assert.ok(Math.abs(value.radiusY-calls[0][3]*scale)<1e-8);assert.ok(Math.abs(value.opacity-calls[0][4])<1e-8);
 }
 assert.equal(detailCreatureDeathShadow({corpse:corpse('bubble-toad'),age:.1,scale:1,cell:100},{animation:CREATURE_DEATH_ANIMATIONS['bubble-toad'],scale:1}),null);
});


test('actual encounter death supplies immediate original-ID corpses without changing simulation records',()=>{
 for(const species of DETAIL_DEATH_CREATURES){
  const environment={seed:13,simSeconds:1,world:{seed:13,generationVersion:11,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320),burrows:[],encounters:[{key:species,x:150,y:150,cells:[150*320+150],terrains:[4],nearWater:false}]},colonies:[],games:new Map(),food:new Map(),foodSpots:new Map()};
  const agent={id:'target',species,x:150,y:150,health:1,facing:1,stats:{health:14,combatStrength:10,speed:.5,attack:1,vision:4},moveStartedAt:0,nextActionAt:0,combat:{id:'fight',side:1}};
  const encounters=createEncounters(environment,{version:1,agents:[agent],kills:{},records:[{key:species,x:150,y:150,sequence:1,spawned:true,dead:false,missingSince:null,nextSpawnAt:null,warningUntil:null}]},[]);
  const tracker=createDetailCombatDeath(),viewport={scope:'fight',roomId:'room',streamId:'stream',width:1040,height:480,snapshotTime:.9};
  tracker.begin(.9,{...viewport,visibleIds:[agent.id],livingAgents:[agent]});tracker.observe(agent,{x:600,y:350,width:180,height:150},{scale:1.35,facing:-1});
  encounters.receiveDamage(agent,100);const record=environment.food.get('corpse:'+agent.id);assert.ok(record);assert.equal(record.diedAt,1);assert.equal(record.decaysAt,4);assert.equal(encounters.agents.includes(agent),false);
  const saved=JSON.stringify(encounters.save()),food=JSON.stringify([...environment.food]);tracker.begin(1.01,{...viewport,snapshotTime:1,visibleIds:[],livingAgents:[]});
  const rows=tracker.commands([record],1.01,{width:1040,height:480,cell:200});assert.equal(rows.length,1);assert.equal(rows[0].form,'creature/'+species);
  assert.equal(JSON.stringify(encounters.save()),saved);assert.equal(JSON.stringify([...environment.food]),food);
 }
});
