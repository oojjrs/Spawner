// Read-only native Canvas QA using actual encounter ticks and game.js draw functions.
// Set QA_RUNTIME=1 after building to require the compiled asset, without source overlay.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as animation from '../client/unit-animation.mjs';
import * as geometry from '../client/image-geometry.mjs';
import * as presentation from '../client/creature-presentation.mjs';
import * as sizes from '../client/unit-size.mjs';
import * as assets from '../client/unit-presentation-assets.mjs';
import { createEncounters } from '../server/encounters.mjs';
const require=createRequire(import.meta.url), {createCanvas,loadImage,Image}=require('@napi-rs/canvas');
const sha=x=>createHash('sha256').update(x).digest('hex'), species='soil-mole';
const runtime=fs.readFileSync('client/runtime.js','utf8'), game=fs.readFileSync('client/game.js','utf8');
const canvas=createCanvas(800,340), ctx=canvas.getContext('2d');
const scope=vm.createContext({console,document:{createElement:()=>createCanvas(1,1)},setTimeout,clearTimeout,Image});
vm.runInContext(runtime,scope); const model={...scope.Spawner}; scope.Spawner=model;
if(!process.env.QA_RUNTIME)Object.assign(model,animation,geometry,presentation,sizes,assets);
assert.equal(model.CREATURE_WALK_ANIMATIONS[species].image,animation.CREATURE_WALK_ANIMATIONS[species].image,'compiled atlas');
for(const name of ['worldToScreen','agentBasePosition','drawCreatureWalk','drawAgentBody','drawAgentUnscaledBody','unitDisplayScale','calculateUnitDisplayScale','unitDisplayFloor']) {
  const match=game.match(new RegExp('^    function '+name+'\\([^]*?^    }','m')); assert.ok(match,name); vm.runInContext(match[0],scope);
}
Object.assign(scope,{ctx,viewport:{width:800,height:340},idleMotion:{matches:false},displayedAgent:x=>x,agentBirthPose:()=>null,
 objectOutlineColor:()=>null,drawSelectionOutline(){},drawCreatureSpawn:()=>false,drawCreatureHurt:()=>false,drawCreatureAttack:()=>false,
 appearanceWorldPoses:new Map(),unitDisplayScales:new Map(),unitDisplayBounds:new Map(),unitDisplayScaleCache:new WeakMap(),AGENT_HEIGHT:.7});
