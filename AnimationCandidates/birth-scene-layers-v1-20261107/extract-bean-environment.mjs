import {createRequire} from 'node:module';import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';import {resolve} from 'node:path';
import {agentBirthMotion,AGENT_BIRTH_DURATION} from 'file:///workspace/scratch/cdf786db13f9/Spawner/server/birth.mjs';
import {drawBirthSeed,drawBirthFragments,drawBirthImpact} from 'file:///workspace/scratch/cdf786db13f9/Spawner/client/birth.mjs';
const {createCanvas,loadImage}=createRequire('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/package.json')('@napi-rs/canvas');const repo="/workspace/scratch/cdf786db13f9/Spawner";const out="/workspace/shared/birth-scene-layers-v1-20261107";
const W=512,H=512,cell=80;
const nestSize=5*cell,nestX=150,nestFloor=230;
const nestY=nestFloor-nestSize*1860/2048;
const mouth={x:nestX,y:nestY+nestSize*(1181/2048+.9)/2};
const from={x:mouth.x,y:mouth.y+(.24*1.42/2+.42)*cell};
const target={x:430,y:446};
const order=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0];
const nestDurations=[231,175,124,105,96,89,86,84,84,86,89,96,105,124,175,462,175,124,105,96,89,86,84,84,86,89,96,105,124,175,231];
const ageMs=[0,40,65,100,150,180,240,300,370,440,530,620,680,750,820,1020];
const drawnLift=[0,8,16,31,47,55,67,73,64,50,25,0,0,0,5,0];
const sceneTimes=new Set(Array.from({length:97},(_,i)=>Math.min(3840,i*40)));
for(const ms of [300,720,1180,1600,1780,2500,2570,2590,3850,...ageMs.map(t=>2590+t)])sceneTimes.add(ms);
const times=[...sceneTimes].sort((a,b)=>a-b);
const durations=times.map((t,i)=>i+1<times.length?times[i+1]-t:650);
// Exact 5 ms boundaries are retained in the atlas manifest; GIF timing is rounded separately.
const nestPath='DesignAssets/Animations/Nests/nest-stage-01-idle-sheet.png';
const nest=await loadImage(resolve(repo,nestPath));
function nestFrame(t){let rest=t%3960,i=0;while(rest>=nestDurations[i]&&i<order.length-1)rest-=nestDurations[i++];return order[i];}
function drawNest(ctx,t){
 const seconds=t/1000,f=nestFrame(t);
 let prepare=0,release=0;
 if(seconds<.30)prepare=Math.sin(seconds/.30*Math.PI*.5);
 else if(seconds<.56){let p=(seconds-.30)/.26;release=Math.sin(p*Math.PI)*(1-p);}
 ctx.save();ctx.translate(nestX,nestFloor);ctx.scale(1+prepare*.10-release*.12,1-prepare*.17+release*.22);ctx.translate(-nestX,-nestFloor);
 ctx.drawImage(nest,f%4*512,Math.floor(f/4)*512,512,512,nestX-nestSize/2,nestY,nestSize,nestSize);ctx.restore();
}

mkdirSync(out+'/bean/environment-frames',{recursive:true});
for(let i=0;i<times.length;i++){
  const t=times[i]/1000,m=agentBirthMotion(Math.min(t,AGENT_BIRTH_DURATION-1e-6),(target.x-from.x)/cell,(target.y-from.y)/cell);
  const c=createCanvas(W,H),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  drawNest(ctx,times[i]);
  const point={x:from.x+(target.x-from.x)*m.progress,y:from.y+(target.y-from.y)*m.progress};
  if(m.seedVisible)drawBirthSeed(ctx,point.x,point.y,cell,m);
  drawBirthFragments(ctx,target.x,target.y,cell,m.fractureAge);
  drawBirthImpact(ctx,target.x,target.y,cell,m.elapsed-2.50,.6);
  drawBirthImpact(ctx,target.x,target.y,cell,m.elapsed-3.21,.22);
  for(const [p,at]of[[.36,.72],[.72,1.18]])drawBirthImpact(ctx,from.x+(target.x-from.x)*p,from.y+(target.y-from.y)*p,cell,m.elapsed-at,.15);

writeFileSync(out+'/bean/environment-frames/'+i+'.png',c.toBuffer('image/png'));}
