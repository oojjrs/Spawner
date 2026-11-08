import { unitPresentationTestSource } from "./unit-presentation-fixture.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { SPRING_THRUST_CAMERA, springThrustAppearance, springThrustPose, springThrustLength, renderSpringThrust, springThrustRegisteredPose, springThrustFeatureTip, springThrustLowerBounds, renderSpringThrustBody } from "./spring-attachment-thrust.mjs";
import { createCombatEvolutionArt } from "./combat-evolution.mjs";
import { combatAttributeKeys, hasCombatEvolution } from "./combat-attributes.mjs";

const attributes = { blade: 1, antenna: 1, strength: 1, feet: 1 };
const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function surface(width,height) {
  let matrix=[1,0,0,1,0,0],stack=[];const result={width,height,calls:[]};
  const context={canvas:result,globalAlpha:1,save(){stack.push({matrix:[...matrix],alpha:this.globalAlpha});},restore(){const x=stack.pop();matrix=x.matrix;this.globalAlpha=x.alpha;},
    transform(...m){matrix=multiply(matrix,m);},translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},
    getTransform(){return Object.fromEntries(["a","b","c","d","e","f"].map((x,i)=>[x,matrix[i]]));},
    beginPath(){},moveTo(){},lineTo(){},closePath(){},rect(){},clip(){},
    getImageData(){return{data:new Uint8ClampedArray(512*512*4)};},
    drawImage(image,...args){result.calls.push({image,args,matrix:[...matrix],alpha:this.globalAlpha});}};
  Object.defineProperty(result,"getContext",{value:()=>context});return result;
}
const body=(context,pose,layer)=>{context.drawImage(layer||"full");if(layer==="combat-body")return{source:[270.7,325.4],target:[262.3,359.8]};};
body.splitFeet=true;body.springThrust=true;
const agent={id:"spring",tribe:"spring",attributes,health:10,bornAt:0,hurtStartedAt:-Infinity,attack:{startedAt:10,speed:1}};
async function art(create=surface){const result=createCombatEvolutionArt(file=>"data:application/json;base64,"+readFileSync(new URL("../"+file,import.meta.url)).toString("base64"),create,async file=>({file,width:512,height:512}));await result.prepare("spring");return result;}
const json=value=>JSON.parse(JSON.stringify(value));

test("spring thrust opts in the four reviewed broad bodies, including the legacy arms alias",()=>{
  assert.ok(springThrustAppearance("spring",attributes));assert.ok(springThrustAppearance("spring",{...attributes,strength:0,arms:1}));
  for(const tribe of ["bean","spore","pebble"])assert.equal(springThrustAppearance(tribe,attributes),false);
  for(const antenna of [0,1])for(const feet of [0,1])assert.equal(springThrustAppearance("spring",{blade:1,strength:1,antenna,feet}),true);
  for(const key of ["blade","strength"])assert.equal(springThrustAppearance("spring",{...attributes,[key]:0}),false);
  for(const candidate of [{blade:1},{blade:1,feet:1},{blade:1,antenna:1},{blade:1,antenna:1,feet:1}])assert.equal(springThrustAppearance("spring",candidate),false);
  for(const key of ["piercing","carapace"])assert.equal(springThrustAppearance("spring",{...attributes,[key]:1}),false);
});

test("the strike aims six degrees higher without changing reach, contact, hold or recovery",()=>{
  const source=[229.8705534255986,314.39332561979177],socket=[231,320],pose=t=>springThrustPose(t,source,socket);
  const c=Math.cos(6*Math.PI/180),s=Math.sin(6*Math.PI/180);
  const unrotate=p=>{const [x,y]=p.tip.map((v,i)=>v-socket[i]);return[socket[0]+x*c-y*s,socket[1]+x*s+y*c];};
  for(let t=160;t<=620;t+=10){const p=pose(t);assert.ok(Math.abs(unrotate(p)[1]-330)<1e-10);assert.ok(p.tip[1]<330);
    assert.ok(Math.abs(Math.hypot(...p.tip.map((v,i)=>v-socket[i]))-p.distance)<1e-10);}
  assert.ok(Math.abs(unrotate(pose(300))[0]-unrotate(pose(240))[0]-235)<1e-10);
  assert.equal(pose(380).tip[0],pose(480).tip[0]);assert.ok(pose(700).tip[0]<pose(480).tip[0]);
  assert.equal(pose(0).width,1);assert.equal(pose(300).width,.56);assert.equal(pose(1000).width,1);
});

