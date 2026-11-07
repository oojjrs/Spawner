import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
const D=dirname(fileURLToPath(import.meta.url)),R=resolve(D,'../../attack-publish-merge');
const existing=JSON.parse(readFileSync(resolve(D,'existing-scene-layer-reference.json'),'utf8'));
const bodyMeta=JSON.parse(readFileSync(resolve(D,'body-manifest.json'),'utf8'));
const environment={...existing.sceneLayers.layers[0]},oldBody=existing.sceneLayers.layers[1];
const env=await loadImage(resolve(R,environment.image)),bodyPath=resolve(D,bodyMeta.sheet),body=await loadImage(bodyPath);
const times=[];let at=0;for(const d of existing.durationsMs){times.push(at);at+=d;}
const count=times.findIndex(t=>t>=3850);if(count<0)throw Error('No3850boundary');const durations=existing.durationsMs.slice(0,count);if(durations.reduce((a,b)=>a+b)!==3850)throw Error('Timing');
const scale=32/247,bodySamples=[],records=[];mkdirSync(resolve(D,'complete-frames'),{recursive:true});
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
for(let i=0;i<count;i++){
 const c=createCanvas(512,512),ctx=c.getContext('2d');const es=environment.samples[i];
 ctx.imageSmoothingEnabled=false;ctx.drawImage(env,es.frame%environment.columns*environment.frameSize,Math.floor(es.frame/environment.columns)*environment.frameHeight,environment.frameSize,environment.frameHeight,...es.destination);
 let bs=null;const old=oldBody.samples[i];if(old){const floor=old.destination[1]+70;bs={frame:old.frame,destination:[430-bodyMeta.pivotX*scale,floor-bodyMeta.pivotY*scale,bodyMeta.frameSize*scale,bodyMeta.frameHeight*scale]};ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(body,bs.frame%8*631,Math.floor(bs.frame/8)*631,631,631,...bs.destination);}
 bodySamples.push(bs);writeFileSync(resolve(D,'complete-frames',`${String(i).padStart(3,'0')}.png`),c.toBuffer('image/png'));records.push({index:i,timeMs:times[i],durationMs:durations[i],environmentFrame:es.frame,bodySample:bs});
}
environment.samples=environment.samples.slice(0,count);environment.sha256=hash(resolve(R,environment.image));const bodyLayer={role:'body',wholeBody:true,image:bodyMeta.sheet,sha256:hash(bodyPath),frameSize:631,frameHeight:631,columns:8,frameCount:16,samples:bodySamples};
const meta={tribe:'bean',form:'base',action:'birth',frameSize:512,frameHeight:512,columns:8,frameCount:count,timesMs:times.slice(0,count),durationsMs:durations,durationMs:3850,loop:false,pivotX:430,pivotY:446,referenceLength:32,viewSize:32,registrationScale:1,sourceFacing:'right',fullScene:true,worldTravelIncludedInPixels:true,sceneIncludesNest:true,sceneAnchor:'final-body-floor',sceneLayers:{version:1,layers:[environment,bodyLayer]},bodySource:bodyMeta.sheet,bodyScale:scale,bodyNativePivot:[bodyMeta.pivotX,bodyMeta.pivotY],bodyNativeReferenceLength:247,bodyFirstVisibleMs:2590,bodyFinalNeutralMs:3610,environmentReuseSource:'bean/blade-antenna runtime birth environment track, unchanged pixels and ordered samples truncated only at the3850ms runtime end.',sceneCamera:{width:512,height:512,cell:80,nestCenterX:150,nestFloorY:230,finalBodyFloor:[430,446]},construction:'One existing whole environment plus one newly authored intact whole-body cel. No body-part assembly or code deformation. Final body cel is current registered idle frame0.',records};
writeFileSync(resolve(D,'complete-scene-manifest.json'),JSON.stringify(meta,null,2)+'\n');console.log(JSON.stringify({frames:count,durationMs:3850,environmentHash:environment.sha256,bodySha:bodyLayer.sha256,bodyRange:[Math.min(...bodySamples.filter(Boolean).map(x=>x.frame)),Math.max(...bodySamples.filter(Boolean).map(x=>x.frame))]}));
