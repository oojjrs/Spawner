import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {drawBeanSecretionBirth} from './bean-secretion-birth.mjs';
import * as ranged from './unit-ranged.mjs';
import {unitDisplayAttributes} from './unit-display-appearance.mjs';
import {unitAnimationPose} from './unit-animation.mjs';
import {agentBirthMotion} from '../server/birth.mjs';
const source=readFileSync(new URL('./game.js',import.meta.url),'utf8');
const extract=name=>source.match(new RegExp('^    function '+name+'\\([^]*?^    }','m'))[0];
const agent=(changes={})=>({id:'bean',tribe:'bean',health:10,facing:1,attributes:{secretion:1},birth:{startedAt:0},...changes});
const sprite={path:ranged.UNIT_RANGED_FORMS.bean.idle.image,width:512,height:512,complete:true};
const I=()=>[1,0,0,1,0,0];
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function context(){let m=I(),stack=[];const calls=[];
 const ctx={calls,save:()=>stack.push([...m]),restore:()=>{assert.ok(stack.length);m=stack.pop();},
  transform:(...n)=>m=mul(m,n),translate:(x,y)=>m=mul(m,[1,0,0,1,x,y]),scale:(x,y)=>m=mul(m,[x,0,0,y,0,0]),
  rotate:a=>m=mul(m,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]),
  drawImage:(image,...args)=>calls.push({image,args,matrix:[...m]}),beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},
  balanced:()=>assert.equal(stack.length,0)};return ctx;}
function world(){let available=true;const scenes=[],leaves=[],outlines=[],old={path:'legacy-layered-body',width:512,height:512},scope=createContext({
 Spawner:{...ranged,unitDisplayAttributes,hasCombatEvolution:()=>false,unitAnimationPose},AGENT_HEIGHT:.7,idleMotion:{matches:false},state:{simSeconds:4},
 combatAttributeArt:{ready:()=>false},agentSprite:()=>old,agentRangedImage:()=>available?sprite:null,unitDisplayScale:()=>1.0070512614494618,
 drawBirthSeed:(...a)=>scenes.push(['seed',...a.slice(1)]),drawBirthFragments:(...a)=>scenes.push(['fragments',...a.slice(1)]),drawBirthImpact:(...a)=>scenes.push(['impact',...a.slice(1)]),
 drawAgentFeet(){},drawAgentHead:(...a)=>leaves.push(a),drawSelectionOutline:(...a)=>outlines.push(a)});
 for(const name of ['drawAgentRangedBirth','drawAgentBirth','drawAgentRanged'])runInContext(extract(name),scope);
 return {scope,scenes,leaves,outlines,old,setAvailable:v=>available=v};}

test('birth adapter selects only the live secretion bean and preserves other form/lifecycle priorities',()=>{
 assert.equal(ranged.unitRangedBirthAppearance(agent()),ranged.UNIT_RANGED_FORMS.bean);
 assert.equal(ranged.unitRangedBirthAppearance(agent({attributes:{secretion:1,carapace:1,antenna:1,feet:1}})),ranged.UNIT_RANGED_FORMS.bean);
 for(const a of [agent({health:0}),agent({birth:null}),agent({species:'bubble-toad'}),agent({attributes:{blade:1,secretion:1}}),agent({attributes:{}}),...['spore','pebble','spring'].map(tribe=>agent({tribe}))])assert.equal(ranged.unitRangedBirthAppearance(a),null);
 for(const tribe of ['spore','pebble','spring'])assert.equal(ranged.UNIT_RANGED_FORMS[tribe].birthBody,undefined);
 assert.equal(ranged.unitRangedLifecycleAnimation(agent({health:0}),'death'),ranged.UNIT_RANGED_FORMS.bean.lifecycle.death);
 assert.ok(ranged.UNIT_RANGED_IMAGE_ASSETS.includes(sprite.path));
 const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');assert.equal(sha(sprite.path),sha('DesignAssets/Animations/UnitAppearanceV1/bean/10/Source/neutral.png'));
});

