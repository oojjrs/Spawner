import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {spawn} from'node:child_process';
import sharp from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';
import{CONFIG,SOURCE_PIXELS_PER_CELL,CYCLES_PER_CELL,PERIOD,drawRig,LEGS,footPose}from'./rig.mjs';
const HERE=path.dirname(new URL(import.meta.url).pathname),ROOT=path.resolve(HERE,'../..');
const runtime=JSON.parse(await fs.readFile(path.join(HERE,'runtime.json')));
import{art,renderRig}from'./raster-core.mjs';
if(process.env.QUICK==='1'){for(const n of[0,8,16,24,32,40,48,56]){await fs.writeFile(path.join(HERE,`probe-${n}.png`),await renderRig(n/64));}process.exit(0);}
await fs.mkdir(path.join(HERE,'Frames'),{recursive:true});
const frames=[];
for(let n=0;n<64;n++){let png=await renderRig(n/64);frames.push(png);await fs.writeFile(path.join(HERE,'Frames',String(n).padStart(2,'0')+'.png'),png);}
await sharp({create:{width:640*8,height:640*8,channels:4,background:'#00000000'}}).composite(frames.map((input,i)=>({input,left:(i%8)*640,top:Math.floor(i/8)*640}))).webp({lossless:true}).toFile(path.join(HERE,'walk-candidate.webp'));
const oldFrames=[];for(let n=0;n<64;n++)oldFrames.push(await fs.readFile(path.join(HERE,'../mountain-attached-walk-20261106/Frames',String(n).padStart(2,'0')+'.png')));
function oldIndex(t){return Math.floor(t/PERIOD%1*64);}
const txt=(x,y,s,size=17)=>`<text x="${x}" y="${y}" fill="#20372d" font-family="DejaVu Sans" font-size="${size}">${s}</text>`;
async function review(t,markers=false){
 let o=oldIndex(t),n=Math.floor(t/PERIOD%1*64),out=[];
 out.push('<rect width="1280" height="800" fill="#eaf0e4"/>',txt(24,35,'WALKING MOUNTAIN | Actual size and world-speed comparison',23),txt(24,65,'0.3 cells/s both lanes | Final 1.12-cell normalization included | 1x time | Review only'),txt(24,104,'PREVIOUS: separate overlapping pieces',20),txt(664,104,`NEW: continuous attached limbs / ${(1/PERIOD).toFixed(2)} Hz`,20));
 for(const[row,cell,floor]of[[0,150,310],[1,360,684]]){let scale=cell/SOURCE_PIXELS_PER_CELL;
  for(let lane=0;lane<2;lane++){let left=lane*640;
   for(const ysrc of[415,423,425,443]){let y=floor+(ysrc-443)*scale;out.push(`<path d="M${left+16},${y}H${left+624}" stroke="#b6c4ae"/>`);for(let k=-3;k<10;k++){let x=left+k*cell/4+t*.3*cell%(cell/4);if(x>left+16&&x<left+624)out.push(`<path d="M${x},${y}v7" stroke="#93a685"/>`);}}
   let b,x,y,size;
   if(!lane){b=oldFrames[o];size=640*scale;x=left+320-(251.56+64)*scale;y=floor-(443+64)*scale;}
   else{b=frames[n];size=640*scale;x=left+320-(251.56+64)*scale;y=floor-(443+64)*scale;}
   out.push(`<image x="${x}" y="${y}" width="${size}" height="${size}" href="data:image/png;base64,${b.toString('base64')}"/>`);
   if(lane&&markers)for(const leg of LEGS){const p=footPose(n/64,leg);out.push(`<circle cx="${left+320+(p.x-251.56)*scale}" cy="${floor+(p.y-443)*scale}" r="4" stroke="${p.support?'#0b8c55':'#e57b23'}" fill="none" stroke-width="2"/>`);}
   out.push(txt(left+24,row?365:140,(row?'Enlarged: 360':'World size: 150')+' px/cell',15));
  }
 }
 out.push('<path d="M640 85V710" stroke="#b6c4ae"/>',txt(24,747,'Same rhythm and foot paths. Fixed shoulders; continuous skin; rigid toes; same foot timing.',16),txt(24,776,`Offline reconstruction, not a game recording. No production change. Time ${t.toFixed(2)}s.`,16));
 return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">${out.join('')}</svg>`)).png().toBuffer();
}
for(const n of[0,7,14,21,28,35,42])await fs.writeFile(path.join(HERE,`inspection-${String(n).padStart(2,'0')}.png`),await review(n/60,false));
for(let block=0;block<4;block++){const layers=[];for(let j=0;j<16;j++){let n=block*16+j;layers.push({input:await sharp(frames[n]).extract({left:0,top:375,width:640,height:150}).resize(640,150).png().toBuffer(),left:j%4*640,top:Math.floor(j/4)*180});}await sharp({create:{width:2560,height:720,channels:4,background:'#eaf0e4'}}).composite(layers).png().toFile(path.join(HERE,`join-inspection-${block}.png`));}
if(process.env.FRAMES_ONLY==='1')process.exit(0);
const v=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-vcodec','png','-r','60','-i','-','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(HERE,'world-speed-comparison.mp4')]);
let err='';v.stderr.on('data',b=>err+=b);
for(let n=0;n<360;n++){let b=await review(n/60,false);if(!v.stdin.write(b))await new Promise(r=>v.stdin.once('drain',r));}
v.stdin.end();let code=await new Promise(r=>v.on('close',r));if(code)throw Error(err);
console.log(JSON.stringify({frames:64,period:PERIOD,cpp:CYCLES_PER_CELL,sourcePixelsPerCell:SOURCE_PIXELS_PER_CELL,videoSeconds:6}));
