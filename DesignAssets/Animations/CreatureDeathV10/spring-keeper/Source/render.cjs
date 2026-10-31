const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=__dirname;
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:576,height:576}});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/rig-view.html');
  await page.waitForFunction(()=>window.ready===true);
  const frames=path.join(root,'Frames');fs.mkdirSync(frames,{recursive:true});
  const poses=[];
  for(let i=0;i<60;i++){
   const timeMs=i*1000/30;
   const result=await page.evaluate(time=>window.captureDeath(time,false),timeMs);
   const buffer=Buffer.from(result.data,'base64');fs.writeFileSync(path.join(frames,String(i).padStart(3,'0')+'.png'),buffer);
   poses.push({frame:i,timeMs,bones:result.bones,sha256:crypto.createHash('sha256').update(buffer).digest('hex')});
  }
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(root,'poses.json'),JSON.stringify(poses)+'\r\n');
  const data=JSON.parse(fs.readFileSync(path.join(root,'rig.json'),'utf8'));
  const bind=await page.evaluate(()=>window.captureBind(false));
  const checks=[];
  const proof=path.join(root,'BoneProof');fs.mkdirSync(proof,{recursive:true});
  for(const name of ['head','wing','crest-0-flex-6','tail-0-blade','tail-inner-2','far-leg-0','collar']){
   const result=await page.evaluate(name=>window.captureBone(name,8,false),name);
   fs.writeFileSync(path.join(proof,name+'.png'),Buffer.from(result.data,'base64'));
   const expected=new Set([name]);let changed=true;
   while(changed){changed=false;for(const bone of data.bones)if(expected.has(bone.parent)&&!expected.has(bone.name)){expected.add(bone.name);changed=true;}}
   const actual=Object.keys(bind.bones).filter(key=>bind.bones[key].some((v,i)=>Math.abs(v-result.bones[key][i])>1e-7));
   if(actual.length!==expected.size||actual.some(key=>!expected.has(key)))throw Error('Bone isolation failed: '+name);
   checks.push({bone:name,degrees:8,changedBones:actual});
  }
  const info=await page.evaluate(()=>window.rigInfo);
  const hashes=Object.fromEntries([...new Set([...data.attachments.map(a=>a.image),'Parts/head-closed.png'])].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
  const frozen=poses.slice(30).every(pose=>pose.sha256===poses[30].sha256);
  if(!frozen)throw Error('Final hold changed');
  fs.writeFileSync(path.join(root,'render-proof.json'),JSON.stringify({runtime:info.runtime,construction:'fixed-part-bones',frames:60,animatedTextureChanges:info.animatedTextureChanges,partHashes:hashes,boneIsolation:checks,finalHoldIdentical:frozen})+'\r\n');
  console.log(JSON.stringify({frames:poses.length,finalHoldIdentical:frozen,boneIsolation:checks.length,runtime:info.runtime}));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
