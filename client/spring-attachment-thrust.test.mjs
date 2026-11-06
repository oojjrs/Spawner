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

test("the renderer returns a padded camera while preserving the original portrait scale and ground pivot",async()=>{
  const renderer=await art(),result=renderer.frame(agent,10.300001,null,body);
  assert.equal(result.width,896);assert.equal(result.height,640);assert.deepEqual(result.combatCamera,SPRING_THRUST_CAMERA);
  assert.equal(result.combatCamera.pivotX-result.combatCamera.offsetX,256);
  assert.equal(result.combatCamera.pivotY-result.combatCamera.offsetY,448);
  assert.equal(result.combatCamera.units,512);
});

test("padded attack frames are shared by pose rather than absolute time, and do not poison fallback caches",async()=>{
  const renderer=await art(),a=renderer.frame(agent,10.300001,null,body);
  assert.equal(renderer.frame({...agent,id:"other",attack:{startedAt:20,speed:1}},20.300001,null,body),a);
  const fallback=(ctx,pose,layer)=>ctx.drawImage(layer||"full");fallback.splitFeet=true;
  const old=renderer.frame(agent,10.300001,null,fallback);assert.equal(old.width,512);assert.equal(old.combatCamera,undefined);
  assert.equal(renderer.frame(agent,10.300001,null,body),a);
});

test("a temporarily missing body socket is retried at the same pose and recovers",async()=>{
  const renderer=await art();let ready=false,calls=0;
  const paint=(ctx,pose,layer)=>{calls++;ctx.drawImage(layer||"full");return ready&&layer==="combat-body"?{source:[270.7,325.4],target:[262.3,359.8]}:null;};
  paint.splitFeet=true;paint.springThrust=true;
  const fallback=renderer.frame(agent,10.300001,null,paint),firstCalls=calls;
  ready=true;const recovered=renderer.frame(agent,10.300001,null,paint);
  assert.notEqual(recovered,fallback);assert.ok(calls>firstCalls);
  const recoveredCalls=calls;assert.equal(renderer.frame(agent,10.300001,null,paint),recovered);assert.equal(calls,recoveredCalls);
});

test("cancel, hurt, death, idle, walk, harvest and ranged shots keep the ordinary camera",async()=>{
  const renderer=await art();renderer.frame(agent,10.300001,null,body);
  for(const changes of [{attack:null},{attack:null,hurtStartedAt:10.2},{health:0,diedAt:10.2},{attack:null,moveStartedAt:10,moveDuration:1},{attack:null,mode:"harvest",harvestStarted:10},
    {attack:{...agent.attack,mode:"ranged"}}]){
    const result=renderer.frame({...agent,...changes},10.300001,null,body);assert.equal(result.width,512);assert.equal(result.combatCamera,undefined);
  }
});

