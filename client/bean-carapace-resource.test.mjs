import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createCombatEvolutionArt,combatEvolutionPose}from './combat-evolution.mjs';
import {COMBAT_EVOLUTION_CATALOG}from './combat-evolution-assets.mjs';
import {dominantResourceHarvestPose,harvestWork,workPoint,workTriangles}from './dominant-resource-motion.mjs';
const animations=COMBAT_EVOLUTION_CATALOG['sprout/carapace'].animations;
const agent=patch=>({id:'shell',tribe:'bean',attributes:{carapace:1},health:10,mode:'harvest',harvestStarted:10,hurtStartedAt:-Infinity,...patch});
test('bean 420 ms work has positive geometry and a completely fixed lower band',()=>{
 for(let time=0;time<=1260;time+=20){const pose=harvestWork('bean',time);assert.ok(workTriangles(pose).every(t=>t.ratio>.5));for(const x of [0,128,256,384,512])for(const y of [432,448,449,452,512])assert.deepEqual(workPoint(pose,x,y),[x,y]);}
 assert.equal(harvestWork('bean',420).compression,0);assert.equal(harvestWork('bean',0).compression,0);
});
