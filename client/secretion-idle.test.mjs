import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createContext,runInContext} from 'node:vm';
import {UNIT_SECRETION_IDLE_ANIMATIONS,unitSecretionIdlePose} from './secretion-idle.mjs';
import {UNIT_RANGED_FORMS,UNIT_RANGED_IMAGE_ASSETS,unitRangedPose,unitRangedAppearance,unitRangedDisplaySize} from './unit-ranged.mjs';
import {unitAnimationPose} from './unit-animation.mjs';
import {imageDimensions,auditImages} from './image-audit.mjs';
import {createCombatStage} from './combat-stage.mjs';
const tribes=['spore','pebble','spring'];
const agent=(tribe,patch={})=>({id:'idle',tribe,health:10,mode:'idle',attributes:{secretion:1},animationStartedAt:10,bornAt:0,hurtStartedAt:-Infinity,moveDuration:0,facing:1,...patch});
const source=(tribe)=>`DesignAssets/Animations/UnitRangedV1/${tribe}/Source/neutral.png`;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('three secretion idles use own 64-sample source rhythm, native crop and stable epoch',()=>{
 for(const tribe of tribes){const a=agent(tribe),before=structuredClone(a),clip=UNIT_SECRETION_IDLE_ANIMATIONS[tribe];
  for(let i=0;i<64;i++){const p=unitRangedPose(a,10+(i+.01)/10);assert.equal(p.animation,clip);assert.equal(p.frame,clip.frames[i]);assert.equal(p.sample,i);}
  assert.equal(unitRangedPose(a,10).frame,0);assert.equal(unitRangedPose(a,16.3).frame,0);assert.equal(unitRangedPose(a,16.4).frame,0);
  assert.equal(unitRangedPose(a,9).frame,0);assert.deepEqual(a,before);assert.equal(clip.viewSize,512);
  assert.equal(clip.frames.length,64);assert.equal(clip.durationMs,6400);assert.ok(clip.frameSize<256);
  const restored=JSON.parse(JSON.stringify(a));assert.deepEqual(unitRangedPose(restored,12.1),unitRangedPose(a,12.1));
  assert.equal(unitRangedPose(a,12.1).idleFallback,UNIT_RANGED_FORMS[tribe].idle);
  assert.equal(UNIT_RANGED_FORMS[tribe].idle.image,source(tribe),'resource/birth neutral contract remains intact');
 }
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
  assert.equal(unitRangedPose(a,12.1).sample,21,'cancel/resume does not reset the idle epoch');
  assert.equal(unitRangedPose({...a,carrying:3,mode:'return'},12.1).animation,UNIT_SECRETION_IDLE_ANIMATIONS[tribe]);
 }
});
test('each atlas is source-pinned, registered, seamless at loop, native and not world-ready',()=>{
 assert.equal(auditImages(process.cwd(),tribes.map(t=>UNIT_SECRETION_IDLE_ANIMATIONS[t].image)),3);
 for(const t of tribes){const clip=UNIT_SECRETION_IDLE_ANIMATIONS[t],p=JSON.parse(readFileSync(clip.image.replace('idle.webp','provenance.json'))),hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
  assert.ok(UNIT_RANGED_IMAGE_ASSETS.includes(clip.image));assert.equal(hash(p.source),p.sourceHash);assert.equal(hash(p.motionSource),p.motionSourceHash);assert.equal(hash(p.idleSource),p.idleSourceHash);assert.equal(hash(clip.image),p.atlasHash);
  assert.equal(p.standaloneReady,false);assert.equal(p.neutralExact,true);assert.equal(p.loopExact,true);assert.equal(p.visiblePackedPixelsExact,true);
  assert.equal(p.frames.length,64);assert.ok(p.frames.every(f=>f.edgePixels===0));assert.ok(p.frames.some(f=>f.changedPixels>1000));
  assert.equal(new Set(clip.frames).size,p.physicalFrames);assert.deepEqual(imageDimensions(clip.image),[clip.frameSize*4,clip.frameSize*Math.ceil(clip.frameCount/4)]);
  near(clip.pivotX+p.crop[0],256);near(clip.pivotY+p.crop[1],448);
  if(t==='pebble')assert.ok(p.poses.every(q=>q.compression===0&&q.sweep===0));else assert.ok(p.frames.every(f=>f.exactSupport));
 }
});
function worldFixture(){const code=readFileSync(new URL('./game.js',import.meta.url),'utf8').match(/^    function drawAgentRanged\([^]*?^    }/m)[0],draws=[],scales=[];
 const state={simSeconds:12.1},idleMotion={matches:false},f={available:true,all:true};
 const scope=createContext({Spawner:{unitRangedPose,unitRangedAppearance,unitRangedDisplaySize,unitAnimationPose},state,AGENT_HEIGHT:.7,idleMotion,unitDisplayScale:()=>1.5,
  agentRangedImage:path=>f.all&&(!path.includes('/SecretionIdleV1/')||f.available)?{path,naturalWidth:imageDimensions(path)[0]}:null});runInContext(code,scope);
 const context={save(){},restore(){},translate(){},scale(...a){scales.push(a)},drawImage(...a){draws.push(a)}};
 return{scope,state,idleMotion,draws,scales,context,f};}
