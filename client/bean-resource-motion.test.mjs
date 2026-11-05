import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createCombatEvolutionArt,combatEvolutionPose} from './combat-evolution.mjs';
import {COMBAT_EVOLUTION_CATALOG} from './combat-evolution-assets.mjs';
const animations=COMBAT_EVOLUTION_CATALOG['sprout/blade'].animations;
const unit=patch=>({id:'harvester',tribe:'bean',attributes:{blade:1},health:10,bornAt:0,mode:'harvest',harvestStarted:10,hurtStartedAt:-Infinity,...patch});
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
async function fixture(){
 const state={missing:false,fail:false};
 const surface=(width,height)=>{const canvas={width,height,calls:[]};let matrix=[1,0,0,1,0,0],stack=[];
  const ctx={canvas,globalAlpha:1,globalCompositeOperation:'source-over',save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},
   transform(...v){matrix=mul(matrix,v);},translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},
   getTransform(){return Object.fromEntries(['a','b','c','d','e','f'].map((k,i)=>[k,matrix[i]]));},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},rect(){},
   drawImage(image,...args){if(state.fail&&image.file?.endsWith('/sprout/blade/Parts/body.png'))throw Error('temporary source draw failure');canvas.calls.push({image,args,matrix:[...matrix]});},getImageData(){return{data:new Uint8ClampedArray(width*height*4)};}};
  canvas.getContext=()=>ctx;return canvas;
 };
 const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url));
 const load=async file=>{const bytes=read(file),png=file.endsWith('.png');return{file,width:png?bytes.readUInt32BE(16):2048,height:png?bytes.readUInt32BE(20):2048,get complete(){return !(state.missing&&file.endsWith('/sprout/blade/Parts/body.png'));}};};
 const art=createCombatEvolutionArt(path=>'data:application/json;base64,'+read(path).toString('base64'),surface,load);await art.prepare('bean');return{art,state};
}
const paths=sprite=>sprite.calls.map(call=>call.image.file).filter(Boolean);
test('harvest is scoped to canonical bean blade after existing action priority',()=>{
 assert.equal(combatEvolutionPose(unit(),10.12,animations).action,'harvest');
 for(const [patch,expected]of [[{health:0,diedAt:10},'death'],[{birth:{startedAt:10,readyAt:11}},'birth'],[{hurtStartedAt:10.1},'hurt'],[{attack:{startedAt:10,speed:1}},'attack'],[{attributes:{blade:1,secretion:1},attack:{mode:'ranged',startedAt:10,hitAt:10.2,launchedAt:10.2,endsAt:10.6}},'ranged'],[{attributes:{carapace:1}},'attack'],[{tribe:'spore'},'attack'],[{attributes:{blade:1,strength:1}},'attack'],[{mode:'unload',foodDelivery:{startedAt:10,arrivesAt:10.8}},'idle'],[{mode:'return',carrying:1,moveStartedAt:10,moveDuration:1},'idle']])
  assert.equal(combatEvolutionPose(unit(patch),10.12,animations).action,expected,JSON.stringify(patch));
 assert.equal(combatEvolutionPose(unit(),10.12,animations,true).action,'attack');
 assert.equal(combatEvolutionPose(unit({harvestStarted:11}),10.12,animations).action,'attack');
});
test('runtime uses existing source parts, shared cache, and no extra cargo/combat layer',async()=>{
 const {art}=await fixture(),a=unit(),before=JSON.stringify(a);
 const sprite=art.frame(a,10.12,()=>assert.fail('No extra organ layer on canonical blade harvest'));
 assert.equal(sprite.width,512);assert.equal(sprite.height,512);
 assert.ok(paths(sprite).includes('DesignAssets/Animations/CombatAttributesV7/sprout/blade/Parts/body.png'));
 assert.ok(paths(sprite).every(p=>p.includes('/sprout/blade/Parts/')));assert.ok(sprite.calls.length>100);
 assert.equal(art.frame(unit({id:'second',harvestStarted:20}),20.12,()=>{}),sprite);
 assert.equal(JSON.stringify(a),before);
 assert.deepEqual(paths(art.portrait(unit({harvestStarted:0}))),[animations.attack.image]);
});
test('unavailable or failing source falls back to the previous harvest path and retries cleanly',async()=>{
 for(const reason of ['missing','fail']){
  const {art,state}=await fixture();state[reason]=true;
  assert.deepEqual(paths(art.frame(unit(),10.12)),[animations.attack.image]);
  state[reason]=false;assert.ok(paths(art.frame(unit(),10.12)).includes('DesignAssets/Animations/CombatAttributesV7/sprout/blade/Parts/body.png'));
 }
});
