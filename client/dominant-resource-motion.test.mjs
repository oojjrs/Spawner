import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createCombatEvolutionArt,combatEvolutionPose}from './combat-evolution.mjs';
import {COMBAT_EVOLUTION_CATALOG}from './combat-evolution-assets.mjs';
import {harvestWork,workPoint,workTriangles}from './dominant-resource-motion.mjs';
const forms=['spore','pebble','spring'].flatMap(tribe=>['blade','carapace'].map(form=>({tribe,form})));
const unit=(tribe,form,extra={})=>({tribe,attributes:{[form]:1},health:10,mode:'harvest',harvestStarted:10,hurtStartedAt:-Infinity,...extra});
async function fixture(tribe){
 const state={missing:false,fail:false};const surface=(width,height)=>{const canvas={width,height,calls:[]};const context={canvas,save(){},restore(){},translate(){},scale(){},rotate(){},transform(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},rect(){},clip(){},drawImage(image,...args){if(state.fail&&image.file?.endsWith('/idle.webp'))throw Error('temporary draw');canvas.calls.push({image,args});},getImageData(){return{data:new Uint8ClampedArray(width*height*4)};}};canvas.getContext=()=>context;return canvas;};
 const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
 const load=async file=>{const b=read(file),png=file.endsWith('.png');return{file,width:png?b.readUInt32BE(16):2048,height:png?b.readUInt32BE(20):2048,get complete(){return !(state.missing&&file.endsWith('/idle.webp'));}};};
 const art=createCombatEvolutionArt(p=>'data:application/json;base64,'+read(p).toString('base64'),surface,load);await art.prepare(tribe);return{art,state};
}
test('one bounded three-cycle geometry gate preserves support and rejects invalid clocks',()=>{
 for(const tribe of ['spore','pebble','spring'])for(let time=0;time<=2160;time+=20){const p=harvestWork(tribe,time);assert.ok(workTriangles(p).every(t=>t.ratio>.5));for(const y of [432,448,512])assert.deepEqual(workPoint(p,200,y),[200,y]);}
 assert.equal(harvestWork('unknown',0),null);assert.equal(harvestWork('spore',-1),null);
});
