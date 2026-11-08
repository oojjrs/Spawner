import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as animation from './unit-animation.mjs';
import * as geometry from './image-geometry.mjs';
import * as size from './unit-size.mjs';
import {creatureStrideFrame,creaturePresentationPose,createCreatureStrideClock} from './creature-presentation.mjs';
import {TALON_OWL_IDLE} from './talon-owl-idle.mjs';
const model={...animation,...geometry,...size,TALON_OWL_IDLE};
const registrations={
 'white-paw':{scale:1.3295454545454546,display:.647032967032967},
 'shadow-weasel':{scale:1.4701704545454546,display:.3287600644122383}
};
const make=(species,extra={})=>({id:species,species,health:10,mode:'walk',facing:-1,moveStartedAt:5,
 moveDuration:1/animation.creatureAnimationSpeed(species),stepCount:1,renderFromX:10,renderFromY:7,x:9,y:7,...extra});
const setup=species=>{
 const clip=animation.CREATURE_WALK_ANIMATIONS[species],r=registrations[species];
 const entry={animation:clip,scale:r.scale,sprite:{complete:true,naturalWidth:clip.frameSize*clip.columns}};
 const resources={walk:new Map([[species,entry]]),walkDisplayScale:()=>r.display};
 const sizePerCell=1.4*r.scale*clip.frameSize/(clip.viewSize||clip.frameSize);
 return {clip,r,resources,sizePerCell,stride:clip.strideFrameRatio*sizePerCell*r.display};
};

test('two measured gaits follow root distance without changing gameplay speed, step duration or state',()=>{
 for(const species of Object.keys(registrations)){
  const a=make(species),before=structuredClone(a),{clip,resources,stride}=setup(species);
  assert.equal(animation.creatureAnimationSpeed(species),species==='white-paw'?1.1:1.07);
  const frames=new Set();
  for(let i=0;i<120;i++){
   const time=5+a.moveDuration*i/120,rootBefore=animation.unitMovementPosition(a,time);
   const p=creaturePresentationPose(model,a,time,false,resources,'walk');frames.add(p.frame);
   assert.equal(p.frame,animation.unitAnimationFrame(clip,(i/120)/stride*clip.durationMs));
   assert.deepEqual(animation.unitMovementPosition(a,time),rootBefore);
  }
  assert.ok(frames.size>40);assert.deepEqual(a,before);
 }
});

test('planted-foot velocity cancels the exact horizontal game root at both facings and changed movement speeds',()=>{
 for(const species of Object.keys(registrations))for(const facing of [-1,1])for(const speedRatio of [.5,1,1.8]){
  const {clip,resources,stride}=setup(species),a=make(species,{facing,x:10+facing});a.moveDuration/=speedRatio;
  const cycle=a.moveDuration*stride;
  let reference;
  for(let i=0;i<=30;i++){
   const phase=i/64,time=5+cycle*phase,p=creaturePresentationPose(model,a,time,false,resources,'walk');
   const root=animation.unitMovementPosition(a,time).x;
   const planted=root-facing*phase*stride;
   if(reference===undefined)reference=planted;
   assert.ok(Math.abs(planted-reference)<1e-10);
   assert.equal(p.mirrorX,facing===1);
  }
 }
});

test('cell transitions keep the same distance clock and stop exactly at move completion',()=>{
 for(const species of Object.keys(registrations)){
  const {clip,resources,stride}=setup(species),a=make(species),end=5+a.moveDuration;
  const next={...a,stepCount:2,moveStartedAt:end,renderFromX:9,x:8};
  assert.equal(creaturePresentationPose(model,a,end,false,resources,'walk'),null);
  const p=creaturePresentationPose(model,next,end,false,resources,'walk');
  assert.equal(p.frame,animation.unitAnimationFrame(clip,clip.durationMs/stride));
  assert.equal(creaturePresentationPose(model,{...next,mode:'idle',moveDuration:0},end,false,resources,'walk'),null);
  assert.equal(creaturePresentationPose(model,{...next,health:0},end,false,resources,'walk'),null);
  assert.equal(creaturePresentationPose(model,next,end-.001,false,resources,'walk'),null);
 }
});

