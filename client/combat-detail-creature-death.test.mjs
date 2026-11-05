import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createDetailCombatDeath, detailDeathForm, DETAIL_DEATH_CREATURES, detailCreatureDeathShadow } from './combat-detail-death.mjs';
import { createCombatVfxCursor } from './combat-vfx-events.mjs';
import { createDetailCombatVfx, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect } from './combat-detail-vfx.mjs';
import { CREATURE_IDLE_ANIMATIONS, CREATURE_DEATH_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, unitAnimationFrame, creatureHurtPose, creatureAttackPose } from './unit-animation.mjs';
import { imageFrameGeometry } from './image-geometry.mjs';
import { imageDimensions } from './image-audit.mjs';
import { createEncounters } from '../server/encounters.mjs';

const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const extract = name => { const code=source.match(new RegExp('^    function '+name+'\\([^]*?^    }','m'))?.[0];assert.ok(code,name);return code; };
const helper=readFileSync(new URL('./combat-detail-dodge.test.mjs',import.meta.url),'utf8').split('const event = ')[0];
const box={assert,source,createContext,runInContext,createCombatVfxCursor,createDetailCombatVfx,DETAIL_COMBAT_VFX_ASSETS,drawDetailVfxCell,drawDetailVitalEffect};
createContext(box);runInContext(helper.slice(helper.indexOf('function extract(')),box);
const corpse=(species,extra={})=>({kind:'corpse',agentId:'target',id:'corpse:target',species,x:100,y:100,diedAt:1,decaysAt:4,facing:1,attributes:{},...extra});
const sprite=animation=>({path:animation.image,complete:true,naturalWidth:imageDimensions(animation.image)[0],naturalHeight:imageDimensions(animation.image)[1]});
function modal(species,side=1,scale=1.35) {
 const units=['source','target'].map((id,index)=>({id,tribe:index?'bean':'spore',health:10,x:100,y:100,stats:{health:10},attributes:{},...(index===side?{species}:{}),combat:{id:'fight',side:index}}));
 // Factory's initial paint predates optional death hooks and uses no creature renderer.
 const bootstrap=units.map(unit=>({...unit,species:undefined})),view=box.modal({units:bootstrap}),scope=view.sandbox;
 view.agents[side].species=species;
 const animation=CREATURE_DEATH_ANIMATIONS[species],entry={animation,sprite:sprite(animation),scale:.47};
 const idle=CREATURE_IDLE_ANIMATIONS[species],idleEntry={animation:idle,sprite:sprite(idle),scale:.53};
 scope.connection={roomId:'room',simSeconds:.9};scope.state.corpses=[];scope.endingOffset=0;
 scope.corpsePlaybackTime=()=>scope.state.simSeconds+scope.endingOffset;
 Object.assign(scope,{creatureDeathSheets:new Map([[species,entry]]),creatureIdleSheets:new Map([[species,idleEntry]]),creatureHurtSheets:new Map(),creatureAttackSheets:new Map(),groundShadow:{path:'existing-ground-shadow'},
  combatUnitScale:()=>scale,drawSelectionOutline(){}});
 scope.unitDisplayBounds.set(species,{width:.8,height:.7});scope.unitDisplayScales.set(species,scale);
 Object.assign(scope.Spawner,{createDetailCombatDeath,detailCreatureDeathShadow,CREATURE_DEATH_ANIMATIONS,CREATURE_ATTACK_ANIMATIONS,unitAnimationFrame,imageFrameGeometry,creatureHurtPose,creatureAttackPose});
 runInContext(['drawCreatureDeath','drawCreatureCorpse','drawAgentCorpse','drawCombatCreature'].map(extract).join('\n'),scope);
 const ctx=view.canvas.getContext('2d'),saved=[],draws=[];let matrix={x:0,y:0,sx:1,sy:1};
 const oldSave=ctx.save.bind(ctx),oldRestore=ctx.restore.bind(ctx);ctx.filter='none';
 ctx.setTransform=()=>{matrix={x:0,y:0,sx:1,sy:1};};
 ctx.save=()=>{oldSave();saved.push({matrix:{...matrix},filter:ctx.filter});};ctx.restore=()=>{oldRestore();const state=saved.pop();matrix=state.matrix;ctx.filter=state.filter;};
 ctx.translate=(x,y)=>{matrix.x+=x*matrix.sx;matrix.y+=y*matrix.sy;};ctx.scale=(x,y)=>{matrix.sx*=x;matrix.sy*=y;};
 ctx.drawImage=(image,...args)=>draws.push({image:image.path,args,matrix:{...matrix},alpha:ctx.globalAlpha,filter:typeof ctx.filter === "string" ? ctx.filter : "none"});
 function draw(time){draws.length=0;scope.combatRoster.dataset.key=view.agents.filter(a=>a.health>0).map(a=>a.id).join(',');view.draw(time);return structuredClone(draws);}
 draw(.9);
 const victim=view.agents[side];
 function kill(){victim.health=0;scope.state.corpses=[corpse(species,{agentId:victim.id,id:'corpse:'+victim.id,facing:side?1:-1})];scope.connection.simSeconds=1;}
 return {...view,draw,kill,victim,entry,idleEntry,scale};
}

