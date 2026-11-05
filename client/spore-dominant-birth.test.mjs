import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {sporeDominantBirthForm,sporeDominantBirthMotion,sporeDominantBirthPose,sporeDominantBirthRow,sporeDominantBirthPixels,createSporeDominantBirthArt,SPORE_DOMINANT_BIRTH_SETTLED_AT} from './spore-dominant-birth.mjs';
import {SPORE_BIRTH_ANIMATION,sporeBirthMotion} from './birth.mjs';
const nativeScale=.005097636994742031;
const agent=(patch={})=>({id:'spore',tribe:'spore',health:10,birth:{startedAt:0},attributes:{blade:1},bornAt:0,...patch});
function pixels(){const data=new Uint8ClampedArray(512*512*4);for(let y=220;y<450;y++)for(let x=72;x<438;x++)data.set([230,140,120,255],(y*512+x)*4);return data;}
function canvas(width,height,data=new Uint8ClampedArray(width*height*4)){
 const context={getImageData:()=>({data}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:im=>{data=im.data;}};
 return {width,height,getContext:()=>context};
}

test('only living canonical spore blade/carapace births opt in after dominant projection',()=>{
 for(const [attributes,form]of [[{blade:1},'blade'],[{carapace:1},'carapace'],[{blade:1,secretion:1,carapace:1,antenna:1,feet:1},'blade'],[{carapace:1,antenna:1,feet:1},'carapace']])assert.equal(sporeDominantBirthForm(agent({attributes})),form);
 for(const patch of [{tribe:'spring'},{species:'mushroom'},{health:0},{birth:null},{attributes:{}},{attributes:{secretion:1}},{attributes:{blade:1,strength:1}},{attributes:{carapace:1,piercing:1}}])assert.equal(sporeDominantBirthForm(agent(patch)),null);
});

test('cap/neck/eye mapping stays monotone and keeps lower support attached',()=>{
 for(const form of ['blade','carapace'])for(let t=.26;t<2.38;t+=.02){
  const pose=sporeDominantBirthPose(form,t,nativeScale);let before=-Infinity;
  for(let y=0;y<=512;y++){const row=sporeDominantBirthRow(y,pose);assert.ok(row.y>before,`${form} ${t} ${y}`);assert.ok(row.sx>0);before=row.y;}
  assert.equal(sporeDominantBirthRow(448,pose).y,448+pose.rootY);
  const eye=pose.profile.eyeY;assert.ok(sporeDominantBirthRow(eye+8,pose).y>sporeDominantBirthRow(eye-8,pose).y);
 }
 const early=sporeDominantBirthPose('blade',.6,nativeScale),open=sporeDominantBirthPose('blade',1.4,nativeScale);
 assert.equal(early.open,.2);assert.equal(open.open,1);
});

test('scene landing tail settles before the idle switch without changing flight spin',()=>{
 for(const t of [.26,.82,1.31,1.94,2.10,2.26])assert.deepEqual(sporeDominantBirthMotion(t),sporeBirthMotion(t));
 for(const t of [2.38,2.419,2.42])assert.deepEqual(sporeDominantBirthMotion(t),{rotation:0,scaleX:1,scaleY:1});
});

test('native emergence follows birth facing while final body agrees with ordinary facing',()=>{
 for(const form of ['blade','carapace'])for(const facing of [-1,1])for(const birthFacing of [-1,1]){
  const p=sporeDominantBirthPose(form,.42,nativeScale,facing,birthFacing);
  const row=sporeDominantBirthRow(448,p),center=row.x+p.profile.centerX*row.sx;
  const nativeOffset=(152.5-SPORE_BIRTH_ANIMATION.pivotX)*nativeScale;
  assert.ok(Math.abs((center-256)*1.4/512*facing-nativeOffset*birthFacing)<1e-12);
  const settled=sporeDominantBirthPose(form,2.38,nativeScale,facing,birthFacing);
  for(const y of [0,220,340,390,448,512]){const r=sporeDominantBirthRow(y,settled);assert.ok(Math.abs(r.y-y)<1e-10);assert.ok(Math.abs(r.x)<1e-10);assert.equal(r.sx,1);}
 }
});

test('sampler uses source-only colors, no clipped alpha, bounded camera and exact terminal surface identity',()=>{
 const data=pixels(),sprite=canvas(512,512,data),art=createSporeDominantBirthArt(canvas),a=agent(),before=data.slice();
 const output=art.frame(sprite,a,.5,nativeScale,1,1);assert.ok(output);assert.equal(output.combatCamera.units,256);assert.equal(art.frame(sprite,a,.5,nativeScale,1,1),output);
 const result=sporeDominantBirthPixels(data,sporeDominantBirthPose('blade',.5,nativeScale));
 for(let i=0;i<result.data.length;i+=4)if(result.data[i+3])assert.deepEqual(Array.from(result.data.slice(i,i+3)),[230,140,120]);
 for(let y=0;y<result.height;y++)for(const x of [0,result.width-1])assert.equal(result.data[(y*result.width+x)*4+3],0);
 for(let x=0;x<result.width;x++)for(const y of [0,result.height-1])assert.equal(result.data[(y*result.width+x)*4+3],0);
 for(const t of [SPORE_DOMINANT_BIRTH_SETTLED_AT,2.419,2.42,3.12])assert.equal(art.frame(sprite,a,t,nativeScale,-1,1),sprite);
 assert.deepEqual(data,before);art.clear();assert.notEqual(art.frame(sprite,a,.5,nativeScale,1,1),output);
});

test('missing/tainted sources and invalid input retain fallback, then recover',()=>{
 const art=createSporeDominantBirthArt(canvas),a=agent(),data=pixels(),sprite=canvas(512,512,data);let bad=true;
 sprite.getContext=()=>({getImageData:()=>{if(bad)throw Error('not ready');return {data};}});
 assert.equal(art.frame(sprite,a,.6,nativeScale),null);bad=false;assert.ok(art.frame(sprite,a,.6,nativeScale));
 for(const [source,t,scale]of [[null,.6,nativeScale],[canvas(256,256),.6,nativeScale],[canvas(512,512),.6,nativeScale],[sprite,NaN,nativeScale],[sprite,-1,nativeScale],[sprite,.6,Infinity],[sprite,.6,0]])assert.equal(art.frame(source,a,t,scale),null);
});

test('pre-detach stalk samples only original native pixels and never includes the face',()=>{
 const data=new Uint8ClampedArray(192*192*4);for(let y=100;y<180;y++)for(let x=110;x<170;x++)data.set([225,215,185,255],(y*192+x)*4);
 const sprite=canvas(192,192,data),art=createSporeDominantBirthArt(canvas);
 for(let f=3;f<=8;f++){const stalk=art.stalk(sprite,f);assert.ok(stalk);assert.equal(art.stalk(sprite,f),stalk);const out=stalk.getContext().getImageData().data;
  for(let i=0;i<out.length;i+=4)if(out[i+3])assert.deepEqual(Array.from(out.slice(i,i+4)),Array.from(data.slice(i,i+4)));
  for(let y=137;y<192;y++)for(let x=0;x<192;x++)assert.equal(out[(y*192+x)*4+3],0);
 }
 for(const f of [0,2,9,21])assert.equal(art.stalk(sprite,f),null);assert.equal(art.stalk(canvas(256,256),3),null);
});

const game=readFileSync(new URL('./game.js',import.meta.url),'utf8'),draw=game.match(/^    function drawSporeBirth\([^]*?^    }/m)[0];
function scene(){const calls=[],draws=[],scales=[],rotations=[],handoffs=[],outlines=[],sprite={width:190,height:140,combatCamera:{units:256,pivotX:93,pivotY:138}},base=canvas(192,192),stalk=canvas(192,192);let ready=true,available=true,stalkAvailable=true;
 const scope=createContext({Spawner:{SPORE_BIRTH_ANIMATION,sporeDominantBirthForm,sporeDominantBirthMotion,sporeBirthMotion,imageScale:()=>1/3,unitRangedLifecycleAnimation:()=>null},
 AGENT_HEIGHT:.7,state:{simSeconds:1.31},idleMotion:{matches:false},combatAttributeArt:{ready:()=>ready,frame:(...x)=>{calls.push(['body',...x]);return sprite;}},
 sporeDominantBirthArt:{frame:(...x)=>{calls.push(['warp',...x]);return available?sprite:null;},stalk:(...x)=>{calls.push(['stalk',...x]);return stalkAvailable?stalk:null;}},
 sporeBirthSheet:base,sporeBirthFrames:new Map(Array.from({length:22},(_,i)=>[i,base])),tribeArt:{animationFrame:()=>null},agentRangedImage:()=>null,
 drawAgentAppearanceLayer:(...x)=>handoffs.push(x),drawSelectionOutline:(...x)=>outlines.push(x),globalThis:{SpawnerAppearance:{unitAppearanceBirthSceneForAgent:()=>null}}});
 runInContext(draw,scope);const ctx=new Proxy({drawImage:(...x)=>draws.push(x),scale:(...x)=>scales.push(x),rotate:x=>rotations.push(x)},{get:(o,k)=>o[k]||(()=>{})});
 return {scope,ctx,calls,draws,scales,rotations,handoffs,outlines,sprite,base,stalk,setReady:v=>ready=v,setAvailable:v=>available=v,setStalk:v=>stalkAvailable=v};}

test('actual scene retains the flight/spin clock, current idle phase, own facing, outline and terminal handoff',()=>{
 const s=scene(),a=agent({facing:-1,attack:{mode:'ranged'},mode:'harvest',hurtStartedAt:1.2}),original=structuredClone(a),birth={frame:12,unitVisible:true,elapsed:1.31,scale:nativeScale,facing:1,x:3,y:4};
 s.scope.drawSporeBirth(s.ctx,0,a,birth,{x:10,y:20},100,'cyan');assert.equal(s.draws[0][0],s.sprite);assert.deepEqual(s.scales[0],[-1,1]);assert.equal(s.rotations[0],sporeBirthMotion(1.31).rotation);assert.equal(s.outlines.length,1);
 const forwarded=s.calls[0][1];assert.equal(forwarded.birth,null);assert.equal(forwarded.attack,null);assert.equal(forwarded.mode,'idle');assert.equal(forwarded.hurtStartedAt,-Infinity);assert.equal(s.calls[0][2],1.31);assert.deepEqual(a,original);
 assert.deepEqual(s.draws[0].slice(1),[-93*140/256,-138*140/256,190*140/256,140*140/256]);
 s.scope.drawSporeBirth(s.ctx,0,a,{...birth,frame:21,elapsed:2.42},{x:10,y:20},100,null);assert.equal(s.handoffs.length,1);assert.equal(s.handoffs[0][2].birth,null);assert.deepEqual(s.handoffs[0][2].attributes,a.attributes);
});

test('actual scene keeps the native stalk behind the cap and falls back if either source is unavailable',()=>{
 const s=scene(),a=agent(),birth={frame:5,unitVisible:true,elapsed:.50,scale:nativeScale,facing:-1,x:3,y:4};
 s.scope.drawSporeBirth(s.ctx,0,a,birth,{x:0,y:0},100,null);assert.equal(s.draws[0][0],s.stalk);assert.equal(s.draws[1][0],s.sprite);assert.deepEqual(s.scales[0],[-1,1]);assert.deepEqual(s.scales[1],[1,1]);
 for(const setter of [s.setAvailable,s.setStalk,s.setReady]){setter(false);s.draws.length=0;s.scope.drawSporeBirth(s.ctx,0,a,birth,{x:0,y:0},100,null);assert.equal(s.draws[0][0],s.base);setter(true);}
 s.scope.idleMotion.matches=true;s.scope.drawSporeBirth(s.ctx,0,a,birth,{x:0,y:0},100,null);assert.equal(s.handoffs.length,1);
 s.scope.idleMotion.matches=false;s.draws.length=0;s.scope.drawSporeBirth(s.ctx,0,a,{...birth,unitVisible:false},{x:0,y:0},100,null);assert.equal(s.draws.length,0);
});
