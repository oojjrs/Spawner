import {mapBinding} from '../CombatAttributesV4/motion.mjs';
const rotate=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
function bezier(points,t){const s=1-t;return[points[0][0]*s*s*s+3*points[1][0]*s*s*t+3*points[2][0]*s*t*t+points[3][0]*t*t*t,points[0][1]*s*s*s+3*points[1][1]*s*s*t+3*points[2][1]*s*t*t+points[3][1]*t*t*t]}
function tangent(points,t){const s=1-t;return[3*s*s*(points[1][0]-points[0][0])+6*s*t*(points[2][0]-points[1][0])+3*t*t*(points[3][0]-points[2][0]),3*s*s*(points[1][1]-points[0][1])+6*s*t*(points[2][1]-points[1][1])+3*t*t*(points[3][1]-points[2][1])]}
export function regenerationPose(rig,track,action,time,duration){
 if(!track.visible)return null;
 const spec=rig.regeneration,frame=track.binding,ref=rig.bindingReference.body,root=mapBinding(ref,frame.body,spec.bind,frame.angle),growth=track.mounts.bud.growth,scale=spec.width/rig.parts.pouch.width*growth;
 const lag=track.mounts.bud.lag*.2,death=action==='death'?Math.min(1,time/Math.max(1,duration))*.25:0,angle=frame.angle+lag-death,pivot=spec.pivot,outlet=rotate((spec.outlet[0]-pivot[0])*scale,(spec.outlet[1]-pivot[1])*scale,angle),start=[root.x+outlet[0],root.y+outlet[1]],tubeScale=spec.tubeScale*growth,length=rig.parts['healing-tube'].height*tubeScale,follow=track.mounts.tendril.lag,active=action==='heal'?Math.sin(time/duration*Math.PI*8):0;
 const tail=rotate(length*(-.18+follow*.6),length*.65,angle+follow*.5),tip=[start[0]+tail[0],start[1]+tail[1]],a=rotate((follow+active*.025)*length*.3,length*.30,angle),b=rotate(length*.18+follow*length*.12,-length*.12,angle),points=[start,[start[0]+a[0],start[1]+a[1]],[tip[0]+b[0],tip[1]+b[1]],tip];
 return{root:[root.x,root.y],scale,angle,pivot,start,points,tubeScale,phase:time/Math.max(1,duration)*4%1};
}
export function drawPouch(context,rig,images,pose){context.save();context.translate(...pose.root);context.rotate(pose.angle);context.scale(pose.scale,pose.scale);context.drawImage(images.pouch,-pose.pivot[0],-pose.pivot[1]);context.restore()}
function triangle(context,image,uv,points){
 const[a,b,c]=uv,[p,q,r]=points,det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(det)<.00001)return;
 const xx=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/det,xy=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/det,yx=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/det,yy=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/det,centre=points.reduce((p,q)=>[p[0]+q[0]/3,p[1]+q[1]/3],[0,0]);
 context.save();context.beginPath();points.forEach((p,i)=>{const x=p[0]-centre[0],y=p[1]-centre[1],d=Math.hypot(x,y)||1,q=[p[0]+x/d*.15,p[1]+y/d*.15];i?context.lineTo(...q):context.moveTo(...q)});context.closePath();context.clip();context.transform(xx,yx,xy,yy,p[0]-xx*a[0]-xy*a[1],p[1]-yx*a[0]-yy*a[1]);context.drawImage(image,0,0);context.restore();
}
export function drawHealingTube(context,rig,images,pose,action){
 const part=rig.parts['healing-tube'],skin=part.skin,nodes=skin.joints.map((joint,i)=>{const t=skin.positions[i],point=bezier(pose.points,t),axis=tangent(pose.points,t);return{point,angle:Math.atan2(axis[1],axis[0])-joint.angle}}),vertices=skin.vertices.map(vertex=>{let x=0,y=0;for(let i=0;i<nodes.length;i++){const joint=skin.joints[i],node=nodes[i],p=rotate((vertex.uv[0]-joint.x)*pose.tubeScale,(vertex.uv[1]-joint.y)*pose.tubeScale,node.angle);x+=(node.point[0]+p[0])*vertex.weights[i];y+=(node.point[1]+p[1])*vertex.weights[i]}return[x,y]});
 for(const indices of skin.triangles)triangle(context,images['healing-tube'],indices.map(i=>skin.vertices[i].uv),indices.map(i=>vertices[i]));
 if(action==='heal'){const point=bezier(pose.points,pose.phase);context.save();context.globalCompositeOperation='screen';context.globalAlpha=Math.sin(pose.phase*Math.PI)*.85;context.fillStyle='#fff2a5';context.beginPath();context.arc(point[0],point[1],Math.max(.7,pose.tubeScale*part.inletWidth*.22),0,Math.PI*2);context.fill();context.restore()}
}
