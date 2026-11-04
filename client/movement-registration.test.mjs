import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CREATURE_WALK_ANIMATIONS, unitMovementPosition, creatureWalkPose, creatureAnimationSpeed, unitAnimationPose } from './unit-animation.mjs';
import { CREATURE_MOVEMENT } from '../server/creature-movement.mjs';
import { beetleAnimationPose } from '../server/beetle-animation.mjs';
import { welcomeTravelMotion, welcomeCreatureScale } from './welcome-presentation.mjs';
import { unitStats } from '../server/attributes.mjs';
import { imageFrameGeometry } from './image-geometry.mjs';
const reference = JSON.parse(readFileSync(new URL('./creature-walk-reference.json',import.meta.url))).creatures;
const model = { unitStats, unitMovementPosition, creatureAnimationSpeed };
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const agent = species => ({species,health:10,mode:'walk',x:1,y:2,renderFromX:0,renderFromY:0,moveDuration:1,moveStartedAt:0,stepCount:1});

test('all 19 neutral species have an original idle reference and every strip keeps one body scale',()=>{
 assert.equal(reference.length,19);assert.equal(new Set(reference.map(r=>r.key)).size,19);
 for(const r of reference){
  for(const [field,file] of [['idleSha256',r.idleImage],['walkSha256',r.walkImage]])
   assert.equal(createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),r[field],r.key+' '+field);
  if(r.key==='spiny-back-beetle')continue;
  const a=CREATURE_WALK_ANIMATIONS[r.key];
  assert.equal(a.viewSize,r.runtime.viewSize);
  for(let frame=0;frame<a.frameCount;frame++){
   const g=imageFrameGeometry(a,frame);assert.equal(g.viewSize,a.viewSize);assert.equal(g.frameSize,a.frameSize);
   assert.ok(Math.abs(g.pivotX-a.pivotX)<=3.000001);assert.ok(Math.abs(g.pivotY-a.pivotY)<=3.000001);
  }
  if(!a.travelWindow)assert.ok(a.cyclesPerCell*CREATURE_MOVEMENT[r.key].speed<=2.00001,r.key);
  if(r.preservedGroundRegistration){near(a.pivotX,131.25);near(a.pivotY,220.81);}
 }
});
test('ordinary neutral movement is linear, including turtles and weasels',()=>{
 for(const species of ['vine-turtle','soil-mole','shadow-weasel','white-paw','spiny-back-beetle'])
  for(const t of [.05,.1,.5,.9,1]){const p=unitMovementPosition(agent(species),t);near(p.x,t);near(p.y,2*t);}
});
test('bean preparation and footed movement preserve their native trajectories',()=>{
 const a={...agent(undefined),tribe:'bean',attributes:{}};
 near(unitMovementPosition(a,.1).x,0);near(unitMovementPosition(a,.59).x,.5);
 a.attributes.feet=1;near(unitMovementPosition(a,.1).x,.1);
 a.appearanceAttributes={};near(unitMovementPosition(a,.1).x,0);
 near(unitMovementPosition(a,.1,true).x,.1);
});
test('authored jumps advance during flight and remain planted before takeoff and after landing',()=>{
 for(const species of ['dew-rabbit','bubble-toad','lantern-keeper']){
  const a=agent(species),[start,end]=CREATURE_WALK_ANIMATIONS[species].travelWindow;
  near(unitMovementPosition(a,start/2).x,0);near(unitMovementPosition(a,(start+end)/2).x,.5);
  near(unitMovementPosition(a,(end+1)/2).x,1);near(unitMovementPosition(a,1).x,1);
 }
});
test('welcome uses the same species speeds, cell interpolation and animation phase as game movement',()=>{
 for(const key of ['bean','spore','pebble','spring',...reference.map(r=>r.key)])for(const feet of [0,1]){
  const speed=CREATURE_MOVEMENT[key]?.speed||unitStats({feet},key).speed;
  let previousX=Infinity;
  const start=welcomeTravelMotion(model,{key,attributes:{feet},width:390,size:184,elapsedMs:0,timeline:20,startedAt:20,phase:'enter'});
  for(const age of [.01,.11,.29,.61,.93,1.21].filter(age=>age*1000<start.durationMs)){
   const m=welcomeTravelMotion(model,{key,attributes:{feet},width:390,size:184,elapsedMs:age*1000,timeline:20+age,startedAt:20,phase:'enter'});
   near(m.agent.moveDuration,1/speed);near(m.position.x,unitMovementPosition(m.agent,20+age).x);
   assert.ok(m.x<=previousX+1e-6);previousX=m.x;
   const pose=m.agent.species?creatureWalkPose(m.agent,20+age):unitAnimationPose(m.agent,20+age);
   if(!['spiny-back-beetle','bean'].includes(key))assert.ok(pose,key);
  }
  for(const overrun of [0,.21]){
   const age=start.durationMs/1000+overrun;
   const end=welcomeTravelMotion(model,{key,attributes:{feet},width:390,size:184,elapsedMs:age*1000,timeline:20+age,startedAt:20,phase:'enter'});
   near(end.x,195);
  }
 }
});
test('large wings and attack poses fit above and below the same header ground plane',()=>{
 for(const width of [280,350,900]){
  const a={frameSize:432,pivotY:320,registrationScale:1.1},env={left:-.8,right:1,top:-1.2,bottom:.5};
  const size=welcomeCreatureScale(a,{width:220,height:300},0,1.44,width,280,env);
  assert.ok(214+env.top*size>=34-1e-6);assert.ok(214+env.bottom*size<=274+1e-6);
  assert.ok(width/2+env.right*size<=width-8+1e-6);assert.ok(width/2+env.left*size>=8-1e-6);
 }
});

test('all 23 welcome units keep valid poses at exact cell boundaries and adjacent instants',()=>{
 const keys=['bean','spore','pebble','spring',...reference.map(r=>r.key)];
 assert.equal(keys.length,23);
 for(const key of keys)for(const feet of [0,1])for(const origin of [0,20,91.1,100000]){
  const attributes={feet},speed=CREATURE_MOVEMENT[key]?.speed||unitStats(attributes,key).speed;
  const request={key,attributes,width:390,size:184,elapsedMs:0,timeline:origin,startedAt:origin,phase:'enter'};
  const start=welcomeTravelMotion(model,request),steps=Math.round(start.durationMs/1000*speed);
  const finalAt=origin+steps/speed;
  for(let boundary=0;boundary<=steps;boundary++)for(const delta of [-1e-9,0,1e-9]){
   const time=origin+boundary/speed+delta;
   if(time<origin)continue;
   const m=welcomeTravelMotion(model,{...request,elapsedMs:(time-origin)*1000,timeline:time});
   assert.equal(m.agent.moveStartedAt,origin+(m.agent.stepCount-1)/speed);
   assert.equal(m.agent.moveDuration,origin+m.agent.stepCount/speed-m.agent.moveStartedAt);
   assert.equal(m.agent.flightStartedAt,origin);
   assert.ok(Number.isFinite(m.x));
   if(time>=finalAt){near(m.x,195);continue;}
   assert.ok(time>=m.agent.moveStartedAt,key+' start '+time);
   assert.ok(time-m.agent.moveStartedAt<m.agent.moveDuration,key+' end '+time);
   const pose=key==='spiny-back-beetle'?beetleAnimationPose(m.agent,time):m.agent.species?creatureWalkPose(m.agent,time):unitAnimationPose(m.agent,time);
   if(key!=='bean')assert.ok(pose,key+' pose '+time);
   if(pose)assert.ok(Number.isInteger(pose.frame),key+' frame '+time);
  }
 }
});
