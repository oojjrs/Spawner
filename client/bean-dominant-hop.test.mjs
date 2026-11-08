import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BEAN_DOMINANT_HOP_ANIMATIONS, beanDominantHopPose, beanDominantHopFrame } from './bean-dominant-hop.mjs';
import { unitActionArtDefinition, unitActionArtPose } from './unit-action-art.mjs';
import { createCombatEvolutionArt } from './combat-evolution.mjs';
import { COMBAT_ATTRIBUTE_ASSETS } from './combat-attribute-assets.mjs';
import { imageDimensions, auditImages } from './image-audit.mjs';
const forms=['blade','carapace'];
const unit=(form,patch={})=>({id:'walker',tribe:'bean',health:10,mode:'walk',attributes:{[form]:1},moveStartedAt:10,moveDuration:1,stepCount:1,hurtStartedAt:-Infinity,...patch});
function surface(width,height){const c={width,height,calls:[],transforms:[]};const context={canvas:c,save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},rect(){},clip(){},rotate(){},translate(...a){c.transforms.push(['translate',...a]);},scale(...a){c.transforms.push(['scale',...a]);},transform(){},drawImage(image,...a){if(image.fail)throw Error('failed source');c.calls.push({image,args:a});},getImageData(){return{data:new Uint8ClampedArray(width*height*4)};}};c.getContext=()=>context;return c;}

test('two current bean forms reuse 24 timed samples with eleven physical own-source cels',()=>{
 for(const form of forms)for(const duration of [.15,.6,1,4]){
  const agent=unit(form,{moveDuration:duration}),before=structuredClone(agent),animation=BEAN_DOMINANT_HOP_ANIMATIONS[form];
  for(let i=0;i<24;i++){
   const pose=beanDominantHopPose(agent,10+duration*(i+.01)/24);
   assert.equal(pose.animation,animation);assert.equal(pose.frame,animation.frames[i]);assert.equal(pose.sampleTime,i*40);
  }
  assert.equal(beanDominantHopPose(agent,10).frame,0);assert.equal(beanDominantHopPose(agent,10+duration*.999).frame,0);
  assert.equal(beanDominantHopPose(agent,10+duration),null);assert.deepEqual(agent,before);
  assert.equal(animation.frames.length,24);assert.equal(new Set(animation.frames).size,11);
 }
});
test('only actual live movement selects this clip; carry shares it without changing cargo',()=>{
 for(const form of forms){const agent=unit(form);
  for(const patch of [{tribe:'spore'},{species:'soil-boar'},{health:0},{birth:{}},{mode:'harvest'},{mode:'unload'},{mode:'jump'},
   {moveStartedAt:11},{moveStartedAt:NaN},{moveDuration:0},{moveDuration:Infinity},{attributes:{antenna:1}},{attributes:{secretion:1}},
   {attributes:{[form]:1,strength:1}},{attributes:{[form]:1,piercing:1}}])assert.equal(beanDominantHopPose({...agent,...patch},10.2),null,JSON.stringify(patch));
  assert.equal(beanDominantHopPose(agent,Infinity),null);
  const carrying={...agent,mode:'return',carrying:3,carryingType:'clay'};const before=structuredClone(carrying);
  assert.equal(beanDominantHopPose(carrying,10.2).animation,beanDominantHopPose(agent,10.2).animation);assert.deepEqual(carrying,before);
  assert.equal(beanDominantHopPose({...agent,attributes:{blade:1,secretion:1,feet:1}},10.2).animation,BEAN_DOMINANT_HOP_ANIMATIONS.blade);
 }
});
test('native camera crop has no extra root transform and handles invalid loads and retry',()=>{
 for(const form of forms){const pose=beanDominantHopPose(unit(form),10.2),image={width:2048,height:1536,complete:true};
  const result=beanDominantHopFrame(image,pose,surface);assert.equal(result.width,512);assert.equal(result.calls.length,1);assert.deepEqual(result.transforms,[]);
  assert.deepEqual(result.calls[0].args,[pose.frame%4*512,Math.floor(pose.frame/4)*512,512,512,0,0,512,512]);
  assert.equal(beanDominantHopFrame(image,pose,()=>assert.fail('cached')),result);
  assert.equal(beanDominantHopFrame({...image,complete:false},pose,surface),null);
  assert.equal(beanDominantHopFrame({...image,width:1},pose,surface),null);
  assert.equal(beanDominantHopFrame({...image},pose,()=>{throw Error('canvas');}),null);
  const retry={...image,fail:true};assert.equal(beanDominantHopFrame(retry,pose,surface),null);retry.fail=false;assert.ok(beanDominantHopFrame(retry,pose,surface));
  for(let i=0;i<24;i++)beanDominantHopFrame(image,beanDominantHopPose(unit(form),10+(i+.1)/24),surface);
  assert.notEqual(beanDominantHopFrame(image,pose,surface),result,'bounded source cache evicts old cels');
 }
});
test('every atlas is registered and all approved source hashes still match',()=>{
 assert.equal(auditImages(process.cwd(),Object.values(BEAN_DOMINANT_HOP_ANIMATIONS).map(a=>a.image)),2);
 for(const form of forms){const clip=BEAN_DOMINANT_HOP_ANIMATIONS[form],provenance=JSON.parse(readFileSync(clip.image.replace('hop.webp','provenance.json')));
  assert.ok(COMBAT_ATTRIBUTE_ASSETS.includes(clip.image));assert.deepEqual(imageDimensions(clip.image),[2048,1536]);
  assert.equal(provenance.physicalFrameCount,11);assert.deepEqual(provenance.playbackFrames,clip.frames);assert.equal(provenance.standaloneReady,false);
  assert.equal(provenance.sha256,createHash('sha256').update(readFileSync(clip.image)).digest('hex'));
  for(const [file,hash]of Object.entries(provenance.sources)){const bytes=readFileSync(file);
   const source=file.endsWith('.json')?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes;
   assert.equal(createHash('sha256').update(source).digest('hex'),hash,file);}
  assert.ok(provenance.frames.every(f=>f.edge===0&&f.minRatio>.1&&f.opaqueFeetExact&&f.floor<=f.baselineFloor));
 }
});
async function fixture(){
 const loads=[];
 const art=createCombatEvolutionArt(file=>file,surface,async file=>{
  loads.push(file);const [width,height]=imageDimensions(file);return{file,width,height,complete:true};
 });
 return{art,loads};
}

