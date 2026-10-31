const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function smooth(values,times,total,loop,sigma){
 return values.map((value,i)=>{
  let weight=0,sum=0;
  for(let j=0;j<values.length;j++){let distance=Math.abs(times[j]-times[i]);if(loop)distance=Math.min(distance,total-distance);if(distance>sigma*3)continue;const w=Math.exp(-distance*distance/(2*sigma*sigma));sum+=values[j]*w;weight+=w}
  return sum/weight;
 });
}
export function prepareBindings(rig,animation,action){
 const tracks=animation.tracks,loop=['idle','walk'].includes(action),times=[];let total=0;
 for(const duration of animation.durationsMs){times.push(total);total+=duration}
 const visible=tracks.map((track,i)=>track.visible?i:-1).filter(i=>i>=0),sigma=action==='idle'?70:action==='walk'?35:25;
 function channel(read){const values=visible.map(i=>read(tracks[i])),t=visible.map(i=>times[i]),result=smooth(values,t,total,loop,sigma),map=new Map(visible.map((index,i)=>[index,result[i]]));return tracks.map((track,i)=>map.has(i)?map.get(i):read(track))}
 const body={x:channel(t=>t.surface.body.center[0]),y:channel(t=>t.surface.body.center[1]),sx:channel(t=>t.surface.body.spread[0]),sy:channel(t=>t.surface.body.spread[1])},cap={x:channel(t=>t.surface.canopy.center[0]),y:channel(t=>t.surface.canopy.center[1]),sx:channel(t=>t.surface.canopy.spread[0]),sy:channel(t=>t.surface.canopy.spread[1])};
 const angle=loop||action==='birth'?tracks.map(()=>0):channel(t=>clamp((t.shapeLean||0)-(rig.referenceLean||0),-.8,.8));
 for(let i=0;i<tracks.length;i++){
  let values=[body.x[i],body.y[i],body.sx[i],body.sy[i]];
  if(action==='death'&&rig.tribe==='spore'){const ref=rig.animations.idle.tracks[0],box=tracks[i].bounds,sx=box[2]/ref.bounds[2],sy=box[3]/ref.bounds[3],centre=ref.surface.body.center;values=[box[0]+(centre[0]-ref.bounds[0])*sx,box[1]+(centre[1]-ref.bounds[1])*sy,ref.surface.body.spread[0]*sx,ref.surface.body.spread[1]*sy]}
  tracks[i].binding={body:values,canopy:[cap.x[i],cap.y[i],cap.sx[i],cap.sy[i]],angle:angle[i]};
 }
}
export function mapBinding(reference,current,point,angle){
 const sx=clamp(current[2]/Math.max(.1,reference[2]),.025,4),sy=clamp(current[3]/Math.max(.1,reference[3]),.025,4),x=(point[0]-reference[0])*sx,y=(point[1]-reference[1])*sy,c=Math.cos(angle),s=Math.sin(angle);
 return {x:current[0]+x*c-y*s,y:current[1]+x*s+y*c,sx,sy};
}
export function bindAnimation(rig,animation,action){
 const tracks=animation.tracks,reference=rig.bindingReference,loop=['idle','walk'].includes(action),durations=animation.durationsMs,total=durations.reduce((a,b)=>a+b,0);
 for(const track of tracks)track.mounts={};
 for(const [id,mount]of Object.entries(rig.mounts)){
  const raw=tracks.map(track=>{
   const frame=track.binding,body=mapBinding(reference.body,frame.body,mount.bind,frame.angle),cap=mapBinding(reference.canopy,frame.canopy,mount.bind,frame.angle),mix=mount.canopy;
   const x=body.x*(1-mix)+cap.x*mix,y=body.y*(1-mix)+cap.y*mix,sx=body.sx*(1-mix)+cap.sx*mix,sy=body.sy*(1-mix)+cap.sy*mix;
   const dx=mount.bind[0]-reference.body[0],dy=mount.bind[1]-reference.body[1],normal=id.startsWith('armor-')?clamp(Math.atan2(dy*sy,dx*sx)-Math.atan2(dy,dx),-.45,.45):0;
   const ref=reference.canopy,head=frame.canopy,gesture=(head[2]/Math.max(1,ref[2])-head[3]/Math.max(1,ref[3]))*.22+(head[0]-frame.body[0]-ref[0]+reference.body[0])/Math.max(1,rig.reference.span)*.35;
   return{x,y,angle:frame.angle+normal,driver:clamp(gesture*mount.gesture,-.25,.25)};
  });
  let angle=raw[0].driver,velocity=0,previous=raw[0];const cycles=loop?6:1;
  for(let cycle=0;cycle<cycles;cycle++){
   let elapsed=0;
   for(let i=0;i<raw.length;i++){
    const pose=raw[i],seconds=(loop?durations[(i+raw.length-1)%raw.length]:i?durations[i-1]:0)/1000,steps=Math.max(1,Math.ceil(seconds/.008)),dt=seconds/steps;
    const vx=(pose.x-previous.x)/Math.max(.02,seconds),vy=(pose.y-previous.y)/Math.max(.02,seconds),target=pose.driver+clamp((-vx*.001+vy*.0006)*mount.inertia,-.1,.1),omega=mount.stiffness;
    for(let step=0;step<steps;step++){const mix=(step+1)/steps,drive=previous.driver*(1-mix)+target*mix;velocity+=(omega*omega*(drive-angle)-2*.95*omega*velocity)*dt;angle+=velocity*dt}
    const recovery=!loop&&action!=='death'?clamp((total-elapsed)/180,0,1):1,lag=clamp(angle*mount.inertia,-mount.limit,mount.limit)*recovery;
    if(cycle===cycles-1)tracks[i].mounts[id]={x:pose.x,y:pose.y,angle:pose.angle,lag,bend:clamp(angle*.7+lag,-.25,.25),growth:action==='birth'?Math.max(.04,tracks[i].body[2]/Math.max(1,rig.reference.body[2])):1};
    previous=pose;elapsed+=durations[i];
   }
  }
 }
}
