import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const sharp=createRequire(import.meta.url)('sharp'),root=resolve(process.argv[2]);
const context={};vm.runInNewContext(readFileSync(resolve(root,'client/unit-matrix-data.js'),'utf8'),context);
const {attributes}=context.SpawnerUnitMatrixData,previews={};
const previous={},manifest=resolve(root,'client/unit-matrix-previews.js');
if(existsSync(manifest))vm.runInNewContext(readFileSync(manifest,'utf8'),previous);
const staticSources={};
const base='DesignAssets/Planning/UnitAppearance96',size=96,extent=256,floor=208;
for(const [key,actions] of Object.entries(attributes)){
 const fit=Math.min(...Object.values(actions).flatMap(clip=>
  [clip,...Object.values(clip.frameGeometry||{}).map(shape=>({...clip,...shape}))].map(shape=>{
   const frame=shape.frameSize,x=shape.pivotX??frame/2,y=shape.pivotY??frame*.875;
   return Math.min(extent/(2*Math.max(x,frame-x)),floor/y,(extent-floor)/(frame-y))/clip.sourceScale;
  })));
 for(const [action,clip] of Object.entries(actions)){
  const source=await sharp(resolve(root,clip.image)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const columns=clip.columns,frameCount=clip.frameCount||Math.max(clip.durationsMs.length,...(clip.frames||[]).map(f=>f+1));
  const width=columns*size,height=Math.ceil(frameCount/columns)*size,atlas=Buffer.alloc(width*height*4);
  for(let frame=0;frame<frameCount;frame++){
   const shape={...clip,...clip.frameGeometry?.[frame]},scale=clip.sourceScale*fit*size/extent;
   const scaled=Math.round(shape.frameSize*scale),left=Math.round(size/2-shape.pivotX*scale),top=Math.round(floor*size/extent-shape.pivotY*scale);
   const tile=await sharp(source.data,{raw:source.info}).extract({left:frame%columns*clip.frameSize,top:Math.floor(frame/columns)*clip.frameSize,width:clip.frameSize,height:clip.frameSize}).resize(scaled,scaled).raw().toBuffer();
   if(left<0||top<0||left+scaled>size||top+scaled>size)throw Error('Frame outside preview: '+key+'/'+action);
   for(let y=0;y<scaled;y++)tile.copy(atlas,((Math.floor(frame/columns)*size+top+y)*width+frame%columns*size+left)*4,y*scaled*4,(y+1)*scaled*4);
  }
  const image=base+'/'+key+'/'+action+'.webp',path=resolve(root,image);mkdirSync(dirname(path),{recursive:true});
  await sharp(atlas,{raw:{width,height,channels:4}}).webp({lossless:true,effort:3}).toFile(path);
  previews[clip.image]={image,frameSize:size,columns,frameCount};
 }
 process.stdout.write(key+'\n');
}
const path=resolve(root,'Design.html'),html=readFileSync(path,'utf8'),start=html.indexOf('<details id="codex-unit-appearance">'),end=html.indexOf('<details id="codex-unit-tiers">',start);
if(start<0||end<0)throw Error('Appearance page not found');
let block=html.slice(start,end),staticImages=new Map(),edits=[];
for(const match of block.matchAll(/<img\b[^>]*>/g)){
 const tag=match[0],anchorStart=block.lastIndexOf('<a ',match.index),anchor=block.slice(anchorStart,block.indexOf('>',anchorStart)+1);
 if(anchor.includes('data-combat-clip'))continue;
 const currentSource=tag.match(/data-src="([^"]+)"/)?.[1];if(!currentSource)continue;
 const pixels=anchor.includes('attribute-unit-part')?18:anchor.includes('attribute-unit-full')?96:52;
 const key=(tag.match(/data-original-src="([^"]+)"/)?.[1]||currentSource)+'/'+pixels;
 const source=previous.SpawnerUnitMatrixStaticSources?.[key]||currentSource;staticSources[key]=source;
 let image=staticImages.get(key);
 if(!image){
  image=base+'/static/'+createHash('sha256').update(key).digest('hex').slice(0,16)+'.webp';
  mkdirSync(dirname(resolve(root,image)),{recursive:true});
  await sharp(resolve(root,source),{animated:true}).resize(pixels,pixels,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({lossless:true,effort:3}).toFile(resolve(root,image));
  staticImages.set(key,image);
 }
 edits.push({start:match.index,end:match.index+tag.length,text:tag.replace('data-src="'+currentSource+'"','data-src="'+image+'"')});
}
for(const edit of edits.reverse())block=block.slice(0,edit.start)+edit.text+block.slice(edit.end);
const next=html.slice(0,start)+block+html.slice(end);
writeFileSync(path,next);
writeFileSync(manifest,'globalThis.SpawnerUnitMatrixPreviews='+JSON.stringify(previews)+';\r\nglobalThis.SpawnerUnitMatrixStaticSources='+JSON.stringify(staticSources)+';\r\n');
process.stdout.write(JSON.stringify({animations:Object.keys(previews).length,staticImages:staticImages.size,frameSize:size})+'\n');
