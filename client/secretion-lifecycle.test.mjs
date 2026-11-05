import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {UNIT_SECRETION_LIFECYCLE_ANIMATIONS as clips} from './secretion-lifecycle.mjs';
import {UNIT_RANGED_IMAGE_ASSETS,unitRangedLifecycleAnimation,unitRangedPose} from './unit-ranged.mjs';
import {unitDisplayAttributes} from './unit-display-appearance.mjs';
import {unitAppearanceInventory} from './unit-appearance.mjs';
import {SPORE_BIRTH_ANIMATION,PEBBLE_BIRTH_ANIMATION,SPRING_BIRTH_ANIMATION,sporeBirthMotion,springBirthMotion} from './birth.mjs';
import {agentDeathAnimation,agentDeathFrame,AGENT_DEATH_ANIMATION} from './agent-death.mjs';
import {imageScale,imageFrameGeometry} from './image-geometry.mjs';
import {UNIT_ANIMATIONS} from './unit-animation.mjs';
import {createCombatStage} from './combat-stage.mjs';
const agent=(patch={})=>({id:'spore',tribe:'spore',health:10,facing:1,attributes:{secretion:1,carapace:1,antenna:1,feet:1},...patch});
const game=readFileSync(new URL('./game.js',import.meta.url),'utf8');
const extract=name=>game.match(new RegExp('^    function '+name+'\\([^]*?^    }','m'))[0];

test('lifecycle hook preserves dominant selection, authored geometry/timing and readiness',()=>{
 for(const [tribe,actions]of Object.entries(clips))for(const[action,clip]of Object.entries(actions)){
  const base=action==='death'?(tribe==='bean'?AGENT_DEATH_ANIMATION:UNIT_ANIMATIONS[tribe].death):({spore:SPORE_BIRTH_ANIMATION,pebble:PEBBLE_BIRTH_ANIMATION,spring:SPRING_BIRTH_ANIMATION})[tribe];
  assert.equal(unitRangedLifecycleAnimation(agent({tribe,health:action==='death'?0:10,birth:action==='birth'?{}:null}),action),clip);
  for(const key of ['frameSize','frameCount','columns','pivotX','pivotY','viewSize','registrationScale'])assert.equal(clip[key],base[key]);
  assert.deepEqual(clip.durationsMs,base.durationsMs);assert.ok(UNIT_RANGED_IMAGE_ASSETS.includes(clip.image));
 }
 assert.equal(unitRangedLifecycleAnimation(agent({birth:{startedAt:1}}),'birth'),clips.spore.birth);
 assert.equal(unitRangedLifecycleAnimation(agent({health:0}),'death'),clips.spore.death);
 assert.equal(unitRangedLifecycleAnimation(agent({health:undefined,kind:'corpse'}),'death'),clips.spore.death);
 for(const a of [agent(),agent({species:'bubble-toad',health:0}),agent({health:0,attributes:{blade:1,secretion:1}})])assert.equal(unitRangedLifecycleAnimation(a,'death'),null);
 assert.equal(unitRangedLifecycleAnimation(agent({health:0,birth:{startedAt:1}}),'birth'),null);
 assert.equal(unitRangedLifecycleAnimation(agent(),'birth'),null);
 assert.equal(unitRangedLifecycleAnimation(agent({tribe:'bean',birth:{}}),'birth'),null);
 assert.equal(unitRangedPose(agent({health:0}),2),null);
 assert.equal(unitAppearanceInventory().some(item=>item.worldReady),false);
});