test('actual world/detail draw keeps native body coordinates, mirror, reduced motion and neutral loading fallback',()=>{
 const f=worldFixture();for(const t of tribes)for(const facing of[-1,1]){const a=agent(t,{facing,stats:{pieceCount:6}}),clip=UNIT_SECRETION_IDLE_ANIMATIONS[t],p=JSON.parse(readFileSync(clip.image.replace('idle.webp','provenance.json')));
  assert.equal(f.scope.drawAgentRanged(f.context,a,50,80,70,null),true);let draw=f.draws.at(-1);assert.equal(draw[0].path,clip.image);assert.deepEqual(f.scales.at(-1),[facing,1]);
  const k=unitRangedDisplaySize(a)/1.5/512;near(draw[7]/clip.frameSize,k);near(draw[5],-clip.pivotX*k);near(draw[6],-clip.pivotY*k);
  near(draw[5]-p.crop[0]*k,-256*k);near(draw[6]-p.crop[1]*k,-448*k);
  f.idleMotion.matches=true;f.scope.drawAgentRanged(f.context,a,50,80,70,null);draw=f.draws.at(-1);assert.equal(draw[1],0);assert.equal(draw[2],0);f.idleMotion.matches=false;
  f.f.available=false;assert.equal(f.scope.drawAgentRanged(f.context,a,50,80,70,null),true);draw=f.draws.at(-1);assert.equal(draw[0].path,source(t));near(draw[5],-256*k);near(draw[7]/512,k);
  f.f.available=true;f.scope.drawAgentRanged(f.context,a,50,80,70,null);assert.equal(f.draws.at(-1)[0].path,clip.image);
  f.f.all=false;assert.equal(f.scope.drawAgentRanged(f.context,a,50,80,70,null),false);f.f.all=true;
 }});
test('optional world idle image failures have a two-second retry without affecting other images',()=>{
 const code=readFileSync(new URL('./game.js',import.meta.url),'utf8').match(/^    function agentRangedImage\([^]*?^    }/m)[0];
 let now=1000,count=0;const cache=new Map();class Img{constructor(){this.complete=false;this.naturalWidth=0;count++;}}
 const scope=createContext({agentRangedImages:cache,Image:Img,Date:{now:()=>now},scheduleRender(){},assetSource:p=>p});runInContext(code,scope);
 const path=UNIT_SECRETION_IDLE_ANIMATIONS.spore.image;assert.equal(scope.agentRangedImage(path),null);const failed=cache.get(path);failed.complete=true;failed.onerror();
 for(let i=0;i<60;i++)scope.agentRangedImage(path);assert.equal(count,1);now=3001;scope.agentRangedImage(path);assert.equal(count,2);
 const loaded=cache.get(path);loaded.complete=true;loaded.naturalWidth=832;assert.equal(scope.agentRangedImage(path),loaded);
 scope.agentRangedImage(source('spore'));assert.equal(cache.get(source('spore')).onerror,undefined,'existing nonoptional loader remains unchanged');
});
test('shared laboratory draws own idle at native size and immediately uses neutral after a shot if idle is missing',()=>{
 const saved={window:globalThis.window,Image:globalThis.Image,document:globalThis.document};const images=new Map(),draws=[],reduced={matches:false};let available=true;
 globalThis.window={matchMedia:()=>reduced,devicePixelRatio:1};globalThis.document=undefined;
 globalThis.Image=class{constructor(){this.complete=true;this.naturalWidth=512;this.naturalHeight=512;}set src(path){this.path=path;images.set(path,this);if(path.includes('/SecretionIdleV1/')){const [w,h]=imageDimensions(path);this.naturalWidth=available?w:0;this.naturalHeight=h;}}get src(){return this.path;}};
 const ctx=new Proxy({drawImage(...a){if(a.length===9)draws.push(a);}}, {get:(o,k)=>k in o?o[k]:()=>{}}),canvas={clientWidth:1200,clientHeight:560,width:1200,height:560,getContext:()=>ctx};
 try{for(const t of tribes){available=true;const stage=createCombatStage(canvas),agents=[0,1].map(side=>agent(t,{id:`${t}-${side}`,combat:{side,stunnedUntil:0},stats:{health:10}}));const trial={agents,time:12.1,history:[],result:()=>null};
  stage.render(trial,0,false);let body=draws.filter(d=>d[0].path.includes('/SecretionIdleV1/')).at(-1);assert.ok(body);const clip=UNIT_SECRETION_IDLE_ANIMATIONS[t];near(body[5]/body[7],-clip.pivotX/clip.frameSize);
  reduced.matches=true;stage.render(trial,.1,false);body=draws.filter(d=>d[0].path===clip.image).at(-1);assert.equal(body[1],0);assert.equal(body[2],0);reduced.matches=false;
  for(const a of agents)a.attack={mode:'ranged',startedAt:12,launchedAt:12.2,endsAt:12.8};stage.render(trial,.2,false);assert.ok(draws.at(-1)[0].path.endsWith('/shoot.webp'));
  agents.forEach(a=>a.attack=null);images.get(clip.image).naturalWidth=0;available=false;stage.render(trial,.3,false);assert.equal(draws.at(-1)[0].path,source(t),'never retains the previous shot');
  images.get(clip.image).naturalWidth=imageDimensions(clip.image)[0];stage.render(trial,.4,false);assert.equal(draws.at(-1)[0].path,clip.image);
 }}finally{Object.assign(globalThis,saved);}
});

test('VFX review scenes keep their preloaded neutral camera rather than requesting optional ambient assets',async()=>{
 const {rangedReviewState}=await import('./vfx-event-preview.mjs');
 for(const t of tribes){const data={source:agent(t),target:agent(t,{stats:{health:10}}),events:[]};const scene=rangedReviewState(data,12.1);
  assert.equal(scene.sourcePose.animation.image,source(t));assert.equal(scene.sourcePose.frame,0);assert.equal(scene.targetPose.animation.frameSize,512);
  data.source.attack={mode:'ranged',startedAt:12,launchedAt:12.2,endsAt:12.8};assert.equal(rangedReviewState(data,12.1).sourcePose.action,'shoot');
 }
});
