import {unitActionArtPose,unitActionArtSelection} from './unit-action-art.mjs';
import {UNIT_ACTION_ART} from './unit-action-art-assets.mjs';
import {unitDisplaySize,unitFrameMirror} from './unit-size.mjs';
import {ATTRIBUTE_DNA} from '../server/dna.mjs';
import {UNIT_BIRTH_ART} from './unit-birth-art-assets.mjs';
const deepFreeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))deepFreeze(v);Object.freeze(value);}return value;};
const same=(a,b)=>{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));};
// A native whole-body layer changes only the source sampling density. Its
// destinations retain the existing birth cell, pivot, clock, facing and path.
const withoutSceneLayers=animation=>{const {sceneLayers,...rest}=animation;return rest;};
function nativeBodyLayer(animation){
 const scene=animation.sceneLayers,layer=scene?.layers?.[0];
 if(scene?.version!==2||!Array.isArray(scene.layers)||scene.layers.length!==1||layer?.role!=='body'||layer.wholeBody!==true||typeof layer.image!=='string'||!layer.image||layer.image===animation.image)return null;
 const W=layer.frameSize,H=layer.frameHeight||W,columns=layer.columns,count=layer.frameCount;
 if(![W,H,columns,count].every(v=>Number.isSafeInteger(v)&&v>0)||!Array.isArray(layer.samples)||layer.samples.length!==animation.frameCount)return null;
 if(!layer.samples.every(sample=>sample&&Number.isSafeInteger(sample.frame)&&sample.frame>=0&&sample.frame<count&&Array.isArray(sample.destination)&&sample.destination.length===4&&sample.destination.every(Number.isFinite)&&sample.destination[2]>0&&sample.destination[3]>0))return null;
 return layer;
}
// Prototype only: caller supplies verified immutable metadata and selected-form loader.
export function createPackedBirthAdapter({catalog,loadImage,createCanvas,preparationTimeoutMs=5000}){
 const snapshots={};
 for(const form of ['gather','blade','carapace','secretion']){const entry=catalog[form];if(!entry)continue;const copy=structuredClone(entry),native=UNIT_BIRTH_ART[`pebble/${form}`],a=copy.animation;delete copy.nativeBody;if(!a||!native||!same(withoutSceneLayers(a),withoutSceneLayers(native)))continue;
 if(native.sceneLayers){const layer=nativeBodyLayer(native);if(!layer)continue;copy.nativeBody=structuredClone(layer);copy.animation=structuredClone(native);}else if(!same(a,native))continue;
 const [aw,ah]=copy.atlasSize||[],W=a.frameSize,H=a.frameHeight||W;if(!Number.isInteger(aw)||!Number.isInteger(ah)||aw<=0||ah<=0||typeof copy.path!=='string'||copy.frames?.length!==a.frameCount)continue;
 if(!copy.frames.every((f,i)=>{const b=f.bounds,p=f.packed;return f.frame===i&&b?.length===4&&p?.length===2&&[...b,...p].every(Number.isInteger)&&b[0]>=0&&b[1]>=0&&b[2]>b[0]&&b[3]>b[1]&&b[2]<=W&&b[3]<=H&&p[0]>=0&&p[1]>=0&&p[0]+b[2]-b[0]<=aw&&p[1]+b[3]-b[1]<=ah;}))continue;snapshots[form]=deepFreeze(copy);}
 catalog=Object.freeze(snapshots);
 const handles=new Map(),pending=new Map(),owned=new WeakSet(),outcomes=new Map();let scratch,current=null,busy=false;const stats={loads:0,copies:0,draws:0,scratchAllocations:0};
 function selected(agent){if(agent?.tribe!=='pebble'||agent.species||agent.dna?.version!==5)return null;const dna=ATTRIBUTE_DNA.validate(agent.dna);if(!dna||!ATTRIBUTE_DNA.trace(dna.pieces,dna.level).valid||dna.pieces.length<1||dna.pieces.length>31||unitDisplaySize(agent)>.4751+1e-12)return null;const s=unitActionArtSelection(agent,UNIT_ACTION_ART);if(!s||s.key!==s.requestedKey)return null;const form=s.key.replace('pebble/','');return s.key===`pebble/${form}`&&catalog[form]?form:null;}
 function prepareForm(form){if(!form||!catalog[form])return Promise.resolve(null);if(handles.has(form))return Promise.resolve(handles.get(form));if(pending.has(form))return pending.get(form).promise;stats.loads++;
 let settle,timer;const record={promise:new Promise(resolve=>settle=resolve)};pending.set(form,record);outcomes.set(form,'loading');
 timer=setTimeout(()=>{outcomes.set(form,'timeout');settle(null);},Number.isFinite(preparationTimeoutMs)&&preparationTimeoutMs>0?preparationTimeoutMs:5000);
 // Timeout bounds caller wait, not decoder lifetime. Keep the physical record until
 // it settles, so retries cannot multiply hung loads. A late success helps only new choices.
 Promise.resolve().then(()=>loadImage(catalog[form].nativeBody?.image||catalog[form].path)).then(async image=>{if(image.decode)await image.decode();const layer=catalog[form].nativeBody,[w,h]=layer?[layer.frameSize*layer.columns,(layer.frameHeight||layer.frameSize)*Math.ceil(layer.frameCount/layer.columns)]:catalog[form].atlasSize;if((image.naturalWidth||image.width)!==w||(image.naturalHeight||image.height)!==h)throw new Error('Birth image dimensions mismatch');const handle=Object.freeze({form,image,owner:Object.freeze({form}),metadata:catalog[form]});owned.add(handle);handles.set(form,handle);outcomes.set(form,'ready');settle(handle);}).catch(()=>{outcomes.set(form,'failed');if(pending.get(form)===record)pending.delete(form);settle(null);}).finally(()=>{clearTimeout(timer);if(pending.get(form)===record)pending.delete(form);});return record.promise;
 }
 function prepare(agent){return prepareForm(selected(agent));}
 function prepareVerifiedRoomBirthCatalog(...args){if(args.length)return Promise.resolve(Object.freeze({invalidArguments:true,forms:[]}));return Promise.all(['gather','blade','carapace','secretion'].map(async form=>{const handle=await prepareForm(form);return Object.freeze({form,status:handle?'ready':outcomes.get(form)||'unavailable',handle});})).then(forms=>Object.freeze({invalidArguments:false,forms:Object.freeze(forms)}));}
 function readyHandle(agent){const form=selected(agent);return form?handles.get(form)||null:null;}
 function ownsHandleFor(agent,handle){return !!handle&&owned.has(handle)&&selected(agent)===handle.form;}
 function draw(ctx,handle,agent,time,x,floor,cell,mirror,beforeDraw){if(!handle||!owned.has(handle)||busy||selected(agent)!==handle.form)return false;const pose=unitActionArtPose(agent,time),a=pose?.animation,m=handle.metadata;if(!pose||pose.action!=='birth'||a.image!==m.animation.image||pose.frame<0||pose.frame>=m.frames.length)return false;
 // Enforce the verified full-cell contract rather than silently adapting a changed asset.
 if(!same(a,m.animation))return false;
 const W=a.frameSize,H=a.frameHeight||W;if(H!==(m.animation.frameHeight||W))return false;const sample=m.frames[pose.frame];if(sample.frame!==pose.frame)return false;
 if(m.nativeBody){
  const layer=m.nativeBody,source=layer.samples[pose.frame],w=layer.frameSize,h=layer.frameHeight||w,scale=cell*unitDisplaySize(agent)/a.referenceLength,[dx,dy,dw,dh]=source.destination;
  const crop=Object.freeze({x:source.frame%layer.columns*w,y:Math.floor(source.frame/layer.columns)*h,width:w,height:h,owner:handle.owner,index:source.frame}),destination={x:(dx-a.pivotX)*scale,y:(dy-a.pivotY)*scale,width:dw*scale,height:dh*scale};
  // No intermediate 512px scene: sample the preserved body directly at final
  // display size, including when the caller draws into its world-occlusion ROI.
  busy=true;ctx.save();try{ctx.translate(x,floor);ctx.scale(unitFrameMirror(a.sourceFacing,mirror?-1:1)?-1:1,1);beforeDraw?.(ctx,handle.image,crop,destination);ctx.drawImage(handle.image,crop.x,crop.y,w,h,destination.x,destination.y,destination.width,destination.height);stats.draws++;return true;}finally{ctx.restore();busy=false;}
 }
 if(!scratch){scratch=createCanvas(512,620);stats.scratchAllocations++;}if(current?.handle!==handle||current?.frame!==pose.frame){const c=scratch.getContext('2d'),b=sample.bounds,[px,py]=sample.packed;c.resetTransform();c.clearRect(0,0,512,620);if(b)c.drawImage(handle.image,px,py,b[2]-b[0],b[3]-b[1],b[0],b[1],b[2]-b[0],b[3]-b[1]);current={handle,frame:pose.frame};stats.copies++;}
 const scale=cell*unitDisplaySize(agent)/a.referenceLength,crop=Object.freeze({x:0,y:0,width:W,height:H,owner:handle.owner,index:pose.frame}),destination={x:-a.pivotX*scale,y:-a.pivotY*scale,width:W*scale,height:H*scale};busy=true;ctx.save();try{ctx.translate(x,floor);ctx.scale(unitFrameMirror(a.sourceFacing,mirror?-1:1)?-1:1,1);beforeDraw?.(ctx,scratch,crop,destination);ctx.drawImage(scratch,0,0,W,H,destination.x,destination.y,destination.width,destination.height);stats.draws++;return true;}finally{ctx.restore();busy=false;}
 }
 return Object.freeze({prepare,prepareVerifiedRoomBirthCatalog,readyHandle,ownsHandleFor,draw,stats});
}
