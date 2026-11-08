import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{UNIT_BIRTH_ART,UNIT_BIRTH_ART_ASSETS}from'./unit-birth-art-assets.mjs';import{createUnitActionArt,unitActionArtPose}from'./unit-action-art.mjs';import{unitDisplaySize}from'./unit-size.mjs';
const old=JSON.parse(readFileSync('tools/birth-resolution-20261108/catalog-before.json'));
const assets=JSON.parse(readFileSync('tools/birth-resolution-20261108/new-assets.json'));
const leftPlan=JSON.parse(readFileSync('tools/spring-native-facing-20261108/bean-spore-technical-plan.json'));
const leftChanges=JSON.parse(readFileSync('tools/spring-native-facing-20261108/bean-spore-image-changes.json')).changes;
function expectedNativeClip(key,original){const value=structuredClone(original);if(!leftPlan.candidateForms.includes(key))return value;const change=leftChanges[value.image];assert.ok(change,key+' native normalization evidence');value.image=change.afterPath||change.newImage;value.sourceFacing='left';value.pivotX=value.frameSize-value.pivotX;if(value.scene?.outletX!==undefined)value.scene.outletX=value.frameSize-value.scene.outletX;return value;}
const changed=Object.keys(old).filter(k=>UNIT_BIRTH_ART[k]?.sceneLayers?.layers.some(l=>l.image.includes('/BirthResolutionV1/')));
const actor=(key,clip)=>{const[tribe,form]=key.split('/');return{tribe,attributes:form==='base'?{}:Object.fromEntries(form.split('-').map(g=>[g==='gather'?'strength':g,1])),health:10,birth:{startedAt:10,readyAt:10+clip.durationsMs.reduce((a,b)=>a+b)/1000}}};
function context(){return{calls:[],save(){},restore(){},translate(){},scale(){},drawImage(...args){this.calls.push(args);},beginPath(){},arc(){},stroke(){}}}
const surface=(w,h)=>({width:w,height:h,getContext:()=>({...context(),getImageData:()=>({data:new Uint8ClampedArray(w*h*4).fill(255)})})});
test('복원한 탄생은 크기·방향·위치·타이밍과 기존 실패 대체 이미지를 보존한다',()=>{
 assert.ok(changed.length>=20);for(const key of changed){const {sceneLayers,...after}=UNIT_BIRTH_ART[key],{sceneLayers:beforeLayers,...before}=old[key];assert.deepEqual(after,expectedNativeClip(key,before),key);assert.equal(sceneLayers.layers.filter(l=>l.wholeBody).length,1,key);assert.equal(sceneLayers.layers.at(-1).role,'body');}
});
test('새 전신 레이어는 배포 자산에 포함되고 원본 해시와 크기를 유지한다',()=>{
 const policy=JSON.parse(readFileSync('DesignAssets/image-sizes.json'));for(const a of assets){assert.ok(UNIT_BIRTH_ART_ASSETS.includes(a.path),a.path);assert.equal(createHash('sha256').update(readFileSync(a.path)).digest('hex'),(leftChanges[a.path]&&(leftChanges[a.path].afterPath||leftChanges[a.path].newImage)===a.path?leftChanges[a.path].afterSha256:a.sha256),a.path);assert.deepEqual(policy.images[a.path].nativeSource.dimensions,[a.columns*a.frameSize,Math.ceil(a.frameCount/a.columns)*a.frameHeight]);}
});
test('복원된 모든 프레임은 같은 시계와 양방향에서 원본 crop을 직접 그린다',async()=>{
 let frames=0;for(const key of changed){const clip=UNIT_BIRTH_ART[key],agent=actor(key,clip),requested=[];const dims=new Map(clip.sceneLayers.layers.map(l=>[l.image,{width:l.frameSize*l.columns,height:l.frameHeight*Math.ceil(l.frameCount/l.columns)}]));const art=createUnitActionArt(v=>v,surface,async path=>{requested.push(path);return{image:path,...dims.get(path)}});await art.prepare(agent,10);let elapsed=0;
  for(let i=0;i<clip.frameCount;i++){const time=10+elapsed/1000+1e-7,pose=unitActionArtPose(agent,time);assert.equal(pose.frame,i,key+' clock '+i);for(const mirror of[false,true]){const c=context(),outlined=[];assert.equal(art.draw(c,agent,time,0,0,100,mirror,(_,im)=>outlined.push(im.image)),true);assert.equal(c.imageSmoothingEnabled,true);assert.equal(c.imageSmoothingQuality,'high');const expected=clip.sceneLayers.layers.filter(l=>l.samples[i]);assert.deepEqual(c.calls.map(x=>x[0].image),expected.map(l=>l.image));assert.equal(outlined.length,clip.sceneLayers.layers.at(-1).samples[i]?1:0);for(let j=0;j<expected.length;j++){const l=expected[j],p=l.samples[i],call=c.calls[j],s=100*unitDisplaySize(agent)/clip.referenceLength;assert.deepEqual(call.slice(1,5),[p.frame%l.columns*l.frameSize,Math.floor(p.frame/l.columns)*l.frameHeight,l.frameSize,l.frameHeight]);assert.deepEqual(call.slice(5),[(p.destination[0]-clip.pivotX)*s,(p.destination[1]-clip.pivotY)*s,p.destination[2]*s,p.destination[3]*s]);}}
   elapsed+=clip.durationsMs[i];frames++;
  }assert.deepEqual(new Set(requested),new Set(clip.sceneLayers.layers.map(l=>l.image)),key+' no low-resolution scene or idle decode');assert.equal(unitActionArtPose(agent,agent.birth.readyAt+.000001).action,'idle');
 }assert.ok(frames>=1400);
});
test('단일 전신 레이어 실패는 기존 이미지로 복귀하고 회복하면 고해상도를 다시 사용한다',async t=>{
 const clip=UNIT_BIRTH_ART['spring/secretion'],agent=actor('spring/secretion',clip),body=clip.sceneLayers.layers[0];let now=1000,fail=true;t.mock.method(Date,'now',()=>now);const requested=[];const art=createUnitActionArt(v=>v,surface,async path=>{requested.push(path);if(path===body.image&&fail)throw Error('offline');return{image:path}});await art.prepare(agent,11);let c=context();art.draw(c,agent,11,0,0,100,false);assert.deepEqual(c.calls.map(x=>x[0].image),[clip.image]);fail=false;now+=1001;await art.prepare(agent,11);c=context();art.draw(c,agent,11,0,0,100,false);assert.deepEqual(c.calls.map(x=>x[0].image),[body.image]);assert.equal(art.readyAction(agent,11),true);
});
