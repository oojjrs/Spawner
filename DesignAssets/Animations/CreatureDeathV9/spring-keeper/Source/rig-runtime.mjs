import * as THREE from './Vendor/three.module.js';
import {GLTFExporter} from './Vendor/GLTFExporter.js';
const rig=await (await fetch('./rig.json')).json();
const canvas=document.querySelector('canvas');
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});
renderer.setSize(576,576,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);
const scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(-288,288,480,-96,.1,1000);camera.position.z=100;
const bones=new Map();const indices=new Map();const rest=new Map();
for(const [index,data] of rig.bones.entries()){
 const bone=new THREE.Bone();bone.name=data.name;
 const world=new THREE.Vector3(data.point[0]-288,480-data.point[1],0);
 const parent=data.parent?bones.get(data.parent):null;
 if(parent){parent.add(bone);bone.position.copy(world).sub(rest.get(data.parent));}else scene.add(bone);
 bones.set(data.name,bone);indices.set(data.name,index);rest.set(data.name,world);
}
scene.updateMatrixWorld(true);
const skeleton=new THREE.Skeleton([...bones.values()]);skeleton.calculateInverses();
const textures=new Map();const meshes=new Map();const loader=new THREE.TextureLoader();
async function makeAttachment(attachment){
 const positions=[];const uv=[];const skinIndices=[];const skinWeights=[];
 for(const [index,point] of attachment.vertices.entries()){
  positions.push(point[0]-288,480-point[1],attachment.order*.005);uv.push(...(attachment.uvs?attachment.uvs[index]:[point[0]/576,1-point[1]/576]));
  const links=attachment.weights[index];
  for(let j=0;j<4;j++){skinIndices.push(j<links.length?indices.get(links[j][0]):0);skinWeights.push(j<links.length?links[j][1]:0);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));geometry.setIndex(attachment.triangles.flat());
 const texture=await loader.loadAsync('./'+attachment.image);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:1,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=attachment.name+'-key-'+(attachment.sourceKey||0);mesh.bindMode=THREE.DetachedBindMode;mesh.bind(skeleton,new THREE.Matrix4());mesh.renderOrder=attachment.order;mesh.frustumCulled=false;scene.add(mesh);return mesh;
}
const variants=new Map();
for(const attachment of rig.attachments){const mesh=await makeAttachment(attachment);textures.set(attachment.name,mesh.material.map);meshes.set(attachment.name,mesh);variants.set(attachment.name,[{key:0,mesh}]);}
const useVariants=!new URLSearchParams(location.search).has('base');
if(useVariants){const data=await (await fetch('./variants.json')).json();for(const [name,list] of Object.entries(data.variants))for(const attachment of list.slice(1)){const mesh=await makeAttachment(attachment);mesh.visible=false;variants.get(name).push({key:attachment.sourceKey,mesh});}}
function showBase(){for(const list of variants.values())for(const entry of list)entry.mesh.visible=entry.key===0;}
function selectAttachments(time){
 if(!useVariants)return;
 const keys=motion.timesMs;let selected=0;for(let i=1;i<keys.length;i++)if(Math.abs(keys[i]-time)<Math.abs(keys[selected]-time))selected=i;const source=selected+3;
 for(const [name,list] of variants){const key=source;for(const entry of list)entry.mesh.visible=entry.key===key;}
}
const closed=await loader.loadAsync('./Parts/head-closed.png');closed.colorSpace=THREE.SRGBColorSpace;closed.minFilter=THREE.LinearFilter;closed.magFilter=THREE.LinearFilter;closed.generateMipmaps=false;
const helper=new THREE.SkeletonHelper(bones.get('root'));helper.renderOrder=100000;helper.material.depthTest=false;helper.visible=false;scene.add(helper);
const helperColors=helper.geometry.getAttribute('color');let helperIndex=0;
for(const bone of helper.bones){if(!bone.parent?.isBone)continue;const color=bone.name.startsWith('crest-0-')?[0,1,1]:[.08,.13,.1];for(let j=0;j<2;j++)helperColors.setXYZ(helperIndex++,...color);}helperColors.needsUpdate=true;
const bind=new Map([...bones].map(([name,bone])=>[name,{position:bone.position.clone(),quaternion:bone.quaternion.clone(),scale:bone.scale.clone()}]));
function reset(){showBase();for(const [name,bone] of bones){const original=bind.get(name);bone.position.copy(original.position);bone.quaternion.copy(original.quaternion);bone.scale.copy(original.scale);}meshes.get('head').material.map=textures.get('head');}
function draw(showBones){helper.visible=showBones;scene.updateMatrixWorld(true);renderer.render(scene,camera);}
function snapshot(){return Object.fromEntries([...bones].map(([name,bone])=>[name,Array.from(bone.matrixWorld.elements)]));}
window.captureBone=(name,degrees,showBones)=>{reset();bones.get(name).rotation.z=-degrees*Math.PI/180;draw(showBones);return {data:canvas.toDataURL('image/png').split(',')[1],bones:snapshot()};};
window.captureBind=showBones=>{reset();draw(showBones);return canvas.toDataURL('image/png').split(',')[1];};
window.rigInfo={runtime:'Three.js r'+THREE.REVISION,boneCount:bones.size,attachmentCount:meshes.size,variantCount:[...variants.values()].reduce((n,list)=>n+list.length,0),attachments:rig.attachments.map(a=>({name:a.name,bones:a.bones,vertexCount:a.vertices.length}))};
window.exportBind=async()=>{reset();draw(false);const buffer=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob([buffer]));});};
const motion=await (await fetch('./motion.json')).json();
function sample(values,time){
 const times=motion.timesMs;if(time<=times[0])return [...values[0]];if(time>=times.at(-1))return [...values.at(-1)];
 let index=0;while(times[index+1]<time)index++;
 const spans=times.slice(1).map((v,i)=>v-times[i]);const slopes=values.map(v=>v.map(()=>0));
 for(let i=1;i<values.length-1;i++)for(let j=0;j<values[i].length;j++){
  const a=(values[i][j]-values[i-1][j])/spans[i-1],b=(values[i+1][j]-values[i][j])/spans[i];if(a*b<=0)continue;
  const w1=2*spans[i]+spans[i-1],w2=spans[i]+2*spans[i-1];slopes[i][j]=(w1+w2)/(w1/a+w2/b);
 }
 const h=spans[index],u=(time-times[index])/h;return values[index].map((v,j)=>(2*u**3-3*u*u+1)*v+(u**3-2*u*u+u)*h*slopes[index][j]+(-2*u**3+3*u*u)*values[index+1][j]+(u**3-u*u)*h*slopes[index+1][j]);
}
const localKeys=new Map();
for(const data of rig.bones){
 const values=motion.keys.map(key=>{
  const state=key.bones[data.name];const matrix=new THREE.Matrix4().makeRotationZ(-state.angle*Math.PI/180);matrix.setPosition(state.point[0]-288,480-state.point[1],0);
  if(data.parent){const parent=key.bones[data.parent];const parentMatrix=new THREE.Matrix4().makeRotationZ(-parent.angle*Math.PI/180);parentMatrix.setPosition(parent.point[0]-288,480-parent.point[1],0);matrix.premultiply(parentMatrix.invert());}
  return [matrix.elements[12],matrix.elements[13],Math.atan2(matrix.elements[1],matrix.elements[0])];
 });
 for(let i=1;i<values.length;i++){while(values[i][2]-values[i-1][2]>Math.PI)values[i][2]-=2*Math.PI;while(values[i][2]-values[i-1][2]<-Math.PI)values[i][2]+=2*Math.PI;}localKeys.set(data.name,values);
}
function worldStates(time){
 const result=new Map();for(const data of rig.bones){const pose=sample(localKeys.get(data.name),time);const matrix=new THREE.Matrix4().makeRotationZ(pose[2]);matrix.setPosition(pose[0],pose[1],0);if(data.parent)matrix.premultiply(result.get(data.parent));result.set(data.name,matrix);}if(time>=650){const offset=Math.round(result.get('body').elements[13])-result.get('body').elements[13];for(const [name,matrix] of result)if(name!=='root')matrix.elements[13]+=offset;}return result;
}
function poseDeath(time){
 reset();const world=worldStates(time);
 for(const data of rig.bones){const local=data.parent?world.get(data.parent).clone().invert().multiply(world.get(data.name)):world.get(data.name);local.decompose(bones.get(data.name).position,bones.get(data.name).quaternion,bones.get(data.name).scale);}
 if(time>=100)meshes.get('head').material.map=closed;
 selectAttachments(time);if(time>650&&time<1125){const a=time<925?650:925,b=time<925?925:1125,u=(time-a)/(b-a),strength=Math.sin(Math.PI*u)*(time<925?1:.35);for(const [name,degrees] of [['tail-0-bone-3',1.4],['tail-2-bone-3',1.0],['tail-3-bone-3',.7],['tail-6-bone-2',.5]])bones.get(name).rotation.z-=degrees*strength*Math.PI/180;}scene.updateMatrixWorld(true);return world;
}
window.captureDeath=(time,showBones)=>{poseDeath(time);draw(showBones);return {data:canvas.toDataURL('image/png').split(',')[1],bones:snapshot()};};
window.capturePart=(name,time)=>{
 poseDeath(time);for(const [key,mesh] of meshes)mesh.visible=key===name;draw(false);const data=canvas.toDataURL('image/png').split(',')[1];for(const mesh of meshes.values())mesh.visible=true;return data;
};
const fieldMaterials=new Map();const palettes=new Map();
for(const [index,a] of rig.attachments.entries()){
 const rgb=[60+index%4*60,60+Math.floor(index/4)%4*60,60+Math.floor(index/16)%4*60];palettes.set(a.name,rgb);
 const source=textures.get(a.name).image;const temp=document.createElement('canvas');temp.width=576;temp.height=576;const ctx=temp.getContext('2d');ctx.drawImage(source,0,0);const data=ctx.getImageData(0,0,576,576);for(let j=0;j<data.data.length;j+=4){const alpha=data.data[j+3];data.data[j]=data.data[j+1]=data.data[j+2]=alpha;data.data[j+3]=255;}ctx.putImageData(data,0,0);const alphaTexture=new THREE.CanvasTexture(temp);alphaTexture.colorSpace=THREE.NoColorSpace;alphaTexture.minFilter=THREE.LinearFilter;alphaTexture.magFilter=THREE.LinearFilter;alphaTexture.generateMipmaps=false;const color=new THREE.Color().setRGB(...rgb.map(v=>v/255),THREE.SRGBColorSpace);fieldMaterials.set(a.name,new THREE.MeshBasicMaterial({color,alphaMap:alphaTexture,transparent:true,opacity:1,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
}
window.captureField=time=>{
 poseDeath(time);const originals=new Map();for(const [name,mesh] of meshes){originals.set(name,mesh.material);mesh.material=fieldMaterials.get(name);}draw(false);const data=canvas.toDataURL('image/png').split(',')[1];for(const [name,mesh] of meshes)mesh.material=originals.get(name);return {data,bones:snapshot(),palette:Object.fromEntries(palettes)};
};
window.ready=true;
