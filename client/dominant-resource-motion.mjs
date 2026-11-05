import { unitDisplayAttributes } from './unit-display-appearance.mjs';
import { UNIT_APPEARANCE_LEGACY_VISUAL_KEYS } from '../server/unit-appearance.mjs';
import { unitAnimationFrame } from './unit-animation.mjs';

// One body-only work cue for seven own-source dominant forms. Resource selection,
// yields, cargo, delivery, sound and combat remain entirely with their hosts.
const supportedForm=(tribe,form)=>['spore','pebble','spring'].includes(tribe)&&['blade','carapace'].includes(form)||tribe==='bean'&&form==='carapace';
export function dominantResourceHarvestPose(agent,time,animations) {
 const tribe=agent.tribe||'bean',attributes=unitDisplayAttributes(agent),form=attributes.blade>0?'blade':attributes.carapace>0?'carapace':null;
 const elapsed=(time-agent.harvestStarted)*1000;
 if(!supportedForm(tribe,form)||agent.species||!(agent.health>0)||agent.birth||agent.mode!=='harvest'||
  UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key=>attributes[key]>0)||!Number.isFinite(elapsed)||elapsed<0||
  agent.moveDuration>0&&time>=agent.moveStartedAt&&time<agent.moveStartedAt+agent.moveDuration||
  !animations?.idle?.image?.includes('/'+(tribe==='bean'?'sprout':tribe)+'/Sheets/'+form+'/'))return null;
 const sampleTime=Math.floor((elapsed+1e-7)/20)*20;
 return {action:'harvest',frame:sampleTime,elapsed,sampleTime,animation:animations.idle,dominantResource:true};
}
export function dominantResourceHarvestSample(source,requested){
 const {rig,definition,sheets}=source||{},animation=definition?.animations?.idle,image=sheets?.get('idle'),tribe=rig?.tribe==='sprout'?'bean':rig?.tribe;
 if(!requested?.dominantResource||!supportedForm(tribe,rig?.variant)||
  rig.approvedSource!=='DesignAssets/Concepts/CombatEvolutionV1/'+rig.tribe+'.png'||!image||image.complete===false||
  !(animation?.frameSize>0)||!(animation.columns>0)||!(animation.durationMs>0)||!animation.durationsMs?.length)return null;
 const frame=unitAnimationFrame(animation,requested.sampleTime),s=animation.frameSize;
 if((image.naturalWidth||image.width)<(frame%animation.columns+1)*s||(image.naturalHeight||image.height)<(Math.floor(frame/animation.columns)+1)*s)return null;
 const pose=harvestWork(tribe,requested.sampleTime);
 return pose?{image,animation,frame,pose}:null;
}
export function renderDominantResourceHarvest(ctx,sample){
 return sample?drawHarvestWork(ctx,sample.image,sample.animation,sample.frame,sample.pose):false;
}
const clamp=p=>Math.max(0,Math.min(1,p));
const smooth=p=>{p=clamp(p);return p*p*(3-2*p);};
export function harvestWork(tribe,time){
 if(!['bean','spore','pebble','spring'].includes(tribe)||!Number.isFinite(time)||time<0)return null;
 const phase=time/(tribe==='bean'?420:720)*Math.PI*2,entry=smooth(time/120),press=(1-Math.cos(phase))*.5*entry;
 return {tribe,time,press,compression:press*(tribe==='pebble'?.075:.15),sweep:Math.sin(phase)*entry*(tribe==='pebble'?.12:.10)};
}
// Keep the entire authored lower support band unchanged. Spring idle already
// extends 2 px (blade) / 4 px (carapace) below its nominal y=448 root. Do not
// disguise that baseline by lifting, cropping or resizing the harvest body.
// Bean carapace likewise keeps its original neutral lower silhouette unchanged.
export function workPoint(pose,x,y){
 const w=smooth((432-y)/144),h=448-y;
 return [x+w*(h*pose.sweep+(x-256)*pose.compression*.18),y+w*h*pose.compression];
}
const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
export function workTriangles(pose){
 const list=[];
 for(let y=0;y<432;y+=16){
  const b=Math.min(y+16,432),uv=[[0,y],[512,y],[512,b],[0,b]];
  for(const ids of [[0,1,2],[0,2,3]]){
   const source=ids.map(i=>uv[i]),points=source.map(v=>workPoint(pose,...v));
   const ratio=area(...points)/area(...source);
   if(!Number.isFinite(ratio)||ratio<=.1)return null;
   list.push({uv:source,points,ratio});
  }
 }
 return list;
}
export function drawHarvestWork(ctx,image,animation,frame,pose){
 if(!pose||!image||image.complete===false)return false;
 const s=animation.frameSize||256,columns=animation.columns||8,px=animation.pivotX??animation.pivot?.[0]??128,py=animation.pivotY??animation.pivot?.[1]??230;
 const sx=frame%columns*s,sy=Math.floor(frame/columns)*s,dx=256-px*512/s,dy=448-py*512/s;
 const paint=()=>ctx.drawImage(image,sx,sy,s,s,dx,dy,512,512);
 if(pose.time===0||(pose.tribe==='bean'||pose.edgePadding)&&Math.abs(pose.compression)+Math.abs(pose.sweep)<1e-10){try{paint();return true;}catch{return false;}}
 const triangles=workTriangles(pose);if(!triangles)return false;
 ctx.save();try{
  // The bean's broad shell makes subpixel row gaps visible. Expand its thin
  // triangle clips by edge distance, keeping the unchanged support strip separate.
  for(const {uv,points}of triangles){
   const [a,b,c]=uv,[p,q,r]=points,d=area(a,b,c),center=points.reduce((s,v)=>[s[0]+v[0]/3,s[1]+v[1]/3],[0,0]);
   const xx=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/d,xy=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/d;
   const yx=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/d,yy=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/d;
   ctx.save();try{ctx.beginPath();points.forEach((v,i)=>{
    let x1,y1;
    if(pose.tribe==='bean'||pose.edgePadding){
     // Reuse the verified secretion-resource edge-distance padding. A radial
     // pad leaves scan lines along these extremely thin strip triangles.
     const previous=points[(i+2)%3],next=points[(i+1)%3],ea=[v[0]-previous[0],v[1]-previous[1]],eb=[next[0]-v[0],next[1]-v[1]];
     const la=Math.hypot(...ea),lb=Math.hypot(...eb),na=[ea[1]/la,-ea[0]/la],nb=[eb[1]/lb,-eb[0]/lb],factor=.75/(1+na[0]*nb[0]+na[1]*nb[1]);
     x1=v[0]+(na[0]+nb[0])*factor;y1=Math.min(432,v[1]+(na[1]+nb[1])*factor);
    }else{const x=v[0]-center[0],y=v[1]-center[1],n=Math.hypot(x,y)||1;x1=v[0]+x/n*.65;y1=Math.min(432,v[1]+y/n*.65);}
    if(i)ctx.lineTo(x1,y1);else ctx.moveTo(x1,y1);
   });ctx.closePath();ctx.clip();ctx.transform(xx,yx,xy,yy,p[0]-xx*a[0]-xy*a[1],p[1]-yx*a[0]-yy*a[1]);paint();}finally{ctx.restore();}
  }
  ctx.save();ctx.beginPath();ctx.rect(0,432,512,80);ctx.clip();paint();ctx.restore();return true;
 }catch{return false;}finally{ctx.restore();}
}
