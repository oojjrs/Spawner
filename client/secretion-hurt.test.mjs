import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {unitRangedPose,unitRangedDisplaySize,UNIT_RANGED_FORMS,UNIT_RANGED_HURT_ANIMATIONS,UNIT_RANGED_IMAGE_ASSETS} from './unit-ranged.mjs';
import {unitAnimationPose} from './unit-animation.mjs';
import {unitAppearanceInventory} from './unit-appearance.mjs';
import {createCombatStage} from './combat-stage.mjs';
import {createSimulationTrial} from './combat-simulation.mjs';
const agent=(patch={})=>({id:'test',tribe:'spore',health:10,facing:1,attributes:{secretion:1,carapace:1,antenna:1,feet:1},hurtStartedAt:1,...patch});

test('all secretion forms keep their own hurt bodies for legacy/RPG frames and return exactly to idle',()=>{
 for(const tribe of ['bean','spore','pebble','spring'])for(const rpg of [false,true]) {
  const unit=agent({tribe,combat:rpg?{version:2}:undefined}),duration=rpg?.12:.76;
  const seen=new Set();
  for(let i=0;i<760;i++) {
   const pose=unitRangedPose(unit,1+i/760*duration);assert.equal(pose.action,'hurt');assert.equal(pose.animation,UNIT_RANGED_HURT_ANIMATIONS[tribe]);seen.add(pose.frame);
  }
  assert.equal(seen.size,16);assert.equal(unitRangedPose(unit,1+duration+1e-10).action,'idle');
  assert.equal(unitRangedPose(unit,.999).action,'idle');
 }
 assert.ok(UNIT_RANGED_IMAGE_ASSETS.includes(UNIT_RANGED_HURT_ANIMATIONS.spore.image));
});

test('hurt restarts on repeated hits and obeys shot precedence, lifetime and appearance selection',()=>{
 const shot={mode:'ranged',startedAt:1,launchedAt:1.2,hitAt:1.5,endsAt:1.6};
 assert.equal(unitRangedPose(agent({attack:shot,combat:{version:2}}),1.05).action,'shoot');
 assert.equal(unitRangedPose(agent({attack:shot}),1.05).action,'hurt');
 assert.equal(unitRangedPose(agent({attack:null,hurtStartedAt:1.05,combat:{version:2}}),1.05).frame,0);
 assert.equal(unitRangedPose(agent({health:0}),1.05),null);
 assert.equal(unitRangedPose(agent({attributes:{blade:1,secretion:1}}),1.05),null);
 assert.equal(unitRangedPose(agent({species:'bubble-toad'}),1.05),null);
 assert.equal(unitRangedPose(agent({birth:{startedAt:1}}),1.05).action,'idle');
 for(const tribe of ['bean','spore','pebble','spring'])assert.equal(unitRangedPose(agent({tribe}),1.05).action,'hurt');
 for(const hurtStartedAt of [undefined,NaN,Infinity])assert.equal(unitRangedPose(agent({hurtStartedAt}),1.05).action,'idle');
 assert.equal(unitAppearanceInventory().filter(x=>x.worldReady).length,0);
});

test('actual world/detail draw preserves hurt silhouette during movement/resource interruption, facing, growth and unavailable-art fallback',()=>{
 const code=readFileSync(new URL('./game.js',import.meta.url),'utf8').match(/^    function drawAgentRanged\([^]*?^    }/m)[0];
 const state={simSeconds:1.11},draws=[],scales=[];let available=true;
 const scope=createContext({Spawner:{unitRangedPose,unitRangedDisplaySize,unitAnimationPose},state,AGENT_HEIGHT:.7,idleMotion:{matches:false},unitDisplayScale:()=>1.5,
  agentRangedImage:path=>available?{path,naturalWidth:2048}:null});runInContext(code,scope);
 const context={save(){},restore(){},translate(){},scale(...x){scales.push(x)},drawImage(...x){draws.push(x)}};
 for(const tribe of ['bean','spore','pebble','spring'])for(const facing of [-1,1])for(const patch of [{},{mode:'harvest'},{mode:'unload'},{moveStartedAt:1,moveDuration:1}]) {
  const unit=agent({...patch,tribe,facing,stats:{pieceCount:6}}),before=structuredClone(unit);
  assert.equal(scope.drawAgentRanged(context,unit,50,80,70,null),true);
  assert.equal(draws.at(-1)[0].path,UNIT_RANGED_HURT_ANIMATIONS[tribe].image);
  assert.deepEqual(scales.at(-1),[facing,1]);assert.ok(Math.abs(draws.at(-1).at(-1)*1.5-unitRangedDisplaySize(unit))<1e-10);
  assert.deepEqual(unit,before);
 }
 available=false;assert.equal(scope.drawAgentRanged(context,agent(),50,80,70,null),false);
 available=true;state.simSeconds=2;
 assert.equal(scope.drawAgentRanged(context,agent({mode:'harvest'}),50,80,70,null),false);
 assert.equal(scope.drawAgentRanged(context,agent({moveStartedAt:1,moveDuration:2}),50,80,70,null),true);
 assert.equal(draws.at(-1)[0].path,UNIT_RANGED_FORMS.spore.walk.image);
});

