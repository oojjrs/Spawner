import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import * as animation from './unit-animation.mjs';
import * as geometry from './image-geometry.mjs';
import * as size from './unit-size.mjs';
import { creaturePresentationPose, createCreatureStrideClock } from './creature-presentation.mjs';
import { creatureIdleSheetScale, unitDisplayMetrics } from './unit-presentation-assets.mjs';
import { welcomeStridePixels, welcomeTravelMotion } from './welcome-presentation.mjs';
import { NEUTRAL_UNIT_STATS } from '../server/neutral-unit-stats.mjs';
const model = { ...animation, ...geometry, ...size }, species = 'soil-mole';
const clip = animation.CREATURE_WALK_ANIMATIONS[species], idle = animation.CREATURE_IDLE_ANIMATIONS[species];
const bounds = { x: 47, y: 114, width: 283, height: 199 };
const scale = creatureIdleSheetScale(idle, bounds);
const display = unitDisplayMetrics(size.unitDisplaySize({species}), idle, bounds, 1.4 * scale * idle.registrationScale).scale;
const body = 1.4 * scale * clip.frameSize / clip.viewSize * display;
const stride = clip.strideFrameRatio * body;
const entry = { animation: clip, scale, sprite: { complete: true, naturalWidth: 1024 } };
const resources = { walk: new Map([[species, entry]]), walkDisplayScale: () => display };
const make = (extra = {}) => ({ id: 'mole', species, health: 10, mode: 'walk', facing: -1, moveStartedAt: 5,
  moveDuration: 1 / animation.creatureAnimationSpeed(species), stepCount: 1, renderFromX: 10, renderFromY: 7, x: 9, y: 7, ...extra });
const near = (a,b,message) => assert.ok(Math.abs(a-b) < 1e-7, `${message}: ${a} vs ${b}`);
const hash = file => createHash('sha256').update(readFileSync(new URL('../' + file, import.meta.url))).digest('hex');
const starts = clip.durationsMs.map((_,i) => clip.durationsMs.slice(0,i).reduce((a,b) => a+b,0));

test('approved eight whole-body poses have one fixed camera, source identity, and no gameplay change', () => {
  const publication = JSON.parse(readFileSync(new URL('../AnimationCandidates/mole-smooth-arm-v2-20261106/mole-grounded-walk-v3-publication.json', import.meta.url)));
  assert.equal(clip.image, publication.image);
  assert.equal(hash(clip.image), publication.imageSHA256);
  assert.equal(hash(publication.approvedSheet), publication.approvedSheetSHA256);
  assert.equal(clip.frameCount, 8); assert.equal(clip.columns, 4); assert.equal(clip.frameSize, 256);
  assert.equal(clip.viewSize, 256); assert.equal(clip.durationMs, 640);
  assert.equal(clip.frameGeometry, undefined); assert.equal(clip.sourceFacing, 'left');
  assert.deepEqual(clip.durationsMs, [180,80,80,80,110,50,40,20]);
  assert.equal(clip.pivotX, 127.25); assert.equal(clip.pivotY, 181.75);
  assert.equal(NEUTRAL_UNIT_STATS[species].movement, .65);
  assert.equal(animation.creatureAnimationSpeed(species), .65);
  assert.equal(size.unitDisplaySize({species}), .375);
});

test('mole gait follows real root distance at both facings, all supported display sizes and terrain speeds', () => {
  for (const facing of [-1,1]) for (const speedRatio of [.5,1,1.8]) for (const multiplier of [.5,1,2]) {
    const a = make({ facing, x: 10 + facing }); a.moveDuration /= speedRatio;
    const before = structuredClone(a), local = {...resources, walkDisplayScale: () => display * multiplier}, frames = new Set();
    for (let i=0; i<240; i++) {
      const time = 5 + a.moveDuration * i/240, root = animation.unitMovementPosition(a,time);
      const p = creaturePresentationPose(model,a,time,false,local,'walk'); frames.add(p.frame);
      assert.equal(p.frame, animation.unitAnimationFrame(clip,i/240/(stride*multiplier)*clip.durationMs));
      assert.equal(p.mirrorX, facing === 1);
      assert.deepEqual(animation.unitMovementPosition(a,time),root);
    }
    assert.equal(frames.size,8); assert.deepEqual(a,before);
  }
});

