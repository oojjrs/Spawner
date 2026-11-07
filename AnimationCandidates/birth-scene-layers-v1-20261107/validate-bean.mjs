import {createRequire} from 'node:module';import {readFileSync,writeFileSync,readdirSync} from 'node:fs';import {resolve} from 'node:path';
const {createCanvas,loadImage}=createRequire('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/package.json')('@napi-rs/canvas');
const root=new URL('.',import.meta.url).pathname.replace(/\/$/,''),repo=process.env.SPAWNER_SOURCE||resolve(root,'../..');
const entries=readdirSync(root+'/layer-publications').filter(f=>f.startsWith('bean-')&&(!process.argv[2]||f==='bean-'+process.argv[2]+'.json')).map(f=>JSON.parse(readFileSync(root+'/layer-publications/'+f)));let reports=[];
for(const entry of entries){
 const sheets=await Promise.all(entry.sceneLayers.layers.map(l=>loadImage(resolve(root,l.image.split('birth-scene-layers-v1-20261107/')[1]))));const old=await loadImage(resolve(repo,entry.birth.sheet));let frames=[];
 const contact=createCanvas(512,8*256),cc=contact.getContext('2d');cc.fillStyle='#ddd9cf';cc.fillRect(0,0,contact.width,contact.height);
 for(let i=0;i<117;i++){
  const c=createCanvas(512,512),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  entry.sceneLayers.layers.forEach((l,k)=>{const s=l.samples[i];ctx.imageSmoothingEnabled=k!==0;if(s)ctx.drawImage(sheets[k],s.frame%l.columns*l.frameSize,Math.floor(s.frame/l.columns)*l.frameHeight,l.frameSize,l.frameHeight,...s.destination);});
  const o=createCanvas(512,512),oc=o.getContext('2d');oc.imageSmoothingEnabled=false;oc.drawImage(old,i%8*512,Math.floor(i/8)*512,512,512,0,0,512,512);
  const a=ctx.getImageData(0,0,512,512).data,b=oc.getImageData(0,0,512,512).data;let max=0,count=0,visibleMax=0;for(let p=0;p<a.length;p++){const d=Math.abs(a[p]-b[p]);max=Math.max(max,d);if(d)count++;if(a[p-p%4+3]>=16||b[p-p%4+3]>=16)visibleMax=Math.max(visibleMax,d);}

  if(visibleMax>4)throw Error(entry.form+' frame '+i+' difference '+JSON.stringify({max,count,visibleMax}));
  frames.push({frame:i,maxChannelDifference:max,visibleMaxChannelDifference:visibleMax,differingChannels:count});
  const ci=[0,7,30,64,75,90,105,116].indexOf(i);if(ci>=0){cc.drawImage(o,0,ci*256,256,256);cc.drawImage(c,256,ci*256,256,256);}
 c.width=1;o.width=1;
 }
 writeFileSync(root+'/qa/bean-'+entry.form+'-original-layered.jpg',contact.toBuffer('image/jpeg'));reports.push({form:entry.form,frames,allOriginalBoundariesWithinTolerance:true});console.log(entry.form,Math.max(...frames.map(f=>f.visibleMaxChannelDifference)));
}
writeFileSync(root+'/qa/bean-'+(process.argv[2]||'all')+'-composition-validation.json',JSON.stringify(reports,null,2)+'\n');
