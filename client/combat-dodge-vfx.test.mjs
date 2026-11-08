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
const stageHelper=readFileSync(new URL('./combat-stage-vfx.test.mjs',import.meta.url),'utf8');
const launch={id:'shot',kind:'shoot',sourceId:'source',targetId:'target',at:.5,arrivesAt:1,projectileId:'p',mode:'ranged',amount:0};
const miss={...launch,id:'miss',kind:'miss',at:1};



function stage(run,options){
 const box={assert,createCombatStage};createContext(box);
 // The helper mutates globalThis in its VM; execute its lexical helpers in this
 // module's realm instead so the imported stage sees the same browser stubs.
 const text=stageHelper.slice(stageHelper.indexOf('const root ='),stageHelper.indexOf('\ntest('));
 const make=new Function('createCombatStage',text+'\nreturn {withStage,setup};');
 const {withStage,setup}=make(createCombatStage);return withStage(env=>run(env,setup),options);
}
const bodyCount=calls=>calls.filter(c=>c.name==='drawImage'&&!c.args[0]?.src?.includes('CombatVfxV4/')&&!c.args[0]?.src?.includes('grassland.webp')).length;

test('lab shares the live body echoes and one Korean label; paused tail expires without replay',async()=>{
 for(const tribe of ['bean','spore','pebble','spring'])await stage(async({draw,calls},setup)=>{
  const {trial,shoot,resolve}=setup(tribe);await draw(trial);shoot();await draw(trial);resolve('dodge',0);
  const state=JSON.stringify(trial);await draw(trial);await draw(trial);
  assert.equal(bodyCount(calls),5,tribe+' draws two bodies and three reusable echoes');
  assert.equal(calls.filter(c=>c.name==='fillText'&&c.args[0]==='회피').length,1);
  assert.equal(calls.filter(c=>c.name==='drawImage'&&c.args[0]?.src?.includes('CombatVfxV4/')).length,0);
  assert.equal(JSON.stringify(trial),state);
  for(let n=0;n<7;n++)await draw(trial);
  assert.equal(bodyCount(calls),2);assert.equal(calls.filter(c=>c.name==='fillText'&&c.args[0]==='회피').length,0);
 });
});

test('lab closes even a stale fallback projectile at the observed miss, with loading failures or reduced motion',async()=>{
 for(const options of [{},{unavailable:true},{reduced:true}])await stage(async({draw,calls},setup)=>{
  const {trial,shoot,resolve}=setup('spore');await draw(trial);shoot();await draw(trial);const stale=trial.projectiles[0];
  assert.ok(calls.some(c=>c.name==='drawImage'&&(c.args[0]?.src?.includes('CombatVfxV4/')||c.args[0]?.src?.endsWith('/projectile.png'))));
  resolve('dodge',0);trial.projectiles=[stale];await draw(trial);
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