test('independent near/far claw landmarks cancel travel at support keys within 0.1px at zoom96', () => {
  // Measured from the approved 512px PNG keys, not fitted from the renderer.
  const contacts = [{frames:[0,1,2],x:[226,286,313]},{frames:[4,5],x:[92,128]}];
  for (const facing of [-1,1]) for (const contact of contacts) {
    const world = contact.frames.map((frame,i) => {
      const travel = starts[frame]/clip.durationMs * stride;
      return facing*travel - facing*contact.x[i]/512*body;
    });
    assert.ok((Math.max(...world)-Math.min(...world))*96 < .1);
  }
  // Eight held keys necessarily step; bound rather than claim continuous foot locking.
  const longestHoldTravel = Math.max(...clip.durationsMs)/clip.durationMs*stride*96;
  assert.ok(longestHoldTravel < 5.4);
  const cycleMs = stride / .65 * 1000;
  assert.ok(cycleMs > 290 && cycleMs < 310);
});

test('stops, next cells, reduced motion and idle transitions do not add a moving pose', () => {
  const a=make(), end=5+a.moveDuration;
  assert.equal(creaturePresentationPose(model,a,4.999,false,resources,'walk'),null);
  assert.equal(creaturePresentationPose(model,a,end,false,resources,'walk'),null);
  const next={...a,moveStartedAt:end,stepCount:2,renderFromX:9,x:8};
  assert.equal(creaturePresentationPose(model,next,end,false,resources,'walk').frame,
    animation.unitAnimationFrame(clip,clip.durationMs/stride));
  assert.equal(creaturePresentationPose(model,next,end+.1,true,resources,'walk').frame,0);
  assert.equal(creaturePresentationPose(model,{...next,mode:'idle'},end+.1,false,resources,'walk'),null);
  assert.equal(creaturePresentationPose(model,{...next,health:0},end+.1,false,resources,'walk'),null);
});

test('combat distance clock freezes on held snapshots and returns cleanly on retreat', () => {
  const clock=createCreatureStrideClock(), a=make({combat:{position:{moving:true,moveStartedAt:0}}});
  assert.equal(clock.frame(model,a,0,clip,stride,{x:0,y:0}),0);
  assert.equal(clock.frame(model,a,.1,clip,stride,{x:-stride*.5,y:0}),2);
  assert.equal(clock.frame(model,a,1,clip,stride,{x:-stride*.5,y:0}),2);
  assert.equal(clock.frame(model,a,1.1,clip,stride,{x:0,y:0}),0);
});

test('welcome uses the same source stride at its authored cadence without changing body size', () => {
  const cell=120, pixels=welcomeStridePixels(clip,entry,cell,display);
  near(pixels,stride*cell,'rendered source stride');
  const request={key:species,width:480,size:80,worldPixels:cell,stridePixelsPerCycle:pixels,phase:'enter',startedAt:5,timeline:5,elapsedMs:0};
  const first=welcomeTravelMotion(model,request);
  const next=welcomeTravelMotion(model,{...request,timeline:5.64,elapsedMs:640});
  near(first.x-next.x,pixels,'one authored cycle'); near(next.cell,cell,'drawing scale');
  assert.equal(animation.creatureWalkPose(next.agent,5.640000001).frame,0);
});