test('actual laboratory renders spore secretion hurt, both mirrors, reset and image-load recovery',()=>{
 const saved={window:globalThis.window,Image:globalThis.Image,SpawnerAssets:globalThis.SpawnerAssets};
 let missing=false,now=1000;const originalNow=Date.now;
 try {
  globalThis.window={matchMedia:()=>({matches:false}),devicePixelRatio:1};globalThis.SpawnerAssets=undefined;Date.now=()=>now;
  globalThis.Image=class {complete=true;naturalWidth=2048;naturalHeight=2048;set src(path){this.path=path;this.naturalWidth=missing&&path.endsWith('/spore/hurt.png')?0:2048;}};
  for(const facing of [-1,1]) {
   const draws=[],stack=[];let scale=[1,1];
   const ctx=new Proxy({save(){stack.push([...scale])},restore(){scale=stack.pop()},scale(x,y){scale[0]*=x;scale[1]*=y},setTransform(){scale=[1,1]},drawImage(img,...args){draws.push({path:img.path,args,scale:[...scale]})} },{get:(o,k)=>o[k]||(()=>{})});
   const canvas={clientWidth:1040,clientHeight:480,getContext:()=>ctx};const stage=createCombatStage(canvas);
   const unit=agent({facing,combat:{version:2,side:facing<0?1:0,stunnedUntil:0},stats:{health:10}});
   const other={...agent({id:'other',tribe:'bean',hurtStartedAt:-Infinity,attributes:{}}),combat:{version:2,side:facing<0?0:1,stunnedUntil:0},stats:{health:10}};
   const trial={agents:[unit,other],history:[],projectiles:[],time:1.05,result:()=>null};
   missing=true;stage.render(trial,1000,false);assert.ok(draws.some(x=>x.path===UNIT_RANGED_FORMS.spore.idle.image));
   missing=false;now+=2001;draws.length=0;stage.render(trial,1100,false);
   const hurt=draws.find(x=>x.path===UNIT_RANGED_HURT_ANIMATIONS.spore.image);assert.ok(hurt);assert.equal(hurt.scale[0],facing);
   trial.time=2;draws.length=0;stage.render(trial,1200,false);
   assert.equal(draws.some(x=>x.path===UNIT_RANGED_HURT_ANIMATIONS.spore.image),false);
  }
 } finally {Object.assign(globalThis,saved);Date.now=originalNow;}
});

test('observing secretion hurt cannot alter real simulation outcomes, events or hidden mechanics',()=>{
 const settings={left:{key:'spore',organs:{ranged:1},counts:{vitality:3}},right:{key:'bean',organs:{attack:1},counts:{vitality:3}},distance:1,random:false};
 const a=createSimulationTrial(settings),b=createSimulationTrial(settings);
 for(let i=0;i<100;i++){a.advance(.05);b.advance(.05);for(const unit of a.agents)unitRangedPose(unit,a.time);}
 assert.deepEqual(a.agents,b.agents);assert.deepEqual(a.history,b.history);assert.deepEqual(a.result(),b.result());
 assert.deepEqual(JSON.parse(JSON.stringify(a.vfx).replaceAll(a.vfx.streamId,'stream')),JSON.parse(JSON.stringify(b.vfx).replaceAll(b.vfx.streamId,'stream')));
});
