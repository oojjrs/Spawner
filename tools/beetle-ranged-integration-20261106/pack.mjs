import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('sharp'),root=process.cwd();
const source=path.resolve(process.argv[2]||'../Spawner-retry');
const hash=b=>createHash('sha256').update(b).digest('hex');
const policyPath=path.join(root,'DesignAssets/image-sizes.json'),policy=JSON.parse(fs.readFileSync(policyPath));
for(const species of ['spiny-back-beetle','spiny-back-leader']){
 const dest=path.join(root,'DesignAssets/Animations/CreatureRangedV1',species);fs.mkdirSync(dest,{recursive:true});
 const bodyDir=path.join(source,'tools/spiny-ranged-candidates-20261106',species),fxDir=path.join(source,'tools/spiny-projectile-review-20261106',species);
 const atlas=fs.readFileSync(path.join(bodyDir,'shoot-candidate.webp'));fs.writeFileSync(path.join(dest,'shoot.webp'),atlas);
 const cells=[];for(let i=0;i<6;i++)cells.push(fs.readFileSync(path.join(fxDir,`effect-${i}.png`)));
 const raw=Buffer.alloc(2048*1024*4);for(let i=0;i<6;i++){const pixels=await sharp(cells[i]).ensureAlpha().raw().toBuffer();for(let y=0;y<512;y++)pixels.copy(raw,((Math.floor(i/4)*512+y)*2048+i%4*512)*4,y*512*4,(y+1)*512*4);}
 const fx=await sharp(raw,{raw:{width:2048,height:1024,channels:4}}).png().toBuffer();fs.writeFileSync(path.join(dest,'effects.png'),fx);
 const body=JSON.parse(fs.readFileSync(path.join(bodyDir,'attack.json')));
 fs.writeFileSync(path.join(dest,'approval.json'),JSON.stringify({species,status:'user-approved-body-and-effects',approvedOn:'2026-11-06',body:{image:'shoot.webp',sha256:hash(atlas),nativeFrameSize:512,columns:4,frameCount:8,durationsMs:body.durationsMs,launchAtMs:body.launchAtMs,outlet:body.releasePointPixels,method:'Approved atlas copied byte-for-byte.'},effects:{image:'effects.png',sha256:hash(fx),nativeFrameSize:512,columns:4,frames:['flight','release','contact','impact-peak','impact-tail','dissipate'],cellSha256:cells.map(hash),method:'Six approved RGBA cells repacked from 3x2 into 4x2 without resampling or redrawing.'},audio:false,review:'Approved body and distinct flight/release/impact artwork; playback mapped to authoritative server launch and outcome events. Review flight speed does not change gameplay.'},null,2)+'\n');
 for(const [name,bytes]of [['shoot.webp',atlas],['effects.png',fx]]){const asset=`DesignAssets/Animations/CreatureRangedV1/${species}/${name}`;policy.images[asset]={display:[512,512],grid:[4,2],sourceMaximum:[512,512],nativeSource:{sha256:hash(bytes),dimensions:[2048,1024],frame:[512,512]},note:'Approved native body or effect cells; lossless original pixels retained.'};}
 const pixels=await sharp(cells[0]).ensureAlpha().raw().toBuffer();let b=[512,512,0,0];for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(pixels[(y*512+x)*4+3]>180){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}console.log(species,b);
}
fs.writeFileSync(policyPath,JSON.stringify(policy,null,2)+'\n');