// The approved list is deliberately narrower than the existing registry.
test('only the five approved creature deaths join the existing eight tribe routes',()=>{
 assert.deepEqual(DETAIL_DEATH_CREATURES,['vine-turtle','walking-forest','cotton-sheep','lantern-keeper','spiny-back-leader']);assert.ok(Object.isFrozen(DETAIL_DEATH_CREATURES));
 for(const species of Object.keys(CREATURE_DEATH_ANIMATIONS))assert.equal(detailDeathForm({species}),DETAIL_DEATH_CREATURES.includes(species)?'creature/'+species:null,species);
 for(const species of ['spiny-back-beetle','unknown'])assert.equal(detailDeathForm({species,tribe:'bean'}),null);
 for(const tribe of ['bean','spore','pebble','spring'])for(const secretion of [false,true])assert.equal(detailDeathForm({tribe,attributes:secretion?{secretion:1}:{}}),tribe+(secretion?'/secretion':'/base'));
});

test('actual creature corpse calls retain every native cell, per-frame support, prepared scale and arena facing',()=>{
 for(const species of DETAIL_DEATH_CREATURES)for(const side of [0,1])for(const scale of [.65,1.35]){
  const view=modal(species,side,scale);view.kill();const record=structuredClone(view.sandbox.state.corpses[0]),animation=view.entry.animation;
  let elapsed=0;
  for(let frame=0;frame<animation.frameCount;frame++){
   const age=(elapsed+1)/1000,draws=view.draw(1+age),body=draws.find(d=>d.image===animation.image),shadow=draws.find(d=>d.image==='existing-ground-shadow');
   assert.ok(body,species+'/'+frame);assert.ok(shadow);assert.ok(draws.indexOf(shadow)<draws.indexOf(body));
   const geometry=imageFrameGeometry(animation,frame),size=shadow.args[2];
   assert.deepEqual(body.args.slice(0,4),[frame%animation.columns*animation.frameSize,Math.floor(frame/animation.columns)*animation.frameSize,animation.frameSize,animation.frameSize]);
   const nativeSize=body.args[6];assert.equal(nativeSize,body.args[7]);
   assert.ok(Math.abs(body.args[4]+nativeSize*geometry.pivotX/animation.frameSize)<1e-8);
   assert.ok(Math.abs(body.args[5]+nativeSize*geometry.pivotY/animation.frameSize)<1e-8);
   assert.equal(body.matrix.sx,side?scale:-scale);assert.equal(body.matrix.sy,scale);
   assert.equal(shadow.matrix.sx,1);assert.equal(shadow.matrix.sy,1);
   assert.ok(size>0);assert.deepEqual(structuredClone(view.sandbox.state.corpses[0]),record);
   elapsed+=animation.durationsMs[frame];
  }
  assert.equal(view.draw(4).filter(d=>d.image===animation.image).length,0);
 }
});

test('creature support uses the exact existing world radii and death-age opacity, including registration and reduced motion',()=>{
 for(const species of DETAIL_DEATH_CREATURES)for(const age of [.01,.22,.6,1.2,2.8])for(const reducedMotion of [false,true]){
  const animation=CREATURE_DEATH_ANIMATIONS[species],entry={animation,scale:.47},record=corpse(species),scale=1.35,cell=190;
  const value=detailCreatureDeathShadow({corpse:record,age,scale,cell},entry,reducedMotion),calls=[];
  const scope={creatureDeathSheets:new Map([[species,entry]]),idleMotion:{matches:reducedMotion},state:{camera:{zoom:cell}},corpsePlaybackTime:()=>1+age,
   Spawner:{unitAnimationFrame,imageFrameGeometry},drawGroundShadow:(...args)=>calls.push(args),clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};
  createContext(scope);runInContext(extract('drawCorpseGroundShadow'),scope);scope.drawCorpseGroundShadow(record,{x:100,y:200});
  assert.ok(Math.abs(value.radiusX-calls[0][2]*scale)<1e-8);assert.ok(Math.abs(value.radiusY-calls[0][3]*scale)<1e-8);assert.ok(Math.abs(value.opacity-calls[0][4])<1e-8);
 }
 assert.equal(detailCreatureDeathShadow({corpse:corpse('bubble-toad'),age:.1,scale:1,cell:100},{animation:CREATURE_DEATH_ANIMATIONS['bubble-toad'],scale:1}),null);
});

