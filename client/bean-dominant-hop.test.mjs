import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BEAN_DOMINANT_HOP_ANIMATIONS, beanDominantHopPose, beanDominantHopFrame } from './bean-dominant-hop.mjs';
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
  for(const [file,hash]of Object.entries(provenance.sources))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,file);
  assert.ok(provenance.frames.every(f=>f.edge===0&&f.minRatio>.1&&f.opaqueFeetExact&&f.floor<=f.baselineFloor));
 }
});
async function fixture(){const images=new Map(),read=file=>readFileSync(file);let resolveHop;
 const load=async file=>{const dimensions=imageDimensions(file),img={file,width:dimensions[0],height:dimensions[1],complete:true};images.set(file,img);if(file.includes('/BeanDominantHopV1/'))await new Promise(resolve=>{resolveHop=resolve;});return img;};
 const art=createCombatEvolutionArt(file=>'data:application/json;base64,'+read(file).toString('base64'),surface,load);await art.prepare('bean');
 return{art,images,finish:async()=>{resolveHop?.();await new Promise(r=>setImmediate(r));}};}
test('real shared renderer loads lazily, preserves fallback, combat/resource priority and interruption',async()=>{
 for(const form of forms){const f=await fixture(),agent=unit(form),clip=BEAN_DOMINANT_HOP_ANIMATIONS[form];
  const pending=f.art.frame(agent,10.2);assert.equal(pending.calls.length,1);assert.ok(pending.calls[0].image.file.endsWith('/idle.webp'));
  await f.finish();const ready=f.art.frame(agent,10.2,()=>assert.fail('no extra organ layer'));assert.equal(ready.calls[0].image.file,clip.image);
  assert.equal(f.art.frame({...agent,id:'other',mode:'return',carrying:4},10.2),ready);
  for(const patch of [{moveDuration:0},{hurtStartedAt:10.1},{attack:{startedAt:10,speed:1}},{health:0,diedAt:10},
    {birth:{startedAt:10,readyAt:11}},{mode:'harvest',harvestStarted:10},{mode:'unload',foodDelivery:{startedAt:10,arrivesAt:11,amount:2}}]){
   const sprite=f.art.frame({...agent,...patch},10.2);assert.ok(sprite);assert.ok(sprite.calls.every(c=>c.image.file!==clip.image),JSON.stringify(patch));
  }
  assert.ok(f.art.frame(agent,11).calls.every(c=>c.image.file!==clip.image),'no stale hop after move ends');
  const image=f.images.get(clip.image);image.complete=false;assert.ok(f.art.frame(agent,10.3).calls.every(c=>c.image.file!==clip.image));image.complete=true;
  assert.equal(f.art.frame(agent,10.3).calls[0].image.file,clip.image);
  assert.ok(f.art.portrait(agent).calls.every(c=>c.image.file!==clip.image));
 }
});

test('an unavailable optional hop atlas has a bounded retry delay while idle remains visible',async t=>{
 t.mock.timers.enable({apis:['Date'],now:10000});let attempts=0,available=false;
 const load=async file=>{if(file.includes('/BeanDominantHopV1/')){attempts++;if(!available)throw Error('unavailable optional atlas');}
  const [width,height]=imageDimensions(file);return{file,width,height,complete:true};};
 const art=createCombatEvolutionArt(file=>'data:application/json;base64,'+readFileSync(file).toString('base64'),surface,load);
 await art.prepare('bean');const agent=unit('blade');
 art.frame(agent,10.2);await new Promise(r=>setImmediate(r));assert.equal(attempts,1);
 for(let i=0;i<60;i++){const fallback=art.frame(agent,10.2+i*.001);assert.ok(fallback.calls.every(c=>!c.image.file?.includes('/BeanDominantHopV1/')));}
 assert.equal(attempts,1);
 t.mock.timers.tick(1001);available=true;art.frame(agent,10.2);await new Promise(r=>setImmediate(r));
 assert.equal(attempts,2);assert.equal(art.frame(agent,10.2).calls[0].image.file,BEAN_DOMINANT_HOP_ANIMATIONS.blade.image);
});
