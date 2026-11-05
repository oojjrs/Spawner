import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createCombatEvolutionArt,combatEvolutionPose}from './combat-evolution.mjs';
import {COMBAT_EVOLUTION_CATALOG}from './combat-evolution-assets.mjs';
import {dominantResourceHarvestPose,harvestWork,workPoint,workTriangles}from './dominant-resource-motion.mjs';
const animations=COMBAT_EVOLUTION_CATALOG['sprout/carapace'].animations;
const agent=patch=>({id:'shell',tribe:'bean',attributes:{carapace:1},health:10,mode:'harvest',harvestStarted:10,hurtStartedAt:-Infinity,...patch});
test('bean carapace harvest reuses only its own sheet; combat, legacy, blade, portrait and retry stay scoped',async()=>{
 const state={fail:false};
 const surface=(width,height)=>{const canvas={width,height,calls:[]};const ctx={canvas,save(){},restore(){},translate(){},scale(){},rotate(){},transform(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},rect(){},clip(){},drawImage(image,...args){if(state.fail&&image.file===animations.idle.image)throw Error('temporary draw');canvas.calls.push({image,args});},getImageData(){return{data:new Uint8ClampedArray(width*height*4)};}};canvas.getContext=()=>ctx;return canvas;};
 const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
 const load=async file=>{const b=read(file),png=file.endsWith('.png');return{file,width:png?b.readUInt32BE(16):2048,height:png?b.readUInt32BE(20):2048,complete:true};};
 const art=createCombatEvolutionArt(p=>'data:application/json;base64,'+read(p).toString('base64'),surface,load);await art.prepare('bean');
 const a=agent(),before=JSON.stringify(a),pose=combatEvolutionPose(a,10.2,animations),sprite=art.frame(a,10.2,()=>assert.fail('extra organ layer'));
 assert.equal(pose.dominantResource,true);assert.equal(sprite.calls.length,55);assert.ok(sprite.calls.every(c=>c.image.file===animations.idle.image));assert.equal(JSON.stringify(a),before);
 assert.equal(art.frame(agent({harvestStarted:20}),20.2,()=>{}),sprite);
 for(const patch of [{mode:'idle'},{mode:'return',moveStartedAt:10,moveDuration:1},{mode:'unload',foodDelivery:{startedAt:10,arrivesAt:10.8}},{health:0,diedAt:10},{birth:{startedAt:10,readyAt:11}},{hurtStartedAt:10.1},{attack:{startedAt:10,speed:1}},{attributes:{carapace:1,strength:1}},{species:'beetle'},{harvestStarted:11}])assert.deepEqual(combatEvolutionPose(agent(patch),10.2,animations),combatEvolutionPose(agent(patch),10.2,animations,true));
 assert.equal(dominantResourceHarvestPose(agent({attributes:{blade:1,carapace:1}}),10.2,COMBAT_EVOLUTION_CATALOG['sprout/blade'].animations),null);
 assert.equal(art.portrait(agent({harvestStarted:0})).calls[0].image.file,animations.attack.image);
 state.fail=true;assert.equal(art.frame(a,10.36).calls[0].image.file,animations.attack.image);state.fail=false;assert.equal(art.frame(a,10.36).calls.length,55);
});
test('bean 420 ms work has positive geometry and a completely fixed lower band',()=>{
 for(let time=0;time<=1260;time+=20){const pose=harvestWork('bean',time);assert.ok(workTriangles(pose).every(t=>t.ratio>.5));for(const x of [0,128,256,384,512])for(const y of [432,448,449,452,512])assert.deepEqual(workPoint(pose,x,y),[x,y]);}
 assert.equal(harvestWork('bean',420).compression,0);assert.equal(harvestWork('bean',0).compression,0);
});
