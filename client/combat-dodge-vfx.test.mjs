import { combatViewLayout, unitDisplaySize } from "./unit-size.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createCombatVfxCursor,combatVfxAt} from './combat-vfx-events.mjs';
import {createDetailCombatVfx,DETAIL_COMBAT_VFX,DETAIL_COMBAT_VFX_ASSETS,drawDetailVfxCell,drawDetailVitalEffect} from './combat-detail-vfx.mjs';
import {createCombatStage} from './combat-stage.mjs';
import {combatDodgePose,drawCombatDodgeTrails,drawCombatDodgeGhosts,drawCombatDodgeLabel} from './combat-dodge-vfx.mjs';
const source=readFileSync(new URL('./game.js',import.meta.url),'utf8');
const modalHelper=readFileSync(new URL('./combat-detail-dodge.test.mjs',import.meta.url),'utf8').split('const event = ')[0];
const stageHelper=readFileSync(new URL('./combat-stage-vfx.test.mjs',import.meta.url),'utf8');
function detail(){
 const box={ combatViewLayout, unitDisplaySize,assert,source,createContext,runInContext,createCombatVfxCursor,createDetailCombatVfx,DETAIL_COMBAT_VFX,DETAIL_COMBAT_VFX_ASSETS,drawDetailVfxCell,drawDetailVitalEffect};
 createContext(box);runInContext(modalHelper.slice(modalHelper.indexOf('function extract(')),box);
 const view=box.modal();Object.assign(view.sandbox.Spawner,{combatDodgePose,drawCombatDodgeTrails,drawCombatDodgeGhosts,drawCombatDodgeLabel});return view;
}
const launch={id:'shot',kind:'shoot',sourceId:'source',targetId:'target',at:.5,arrivesAt:1,projectileId:'p',mode:'ranged',amount:0};
const miss={...launch,id:'miss',kind:'miss',at:1};

test('detail repeats the same renderer for every form, unified pose and creature; no state or hit changes',()=>{
 for(const route of ['legacy','unified','creature'])for(const tribe of ['bean','spore','pebble','spring']){
  const v=detail(),draws=[];v.agents.forEach(a=>{a.tribe=tribe;});
  v.sandbox.drawAgentAppearanceLayer=(ctx,now,a)=>draws.push(a.id);
  if(route==='unified')v.sandbox.appearanceWorld={prepare:()=>new Map(v.agents.map(a=>[a.id,{}])),draw:(ctx,a)=>{draws.push(a.id);return true;}};
  if(route==='creature'){v.agents.forEach(a=>a.species='toad');v.sandbox.drawCombatCreature=(ctx,a)=>draws.push(a.id);}
  const state=JSON.stringify(v.agents);
  v.draw(.6,[launch]);assert.equal(draws.length,2);draws.length=0;
  const result=v.draw(1.09,[launch,miss]);
  assert.equal(draws.filter(id=>id==='source').length,1);assert.equal(draws.filter(id=>id==='target').length,4);
  assert.equal(result.commands.length,0);assert.equal(result.hits.length,0);assert.equal(result.labels.length,1);assert.equal(result.outlines.length,1);
  assert.equal(JSON.stringify(v.agents),state);
 }
});

test('detail reduced motion and hidden source never manufacture moving echoes',()=>{
 for(const mode of ['reduced','hidden']){
  const v=detail();let draws=0;v.sandbox.drawAgentAppearanceLayer=()=>draws++;
  if(mode==='reduced')v.sandbox.idleMotion.matches=true;
  v.draw(.6,[launch]);draws=0;
  const outcome=mode==='hidden'?{...miss,sourceId:'unseen'}:miss;
  const result=v.draw(1.09,[launch,outcome]);assert.equal(draws,2);assert.equal(result.labels.length,1);assert.equal(result.commands.length,0);
 }
});

