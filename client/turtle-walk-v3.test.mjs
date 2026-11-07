import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {pathToFileURL, fileURLToPath} from 'node:url';
const root=process.env.TURTLE_REPO || fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const animationRoot=process.env.TURTLE_ANIMATION_ROOT || root;
const load=(base,file)=>import(pathToFileURL(`${base}/client/${file}`));
const animation=await load(animationRoot,'unit-animation.mjs');
const {imageFrameGeometry}=await load(root,'image-geometry.mjs');
const {creaturePresentationPose,drawCreaturePresentation}=await load(root,'creature-presentation.mjs');
const {welcomeTravelMotion}=await load(root,'welcome-presentation.mjs');
const a=animation.CREATURE_WALK_ANIMATIONS['vine-turtle'];
const old='DesignAssets/Animations/CreatureWalkV2/vine-turtle/walk.webp';
const expected='DesignAssets/Animations/CreatureWalkV3/vine-turtle/walk.webp';
const model={...animation,imageFrameGeometry};
const sprite={complete:true,naturalWidth:5120,naturalHeight:5120};
const resources={walk:new Map([['vine-turtle',{animation:a,sprite,scale:.52}]])};
const agent={species:'vine-turtle',health:10,mode:'walk',moveStartedAt:10,moveDuration:2.5,stepCount:1};
const near=(x,y)=>assert.ok(Math.abs(x-y)<1e-8,`${x} != ${y}`);
test('recovered native V3 registration and exact original source bytes',()=>{
 assert.equal(a.image,expected);assert.equal(a.frameSize,640);assert.equal(a.viewSize,512);assert.equal(a.columns,8);assert.equal(a.frameCount,64);assert.equal(a.pivotX,326.5);assert.equal(a.pivotY,511);assert.equal(a.sourceFacing,'left');
 near(a.durationMs,563.5490282685512);near(a.cyclesPerCell,4.436171255021064);
 assert.equal(a.frameGeometry,undefined,'V2 eight-frame offsets must not override V3');
 assert.equal(createHash('sha256').update(readFileSync(`${animationRoot}/${expected}`)).digest('hex'),'03dd203f9f7d85d83c38f877b7b3674e33f9f8ef546cd6d5bf8c9ef9f6b063fd');
 assert.ok(animation.UNIT_ANIMATION_ASSETS.includes(expected));assert.ok(!animation.UNIT_ANIMATION_ASSETS.includes(old));
});
test('world and combat render and selection address every native cell in both directions',()=>{
 for(const combat of [false,true])for(const facing of [-1,1])for(let frame=0;frame<64;frame++){
  const t=(frame+.5)/64*a.durationMs/1000;
  const time=10+(combat?t:(frame+.5)/64*2.5/a.cyclesPerCell);
  const moving={...agent,facing,...(combat?{combat:{position:{moving:true,moveStartedAt:10}}}:{})};
  const p=creaturePresentationPose(model,moving,time,false,resources,'walk');
  assert.equal(p.frame,frame);assert.equal(p.animation.image,expected);assert.equal(p.mirrorX,facing===1);
  assert.equal(p.source,p.selection);assert.equal(p.source.owner,sprite);assert.equal(p.source.size,640);
  assert.equal(p.source.x,(frame%8)*640);assert.equal(p.source.y,Math.floor(frame/8)*640);
  near(p.left,-326.5/640);near(p.top,-511/640);
  const draws=[],flips=[],outlines=[];
  const context={save(){},restore(){},translate(){},scale(...args){flips.push(args)},drawImage(...args){draws.push(args)}};
  assert.equal(drawCreaturePresentation(context,p,100,200,48,'green',(...args)=>outlines.push(args)),true);
  assert.deepEqual(draws[0].slice(0,5),[sprite,p.source.x,p.source.y,640,640]);
  assert.equal(outlines[0][5],p.selection);assert.deepEqual(flips,facing===1?[[-1,1]]:[]);
 }
});
test('cell boundaries preserve accumulated phase rather than restart the turtle',()=>{
 for(let step=1;step<6;step++){
  const moved={...agent,stepCount:step+1,moveStartedAt:10+step*2.5};
  const p=animation.creatureWalkPose(moved,moved.moveStartedAt);
  assert.equal(p.frame,animation.unitAnimationFrame(a,step*a.cyclesPerCell*a.durationMs));
 }
 assert.equal(animation.unitAnimationFrame(a,a.durationMs),0);
 for(const mode of ['idle','fight'])assert.equal(animation.creatureWalkPose({...agent,mode},10.2),null);
 assert.equal(animation.creatureWalkPose({...agent,health:0},10.2),null);
 assert.equal(animation.creatureWalkPose(agent,12.5),null);
});
test('welcome enter and exit use identical native walk timing and left-facing selection',()=>{
 for(const phase of ['enter','exit'])for(const elapsedMs of [50,400,1200,2499,2500,2700]){
  const time=10+elapsedMs/1000;
  const m=welcomeTravelMotion(model,{key:'vine-turtle',width:800,size:130,worldPixels:144,elapsedMs,timeline:time,startedAt:10,phase});
  const p=creaturePresentationPose(model,m.agent,time,false,resources,'walk');
  assert.ok(p);assert.equal(p.animation.image,expected);assert.equal(p.mirrorX,false);
  assert.equal(p.frame,animation.unitAnimationFrame(a,elapsedMs/1000*animation.creatureAnimationSpeed('vine-turtle')*a.cyclesPerCell*a.durationMs));
 }
 const p=creaturePresentationPose(model,{...agent,facing:1},10.2,true,resources,'walk');assert.equal(p.frame,0);assert.equal(p.mirrorX,true);
});

test('design, local wrapper and compiled surfaces use V3 without live V2 links',()=>{
 const c={};vm.runInNewContext(readFileSync(`${root}/client/unit-matrix-data.js`,'utf8'),c);
 const m=c.SpawnerUnitMatrixData.units['vine-turtle'].animations.walk;
 assert.deepEqual(JSON.parse(JSON.stringify(m)),JSON.parse(JSON.stringify(a)));
 const local={SpawnerLocalAssetSources:{}};vm.runInNewContext(readFileSync(`${root}/client/local-assets/Animations/CreatureWalkV3/vine-turtle/walk.webp.js`,'utf8'),local);
 assert.equal(createHash('sha256').update(Buffer.from(local.SpawnerLocalAssetSources[expected].split(',')[1],'base64')).digest('hex'),'03dd203f9f7d85d83c38f877b7b3674e33f9f8ef546cd6d5bf8c9ef9f6b063fd');
 for(const file of ['client/runtime.js','Combat.html','client/vfx-event-preview.js','client/unit-matrix-data.js','client/local-assets.js','DesignAssets/codex-food.html','DesignAssets/sections/unit-appearance.js']){
  const content=readFileSync(`${root}/${file}`,'utf8');assert.ok(!content.includes('CreatureWalkV2/vine-turtle/'),file);assert.ok(content.includes('CreatureWalkV3/vine-turtle/'),file);
 }
});