test('render scale changes cadence and diagonals use actual distance while camera zoom cannot enter the clock',()=>{
 for(const species of Object.keys(registrations)){
  const {clip,resources,stride}=setup(species),a=make(species,{y:8}),time=5+a.moveDuration*.23;
  for(const displayMultiplier of [.5,1,2]){
   const scaled={...resources,walkDisplayScale:()=>registrations[species].display*displayMultiplier};
   const p=creaturePresentationPose(model,a,time,false,scaled,'walk');
   assert.equal(p.frame,animation.unitAnimationFrame(clip,.23*Math.SQRT2/(stride*displayMultiplier)*clip.durationMs));
  }
 }
});

test('welcome and callers without calibrated scale retain their authored clock; reduced motion remains still',()=>{
 for(const species of Object.keys(registrations)){
  const {resources}=setup(species),a=make(species),time=5.137;
  const uncalibrated={...resources};delete uncalibrated.walkDisplayScale;
  assert.equal(creaturePresentationPose(model,a,time,false,uncalibrated,'walk').frame,animation.creatureWalkPose(a,time).frame);
  assert.equal(creaturePresentationPose(model,a,time,true,resources,'walk').frame,0);
  assert.equal(creatureStrideFrame(model,a,time,animation.CREATURE_WALK_ANIMATIONS[species],NaN),null);
 }
 const header=readFileSync(new URL('./welcome-header.js',import.meta.url),'utf8');
 assert.doesNotMatch(header,/walkDisplayScale/);
 const game=readFileSync(new URL('./game.js',import.meta.url),'utf8');
 assert.match(game,/walkDisplayScale: unitDisplayScale/);
});


test('combat projected-distance clock freezes on held snapshots, reverses on retreat and isolates agents and encounters',()=>{
 const clock=createCreatureStrideClock(),clip=animation.CREATURE_WALK_ANIMATIONS['white-paw'];
 const a={id:'a',species:'white-paw',facing:-1,combat:{position:{moving:true,moveStartedAt:0}}},before=structuredClone(a);
 const sample=(time,x,id='a',scope='one')=>clock.frame(model,{...a,id},time,clip,.5,{x,y:0},scope);
 assert.equal(sample(0,2),0);assert.equal(sample(.1,1.875),16);
 assert.equal(sample(.2,1.875),16);assert.equal(sample(.2,1.875),16);
 assert.equal(sample(.3,2),0);assert.equal(sample(.4,2.125),48);
 assert.equal(sample(.4,2.125,'b'),0);assert.equal(sample(.4,2.125,'a','two'),0);
 assert.equal(sample(.1,2.125),0);assert.deepEqual(a,before);
 clock.clear();assert.equal(sample(.5,2),0);
});

test('combat distance clock changes only by actual rendered travel and handles scale changes without phase jumps',()=>{
 const clock=createCreatureStrideClock(),clip=animation.CREATURE_WALK_ANIMATIONS['shadow-weasel'];
 const a={id:'s',species:'shadow-weasel',facing:1,combat:{position:{moving:true,moveStartedAt:0}}};
 assert.equal(clock.frame(model,a,0,clip,.4,{x:0,y:0}),0);
 assert.equal(clock.frame(model,a,.1,clip,.4,{x:.1,y:0}),16);
 assert.equal(clock.frame(model,a,.2,clip,.8,{x:.1,y:0}),16);
 assert.equal(clock.frame(model,a,10,clip,.8,{x:.1,y:0}),16);
 assert.equal(clock.frame(model,a,.2,clip,.8,{x:.1,y:0}),0);
 clock.clear();clock.frame(model,a,0,clip,.4,{x:0,y:0});clock.frame(model,a,.1,clip,.4,{x:.1,y:0});
 assert.equal(clock.frame(model,a,.3,clip,.8,{x:.3,y:0}),32);
 a.combat.position.moveStartedAt=.3;
 assert.equal(clock.frame(model,a,.4,clip,.8,{x:.3,y:0}),0);
 assert.equal(clock.frame(model,a,.5,clip,0,{x:.4,y:0}),null);
});

