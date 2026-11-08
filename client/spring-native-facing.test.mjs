import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {UNIT_ACTION_ART} from './unit-action-art-assets.mjs';
import {unitFrameMirror} from './unit-size.mjs';
import {createUnitActionArt,unitActionArtPose} from './unit-action-art.mjs';
import {UNIT_COMBINATION_FORMS} from './unit-combination-forms.mjs';
const load=name=>JSON.parse(readFileSync(new URL('../tools/spring-native-facing-20261108/'+name,import.meta.url)));
const sha=image=>createHash('sha256').update(readFileSync(new URL('../'+image,import.meta.url))).digest('hex');
const originals=load('original-clips.json'), attacks=load('attack-integration-map.json'), attackBefore=load('attack-clips-before.json');

test('이미 좌향인 샘방울 30개 대기·이동 원본은 픽셀과 등록 좌표를 보존한다',()=>{
  assert.equal(originals.length,30);
  for(const row of originals){
    const clip=UNIT_ACTION_ART[row.key].actions[row.action];
    assert.deepEqual(clip,{...row.before,sourceFacing:'left'},row.key+'/'+row.action);
    assert.equal(sha(clip.image),row.sourceSha256,clip.image);
    assert.equal(unitFrameMirror(clip.sourceFacing,-1),false);
    assert.equal(unitFrameMirror(clip.sourceFacing,1),true);
    for(const definition of Object.values(UNIT_ACTION_ART))for(const alias of [definition.reference,...Object.values(definition.actions)])
      if(alias.image===clip.image)assert.equal(alias.sourceFacing,'left',row.key+' alias');
  }
});

test('피격·사망과 몽돌 갑각+안테나도 좌향 원본을 그대로 표시한다',()=>{
  const additional=load('additional-original-clips.json');
  assert.equal(additional.length,34);
  for(const row of additional){
    assert.deepEqual(UNIT_ACTION_ART[row.key].actions[row.action],{...row.before,sourceFacing:'left'},row.key+'/'+row.action);
    assert.equal(sha(row.before.image),row.sourceSha256,row.before.image);
  }
});

test('재작업한 일곱 공격은 원본 왼쪽 동작과 기존 프레임 규격·타이밍을 사용한다',()=>{
  const validation=load('attack-validation.json');
  assert.equal(attacks.length,7);
  for(const row of attacks){
    const clip=UNIT_ACTION_ART[row.key].actions.attack;
    const {key,...before}=attackBefore.find(c=>c.key===row.key);
    assert.deepEqual(clip,{...before,sourceFacing:'left'},row.key);
    assert.equal(sha(clip.image),row.sha256,clip.image);
    const verified=validation.assets.find(c=>c.key===row.key);
    assert.equal(verified.checksPass,true);
    for(const endpoint of [verified.frames[0],verified.frames.at(-1)]){
      assert.equal(endpoint.endpointVisibleRGBAEqual,true);
      assert.equal(endpoint.endpointAlphaEqual,true);
    }
  }
});

test('좌향 공격의 모든 프레임이 실제 전신 draw 경로에서 좌우 상대 방향을 따른다',async()=>{
  const surface=(width,height)=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(width*height*4).fill(255)})})});
  const art=createUnitActionArt(path=>path,surface,async image=>({image}));
  let draws=0;
  for(const row of attacks){
    const [tribe,form]=row.key.split('/');
    const attributes=UNIT_COMBINATION_FORMS.find(f=>f.key===form)?.attributes || (form==='base'?{}:form==='gather'?{strength:1}:{[form]:1});
    const clip=UNIT_ACTION_ART[row.key].actions.attack;
    let elapsed=0;
    for(let frame=0;frame<clip.frameCount;frame++){
      const time=(elapsed+clip.durationsMs[frame]/2)/1000;
      const agent={tribe,attributes,health:10,attack:{startedAt:0,hitAt:(clip.hitTimeMs??300)/1000,endsAt:clip.durationsMs.reduce((a,b)=>a+b,0)/1000,speed:1,mode:'melee'}};
      const pose=unitActionArtPose(agent,time);
      assert.equal(pose.animation.image,clip.image,row.key);
      assert.equal(pose.frame,frame,row.key+'/'+frame);
      await art.prepare(agent,time);
      for(const facing of [-1,1]){
        const calls=[],scales=[];
        const context={save(){},restore(){},translate(){},scale:(x,y)=>scales.push([x,y]),drawImage:(...args)=>calls.push(args)};
        assert.equal(art.draw(context,agent,time,200,400,100,facing===-1),true);
        assert.equal(calls.length,1);
        assert.equal(calls[0][0].image,clip.image);
        assert.deepEqual(scales,[[facing===-1?1:-1,1]]);
        assert.deepEqual(calls[0].slice(1,5),[frame%clip.columns*clip.frameSize,Math.floor(frame/clip.columns)*clip.frameHeight,clip.frameSize,clip.frameHeight]);
        draws++;
      }
      elapsed+=clip.durationsMs[frame];
    }
  }
  assert.equal(draws,208);
});

test('샘방울 우선 피격 3소스는 원본과 두 피격 블록을 보존하고 실제 좌향으로 등록된다',async()=>{
 const {SPECIES_HELD_HURT_SOURCES}=await import('./species-held-hurt-assets.mjs');
 const {drawSpeciesHeldHurt}=await import('./species-held-hurt.mjs');
 const before=load('spring-held-before.json'),proof=load('spring-held-verification.json');
 let draws=0;
 for(const [form,original]of Object.entries(before)){
  const source=SPECIES_HELD_HURT_SOURCES.spring[form];assert.deepEqual(source,{...original,sourceFacing:'left'});
  assert.equal(sha(source.image),proof.sources[form].sha256);
  const agent={tribe:'spring',attributes:form==='base'?{}:{[form]:1},health:10,hurtStartedAt:0};
  const image={image:source.image,complete:true,width:source.frameWidth*source.columns,height:source.frameHeight*Math.ceil(2*source.times.length/source.columns)};
  for(let frame=0;frame<source.times.length;frame++)for(const facing of [-1,1])for(const hitSide of [-1,1]){
   const calls=[],scales=[],ctx={save(){},restore(){},translate(){},scale:(...x)=>scales.push(x),drawImage:(...x)=>calls.push(x)};
   const time=source.times[frame]+.000001;
   assert.equal(drawSpeciesHeldHurt(ctx,agent,time,()=>image,{cell:100,mirror:facing===-1,hitSide}),true);
   const sx=facing===-1?1:-1,index=frame+(hitSide*sx>0?source.times.length:0);
   assert.deepEqual(scales,[[sx,1]]);
   assert.deepEqual(calls[0].slice(1,5),[index%source.columns*source.frameWidth,Math.floor(index/source.columns)*source.frameHeight,source.frameWidth,source.frameHeight]);
   draws++;
  }
 }
 assert.equal(draws,168);
});
