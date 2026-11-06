import sharp from '/opt/codex/cua_node/lib/node_modules/sharp/dist/index.mjs';import fs from 'node:fs';
const dir=new URL('.',import.meta.url).pathname,source=dir+'../spring-minor-v2-20261106/';
// New clean attachment artwork only; the base cels remain untouched.
const ant=await sharp(source+'antenna-source-draft.png').extract({left:430,top:205,width:565,height:390}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let y=0;y<ant.info.height;y++)for(let x=0;x<ant.info.width;x++)ant.data[(y*ant.info.width+x)*4+3]*=Math.min(1,(ant.info.height-y)/65);
const tip=await sharp(ant.data,{raw:{width:ant.info.width,height:ant.info.height,channels:4}}).png().toBuffer();
const foot=await sharp(source+'feet-source-draft.png').extract({left:290,top:1040,width:280,height:83}).png().toBuffer();
const durations={birth:[130,120,100,100,80,260,80,90,90,100,100,130,410],death:[120,100,140,120,140,100,120,600]},manifest=[];
for(const form of ['antenna','feet'])for(const action of ['birth','death']){
 const folder=dir+form+'-'+action;fs.mkdirSync(folder,{recursive:true});const frames=[];
 for(let i=0;i<durations[action].length;i++){
 const original=dir+action+'-'+i+'.png';const {data,info}=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,r=0,t=info.height,b=0,topX=0,topN=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>96){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y)}
 for(let y=t;y<t+5;y++)for(let x=l;x<=r;x++)if(data[(y*info.width+x)*4+3]>96){topX+=x;topN++}topX/=topN||1;
 const w=r-l,h=b-t,comps=[];
 if(form==='antenna'&&((action==='birth'&&i>=7)||(action==='death'&&i<2))){
  const src=Buffer.from(data);for(let yy=t;yy<t+h*.38;yy++){const weight=(1-(yy-t)/(h*.38))**2,stretch=1+.75*weight;for(let xx=0;xx<info.width;xx++){const u=topX+(xx-topX)/stretch;const a=Math.floor(u),f=u-a;if(a<0||a>=info.width-1)continue;for(let k=0;k<4;k++)data[(yy*info.width+xx)*4+k]=Math.round(src[(yy*info.width+a)*4+k]*(1-f)+src[(yy*info.width+a+1)*4+k]*f);}}
 }
 if(form==='feet'&&((action==='birth'&&i>=7)||(action==='death'&&i<2))){
  const collapse=action==='death'&&i===2?.4:1,pw=Math.round(w*.38),ph=Math.max(3,Math.round(pw*.38*collapse));
  for(const side of [-1,1]){const item=await sharp(foot).resize(pw,ph).flop(side===1).png().toBuffer();comps.push({input:item,left:Math.round((l+r)/2+side*w*.23-pw/2),top:Math.round(b-ph*.92)});}
 }
 const output=folder+'/'+String(i).padStart(3,'0')+'.png';for(const c of comps){const q=await sharp(c.input).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let yy=0;yy<q.info.height;yy++)for(let xx=0;xx<q.info.width;xx++){const tx=c.left+xx,ty=c.top+yy;if(tx<0||ty<0||tx>=info.width||ty>=info.height)continue;const si=(yy*q.info.width+xx)*4,di=(ty*info.width+tx)*4,sa=q.data[si+3]/255,da=data[di+3]/255,aa=sa+da*(1-sa);if(!sa)continue;for(let k=0;k<3;k++)data[di+k]=Math.round((q.data[si+k]*sa+data[di+k]*da*(1-sa))/aa);data[di+3]=Math.round(aa*255);}}await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(output);frames.push({file:output,duration:durations[action][i],size:info.width,patches:comps.map(v=>({left:v.left,top:v.top}))});
 }
 manifest.push({form,action,frames});console.log(form,action);
}
fs.writeFileSync(dir+'manifest.json',JSON.stringify(manifest,null,2));