test('shared renderer selects current whole-body movement and keeps action interruption and portrait ownership',async()=>{
 for(const form of forms){const f=await fixture(),agent=unit(form),definition=unitActionArtDefinition(agent);
  await f.art.prepareAgent(agent,10.2);
  assert.equal(f.art.frame(agent,10.2).calls[0].image.file,definition.actions.walk.image);
  assert.equal(f.art.portrait(agent).calls[0].image.file,definition.actions.idle.image);
  for(const patch of [{moveDuration:0},{hurtStartedAt:10.1},{attack:{startedAt:10,speed:1}},{health:0,diedAt:10},
    {birth:{startedAt:10,readyAt:11}},{mode:'harvest',harvestStarted:10},{mode:'unload',foodDelivery:{startedAt:10,arrivesAt:11,amount:2}}]){
   const actor={...agent,...patch},before=JSON.stringify(actor),pose=unitActionArtPose(actor,10.2);
   await f.art.prepareAgent(actor,10.2);
   const sprite=f.art.frame(actor,10.2);assert.ok(sprite);
   const sources=pose.animation.sceneLayers?.layers.map(layer=>layer.image)||[pose.animation.image];
   assert.ok(sprite.calls.every(call=>sources.includes(call.image.file)));
   assert.equal(JSON.stringify(actor),before);
  }
 }
});

test('current whole-body renderer has no dependency on the retired optional hop atlas',async()=>{
 for(const form of forms){const f=await fixture(),agent=unit(form);
  await f.art.prepareAgent(agent,10.2);
  for(let i=0;i<24;i++)assert.ok(f.art.frame(agent,10+(i+.01)/24));
  await f.art.prepareAgent(agent,11);
  assert.equal(f.art.frame(agent,11).calls[0].image.file,unitActionArtDefinition(agent).actions.idle.image);
  assert.ok(f.loads.every(path=>!path.includes('/BeanDominantHopV1/')));
 }
});
