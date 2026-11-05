import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createContext, runInContext } from 'node:vm';
import { CREATURE_RANGED_EFFECTS, creatureRangedBodyCanvas, creatureRangedFlightPoint, creatureRangedEffectCommand } from './creature-ranged-vfx.mjs';
import { creatureRangedOutlet } from './creature-ranged.mjs';
import { unitDisplaySize } from './unit-size.mjs';
import { createDetailCombatVfx, drawDetailVfxCell, DETAIL_COMBAT_VFX } from './combat-detail-vfx.mjs';
import { createCombatVfxCursor } from './combat-vfx-events.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const toad=CREATURE_RANGED_EFFECTS['bubble-toad'], turtle=CREATURE_RANGED_EFFECTS['vine-turtle'];
const keys=['bubble-toad','vine-turtle'];
function scene(species,direction=1){
 const source={id:'source',species,health:20,facing:direction},target={id:'target',tribe:'bean',health:20};
 const positions=new Map([['source',{x:direction>0?200:800,y:400,width:70,height:50}],['target',{x:direction>0?800:200,y:350,width:40,height:60}]]);
 const detail=createDetailCombatVfx(),cursor=createCombatVfxCursor();
 const launch={id:'launch',kind:'shoot',sourceId:'source',targetId:'target',mode:'ranged',projectileId:'shot',at:1,arrivesAt:2};
 const draw=(time,events=[launch],cell=200,width=1000,height=500)=>{detail.consume(cursor.consume({streamId:'arc',events},time),time);return detail.commands([source,target],positions,time,cell,{scope:'one',width,height});};
 draw(0,[]);return {source,target,positions,launch,draw,detail};
}
test('approved source pixels and non-square turtle are preserved byte-for-byte',()=>{
 for(const [effect,hash] of [[toad,'5f47101f0e7e89a401be932ce45a3e3faf59207ac7ebbc700350c692ed76898a'],[turtle,'be5d5d3bfdc524223cd8c8b9f0d0aef7c8b7bedced363efe9c15d50f89966ae4']])
  assert.equal(createHash('sha256').update(readFileSync(new URL('../'+effect.image,import.meta.url))).digest('hex'),hash);
 assert.equal(turtle.aspect,139/512);assert.equal(turtle.flightScale,125/512);
});
test('parabola starts and ends at authoritative points, with approved midpoint height and both tangents',()=>{
 for(const direction of [-1,1])for(const R of [60,512,900]){
  const start={x:300,y:200},end={x:300+direction*400,y:240},h=112/512*R;
  for(const u of [0,.25,.5,.75,1]){const p=creatureRangedFlightPoint(toad,start,end,u,R);near(p.x,300+direction*400*u);near(p.y,200+40*u-4*h*u*(1-u));near(p.angle,Math.atan2(40-4*h*(1-2*u),direction*400));}
  near(creatureRangedFlightPoint(turtle,start,end,.5,R).y,220);
 }
});
test('toad cel timing, asymmetric growth, impact durations and final fade match approved preview',()=>{
 for(const [age,frame] of [[0,0],[.07,1],[.14,2],[.21,3],[.28,0]]){
  const c=creatureRangedEffectCommand(toad,'flight',{x:100,y:100,size:512,age});assert.equal(c.frame,frame);
  if(age===0){near(c.width,99);near(c.height,129.6);}else if(age>=.09){near(c.width,180);near(c.height,180);}
 }
 for(const [age,frame] of [[0,4],[.07,5],[.17,6],[.31,7],[.479,7]]){
  const c=creatureRangedEffectCommand(toad,'impact',{x:100,y:200,size:512,angle:1.4,age});assert.equal(c.frame,frame);near(c.width,250);near(c.angle,0);if(age>.31)near(c.alpha,(.48-age)/.17);
 }
 assert.equal(creatureRangedEffectCommand(toad,'impact',{age:.48}),null);
 assert.equal(creatureRangedEffectCommand(turtle,'impact',{age:0}),null);
 assert.equal(creatureRangedEffectCommand(turtle,'release',{age:0}),null);
});
test('rectangular source cropping and rotated anchors preserve turtle origin; missing image falls back',()=>{
 for(const angle of [0,Math.PI,.8]){
  const c=creatureRangedEffectCommand(turtle,'flight',{x:50,y:60,size:512,angle,age:8,muzzle:{x:50,y:60}});
  near(c.width,125);near(c.height,125*139/512);assert.equal(c.frame,0);assert.ok(c.muzzleClip);
  near(c.x+Math.cos(c.angle)*(-.15*c.width),50);near(c.y+Math.sin(c.angle)*(-.15*c.width),60);
  const calls=[],ctx=new Proxy({globalAlpha:1,drawImage(...v){calls.push(v)}},{get:(o,k)=>o[k]??(()=>{})});
  assert.equal(drawDetailVfxCell(ctx,{complete:false},c),false);
  assert.equal(drawDetailVfxCell(ctx,{complete:true,naturalWidth:512,naturalHeight:139},c),true);
  assert.deepEqual(calls[0].slice(1,5),[0,0,512,139]);near(calls[0][7],125);near(calls[0][8],125*139/512);
 }
});
test('detail and lab shared commands freeze independent launches, survive recovery and resize without changing timings',()=>{
 for(const species of keys)for(const direction of [-1,1]){
  const s=scene(species,direction),first=s.draw(1)[0],R=creatureRangedBodyCanvas(s.source)*200,fx=CREATURE_RANGED_EFFECTS[species],outlet=creatureRangedOutlet(s.source,direction);
  near(first.headX,s.positions.get('source').x+outlet.x*200);near(first.headY,400+outlet.y*200);
  const start={x:first.headX,y:first.headY};s.positions.get('source').x+=100;s.source.attack=null;
  const before=structuredClone(s.launch),mid=s.draw(1.5)[0],expected=creatureRangedFlightPoint(fx,start,{x:s.positions.get('target').x,y:320},.5,R);
  near(mid.headX,expected.x);near(mid.headY,expected.y);assert.equal(mid.launchedAt,1);assert.equal(mid.arrivesAt,2);assert.deepEqual(s.launch,before);
  const second={...s.launch,id:'second',projectileId:'second',at:1.5,arrivesAt:2.5},two=s.draw(1.5,[s.launch,second]).filter(c=>c.kind==='flight');assert.equal(two.length,2);near(two[0].headX,mid.headX);assert.notEqual(two[1].headX,first.headX);
  for(const p of s.positions.values()){p.x/=2;p.y/=2;p.width/=2;p.height/=2;}
  const resized=s.draw(1.5,[s.launch,second],100,500,250)[0];near(resized.headX,mid.headX/2);near(resized.headY,mid.headY/2);near(resized.width,mid.width/2);
 }
});
test('outcomes own closure: cancel/parry/zero damage do not invent impacts; turtle retains generic hit',()=>{
 for(const species of keys)for(const kind of ['projectile-cancel','parry','block','hit'])for(const amount of [0,3]){
  const s=scene(species);s.draw(1);const result={...s.launch,id:'result',kind,amount,at:1.5};const commands=s.draw(1.5,[s.launch,result]);assert.equal(commands.filter(c=>c.kind==='flight').length,0);
  const approved=commands.filter(c=>c.image===CREATURE_RANGED_EFFECTS[species].image);assert.equal(approved.length,kind==='hit'&&amount>0&&species==='bubble-toad'?1:0);
  if(kind==='hit'&&amount>0&&species==='vine-turtle')assert.equal(commands[0].image,DETAIL_COMBAT_VFX.hit.image);
 }
});
const game=readFileSync(new URL('./game.js',import.meta.url),'utf8');
test('world uses the same arc through asset fallback and retains only authorized 480ms impact tails',()=>{
 for(const missing of [false,true]){
  const s=scene('bubble-toad'),calls=[],ctx=new Proxy({globalAlpha:1,drawImage(...args){calls.push({art:args});},arc(x,y){calls.push({x,y});}},{get:(o,k)=>o[k]??(()=>{})});
  const cursor=createCombatVfxCursor(),launch={...s.launch,from:{x:2,y:2},to:{x:6,y:2}},state={simSeconds:1};
  const box=createContext({Spawner:{CREATURE_RANGED_EFFECTS,creatureRangedEffectCommand,creatureRangedBodyCanvas,creatureRangedFlightPoint,drawDetailVfxCell,creatureRangedOutlet,unitDisplaySize},Image:class{complete=!missing;naturalWidth=2048;naturalHeight=1024;},worldRangedFlights:new Map(),worldRangedImpacts:new Map(),detailVfxImages:new Map(),assetSource:x=>x,ctx,state,worldToScreen:(x,y)=>({x:x*100,y:y*100}),visibleAgents:()=>[s.source,s.target],combatVfxFrame:{}});
  runInContext(game.match(/^    function drawWorldCreatureEffect\([^]*?^    }/m)[0]+'\n'+game.match(/^    function drawRecordedDnaEffects\([^]*?^    }/m)[0],box);
  const draw=(time,events)=>{calls.length=0;state.simSeconds=time;box.combatVfxFrame=cursor.consume({streamId:'world',events},time);box.drawRecordedDnaEffects(100);return calls;};
  draw(0,[]);draw(1,[launch]);const origin={...box.worldRangedFlights.get('launch')};draw(1.5,[launch]);
  const R=creatureRangedBodyCanvas(s.source)*100,expected=creatureRangedFlightPoint(toad,{x:origin.x*100,y:origin.y*100},{x:650,y:250},.5,R);
  if(missing){near(calls[0].x,expected.x);near(calls[0].y,expected.y);}else assert.ok(calls[0].art);
  const hit={...launch,id:'hit',kind:'hit',amount:3,at:2};draw(2,[launch,hit]);draw(2.4,[launch,hit]);assert.equal(box.worldRangedImpacts.size,1);if(!missing)assert.ok(calls[0].art);
  draw(2.48,[launch,hit]);assert.equal(box.worldRangedImpacts.size,0);
 }
});
