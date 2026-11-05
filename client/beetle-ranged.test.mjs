import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createContext,runInContext} from 'node:vm';
import {CREATURE_RANGED_ANIMATIONS,creatureRangedPose,creatureRangedOutlet} from './creature-ranged.mjs';
import {CREATURE_RANGED_EFFECTS,creatureRangedEffectCommand} from './creature-ranged-vfx.mjs';
import {creatureAttackPose,creatureHurtPose} from './unit-animation.mjs';
import {imageFrameGeometry} from './image-geometry.mjs';
import {createCombatVfxCursor} from './combat-vfx-events.mjs';
import {createDetailCombatVfx,drawDetailVfxCell,DETAIL_COMBAT_VFX,DETAIL_COMBAT_VFX_ASSETS} from './combat-detail-vfx.mjs';
import {BEETLE_SPRITE,BEETLE_ATTACK_SPRITE,beetleAnimationPose} from '../server/beetle-animation.mjs';
import {unitDisplaySize} from './unit-size.mjs';
import {imageDimensions,auditImages} from './image-audit.mjs';
const species=['spiny-back-beetle','spiny-back-leader'];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const unit=(key,direction=-1)=>({id:'source',species:key,health:100,facing:direction,stats:{health:100},attack:{dnaRanged:true,startedAt:1,launchedAt:1.4,hitAt:2,endsAt:2.2,shotLaunches:[1.4],directionX:direction}});
const game=readFileSync(new URL('./game.js',import.meta.url),'utf8');

