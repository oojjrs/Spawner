import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {springDominantBirthForm,springDominantBirthPose,springDominantBirthRow,springDominantBirthPixels,createSpringDominantBirthArt,SPRING_DOMINANT_BIRTH_SETTLED_AT} from './spring-dominant-birth.mjs';
import {SPRING_BIRTH_ANIMATION,springBirthPlacement,springBirthMotion} from './birth.mjs';
import {unitFacing,unitFrameMirror} from './unit-size.mjs';
import {unitActionArtPose} from './unit-action-art.mjs';
import {createUnitPresentation} from './unit-presentation.mjs';
import {imageDimensions} from './image-audit.mjs';
const agent=(patch={})=>({id:'spring',tribe:'spring',health:10,birth:{startedAt:0},attributes:{blade:1},bornAt:0,...patch});
const profiles={blade:{top:150,tip:383.5},carapace:{top:156,tip:219.5}};
function source(){const data=new Uint8ClampedArray(512*512*4);for(let y=150;y<452;y++)for(let x=70;x<405;x++){const i=(y*512+x)*4;data.set([25,170,205,255],i);}return data;}
function canvas(width,height,data=new Uint8ClampedArray(width*height*4)){const ctx={getImageData:()=>({data}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:im=>{data=im.data;}};return {width,height,getContext:()=>ctx};}

test('only living single-organ spring bodies opt in; authored combinations keep their own birth',()=>{
 for(const [attributes,form] of [[{blade:1},'blade'],[{blade:1,feet:1},'blade'],[{carapace:1},'carapace'],[{carapace:1,legs:1},'carapace']])assert.equal(springDominantBirthForm(agent({attributes})),form);
 for(const patch of [{tribe:'bean'},{species:'bubble-toad'},{health:0},{birth:null},{attributes:{}},{attributes:{secretion:1}},{attributes:{blade:1,strength:1}},{attributes:{blade:1,piercing:1}},{attributes:{blade:1,secretion:1,carapace:1,antenna:1,feet:1}},{attributes:{carapace:1,antenna:1}}])assert.equal(springDominantBirthForm(agent(patch)),null);
});

test('common water mapping has no fold and retains the support and lower face band',()=>{
 for(const profile of Object.values(profiles))for(const time of [0,.13,.35,.53,.60,.70,.79,.9,1.08,1.219]){
  const pose=springDominantBirthPose(time);let last=-Infinity;
  for(let y=0;y<=512;y++){const row=springDominantBirthRow(y,pose,profile);assert.ok(row.y>last);assert.ok(row.sx>0);last=row.y;}
  const root=springDominantBirthRow(448,pose,profile);assert.equal(root.y,pose.rootY);
  const eye=springDominantBirthRow(365,pose,profile);assert.equal(eye.sx,pose.sx);assert.equal(eye.x,256);
 }
});

test('padded camera pins the real pre-detach outlet for both facings and current display scales',()=>{
 const pixels=source(),cell=100,a=SPRING_BIRTH_ANIMATION,outlet={x:2,y:3};
 const placement=springBirthPlacement(0,outlet,{x:3,y:5},.7*350/512);
 for(const [form,scale]of [['blade',.35246410032594844],['carapace',.37074001663914574]])for(const facing of [-1,1]){
  const result=springDominantBirthPixels(pixels,0,profiles[form],facing,scale),p=result.pose,r=springDominantBirthRow(profiles[form].top,p,profiles[form]);
  const tip=r.x-256*p.sx+profiles[form].tip*r.sx,worldPerPixel=1.4/512*scale;
  assert.ok(Math.abs(placement.rootX+(tip-256)*worldPerPixel*facing-outlet.x)<1e-10);
  assert.ok(Math.abs(placement.rootY+(r.y-448)*worldPerPixel-outlet.y)<1e-10);
  assert.ok(result.width<1400&&result.height<1400);
  for(const x of [0,result.width-1])for(let y=0;y<result.height;y++)assert.equal(result.data[(y*result.width+x)*4+3],0);
 }
});

test('sampler keeps source-only colors without row seams and supplies an exact idle identity after settling',()=>{
 const sprite=canvas(512,512,source()),art=createSpringDominantBirthArt(canvas),a=agent();
 const first=art.frame(sprite,a,.35,.352,1);assert.ok(first);assert.ok(first.combatCamera);assert.equal(first.combatCamera.units,256);
 const pixels=first.getContext('2d').getImageData().data;
 for(let i=0;i<pixels.length;i+=4)if(pixels[i+3])assert.deepEqual(Array.from(pixels.slice(i,i+3)),[25,170,205]);
 assert.equal(art.frame(sprite,a,.35,.352,1),first);
 for(const time of [SPRING_DOMINANT_BIRTH_SETTLED_AT,1.379,1.79])assert.equal(art.frame(sprite,a,time,.352,1),sprite);
 assert.notEqual(art.frame(sprite,a,.35,.352,-1),first);
 art.clear();assert.notEqual(art.frame(sprite,a,.35,.352,1),first);
});

test('pixel read failure, invalid input and blank art preserve fallback and allow recovery',()=>{
 const art=createSpringDominantBirthArt(canvas),a=agent();let fail=true;const data=source(),sprite=canvas(512,512,data);
 sprite.getContext=()=>({getImageData:()=>{if(fail)throw Error('not ready');return {data};}});
 assert.equal(art.frame(sprite,a,.35,.35),null);fail=false;assert.ok(art.frame(sprite,a,.35,.35));
 for(const [im,t,s]of [[null,.3,.35],[canvas(256,256),.3,.35],[canvas(512,512),.3,.35],[sprite,NaN,.35],[sprite,-1,.35],[sprite,.3,0],[sprite,.3,Infinity]])assert.equal(art.frame(im,a,t,s),null);
});

const game=readFileSync(new URL('./game.js',import.meta.url),'utf8');
const draw=game.match(/^    function drawAgentBirth\([^]*?^    }/m)[0];

test('actual common scene forwards spring births without procedural water or detached body transforms',()=>{
 const calls=[],scope=createContext({drawAgentAppearanceBody:(...args)=>calls.push(args)});
 runInContext(draw,scope);
 for(const attributes of [{blade:1},{carapace:1}])for(const facing of [-1,1]){
  const a=agent({attributes,facing}),before=structuredClone(a),birth={frame:6,elapsed:.7,x:2,y:3};
  const ctx={},topLeft={x:10,y:20};scope.drawAgentBirth(ctx,0,a,birth,topLeft,100,'cyan');
  assert.deepEqual(calls.at(-1),[ctx,0,a,100,topLeft,null,birth,'cyan']);assert.deepEqual(a,before);
 }
 assert.doesNotMatch(game,/function drawSpringBirth\(/);
});

test('actual common presentation draws one registered whole body in both facings and exits birth exactly once',async()=>{
 const previous=globalThis.SpawnerAssets;
 globalThis.SpawnerAssets={source:p=>p,image:()=>({async decode(){[this.width,this.height]=imageDimensions(this.src);}})};
 try{
  let time=0;
  const makeSurface=(width,height)=>({width,height,getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(width*height*4).fill(255)})})});
  const presentation=createUnitPresentation({model:{},height:.7,time:()=>time,displayScale:()=>1,createSurface:makeSurface});
  const scope=createContext({drawAgentAppearanceBody:(...args)=>presentation.drawAgentAppearanceBody(...args)});runInContext(draw,scope);
  for(const attributes of [{blade:1},{carapace:1}])for(const facing of [-1,1]){
   const a=agent({attributes,facing,birth:{startedAt:0,readyAt:1.79}}),before=structuredClone(a);
   await presentation.prepareAnimation(a,0);
   for(time of [.7,1.789,1.79,2]){
    await presentation.prepareAnimation(a,time);
    const pose=unitActionArtPose(a,time),draws=[],scales=[];
    const ctx={save(){},restore(){},translate(){},scale:(...x)=>scales.push(x),drawImage:(...x)=>draws.push(x),rotate(){assert.fail('baked birth must not receive an extra rotation');}};
    scope.drawAgentBirth(ctx,0,a,{elapsed:time}, {x:0,y:0},100,null);
    assert.equal(pose.action,time<1.79?'birth':'idle');
    const layers=pose.animation.sceneLayers?.layers.filter(l=>l.samples[pose.frame]);
    if(layers){assert.equal(layers.filter(l=>l.wholeBody).length,1);assert.deepEqual(draws.map(x=>x[0].src),layers.map(l=>l.image));}
    else {assert.equal(draws.length,1);assert.equal(draws[0][0].src,pose.animation.image);}
    assert.deepEqual(scales,[[unitFrameMirror(pose.animation.sourceFacing,unitFacing(a))?-1:1,1]]);
   }
   assert.deepEqual(a,before);
  }
 }finally{if(previous===undefined)delete globalThis.SpawnerAssets;else globalThis.SpawnerAssets=previous;}
});
