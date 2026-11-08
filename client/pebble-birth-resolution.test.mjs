import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {ATTRIBUTE_DNA} from '../server/dna.mjs';
import {UNIT_ACTION_ART} from './unit-action-art-assets.mjs';
import {unitActionArtSelection} from './unit-action-art.mjs';
import {unitDisplaySize,unitFrameMirror} from './unit-size.mjs';
import {PEBBLE_PACKED_BIRTH_CATALOG} from './pebble-packed-birth-catalog.mjs';
import {createPebbleBirthRuntime} from './pebble-birth-runtime.mjs';
const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
const forms=['gather','blade','carapace','secretion'];
const source=fs.readFileSync(new URL('./pebble-packed-birth.mjs',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replace('export function createPackedBirthAdapter','function createPackedBirthAdapter')+'\nglobalThis.factory=createPackedBirthAdapter;';
const actor=(form,id=form)=>({id,tribe:'pebble',health:1,attributes:{[form]:1},dna:{version:5,level:4,budget:999999,pieces:ATTRIBUTE_DNA.pack([{gene:form,grade:ATTRIBUTE_DNA.lookup.get(form).grade,rotation:0}],4)},birth:{startedAt:0,readyAt:2.62,colonyId:1}});
function fixture({native=true,mutate,loadImage,timeout=100}={}){
 const catalog=structuredClone(PEBBLE_PACKED_BIRTH_CATALOG),birth={},images=new Map(),requested=[],allocated=[];
 for(const form of forms){const a=structuredClone(catalog[form].animation);birth['pebble/'+form]=a;
  if(native){const n={role:'body',wholeBody:true,image:'native/'+form+'.png',frameSize:128,frameHeight:96,columns:4,frameCount:4,samples:catalog[form].frames.map((f,i)=>({frame:i%4,destination:[f.bounds[0],f.bounds[1],f.bounds[2]-f.bounds[0],f.bounds[3]-f.bounds[1]]}))};a.sceneLayers={version:2,layers:[n]};const image=createCanvas(512,96),c=image.getContext('2d');for(let i=0;i<512;i++){c.fillStyle=i%2?'#fa134b':'#19e7dc';c.fillRect(i,0,1,96);}c.clearRect(0,0,10,10);images.set(n.image,image);}
  else {const image=createCanvas(...catalog[form].atlasSize);image.getContext('2d').fillRect(0,0,image.width,image.height);images.set(catalog[form].path,image);}
 }
 mutate?.(birth,catalog);
 const pose=(agent,time)=>{const key=unitActionArtSelection(agent,UNIT_ACTION_ART)?.key,a=birth[key];if(!a)return null;let elapsed=(time-agent.birth.startedAt)*1000,i=0;while(i<a.frameCount-1&&elapsed+1e-7>=a.durationsMs[i])elapsed-=a.durationsMs[i++];return{action:'birth',animation:a,frame:i};};
 const context={structuredClone,setTimeout,clearTimeout,UNIT_BIRTH_ART:birth,UNIT_ACTION_ART,ATTRIBUTE_DNA,unitActionArtSelection,unitActionArtPose:pose,unitDisplaySize,unitFrameMirror};vm.createContext(context);vm.runInContext(source,context);
 const adapter=context.factory({catalog,loadImage:path=>{requested.push(path);return loadImage?loadImage(path,images):images.get(path);},createCanvas:(w,h)=>{allocated.push([w,h]);return createCanvas(w,h);},preparationTimeoutMs:timeout});
 return {adapter,birth,catalog,images,requested,allocated,pose};
}
function frameTimes(animation){let sum=0;return animation.durationsMs.map(ms=>{const t=sum/1000;sum+=ms;return t;});}
function pixels(c){return Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);}

test('native pebble adapter draws all 272 samples in both facings directly, without a scene scratch or packed image',async()=>{
 const f=fixture();await f.adapter.prepareVerifiedRoomBirthCatalog();assert.deepEqual(f.requested,forms.map(form=>'native/'+form+'.png'));
 const actual=createCanvas(320,320),expected=createCanvas(320,320);for(const form of forms){const a=f.birth['pebble/'+form],layer=a.sceneLayers.layers[0],agent=actor(form),handle=f.adapter.readyHandle(agent);assert.ok(handle);assert.equal(f.adapter.ownsHandleFor(agent,handle),true);
  for(const [i,time]of frameTimes(a).entries())for(const mirror of [false,true]){
   const ctx=actual.getContext('2d'),ec=expected.getContext('2d'),sample=layer.samples[i],scale=420*unitDisplaySize(agent)/a.referenceLength,[dx,dy,dw,dh]=sample.destination;let outlineCalls=0;
   ctx.resetTransform();ctx.clearRect(0,0,320,320);ec.resetTransform();ec.clearRect(0,0,320,320);const x=160,floor=280,flip=unitFrameMirror(a.sourceFacing,mirror?-1:1)?-1:1;
   assert.equal(f.adapter.draw(ctx,handle,agent,time,x,floor,420,mirror,(target,image,crop,destination)=>{outlineCalls++;assert.equal(image,handle.image);assert.equal(crop.width,128);assert.equal(crop.height,96);assert.equal(crop.index,sample.frame);assert.equal(crop.x,sample.frame*128);assert.equal(destination.x,(dx-a.pivotX)*scale);assert.equal(destination.y,(dy-a.pivotY)*scale);assert.equal(target.getTransform().a,flip);assert.equal(f.adapter.draw(target,handle,agent,time,x,floor,420,mirror),false);}),true);
   ec.translate(x,floor);ec.scale(flip,1);ec.drawImage(handle.image,sample.frame*128,0,128,96,(dx-a.pivotX)*scale,(dy-a.pivotY)*scale,dw*scale,dh*scale);
   assert.deepEqual(pixels(actual),pixels(expected),form+' frame '+i+' mirror '+mirror);assert.equal(outlineCalls,1);assert.equal(ctx.getTransform().a,1);assert.equal(ctx.getTransform().e,0);
  }
 }
 assert.equal(f.adapter.stats.draws,544);assert.equal(f.adapter.stats.copies,0);assert.equal(f.adapter.stats.scratchAllocations,0);assert.deepEqual(f.allocated,[]);assert.equal(f.adapter.stats.loads,4);
});

test('legacy registered clips still use the existing packed path and one reusable scratch',async()=>{
 const f=fixture({native:false});const agent=actor('gather'),h=await f.adapter.prepare(agent),c=createCanvas(200,200);assert.ok(h);assert.equal(f.adapter.draw(c.getContext('2d'),h,agent,.4,100,100,100,false),true);assert.deepEqual(f.requested,[f.catalog.gather.path]);assert.deepEqual(f.allocated,[[512,620]]);assert.equal(f.adapter.stats.copies,1);
});

test('malformed native metadata or any changed legacy registration fails closed, never loading old packed art',async()=>{
 const bad=[a=>a.pivotX++,a=>a.durationsMs[0]++,a=>a.sceneLayers.version=1,a=>a.sceneLayers.layers[0].wholeBody=false,a=>a.sceneLayers.layers[0].samples.pop(),a=>a.sceneLayers.layers[0].samples[0].frame=4,a=>a.sceneLayers.layers[0].samples[0].destination[2]=0,a=>a.sceneLayers.layers[0].samples[0].destination[0]=NaN,a=>a.sceneLayers.layers[0].image='',a=>a.sceneLayers.layers[0].frameSize=.5];
 for(const alter of bad){const f=fixture({mutate:birth=>alter(birth['pebble/gather'])});assert.equal(await f.adapter.prepare(actor('gather')),null);assert.deepEqual(f.requested,[]);assert.deepEqual(f.allocated,[]);}
});

test('native preparation rejects bad decoded dimensions and can retry, without silently swapping to packed',async()=>{
 let good=false;const f=fixture({loadImage:(path,images)=>good?images.get(path):createCanvas(3,3)}),a=actor('blade');assert.equal(await f.adapter.prepare(a),null);good=true;assert.ok(await f.adapter.prepare(a));assert.deepEqual(f.requested,['native/blade.png','native/blade.png']);assert.equal(f.adapter.stats.loads,2);
});

test('native source handle snapshots and context restoration survive outline failures and reentrant calls',async()=>{
 const f=fixture(),a=actor('gather'),h=await f.adapter.prepare(a),ctx=createCanvas(100,100).getContext('2d');ctx.translate(7,9);assert.throws(()=>f.adapter.draw(ctx,h,a,.1,50,80,144,false,()=>{throw Error('outline failed');}),/outline failed/);assert.equal(ctx.getTransform().e,7);assert.equal(ctx.getTransform().f,9);assert.equal(f.adapter.draw(ctx,h,a,.1,50,80,144,false),true);f.catalog.gather.path='mutated';assert.equal(h.metadata.path,PEBBLE_PACKED_BIRTH_CATALOG.gather.path);assert.equal(Object.isFrozen(h.metadata.nativeBody.samples[0].destination),true);
});

test('timeout pins original first choice on world/avatar; late readiness only helps new births',async()=>{
 let resolve;const deferred=new Promise(r=>resolve=r);const f=fixture({timeout:5,loadImage:(path,images)=>path==='native/gather.png'?deferred:images.get(path)}),runtime=createPebbleBirthRuntime({adapter:f.adapter,createCanvas});await runtime.enter({roomId:'native-test',world:{seed:1,size:320},revision:1,state:{simSeconds:0}});const ctx=createCanvas(200,200).getContext('2d'),a=actor('gather','old');for(const surface of ['world','avatar'])assert.equal(runtime.draw(ctx,a,.1,100,180,144,false,{surface}).source,'original');resolve(f.images.get('native/gather.png'));await new Promise(r=>setTimeout(r,0));
 for(const surface of ['world','avatar'])assert.equal(runtime.draw(ctx,a,.2,100,180,144,false,{surface}).source,'original');const b=actor('gather','new');for(const surface of ['world','avatar'])assert.equal(runtime.draw(ctx,b,.2,100,180,144,false,{surface}).source,'restored');assert.equal(f.requested.filter(x=>x==='native/gather.png').length,1);assert.equal(f.adapter.stats.scratchAllocations,0);runtime.leave();
});

test('native world-occlusion route and independent avatar keep restored failures handled without source swap',async()=>{
 const f=fixture(),runtime=createPebbleBirthRuntime({adapter:f.adapter,createCanvas}),ctx=createCanvas(200,200).getContext('2d'),a=actor('gather');await runtime.enter({roomId:'native-mask',world:{seed:1,size:320},revision:1,state:{simSeconds:0}});const nest=createCanvas(512,512);nest.getContext('2d').fillRect(0,0,512,512);runtime.recordNative({id:1},{sprite:nest,frame:null,x:0,y:0,width:200,height:200,kind:'static',level:1,transform:ctx.getTransform(),alpha:1});
 assert.equal(runtime.draw(ctx,a,.1,100,180,144,false,{surface:'world'}).drawn,true);assert.equal(runtime.bridge.stats.masked,1);assert.equal(f.adapter.stats.scratchAllocations,0);assert.equal(f.adapter.stats.copies,0);
 f.birth['pebble/gather'].pivotX++;for(const surface of ['world','avatar']){const result=runtime.draw(ctx,a,.2,100,180,144,false,{surface});assert.equal(result.handled,true);assert.equal(result.source,'restored');assert.equal(result.drawn,false);}assert.equal(runtime.stats.restoredFailures,2);runtime.leave();
});
