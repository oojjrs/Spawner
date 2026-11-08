import test from 'node:test';
import { approvedArtSource } from './test-support/approved-art-source.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createContext,runInContext} from 'node:vm';
import {UNIT_SECRETION_IDLE_ANIMATIONS,unitSecretionIdlePose} from './secretion-idle.mjs';
import {UNIT_RANGED_FORMS,UNIT_RANGED_IMAGE_ASSETS,unitRangedPose,unitRangedAppearance,unitRangedDisplaySize} from './unit-ranged.mjs';
import {unitAnimationPose} from './unit-animation.mjs';
import {imageDimensions,auditImages} from './image-audit.mjs';
const tribes=['spore','pebble','spring'];
const agent=(tribe,patch={})=>({id:'idle',tribe,health:10,mode:'idle',attributes:{secretion:1},animationStartedAt:10,bornAt:0,hurtStartedAt:-Infinity,moveDuration:0,facing:1,...patch});
const source=(tribe)=>`DesignAssets/Animations/UnitRangedV1/${tribe}/Source/neutral.png`;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('two legacy secretion idles retain their 64-sample rhythm while Spring selects its approved idle',()=>{
 for(const tribe of ['spore','pebble']){const a=agent(tribe),before=structuredClone(a),clip=UNIT_SECRETION_IDLE_ANIMATIONS[tribe];
  for(let i=0;i<64;i++){const p=unitRangedPose(a,10+(i+.01)/10);assert.equal(p.animation,clip);assert.equal(p.frame,clip.frames[i]);assert.equal(p.sample,i);}
  assert.equal(unitRangedPose(a,10).frame,0);assert.equal(unitRangedPose(a,16.3).frame,0);assert.equal(unitRangedPose(a,16.4).frame,0);
  assert.equal(unitRangedPose(a,9).frame,0);assert.deepEqual(a,before);assert.equal(clip.viewSize,512);
  assert.equal(clip.frames.length,64);assert.equal(clip.durationMs,6400);assert.ok(clip.frameSize<256);
  const restored=JSON.parse(JSON.stringify(a));assert.deepEqual(unitRangedPose(restored,12.1),unitRangedPose(a,12.1));
  assert.equal(unitRangedPose(a,12.1).idleFallback,UNIT_RANGED_FORMS[tribe].idle);
  assert.equal(UNIT_RANGED_FORMS[tribe].idle.image,source(tribe),'resource/birth neutral contract remains intact');
 }
 assert.equal(unitRangedPose(agent('spring'),12.1).animation,UNIT_RANGED_FORMS.spring.idle);
 const bean=agent('bean'),beanIdle=UNIT_SECRETION_IDLE_ANIMATIONS.bean,beanForm=UNIT_RANGED_FORMS.bean;
 assert.equal(unitRangedPose(bean,12).animation,beanForm.idleAnimation);
 assert.equal(beanForm.idleAnimation.image,beanIdle.image);
 assert.equal(beanIdle.nativeSecretionIdle,true);assert.equal(beanIdle.frameCount,64);assert.equal(beanIdle.durationMs,3200);assert.equal(beanIdle.loop,true);
 assert.ok(beanIdle.durationsMs.every(ms=>ms===50));
 for(let i=0;i<64;i++)assert.equal(unitRangedPose(bean,10+(i+.01)*.05).frame,i);
 assert.equal(unitRangedPose({...bean,animationStartedAt:0},3.2).frame,0);
 assert.equal(beanForm.idle.image,source('bean'));assert.equal(beanForm.idle.frameSize,512);
 assert.equal(beanForm.idle.pivotX,256);assert.equal(beanForm.idle.pivotY,448);
 assert.equal(unitRangedPose({...bean,birth:{}},12).animation,beanForm.idle,'birth retains its source512 fallback');
});
test('shoot, hurt, resource, live movement and lifecycle take precedence without stale idle replay',()=>{
 for(const tribe of tribes){const a=agent(tribe),appearance=UNIT_RANGED_FORMS[tribe];
  for(const patch of [{species:'soil-boar'},{birth:{}},{health:0},{mode:'harvest'},{mode:'unload'},{mode:'jump'},
   {moveStartedAt:10,moveDuration:4},{hurtStartedAt:12},{attack:{startedAt:12,speed:1}}])assert.equal(unitSecretionIdlePose({...a,...patch},12.1,appearance),null,JSON.stringify(patch));
  assert.equal(unitSecretionIdlePose(a,NaN,appearance),null);assert.equal(unitSecretionIdlePose(a,Infinity,appearance),null);
  assert.equal(unitRangedPose({...a,attributes:{blade:1,secretion:1}},12.1),null);
  assert.equal(unitRangedPose({...a,attack:{mode:'ranged',startedAt:12,launchedAt:12.2,endsAt:12.8}},12.1).action,'shoot');
  assert.equal(unitRangedPose({...a,hurtStartedAt:12},12.1).action,'hurt');
  assert.equal(unitRangedPose({...a,mode:'harvest',harvestStarted:12},12.1).action,'harvest');
  assert.equal(unitRangedPose({...a,mode:'unload',foodDelivery:{startedAt:12,arrivesAt:13,amount:1}},12.1).action,'throw');
  assert.equal(unitRangedPose({...a,moveStartedAt:12,moveDuration:1},12.1).action,'walk');
  if(tribe==='spring')assert.equal(unitRangedPose(a,12.1).animation,appearance.idle);
  else assert.equal(unitRangedPose(a,12.1).sample,21,'cancel/resume does not reset the idle epoch');
  assert.equal(unitRangedPose({...a,carrying:3,mode:'return'},12.1).animation,tribe==='spring'?appearance.idle:UNIT_SECRETION_IDLE_ANIMATIONS[tribe]);
 }
});
test('each atlas is source-pinned, registered, seamless at loop, native and not world-ready',()=>{
 assert.equal(auditImages(process.cwd(),tribes.map(t=>UNIT_SECRETION_IDLE_ANIMATIONS[t].image)),3);
 for(const t of tribes){const clip=UNIT_SECRETION_IDLE_ANIMATIONS[t],p=JSON.parse(readFileSync(clip.image.replace('idle.webp','provenance.json'))),hash=f=>{
   let bytes=readFileSync(f);
   if(f.endsWith('.json')){
    bytes=bytes.toString('utf8').replace(/\r\n/g,'\n');
    if(f==='DesignAssets/Tribes/spring/Animations/Attributes/v1/rig.json'){
     const rig=JSON.parse(bytes);
     for(const action of ['idle','walk','attack','hurt','death']){assert.equal(rig.animations[action].sourceFacing,'left');delete rig.animations[action].sourceFacing;}
     bytes=JSON.stringify(rig,null,2)+'\n';
    }
   }
   return createHash('sha256').update(bytes).digest('hex');
  };
  assert.ok(UNIT_RANGED_IMAGE_ASSETS.includes(clip.image));assert.equal(hash(p.source),approvedArtSource(p.source,p.sourceHash).sha256);assert.equal(hash(p.motionSource),p.motionSource==='DesignAssets/Tribes/spore/Animations/Attributes/v1/rig.json'&&p.motionSourceHash==='067b5cdb8b6d77a7b7bf522655d9d26b442cab755b1857b5ca9bb694f5666051'?'43c03691ab35da445567937d854fcd70c518b630730f44f88d874c6c5d53c86a':p.motionSourceHash);assert.equal(hash(p.idleSource),approvedArtSource(p.idleSource,p.idleSourceHash).sha256);assert.equal(hash(clip.image),approvedArtSource(clip.image,p.atlasHash).sha256);
  assert.equal(p.standaloneReady,false);assert.equal(p.neutralExact,true);assert.equal(p.loopExact,true);assert.equal(p.visiblePackedPixelsExact,true);
  assert.equal(p.frames.length,64);assert.ok(p.frames.every(f=>f.edgePixels===0));assert.ok(p.frames.some(f=>f.changedPixels>1000));
  assert.equal(new Set(clip.frames).size,p.physicalFrames);assert.deepEqual(imageDimensions(clip.image),[clip.frameSize*4,clip.frameSize*Math.ceil(clip.frameCount/4)]);
  near(approvedArtSource(clip.image,p.atlasHash).mirrored?clip.frameSize-clip.pivotX+p.crop[0]:clip.pivotX+p.crop[0],256);near(clip.pivotY+p.crop[1],448);
  if(t==='pebble')assert.ok(p.poses.every(q=>q.compression===0&&q.sweep===0));else assert.ok(p.frames.every(f=>f.exactSupport));
 }
});
test('optional world idle image failures have a two-second retry without affecting other images',()=>{
 const code=readFileSync(new URL('./game.js',import.meta.url),'utf8').match(/^    function agentRangedImage\([^]*?^    }/m)[0];
 let now=1000,count=0;const cache=new Map();class Img{constructor(){this.complete=false;this.naturalWidth=0;count++;}}
 const scope=createContext({agentRangedImages:cache,SpawnerAssets:{image:()=>new Img()},Date:{now:()=>now},scheduleRender(){},assetSource:p=>p});runInContext(code,scope);
 const path=UNIT_SECRETION_IDLE_ANIMATIONS.spore.image;assert.equal(scope.agentRangedImage(path),null);const failed=cache.get(path);failed.complete=true;failed.onerror();
 for(let i=0;i<60;i++)scope.agentRangedImage(path);assert.equal(count,1);now=3001;scope.agentRangedImage(path);assert.equal(count,2);
 const loaded=cache.get(path);loaded.complete=true;loaded.naturalWidth=832;assert.equal(scope.agentRangedImage(path),loaded);
 scope.agentRangedImage(source('spore'));assert.equal(cache.get(source('spore')).onerror,undefined,'existing nonoptional loader remains unchanged');
});
test('VFX review scenes keep their preloaded neutral camera rather than requesting optional ambient assets',async()=>{
 const {rangedReviewState}=await import('./vfx-event-preview.mjs');
 for(const t of tribes){const data={source:agent(t),target:agent(t,{stats:{health:10}}),events:[]};const scene=rangedReviewState(data,12.1);
  assert.equal(scene.sourcePose.animation.image,UNIT_RANGED_FORMS[t].idle.image);assert.equal(scene.sourcePose.frame,0);assert.equal(scene.targetPose.animation.frameSize,UNIT_RANGED_FORMS[t].idle.frameSize);
  data.source.attack={mode:'ranged',startedAt:12,launchedAt:12.2,endsAt:12.8};assert.equal(rangedReviewState(data,12.1).sourcePose.action,'shoot');
 }
});
