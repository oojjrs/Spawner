import {attributeAttackPose,renderAttributeAttack,attributeAttackBodyTransform,renderAttributeAttachment} from './attack.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{const x=clamp(v,0,1);return x*x*(3-2*x);};
function curve(t,keys){for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const a=keys[i-1],b=keys[i],p=smooth((t-a[0])/(b[0]-a[0]));return a[1]+(b[1]-a[1])*p;}return keys.at(-1)[1];}
function triangle(ctx,img,uv,points){
 const[a,b,c]=uv,[p,q,r]=points,d=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(d)<.00001)return;
 const xx=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/d,xy=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/d,yx=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/d,yy=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/d,center=points.reduce((s,v)=>[s[0]+v[0]/3,s[1]+v[1]/3],[0,0]);
 ctx.save();ctx.beginPath();points.forEach((v,i)=>{const x=v[0]-center[0],y=v[1]-center[1],n=Math.hypot(x,y)||1,px=v[0]+x/n*2.4,py=v[1]+y/n*2.4;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.closePath();ctx.clip();ctx.transform(xx,yx,xy,yy,p[0]-xx*a[0]-xy*a[1],p[1]-yx*a[0]-yy*a[1]);ctx.drawImage(img,0,0);ctx.restore();
}
function mesh(ctx,img,part,bend,phase,amplitude,ground){
 if(Math.abs(bend)+Math.abs(amplitude)<.00001){const origin=part.imageOrigin||[0,0];ctx.drawImage(img,...origin);return;}
 const pivot=part.pivot,skin=part.skin,points=skin.vertices.map(v=>{
  const [u,y]=v.point||v.uv,dx=u-pivot[0],dy=y-pivot[1],w=v.weights[1]*.45+v.weights[2],angle=bend*w,c=Math.cos(angle),s=Math.sin(angle);
  let x=pivot[0]+dx*c-dy*s,py=pivot[1]+dx*s+dy*c;
  if(skin.mode==='water'){const top=clamp((pivot[1]-y)/part.height,0,1),edge=clamp(Math.abs(dx)/(part.width*.5),0,1);x+=Math.sin(phase+top*2.3)*amplitude*(top*.5+edge*.55);py+=Math.sin(phase+dx/part.width*3.2)*amplitude*edge*.3;}
  if(skin.mode==='foliage')py=Math.min(py,ground);
  if(skin.mode==='cap')py+=Math.sin(phase+dx/part.width*3.1)*amplitude*Math.min(1,Math.abs(dx)/(part.width*.3));
  return[x,py];
 });
 for(const ids of skin.triangles)triangle(ctx,img,ids.map(i=>skin.vertices[i].uv),ids.map(i=>points[i]));
}
export function evolutionPose(rig,action,time){
 if(action==='attack')return attributeAttackPose(rig,time).body;
 const timeline=rig.timelines[action],duration=timeline.durationMs,p=clamp(time/duration,0,1),phase=time/(action==='walk'?duration:3200)*Math.PI*2;
 const pose={x:0,y:0,angle:0,sx:1,sy:1,phase,leaf:0,cap:0,water:0,blink:1,alpha:1,birth:1,death:0};
 if(action==='idle'){
  if(rig.tribe!=='pebble'){pose.sy=1+Math.sin(phase)*.009;pose.sx=1-Math.sin(phase)*.005;}
  pose.leaf=Math.sin(phase-.45)*.035;pose.cap=Math.sin(phase-.7)*.018;pose.water=2.8;
  for(const blink of [2080,4910]){const d=Math.abs(time-blink);if(d<95)pose.blink=Math.min(pose.blink,.06+.94*smooth(d/95));}
 }
 if(action==='walk'){
  pose.y=-Math.abs(Math.sin(phase))*7;pose.angle=Math.sin(phase)*.055;
  pose.leaf=Math.sin(phase-.7)*.11;pose.cap=Math.sin(phase-.6)*.045;pose.water=7;
  if(rig.tribe==='spring'){pose.sy=1+Math.sin(phase)*.035;pose.sx=1-Math.sin(phase)*.025;pose.y=-Math.max(0,Math.sin(phase))*10;}
 }
 if(action==='hurt'){
  const hit=curve(time,[[0,0],[20,1],[110,.75],[510,.75],[600,.25],[duration,0]]),recoil=rig.variant==='guard'?.45:rig.variant==='carapace'?.6:1;
  pose.x=-hit*17*recoil;pose.angle=-hit*.14*recoil;pose.y=hit*4;pose.leaf=hit*-.23;pose.cap=-hit*.06;pose.water=hit*12;pose.blink=1-hit*.91;
  if(rig.tribe!=='pebble'){pose.sx=1+hit*.035;pose.sy=1-hit*.055;}
 }
 if(action==='birth'){
  const grow=curve(p,[[0,.04],[.12,.09],[.32,.46],[.65,1.055],[.82,.98],[1,1]]);pose.birth=grow;pose.sx=grow;pose.sy=grow*(1+Math.sin(p*Math.PI*3)*.08*(1-p));pose.alpha=p<.035?0:1;pose.leaf=(1-smooth((p-.3)/.55))*.65;pose.cap=(1-smooth((p-.24)/.6))*.12;pose.water=7*(1-p);pose.blink=smooth((p-.43)/.15);
 }
 if(action==='death'){
  const active=duration-timeline.durationsMs.at(-1),fall=smooth(time/Math.max(1,active));pose.death=fall;pose.blink=1-smooth(fall/.35)*.96;pose.leaf=fall*.32;pose.cap=fall*.09;
  if(rig.tribe==='pebble'){pose.angle=fall*.65;pose.x=-(rig.root[1]-rig.face[1]+45)*Math.sin(pose.angle);}
  if(rig.tribe==='sprout'){pose.sy=1-fall*.35;pose.sx=1+fall*.08;pose.angle=fall*.04;}
  if(rig.tribe==='spore'){pose.sy=1-fall*.59;pose.sx=1+fall*.06;}
  if(rig.tribe==='spring'){pose.sy=1-fall*.78;pose.sx=1+fall*.12;pose.water=6*(1-fall);}
 }
 
 return pose;
}
function bodyTransform(ctx,rig,pose){
 ctx.translate(rig.root[0]+pose.x,rig.root[1]+pose.y);ctx.rotate(pose.angle);ctx.scale(pose.sx,pose.sy);ctx.translate(-rig.root[0],-rig.root[1]);
}
export function renderEvolutionFrame(ctx,rig,images,action,time){
 if(action==='attack')return renderAttributeAttack(ctx,rig,images,time);
 const pose=evolutionPose(rig,action,time),scale=rig.scale;ctx.save();ctx.translate(rig.pivot[0]+rig.fitOffset[0],rig.pivot[1]+rig.fitOffset[1]);ctx.scale(scale,scale);ctx.translate(-rig.root[0],-rig.root[1]);ctx.globalAlpha=pose.alpha;
 if(action==='death'&&rig.tribe==='pebble'){
  let maxY=-Infinity;const body=rig.parts.find(p=>p.id==='body'),hull=body.contactHull||[[0,rig.canvas[1]],[rig.canvas[0],rig.canvas[1]],[0,0],[rig.canvas[0],0]];
  for(const p of hull){const x=p[0]-rig.root[0],y=p[1]-rig.root[1],py=rig.root[1]+pose.y+x*Math.sin(pose.angle)+y*Math.cos(pose.angle);maxY=Math.max(maxY,py);}
  pose.y-=Math.max(0,maxY-rig.root[1]);
 }
 for(const id of rig.slots){
  const part=rig.parts.find(p=>p.id===id),image=images[id];ctx.save();
  if(id.startsWith('foot-')){
   const side=Number(id.at(-1)),phase=pose.phase+side*Math.PI;
   if(action==='walk'){ctx.translate(Math.cos(phase)*9,-Math.max(0,Math.sin(phase))*13);ctx.translate(...part.pivot);ctx.rotate(Math.sin(phase)*.12);ctx.translate(-part.pivot[0],-part.pivot[1]);}
   if(action==='birth'){ctx.translate(...rig.root);ctx.scale(pose.birth,pose.birth);ctx.translate(-rig.root[0],-rig.root[1]);}
   if(action==='death'){ctx.globalAlpha*=rig.opaque?1:1-smooth((pose.death-.15)/.55);ctx.translate(0,-pose.death*5);}
   ctx.drawImage(image,0,0);ctx.restore();continue;
  }
  bodyTransform(ctx,rig,pose);
  if(id.startsWith('eye-')){
   const opening=Math.max(.025,pose.blink),eyeAlpha=action==='death'?1-smooth((pose.death-.63)/.25):action==='birth'?smooth((time/rig.timelines.birth.durationMs-.4)/.15):1;
   ctx.globalAlpha*=rig.opaque?1:eyeAlpha;ctx.translate(...part.pivot);ctx.scale(1/pose.sx,opening/pose.sy);ctx.translate(-part.pivot[0],-part.pivot[1]);ctx.drawImage(image,0,0);
  }else if(id.startsWith('foliage-')){
   const side=id.endsWith('left')?-1:1,bend=pose.leaf*side;ctx.translate(...part.pivot);ctx.rotate(bend*.08);ctx.translate(-part.pivot[0],-part.pivot[1]);mesh(ctx,image,part,bend,pose.phase,0,['birth','death'].includes(action)?rig.root[1]-5:Infinity);
  }else if(id.startsWith('cap-')){
   const side=id.endsWith('left')?-1:1;mesh(ctx,image,part,pose.cap*side,pose.phase-.4,action==='walk'?3:action==='death'?5:1.5,Infinity);
  }else if(part.skin&&part.skin.mode==='water')mesh(ctx,image,part,pose.angle*.1,pose.phase,pose.water,Infinity);
  else ctx.drawImage(image,0,0);
  ctx.restore();
 }

 

 ctx.restore();return pose;
}


export function evolutionBodyTransform(ctx, rig, action, time) {
 if(action==="attack"){const pose=attributeAttackPose(rig,time);attributeAttackBodyTransform(ctx,pose);return pose.body;}
 const pose=evolutionPose(rig,action,time);
 if(action==="death"&&rig.tribe==="pebble"){const body=rig.parts.find(part=>part.id==="body");let maxY=-Infinity;
  for(const point of body.contactHull){const x=point[0]-rig.root[0],y=point[1]-rig.root[1];maxY=Math.max(maxY,rig.root[1]+pose.y+x*Math.sin(pose.angle)+y*Math.cos(pose.angle));}
  pose.y-=Math.max(0,maxY-rig.root[1]);
 }bodyTransform(ctx,rig,pose);return pose;
}

export function renderEvolutionAttachment(ctx, rig, images, id, action, time) {
 if(action==="attack"){renderAttributeAttachment(ctx,rig,images,id,time);return;}
 const part=rig.parts.find(part=>part.id===id),pose=evolutionPose(rig,action,time),image=images[id];
 ctx.save();
 if(id.startsWith("foliage-")){const bend=pose.leaf*(id.endsWith("left")?-1:1);ctx.translate(...part.pivot);ctx.rotate(bend*.08);ctx.translate(-part.pivot[0],-part.pivot[1]);mesh(ctx,image,part,bend,pose.phase,0,Infinity);}
 else if(id.startsWith("cap-"))mesh(ctx,image,part,pose.cap*-1,pose.phase-.4,action==="walk"?3:action==="death"?5:1.5,Infinity);
 else if(part.skin?.mode==="water")mesh(ctx,image,part,pose.angle*.1,pose.phase,pose.water,Infinity);
 else ctx.drawImage(image,...(part.imageOrigin||[0,0]));
 ctx.restore();
}