test('built game and unit matrix carry the same approved eight-key animation', () => {
  const context={}; runInNewContext(readFileSync(new URL('./runtime.js',import.meta.url),'utf8'),context);
  const compiled=context.Spawner.CREATURE_WALK_ANIMATIONS[species];
  for(const key of ['image','frameSize','viewSize','columns','frameCount','durationMs','pivotX','pivotY','strideFrameRatio']) assert.equal(compiled[key],clip[key],key);
  assert.deepEqual(Array.from(compiled.durationsMs),clip.durationsMs);
  runInNewContext(readFileSync(new URL('./unit-matrix-data.js',import.meta.url),'utf8'),context);
  assert.equal(context.SpawnerUnitMatrixData.units[species].animations.walk.image,clip.image);
  runInNewContext(readFileSync(new URL('./local-assets.js',import.meta.url),'utf8'),context);
  const wrapper='client/local-assets/'+clip.image.slice('DesignAssets/'.length)+'.js';
  assert.ok(context.SpawnerLocalAssetFiles.includes('./'+wrapper));
  context.SpawnerLocalAssetSources={};
  runInNewContext(readFileSync(new URL('../'+wrapper,import.meta.url),'utf8'),context);
  const data=context.SpawnerLocalAssetSources[clip.image];
  assert.equal(createHash('sha256').update(Buffer.from(data.split(',')[1],'base64')).digest('hex'),hash(clip.image));
  assert.equal(context.Spawner.assets[clip.image],clip.image);
});

test('actual combat stage draws approved mole keys once and holds them during stationary snapshots',async()=>{
  const {createCombatStage}=await import('./combat-stage.mjs');
  const original={window:globalThis.window,Image:globalThis.Image,document:globalThis.document,assets:globalThis.SpawnerAssets};
  const draws=[];
  globalThis.window={devicePixelRatio:1,matchMedia:()=>({matches:false})};
  globalThis.Image=class{constructor(){this.complete=true;this.naturalWidth=1024;this.naturalHeight=1024;this.width=1024;this.height=1024;}async decode(){}};
  globalThis.SpawnerAssets={source:p=>p,image:()=>new globalThis.Image()};
  globalThis.document={createElement:()=>({width:1,height:1,getContext(){return new Proxy({getImageData:()=>({data:new Uint8ClampedArray(this.width*this.height*4).fill(255)})},{get:(o,k)=>o[k]||(()=>{})});}})};
  const ctx=new Proxy({drawImage(image,...args){if(image.src?.includes('walk-grounded-v3'))draws.push({image:image.src,sx:args[0],sy:args[1],sw:args[2],sh:args[3]});}},{get:(o,k)=>o[k]||(()=>{})});
  const canvas={clientWidth:1000,clientHeight:560,width:1000,height:560,getContext:()=>ctx};
  try{
    const agents=[-1,1].map((facing,i)=>({id:'mole-stage'+i,species,health:10,mode:'fight',facing,stats:{health:10},combat:{id:'mole-qa',side:i,stunnedUntil:0,position:{moving:true,moveStartedAt:1,x:i?3:-3,y:0,homeX:i?3:-3,homeY:0}}}));
    const trial={agents,time:1,history:[],result:()=>null},stage=createCombatStage(canvas);await stage.prepare(trial);
    const render=()=>{draws.length=0;stage.render(trial,trial.time*1000,false);return structuredClone(draws);};
    const first=render();assert.equal(first.length,2);assert.ok(first.every(d=>d.sw===256&&d.sh===256));
    trial.time=1.1;assert.deepEqual(render(),first);
    agents[0].combat.position.x-=.1;agents[1].combat.position.x+=.1;trial.time=1.2;
    const before=structuredClone(agents),moved=render();assert.equal(moved.length,2);
    assert.ok(moved.every((v,i)=>v.sx!==first[i].sx||v.sy!==first[i].sy));assert.deepEqual(agents,before);
    trial.time=1.3;assert.deepEqual(render(),moved);
    stage.clear();trial.time=1;assert.deepEqual(render(),first);
  }finally{globalThis.window=original.window;globalThis.Image=original.Image;globalThis.document=original.document;if(original.assets===undefined)delete globalThis.SpawnerAssets;else globalThis.SpawnerAssets=original.assets;}
});
