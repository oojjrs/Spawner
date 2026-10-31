import * as THREE from './Vendor/three.module.js';
import {GLTFExporter} from './Vendor/GLTFExporter.js';
const rig=await (await fetch('./rig.json')).json();
const motion=await (await fetch('./motion.json')).json();
const canvas=document.querySelector('canvas');
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});renderer.setSize(576,576,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);
const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-288,288,480,-96,.1,1000);camera.position.z=100;
const bones=new Map(),indices=new Map(),bindWorld=new Map();
function worldMatrix(point,angle){const m=new THREE.Matrix4().makeRotationZ(-angle*Math.PI/180);m.setPosition(point[0]-288,480-point[1],0);return m;}
for(const [i,data] of rig.bones.entries()){
 const bone=new THREE.Bone();bone.name=data.name;const world=worldMatrix(data.point,data.angle),local=data.parent?bindWorld.get(data.parent).clone().invert().multiply(world):world;
 local.decompose(bone.position,bone.quaternion,bone.scale);if(data.parent)bones.get(data.parent).add(bone);else scene.add(bone);bones.set(data.name,bone);indices.set(data.name,i);bindWorld.set(data.name,world);
}
scene.updateMatrixWorld(true);const skeleton=new THREE.Skeleton([...bones.values()]);skeleton.calculateInverses();const loader=new THREE.TextureLoader();const meshes=new Map();
for(const a of rig.attachments){
 const position=[],uv=[],ids=[],weights=[];
 for(const [i,p] of a.vertices.entries()){position.push(p[0]-288,480-p[1],a.order*.001);uv.push(p[0]/576,1-p[1]/576);const links=a.weights[i];for(let j=0;j<4;j++){ids.push(j<links.length?indices.get(links[j][0]):0);weights.push(j<links.length?links[j][1]:0);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setIndex(a.triangles.flat());
 const texture=await loader.loadAsync('./'+a.image);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:1,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false});const mesh=new THREE.SkinnedMesh(g,material);mesh.name=a.name;mesh.bindMode=THREE.DetachedBindMode;mesh.bind(skeleton,new THREE.Matrix4());mesh.renderOrder=a.order;mesh.frustumCulled=false;scene.add(mesh);meshes.set(a.name,mesh);
}
const headOpen=meshes.get('head').material.map;const headClosed=await loader.loadAsync('./Parts/head-closed.png');headClosed.colorSpace=THREE.SRGBColorSpace;headClosed.generateMipmaps=false;headClosed.minFilter=headClosed.magFilter=THREE.LinearFilter;
const helper=new THREE.SkeletonHelper(bones.get('root'));helper.renderOrder=10000;helper.material.depthTest=false;helper.visible=false;scene.add(helper);
const bind=new Map([...bones].map(([name,b])=>[name,{position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}]));
const parts=new Map(rig.attachments.map(a=>[a.name,a]));const defs=new Map(rig.bones.map(b=>[b.name,b]));
const rotate=(p,a)=>{const r=a*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return [p[0]*c-p[1]*s,p[0]*s+p[1]*c];};
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];const length=p=>Math.hypot(...p);const angle=p=>Math.atan2(p[1],p[0])*180/Math.PI;
const wrap=a=>{while(a>180)a-=360;while(a< -180)a+=360;return a;};
const ease=u=>{u=Math.max(0,Math.min(1,u));return u*u*u*(u*(u*6-15)+10);};const phase=(t,a,b)=>ease((t-a)/(b-a));
function keyed(keys,t){let i=0;while(i<keys.length-2&&t>keys[i+1].timeMs)i++;if(t<=keys[0].timeMs)return {...keys[0],point:[...keys[0].point]};if(t>=keys.at(-1).timeMs)return {...keys.at(-1),point:[...keys.at(-1).point]};const a=keys[i],b=keys[i+1],u=phase(t,a.timeMs,b.timeMs);return {point:a.point.map((v,j)=>v+(b.point[j]-v)*u),angle:a.angle+(b.angle-a.angle)*u};}
function ik(root,target,l1,l2,side){const d=sub(target,root),distance=Math.max(1e-8,length(d)),reach=Math.min(l1+l2-1e-7,Math.max(Math.abs(l1-l2)+1e-7,distance)),unit=d.map(v=>v/distance),c=Math.max(-1,Math.min(1,(l1*l1+reach*reach-l2*l2)/(2*l1*reach))),s=Math.sqrt(Math.max(0,1-c*c))*side;return {joint:add(root,[l1*(unit[0]*c-unit[1]*s),l1*(unit[1]*c+unit[0]*s)]),end:add(root,unit.map(v=>v*reach))};}
const neckLengths=rig.neck.slice(1).map((p,i)=>length(sub(p,rig.neck[i])));
const petalAnchors=new Map();
for(const a of rig.attachments.filter(a=>a.kind==='petal')){
 const point=a.chain[0];let best=null;
 for(let i=0;i<2;i++){const start=rig.neck[i],d=sub(rig.neck[i+1],start),l=length(d),u=Math.max(0,Math.min(1,(sub(point,start)[0]*d[0]+sub(point,start)[1]*d[1])/(l*l))),project=add(start,d.map(v=>v*u)),offset=sub(point,project),distance=length(offset);if(!best||distance<best.distance)best={segment:i,u,offset,distance,angle:angle(d)};}
 petalAnchors.set(a.name,best);
}
function reset(){for(const [name,b] of bones){const a=bind.get(name);b.position.copy(a.position);b.quaternion.copy(a.quaternion);b.scale.copy(a.scale);}meshes.get('head').material.map=headOpen;}
function pose(t){
 reset();const worlds=new Map();
 function setWorld(name,point,degrees){const m=worldMatrix(point,degrees),parent=defs.get(name).parent,local=parent?worlds.get(parent).clone().invert().multiply(m):m;local.decompose(bones.get(name).position,bones.get(name).quaternion,bones.get(name).scale);worlds.set(name,m);}
 setWorld('root',[288,480],0);const body=keyed(motion.bodyKeys,t),head=keyed(motion.headKeys,t);setWorld('body',body.point,body.angle);
 const nk=ik(body.point,head.point,neckLengths[0],neckLengths[1],1);const currentNeck=[body.point,nk.joint,nk.end];setWorld('neck-0',body.point,angle(sub(nk.joint,body.point)));setWorld('neck-1',nk.joint,angle(sub(nk.end,nk.joint)));setWorld('head',nk.end,head.angle);
 const bodyPoint=p=>add(body.point,rotate(sub(p,[258,410]),body.angle));const w=bodyPoint([268,350]);setWorld('wing',w,body.angle-8*phase(t,250,650));
 for(const side of ['far','near']){
  const chain=side==='far'?[[218,432],[214,442],[198,449]]:[[264,434],[263,448],[258,458]],root=bodyPoint(chain[0]),target=add(chain[2],[body.point[0]-258,Math.min(10,body.point[1]-410)]),a=ik(root,target,length(sub(chain[1],chain[0])),length(sub(chain[2],chain[1])),-1);
  setWorld(side+'-leg-0',root,angle(sub(a.joint,root)));setWorld(side+'-leg-1',a.joint,angle(sub(a.end,a.joint)));setWorld(side+'-foot',a.end,(side==='far'?40:30)*phase(t,300,650));
 }
 const tailPoint=bodyPoint([316,396]);setWorld('tail-base',tailPoint,motion.tailBaseAngle*phase(t,280,740));
 for(const entry of motion.crestHinges){const b=bones.get(entry.name),original=bind.get(entry.name);b.position.copy(original.position);b.quaternion.copy(original.quaternion);b.rotation.z-=entry.angle*phase(t,entry.startMs,entry.endMs)*Math.PI/180;b.scale.set(1,1,1);worlds.set(entry.name,worlds.get('head').clone().multiply(new THREE.Matrix4().compose(b.position,b.quaternion,b.scale)));}
 for(const entry of motion.crestFlex){const u=phase(t,entry.startMs,entry.endMs);for(let i=0;i<entry.bones.length;i++)bones.get(entry.bones[i]).rotation.z-=entry.deltas[i]*u*Math.PI/180;}
 for(const entry of motion.tailBlades){
  const a=parts.get(entry.name),u=phase(t,entry.startMs,entry.endMs),start=sub(a.pivot,[258,410]),end=rotate(sub(entry.pivot,[294,446]),-5),local=start.map((v,i)=>v+(end[i]-v)*u),target=add(body.point,rotate(local,body.angle)),result=ik(tailPoint,target,a.stemLengths[0],a.stemLengths[1],-1);
  setWorld(a.bones[0],tailPoint,angle(sub(result.joint,tailPoint)));setWorld(a.bones[1],result.joint,angle(sub(result.end,result.joint)));setWorld(a.bones[2],result.end,body.angle*(1-u)+entry.angle*u);
 }
 const back=keyed(motion.backCollarKeys,t);setWorld('back-collar',back.point,back.angle);const collar=keyed(motion.collarKeys,t);setWorld('collar',collar.point,collar.angle);

 if(t>=motion.closedEyeMs)meshes.get('head').material.map=headClosed;scene.updateMatrixWorld(true);
}
function draw(showBones){helper.visible=showBones;scene.updateMatrixWorld(true);renderer.render(scene,camera);}
function capture(){return {data:canvas.toDataURL('image/png').split(',')[1],bones:Object.fromEntries([...bones].map(([name,b])=>[name,Array.from(b.matrixWorld.elements)]))};}
window.captureBind=showBones=>{reset();draw(showBones);return capture();};
window.captureDeath=(time,showBones)=>{pose(time);draw(showBones);return capture();};
window.captureBone=(name,degrees,showBones)=>{reset();bones.get(name).rotation.z-=degrees*Math.PI/180;draw(showBones);return capture();};
window.exportBind=async()=>{reset();draw(false);const data=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob([data]));});};
window.rigInfo={runtime:'Three.js r'+THREE.REVISION,boneCount:bones.size,attachmentCount:meshes.size,animatedTextureChanges:['head:open-to-closed'],attachments:rig.attachments.map(a=>({name:a.name,bones:a.bones,kind:a.kind}))};
window.capturePart=(name,time)=>{pose(time);for(const [key,mesh] of meshes)mesh.visible=key===name;draw(false);const result=capture();for(const mesh of meshes.values())mesh.visible=true;return result;};
window.ready=true;