test('source-space foliage uses original independent head transforms and exact neutral source',()=>{
 const a=agentBirthMotion(2.77,1,1),head=structuredClone(a.head),ctx=context();assert.equal(drawBeanSecretionBirth(ctx,sprite,head),true);ctx.balanced();assert.equal(ctx.calls.length,3);assert.notDeepEqual(ctx.calls[0].matrix,ctx.calls[1].matrix);assert.deepEqual(ctx.calls[2].matrix,I());assert.deepEqual(head,a.head);
 const rest=agentBirthMotion(3.849,1,1).head,neutral=context();assert.equal(drawBeanSecretionBirth(neutral,sprite,rest),true);assert.deepEqual(neutral.calls,[{image:sprite,args:[0,0],matrix:I()}]);
 for(const invalid of [null,{...sprite,width:256},{...sprite,complete:false}]){const c=context();assert.equal(drawBeanSecretionBirth(c,invalid,head),false);assert.equal(c.calls.length,0);c.balanced();}
 for(const key of Object.keys(head)){const c=context();assert.equal(drawBeanSecretionBirth(c,sprite,{...head,[key]:NaN}),false);assert.equal(c.calls.length,0);c.balanced();}
});

test('actual bean birth keeps complete authored seed/fragment/impact scene and cold-load fallback',()=>{
 const w=world(),a=agent(),before=structuredClone(a);let b;
 for(const time of [.5,1.2,2.60,2.89,3.27,3.849]){
  const c=context();b={...agentBirthMotion(time,1,1),x:3,y:4,fromX:2,fromY:3,targetX:3,targetY:4};
  w.scenes.length=0;w.scope.drawAgentBirth(c,0,a,b,{x:10,y:20},100,'selected');const actual=structuredClone(w.scenes);c.balanced();
  w.setAvailable(false);w.scenes.length=0;const fallback=context();w.scope.drawAgentBirth(fallback,0,a,b,{x:10,y:20},100,'selected');fallback.balanced();assert.deepEqual(w.scenes,actual);
  assert.equal(actual.filter(x=>x[0]==='impact').length,4);assert.equal(actual.filter(x=>x[0]==='seed').length,b.seedVisible?1:0);
  if(b.unitVisible){assert.equal(fallback.calls.at(-1).image,w.old);assert.equal(c.calls.some(x=>x.image===sprite),true);}else assert.equal(c.calls.length,0);
  w.setAvailable(true);
 }
 assert.ok(w.leaves.length);assert.ok(w.outlines.length);assert.deepEqual(a,before);
});

test('terminal actual birth and idle draw share the exact world transform for facing, growth and zoom',()=>{
 const w=world(),b=agentBirthMotion(3.849,1,1);
 const project=(call,p)=>{const a=call.args,s=a.length===8?a.slice(4):a.length===2?[...a,512,512]:a;const[x,y,width,height]=s;const m=call.matrix,xx=x+p[0]*width/512,yy=y+p[1]*height/512;return[m[0]*xx+m[2]*yy+m[4],m[1]*xx+m[3]*yy+m[5]];};
 for(const facing of [-1,1])for(const pieces of [0,17])for(const cell of [30,100,300])for(const combat of [undefined,{version:2,side:0},{version:2,side:1}]){
  const a=agent({facing,dna:{pieces:Array(pieces).fill({gene:'health'})},combat}),birth=context(),idle=context();
  assert.equal(w.scope.drawAgentRangedBirth(birth,a,b,80,160,cell,null),true);
  assert.equal(w.scope.drawAgentRanged(idle,{...a,birth:null},80,160,cell*.7,null),true);
  assert.equal(birth.calls.length,1);assert.equal(idle.calls.length,1);assert.equal(birth.calls[0].image,idle.calls[0].image);
  for(const p of [[0,0],[256,448],[315,345],[512,512]]){
   const x=project(birth.calls[0],p),y=project(idle.calls[0],p);assert.ok(Math.hypot(x[0]-y[0],x[1]-y[1])<1e-10);
  }birth.balanced();idle.balanced();
 }
});

test('entire authored birth keeps finite positive leaf/body transforms with no action-clock mutation',()=>{
 const w=world(),a=agent(),before=JSON.stringify(a);
 for(let ms=2590;ms<3850;ms++){
  const b=agentBirthMotion(ms/1000,1,1),c=context();assert.equal(w.scope.drawAgentRangedBirth(c,a,b,0,0,100,null),true);
  for(const d of c.calls){assert.ok(d.matrix.every(Number.isFinite));assert.ok(Math.abs(d.matrix[0]*d.matrix[3]-d.matrix[1]*d.matrix[2])>0);}
  c.balanced();
 }assert.equal(JSON.stringify(a),before);
});