test("all source-strip transforms remain monotone and finite through the attack",()=>{
  for(let t=0;t<=1000;t+=10){
    const pose=springThrustPose(t,[229.87,314.39],[231,320]),canvas=surface(896,640);
    let previous=springThrustLength(pose,pose.minimum);
    for(let x=pose.minimum+1;x<512;x++){const next=springThrustLength(pose,x);assert.ok(next>previous);previous=next;}
    renderSpringThrust(canvas.getContext("2d"),"feature",pose);
    assert.ok(canvas.calls.length<175);
    for(const call of canvas.calls){const m=call.matrix;assert.ok(m.every(Number.isFinite));assert.ok(m[0]*m[3]-m[1]*m[2]>0);}
  }
});






function gameHarness(ready,frameCamera=SPRING_THRUST_CAMERA){
  const source=unitPresentationTestSource(readFileSync(new URL("./game.js",import.meta.url),"utf8")),match=source.match(/^    function drawAgentAppearanceLayer\([^]*?^    }/m);
  const calls=[],flags=[],sockets=[],motions=[],outlines=[],layers=[],sprite={width:frameCamera?.width||512,height:frameCamera?.height||512,...(frameCamera?{combatCamera:frameCamera}:{})};
  const sheet={sprite:{complete:ready,naturalWidth:ready?2064:0}},scope={
    Spawner:{unitDisplayAttributes,combatAttributeKeys,hasCombatEvolution,unitAnimationPose:()=>({action:"attack"})},state:{simSeconds:10.3},idleMotion:{matches:false},AGENT_HEIGHT:.7,
    unitAnimationSheets:new Map([["spring",new Map([["attack",sheet]])]]),
    tribeArt:{sprite:(tribe,attrs,layer)=>{layers.push(layer);return"portrait";},combatAttackSprite:(...args)=>{motions.push(args);return{replacementSocket:{source:[1,2],target:[3,4]}};}},
    combatAttributeArt:{ready:()=>true,frame:(forward,time,scale,drawBody)=>{flags.push(drawBody.springThrust);sockets.push(drawBody({drawImage(){}},{action:"attack",sampleTime:300},"combat-body"));return sprite;}},
    drawCombatAgentAttributes(){},drawAgentAppearanceBody(){},drawSelectionOutline:(...args)=>outlines.push(args)};
  vm.createContext(scope);vm.runInContext(match[0],scope);
  const context={save(){},restore(){},translate(...args){calls.push(["translate",...args]);},scale(...args){calls.push(["scale",...args]);},drawImage(...args){calls.push(["image",...args]);}};
  return{scope,context,calls,flags,sockets,motions,outlines,layers,sprite};
}




test("registered blade axes retain the authored strike while calibrating only the new forms",()=>{
  const source=[229.87,314.39],socket=[231,320];
  for(const tip of [[441.5,151.49543378995435],[441.5,156.00510204081633],[441.5,157.5563909774436]])for(let t=0;t<=1000;t+=10){
    const pose=springThrustRegisteredPose(t,source,socket,tip);assert.ok(pose);
    if(t>=160&&t<=620)assert.deepEqual(pose.tip,springThrustPose(t,source,socket).tip);
    if(t===0)assert.deepEqual(pose.tip,tip.map((x,i)=>x-source[i]+socket[i]));
    let previous=springThrustLength(pose,pose.minimum);
    for(let x=pose.minimum+1;x<512;x++){const next=springThrustLength(pose,x);assert.ok(next>previous);previous=next;}
  }
  assert.equal(springThrustRegisteredPose(300,source,socket,source),null);
});

test("source registration ignores faint alpha and missing body/feature pixels",()=>{
  const pixels=new Uint8ClampedArray(4*4*4);pixels[(1*4+3)*4+3]=255;pixels[(2*4+3)*4+3]=255;pixels[(0*4+3)*4+3]=1;
  assert.deepEqual(springThrustFeatureTip(pixels,4,4),[3.5,2]);
  assert.equal(springThrustFeatureTip(new Uint8ClampedArray(64),4,4),null);
  assert.equal(springThrustLowerBounds(new Uint8ClampedArray(1024*1024*4),1024,1024),null);
});

test("lower-body settling uses positive transforms and rejects unreviewed correction ranges",()=>{
  const current={floor:451.5,center:214.25,width:306.5},target={floor:449,center:213,width:307};
  const result=surface(512,512);assert.equal(renderSpringThrustBody(result.getContext("2d"),"body",current,target),true);
  assert.deepEqual(result.calls[0].matrix,[1,0,0,1,0,0]);
  for(const {matrix:m} of result.calls)assert.ok(m.every(Number.isFinite)&&m[0]*m[3]-m[1]*m[2]>0);
  for(const value of [null,{...target,floor:440},{...target,center:240},{...target,width:400},{...target,width:NaN}]){
    const fallback=surface(512,512);assert.equal(renderSpringThrustBody(fallback.getContext("2d"),"body",current,value),false);assert.equal(fallback.calls.length,0);
  }
});

// Deliberately absent pixels: neither an unregistered blade nor an invalid body
// settlement may become a successful reusable thrust frame.
