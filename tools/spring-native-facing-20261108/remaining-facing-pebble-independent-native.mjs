// Real @napi-rs/canvas and production module imports. One form per process,
// one route per cache, explicit GC. No browser result is claimed.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {UNIT_ACTION_ART as A} from '../../client/unit-action-art-assets.mjs';
import {UNIT_BIRTH_ART as B} from '../../client/unit-birth-art-assets.mjs';
import {SPECIES_HELD_HURT_SOURCES as H} from '../../client/species-held-hurt-assets.mjs';
import {createUnitActionArt,unitActionArtPose,unitActionArtSelection} from '../../client/unit-action-art.mjs';
import {drawSpeciesHeldHurt} from '../../client/species-held-hurt.mjs';
import {unitDisplaySize,unitFrameMirror} from '../../client/unit-size.mjs';
import {UNIT_COMBINATION_FORMS} from '../../client/unit-combination-forms.mjs';
import {createPackedBirthAdapter} from '../../client/pebble-packed-birth.mjs';
import {PEBBLE_PACKED_BIRTH_CATALOG as P} from '../../client/pebble-packed-birth-catalog.mjs';
import {ATTRIBUTE_DNA} from '../../server/dna.mjs';
const {createCanvas,loadImage}=createRequire('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/package.json')('@napi-rs/canvas');
const root=new URL('../../',import.meta.url),key=process.argv[2],form=key?.split('/')[1];
assert.ok(A[key]&&key.startsWith('pebble/'),'Pass a selected Pebble key');
const result={key,engine:'actual native Node @napi-rs/canvas; not browser or mock',routes:0,actionDraws:0,birthIdleHandoffs:0,heldDraws:0,layerFallbackDraws:0,packedNativeDraws:0,packedFallbackDraws:0,referenceChecks:0,portraitChecks:0,routeCoverage:[],sourcePaths:[]};
const seen=new Set();
const pixels=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} != ${b}`);
const actor=()=>({tribe:'pebble',attributes:UNIT_COMBINATION_FORMS.find(f=>f.key===form)?.attributes||(form==='base'?{}:form==='gather'?{strength:1}:{[form]:1}),health:10,bornAt:0});
function state(action,clip){const a=actor(),duration=clip.durationsMs.reduce((s,n)=>s+n,0)/1000;
 if(action==='death')Object.assign(a,{health:0,deathStartedAt:0});
 else if(action==='birth')a.birth={startedAt:0,readyAt:duration};
 else if(action==='hurt')a.hurtStartedAt=0;
 else if(['attack','ranged'].includes(action))a.attack={startedAt:0,endsAt:duration,mode:action==='ranged'?'ranged':'melee'};
 else if(['walk','carry'].includes(action))Object.assign(a,{moveStartedAt:0,moveDuration:duration+1,carrying:action==='carry'?1:0});
 else if(action==='harvest')Object.assign(a,{mode:'harvest',harvestStarted:0});
 else if(action==='throw')Object.assign(a,{mode:'unload',foodDelivery:{startedAt:0}});
 return a;
}
function recorder(){const canvas=createCanvas(768,768),native=canvas.getContext('2d'),calls=[];const context=new Proxy(native,{get(t,k){if(k==='drawImage')return(...args)=>{calls.push({args,sign:Math.sign(t.getTransform().a)});return t.drawImage(...args);};const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v;},set(t,k,v){Reflect.set(t,k,v,t);return true;}});return{canvas,native,context,calls};}
function reset(r){r.native.resetTransform();r.native.clearRect(0,0,768,768);r.calls.length=0;}
function bounds(image,clip){const w=clip.frameSize,h=clip.frameHeight||w,f=clip.frames?.[0]||0,c=createCanvas(w,h),ctx=c.getContext('2d');ctx.drawImage(image,f%clip.columns*w,Math.floor(f/clip.columns)*h,w,h,0,0,w,h);const data=ctx.getImageData(0,0,w,h).data;let l=w,t=h,r=0,b=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>=16){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x+1);b=Math.max(b,y+1);}return{width:Math.max(1,r-l),height:Math.max(1,b-t),length:Math.max(1,r-l,b-t)};}
function assertCalls(record,expected,target,paths,label){assert.equal(record.calls.length,expected.length,label+' draw ownership');for(const[e,i]of expected.map((v,i)=>[v,i])){const call=record.calls[i];assert.equal(paths.get(call.args[0]),e.path,label+' source path');assert.equal(call.sign,target===-1?1:-1,label+' native left target sign');const numbers=[...e.crop,...e.dest];assert.equal(call.args.length,9);numbers.forEach((n,j)=>near(call.args[j+1],n,label+' draw argument '+j));}}
function expectedParts(clip,frame,reference,agent,layered){const width=clip.frameSize,height=clip.frameHeight||width,scale=128*unitDisplaySize(agent)/(clip.referenceLength||reference.length)*(clip.referenceLength?1:(A[key].reference.viewSize||A[key].reference.frameSize)/(clip.viewSize||width));
 if(layered)return clip.sceneLayers.layers.filter(l=>l.samples[frame]).map(layer=>{const sample=layer.samples[frame],[x,y,w,h]=sample.destination;return{path:layer.image,crop:[sample.frame%layer.columns*layer.frameSize,Math.floor(sample.frame/layer.columns)*layer.frameHeight,layer.frameSize,layer.frameHeight],dest:[(x-clip.pivotX)*scale,(y-clip.pivotY)*scale,w*scale,h*scale]};});
 return[{path:clip.image,crop:[frame%clip.columns*width,Math.floor(frame/clip.columns)*height,width,height],dest:[-clip.pivotX*scale,-clip.pivotY*scale,width*scale,height*scale]}];
}
function assertRaster(record,parts,target,images,expectedCanvas,label,smoothing=true){const ctx=expectedCanvas.getContext('2d');ctx.resetTransform();ctx.clearRect(0,0,768,768);ctx.save();if(smoothing){ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';}ctx.translate(384,640);ctx.scale(target===-1?1:-1,1);for(const part of parts)ctx.drawImage(images.get(part.path),...part.crop,...part.dest);ctx.restore();assert.deepEqual(pixels(record.canvas),pixels(expectedCanvas),label+' actual native raster equals independent sampler');}
async function verifyRoute(action,clip,fallback=false){let images=new Map(),paths=new WeakMap(),loads=[];const art=createUnitActionArt(p=>p,createCanvas,async p=>{loads.push(p);if(fallback&&clip.sceneLayers?.layers.some(l=>l.image===p))throw Error('Intentional failed-layer branch');const image=await loadImage(new URL(p,root));images.set(p,image);paths.set(image,p);seen.add(p);return image;});const agent=state(action,clip);await art.prepare(agent,clip.durationsMs[0]/2000);
 let reference=clip.referenceLength?{length:clip.referenceLength}:bounds(images.get(A[key].reference.image),A[key].reference);
 if(images.has(A[key].reference.image)){assert.deepEqual(art.referenceBounds(A[key].reference),bounds(images.get(A[key].reference.image),A[key].reference));assert.equal(art.ready(agent),true);result.referenceChecks++;}
 const out=recorder(),expected=createCanvas(768,768);let elapsed=0,nonempty=0;
 for(let i=0;i<clip.durationsMs.length;i++){const time=(elapsed+clip.durationsMs[i]/2)/1000,pose=unitActionArtPose(agent,time),frame=clip.frames?.[i]??i;assert.equal(pose.action,action,key+' '+action);assert.equal(pose.animation.image,clip.image);assert.equal(pose.frame,frame,key+' exact temporal source frame');assert.equal(art.readyAction(agent,time),true);
  for(const target of [-1,1]){reset(out);assert.equal(art.draw(out.context,agent,time,384,640,128,target===-1),true);const parts=expectedParts(clip,frame,reference,agent,!!clip.sceneLayers&&!fallback);assertCalls(out,parts,target,paths,key+'/'+action+'/'+i);assertRaster(out,parts,target,images,expected,key+'/'+action+'/'+i);nonempty+=pixels(out.canvas).some(v=>v!==0);result[fallback?'layerFallbackDraws':'actionDraws']++;}
  elapsed+=clip.durationsMs[i];if(i%8===7)global.gc?.();
 }
 assert.ok(nonempty,key+'/'+action+' should render some visible pixels');
 if(!fallback){result.routes++;result.routeCoverage.push({action,image:clip.image,frames:clip.durationsMs.length,draws:clip.durationsMs.length*2,layered:!!clip.sceneLayers});}
 if(action==='birth'&&!fallback){const time=agent.birth.readyAt+1e-6;await art.prepare(agent,time);const pose=unitActionArtPose(agent,time);assert.equal(pose.action,'idle');assert.equal(pose.animation.sourceFacing,'left',key+' birth-to-idle native source-facing consistent');reference=bounds(images.get(A[key].reference.image),A[key].reference);for(const target of[-1,1]){reset(out);assert.equal(art.draw(out.context,agent,time,384,640,128,target===-1),true);const parts=expectedParts(pose.animation,pose.frame,reference,agent,false);assertCalls(out,parts,target,paths,key+' birth-to-idle endpoint');assertRaster(out,parts,target,images,expected,key+' birth-to-idle endpoint');result.birthIdleHandoffs++;}}
 if(clip.sceneLayers){if(fallback)assert.ok(loads.includes(clip.image));else assert.ok(!loads.includes(clip.image),'native layer route must not load baked fallback');}
 images.clear();images=null;paths=null;
}
const selected=key==='pebble/carapace-antenna'?{birth:A[key].actions.birth}:{...A[key].actions,...(B[key]?{birth:B[key]}:{})};
if(key!=='pebble/carapace-antenna'&&UNIT_COMBINATION_FORMS.some(f=>f.key===form)){const attack=selected.attack||selected.ranged||selected.walk;selected.harvest={...attack,loop:true};selected.throw={...attack,loop:false,releaseAtMs:attack.hitTimeMs??attack.launchAtMs??300};}
for(const[action,clip]of Object.entries(selected)){if(action==='jump')continue;await verifyRoute(action,clip);global.gc?.();if(clip.sceneLayers){await verifyRoute(action,clip,true);global.gc?.();}}
if(['base','antenna'].includes(form)){const source=H.pebble[form],image=await loadImage(new URL(source.image,root));seen.add(source.image);const paths=new WeakMap([[image,source.image]]),images=new Map([[source.image,image]]),out=recorder(),expected=createCanvas(768,768),agent={...actor(),hurtStartedAt:0};
 for(let i=0;i<source.times.length;i++)for(const target of[-1,1])for(const hitSide of[-1,1]){reset(out);assert.equal(drawSpeciesHeldHurt(out.context,agent,source.times[i]+1e-7,()=>image,{cell:128,x:384,y:640,mirror:target===-1,hitSide}),true);const flip=target===-1?1:-1,index=i+(hitSide*flip>0?14:0),scale=128*unitDisplaySize(agent)/source.referenceLength;const parts=[{path:source.image,crop:[index%source.columns*source.frameWidth,Math.floor(index/source.columns)*source.frameHeight,source.frameWidth,source.frameHeight],dest:[-source.pivotX*scale,-source.pivotY*scale,source.frameWidth*scale,source.frameHeight*scale]}];assertCalls(out,parts,target,paths,'held/'+form+'/'+i);assertRaster(out,parts,target,images,expected,'held/'+form+'/'+i,false);result.heldDraws++;}
}
if(A[key].portrait&&key!=='pebble/carapace-antenna'){const path=A[key].portrait,image=await loadImage(new URL(path,root)),c=createCanvas(image.width,image.height);c.getContext('2d').drawImage(image,0,0);assert.ok(pixels(c).some(v=>v!==0));seen.add(path);result.portraitChecks++;}

if(form==='gather'){
 const gene='gather',agent={id:'native-gather',tribe:'pebble',health:10,attributes:{strength:1},dna:{version:5,level:4,budget:999999,pieces:ATTRIBUTE_DNA.pack([{gene,grade:ATTRIBUTE_DNA.lookup.get(gene).grade,rotation:0}],4)},birth:{startedAt:0,readyAt:B[key].durationsMs.reduce((s,n)=>s+n,0)/1000}};
 assert.equal(unitActionArtSelection(agent,A).key,key);
 // Real imported production adapter selects the original high-resolution layer.
 const loaded=[];const adapter=createPackedBirthAdapter({catalog:P,createCanvas,loadImage:async p=>{loaded.push(p);seen.add(p);return loadImage(new URL(p,root));}});const handle=await adapter.prepare(agent);assert.ok(handle);assert.ok(handle.metadata.nativeBody);assert.deepEqual(loaded,[B[key].sceneLayers.layers[0].image]);
 const out=recorder(),expected=createCanvas(768,768),layer=handle.metadata.nativeBody,images=new Map([[layer.image,handle.image]]),paths=new WeakMap([[handle.image,layer.image]]);let elapsed=0;
 for(let i=0;i<B[key].durationsMs.length;i++){const time=(elapsed+B[key].durationsMs[i]/2)/1000;for(const target of[-1,1]){reset(out);assert.equal(adapter.draw(out.context,handle,agent,time,384,640,128,target===-1),true);const parts=expectedParts(B[key],i,{length:B[key].referenceLength},agent,true);assertCalls(out,parts,target,paths,'native packed adapter '+i);assertRaster(out,parts,target,images,expected,'native packed adapter '+i,false);result.packedNativeDraws++;}elapsed+=B[key].durationsMs[i];}
 assert.equal(adapter.stats.copies,0);assert.equal(adapter.stats.scratchAllocations,0);
 // The production adapter deliberately chooses a native layer when one exists.
 // Exercise its legacy packed fallback code with only the birth catalog binding
 // injected, real catalog/pixels/Canvas, and the actual production pose clock.
 // This is explicitly a native fixture of the legacy branch, not a live route.
 const source=readFileSync(new URL('../../client/pebble-packed-birth.mjs',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replace('export function createPackedBirthAdapter','function createPackedBirthAdapter')+'\nglobalThis.factory=createPackedBirthAdapter;';
 const {sceneLayers,...legacy}=B[key];const sandbox={structuredClone,setTimeout,clearTimeout,UNIT_BIRTH_ART:{[key]:legacy},UNIT_ACTION_ART:A,ATTRIBUTE_DNA,unitActionArtSelection,unitDisplaySize,unitFrameMirror,unitActionArtPose:(a,t)=>{const pose=unitActionArtPose(a,t);return{...pose,animation:legacy};}};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 const packedImage=await loadImage(new URL(P.gather.path,root));seen.add(P.gather.path);const fallback=sandbox.factory({catalog:P,createCanvas,loadImage:()=>packedImage});const packedHandle=await fallback.prepare(agent);assert.ok(packedHandle);assert.equal(packedHandle.metadata.nativeBody,undefined);elapsed=0;
 const scratchExpected=createCanvas(512,620),expectedOutput=createCanvas(768,768);
 for(let i=0;i<legacy.durationsMs.length;i++){const time=(elapsed+legacy.durationsMs[i]/2)/1000,f=P.gather.frames[i],[x1,y1,x2,y2]=f.bounds,[px,py]=f.packed,sctx=scratchExpected.getContext('2d');sctx.clearRect(0,0,512,620);sctx.drawImage(packedImage,px,py,x2-x1,y2-y1,x1,y1,x2-x1,y2-y1);
  for(const target of[-1,1]){reset(out);assert.equal(fallback.draw(out.context,packedHandle,agent,time,384,640,128,target===-1),true);assert.equal(out.calls.length,1);assert.equal(out.calls[0].sign,target===-1?1:-1);const scale=128*unitDisplaySize(agent)/legacy.referenceLength,ctx=expectedOutput.getContext('2d');ctx.resetTransform();ctx.clearRect(0,0,768,768);ctx.save();ctx.translate(384,640);ctx.scale(target===-1?1:-1,1);ctx.drawImage(scratchExpected,0,0,legacy.frameSize,legacy.frameHeight,-legacy.pivotX*scale,-legacy.pivotY*scale,legacy.frameSize*scale,legacy.frameHeight*scale);ctx.restore();assert.deepEqual(pixels(out.canvas),pixels(expectedOutput),'legacy packed sampler '+i);result.packedFallbackDraws++;}elapsed+=legacy.durationsMs[i];
 }
 assert.equal(fallback.stats.copies,66);assert.equal(fallback.stats.scratchAllocations,1);result.packedFallbackScope='native Canvas fixture of legacy branch with injected catalog binding; current production uses high-resolution native body';
}
result.sourcePaths=[...seen].sort();
writeFileSync(new URL('remaining-facing-pebble-independent-native-'+form+'.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
