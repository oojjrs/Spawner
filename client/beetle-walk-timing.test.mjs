import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import * as beetle from '../server/beetle-animation.mjs';
import {unitMovementPosition} from './unit-animation.mjs';
const {BEETLE_ANIMATIONS,beetleAnimationPose,beetleAnimationFrame}=beetle;
const make=(duration=1.28)=>({id:'b',species:'spiny-back-beetle',health:10,mode:'walk',animationStartedAt:10,moveStartedAt:10,moveDuration:duration,stepCount:1,x:1,y:0,renderFromX:0,renderFromY:0,facing:1});
const context=createContext({});runInContext(readFileSync(new URL('./movement-audio.js',import.meta.url),'utf8'),context);const audio=context.SpawnerMovementAudio;
test('beetle uses every authored phase within each cell at slow and fast movement speeds',()=>{
 for(const duration of [.2,.4,1/1.2,1.28,2.56])for(const facing of [-1,1]){
  const a=make(duration);a.facing=facing;let elapsed=0;const before=JSON.stringify(a);
  for(let i=0;i<BEETLE_ANIMATIONS.walk.frames.length;i++){
   const p=(elapsed+BEETLE_ANIMATIONS.walk.durations[i]/2)/1280;
   assert.equal(beetleAnimationPose(a,10+p*duration).frame,BEETLE_ANIMATIONS.walk.frames[i]);
   assert.ok(Math.abs(unitMovementPosition(a,10+p*duration).x-p)<1e-10);
   elapsed+=BEETLE_ANIMATIONS.walk.durations[i];
  }
  assert.equal(JSON.stringify(a),before,'rendering must not mutate gameplay');
  assert.equal(unitMovementPosition(a,10).x,0);assert.ok(Math.abs(unitMovementPosition(a,10+duration).x-1)<1e-10);
 }
});
test('beetle rest, future moves, zero duration and consecutive snapshot boundaries are stable',()=>{
 const a=make(.4);assert.equal(beetleAnimationPose(a,9.99).action,'idle');
 assert.equal(beetleAnimationPose(a,10.399).action,'walk');assert.equal(beetleAnimationPose(a,10.4).action,'idle');
 const snapshot=JSON.parse(JSON.stringify(a));assert.deepEqual(beetleAnimationPose(snapshot,10.27),beetleAnimationPose(a,10.27));
 snapshot.moveStartedAt=10.4;snapshot.stepCount=2;assert.equal(beetleAnimationPose(snapshot,10.4).frame,4);
 snapshot.moveDuration=0;assert.equal(beetleAnimationPose(snapshot,10.4).action,'idle');
 snapshot.mode='idle';assert.equal(beetleAnimationPose(snapshot,10.5).frame,beetleAnimationFrame('idle',500));
});
test('beetle movement audio keeps all four contacts without duplicates at cell boundaries',()=>{
 for(const duration of [.2,.4,1.28,2.56]){
  const a=make(duration),playback=audio.create();audio.update(playback,[],9.99,beetle);
  for(let cell=0;cell<2;cell++){
   a.moveStartedAt=10+cell*duration;a.stepCount=cell+1;const contacts=[];
   for(let i=0;i<100;i++){
    const time=a.moveStartedAt+i*duration/100;
    const events=audio.update(playback,[a],time,beetle);
    for(const event of events){assert.equal(event.name,'move-spiny-back-beetle');contacts.push(i);}
    assert.equal(audio.update(playback,[a],time,beetle).length,0);
    assert.ok(Math.abs(playback.units.get('b').phase-i/100)<1e-9);
   }
   assert.deepEqual(contacts,[0,25,50,75]);
  }
  a.mode='idle';assert.equal(audio.update(playback,[a],10+2*duration,beetle).length,0);
  assert.equal(playback.units.has('b'),false);
 }
});
