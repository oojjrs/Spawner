import fs from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const modules=process.env.SPAWNER_ART_NODE_MODULES;
if(!modules||!process.argv[2])throw Error('SPAWNER_ART_NODE_MODULES and output directory are required');
const require=createRequire(import.meta.url),sharp=require(resolve(modules,'sharp'));
const {createCanvas,loadImage}=require(resolve(modules,'@napi-rs/canvas'));
const source=dirname(fileURLToPath(import.meta.url)),out=resolve(process.argv[2]),rig=JSON.parse(fs.readFileSync(resolve(source,'rig.json'))),m=rig.motion;
fs.mkdirSync(out,{recursive:true});
const parts=Object.fromEntries(await Promise.all(Object.entries(rig.parts).map(async([name,path])=>[name,await loadImage(resolve(source,path))])));
function drawPart(ctx,name,position,angle){ctx.save();ctx.translate(position[0],position[1]);ctx.rotate(angle);ctx.translate(-rig.bind[name][0],-rig.bind[name][1]);ctx.drawImage(parts[name],0,0);ctx.restore();}
function footPose(t){const phase=((t+m.footPhase)%1+1)%1;return phase<.5?{x:m.footStride/2-m.footStride*2*phase,y:0,angle:0}:{x:-m.footStride/2+m.footStride*(1-Math.cos((phase-.5)*Math.PI*2))/2,y:-m.footLift*Math.sin((phase-.5)*Math.PI*2),angle:-m.footTilt*Math.sin((phase-.5)*Math.PI*2)};}
const images=[];
for(let frame=0;frame<rig.frameCount;frame++){
 const t=frame/rig.frameCount,phase=t*Math.PI*2,canvas=createCanvas(1024,1024),ctx=canvas.getContext('2d');
 ctx.scale(2,2);ctx.translate(rig.pivotX,rig.pivotY);ctx.scale(rig.sourceToOutput,rig.sourceToOutput);ctx.translate(-rig.sourcePivot.x,-rig.sourcePivot.y);
 const bob=-m.bodyLift*(1-Math.cos(phase*2)),shift=m.bodySway*Math.sin(phase),tilt=m.bodyTilt*Math.sin(phase),right=footPose(t+.5),left=footPose(t);
 drawPart(ctx,'foot-right',[rig.bind['foot-right'][0]+right.x,rig.bind['foot-right'][1]+right.y],right.angle);
 ctx.save();ctx.translate(rig.bind.body[0]+shift,rig.bind.body[1]+bob);ctx.rotate(tilt);ctx.translate(-rig.bind.body[0],-rig.bind.body[1]);
 drawPart(ctx,'body',rig.bind.body,0);drawPart(ctx,'cap',[rig.bind.cap[0],rig.bind.cap[1]-m.capLift*Math.sin(phase*2)],-m.capTilt*Math.sin(phase));ctx.restore();
 drawPart(ctx,'foot-left',[rig.bind['foot-left'][0]+left.x,rig.bind['foot-left'][1]+left.y],left.angle);
 const bytes=await sharp(canvas.toBuffer('image/png')).resize(rig.frameSize,rig.frameSize).png().toBuffer();fs.writeFileSync(resolve(out,String(frame).padStart(3,'0')+'.png'),bytes);images.push({input:bytes,left:frame%rig.columns*rig.frameSize,top:Math.floor(frame/rig.columns)*rig.frameSize});
}
await sharp({create:{width:rig.frameSize*rig.columns,height:Math.ceil(rig.frameCount/rig.columns)*rig.frameSize,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(images).webp({lossless:true,effort:6}).toFile(resolve(out,'walk-v2.webp'));