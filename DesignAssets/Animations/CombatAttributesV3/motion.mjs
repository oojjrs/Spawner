const tau=Math.PI*2;
const limit=(value,min,max)=>Math.max(min,Math.min(max,value));
const rotate=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
function surface(data,box,angle,kind){
 const [bx,by,bw,bh]=box,mask=new Float32Array(256*256);let mass=0,cx=0,cy=0,wx=0,wy=0;
 for(let y=Math.max(0,Math.floor(by-3));y<Math.min(256,by+bh+4);y++)for(let x=Math.max(0,Math.floor(bx-3));x<Math.min(256,bx+bw+4);x++){
  const p=(y*256+x)*4,r=data[p],g=data[p+1],b=data[p+2],alpha=data[p+3]/255;
  const valid=kind==='green'?g-r>10&&g>b*1.08:kind==='red'?r-g>16&&r>b*1.15:kind==='pale'?r>100&&g>r*.77&&b>r*.62&&g-r<34:true;
  if(!valid||alpha<.25)continue;mask[y*256+x]=alpha;mass+=alpha;cx+=x*alpha;cy+=y*alpha;
 }
 if(mass<8)return null;
 cx/=mass;cy/=mass;
 for(let y=Math.max(0,Math.floor(by-3));y<Math.min(256,by+bh+4);y++)for(let x=Math.max(0,Math.floor(bx-3));x<Math.min(256,bx+bw+4);x++){const a=mask[y*256+x];wx+=(x-cx)**2*a;wy+=(y-cy)**2*a}
 function sample(x,y){const ix=Math.floor(x),iy=Math.floor(y);if(ix<0||iy<0||ix>=255||iy>=255)return 0;const u=x-ix,v=y-iy;return mask[iy*256+ix]*(1-u)*(1-v)+mask[iy*256+ix+1]*u*(1-v)+mask[(iy+1)*256+ix]*(1-u)*v+mask[(iy+1)*256+ix+1]*u*v}
 const ring=[];
 for(let i=0;i<24;i++){
  const a=i*tau/24+angle,dx=Math.cos(a),dy=Math.sin(a);let radius=0;
  for(let r=0;r<Math.max(bw,bh)*1.3+8;r+=.25)if(sample(cx+dx*r,cy+dy*r)>.22)radius=r;
  if(radius<1)radius=Math.max(1,Math.min(bw,bh)*.12);
  ring.push([cx+dx*radius,cy+dy*radius]);
 }
 return {center:[cx,cy],ring,angle,spread:[Math.sqrt(wx/mass),Math.sqrt(wy/mass)],mass};
}
function opaqueBox(data,predicate){let x0=256,y0=256,x1=-1,y1=-1;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const p=(y*256+x)*4;if(data[p+3]>90&&predicate(data[p],data[p+1],data[p+2],x,y)){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}}return x1<0?null:[x0,y0,x1-x0+1,y1-y0+1]}
export function analyseSurface(data,track,tribe,referenceArea,action){
 let box=track.body,kind=['sprout','spore'].includes(tribe)?'pale':'opaque';
 if(action==='death'&&box[2]*box[3]<referenceArea*.3){box=track.bounds;kind='opaque'}
 let body=surface(data,box,track.angle,kind);if(!body)body=surface(data,track.bounds,track.angle,'opaque');
 if(!body){const c=[box[0]+box[2]*.5,box[1]+box[3]*.5];body={center:c,ring:Array.from({length:24},(_,i)=>[c[0]+Math.cos(i*tau/24)*Math.max(1,box[2])*.5,c[1]+Math.sin(i*tau/24)*Math.max(1,box[3])*.5]),angle:0,spread:[1,1],mass:0}}
 let canopy=body;
 if(tribe==='sprout'||tribe==='spore'){
  const region=opaqueBox(data,(r,g,b,x,y)=>y<track.body[1]+track.body[3]*.3&&(tribe==='sprout'?g-r>10&&g>b*1.08:r-g>16&&r>b*1.15));
  if(region)canopy=surface(data,region,track.angle,tribe==='sprout'?'green':'red')||body;
 }
 const floor=track.bounds[1]+track.bounds[3],feet=[];
 for(const side of [-1,1]){let m=0,xs=0,ys=0;for(let y=Math.max(0,Math.floor(floor-Math.max(4,track.body[3]*.15)));y<Math.min(256,floor+1);y++)for(let x=Math.max(0,Math.floor(track.bounds[0]));x<Math.min(256,track.bounds[0]+track.bounds[2]);x++){const a=data[(y*256+x)*4+3]/255;if(a<.45||(x<body.center[0]?-1:1)!==side)continue;m+=a;xs+=x*a;ys+=y*a}feet.push(m?[xs/m,ys/m]:[body.center[0],floor])}
 return {body,canopy,feet};
}
export function mapSurface(reference,current,point){
 const x=point[0]-reference.center[0],y=point[1]-reference.center[1],angle=((Math.atan2(y,x)-reference.angle)%tau+tau)%tau,index=Math.floor(angle/tau*reference.ring.length)%reference.ring.length,next=(index+1)%reference.ring.length;
 const a=reference.ring[index].map((v,i)=>v-reference.center[i]),b=reference.ring[next].map((v,i)=>v-reference.center[i]),p=current.ring[index].map((v,i)=>v-current.center[i]),q=current.ring[next].map((v,i)=>v-current.center[i]);
 const det=a[0]*b[1]-a[1]*b[0];if(Math.abs(det)<.001)return {point:[current.center[0]+x,current.center[1]+y],angle:current.angle-reference.angle};
 const u=(x*b[1]-y*b[0])/det,v=(y*a[0]-x*a[1])/det;
 const xx=(p[0]*b[1]-q[0]*a[1])/det,xy=(q[0]*a[0]-p[0]*b[0])/det,yx=(p[1]*b[1]-q[1]*a[1])/det,yy=(q[1]*a[0]-p[1]*b[0])/det;
 return {point:[current.center[0]+u*p[0]+v*q[0],current.center[1]+u*p[1]+v*q[1]],angle:Math.atan2(yx-xy,xx+yy)};
}
export function pinToSurface(reference,point){
 const c=reference.center,angle=((Math.atan2(point[1]-c[1],point[0]-c[0])-reference.angle)%tau+tau)%tau,index=Math.floor(angle/tau*reference.ring.length),mix=angle/tau*reference.ring.length-index,a=reference.ring[index],b=reference.ring[(index+1)%reference.ring.length],edge=[a[0]*(1-mix)+b[0]*mix,a[1]*(1-mix)+b[1]*mix],distance=Math.hypot(point[0]-c[0],point[1]-c[1]),radius=Math.hypot(edge[0]-c[0],edge[1]-c[1]);
 const scale=Math.min(1,radius*.95/Math.max(.01,distance));return[c[0]+(point[0]-c[0])*scale,c[1]+(point[1]-c[1])*scale];
}
function wrapAngle(a){while(a>Math.PI)a-=tau;while(a< -Math.PI)a+=tau;return a}
export function bindAnimation(rig,animation,action){
 const tracks=animation.tracks,reference=rig.surfaceReference,durations=animation.durationsMs,loop=action==='idle'||action==='walk',total=durations.reduce((a,b)=>a+b,0),motionEnd=action==='death'?total-durations.at(-1):total;
 for(const track of tracks)track.mounts={};
 for(const [id,mount]of Object.entries(rig.mounts)){
  const raw=tracks.map(track=>{
   const body=mapSurface(reference.body,track.surface.body,mount.bind),cap=mapSurface(reference.canopy,track.surface.canopy,mount.bind),mix=action==='death'?0:mount.canopy;
   let x=body.point[0]*(1-mix)+cap.point[0]*mix,y=body.point[1]*(1-mix)+cap.point[1]*mix;
   const global=wrapAngle(track.angle-rig.animations.idle.tracks[0].angle),local=wrapAngle(body.angle*(1-mix)+cap.angle*mix-global),rotation=global+limit(local,-mount.jointLimit,mount.jointLimit)*mount.localRotation;
   if(action==='death'&&rig.tribe==='spore'){const a=rig.animations.idle.tracks[0].bounds,b=track.bounds;x=b[0]+(mount.bind[0]-a[0])*b[2]/a[2];y=b[1]+(mount.bind[1]-a[1])*b[3]/a[3]}
   const base=track.surface.body,head=track.surface.canopy,ref=reference.canopy,gesture=(head.spread[0]/Math.max(1,ref.spread[0])-head.spread[1]/Math.max(1,ref.spread[1]))*.22+(head.center[0]-base.center[0]-reference.canopy.center[0]+reference.body.center[0])/Math.max(1,rig.reference.span)*.35;
   const feet=track.surface.feet,gait=(feet[0][1]-feet[1][1])/Math.max(1,rig.reference.body[3])*2.2;
   return {x,y,angle:rotation,driver:limit(gesture*mount.gesture+(action==='walk'?gait*mount.gait:0),-.4,.4)};
  });
  let angle=raw[0].driver,velocity=0,previous=raw[0],elapsed=0;
  const cycles=loop?5:1;
  for(let cycle=0;cycle<cycles;cycle++){
   elapsed=0;
   for(let i=0;i<raw.length;i++){
    const pose=raw[i],seconds=(loop?durations[(i+raw.length-1)%raw.length]:i?durations[i-1]:0)/1000,steps=Math.max(1,Math.ceil(seconds/.012)),dt=seconds/steps;
    const speedX=(pose.x-previous.x)/Math.max(.02,seconds),speedY=(pose.y-previous.y)/Math.max(.02,seconds),angularSpeed=wrapAngle(pose.angle-previous.angle)/Math.max(.02,seconds),target=pose.driver+limit((-speedX*.0014+speedY*.0008-angularSpeed*.04)*mount.inertia,-.16,.16);
    const omega=mount.stiffness;
    for(let step=0;step<steps;step++){const blend=(step+1)/steps,drive=previous.driver*(1-blend)+target*blend;velocity+=(omega*omega*(drive-angle)-2*.82*omega*velocity)*dt;angle+=velocity*dt}
    const recovery=!loop&&action!=='death'?limit((total-elapsed)/(action==='hurt'?150:180),0,1):1,lag=limit(angle*mount.inertia,-mount.limit,mount.limit)*recovery;
    if(cycle===cycles-1)tracks[i].mounts[id]={x:pose.x,y:pose.y,angle:pose.angle,lag,bend:limit(angle*.7+lag,-.34,.34),growth:action==='birth'?Math.max(.04,tracks[i].body[2]/Math.max(1,rig.reference.body[2])):1};
    previous=pose;elapsed+=durations[i];
   }
  }
 }
 return motionEnd;
}
