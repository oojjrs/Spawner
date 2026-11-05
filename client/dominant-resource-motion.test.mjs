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
test('six dominant harvest forms route after action priority and retain other modes',()=>{
 for(const {tribe,form}of forms){const animations=COMBAT_EVOLUTION_CATALOG[tribe+'/'+form].animations,a=unit(tribe,form);
  assert.equal(combatEvolutionPose(a,10.18,animations).dominantResource,true);
  for(const [patch,expected]of [[{health:0,diedAt:10},'death'],[{birth:{startedAt:10,readyAt:11}},'birth'],[{hurtStartedAt:10.1},'hurt'],[{attack:{startedAt:10,speed:1}},'attack'],[{mode:'unload',foodDelivery:{startedAt:10,arrivesAt:10.8}},'idle'],[{mode:'return',moveStartedAt:10,moveDuration:1},'walk'],[{attributes:{[form]:1,strength:1}},'attack']])assert.equal(combatEvolutionPose({...a,...patch},10.18,animations).action,expected);
  assert.equal(combatEvolutionPose(a,10.18,animations,true).action,'attack');
 }
});
test('six forms use only own idle pixels in work, share cache, and retry failed drawing',async()=>{
 for(const tribe of ['spore','pebble','spring']){const {art,state}=await fixture(tribe);
  for(const form of ['blade','carapace']){const a=unit(tribe,form),before=JSON.stringify(a),sprite=art.frame(a,10.18,()=>assert.fail('no extra organs'));
   assert.equal(sprite.width,512);assert.equal(sprite.calls.length,55);assert.ok(sprite.calls.every(c=>c.image.file.endsWith('/'+tribe+'/Sheets/'+form+'/idle.webp')));assert.equal(JSON.stringify(a),before);
   assert.equal(art.frame(unit(tribe,form,{harvestStarted:20}),20.18,()=>{}),sprite);
   state.missing=true;assert.equal(art.frame(a,10.36).calls[0].image.file.endsWith('/attack.webp'),true);state.missing=false;
   state.fail=true;for(const time of [10,10.36])assert.equal(art.frame(a,time).calls[0].image.file.endsWith('/attack.webp'),true);state.fail=false;
   assert.equal(art.frame(a,10.36).calls.length,55);
   assert.equal(art.portrait(unit(tribe,form,{harvestStarted:0})).calls[0].image.file.endsWith('/attack.webp'),true);
  }
 }
});
test('one bounded three-cycle geometry gate preserves support and rejects invalid clocks',()=>{
 for(const tribe of ['spore','pebble','spring'])for(let time=0;time<=2160;time+=20){const p=harvestWork(tribe,time);assert.ok(workTriangles(p).every(t=>t.ratio>.5));for(const y of [432,448,512])assert.deepEqual(workPoint(p,200,y),[200,y]);}
 assert.equal(harvestWork('unknown',0),null);assert.equal(harvestWork('spore',-1),null);
});

test('spring work is harvest-only, preserves dominant projection and leaves firing and lifecycle routes intact',async()=>{
 const {art}=await fixture('spring');
 for(const form of ['blade','carapace']){
  const animations=COMBAT_EVOLUTION_CATALOG['spring/'+form].animations;
  for(const patch of [
   {mode:'idle'},{mode:'return',moveStartedAt:10,moveDuration:1},
   {mode:'unload',foodDelivery:{startedAt:10,arrivesAt:10.8}},
   {health:0,diedAt:10},{birth:{startedAt:10,readyAt:11}},
   {hurtStartedAt:10.1},{attack:{startedAt:10,speed:1}},
   {attributes:{blade:1,secretion:1},attack:{mode:'ranged',startedAt:10,launchedAt:10.3,endsAt:11.2}},
  ]){
   const a=unit('spring',form,patch);
   assert.equal(combatEvolutionPose(a,10.18,animations).dominantResource,undefined);
   assert.equal(JSON.stringify(art.frame(a,10.18)),JSON.stringify(art.frame(a,10.18,undefined,undefined,false,true)));
  }
  for(const patch of [{species:'spring'},{harvestStarted:NaN},{harvestStarted:11},
   {moveStartedAt:10,moveDuration:1},{attributes:{[form]:1,arms:1}}]){
   assert.equal(combatEvolutionPose(unit('spring',form,patch),10.18,animations).dominantResource,undefined);
  }
 }
 const a=unit('spring','blade',{attributes:{blade:1,carapace:1,secretion:1,antenna:1,feet:1}});
 assert.equal(combatEvolutionPose(a,10.18,COMBAT_EVOLUTION_CATALOG['spring/blade'].animations).dominantResource,true);
 assert.ok(art.frame(a,10.18).calls.every(c=>c.image.file.endsWith('/spring/Sheets/blade/idle.webp')));
});
