import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {UNIT_ACTION_ART} from './unit-action-art-assets.mjs';
import {createUnitActionArt,unitActionArtPose} from './unit-action-art.mjs';
import {UNIT_COMBINATION_FORMS} from './unit-combination-forms.mjs';
const load=n=>JSON.parse(readFileSync(new URL('../tools/spring-native-facing-20261108/'+n,import.meta.url)));
const original=load('followup13-catalog.json'),map=load('followup13-integration-map.json').items,proof=load('followup13-validation.json');
const sha=p=>createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex');
test('샘방울 추가 13공격은 새 전신 원본과 고정된 geometry·시간을 사용한다',()=>{
 assert.equal(original.length,13);assert.equal(map.length,13);
 for(const row of original){const {key,action,id,...clip}=row;const now=UNIT_ACTION_ART[key].actions[action],item=map.find(x=>x.key===key&&x.action===action),validation=proof.find(x=>x.id===id);
  assert.deepEqual(now,{...clip,sourceFacing:'left'},key+' '+action);assert.equal(sha(now.image),item.candidateSHA256);assert.ok(item.structurePass);assert.equal(validation.dimensionsMatch,true);
  for(const end of validation.endpoints){assert.equal(end.alphaExact,true);assert.equal(end.visibleRGBAExact,true);}
  for(const candidate of Object.values(UNIT_ACTION_ART[key].actions))if(candidate.image===now.image)assert.equal(candidate.sourceFacing,'left',key+' alias');
 }
});
test('추가 200 공격셀은 양방향 400 draw에서 같은 전신 crop과 상대 방향을 사용한다',async()=>{
 const art=createUnitActionArt(p=>p,(w,h)=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(w*h*4).fill(255)})})}),async image=>({image}));let count=0;
 for(const row of original){const[tribe,form]=row.key.split('/'),clip=UNIT_ACTION_ART[row.key].actions[row.action],attributes=UNIT_COMBINATION_FORMS.find(x=>x.key===form)?.attributes||{[form]:1};let elapsed=0;
  for(let frame=0;frame<clip.frameCount;frame++){const time=(elapsed+clip.durationsMs[frame]/2)/1000,agent={tribe,attributes,health:10,attack:{startedAt:0,endsAt:clip.durationsMs.reduce((a,b)=>a+b,0)/1000,mode:row.action==='ranged'?'ranged':'melee'}};const pose=unitActionArtPose(agent,time);assert.equal(pose.animation.image,clip.image);assert.equal(pose.frame,frame);await art.prepare(agent,time);
   for(const facing of[-1,1]){const calls=[],scales=[],ctx={save(){},restore(){},translate(){},scale:(...v)=>scales.push(v),drawImage:(...v)=>calls.push(v)};assert.equal(art.draw(ctx,agent,time,200,400,100,facing===-1),true);assert.equal(calls.length,1);assert.equal(calls[0][0].image,clip.image);assert.deepEqual(scales,[[facing===-1?1:-1,1]]);assert.deepEqual(calls[0].slice(1,5),[frame%clip.columns*clip.frameSize,Math.floor(frame/clip.columns)*clip.frameHeight,clip.frameSize,clip.frameHeight]);count++;}
   elapsed+=clip.durationsMs[frame];
  }
 }assert.equal(count,400);
});
