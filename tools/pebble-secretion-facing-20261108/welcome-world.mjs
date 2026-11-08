// Native Canvas pixels through actual welcome-header function and production world presentation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {createUnitPresentation} from '../../client/unit-presentation.mjs';
import {welcomeTravelMotion} from '../../client/welcome-presentation.mjs';
import * as animation from '../../client/unit-animation.mjs';
import {unitStats} from '../../server/attributes.mjs';
const {createCanvas,Image}=createRequire('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/package.json')('@napi-rs/canvas');
const root=new URL('../../',import.meta.url);
globalThis.SpawnerAssets={source:p=>fileURLToPath(new URL(p,root)),image:()=>new Image()};
const code=readFileSync(new URL('client/welcome-header.js',root),'utf8');
const draw=code.slice(code.indexOf('  function drawPreparedUnit('),code.indexOf('  function active('));
let time=.05;
const presentation=createUnitPresentation({model:{},height:.7,time:()=>time,reducedMotion:()=>false,displayScale:()=>1,createSurface:createCanvas});
const pixels=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
function surface(){const c=createCanvas(384,384),ctx=c.getContext('2d'),calls=[];const proxy=new Proxy(ctx,{get(t,k){if(k==='drawImage')return(...args)=>{calls.push(Math.sign(t.getTransform().a));return t.drawImage(...args)};const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v},set(t,k,v){Reflect.set(t,k,v,t);return true;}});return{c,ctx:proxy,calls}}
let draws=0;
for(const phase of ['enter','perform','exit','stationary-ranged']){
 const motion=welcomeTravelMotion({unitStats,...animation},{key:'pebble',attributes:{secretion:1},width:384,size:64,elapsedMs:50,timeline:time,phase:phase==='stationary-ranged'?'perform':phase,startedAt:0});
 // Compare local body registration at a fixed on-screen point, independently of travel position.
 motion.x=192;
 if(phase==='stationary-ranged')motion.agent.attack={startedAt:0,endsAt:.6,mode:'ranged',directionX:-1};
 await presentation.prepareAnimation(motion.agent,time);
 const welcome=surface(),world=surface();
 vm.runInNewContext(draw+'\ndrawPreparedUnit(motion);',{motion,width:384,height:384,context:welcome.ctx,nativeAssets:{displayScale:()=>1},groundY:()=>320,unitPresentation:presentation,performance:{now:()=>50},model:{},timeline:time,reducedMotion:{matches:false}});
 const topLeft={x:motion.x-motion.cell/2,y:320-motion.cell*(.5+.7*.44)};
 presentation.drawRootMotion(world.ctx,50,motion.agent,motion.cell,topLeft,motion.position,null,()=>presentation.drawAgentAppearanceBody(world.ctx,50,motion.agent,motion.cell,topLeft,motion.position,null,null));
 assert.ok(pixels(welcome.c).equals(pixels(world.c)),phase+' welcome/world exact native RGBA');
 assert.ok(pixels(welcome.c).some(v=>v!==0),phase+' visible pixels');
 assert.deepEqual(welcome.calls,[1],phase+' original source shown unflipped for left target');
 assert.deepEqual(world.calls,[1],phase+' same in world');
 const right=surface(),agent={...motion.agent,facing:1,attack:motion.agent.attack?{...motion.agent.attack,directionX:1}:null};
 presentation.drawAgentAppearanceBody(right.ctx,50,agent,motion.cell,topLeft,motion.position,null,null);
 assert.deepEqual(right.calls,[-1],phase+' right opponent target uses ordinary renderer mirror');
 draws+=3;global.gc?.();
}
const result={engine:'actual native Node Canvas, not browser',phases:4,draws,exactWelcomeWorldRasterMatches:4,leftTargetNative:true,rightTargetMirrored:true};
writeFileSync(new URL('welcome-world.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
