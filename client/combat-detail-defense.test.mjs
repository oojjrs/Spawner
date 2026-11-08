import { combatViewLayout, unitDisplaySize } from "./unit-size.mjs";
import { drawUnitAttackRing } from "./unit-attack-ring.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createCombatVfxCursor } from './combat-vfx-events.mjs';
import { createDetailCombatVfx, DETAIL_COMBAT_VFX, DETAIL_COMBAT_VFX_ASSETS, DETAIL_DEFENSE_VFX,
  drawDetailVfxCell, drawDetailVitalEffect, detailDefenseCommands, detailDefenseImageReady,
  drawDetailDefenseEffect, drawDetailDefenseFallback, drawDetailDefenseLabels } from './combat-detail-vfx.mjs';
const event = (kind, extra = {}) => ({ id:kind, kind, at:1, sourceId:'source', targetId:'target', amount:0, ...extra });
const points = new Map([['source',{x:100,y:250,width:70,height:90}],['target',{x:300,y:250,width:70,height:90}]]);
const image = kind => ({complete:true,naturalWidth:1254,path:DETAIL_DEFENSE_VFX[kind]});
test('defense uses observed outcome time, expires once, and redacted direction does not draw',()=>{
 const cursor=createCombatVfxCursor(),detail=createDetailCombatVfx();cursor.consume({streamId:'a',events:[]},0);
 const e=event('parry');
 detail.consume(cursor.consume({streamId:'a',events:[e]},.99),.99);assert.equal(detail.defenseCommands(points,.99).length,0);
 detail.consume(cursor.consume({streamId:'a',events:[e,e]},1.05),1.05);let commands=detail.defenseCommands(points,1.05);assert.equal(commands.length,1);assert.ok(detailDefenseImageReady(image('parry'),commands[0]));
 detail.consume(cursor.consume({streamId:'a',events:[{...e,sourceId:null}]},1.1),1.1);commands=detail.defenseCommands(points,1.1);assert.equal(commands.length,1);assert.equal(detailDefenseImageReady(image('parry'),commands[0]),false);
 detail.consume(cursor.consume({streamId:'a',events:[e]},1.45),1.45);assert.equal(detail.defenseCommands(points,1.45).length,0);
 detail.consume(cursor.consume({streamId:'b',events:[e]},1.2),1.2);assert.equal(detail.defenseCommands(points,1.2).length,0);
});
test('lab stage-clock mapping keeps exact original event identity and residual amount',()=>{
 const detail=createDetailCombatVfx(),cue={id:'block:defense',eventId:'block',kind:'block',channel:'defense',sourceId:'source',targetId:'target',at:10,eventAt:1,endsAt:1.45};
 detail.consume({started:[cue,{...cue,kind:'hit',channel:'impact',amount:.7}],active:[]},10);
 const c=detail.defenseCommands(points,10.1)[0];assert.ok(c);assert.equal(c.eventAt,1);assert.equal(c.amount,.7);assert.ok(Math.abs(c.age-.1)<1e-9);
 detail.consume({started:[],active:[]},10.46);assert.equal(detail.defenseCommands(points,10.46).length,0);
});
test('labels avoid nearby actual recovery amount and stay still in reduced motion',()=>{
 const labels=[],ctx=new Proxy({fillText:(text,x,y)=>labels.push({text,x,y})},{get:(o,k)=>o[k]??(()=>{})});
 const command={kind:'block',targetId:'target',x:300,y:200,bodyHeight:100,age:.1,amount:.7};
 drawDetailDefenseLabels(ctx,[command],{width:1040,height:480,reducedMotion:true,vitals:[{kind:'drain',targetId:'target',y:200,bodyHeight:100,age:.1,lane:0,labelY:130}]});
 const damage=labels.find(l=>l.text==='−0.7');assert.ok(Math.abs(damage.y-130)>=26);assert.ok(labels.find(l=>l.text==='방어').y>250);
 labels.length=0;
 drawDetailDefenseLabels(ctx,[command],{width:1040,height:480,reducedMotion:true,vitals:[{kind:'regeneration',targetId:'target',y:200,bodyHeight:100,age:.1,lane:0,labelY:130}]});
 assert.equal(labels.find(l=>l.text==='−0.7').y,136);
});

test('actual lab stage replaces only defense impacts, keeps loading fallback, and shows the requested labels',async()=>{
 const {createCombatStage}=await import('./combat-stage.mjs');
 const previous={window:globalThis.window,Image:globalThis.Image,assets:globalThis.SpawnerAssets};
 try {
  globalThis.window={matchMedia:()=>({matches:false}),devicePixelRatio:1};delete globalThis.SpawnerAssets;
  for(const unavailable of [false,true])for(const kind of ['block','parry']){
   const draws=[],labels=[];
   globalThis.Image=class{constructor(){this.complete=true;this.naturalWidth=4096;this.naturalHeight=4096;}set src(value){this.path=value;if(unavailable&&value===DETAIL_DEFENSE_VFX[kind])this.naturalWidth=0;}get src(){return this.path;}async decode(){if(!this.naturalWidth)throw new Error('missing fixture art');}};
   const context=new Proxy({drawImage:(image,...args)=>draws.push({image:image.src,args}),fillText:(text,x,y)=>labels.push({text,x,y})},{get:(o,k)=>o[k]??(()=>{})});
   const canvas={clientWidth:1040,clientHeight:480,getContext:()=>context};
   const agents=[0,1].map(side=>({id:side?'target':'source',tribe:'bean',health:100,stats:{health:100},attributes:{},combat:{side,stunnedUntil:0},animationStartedAt:0}));
   const trial={agents,history:[],projectiles:[],time:0,result:()=>null,vfx:{version:1,streamId:'lab',events:[]}},stage=createCombatStage(canvas);
   if(unavailable)await assert.rejects(stage.prepare(),/missing fixture art/);else await stage.prepare();
   stage.render(trial,100,true);draws.length=0;labels.length=0;
   trial.time=1.08;const e=event(kind,{amount:kind==='block'?.7:0});trial.vfx.events=[e];trial.history=[{kind,attackerId:'source',targetId:'target',time:1,damage:e.amount}];
   stage.render(trial,1180,true);
   assert.equal(draws.filter(d=>d.image===DETAIL_DEFENSE_VFX[kind]).length,unavailable?0:1);
   assert.equal(draws.filter(d=>d.image===DETAIL_COMBAT_VFX.hit.image).length,unavailable&&kind==='block'?1:0);
   assert.equal(labels.filter(l=>l.text===(kind==='block'?'방어':'패링')).length,1);
   assert.equal(labels.filter(l=>l.text==='−0.7').length,kind==='block'?1:0);
   stage.clear();draws.length=0;labels.length=0;stage.render(trial,1280,false);
   assert.equal(draws.filter(d=>Object.values(DETAIL_DEFENSE_VFX).includes(d.image)).length,0,'reset does not replay old defense');
  }
 }finally{globalThis.window=previous.window;globalThis.Image=previous.Image;globalThis.SpawnerAssets=previous.assets;}
});
