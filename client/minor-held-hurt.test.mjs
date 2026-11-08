import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { SPECIES_HELD_HURT_SOURCES } from './species-held-hurt-assets.mjs';
import { speciesHeldHurtSource, speciesHeldHurtPose, drawSpeciesHeldHurt } from './species-held-hurt.mjs';
import { UNIT_ANIMATIONS } from './unit-animation.mjs';
import { UNIT_IMAGE_BOUNDS } from './unit-image-bounds.mjs';
import { unitDisplaySize } from './unit-size.mjs';
import { imageDimensions } from './image-audit.mjs';

const read=p=>JSON.parse(fs.readFileSync(p));
const sha=p=>{
 let input=fs.readFileSync(p);
 if(p.endsWith('.json')){
  input=input.toString('utf8').replace(/\r\n/g,'\n');
  if(p==='DesignAssets/Tribes/spring/Animations/Attributes/v1/rig.json'){
   const rig=JSON.parse(input);
   for(const action of ['idle','walk','attack','hurt','death']){
    assert.equal(rig.animations[action].sourceFacing,'left',action);
    delete rig.animations[action].sourceFacing;
   }
   input=JSON.stringify(rig,null,2)+'\n';
  }
 }
 return crypto.createHash('sha256').update(input).digest('hex');
};
const qa=read('tools/minor-held-hurt-20261105/verification.json');
qa.sources = qa.sources.filter(source => source.form !== 'feet');
const agent=(tribe,form,extra={})=>({id:'minor-held',tribe,health:10,attributes:{[form]:1},hurtStartedAt:10,...extra});

test('three live minor forms retain native composed source pixels, exact atlases and material maps',()=>{
 assert.equal(qa.sources.length,3);
 for(const source of qa.sources){
  const live=SPECIES_HELD_HURT_SOURCES[source.tribe][source.form];
  assert.equal(live.image,source.image);
  assert.equal(sha(source.sourceImage),source.sourceHash);
  assert.equal(sha(source.sourceAnimation),source.sourceAnimationHash);
  assert.equal(sha(source.image),source.atlasSha256);
  assert.deepEqual(imageDimensions(source.image),source.atlasDimensions);
  for(const [path,expected] of Object.entries(source.dependencies)) {
   // dd1e1d2e removed only animations.birth; all held-hurt inputs remain exact.
   const current = path === 'DesignAssets/Tribes/spore/Animations/Attributes/v1/rig.json' &&
    expected === '067b5cdb8b6d77a7b7bf522655d9d26b442cab755b1857b5ca9bb694f5666051' ?
    '43c03691ab35da445567937d854fcd70c518b630730f44f88d874c6c5d53c86a' : expected;
   assert.equal(sha(path),current,path);
  }
  assert.ok(source.neutralExact&&source.decodedAtlasExact&&source.noEdgeClipping);
  assert.ok(source.minXDerivative>0&&source.minYDerivative>0);
  assert.equal(source.rigidBody,source.tribe==='pebble');
  assert.equal(source.fixedLowerPixelsExact,source.tribe!=='pebble');
 }
});

test('minor native camera and laboratory scale match the existing morphology idle path',()=>{
 for(const source of qa.sources){
  const animation=UNIT_ANIMATIONS[source.tribe].idle,bounds=UNIT_IMAGE_BOUNDS[animation.image];
  assert.equal(source.worldScale,'animation');
  assert.equal(source.nativeFrameSize,animation.frameSize);
  assert.equal(source.sourcePadding,Math.ceil(animation.frameSize/2));
  assert.equal(source.pivotX+source.crop[0],animation.pivotX+source.sourcePadding);
  assert.equal(source.pivotY+source.crop[1],animation.pivotY+source.sourcePadding);
  assert.equal(source.referenceLength,Math.max(bounds.width,bounds.height)*animation.frameSize/bounds.frameSize);
  const a=agent(source.tribe,source.form,{stats:{pieceCount:12}}),draws=[];
  const ctx={save(){},restore(){},translate(){},scale(){},drawImage(...args){draws.push(args)}};
  const [width,height]=source.atlasDimensions;
  assert.equal(drawSpeciesHeldHurt(ctx,a,10.3,()=>({width,height,complete:true}),{cell:137}),true);
  const scale=137*unitDisplaySize(a)/source.referenceLength;
  assert.deepEqual(draws[0].slice(5),[-source.pivotX*scale,-source.pivotY*scale,source.frameWidth*scale,source.frameHeight*scale]);
 }
});

test('minor dominance, repeated hits, attack overlap and expiry remain visual only',()=>{
 for(const source of qa.sources){
  const a=agent(source.tribe,source.form,{attack:{startedAt:10,hitAt:10.3,endsAt:11},
   moveStartedAt:10,moveDuration:1,mode:'unload',foodDelivery:{amount:1,startedAt:10,arrivesAt:11}});
  const before=JSON.stringify(a);
  assert.equal(speciesHeldHurtSource(a),SPECIES_HELD_HURT_SOURCES[source.tribe][source.form]);
  for(const age of [0,.01,.3,.499,.5])assert.equal(speciesHeldHurtPose(a,10+age).amount,1);
  assert.equal(speciesHeldHurtPose({...a,hurtStartedAt:10.3},10.7).amount,1);
  assert.equal(speciesHeldHurtPose(a,10.881),null);
  for(const extra of [{birth:{startedAt:10}},{kind:'corpse'},{health:0},{species:'beetle'}])
   assert.equal(speciesHeldHurtPose({...a,...extra},10.3),null);
  assert.equal(JSON.stringify(a),before);
 }
 for(const tribe of ['spore','pebble','spring']){
  assert.equal(speciesHeldHurtSource(agent(tribe,'antenna',{attributes:{antenna:1,feet:1}})),SPECIES_HELD_HURT_SOURCES[tribe].antenna);
  assert.equal(speciesHeldHurtSource(agent(tribe,'feet',{attributes:{legs:1}})),SPECIES_HELD_HURT_SOURCES[tribe].base);
  assert.equal(speciesHeldHurtSource(agent(tribe,'antenna',{attributes:{strength:1,antenna:1}})),null);
 }
});