scope.interpolatedAgentPosition=a=>scope.agentBasePosition(a);
function fixture(facing,terrain=4) {
 const cells=[];for(let y=84;y<=116;y++)for(let x=84;x<=116;x++)cells.push(y*320+x);
 const player={id:'player',ownerId:'qa',x:100-facing,y:100,health:10000,mode:'gather',attributes:{},stats:{health:10000,combatStrength:20,speed:1,attack:1},moveStartedAt:0,moveDuration:0};
 const room={seed:7,simSeconds:720,games:new Map([['qa',{agents:[player],discoveredKinds:new Set(),colonyFood:0,isVisible:()=>false,receiveDamage(){}}]]),colonies:[],food:new Map(),world:{seed:7,terrain:new Uint8Array(320*320).fill(terrain),hazards:new Uint8Array(320*320),sites:[],burrows:[],encounters:[{key:species,x:100,y:100,radius:16,safeRadius:0,terrains:[2,3,4,5,6,7,8,9,10],nearWater:false,cells,route:[32100,32100+facing,32100+2*facing],spawnPoints:[32100],populationLimit:1,homeId:null}]}};
 const system=createEncounters(room,null,[]),a=system.agents[0];assert.ok(a);
 room.creatureSystem={agents:system.agents,burrows:[],burrowAt:()=>null};
 Object.assign(a,{x:100,y:100,homeX:100,homeY:100,renderFromX:100,renderFromY:100,moveStartedAt:720,moveDuration:0,nextActionAt:720,mode:'idle',hidden:false,stepCount:0,routeCursor:0,routeDirection:1});
 system.tick(); assert.equal(a.mode,'walk'); assert.equal(a.facing,facing); assert.equal(a.y,100); assert.equal(a.x,100+facing);
 return structuredClone(a);
}
function bounds(image,n) {
 const cv=createCanvas(n,n),c=cv.getContext('2d');c.drawImage(image,0,0);const data=c.getImageData(0,0,n,n).data;
 let x=n,y=n,r=0,b=0;for(let yy=0;yy<n;yy++)for(let xx=0;xx<n;xx++)if(data[(yy*n+xx)*4+3]>=16){x=Math.min(x,xx);y=Math.min(y,yy);r=Math.max(r,xx+1);b=Math.max(b,yy+1);}
 return {x,y,width:r-x,height:b-y};
}
const clip=model.CREATURE_WALK_ANIMATIONS[species],idle=model.CREATURE_IDLE_ANIMATIONS[species];
const sprite=await loadImage(clip.image),idleSprite=await loadImage(idle.image),idleBounds=bounds(idleSprite,idle.frameSize);
const entryScale=model.creatureIdleSheetScale(idle,idleBounds),metrics=model.unitDisplayMetrics(model.unitDisplaySize({species}),idle,idleBounds,1.4*entryScale*idle.registrationScale);
const resources={walk:new Map([[species,{animation:clip,sprite,scale:entryScale}]]),idle:new Map([[species,{animation:idle,sprite:idleSprite,scale:entryScale}]]),attack:new Map(),hurt:new Map(),ranged:new Map(),walkDisplayScale:a=>scope.unitDisplayScale(a)};
Object.assign(scope,{creatureWalkSheets:resources.walk,creatureIdleSheets:resources.idle,creaturePresentationResources:resources});
scope.unitDisplayScales.set(species,metrics.scale);scope.unitDisplayBounds.set(species,metrics.bounds);
const sizePerCell=1.4*entryScale*clip.frameSize/clip.viewSize*metrics.scale, strideCells=clip.strideFrameRatio*sizePerCell;
const contactKeys={near:[[226,405],[286,401],[313,398],[324,379],[322,367],[276,340],[224,371],[232,406]],far:[[162,367],[141,347],[113,346],[86,361],[92,376],[128,376],[134,369],[151,364]]};
const starts=clip.durationsMs.map((_,i)=>clip.durationsMs.slice(0,i).reduce((a,b)=>a+b,0));
const rows=[],checks=[],samples=createCanvas(1000,420),sc=samples.getContext('2d');sc.fillStyle='#20372b';sc.fillRect(0,0,1000,420);sc.fillStyle='#eff4eb';sc.font='18px sans-serif';sc.fillText('Approved mole: actual game.js world drawing, both facings',20,28);
for(const facing of [-1,1])for(const terrain of [4,6,9]) {
 const a=fixture(facing,terrain),before=JSON.stringify(a),cycle=a.moveDuration*strideCells;
 assert.equal(a.stats.speed,.65);const frames=new Set(),run=[];
 scope.state={simSeconds:720,camera:{zoom:96,x:100.5-(400-400)/96,y:101-(200-170)/96},lastFrame:0};
 for(let i=0;i<8;i++) {
  const t=720+(starts[i]+clip.durationsMs[i]/2)/640*cycle;scope.state.simSeconds=t;scope.state.lastFrame=i+1;
  const p=model.creaturePresentationPose(model,a,t,false,resources,'walk');assert.ok(p);frames.add(p.frame);
  canvas.width=800;scope.drawAgentBody(0,a);
  const data=ctx.getImageData(0,0,800,340).data;
  assert.ok(data.some((v,j)=>j%4===3&&v>128),'visible actual drawing');
  const root=scope.agentBasePosition(a),point=scope.worldToScreen(root.x+.5,root.y+p.groundOffset);
  const px=96*sizePerCell/512;
  const x=point.x+(p.mirrorX?-1:1)*(contactKeys.near[p.frame][0]-clip.pivotX*2)*px;
  const y=point.y+(contactKeys.near[p.frame][1]-clip.pivotY*2)*px;
  run.push({time:t,frame:p.frame,rootX:point.x,rootY:point.y,nearX:x,nearY:y});
  if(i%10===0)global.gc?.();
 }
 assert.equal(frames.size,8); assert.equal(JSON.stringify(a),before);
 assert.equal(model.creaturePresentationPose(model,a,720+a.moveDuration+1e-7,false,resources,'walk'),null);
 assert.equal(model.creaturePresentationPose(model,a,720+a.moveDuration+1e-7,false,resources)?.action,'idle');
 assert.equal(model.creaturePresentationPose(model,a,719.99,false,resources,'walk'),null);
 const contactSamples=starts.map((start,frame)=>{
  const t=720+(start+.0001)/640*cycle; scope.state.simSeconds=t; scope.state.lastFrame++;
  const p=model.creaturePresentationPose(model,a,t,false,resources,'walk');assert.equal(p.frame,frame);
  const root=model.unitMovementPosition(a,t),point=scope.worldToScreen(root.x+.5,root.y+1),px=96*sizePerCell/512;
  const x=key=>point.x+(p.mirrorX?-1:1)*(contactKeys[key][frame][0]-clip.pivotX*2)*px;
  if(terrain===4){canvas.width=800;scope.drawAgentBody(0,a);const col=frame%4,row=Math.floor(frame/4),yy=(facing<0?75:255)+row*65;sc.drawImage(canvas,350,160,100,90,50+col*240,yy,150,135);sc.fillStyle='#eff4eb';sc.font='12px sans-serif';sc.fillText(`f${frame} ${facing<0?'left':'right'}`,35+col*240,yy+8);}
  return{frame,near:x('near'),far:x('far')};
 });
 const range=v=>Math.max(...v)-Math.min(...v);
 const nearSupportError=range(contactSamples.slice(0,3).map(v=>v.near)),farSupportError=range(contactSamples.slice(4,6).map(v=>v.far));
 assert.ok(nearSupportError<.1);assert.ok(farSupportError<.1);
 checks.push({facing,terrain,allEightFrames:true,visibleNativeGameDrawing:true,snapshotUnchanged:true,stopBecomesIdle:true,cycleMs:cycle*1000,nearSupportKeyErrorPx:nearSupportError,farSupportKeyErrorPx:farSupportError,oneCellMs:a.moveDuration*1000});
 rows.push({facing,terrain,contactSamples,run});
}
const report={method:process.env.QA_RUNTIME?'Compiled runtime + exact game.js draw functions on native Canvas with actual createEncounters snapshots. Not browser UI QA.':'Current source modules + exact game.js draw functions on native Canvas with actual createEncounters snapshots; compiled runtime pending. Not browser UI QA.',
 runtimeSHA256:sha(runtime),gameSHA256:sha(game),clip,assetSHA256:sha(fs.readFileSync(clip.image)),idleBounds,entryScale,displayScale:metrics.scale,sizePerCell,strideCells,speed:.65,displayedBodyCells:.375,
 maximumHoldTravelPxAtZoom96:Math.max(...clip.durationsMs)/640*strideCells*96,
 note:'Contact landmarks are independently observed source claw tips. Support keys align within 0.1 px; eight-key held frames still produce up to 5.3 px stepping at zoom96, not perfect continuous foot locking. No sprite cross-fade. Vertical/diagonal motion remains side-view art.',checks,rows};
fs.writeFileSync('tools/mole-grounded-walk-render-qa.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync('tools/mole-grounded-walk-render-qa.png',samples.toBuffer('image/png'));
console.log(JSON.stringify({...report,rows:undefined},null,2));
