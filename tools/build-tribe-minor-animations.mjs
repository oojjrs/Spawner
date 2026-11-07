import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root=process.cwd(),base=resolve(root,"$Trash/assets-all-apply-01a1b0eb/minor/build"),size=128;
const handoff="AnimationCandidates/SheetGifHandoff-20261106/",out="DesignAssets/Animations/TribeMinorV1/";
const records=JSON.parse(readFileSync(resolve(root,handoff,"manifest.json"),"utf8")).filter(item=>/^(spore|pebble|spring)-antenna-/.test(item.name));
const clips=records.map(item=>{const [tribe,form,action]=item.name.split("-");return {...item,tribe,form,action,source:handoff+item.sheet,pivot:tribe==="spring"&&action==="birth"?[147.5,206.5]:[item.cellSize[0]/2,item.cellSize[1]*.875]};});
const pebbleAntennaFolder="AnimationCandidates/pebble-antenna-walk-stable-v6/",pebbleAntenna=JSON.parse(readFileSync(resolve(root,pebbleAntennaFolder,"manifest.json"),"utf8"));
clips.push({name:"pebble-antenna-walk-stable-v6",tribe:"pebble",form:"antenna",action:"walk",source:pebbleAntennaFolder+pebbleAntenna.image,cellSize:[pebbleAntenna.frameSize,pebbleAntenna.frameSize],columns:pebbleAntenna.columns,rows:Math.ceil(pebbleAntenna.frameCount/pebbleAntenna.columns),frameCount:pebbleAntenna.frameCount,durationsMs:pebbleAntenna.durationsMs,pivot:[pebbleAntenna.frameSize/2,pebbleAntenna.frameSize*.875],actionLoop:pebbleAntenna.loop});
const selected=process.argv[2],targets=selected?clips.filter(clip=>clip.name===selected):clips;
if(!targets.length)throw new Error("Unknown animation: "+selected);
const definitions=selected?JSON.parse(readFileSync(resolve(root,"client/tribe-minor-animations.mjs"),"utf8").match(/Object\.freeze\(([\s\S]+)\);/)[1]):{};
const manifest=selected?JSON.parse(readFileSync(resolve(root,out,"manifest.json"),"utf8")).filter(clip=>clip.name!==selected):[];
for (const forms of Object.values(definitions)) delete forms.feet;
for (let i = manifest.length - 1; i >= 0; i--) if (manifest[i].form === "feet" || manifest[i].name.includes("-feet-")) manifest.splice(i, 1);
const crlf = value => value.replace(/\r?\n/g,"\r\n");
for(const clip of targets){
 const directory=resolve(base,clip.name);mkdirSync(directory,{recursive:true});const images=[];
 for(let index=0;index<clip.frameCount;index++){const destination=resolve(directory,String(index).padStart(3,"0")+".png");execFileSync("magick",[resolve(root,clip.source),"-crop",clip.cellSize[0]+"x"+clip.cellSize[1]+"+"+(index%clip.columns*clip.cellSize[0])+"+"+(Math.floor(index/clip.columns)*clip.cellSize[1]),"+repage","-filter","Lanczos","-resize",size+"x"+size+"!",destination]);images.push(destination);}
 const image=out+clip.tribe+"/"+clip.form+"/"+clip.action+".webp";mkdirSync(dirname(resolve(root,image)),{recursive:true});execFileSync("magick",["montage",...images,"-tile",clip.columns+"x"+clip.rows,"-geometry",size+"x"+size+"+0+0","-background","none","-define","webp:lossless=true",resolve(root,image)]);
 const definition={image,frameSize:size,columns:clip.columns,frameCount:clip.frameCount,durationsMs:clip.durationsMs,loop:clip.actionLoop,pivotX:clip.pivot[0]*size/clip.cellSize[0],pivotY:clip.pivot[1]*size/clip.cellSize[1],durationMs:clip.durationsMs.reduce((sum,value)=>sum+value,0)};
 if(clip.worldScaleContract)definition.worldPerPixelBeforeDisplay=clip.worldScaleContract.worldPixelsPerSourcePixel/clip.worldScaleContract.externalDisplayScale*clip.cellSize[0]/size;
 ((definitions[clip.tribe]||={})[clip.form]||={})[clip.action]=definition;
 const sourceSha256=createHash("sha256").update(readFileSync(resolve(root,clip.source))).digest("hex"),sha256=createHash("sha256").update(readFileSync(resolve(root,image))).digest("hex");
 manifest.push({name:clip.name,source:clip.source,sourceSha256,...definition,sha256,grid:[clip.columns,clip.rows],display:[size,size],dimensions:[clip.columns*size,clip.rows*size]});
 execFileSync("magick",["montage",...images.filter((value,index)=>[0,Math.floor((clip.frameCount-1)/2),clip.frameCount-1].includes(index)),"-tile","3x1","-geometry",size+"x"+size+"+2+2","-background","#20313a",resolve(base,"..",clip.name+"-contact.png")]);
}
writeFileSync(resolve(root,"client/tribe-minor-animations.mjs"),crlf("export const TRIBE_MINOR_ANIMATIONS = Object.freeze("+JSON.stringify(definitions,null,2)+");\r\n"));
writeFileSync(resolve(root,out,"manifest.json"),crlf(JSON.stringify(manifest,null,2)+"\r\n"));
writeFileSync(resolve(base,"../result.json"),JSON.stringify({clips:manifest.length,files:["client/tribe-minor-animations.mjs",out+"manifest.json",...manifest.map(item=>item.image)],assets:manifest},null,2));
console.log(JSON.stringify({clips:manifest.length,frameSize:size,files:manifest.length+2}));