test('approved native beetle body and effect atlases retain identity and source limits',()=>{
 for(const key of species){const a=CREATURE_RANGED_ANIMATIONS[key],fx=CREATURE_RANGED_EFFECTS[key],p=JSON.parse(readFileSync(new URL(`../DesignAssets/Animations/CreatureRangedV1/${key}/approval.json`,import.meta.url)));
  assert.equal(p.status,'user-approved-body-and-effects');assert.equal(p.audio,false);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../'+a.image,import.meta.url))).digest('hex'),p.body.sha256);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../'+fx.image,import.meta.url))).digest('hex'),p.effects.sha256);
  assert.deepEqual(imageDimensions(new URL('../'+a.image,import.meta.url)),[2048,1024]);
  assert.ok(DETAIL_COMBAT_VFX_ASSETS.includes(fx.image));assert.equal(a.launchAtMs,a.durationsMs.slice(0,4).reduce((a,b)=>a+b));
  assert.equal(a.durationMs,a.durationsMs.reduce((a,b)=>a+b));
  auditImages(new URL('..',import.meta.url).pathname,[a.image,fx.image]);
 }
});
test('beetle release frames follow every authoritative launch and reject canceled/dead attacks',()=>{
 for(const key of species)for(const direction of [-1,1])for(const gap of [.03,.12,.6])for(const count of [1,4,13]){
  const a=unit(key,direction);a.attack.shotLaunches=Array.from({length:count},(_,i)=>1.4+i*gap);a.attack.endsAt=a.attack.shotLaunches.at(-1);
  for(const [shotIndex,at]of a.attack.shotLaunches.entries()){const p=creatureAttackPose(a,at);assert.equal(p.action,'ranged');assert.equal(p.frame,4);assert.equal(p.shotIndex,shotIndex);assert.equal(p.mirrorX,direction>0);}
  assert.equal(creatureRangedPose(a,a.attack.endsAt+.000001),null);
  assert.equal(creatureRangedPose({...a,health:0},1.4),null);assert.equal(creatureRangedPose({...a,attack:null},1.4),null);assert.equal(creatureRangedPose({...a,birth:{}},1.4),null);
  const left=creatureRangedOutlet(a,-1),right=creatureRangedOutlet(a,1);assert.ok(left.x<0&&left.y<0);near(left.x,-right.x);near(left.y,right.y);
 }
});
test('all generated effect anchors are exact in both directions and release/impact tails expire',()=>{
 for(const key of species)for(const angle of [0,Math.PI,.7,-2])for(const kind of ['flight','release','impact']){
  const fx=CREATURE_RANGED_EFFECTS[key],c=creatureRangedEffectCommand(fx,kind,{x:300,y:220,size:90,angle,age:.01});assert(c);
  const a=kind==='flight'?fx.flightAnchor:kind==='release'?[432/512,.5]:fx.impactAnchors[0].map(v=>v/512),dx=(a[0]-.5)*c.size,dy=(a[1]-.5)*c.size;
  near(c.x+Math.cos(c.angle)*dx-Math.sin(c.angle)*dy,300);near(c.y+Math.sin(c.angle)*dx+Math.cos(c.angle)*dy,220);
  assert.equal(creatureRangedEffectCommand(fx,kind,{x:0,y:0,size:90,age:-.01}),null);
 }
 for(const fx of Object.values(CREATURE_RANGED_EFFECTS)){assert.equal(creatureRangedEffectCommand(fx,'release',{age:.1}),null);assert.equal(creatureRangedEffectCommand(fx,'impact',{age:.32}),null);}
});
function scene(key,direction=-1){
 const source=unit(key,direction),target={id:'target',tribe:'bean',health:100},agents=[source,target],positions=new Map([['source',{x:direction<0?800:200,y:400,width:100,height:80}],['target',{x:direction<0?200:800,y:400,width:100,height:80}]]),detail=createDetailCombatVfx(),cursor=createCombatVfxCursor();
 const launch={id:'launch',kind:'shoot',sourceId:'source',targetId:'target',mode:'ranged',projectileId:'shot',at:1,arrivesAt:2};
 const draw=(time,events=[launch],visible=agents)=>{detail.consume(cursor.consume({version:1,streamId:'beetle',events},time),time);return detail.commands(visible,positions,time,200,{scope:'stage',width:1000,height:500});};draw(0,[]);return{source,target,positions,detail,launch,draw};
}
test('native flight keeps authoritative tip through recoil, late ETA, mirroring and repeated snapshots',()=>{
 for(const key of species)for(const direction of[-1,1]){
  const s=scene(key,direction),first=s.draw(1).find(c=>c.kind==='flight'),outlet=creatureRangedOutlet(s.source,direction);assert(first);
  near(first.headX,s.positions.get('source').x+outlet.x*200);near(first.headY,s.positions.get('source').y+outlet.y*200);
  s.positions.get('source').x+=150;const next=s.draw(1.5).find(c=>c.kind==='flight');near(next.headX,(first.headX+s.positions.get('target').x)/2);near(next.headY,(first.headY+360)/2);
  assert.deepEqual(s.draw(1.5).find(c=>c.kind==='flight'),next);assert.equal(s.draw(2.1).filter(c=>c.kind==='impact').length,0);
  assert.equal(s.draw(1.5,s.launch? [s.launch]:[],[s.target]).length,0);
 }
});
test('actual outcomes close flight without fake impacts; independent damage and defense remain distinct',()=>{
 for(const key of species)for(const kind of ['hit','critical','dodge','parry','block','projectile-cancel']){
  const s=scene(key);s.draw(1);const amount=kind==='hit'||kind==='critical'?3:0,outcome={...s.launch,id:'outcome',kind,at:1.5,amount};
  const rows=s.draw(1.5,[s.launch,outcome]);assert.equal(rows.filter(c=>c.kind==='flight').length,0);
  const impacts=rows.filter(c=>c.kind==='impact');assert.equal(impacts.length,amount?1:0);if(amount)assert.equal(impacts[0].image,CREATURE_RANGED_EFFECTS[key].image);
  assert.equal(s.draw(1.83,[s.launch,outcome]).filter(c=>c.kind==='impact').length,0);
 }
 const s=scene(species[0]);s.draw(1);const block={...s.launch,id:'block',kind:'block',at:1.5,amount:1},area={...s.launch,id:'area',kind:'area',at:1.5,amount:2};const rows=s.draw(1.5,[s.launch,block,area]);
 assert.equal(s.detail.defenseCommands(s.positions,1.5).length,1);assert.equal(rows.find(c=>c.eventId==='area').image,DETAIL_COMBAT_VFX.hit.image);
});
test('world and modal body calls select ranged instead of the special beetle melee branch',()=>{
 for(const key of species){const a=unit(key),calls=[],animation=CREATURE_RANGED_ANIMATIONS[key],sprite={complete:true,naturalWidth:2048};
  const context={save(){},restore(){},translate(){},scale(){},drawImage(...args){calls.push(args);}};
  const box=createContext({Spawner:{creatureAttackPose,creatureRangedPose,creatureHurtPose,imageFrameGeometry,beetleAnimationPose,BEETLE_SPRITE,BEETLE_ATTACK_SPRITE},state:{simSeconds:1.4,camera:{zoom:100}},creatureAttackSheets:new Map(),creatureRangedSheets:new Map([[key,{animation,sprite,scale:1}]]),creatureHurtSheets:new Map(),creatureIdleSheets:new Map(),worldToScreen:(x,y)=>{calls.push({point:[x,y]});return{x,y};},objectOutlineColor:()=>null,ctx:context});
  runInContext(game.match(/^    function drawCreatureAttack\([^]*?^    }/m)[0],box);assert.equal(box.drawCreatureAttack(a,{x:0,y:0}),true);assert.deepEqual(calls.at(-1).slice(1,5),[0,512,512,512]);assert.equal(calls.find(c=>c.point).point[1],key===species[0]?.86:1);
  runInContext(game.match(/^    function drawCombatCreature\([^]*?^    }/m)[0],box);assert.equal(box.drawCombatCreature(context,a,300,300,150),true);assert.deepEqual(calls.at(-1).slice(1,5),[0,512,512,512]);
 }
});
test('world native effects replace only approved visible events and preserve loading/defense fallback',()=>{
 for(const missing of [false,true]){const calls=[],source=unit(species[0]),target={id:'target',tribe:'bean',health:100},images=new Map(),effect=CREATURE_RANGED_EFFECTS[species[0]],ctx=new Proxy({save(){},restore(){},translate(){},rotate(){},drawImage(){calls.push('art');},arc(){calls.push('generic');}},{get:(o,k)=>o[k]||(()=>{})});
 const box=createContext({Spawner:{CREATURE_RANGED_EFFECTS,creatureRangedEffectCommand,drawDetailVfxCell,creatureRangedOutlet,unitDisplaySize},Image:class{complete=!missing;naturalWidth=2048;},detailVfxImages:images,assetSource:x=>x,ctx,state:{simSeconds:1.5},worldToScreen:(x,y)=>({x:x*100,y:y*100}),visibleAgents:()=>[source,target],combatVfxFrame:{active:[],projectiles:[{id:'launch',sourceId:'source',targetId:'target',from:{x:4,y:2},to:{x:1,y:2},progress:.5,launchedAt:1,arrivesAt:2}]}});
 runInContext(game.match(/^    function drawWorldCreatureEffect\([^]*?^    }/m)[0]+'\n'+game.match(/^    function drawRecordedDnaEffects\([^]*?^    }/m)[0],box);box.drawRecordedDnaEffects(100);assert.equal(calls.includes('art'),!missing);assert.equal(calls.includes('generic'),missing);
 calls.length=0;box.combatVfxFrame={projectiles:[],active:[{channel:'impact',kind:'hit',mode:'ranged',sourceId:'source',targetId:'target',eventId:'hit',amount:2,age:.28,from:{x:4,y:2},to:{x:1,y:2}}]};box.drawRecordedDnaEffects(100);assert.equal(calls.includes('art'),!missing);
 calls.length=0;box.combatVfxFrame.active.push({channel:'defense',kind:'block',eventId:'hit'});box.drawRecordedDnaEffects(100);assert.equal(calls.includes('art'),false);
 }
});
