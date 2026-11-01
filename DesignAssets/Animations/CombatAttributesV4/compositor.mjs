const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function curve(value,keys){for(let i=1;i<keys.length;i++)if(value<=keys[i][0]){const a=keys[i-1],b=keys[i],t=clamp((value-a[0])/(b[0]-a[0]),0,1),s=t*t*(3-2*t);return a[1]+(b[1]-a[1])*s}return keys.at(-1)[1]}
function rotated(x,y,a){return[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]}
export function equipmentPose(rig,track,attributes,action,time,duration){
 if(!track.visible)return [];
 const span=rig.reference.span,has=key=>attributes.includes(key),p=clamp(time/Math.max(1,duration),0,.999),strike=action==='attack'?curve(p,[[0,0],[.18,-.22],[.30,1],[.48,.55],[.86,0],[1,0]]):0;
 const brace=action==='hurt'?curve(time,[[0,.4],[20,1],[80,.75],[110,.7],[510,.7],[600,.25],[760,0]]):0,impact=action==='hurt'?curve(time,[[0,0],[20,.25],[50,1],[110,.25],[510,.25],[760,0]]):0;
 const heal=action==='heal'?Math.sin(p*Math.PI*4):0,death=action==='death'?curve(p,[[0,0],[.2,0],[.88,1],[1,1]]):0;
 const collapse=action==='death'?clamp(1-track.body[3]/Math.max(1,rig.reference.body[3]),0,.8)/.8:0,parts=[];
 function add(id){
  const mount=rig.mounts[id],pose=track.mounts[id];if(!pose)throw new Error('Missing animated attachment '+id);
  const scale=pose.growth,item={id,name:mount.part,x:pose.x,y:pose.y,width:mount.width*scale,pivot:mount.pivot,angle:mount.angle+pose.angle+pose.lag,projection:1,bend:pose.bend*mount.flex,front:true};
  if(id==='blade'){const d=rotated(strike*span*.12*scale,0,pose.angle);item.x+=d[0];item.y+=d[1];item.angle+=strike*1.65;item.bend+=strike*mount.flex*.12}
  if(id==='piercing'){const d=rotated(strike*span*.22*scale,0,pose.angle);item.x+=d[0];item.y+=d[1];item.angle-=strike*.12}
  if(id==='guard'){const d=rotated((brace*.08-impact*.045)*span*scale,(-brace*.11+impact*.025)*span*scale,pose.angle);item.x+=d[0];item.y+=d[1];item.angle+=-brace*.22+impact*.13}
  if(id==='bud'){item.angle+=heal*.06;item.bend+=heal*.07*mount.flex}
  if(id==='tendril')item.bend+=heal*.12*mount.flex;
  if(death){
   if(id==='piercing')item.angle*=1-death;
   if(id==='blade')item.angle=item.angle*(1-death)+Math.PI*.46*death;
   if(id.startsWith('armor-')||id==='guard'){item.angle*=1-collapse*death;item.projection=Math.cos(collapse*death*1.35)}
   const image=rig.parts[item.name],height=item.width*image.height/image.width*item.projection,bounds=image.bounds||[0,0,image.width,image.height],s=item.width/image.width;
   const points=[[bounds[0],bounds[1]],[bounds[0]+bounds[2],bounds[1]],[bounds[0]+bounds[2],bounds[1]+bounds[3]],[bounds[0],bounds[1]+bounds[3]]].map(([u,v])=>{const q=rotated((u-image.width*item.pivot[0])*s,(v-image.height*item.pivot[1])*s*item.projection,item.angle);return[item.x+q[0],item.y+q[1]]});
   item.y-=Math.max(0,Math.max(...points.map(q=>q[1]))-(track.bounds[1]+track.bounds[3]+2))*death;
  }
  parts.push(item);
 }
 if(has('carapace'))for(const id of rig.armorPanels)add(id);
 if(has('regeneration')){add('tendril');add('bud')}
 if(has('blade'))add('blade');if(has('piercing'))add('piercing');if(has('guard'))add('guard');
 return parts;
}
function triangle(context,image,uv,points){
 const [a,b,c]=uv,[p,q,r]=points,det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(det)<.00001)return;
 const xx=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/det,xy=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/det,yx=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/det,yy=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/det;
 const center=points.reduce((p,q)=>[p[0]+q[0]/3,p[1]+q[1]/3],[0,0]);context.save();context.beginPath();for(let i=0;i<3;i++){const dx=points[i][0]-center[0],dy=points[i][1]-center[1],d=Math.hypot(dx,dy)||1,x=points[i][0]+dx/d*.18,y=points[i][1]+dy/d*.18;i?context.lineTo(x,y):context.moveTo(x,y)}context.closePath();context.clip();context.transform(xx,yx,xy,yy,p[0]-xx*a[0]-xy*a[1],p[1]-yx*a[0]-yy*a[1]);context.drawImage(image,0,0);context.restore();
}
function deform(mesh,bend){
 const bind=mesh.joints,first=bind[0],a=bend*.65,b=bend*.35,second=[bind[1][0],bind[1][1]],d=rotated(bind[2][0]-bind[1][0],bind[2][1]-bind[1][1],a),third=[second[0]+d[0],second[1]+d[1]],positions=[first,second,third],angles=[0,a,a+b];
 return mesh.vertices.map(vertex=>{let x=0,y=0;for(let i=0;i<3;i++){const d=rotated(vertex.uv[0]-bind[i][0],vertex.uv[1]-bind[i][1],angles[i]);x+=(positions[i][0]+d[0])*vertex.weights[i];y+=(positions[i][1]+d[1])*vertex.weights[i]}return[x,y]});
}
function drawPart(context,images,rig,item){
 const image=images[item.name],scale=item.width/image.width,part=rig.parts[item.name];context.save();context.translate(item.x,item.y);context.rotate(item.angle);context.scale(scale,scale*item.projection);context.translate(-image.width*item.pivot[0],-image.height*item.pivot[1]);
 if(part.skin){const points=deform(part.skin,item.bend);for(const indices of part.skin.triangles)triangle(context,image,indices.map(i=>part.skin.vertices[i].uv),indices.map(i=>points[i]))}else context.drawImage(image,0,0);
 context.restore();
}
export function renderCombatFrame(context,body,rig,images,track,attributes,action,time,duration,fit){
 const parts=equipmentPose(rig,track,attributes,action,time,duration),growth=1+attributes.length*.1;context.save();
 if(action==='birth'){const box=track.body,cx=box[0]+box[2]*.5,cy=box[1]+box[3];context.translate(cx,cy);context.scale(growth,growth);context.translate(-cx,-cy)}else{context.translate(fit.x,fit.y);context.scale(fit.scale*growth,fit.scale*growth);context.translate(-128,-224)}
 context.drawImage(body,0,0);
 for(const item of parts){
  if(item.id.startsWith('armor-')){const box=rig.reference.body,ref=rig.bindingReference.body,body=track.binding.body,sx=body[2]/ref[2],sy=body[3]/ref[3],a=track.binding.angle,dx=(box[0]+box[2]*.5-ref[0])*sx,dy=(box[1]+box[3]*.48-ref[1])*sy;context.save();context.beginPath();context.rect(-512,-512,1536,1536);context.ellipse(body[0]+dx*Math.cos(a)-dy*Math.sin(a),body[1]+dx*Math.sin(a)+dy*Math.cos(a),box[2]*.38*sx,box[3]*.42*sy,a,0,Math.PI*2);context.clip('evenodd');drawPart(context,images,rig,item);context.restore()}else drawPart(context,images,rig,item);
 }
 context.restore();return parts;
}
