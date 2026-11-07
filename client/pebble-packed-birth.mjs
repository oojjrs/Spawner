import {unitActionArtPose,unitActionArtSelection} from './unit-action-art.mjs';
import {UNIT_ACTION_ART} from './unit-action-art-assets.mjs';
import {unitDisplaySize,unitFrameMirror} from './unit-size.mjs';
import {ATTRIBUTE_DNA} from '../server/dna.mjs';
import {UNIT_BIRTH_ART} from './unit-birth-art-assets.mjs';
const deepFreeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))deepFreeze(v);Object.freeze(value);}return value;};
const same=(a,b)=>{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));};
// Prototype only: caller supplies verified immutable metadata and selected-form loader.
export function createPackedBirthAdapter({catalog,loadImage,createCanvas,preparationTimeoutMs=5000}){
 const snapshots={};
 for(const form of ['gather','blade','carapace','secretion']){const entry=catalog[form];if(!entry)continue;const copy=structuredClone(entry),native=UNIT_BIRTH_ART[`pebble/${form}`],a=copy.animation;if(!native||!same(a,native))continue;
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
 Promise.resolve().then(()=>loadImage(catalog[form].path)).then(async image=>{if(image.decode)await image.decode();const [w,h]=catalog[form].atlasSize;if((image.naturalWidth||image.width)!==w||(image.naturalHeight||image.height)!==h)throw new Error('Packed image dimensions mismatch');const handle=Object.freeze({form,image,owner:Object.freeze({form}),metadata:catalog[form]});owned.add(handle);handles.set(form,handle);outcomes.set(form,'ready');settle(handle);}).catch(()=>{outcomes.set(form,'failed');if(pending.get(form)===record)pending.delete(form);settle(null);}).finally(()=>{clearTimeout(timer);if(pending.get(form)===record)pending.delete(form);});return record.promise;
 }
 function prepare(agent){return prepareForm(selected(agent));}
 function prepareVerifiedRoomBirthCatalog(...args){if(args.length)return Promise.resolve(Object.freeze({invalidArguments:true,forms:[]}));return Promise.all(['gather','blade','carapace','secretion'].map(async form=>{const handle=await prepareForm(form);return Object.freeze({form,status:handle?'ready':outcomes.get(form)||'unavailable',handle});})).then(forms=>Object.freeze({invalidArguments:false,forms:Object.freeze(forms)}));}
 function readyHandle(agent){const form=selected(agent);return form?handles.get(form)||null:null;}
 function ownsHandleFor(agent,handle){return !!handle&&owned.has(handle)&&selected(agent)===handle.form;}
 function draw(ctx,handle,agent,time,x,floor,cell,mirror,beforeDraw){if(!handle||!owned.has(handle)||busy||selected(agent)!==handle.form)return false;const pose=unitActionArtPose(agent,time),a=pose?.animation,m=handle.metadata;if(!pose||pose.action!=='birth'||a.image!==m.animation.image||pose.frame<0||pose.frame>=m.frames.length)return false;
 // Enforce the verified full-cell contract rather than silently adapting a changed asset.
 if(!same(a,m.animation))return false;
 const W=a.frameSize,H=a.frameHeight||W;if(H!==(m.animation.frameHeight||W))return false;const sample=m.frames[pose.frame];if(sample.frame!==pose.frame)return false;
 if(!scratch){scratch=createCanvas(512,620);stats.scratchAllocations++;}if(current?.handle!==handle||current?.frame!==pose.frame){const c=scratch.getContext('2d'),b=sample.bounds,[px,py]=sample.packed;c.resetTransform();c.clearRect(0,0,512,620);if(b)c.drawImage(handle.image,px,py,b[2]-b[0],b[3]-b[1],b[0],b[1],b[2]-b[0],b[3]-b[1]);current={handle,frame:pose.frame};stats.copies++;}
 const scale=cell*unitDisplaySize(agent)/a.referenceLength,crop=Object.freeze({x:0,y:0,width:W,height:H,owner:handle.owner,index:pose.frame}),destination={x:-a.pivotX*scale,y:-a.pivotY*scale,width:W*scale,height:H*scale};busy=true;ctx.save();try{ctx.translate(x,floor);ctx.scale(unitFrameMirror(a.sourceFacing,mirror?-1:1)?-1:1,1);beforeDraw?.(ctx,scratch,crop,destination);ctx.drawImage(scratch,0,0,W,H,destination.x,destination.y,destination.width,destination.height);stats.draws++;return true;}finally{ctx.restore();busy=false;}
 }
 return Object.freeze({prepare,prepareVerifiedRoomBirthCatalog,readyHandle,ownsHandleFor,draw,stats});
}