test('pause, reduced motion, resize, missing death art and ending continuation preserve original corpse age',()=>{
 for(const species of DETAIL_DEATH_CREATURES){
  const view=modal(species);view.kill();const first=view.draw(1.1);assert.deepEqual(view.draw(1.1),first);
  view.sandbox.idleMotion.matches=true;const reduced=view.draw(1.12),a=view.entry.animation,body=reduced.find(d=>d.image===a.image),last=a.frameCount-1;
  assert.deepEqual(body.args.slice(0,4),[last%a.columns*a.frameSize,Math.floor(last/a.columns)*a.frameSize,a.frameSize,a.frameSize]);
  view.sandbox.idleMotion.matches=false;view.entry.sprite.complete=false;assert.equal(view.draw(1.2).filter(d=>d.image===a.image).length,0);
  view.entry.sprite.complete=true;const recovered=view.draw(1.5).find(d=>d.image===a.image);assert.equal(recovered.args[0],unitAnimationFrame(a,500)%a.columns*a.frameSize);
  view.canvas.clientWidth/=2;view.canvas.clientHeight/=2;const smaller=view.draw(1.5).find(d=>d.image===a.image);
  assert.equal(smaller.matrix.x,recovered.matrix.x/2);assert.equal(smaller.matrix.y,recovered.matrix.y/2);assert.equal(smaller.args[6],recovered.args[6]/2);
  view.sandbox.endingOffset=1;assert.equal(view.draw(1.5).filter(d=>d.image===a.image).length,1);
  view.sandbox.endingOffset=2.5;assert.equal(view.draw(1.5).filter(d=>d.image===a.image).length,0);
 }
});

test('actual encounter death supplies immediate original-ID corpses without changing simulation records',()=>{
 for(const species of DETAIL_DEATH_CREATURES){
  const environment={seed:13,simSeconds:1,world:{seed:13,generationVersion:11,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320),burrows:[],encounters:[{key:species,x:150,y:150,cells:[150*320+150],terrains:[4],nearWater:false}]},colonies:[],games:new Map(),food:new Map(),foodSpots:new Map()};
  const agent={id:'target',species,x:150,y:150,health:1,facing:1,stats:{health:14,combatStrength:10,speed:.5,attack:1,vision:4},moveStartedAt:0,nextActionAt:0,combat:{id:'fight',side:1}};
  const encounters=createEncounters(environment,{version:1,agents:[agent],kills:{},records:[{key:species,x:150,y:150,sequence:1,spawned:true,dead:false,missingSince:null,nextSpawnAt:null,warningUntil:null}]},[]);
  const tracker=createDetailCombatDeath(),viewport={scope:'fight',roomId:'room',streamId:'stream',width:1040,height:480,snapshotTime:.9};
  tracker.begin(.9,{...viewport,visibleIds:[agent.id],livingAgents:[agent]});tracker.observe(agent,{x:600,y:350,width:180,height:150},{scale:1.35,facing:-1});
  encounters.receiveDamage(agent,100);const record=environment.food.get('corpse:'+agent.id);assert.ok(record);assert.equal(record.diedAt,1);assert.equal(record.decaysAt,4);assert.equal(encounters.agents.includes(agent),false);
  const saved=JSON.stringify(encounters.save()),food=JSON.stringify([...environment.food]);tracker.begin(1.01,{...viewport,snapshotTime:1,visibleIds:[],livingAgents:[]});
  const rows=tracker.commands([record],1.01,{width:1040,height:480,cell:200});assert.equal(rows.length,1);assert.equal(rows[0].form,'creature/'+species);
  assert.equal(JSON.stringify(encounters.save()),saved);assert.equal(JSON.stringify([...environment.food]),food);
 }
});
