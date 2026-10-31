export const VARIANTS=[['blade'],['piercing'],['carapace'],['guard'],['regeneration'],['secretion'],['blade','carapace'],['piercing','guard'],['regeneration','secretion'],['blade','piercing','carapace'],['guard','carapace','regeneration'],['guard','regeneration','secretion']];
function curve(value,keys){for(let i=1;i<keys.length;i++)if(value<=keys[i][0]){const a=keys[i-1],b=keys[i],t=Math.max(0,Math.min(1,(value-a[0])/(b[0]-a[0]))),s=t*t*(3-2*t);return a[1]+(b[1]-a[1])*s}return keys.at(-1)[1]}
function triangle(context,image,uv,points){
 const [a,b,c]=uv,[p,q,r]=points,det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(det)<.00001)return;
 const xx=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/det,xy=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/det;
 const yx=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/det,yy=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/det;
 context.save();context.beginPath();points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.closePath();context.clip();context.transform(xx,yx,xy,yy,p[0]-xx*a[0]-xy*a[1],p[1]-yx*a[0]-yy*a[1]);context.drawImage(image,0,0);context.restore();
}
export function equipmentPose(rig,track,attributes,action,time,duration){
 if(!track.visible)return [];
 const has=key=>attributes.includes(key),box=track.body,reference=rig.reference,span=reference.span*(action==='birth'?box[2]/reference.body[2]:1),x=box[0],y=box[1],w=box[2],h=box[3],angle=track.angle;
 const p=Math.min(.999,Math.max(0,time/Math.max(1,duration))),strike=action==='attack'?curve(p,[[0,0],[.18,-.22],[.30,1],[.48,.55],[.86,0],[1,0]]):0;
 const brace=action==='hurt'?curve(time,[[0,.4],[20,1],[80,.75],[110,.7],[510,.7],[600,.25],[760,0]]):0;
 const impact=action==='hurt'?curve(time,[[0,0],[20,.25],[50,1],[110,.25],[510,.25],[760,0]]):0;
 const heal=action==='heal'?Math.sin(p*Math.PI*4):0,signal=action==='secretion'?Math.sin(p*Math.PI*6):0;
 const death=action==='death'?curve(p,[[0,0],[.2,0],[.88,1],[1,1]]):0,water=rig.tribe==='spring',parts=[];
 const collapse=action==='death'?Math.min(1,Math.max(0,(1-h/reference.body[3])/.65)):0;
 function add(name,px,py,width,pivotX,pivotY,rotation,bend,front){parts.push({name,x:px,y:py,width,pivot:[pivotX,pivotY],angle:rotation,bend,front,projection:1})}
 if(has('carapace'))add('armor',x+w*.5,y+h*.52,span*1.20,.5,.5,angle+(water?death*.65:0),0,true);
 if(has('regeneration')){
  add('tendril',x+w*.10,y+h*.4,span*.52,.72,.55,angle-.1,heal*.12,true);
  add('bud',x+w*.12,y+h*.02-heal*span*.025,span*.32,.5,.88,angle+heal*.06,0,true);
 }
 if(has('blade'))add('blade',x+w*.12+strike*span*.12,y+h*.72,span*.44,.67,.91,angle+strike*1.65-.12,0,true);
 if(has('piercing'))add('piercing',x+w*.83+strike*span*.22,y+h*.65,span*.78,.05,.52,angle-strike*.12,0,true);
 if(has('guard'))add('guard',x+w*.91+brace*span*.08-impact*span*.045,y+h*.58-brace*span*.11+impact*span*.025,span*.67,.42,.55,angle-brace*.22+impact*.13+(water?death*.8:0),0,true);
 if(has('secretion'))for(let i=0;i<3;i++)add('vent',x+w*.94,y+h*(.16+i*.25),span*.21,.1,.55,angle-.35+i*.23+signal*.07,0,true);
 for(const item of parts)if(death){
  if(item.name==='piercing')item.angle*=1-death;
  if(item.name==='blade')item.angle=item.angle*(1-death)+Math.PI*.46*death;
  if(item.name==='armor'||item.name==='guard'){item.angle*=1-collapse*death;item.projection=Math.cos(collapse*death*1.35)}
 }
 for(const item of parts){
  const part=rig.parts[item.name],height=item.width*part.height/part.width*item.projection;
  const bottom=Math.max(...[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>item.y+(u-item.pivot[0])*item.width*Math.sin(item.angle)+(v-item.pivot[1])*height*Math.cos(item.angle)));
  item.y-=Math.max(0,bottom-(track.bounds[1]+track.bounds[3]+2));
 }
 return parts;
}
function drawPart(context,images,item,rig){
 const image=images[item.name],scale=item.width/image.width,part=rig.parts[item.name];
 context.save();context.translate(item.x,item.y);context.rotate(item.angle);context.scale(scale,scale*item.projection);context.translate(-image.width*item.pivot[0],-image.height*item.pivot[1]);
 if(item.name==='tendril'&&Math.abs(item.bend)>.001){
  const mesh=part.mesh,pivot=mesh.pivot||[image.width*.72,image.height*.55],points=mesh.vertices.map(vertex=>{const uv=vertex.uv,weights=vertex.weights,dx=uv[0]-pivot[0],dy=uv[1]-pivot[1];let x=0,y=0;for(let i=0;i<3;i++){const a=item.bend*i*.5;x+=(pivot[0]+dx*Math.cos(a)-dy*Math.sin(a))*weights[i];y+=(pivot[1]+dx*Math.sin(a)+dy*Math.cos(a))*weights[i]}return [x,y]});
  for(const indices of mesh.triangles)triangle(context,image,indices.map(i=>mesh.vertices[i].uv),indices.map(i=>points[i]));
 }else context.drawImage(image,0,0);
 context.restore();
}
export function renderCombatFrame(context,body,rig,images,track,attributes,action,time,duration,fit){
 const parts=equipmentPose(rig,track,attributes,action,time,duration),growth=1+attributes.length*.1;
 if(action==='death')for(const item of parts){
  const image=images[item.name],height=item.width*image.height/image.width*item.projection,k=fit.scale*growth;
  const points=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{const x=(u-item.pivot[0])*item.width,y=(v-item.pivot[1])*height;return[fit.x+(item.x+x*Math.cos(item.angle)-y*Math.sin(item.angle)-128)*k,fit.y+(item.y+x*Math.sin(item.angle)+y*Math.cos(item.angle)-224)*k]});
  const left=Math.min(...points.map(p=>p[0])),right=Math.max(...points.map(p=>p[0])),top=Math.min(...points.map(p=>p[1])),bottom=Math.max(...points.map(p=>p[1]));
  item.x+=(Math.max(0,12.8-left)-Math.max(0,right-243.2))/k;item.y+=(Math.max(0,12.8-top)-Math.max(0,bottom-243.2))/k;
 }
 context.save();
 if(action==='birth'){
  const box=track.body,cx=box[0]+box[2]*.5,cy=box[1]+box[3];context.translate(cx,cy);context.scale(growth,growth);context.translate(-cx,-cy);
 }else{context.translate(fit.x,fit.y);context.scale(fit.scale*growth,fit.scale*growth);context.translate(-128,-224)}
 for(const item of parts)if(!item.front)drawPart(context,images,item,rig);
 context.drawImage(body,0,0);
 for(const item of parts)if(item.front){
  if(item.name==='armor'){
   const box=track.body;context.save();context.beginPath();context.rect(-512,-512,1536,1536);context.ellipse(box[0]+box[2]*.5,box[1]+box[3]*.48,box[2]*.38,box[3]*.42,track.angle,0,Math.PI*2);context.clip('evenodd');drawPart(context,images,item,rig);context.restore();
  }else drawPart(context,images,item,rig);
 }
 context.restore();
 return parts;
}
