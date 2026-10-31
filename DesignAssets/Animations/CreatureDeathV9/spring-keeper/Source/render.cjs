const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=__dirname;
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:576,height:576}});page.on('pageerror',error=>console.error(error));
  await page.goto('http://127.0.0.1:'+server.address().port+'/rig-view.html');await page.waitForFunction(()=>window.ready===true);
  const folder=path.join(root,'Frames');fs.mkdirSync(folder,{recursive:true});
  const timeline=JSON.parse(fs.readFileSync(path.join(root,'timeline.json'),'utf8'));
  for(let i=0;i<60;i++){const plan=timeline.frames[i];if(plan.drawing){fs.copyFileSync(path.join(root,plan.drawing),path.join(folder,String(i).padStart(3,'0')+'.png'));continue;}const shot=await page.evaluate(time=>window.captureDeath(time,false),i*1000/30);fs.writeFileSync(path.join(folder,String(i).padStart(3,'0')+'.png'),Buffer.from(shot.data,'base64'));}
  fs.writeFileSync(path.join(root,'rig-info.json'),JSON.stringify(await page.evaluate(()=>window.rigInfo))+'\r\n');
  fs.writeFileSync(path.join(root,'bind-rig.glb'),Buffer.from(await page.evaluate(()=>window.exportBind()),'base64'));
  const proofFolder=path.join(root,'BoneProof');fs.mkdirSync(proofFolder,{recursive:true});const poses=[];
  for(let i=0;i<25;i++){const degrees=20*Math.sin(i/24*Math.PI*2);const shot=await page.evaluate(args=>window.captureBone(args[0],args[1],true),['crest-0-bone-4',degrees]);fs.writeFileSync(path.join(proofFolder,String(i).padStart(3,'0')+'.png'),Buffer.from(shot.data,'base64'));if(i===0||i===6)poses.push(shot.bones);}
  fs.writeFileSync(path.join(root,'bone-proof.json'),JSON.stringify({controlledBone:'crest-0-bone-4',poses})+'\r\n');console.log(JSON.stringify({frames:60,boneProof:25}));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
