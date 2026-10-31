const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const root=__dirname;const output=path.dirname(root);
(async()=>{
 const durations=Array.from({length:60},(_,i)=>Math.round((i+1)*1000/30)-Math.round(i*1000/30));const frames=Array.from({length:60},(_,i)=>path.join(root,'Frames',String(i).padStart(3,'0')+'.png'));
 const decoded=[];for(const file of frames)decoded.push(await sharp(file).ensureAlpha().raw().toBuffer());
 await sharp(Buffer.concat(decoded),{raw:{width:576,height:576*60,channels:4,pageHeight:576}}).webp({lossless:true,effort:4,loop:0,delay:durations}).toFile(path.join(output,'preview.webp'));
 await sharp({create:{width:2304,height:8640,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(frames.map((input,i)=>({input,left:i%4*576,top:Math.floor(i/4)*576}))).webp({lossless:true,effort:4}).toFile(path.join(output,'death.webp'));
 await sharp(frames[0]).resize(64,64).webp({lossless:true}).toFile(path.join(output,'thumbnail.webp'));
 const proof=[];for(let i=0;i<25;i++)proof.push(await sharp(path.join(root,'BoneProof',String(i).padStart(3,'0')+'.png')).ensureAlpha().raw().toBuffer());
 await sharp(Buffer.concat(proof),{raw:{width:576,height:576*25,channels:4,pageHeight:576}}).webp({lossless:true,loop:0,delay:40}).toFile(path.join(output,'bone-proof.webp'));
 const metadata=await sharp(path.join(output,'preview.webp'),{animated:true}).metadata();console.log(JSON.stringify({preview:{width:metadata.width,height:metadata.pageHeight,pages:metadata.pages,durationMs:metadata.delay.reduce((a,b)=>a+b,0)},sheet:await sharp(path.join(output,'death.webp')).metadata()}));
})().catch(error=>{console.error(error);process.exitCode=1});
