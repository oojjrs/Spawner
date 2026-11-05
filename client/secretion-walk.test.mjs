import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { UNIT_SECRETION_WALK_ANIMATIONS, unitSecretionWalkPose } from './secretion-walk.mjs';
import { UNIT_ANIMATIONS, unitAnimationPose } from './unit-animation.mjs';

const tribes=['bean','spore','pebble','spring'];
const agent=(tribe,patch={})=>({id:'walk',tribe,health:10,facing:1,mode:'walk',moveStartedAt:10,moveDuration:2,stepCount:3,attributes:{secretion:1},...patch});
const form=tribe=>({walk:UNIT_SECRETION_WALK_ANIMATIONS[tribe]});

test('all four secretion walks retain their exact existing cell cadence without changing movement',()=>{
 for(const tribe of tribes)for(const facing of [-1,1]) {
  const unit=agent(tribe,{facing}),before=structuredClone(unit),seen=new Set();
  for(let i=0;i<240;i++) {
   const time=10+i/120,pose=unitSecretionWalkPose(unit,time,form(tribe));
   assert.equal(pose.action,'walk');assert.equal(pose.animation,UNIT_SECRETION_WALK_ANIMATIONS[tribe]);
   assert.equal(pose.mirrorX,facing<0);seen.add(pose.frame);
   if(tribe!=='bean')assert.equal(pose.frame,unitAnimationPose(unit,time).frame);
  }
  assert.equal(seen.size,UNIT_SECRETION_WALK_ANIMATIONS[tribe].frameCount);
  assert.deepEqual(unit,before);
  if(tribe!=='bean')assert.deepEqual(UNIT_SECRETION_WALK_ANIMATIONS[tribe].durationsMs,UNIT_ANIMATIONS[tribe].walk.durationsMs);
 }
});

test('walk requires its selected secretion form and exact live movement; interrupted actions keep precedence',()=>{
 for(const tribe of tribes){
  for(const time of [9.999,12,13,NaN,Infinity])assert.equal(unitSecretionWalkPose(agent(tribe),time,form(tribe)),null);
  for(const patch of [{health:0},{birth:{startedAt:10}},{moveDuration:0},{moveDuration:Infinity},{moveStartedAt:NaN},{species:'bubble-toad'},{mode:'harvest'},{mode:'unload'},{mode:'jump'},{hurtStartedAt:10.4},{attack:{startedAt:10.4,hitAt:10.7,endsAt:11.4}}])
   assert.equal(unitSecretionWalkPose(agent(tribe,patch),10.5,form(tribe)),null);
  assert.equal(unitSecretionWalkPose(agent(tribe),10.5,{}),null);
  assert.equal(unitSecretionWalkPose(agent(tribe),10.5,form(tribes[(tribes.indexOf(tribe)+1)%4])),null);
  assert.equal(unitSecretionWalkPose(agent(tribe,{mode:'carry',carrying:3}),10.5,form(tribe)).action,'walk');
 }
});

test('every batch clip records own-source provenance, unchanged camera and no complete-rig promotion',()=>{
 for(const tribe of tribes){
  const animation=UNIT_SECRETION_WALK_ANIMATIONS[tribe];
  assert.deepEqual([animation.frameSize,animation.viewSize,animation.pivotX,animation.pivotY],[512,512,256,448]);
  const provenance=JSON.parse(readFileSync(new URL(`../DesignAssets/Animations/UnitRangedV1/${tribe}/walk-provenance.json`,import.meta.url)));
  const source=readFileSync(new URL('../'+provenance.sourceImage,import.meta.url));
  assert.equal(provenance.sourceHash,createHash('sha256').update(source).digest('hex'));
  assert.equal(provenance.frameCount,animation.frameCount);assert.equal(provenance.noWorldReadyClaim,true);
  assert.ok(readFileSync(new URL('../'+animation.image,import.meta.url)).byteLength>1000);
 }
});

test('integrated ranged resolver keeps organs walking and prioritizes shot/hurt without replay after stopping',async()=>{
 const {unitRangedPose,UNIT_RANGED_FORMS,UNIT_RANGED_IMAGE_ASSETS}=await import('./unit-ranged.mjs');
 for(const tribe of tribes){
  const unit=agent(tribe);
  assert.equal(unitRangedPose(unit,10.5).animation,UNIT_SECRETION_WALK_ANIMATIONS[tribe]);
  assert.ok(UNIT_RANGED_IMAGE_ASSETS.includes(UNIT_SECRETION_WALK_ANIMATIONS[tribe].image));
  assert.equal(unitRangedPose(unit,12).action,'idle');
  assert.equal(unitRangedPose({...unit,hurtStartedAt:10.4},10.5).animation,UNIT_RANGED_FORMS[tribe].hurt);
  const shot={mode:'ranged',startedAt:10.4,launchedAt:10.6,hitAt:10.8,endsAt:11};
  assert.equal(unitRangedPose({...unit,attack:shot,hurtStartedAt:10.4,combat:{version:2}},10.5).action,'shoot');
  assert.equal(unitRangedPose({...unit,attributes:{blade:1,secretion:1}},10.5),null);
 }
});

test('actual world/detail drawing uses all four own-source walk atlases, mirrors, reduced motion and image fallback',async()=>{
 const {createContext,runInContext}=await import('node:vm');
 const {unitRangedPose,unitRangedDisplaySize}=await import('./unit-ranged.mjs');
 const code=readFileSync(new URL('./game.js',import.meta.url),'utf8').match(/^    function drawAgentRanged\([^]*?^    }/m)[0];
 const state={simSeconds:10.5},draws=[],scales=[];let available=true;
 const idleMotion={matches:false};
 const scope=createContext({Spawner:{unitRangedPose,unitRangedDisplaySize,unitAnimationPose},state,AGENT_HEIGHT:.7,idleMotion,unitDisplayScale:()=>1.5,
  agentRangedImage:path=>available?{path,naturalWidth:2048}:null});runInContext(code,scope);
 const context={save(){},restore(){},translate(){},scale(...x){scales.push(x)},drawImage(...x){draws.push(x)}};
 for(const tribe of tribes)for(const facing of [-1,1]){
  const unit=agent(tribe,{facing,stats:{pieceCount:6}}),before=structuredClone(unit);
  assert.equal(scope.drawAgentRanged(context,unit,50,80,70,null),true);
  assert.equal(draws.at(-1)[0].path,UNIT_SECRETION_WALK_ANIMATIONS[tribe].image);
  assert.deepEqual(scales.at(-1),[facing,1]);
  assert.ok(Math.abs(draws.at(-1).at(-1)*1.5-unitRangedDisplaySize(unit))<1e-10);
  assert.deepEqual(unit,before);
  idleMotion.matches=true;scope.drawAgentRanged(context,unit,50,80,70,null);assert.equal(draws.at(-1)[1],0);assert.equal(draws.at(-1)[2],0);idleMotion.matches=false;
  available=false;assert.equal(scope.drawAgentRanged(context,unit,50,80,70,null),false);available=true;
 }
});