test('actual birth draw preserves mirror/scene motion, missing-art fallback and exact idle handoff',()=>{
 let available=true;const draws=[],scales=[],handoffs=[],outlines=[],sheet={path:clips.spore.birth.image},base={path:'existing-birth-frame'};
 const scope=createContext({Spawner:{SPORE_BIRTH_ANIMATION,unitRangedLifecycleAnimation,sporeBirthMotion,imageScale},
  SpawnerAppearance:{unitAppearanceBirthSceneForAgent:()=>null},idleMotion:{matches:false},
  tribeArt:{animationFrame:()=>null},sporeBirthSheet:{},sporeBirthFrames:new Map(Array.from({length:22},(_,i)=>[i,base])),
  agentRangedImage:()=>available?sheet:null,AGENT_HEIGHT:.7,
  drawAgentAppearanceLayer:(...args)=>handoffs.push(args),drawSelectionOutline:(...args)=>outlines.push(args)});
 runInContext(extract('drawSporeBirth'),scope);
 const ctx=new Proxy({drawImage:(...args)=>draws.push(args),scale:(...args)=>scales.push(args)},{get:(o,k)=>o[k]||(()=>{})});
 const a=agent({birth:{startedAt:1}}),before=structuredClone(a);
 for(const facing of [-1,1])for(const frame of [2,8,9,20]){
  draws.length=0;scales.length=0;
  const birth={unitVisible:true,frame,elapsed:1.3,scale:.004,facing,x:2,y:3};
  scope.drawSporeBirth(ctx,0,a,birth,{x:10,y:20},100,'outline');
  assert.equal(draws[0][0],sheet);assert.deepEqual(draws[0].slice(1,5),[frame%4*192,Math.floor(frame/4)*192,192,192]);assert.deepEqual(scales[0],[facing,1]);
  assert.equal(outlines.at(-1).at(-2).index,frame);
  available=false;draws.length=0;scope.drawSporeBirth(ctx,0,a,birth,{x:10,y:20},100,null);assert.equal(draws[0][0],base);available=true;
 }
 for(const reduced of [false,true]){
  scope.idleMotion.matches=reduced;draws.length=0;
  scope.drawSporeBirth(ctx,0,a,{unitVisible:true,frame:reduced?8:21,x:2,y:3},{x:10,y:20},100,null);
  assert.equal(draws.length,0);assert.equal(handoffs.at(-1)[2].birth,null);assert.deepEqual(handoffs.at(-1)[2].attributes,a.attributes);
 }
 assert.deepEqual(a,before);
});

test('world/detail corpse draw changes only the art sheet and retains frame, scale and fallback',()=>{
 for(const tribe of ['bean','spore','pebble','spring']){
 let available=true,time=10;const draws=[],sheet={path:clips[tribe].death.image},base={path:clips[tribe].death.bodyReferenceImage,complete:true,naturalWidth:2212};
 const scope=createContext({Spawner:{unitDisplayAttributes,hasCombatEvolution:()=>false,unitRangedLifecycleAnimation,agentDeathAnimation,imageFrameGeometry},
  combatAttributeArt:{ready:()=>false},corpsePlaybackTime:()=>time,agentDeathFrame,idleMotion:{matches:false},
  unitAnimationSheets:new Map([[tribe,new Map([['death',{sprite:base,scale:1}]])]]),
  agentRangedImage:()=>available?sheet:null,AGENT_HEIGHT:.7,tribeArt:{animationFrame:()=>null},
  state:{simSeconds:time},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),drawSelectionOutline(){}});
 runInContext(extract('drawAgentCorpse'),scope);
 const ctx=new Proxy({globalAlpha:1,drawImage:(...args)=>draws.push(args)},{get:(o,k)=>o[k]||(()=>{})});
 const a=agent({tribe,health:0,kind:'corpse',diedAt:10}),before=structuredClone(a);
 for(const age of [0,.13,.65,2]){
  time=10+age;draws.length=0;available=true;assert.equal(scope.drawAgentCorpse(ctx,a,40,80,100,null,1),true);
  const actual=draws.at(-1);assert.equal(actual[0],sheet);
  available=false;scope.drawAgentCorpse(ctx,a,40,80,100,null,1);assert.equal(draws.at(-1)[0],base);assert.deepEqual(draws.at(-1).slice(1),actual.slice(1));
 }
 assert.deepEqual(a,before);
 }
});