test("invalid or unavailable body sockets keep the ordinary attachment fallback without throwing",async()=>{
  for(const value of [null,{}, {source:[1],target:[1,2]}, {source:[1,NaN],target:[2,3]}]){
    const renderer=await art(),paint=(ctx,pose,layer)=>{ctx.drawImage(layer||"full");return layer==="combat-body"?value:null;};paint.splitFeet=true;paint.springThrust=true;
    const result=renderer.frame(agent,10.300001,null,paint);assert.equal(result.width,896);
    assert.ok(JSON.stringify(result).includes("RuntimeParts/spring-blade.png"));
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

test("the actual world/detail caller honors padded placement in both directions, sizes and DPRs",()=>{
  for(const appearance of [attributes,{blade:1,strength:1,feet:1},{blade:1,strength:1},{blade:1,antenna:1,strength:1}])for(const size of [12,70,200])for(const facing of [-1,1])for(const dpr of [1,2,3]){
    const h=gameHarness(true),cell=size/1.4;
    // DPR belongs to the outer context. The sprite rectangle remains in CSS units.
    h.context.scale(dpr,dpr);h.scope.drawAgentAppearanceLayer(h.context,0,{...agent,attributes:appearance,facing},cell,{x:100,y:200},null,null,"selected");
    assert.equal(h.flags[0],true);assert.deepEqual(json(h.sockets[0]),{source:[1,2],target:[3,4]});assert.equal(h.motions[0][3],300);
    const draw=h.calls.at(-1);assert.equal(draw[0],"image");const [x,y,w,height]=draw.slice(2),s=size/512;
    assert.ok(Math.abs(x+448*s)<1e-10);assert.ok(Math.abs(y+512*s)<1e-10);
    assert.ok(Math.abs(w-896*s)<1e-10);assert.ok(Math.abs(height-640*s)<1e-10);
    assert.deepEqual(h.calls.at(-2),["scale",facing,1]);assert.deepEqual(h.outlines[0].slice(1,5),[x,y,w,height]);
  }
});

test("a loading attack sheet uses the original portrait and 512 camera, then switches when ready",()=>{
  const waiting=gameHarness(false,null);waiting.scope.drawAgentAppearanceLayer(waiting.context,0,agent,100,{x:0,y:0},null,null,null);
  assert.equal(waiting.flags[0],false);assert.equal(waiting.motions.length,0);assert.deepEqual(waiting.layers,["combat-body"]);
  assert.deepEqual(waiting.calls.at(-1).slice(2),[-70,-122.5,140,140]);
  const loaded=gameHarness(true);loaded.scope.drawAgentAppearanceLayer(loaded.context,0,agent,100,{x:0,y:0},null,null,null);assert.equal(loaded.flags[0],true);assert.equal(loaded.motions.length,1);
});


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
test("new-form missing pixels are retried and narrow forms keep the ordinary camera",async()=>{
  const renderer=await art();
  for(const attrs of [{blade:1,strength:1,feet:1},{blade:1,strength:1},{blade:1,antenna:1,strength:1}]){
    const candidate={...agent,attributes:attrs},a=renderer.frame(candidate,10.300001,null,body),b=renderer.frame(candidate,10.300001,null,body);
    assert.notEqual(a,b);assert.deepEqual(a.combatCamera,SPRING_THRUST_CAMERA);
  }
  for(const attrs of [{blade:1,antenna:1},{blade:1,antenna:1,feet:1}]){
    const result=renderer.frame({...agent,attributes:attrs},10.300001,null,body);assert.equal(result.width,512);assert.equal(result.combatCamera,undefined);
  }
});


test("new-form successful frames recover from missing pixels, share grade/arms geometry and survive frame-cache eviction",async()=>{
  let ready=false,reads=0;
  const create=(width,height)=>{
    const canvas=surface(width,height),ctx=canvas.getContext("2d");
    ctx.getImageData=()=>{
      if(width===1024)reads++;
      const pixels=new Uint8ClampedArray(width*height*4);
      const feature=width===512&&JSON.stringify(canvas.calls).includes("RuntimeParts/spring-blade.png");
      if(width===512&&!feature)pixels[(448*512+0)*4+3]=255;
      if(ready){
        if(width===1024){for(let y=820;y<900;y++)for(let x=300;x<740;x++)pixels[(y*width+x)*4+3]=255;}
        else if(feature)pixels[(157*512+441)*4+3]=255;
      }
      return{data:pixels};
    };
    return canvas;
  };
  const renderer=await art(create),attrs={blade:1,strength:1},candidate={...agent,attributes:attrs};
  const waiting=renderer.frame(candidate,10.300001,null,body);ready=true;
  const recovered=renderer.frame(candidate,10.300001,null,body);assert.notEqual(recovered,waiting);
  assert.equal(renderer.frame(candidate,10.300001,null,body),recovered);
  const firstReads=reads;
  // Different non-geometric grades force distinct final-frame keys without
  // repeating source-pixel registration for this same morphology and pose.
  for(let strength=2;strength<=50;strength++)renderer.frame({...candidate,attributes:{...attrs,strength}},10.300001,null,body);
  assert.equal(reads,firstReads);
  assert.notEqual(renderer.frame(candidate,10.300001,null,body),recovered,"the padded frame budget evicted the original sprite");
  assert.equal(reads,firstReads,"numeric pose registration survives final-frame eviction");
  const alias=renderer.frame({...candidate,attributes:{blade:1,arms:1}},10.300001,null,body);
  assert.deepEqual(alias.combatCamera,SPRING_THRUST_CAMERA);assert.equal(reads,firstReads);
});
