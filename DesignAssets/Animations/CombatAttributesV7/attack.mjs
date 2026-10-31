const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{const x=clamp(v,0,1);return x*x*(3-2*x);};
function curve(time,keys){for(let i=1;i<keys.length;i++)if(time<=keys[i][0]){const a=keys[i-1],b=keys[i],p=smooth((time-a[0])/(b[0]-a[0]));return a[1]+(b[1]-a[1])*p;}return keys.at(-1)[1];}
function sample(channels,key,time,value){return channels[key]?curve(time,channels[key]):value;}
function rotate(x,y,angle){const c=Math.cos(angle),s=Math.sin(angle);return[x*c-y*s,x*s+y*c];}
export function attributeAttackPose(rig,time){
 const motion=rig.attackMotion,c=motion.body,body={x:sample(c,'x',time,0),y:sample(c,'y',time,0),angle:sample(c,'angle',time,0),sx:sample(c,'sx',time,1),sy:sample(c,'sy',time,1),projection:sample(c,'projection',time,1),feetAlpha:sample(c,'feetAlpha',time,1),groundBlend:sample(c,'groundBlend',time,0),blink:sample(c,'blink',time,1),phase:time/1000*Math.PI*2,leaf:0,cap:0,water:0,alpha:1,birth:1,death:0};
 const center=motion.anchor==='center'?[rig.root[0],rig.face[1]-45]:rig.root.slice(),parts={};
 for(const part of rig.parts){const spec=motion.parts[part.id],channels=spec?spec.channels:{};
  parts[part.id]={x:sample(channels,'x',time,0),y:sample(channels,'y',time,0),angle:sample(channels,'angle',time,0),sx:sample(channels,'sx',time,1),sy:sample(channels,'sy',time,1),projection:sample(channels,'projection',time,1),bend:sample(channels,'bend',time,0)};
 }
 const water={turn:sample(motion.waterChannels,'turn',time,0),rim:sample(motion.waterChannels,'rim',time,0)};
 if(motion.ground==='roll'){
  const hull=rig.parts.find(p=>p.id==='body').contactHull;let bottom=-Infinity;
  for(const p of hull){const q=rotate((p[0]-center[0])*body.sx*body.projection,(p[1]-center[1])*body.sy,body.angle);bottom=Math.max(bottom,center[1]+body.y+q[1]);}
  body.y+=(rig.root[1]-14*body.feetAlpha-bottom)*body.groundBlend;
 }
 return{body,parts,water,center,time};
}
function warpPoint(rig,part,pose,point,weights){
 const state=pose.parts[part.id];let[x,y]=point;
 if(part.skin&&state.bend){
  const dx=x-part.pivot[0],dy=y-part.pivot[1],span=Math.max(part.width,part.height)*.55,u=clamp((part.skin.mode==='foliage'?Math.hypot(dx,dy):Math.abs(dy))/span,0,1),a=Math.max(0,1-u*2),c=Math.max(0,u*2-1),b=1-a-c,w=weights?weights[1]*.45+weights[2]:b*.45+c,q=rotate(dx,dy,state.bend*w);x=part.pivot[0]+q[0];y=part.pivot[1]+q[1];
 }
 if(part.id==='body'&&rig.tribe==='spring'){
  if(rig.attackMotion.water==='upper-fin'){
   const pivot=[rig.face[0],rig.face[1]-70],weight=smooth((pivot[1]-point[1])/(rig.variant==='piercing'?(rig.attackMotion.waterRootBlend||65):Math.max(1,pivot[1]+15))),q=rotate(x-pivot[0],y-pivot[1],pose.water.turn*weight);x=pivot[0]+q[0];y=pivot[1]+q[1];
  }else{
   const dx=x-rig.face[0],edge=Math.pow(clamp(Math.abs(dx)/(part.width*.45),0,1),2.1),back=rig.attackMotion.water==='shield-rim'&&dx<0?.28:1;
   x+=Math.sign(dx)*pose.water.rim*edge*back;
   if(rig.attackMotion.water==='shield-rim')y-=Math.sin((point[1]/part.height)*Math.PI)*pose.water.rim*edge*.18;
  }
 }
 return[x,y];
}
function bodyPoint(pose,point){const b=pose.body,q=rotate((point[0]-pose.center[0])*b.sx*b.projection,(point[1]-pose.center[1])*b.sy,b.angle);return[pose.center[0]+b.x+q[0],pose.center[1]+b.y+q[1]];}
function partPoint(rig,pose,part,point){
 const state=pose.parts[part.id],p=warpPoint(rig,part,pose,point,null),q=rotate((p[0]-part.pivot[0])*state.sx*state.projection,(p[1]-part.pivot[1])*state.sy,state.angle);
 return bodyPoint(pose,[part.pivot[0]+state.x+q[0],part.pivot[1]+state.y+q[1]]);
}
function bodyTransform(ctx,pose){const b=pose.body;ctx.translate(pose.center[0]+b.x,pose.center[1]+b.y);ctx.rotate(b.angle);ctx.scale(b.sx*b.projection,b.sy);ctx.translate(-pose.center[0],-pose.center[1]);}
function partTransform(ctx,part,state){ctx.translate(part.pivot[0]+state.x,part.pivot[1]+state.y);ctx.rotate(state.angle);ctx.scale(state.sx*state.projection,state.sy);ctx.translate(-part.pivot[0],-part.pivot[1]);}
function triangle(ctx,img,uv,points){
 const transform=ctx.getTransform(),padding=1.2/Math.sqrt(Math.max(.0001,Math.abs(transform.a*transform.d-transform.b*transform.c)));
 const[a,b,c]=uv,[p,q,r]=points,d=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(d)<.00001)return;
 const xx=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/d,xy=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/d,yx=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/d,yy=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/d,center=points.reduce((s,v)=>[s[0]+v[0]/3,s[1]+v[1]/3],[0,0]);
 ctx.save();ctx.beginPath();points.forEach((v,i)=>{const x=v[0]-center[0],y=v[1]-center[1],n=Math.hypot(x,y)||1,px=v[0]+x/n*padding,py=v[1]+y/n*padding;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.closePath();ctx.clip();ctx.transform(xx,yx,xy,yy,p[0]-xx*a[0]-xy*a[1],p[1]-yx*a[0]-yy*a[1]);ctx.drawImage(img,0,0);ctx.restore();
}
function drawSurface(ctx,rig,part,pose,image){
 const state=pose.parts[part.id],water=part.id==='body'&&rig.tribe==='spring'&&(pose.water.turn||pose.water.rim);
 if(!part.skin||!state.bend&&!water){const origin=part.imageOrigin||[0,0];ctx.drawImage(image,...origin);return;}
 const skin=rig.attackMotion.meshes&&rig.attackMotion.meshes[part.id]||part.skin,points=skin.vertices.map(v=>warpPoint(rig,part,pose,v.point||v.uv,v.weights));
 for(const ids of skin.triangles)triangle(ctx,image,ids.map(i=>skin.vertices[i].uv),ids.map(i=>points[i]));
}
function sourcePoint(rig,point){return[(point[0]-rig.pivot[0]-rig.fitOffset[0])/rig.scale+rig.root[0],(point[1]-rig.pivot[1]-rig.fitOffset[1])/rig.scale+rig.root[1]];}
function drawEffect(ctx,rig,image,point,width,angle,alpha){
 ctx.save();ctx.globalAlpha*=alpha;ctx.translate(...point);ctx.rotate(angle);const w=width/rig.scale,h=w*image.height/image.width;ctx.drawImage(image,-w*.5,-h*.5,w,h);ctx.restore();
}
function impact(ctx,rig,images,time,target,start,end,width){
 if(time<start||time>end)return;const phase=(time-start)/(end-start),grow=.55+.45*Math.sin(Math.PI*phase);drawEffect(ctx,rig,images['attack-impact'],sourcePoint(rig,target),width*grow,0,1-smooth(phase));
}
export function renderAttributeAttack(ctx,rig,images,time){
 const pose=attributeAttackPose(rig,time),b=pose.body;
 ctx.save();ctx.translate(rig.pivot[0]+rig.fitOffset[0],rig.pivot[1]+rig.fitOffset[1]);ctx.scale(rig.scale,rig.scale);ctx.translate(-rig.root[0],-rig.root[1]);
 const body=rig.parts.find(p=>p.id==='body');ctx.save();bodyTransform(ctx,pose);partTransform(ctx,body,pose.parts.body);drawSurface(ctx,rig,body,pose,rig.attackMotion.images.body?images['attack-body']:images.body);ctx.restore();
 for(const part of rig.parts.filter(p=>p.id.startsWith('eye-'))){
  ctx.save();bodyTransform(ctx,pose);const pivot=rig.tribe==='spring'?warpPoint(rig,body,pose,part.pivot,null):part.pivot;ctx.translate(pivot[0],pivot[1]);ctx.scale(1/b.sx,Math.max(.14,b.blink)/b.sy);ctx.translate(-part.pivot[0],-part.pivot[1]);ctx.drawImage(images[part.id],0,0);ctx.restore();
 }
 for(const part of rig.parts.filter(p=>p.id.startsWith('foliage-')||p.id.startsWith('cap-'))){ctx.save();bodyTransform(ctx,pose);partTransform(ctx,part,pose.parts[part.id]);drawSurface(ctx,rig,part,pose,rig.attackMotion.images[part.id]?images['attack-'+part.id]:images[part.id]);ctx.restore();}
 for(const [i,overlay]of (rig.attackMotion.overlays||[]).entries()){const part=rig.parts.find(p=>p.id===overlay.parent);ctx.save();bodyTransform(ctx,pose);partTransform(ctx,part,pose.parts[part.id]);drawSurface(ctx,rig,part,pose,images['attack-overlay-'+i]);ctx.restore();}
 for(const part of rig.parts.filter(p=>p.id.startsWith('foot-'))){
  ctx.save();ctx.globalAlpha*=rig.opaque?(b.feetAlpha>.35?1:0):b.feetAlpha;
  if(rig.attackMotion.feet==='plant'){ctx.translate(b.x*.45,Math.min(0,b.y)*.25);}
  else{bodyTransform(ctx,pose);if(rig.attackMotion.feet==='tuck')ctx.translate(0,-(1-b.feetAlpha)*18);}
  ctx.drawImage(rig.attackMotion.images[part.id]?images['attack-'+part.id]:images[part.id],0,0);ctx.restore();
 }
 for(const shot of rig.attackMotion.projectiles){
  if(time>=shot.launchMs&&time<=shot.impactMs){
   const launch=attributeAttackPose(rig,shot.launchMs),part=rig.parts.find(p=>p.id===shot.part),start=partPoint(rig,launch,part,shot.originPoint||rig.emission.origins[shot.origin]),end=sourcePoint(rig,shot.target),phase=(time-shot.launchMs)/(shot.impactMs-shot.launchMs),point=[start[0]+(end[0]-start[0])*phase,start[1]+(end[1]-start[1])*phase+Math.sin(phase*Math.PI)*shot.arc/rig.scale],angle=Math.atan2(end[1]-start[1],end[0]-start[0]),grow=Math.min(1,.35+phase*3);
   drawEffect(ctx,rig,images[shot.effect==='impact'?'attack-impact':'attack-projectile'],point,shot.width*grow,angle,1);
  }
  impact(ctx,rig,images,time,shot.target,shot.impactMs,shot.impactMs+150,32);
 }
 const hit=rig.attackMotion.impact;if(hit)impact(ctx,rig,images,time,hit.target,hit.startMs,hit.endMs,hit.width);
 ctx.restore();return pose.body;
}


export function attributeAttackBodyTransform(ctx, pose) { bodyTransform(ctx, pose); }

export function renderAttributeAttachment(ctx, rig, images, id, time) {
 const part=rig.parts.find(part=>part.id===id),pose=attributeAttackPose(rig,time);
 ctx.save();partTransform(ctx,part,pose.parts[id]);
 drawSurface(ctx,rig,part,pose,rig.attackMotion.images[id]?images["attack-"+id]:images[id]);ctx.restore();
}

export function renderAttributeEffects(ctx,rig,images,time){
 for(const shot of rig.attackMotion.projectiles){
  if(time>=shot.launchMs&&time<=shot.impactMs){
   const launch=attributeAttackPose(rig,shot.launchMs),part=rig.parts.find(p=>p.id===shot.part),start=partPoint(rig,launch,part,shot.originPoint||rig.emission.origins[shot.origin]),end=sourcePoint(rig,shot.target),phase=(time-shot.launchMs)/(shot.impactMs-shot.launchMs),point=[start[0]+(end[0]-start[0])*phase,start[1]+(end[1]-start[1])*phase+Math.sin(phase*Math.PI)*shot.arc/rig.scale],angle=Math.atan2(end[1]-start[1],end[0]-start[0]),grow=Math.min(1,.35+phase*3);
   drawEffect(ctx,rig,images[shot.effect==='impact'?'attack-impact':'attack-projectile'],point,shot.width*grow,angle,1);
  }
  impact(ctx,rig,images,time,shot.target,shot.impactMs,shot.impactMs+150,32);
 }
 const hit=rig.attackMotion.impact;if(hit)impact(ctx,rig,images,time,hit.target,hit.startMs,hit.endMs,hit.width);
}
