import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {springDominantBirthForm,springDominantBirthPose,springDominantBirthRow,springDominantBirthPixels,createSpringDominantBirthArt,SPRING_DOMINANT_BIRTH_SETTLED_AT} from './spring-dominant-birth.mjs';
import {SPRING_BIRTH_ANIMATION,springBirthPlacement,springBirthMotion} from './birth.mjs';
const agent=(patch={})=>({id:'spring',tribe:'spring',health:10,birth:{startedAt:0},attributes:{blade:1},bornAt:0,...patch});
const profiles={blade:{top:150,tip:383.5},carapace:{top:156,tip:219.5}};
function source(){const data=new Uint8ClampedArray(512*512*4);for(let y=150;y<452;y++)for(let x=70;x<405;x++){const i=(y*512+x)*4;data.set([25,170,205,255],i);}return data;}
function canvas(width,height,data=new Uint8ClampedArray(width*height*4)){const ctx={getImageData:()=>({data}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:im=>{data=im.data;}};return {width,height,getContext:()=>ctx};}

test('only living canonical spring blade/carapace bodies opt in, preserving dominant projection and legacy fallback',()=>{
 for(const [attributes,form] of [[{blade:1},'blade'],[{blade:1,secretion:1,carapace:1,antenna:1,feet:1},'blade'],[{carapace:1,antenna:1},'carapace']])assert.equal(springDominantBirthForm(agent({attributes})),form);
 for(const patch of [{tribe:'bean'},{species:'bubble-toad'},{health:0},{birth:null},{attributes:{}},{attributes:{secretion:1}},{attributes:{blade:1,strength:1}},{attributes:{blade:1,piercing:1}}])assert.equal(springDominantBirthForm(agent(patch)),null);
});

test('common water mapping has no fold and retains the support and lower face band',()=>{
 for(const profile of Object.values(profiles))for(const time of [0,.13,.35,.53,.60,.70,.79,.9,1.08,1.219]){
  const pose=springDominantBirthPose(time);let last=-Infinity;
  for(let y=0;y<=512;y++){const row=springDominantBirthRow(y,pose,profile);assert.ok(row.y>last);assert.ok(row.sx>0);last=row.y;}
  const root=springDominantBirthRow(448,pose,profile);assert.equal(root.y,pose.rootY);
  const eye=springDominantBirthRow(365,pose,profile);assert.equal(eye.sx,pose.sx);assert.equal(eye.x,256);
 }
});

test('padded camera pins the real pre-detach outlet for both facings and current display scales',()=>{
 const pixels=source(),cell=100,a=SPRING_BIRTH_ANIMATION,outlet={x:2,y:3};
 const placement=springBirthPlacement(0,outlet,{x:3,y:5},.7*350/512);
 for(const [form,scale]of [['blade',.35246410032594844],['carapace',.37074001663914574]])for(const facing of [-1,1]){
  const result=springDominantBirthPixels(pixels,0,profiles[form],facing,scale),p=result.pose,r=springDominantBirthRow(profiles[form].top,p,profiles[form]);
  const tip=r.x-256*p.sx+profiles[form].tip*r.sx,worldPerPixel=1.4/512*scale;
  assert.ok(Math.abs(placement.rootX+(tip-256)*worldPerPixel*facing-outlet.x)<1e-10);
  assert.ok(Math.abs(placement.rootY+(r.y-448)*worldPerPixel-outlet.y)<1e-10);
  assert.ok(result.width<1400&&result.height<1400);
  for(const x of [0,result.width-1])for(let y=0;y<result.height;y++)assert.equal(result.data[(y*result.width+x)*4+3],0);
 }
});

test('sampler keeps source-only colors without row seams and supplies an exact idle identity after settling',()=>{
 const sprite=canvas(512,512,source()),art=createSpringDominantBirthArt(canvas),a=agent();
 const first=art.frame(sprite,a,.35,.352,1);assert.ok(first);assert.ok(first.combatCamera);assert.equal(first.combatCamera.units,256);
 const pixels=first.getContext('2d').getImageData().data;
 for(let i=0;i<pixels.length;i+=4)if(pixels[i+3])assert.deepEqual(Array.from(pixels.slice(i,i+3)),[25,170,205]);
 assert.equal(art.frame(sprite,a,.35,.352,1),first);
 for(const time of [SPRING_DOMINANT_BIRTH_SETTLED_AT,1.379,1.79])assert.equal(art.frame(sprite,a,time,.352,1),sprite);
 assert.notEqual(art.frame(sprite,a,.35,.352,-1),first);
 art.clear();assert.notEqual(art.frame(sprite,a,.35,.352,1),first);
});

test('pixel read failure, invalid input and blank art preserve fallback and allow recovery',()=>{
 const art=createSpringDominantBirthArt(canvas),a=agent();let fail=true;const data=source(),sprite=canvas(512,512,data);
 sprite.getContext=()=>({getImageData:()=>{if(fail)throw Error('not ready');return {data};}});
 assert.equal(art.frame(sprite,a,.35,.35),null);fail=false;assert.ok(art.frame(sprite,a,.35,.35));
 for(const [im,t,s]of [[null,.3,.35],[canvas(256,256),.3,.35],[canvas(512,512),.3,.35],[sprite,NaN,.35],[sprite,-1,.35],[sprite,.3,0],[sprite,.3,Infinity]])assert.equal(art.frame(im,a,t,s),null);
});

const game=readFileSync(new URL('./game.js',import.meta.url),'utf8'),draw=game.match(/^    function drawSpringBirth\([^]*?^    }/m)[0];
function scene(){const draws=[],water=[],calls=[],handoffs=[],scales=[],outlines=[],sprite={width:670,height:750,combatCamera:{pivotX:555,pivotY:763}},base={complete:true,naturalWidth:944};let available=true,ready=true;
 const scope=createContext({Spawner:{springDominantBirthForm,springBirthMotion,drawSpringBirthWater:(...x)=>water.push(x),drawSpringBirthSurface:(...x)=>draws.push(['fallback',...x]),unitRangedLifecycleAnimation:()=>null},
 SPRING_BIRTH_ANIMATION,AGENT_HEIGHT:.7,idleMotion:{matches:false},state:{simSeconds:.7},unitDisplayScale:()=>.352,
 combatAttributeArt:{ready:()=>ready,frame:(...args)=>{calls.push(args);return sprite;}},springDominantBirthArt:{frame:(...args)=>{calls.push(args);return available?sprite:null;}},
 springBirthSheet:base,tribeArt:{animationFrame:()=>null},agentRangedImage:()=>null,SpawnerAppearance:{unitAppearanceBirthSceneForAgent:()=>null},
 drawAgentAppearanceLayer:(...x)=>handoffs.push(x),drawSelectionOutline:(...x)=>outlines.push(x)});
 runInContext(draw,scope);const ctx=new Proxy({drawImage:(...x)=>draws.push(x),scale:(...x)=>scales.push(x)},{get:(o,k)=>o[k]||(()=>{})});
 return {scope,ctx,draws,water,calls,handoffs,scales,outlines,sprite,setAvailable:v=>available=v,setReady:v=>ready=v};}

test('actual scene hook preserves facing, water, pivot, idle clock, attributes and terminal handoff',()=>{
 const s=scene(),a=agent({facing:-1,attack:{mode:'ranged'},hurtStartedAt:.6,mode:'harvest'}),before=structuredClone(a),birth={frame:6,elapsed:.7,x:2,y:3};
 s.scope.drawSpringBirth(s.ctx,0,a,birth,{x:10,y:20},100,'cyan');assert.equal(s.draws[0][0],s.sprite);assert.equal(s.water.length,1);assert.deepEqual(s.scales[0],[-1,1]);assert.equal(s.outlines.length,1);
 const forwarded=s.calls[0][0];assert.equal(forwarded.birth,null);assert.equal(forwarded.attack,null);assert.equal(forwarded.hurtStartedAt,-Infinity);assert.equal(forwarded.mode,'idle');assert.equal(s.calls[0][1],.7);
 assert.deepEqual(a,before);assert.deepEqual(s.draws[0].slice(1),[-555*140/512,-763*140/512,670*140/512,750*140/512]);
 s.scope.drawSpringBirth(s.ctx,0,a,{...birth,frame:12},{x:10,y:20},100,null);assert.equal(s.handoffs.length,1);assert.equal(s.handoffs[0][2].birth,null);assert.deepEqual(s.handoffs[0][2].attributes,a.attributes);
});

test('actual scene falls back when unready or unreadable and reduced motion uses the settled body',()=>{
 const s=scene(),a=agent(),birth={frame:6,elapsed:.7,x:2,y:3};
 s.setAvailable(false);s.scope.drawSpringBirth(s.ctx,0,a,birth,{x:0,y:0},100,null);assert.equal(s.draws[0][0],'fallback');
 s.setAvailable(true);s.draws.length=0;s.scope.idleMotion.matches=true;s.scope.drawSpringBirth(s.ctx,0,a,birth,{x:0,y:0},100,null);assert.equal(s.draws[0][0],s.sprite);assert.equal(s.calls.at(-1)[2],SPRING_BIRTH_ANIMATION.duration);
 s.setReady(false);s.draws.length=0;s.scope.drawSpringBirth(s.ctx,0,a,birth,{x:0,y:0},100,null);assert.equal(s.draws[0][0],'fallback');
});