test('laboratory death uses the same authored geometry and recovers without resurrecting cached living art',()=>{
 for(const tribe of ['bean','spore','pebble','spring']){
 const saved={window:globalThis.window,Image:globalThis.Image,SpawnerAssets:globalThis.SpawnerAssets},nowFn=Date.now;
 let missing=true,clock=1000;const draws=[];
 try{
  globalThis.window={matchMedia:()=>({matches:false}),devicePixelRatio:1};globalThis.SpawnerAssets=undefined;Date.now=()=>clock;
  globalThis.Image=class{complete=true;naturalWidth=2212;naturalHeight=1106;set src(path){this.path=path;this.naturalWidth=missing&&path===clips[tribe].death.image?0:2212;}};
  const ctx=new Proxy({drawImage:(img,...args)=>draws.push({path:img.path,args})},{get:(o,k)=>o[k]||(()=>{})});
  const stage=createCombatStage({clientWidth:1040,clientHeight:480,getContext:()=>ctx});
  const a=agent({tribe,combat:{version:2,side:0,stunnedUntil:0},stats:{health:10}}),other={...agent({id:'bean',tribe:'bean',attributes:{},stats:{health:10}}),combat:{version:2,side:1,stunnedUntil:0}};
  const trial={agents:[a,other],history:[],projectiles:[],time:1,result:()=>null};
  stage.render(trial,1000,false);a.health=0;draws.length=0;stage.render(trial,1010,false);
  const fallback=draws.find(x=>x.path===clips[tribe].death.bodyReferenceImage);assert.ok(fallback);assert.equal(draws.some(x=>x.path.endsWith('/'+tribe+'/Source/neutral.png')),false);
  missing=false;clock+=2100;draws.length=0;stage.render(trial,1020,false);
  const life=draws.find(x=>x.path===clips[tribe].death.image);assert.ok(life);assert.deepEqual(life.args.slice(4),fallback.args.slice(4));
 }finally{Object.assign(globalThis,saved);Date.now=nowFn;}
 }
});


test('pebble and spring birth retain scene rendering, crops, fallback and exact terminal idle',()=>{
 for(const tribe of ['pebble','spring']){
  const animation=tribe==='pebble'?PEBBLE_BIRTH_ANIMATION:SPRING_BIRTH_ANIMATION;
  let available=true;const calls=[],handoffs=[],water=[],base={complete:true,naturalWidth:animation.frameSize*animation.columns},sheet={path:clips[tribe].birth.image};
  const ctx=new Proxy({drawImage:(...args)=>calls.push(args)},{get:(o,k)=>o[k]||(()=>{})});
  const scope=createContext({Spawner:{unitRangedLifecycleAnimation,springBirthMotion,
    drawSpringBirthWater:(...args)=>water.push(args),drawSpringBirthSurface:(...args)=>calls.push(args.slice(1))},
    SpawnerAppearance:{unitAppearanceBirthSceneForAgent:()=>null},SPRING_BIRTH_ANIMATION,PEBBLE_BIRTH_ANIMATION,
    springBirthSheet:base,pebbleBirthSheet:base,pebbleBirthForeground:{complete:false},colonyEntries:[],
    tribeArt:{animationFrame:()=>null},agentRangedImage:()=>available?sheet:null,AGENT_HEIGHT:.7,idleMotion:{matches:false},
    drawAgentAppearanceLayer:(...args)=>handoffs.push(args),drawSelectionOutline(){}});
  const fn='draw'+tribe[0].toUpperCase()+tribe.slice(1)+'Birth';runInContext(extract(fn),scope);
  const a=agent({tribe,birth:{colonyId:'c'}}),before=structuredClone(a);
  for(const frame of [0,2,animation.frameCount-2]){
   const birth={frame,elapsed:.6,x:2,y:3};calls.length=0;scope[fn](ctx,0,a,birth,{x:10,y:20},100,null);
   const actual=calls.at(-1);assert.equal(actual[0],sheet);
   if(tribe==='pebble')assert.deepEqual(actual.slice(1,5),[frame%animation.columns*animation.frameSize,Math.floor(frame/animation.columns)*animation.frameSize,animation.frameSize,animation.frameSize]);
   else {assert.equal(actual[1].x,frame%animation.columns*animation.frameSize);assert.equal(actual[1].y,Math.floor(frame/animation.columns)*animation.frameSize);assert.ok(water.length);}
   available=false;scope[fn](ctx,0,a,birth,{x:10,y:20},100,null);assert.equal(calls.at(-1)[0],base);assert.deepEqual(calls.at(-1).slice(1),actual.slice(1));available=true;
  }
  calls.length=0;scope[fn](ctx,0,a,{frame:animation.frameCount-1,x:2,y:3},{x:10,y:20},100,null);assert.equal(calls.length,0);assert.equal(handoffs.at(-1)[2].birth,null);assert.deepEqual(a,before);
 }
});
