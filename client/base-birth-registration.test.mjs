import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {UNIT_ACTION_ART} from './unit-action-art-assets.mjs';
import {createUnitActionArt,unitActionArtPose} from './unit-action-art.mjs';
import {unitDisplaySize,unitFrameMirror} from './unit-size.mjs';
const facingChanges=JSON.parse(readFileSync('tools/spring-native-facing-20261108/bean-spore-image-changes.json')).changes;
const pebbleFacingChanges=JSON.parse(readFileSync('tools/spring-native-facing-20261108/remaining-facing-pebble-image-changes.json')).changes;
const pebbleFacingBefore=JSON.parse(readFileSync('tools/spring-native-facing-20261108/remaining-facing-runtime-baseline.json'));
const facingBefore=JSON.parse(readFileSync('tools/spring-native-facing-20261108/bean-spore-plan-registry.json'));
const baselineCommit='958b999dc5109cb4827f2013916840c22c7adf07';
const expected={spore:[79,134.5,162,22,3120,'93696aac1e9eb471a1aae0ba8932eec01e369d0d64d064218a01b4b1c2ce9761'],pebble:[93,75.5,136,48,2620,'d8b762b189ea9767c2026dbfb692750a21b761bdd2514a5626e77f156cb76129'],spring:[105,150,207,13,1790,'01d1eafb5d7d0886dceabbfd8b249d5aae06512e4e507e732ef51e637e3deb00']};
for(const [tribe,[length,previousX,y,count,ms,hash]] of Object.entries(expected)){
 const x=tribe==='spore'?192-previousX:previousX;
 const def=UNIT_ACTION_ART[tribe+'/base'],a=def.actions.birth;
 test(tribe+' base birth keeps body-only source and authored timing',()=>{
  assert.deepEqual([a.referenceLength,a.pivotX,a.pivotY,a.frameCount,a.durationsMs.reduce((x,y)=>x+y,0)],[length,x,y,count,ms]);
  assert.equal(a.scene,undefined);assert.equal(a.sceneLayers,undefined);
  const change=tribe==='spore'?facingChanges[a.image]:tribe==='pebble'?pebbleFacingChanges[a.image]:null;
  if(change){
   const before=(tribe==='spore'?facingBefore:pebbleFacingBefore).UNIT_ACTION_ART[tribe+'/base'].actions.birth;
   assert.equal(change.beforeSha256,hash);if(tribe==='spore')assert.equal(change.operation,'mirror-each-cell');else assert.equal(change.verification.decodedRgbaExact,true);
   assert.equal(change.frameWidth,before.frameSize);assert.equal(change.frameHeight,before.frameHeight);
   assert.deepEqual(a,{...before,pivotX:before.frameSize-before.pivotX,sourceFacing:'left'});
  }
  assert.equal(createHash('sha256').update(readFileSync(a.image)).digest('hex'),change?.afterSha256||hash);
  const agent={tribe,dna:{version:6,pieces:[]},health:10,birth:{startedAt:4,readyAt:4+ms/1000}};
  let elapsed=0;for(let frame=0;frame<count;frame++){
   const pose=unitActionArtPose(agent,4+elapsed/1000+.000001);assert.equal(pose.action,'birth');assert.equal(pose.animation,a);assert.equal(pose.frame,frame);elapsed+=a.durationsMs[frame];
  }
  assert.equal(unitActionArtPose(agent,4+ms/1000+.000001).action,'idle');
 });
 test(tribe+' endpoint has uniform scale, centered horizontal bounds and grounded feet',()=>{
  const [b,i]=JSON.parse(execFileSync('python3',['-c',`import json,sys
from PIL import Image
out=[]
for a,f in json.load(sys.stdin):
 with Image.open(a['image']) as im:
  w=a['frameSize'];h=a.get('frameHeight',w);c=a['columns'];out.append(im.crop((f%c*w,f//c*h,(f%c+1)*w,(f//c+1)*h)).getchannel('A').point(lambda v:255 if v>=16 else 0).getbbox())
print(json.dumps(out))`],{input:JSON.stringify([[a,count-1],[def.reference,0]]),encoding:'utf8'}));
  assert.equal(Math.max(b[2]-b[0],b[3]-b[1]),length);assert.equal((b[0]+b[2])/2,x);assert.equal(b[3],y);
  const il=Math.max(i[2]-i[0],i[3]-i[1]);for(const axis of [0,1])assert.ok(Math.abs((b[axis+2]-b[axis])/length/((i[axis+2]-i[axis])/il)-1)<.05);
 });
 test(tribe+' runtime draws the corrected body equally in both facings',async()=>{
  const calls=[];const surface=(w,h)=>({getContext:()=>({drawImage(){},getImageData(){const data=new Uint8ClampedArray(w*h*4);data.fill(255);return {data};}})});
  const art=createUnitActionArt(v=>v,surface,async image=>({image}));const agent={tribe,dna:{version:6,pieces:[]},health:10,birth:{startedAt:0,readyAt:ms/1000}};await art.prepare(agent);await new Promise(r=>setImmediate(r));
  for(const mirror of [false,true]){const ctx={save(){},restore(){},translate(){},scale(x,y){assert.equal(x,unitFrameMirror(a.sourceFacing,mirror?-1:1)?-1:1);assert.equal(y,1)},drawImage(...args){calls.push(args)}};assert.equal(art.draw(ctx,agent,ms/1000-.001,0,0,100,mirror),true);}
  assert.equal(calls.length,2);for(const c of calls){const scale=100*unitDisplaySize(agent)/length;assert.equal(c[0].image,a.image);assert.equal(c[5],-x*scale);assert.equal(c[6],-y*scale);assert.equal(c[7],a.frameSize*scale);assert.equal(c[8],a.frameHeight*scale);}
 });
}

test('spore base normalization mirrors every original RGBA cell without changing its frame order',()=>{
 const a=UNIT_ACTION_ART['spore/base'].actions.birth,change=facingChanges[a.image];
 const result=JSON.parse(execFileSync('python3',['-c',`import json,sys,subprocess,hashlib,io
from PIL import Image,ImageOps
import numpy as np
p=json.load(sys.stdin);raw=subprocess.check_output(['git','show',p['commit']+':'+p['image']]);assert hashlib.sha256(raw).hexdigest()==p['hash']
with Image.open(io.BytesIO(raw)) as before,Image.open(p['image']) as after:
 assert before.size==after.size==(768,1152)
 for f in range(24):
  box=(f%4*192,f//4*192,f%4*192+192,f//4*192+192)
  a=np.array(ImageOps.mirror(before.crop(box)).convert('RGBA'));b=np.array(after.crop(box).convert('RGBA'));a[a[:,:,3]==0,:3]=0;b[b[:,:,3]==0,:3]=0
  assert np.array_equal(a,b),('cell',f)
print(json.dumps({'cells':24,'exactVisibleRGBA':True}))`],{input:JSON.stringify({commit:baselineCommit,image:a.image,hash:change.beforeSha256}),encoding:'utf8'}));
 assert.deepEqual(result,{cells:24,exactVisibleRGBA:true});
});