test('actual combat stage holds stride cells while roots are still and advances them only with movement',async()=>{
 const {createCombatStage}=await import('./combat-stage.mjs');
 const original={window:globalThis.window,Image:globalThis.Image,document:globalThis.document,assets:globalThis.SpawnerAssets};
 const draws=[];
 globalThis.window={devicePixelRatio:1,matchMedia:()=>({matches:false})};
 globalThis.Image=class{constructor(){this.complete=true;this.naturalWidth=2048;this.naturalHeight=2048;this.width=2048;this.height=2048;}async decode(){}};
 globalThis.SpawnerAssets={source:p=>p,image:()=>new globalThis.Image()};
 globalThis.document={createElement:()=>({width:1,height:1,getContext(){return new Proxy({getImageData:()=>({data:new Uint8ClampedArray(this.width*this.height*4).fill(255)})},{get:(o,k)=>o[k]||(()=>{})});}})};
 const ctx=new Proxy({drawImage(image,...args){if(image.src?.includes('walk-stride-v6'))draws.push({image:image.src,sx:args[0],sy:args[1]});}},{get:(o,k)=>o[k]||(()=>{})});
 const canvas={clientWidth:1000,clientHeight:560,width:1000,height:560,getContext:()=>ctx};
 try{
  const agents=['white-paw','shadow-weasel'].map((species,i)=>({id:'stage'+i,species,health:10,mode:'fight',facing:i?-1:1,stats:{health:10},combat:{id:'stride',side:i,stunnedUntil:0,position:{moving:true,moveStartedAt:1,x:i?3:-3,y:0,homeX:i?3:-3,homeY:0}}}));
  const trial={agents,time:1,history:[],result:()=>null},stage=createCombatStage(canvas);await stage.prepare(trial);
  const render=()=>{draws.length=0;stage.render(trial,trial.time*1000,false);return structuredClone(draws);};
  const first=render();assert.equal(first.length,2);
  trial.time=1.1;assert.deepEqual(render(),first);
  agents[0].combat.position.x+=.12;agents[1].combat.position.x-=.12;trial.time=1.2;
  const before=structuredClone(trial.agents),moved=render();assert.equal(moved.length,2);
  assert.ok(moved.every((v,i)=>v.sx!==first[i].sx||v.sy!==first[i].sy));assert.deepEqual(trial.agents,before);
  trial.time=1.3;assert.deepEqual(render(),moved);
  stage.clear();trial.time=1;assert.deepEqual(render(),first);
 }finally{globalThis.window=original.window;globalThis.Image=original.Image;globalThis.document=original.document;if(original.assets===undefined)delete globalThis.SpawnerAssets;else globalThis.SpawnerAssets=original.assets;}
});


test('spawn-only movement copies the authored origin without changing the source actor or world duration',()=>{
 const game=readFileSync(new URL('./game.js',import.meta.url),'utf8');
 const source=game.match(/^    function drawCreatureSpawn\([^]*?^    }/m)[0];
 assert.equal((source.match(/renderFromX: agent.spawn.fromX, renderFromY: agent.spawn.fromY/g)||[]).length,2);
 for(const species of Object.keys(registrations)){
  const {clip,resources,stride}=setup(species),actor=make(species,{moveDuration:0,renderFromX:9,spawn:{startedAt:5,readyAt:6,fromX:10,fromY:7}}),before=structuredClone(actor);
  const moving={...actor,mode:'walk',moveStartedAt:actor.spawn.startedAt,moveDuration:actor.spawn.readyAt-actor.spawn.startedAt,stepCount:1,renderFromX:actor.spawn.fromX,renderFromY:actor.spawn.fromY};
  const pose=creaturePresentationPose(model,moving,5.2,false,resources,'walk');
  assert.equal(pose.frame,animation.unitAnimationFrame(clip,.2/stride*clip.durationMs));assert.deepEqual(actor,before);
 }
});

test('compiled runtime preserves the same calibrated frames and stopped-snapshot clock as module sources',()=>{
 const context={console};runInNewContext(readFileSync(new URL('./runtime.js',import.meta.url),'utf8'),context);
 const compiled=context.Spawner;
 assert.equal(typeof compiled.creatureStrideFrame,'function');
 assert.equal(typeof compiled.createCreatureStrideClock,'function');
 for(const species of Object.keys(registrations))for(const facing of[-1,1]){
  const a=make(species,{facing}),{clip,sizePerCell,r}=setup(species);
  for(let i=0;i<=120;i++){
   const time=a.moveStartedAt+a.moveDuration*i/120;
   assert.equal(compiled.creatureStrideFrame(compiled,a,time,clip,sizePerCell*r.display),
    creatureStrideFrame(model,a,time,clip,sizePerCell*r.display));
  }
  const sourceClock=createCreatureStrideClock(),runtimeClock=compiled.createCreatureStrideClock();
  for(const [time,x] of[[0,0],[.1,.1],[.2,.1],[10,.1],[10.1,0]]){
   assert.equal(runtimeClock.frame(compiled,a,time,clip,.4,{x,y:0}),sourceClock.frame(model,a,time,clip,.4,{x,y:0}));
  }
 }
});
