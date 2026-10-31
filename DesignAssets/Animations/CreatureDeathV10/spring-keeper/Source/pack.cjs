const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const root=__dirname;
const output=path.dirname(root);
(async()=>{
 const durations=Array.from({length:60},(_,i)=>Math.round((i+1)*1000/30)-Math.round(i*1000/30));
 const frames=Array.from({length:60},(_,i)=>path.join(root,'Frames',String(i).padStart(3,'0')+'.png'));
 const decoded=[];for(const file of frames)decoded.push(await sharp(file).ensureAlpha().raw().toBuffer());
 await sharp(Buffer.concat(decoded),{raw:{width:576,height:576*60,channels:4,pageHeight:576}}).webp({lossless:true,effort:4,loop:0,delay:durations}).toFile(path.join(output,'preview.webp'));
 const sheet=Buffer.alloc(2304*8640*4);for(let i=0;i<60;i++)for(let y=0;y<576;y++)decoded[i].copy(sheet,((Math.floor(i/4)*576+y)*2304+i%4*576)*4,y*576*4,(y+1)*576*4);
 await sharp(sheet,{raw:{width:2304,height:8640,channels:4}}).webp({lossless:true,effort:4}).toFile(path.join(output,'death.webp'));
 await sharp(frames[0]).resize(64,64).webp({lossless:true}).toFile(path.join(output,'thumbnail.webp'));
 const metadata=await sharp(path.join(output,'preview.webp'),{animated:true}).metadata();
 const source=JSON.parse(fs.readFileSync(path.join(output,'death.json'),'utf8'));
 if(source.frameCount!==60||metadata.delay.reduce((a,b)=>a+b,0)!==2000)throw Error('Output contract mismatch');
 console.log(JSON.stringify({preview:{width:metadata.width,height:metadata.pageHeight,pages:metadata.pages,durationMs:metadata.delay.reduce((a,b)=>a+b,0)},sheet:{width:2304,height:8640,frames:60}}));
})().catch(error=>{console.error(error);process.exitCode=1;});
