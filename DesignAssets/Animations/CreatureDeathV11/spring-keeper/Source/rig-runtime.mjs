import * as THREE from './Vendor/three.module.js';
const rig=await (await fetch('./rig.json')).json();
const canvas=document.querySelector('canvas');
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});
renderer.setSize(576,576,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);
const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-288,288,480,-96,.1,1000);camera.position.z=100;
const loader=new THREE.TextureLoader();const textures=new Map();
async function texture(file){if(!textures.has(file)){const map=await loader.loadAsync('./'+file);map.colorSpace=THREE.SRGBColorSpace;map.minFilter=map.magFilter=THREE.LinearFilter;map.generateMipmaps=false;textures.set(file,map);}return textures.get(file);}
function matrix(point,angle){const m=new THREE.Matrix4().makeRotationZ(-angle*Math.PI/180);m.setPosition(point[0]-288,480-point[1],0);return m;}
function localStates(defs){const worlds=new Map(defs.map(b=>[b.name,matrix(b.point,b.angle)]));return defs.map(b=>{const m=b.parent?worlds.get(b.parent).clone().invert().multiply(worlds.get(b.name)):worlds.get(b.name);return {x:m.elements[12],y:m.elements[13],angle:Math.atan2(m.elements[1],m.elements[0])};});}
function weightsAt(point,chain,ids){
 if(ids.length===1)return [[ids[0],1]];
 let best=Infinity,along=0,total=0;const lengths=[];
 for(let i=0;i<chain.length-1;i++){const a=chain[i],b=chain[i+1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);lengths.push(length);const u=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/Math.max(length*length,1e-9)));const distance=Math.hypot(point[0]-a[0]-u*dx,point[1]-a[1]-u*dy);if(distance<best){best=distance;along=total+u*length;}total+=length;}
 const mids=[];total=0;for(const length of lengths){mids.push(total+length/2);total+=length;}let index=0;while(index<mids.length&&mids[index]<along)index++;
 if(index===0)return [[ids[0],1]];if(index>=ids.length)return [[ids.at(-1),1]];const u=(along-mids[index-1])/Math.max(mids[index]-mids[index-1],1e-9);return [[ids[index-1],1-u],[ids[index],u]];
}
async function makePair(plan){
 const group=new THREE.Group();group.visible=false;scene.add(group);const bones=new Map(),worlds=new Map();const ids=new Map(plan.bonesA.map((b,i)=>[b.name,i]));const endWorlds=new Map(plan.bonesB.map(b=>[b.name,matrix(b.point,b.angle)]));
 for(const data of plan.bonesA){const bone=new THREE.Bone();bone.name=data.name;const world=matrix(data.point,data.angle);const local=data.parent?worlds.get(data.parent).clone().invert().multiply(world):world;local.decompose(bone.position,bone.quaternion,bone.scale);if(data.parent)bones.get(data.parent).add(bone);else group.add(bone);worlds.set(data.name,world);bones.set(data.name,bone);}
 scene.updateMatrixWorld(true);const skeleton=new THREE.Skeleton([...bones.values()]);skeleton.calculateInverses();const attachments=[];
 for(const data of plan.attachments){const views=[];
  for(const end of [false,true]){
   const bounds=end?data.boundsB:data.boundsA;if(!bounds){views.push(null);continue;}
   const transform=end?endWorlds.get(data.bones[0]).clone().multiply(worlds.get(data.bones[0]).clone().invert()).invert():new THREE.Matrix4();
   const box=[bounds[0]-2,bounds[1]-2,bounds[2]+2,bounds[3]+2];const columns=data.bones.length===1?1:Math.ceil((box[2]-box[0])/5);const rows=data.bones.length===1?1:Math.ceil((box[3]-box[1])/5);const position=[],uv=[],index=[],weight=[],triangles=[];
   for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){const px=box[0]+(box[2]-box[0])*x/columns,py=box[1]+(box[3]-box[1])*y/rows;const p=new THREE.Vector3(px-288,480-py,0).applyMatrix4(transform);position.push(p.x,p.y,data.order*.01);uv.push(px/576,1-py/576);const links=weightsAt([p.x+288,480-p.y],data.chain,data.bones);for(let j=0;j<4;j++){index.push(j<links.length?ids.get(links[j][0]):0);weight.push(j<links.length?links[j][1]:0);}if(x<columns&&y<rows){const i=y*(columns+1)+x;triangles.push(i,i+columns+1,i+1,i+1,i+columns+1,i+columns+2);}}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(index,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weight,4));geometry.setIndex(triangles);
   const material=new THREE.MeshBasicMaterial({map:await texture(end?data.imageB:data.imageA),transparent:true,opacity:1,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false});
   const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=data.name+(end?'-B':'-A');mesh.bindMode=THREE.DetachedBindMode;mesh.bind(skeleton,new THREE.Matrix4());mesh.renderOrder=data.order;mesh.frustumCulled=false;group.add(mesh);views.push(mesh);
  }
  attachments.push({data,views});
 }
 const a=localStates(plan.bonesA),b=localStates(plan.bonesB);for(let i=0;i<a.length;i++){while(b[i].angle-a[i].angle>Math.PI)b[i].angle-=Math.PI*2;while(b[i].angle-a[i].angle< -Math.PI)b[i].angle+=Math.PI*2;}
 return {plan,group,bones,skeleton,attachments,a,b};
}
const poses=[];for(const plan of rig.poses)poses.push(await makePair(plan));
function poseObject(pose){for(const item of poses)item.group.visible=false;pose.group.visible=true;let i=0;for(const bone of pose.bones.values()){const a=pose.a[i];bone.position.set(a.x,a.y,0);bone.rotation.set(0,0,a.angle);bone.scale.set(1,1,1);i++;}for(const a of pose.attachments)for(let j=0;j<a.views.length;j++)if(a.views[j])a.views[j].visible=j===0;scene.updateMatrixWorld(true);return pose;}
function capture(){renderer.render(scene,camera);return canvas.toDataURL('image/png').split(',')[1];}
window.captureDeath=time=>{let pose=poses[0];for(const item of poses)if(item.plan.timeMs<=time)pose=item;poseObject(pose);return capture();};
window.captureKey=index=>{poseObject(poses.find(pose=>pose.plan.timeMs===rig.timesMs[index]));return capture();};
window.captureBone=(index,name,degrees)=>{const pose=poseObject(poses[index]);pose.bones.get(name).rotation.z-=degrees*Math.PI/180;scene.updateMatrixWorld(true);return {data:capture(),bones:Object.fromEntries([...pose.bones].map(([key,b])=>[key,Array.from(b.matrixWorld.elements)]))};};
window.captureDrawnBone=(time,name,degrees)=>{const pose=poseObject(poses.find(pose=>pose.plan.timeMs===time));pose.bones.get(name).rotation.z-=degrees*Math.PI/180;scene.updateMatrixWorld(true);return {data:capture(),bones:Object.fromEntries([...pose.bones].map(([key,b])=>[key,Array.from(b.matrixWorld.elements)]))};};
window.rigInfo={runtime:'Three.js r'+THREE.REVISION,keyposeTimesMs:rig.timesMs,partCount:rig.poses[0].attachments.length,poseCount:rig.poses.length,construction:rig.construction};
window.captureDeath(0);window.ready=true;