function stage(run,options){
 const box={assert,createCombatStage};createContext(box);
 // The helper mutates globalThis in its VM; execute its lexical helpers in this
 // module's realm instead so the imported stage sees the same browser stubs.
 const text=stageHelper.slice(stageHelper.indexOf('const root ='),stageHelper.indexOf('\ntest('));
 const make=new Function('createCombatStage',text+'\nreturn {withStage,setup};');
 const {withStage,setup}=make(createCombatStage);withStage(env=>run(env,setup),options);
}
const bodyCount=calls=>calls.filter(c=>c.name==='drawImage'&&!c.args[0]?.src?.includes('CombatVfxV4/')&&!c.args[0]?.src?.includes('grassland.webp')).length;

test('lab shares the live body echoes and one Korean label; paused tail expires without replay',()=>{
 for(const tribe of ['bean','spore','pebble','spring'])stage(({draw,calls},setup)=>{
  const {trial,shoot,resolve}=setup(tribe);draw(trial);shoot();draw(trial);resolve('dodge',0);
  const state=JSON.stringify(trial);draw(trial);draw(trial);
  assert.equal(bodyCount(calls),5,tribe+' draws two bodies and three reusable echoes');
  assert.equal(calls.filter(c=>c.name==='fillText'&&c.args[0]==='회피').length,1);
  assert.equal(calls.filter(c=>c.name==='drawImage'&&c.args[0]?.src?.includes('CombatVfxV4/')).length,0);
  assert.equal(JSON.stringify(trial),state);
  for(let n=0;n<7;n++)draw(trial);
  assert.equal(bodyCount(calls),2);assert.equal(calls.filter(c=>c.name==='fillText'&&c.args[0]==='회피').length,0);
 });
});

test('lab closes even a stale fallback projectile at the observed miss, with loading failures or reduced motion',()=>{
 for(const options of [{},{unavailable:true},{reduced:true}])stage(({draw,calls},setup)=>{
  const {trial,shoot,resolve}=setup('spore');draw(trial);shoot();draw(trial);const stale=trial.projectiles[0];
  assert.ok(calls.some(c=>c.name==='drawImage'&&(c.args[0]?.src?.includes('CombatVfxV4/')||c.args[0]?.src?.endsWith('/projectile.png'))));
  resolve('dodge',0);trial.projectiles=[stale];draw(trial);
  assert.equal(calls.filter(c=>c.name==='drawImage'&&(c.args[0]?.src?.includes('CombatVfxV4/')||c.args[0]?.src?.endsWith('/projectile.png'))).length,0);
  assert.equal(calls.filter(c=>c.name==='fillText'&&c.args[0]==='회피').length,1);
  if(options.reduced)assert.equal(bodyCount(calls),2);
 },options);
});

test('shared pose is event-bound, target-only, directional and unchanged by future or repeated packets',()=>{
 const pts=new Map([['source',{x:100,y:200,width:80,height:100}],['target',{x:250,y:200,width:80,height:100}]]);
 const c=createCombatVfxCursor();c.consume({streamId:'x',events:[]},0);
 const before=c.consume({streamId:'x',events:[launch,miss]},.7);assert.equal(combatDodgePose(before,pts,'target',.7),null);
 const f=c.consume({streamId:'x',events:[launch,miss]},1.09),p=combatDodgePose(f,pts,'target',1.09);
 assert.ok(p.dx>35&&p.dy<-20);assert.equal(combatDodgePose(f,pts,'source',1.09),null);
 assert.equal(c.consume({streamId:'x',events:[launch,miss]},1.1).started.length,0);
 assert.equal(combatDodgePose(c.consume({streamId:'x',events:[launch,miss]},1.01),pts,'target',1.01),null);
 const reduced=combatDodgePose(combatVfxAt([miss],1.1),pts,'target',1.1,true);assert.equal(reduced.dx,0);assert.equal(reduced.dy,0);assert.equal(reduced.ghosts.length,0);
});
