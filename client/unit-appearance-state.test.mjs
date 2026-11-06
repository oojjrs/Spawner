import test from'node:test';import assert from'node:assert/strict';
import{unitActionState,unitAppearanceStatePose,createUnitAppearanceEventPlayback}from'./unit-appearance-state.mjs';
const clip=(ms,events=[],loop=false)=>({sourceId:'same-source',durationsMs:[ms],events,loop});
const clips={idle:clip(1000,[],true),walk:clip(1000,[{type:'contact',atMs:0},{type:'contact',atMs:500}],true),carry:clip(1000,[],true),ranged:{...clip(600,[{type:'launch',atMs:200}]),launchAtMs:200},attack:{...clip(1000),hitTimeMs:300},hurt:clip(760),death:clip(1800),birth:clip(2000),throw:clip(450),harvest:clip(1000,[],true),jump:clip(1100)};
const agent=()=>({id:'one',tribe:'bean',health:10,bornAt:0,moveDuration:1,moveStartedAt:0,moveAnimationStartedAt:0,stepCount:1,mode:'walk',carrying:0});
const state=(a,t,options={})=>unitActionState(a,t,{animations:clips,...options});
test('same priority handles death/birth, RPG attack, hurt, throw, harvest, preview, carry and idle',()=>{
 const a={...agent(),attack:{startedAt:0,endsAt:1,hitAt:.3},hurtStartedAt:0,combat:{version:2}};
 assert.equal(state(a,.05).action,'attack');a.health=0;assert.equal(state(a,.05).action,'death');a.health=10;a.birth={startedAt:0,readyAt:2};assert.equal(state(a,.05).action,'birth');delete a.birth;delete a.combat;assert.equal(state(a,.05).action,'hurt');delete a.hurtStartedAt;delete a.attack;a.mode='unload';a.foodDelivery={startedAt:0};assert.equal(state(a,.2).action,'throw');a.mode='harvest';assert.equal(state(a,.2).action,'harvest');a.mode='walk';assert.equal(state(a,.2,{preview:{action:'jump',startedAt:0}}).action,'jump');a.carrying=1;assert.equal(state(a,.2).action,'carry');a.moveDuration=0;assert.equal(state(a,.2).action,'idle');assert.equal(unitAppearanceStatePose(a,.2),null);
});
test('world ranged launch uses launchedAt while the laboratory explicitly uses hitAt',()=>{
 const a={...agent(),attack:{startedAt:0,endsAt:.6,launchedAt:.2,hitAt:.5,dnaRanged:true}};
 assert.equal(state(a,.2).elapsedMs,200);delete a.attack.launchedAt;
 assert.equal(state(a,.2).hasLaunchAnchor,false);assert.equal(state(a,.5,{attackClock:'lab'}).elapsedMs,200);
 const p=createUnitAppearanceEventPlayback();p.update(state(a,0),clips.ranged,0);assert.equal(p.update(state(a,.2),clips.ranged,.2).length,0);
});
test('absolute cue timestamps dedupe rerenders and consecutive movement cells',()=>{
 const a=agent(),p=createUnitAppearanceEventPlayback();assert.equal(p.update(state(a,0),clips.walk,0).length,0);
 let event=p.update(state(a,.5),clips.walk,.5)[0];assert.equal(event.at,.5);assert.equal(event.cycle,0);assert.equal(p.update(state(a,.5),clips.walk,.5).length,0);
 a.moveStartedAt=1;a.stepCount=2;event=p.update(state(a,1),clips.walk,1)[0];assert.equal(event.at,1);assert.equal(event.cycle,1);assert.equal(p.update(state(a,1),clips.walk,1).length,0);
 assert.equal(p.update(state(a,1.5),clips.walk,1.5)[0].at,1.5);assert.equal(p.update(state(a,10),clips.walk,10).length,0);
});
test('RPG hurt consumes its full source clip in the native 120 milliseconds',()=>{const a={...agent(),combat:{version:2},hurtStartedAt:1};assert.equal(state(a,1.06).action,'hurt');assert.ok(Math.abs(state(a,1.06).elapsedMs-380)<1e-8);assert.notEqual(state(a,1.12).action,'hurt')});
