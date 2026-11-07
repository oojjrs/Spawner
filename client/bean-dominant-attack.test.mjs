import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { beanDominantAttackAppearance, prepareBeanDominantAttack, sampleBeanDominantAttack, renderBeanDominantAttack } from "./bean-dominant-attack.mjs";
import { createCombatEvolutionArt, combatEvolutionPose } from "./combat-evolution.mjs";
import { COMBAT_EVOLUTION_CATALOG } from "./combat-evolution-assets.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
const read = path => fs.readFileSync(new URL("../" + path, import.meta.url));
const definition = () => JSON.parse(read("DesignAssets/Animations/CombatAttributesV7/sprout/blade/rig.json"));
const animations = COMBAT_EVOLUTION_CATALOG["sprout/blade"].animations;
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function harness() {
  const state={ready:true,badSize:false,drawFailure:false};
  const surface=(width,height)=>{
    const result={width,height,calls:[]};let m=[1,0,0,1,0,0],stack=[];
    const context={canvas:result,globalAlpha:1,globalCompositeOperation:"source-over",save(){stack.push({m:[...m],alpha:this.globalAlpha,operation:this.globalCompositeOperation});},restore(){const s=stack.pop();m=s.m;this.globalAlpha=s.alpha;this.globalCompositeOperation=s.operation;},transform(...b){m=mul(m,b);},translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},getTransform(){return Object.fromEntries(["a","b","c","d","e","f"].map((k,i)=>[k,m[i]]));},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},rect(){},drawImage(image,...args){if(state.drawFailure&&image.file?.endsWith("sprout/blade/AttackParts/body.png"))throw Error("Unavailable pixels");result.calls.push({image,args,matrix:[...m]});},getImageData(){return{data:new Uint8ClampedArray(width*height*4)};}};
    result.getContext=()=>context;return result;
  };
  const load=async file=>({file,get complete(){return !file.endsWith("sprout/blade/AttackParts/body.png")||state.ready;},width:file.includes("foliage-")?553:506,get height(){return state.badSize&&file.endsWith("sprout/blade/AttackParts/body.png")?512:file.includes("foliage-")?415:372;}});
  return {state,surface,load};
}
async function art(h=harness()){const renderer=createCombatEvolutionArt(path=>"data:application/json;base64,"+read(path).toString("base64"),h.surface,h.load);await renderer.prepare("bean");return{...h,renderer};}
const unit=overrides=>({id:"bean-canonical",tribe:"bean",attributes:{blade:1},health:10,bornAt:0,hurtStartedAt:-Infinity,attack:{startedAt:10,speed:1},...overrides});
const paths=sprite=>sprite.calls.map(call=>call.image.file).filter(Boolean);
const images=rig=>Object.fromEntries(rig.parts.map(part=>[rig.attackMotion.images[part.id]?"attack-"+part.id:part.id,{width:part.id.startsWith("foliage-")?553:506,height:part.id.startsWith("foliage-")?415:372}]));

test("only projected canonical bean blade opts into its own-art attack",()=>{
 assert.equal(beanDominantAttackAppearance("bean",{blade:1}),true);
 for(const extra of ["strength","arms","piercing","antenna","carapace","feet","legs","secretion"])assert.equal(beanDominantAttackAppearance("bean",{blade:1,[extra]:1}),false);
 for(const tribe of ["spore","pebble","spring"])assert.equal(beanDominantAttackAppearance(tribe,{blade:1}),false);
 for(let mask=1;mask<32;mask+=2){const attributes=Object.fromEntries(["blade","carapace","antenna","feet","secretion"].map((k,i)=>[k,(mask>>i)&1]));assert.equal(beanDominantAttackAppearance("bean",unitDisplayAttributes(unit({attributes}))), [1, 9].includes(mask));}
});

test("canonical melee renders source blades, compressed body and eyes once per shared cached pose",async()=>{
 const {renderer}=await art(),agent=unit(),before=JSON.stringify(agent),sprite=renderer.frame(agent,10.300001);
 assert.equal(sprite.width,512);assert.equal(sprite.height,512);assert.equal(sprite.combatCamera,undefined);
 assert.ok(paths(sprite).includes("DesignAssets/Animations/CombatAttributesV7/sprout/blade/AttackParts/body.png"));
 assert.ok(paths(sprite).includes("DesignAssets/Animations/CombatAttributesV7/sprout/blade/AttackParts/foliage-left.png"));
 assert.ok(sprite.calls.length>100);assert.ok(paths(sprite).every(path=>!path.includes("UnitAppearanceV1")&&!path.endsWith("/attack.png")));
 assert.equal(renderer.frame(unit({id:"other",attack:{startedAt:20,speed:1}}),20.300001),sprite);assert.equal(JSON.stringify(agent),before);
});

test("hidden secretion retains ranged recoil and never triggers a melee blade swing",async()=>{
 const {renderer}=await art(),attributes={blade:1,secretion:1,antenna:1,carapace:1,feet:1};
 assert.ok(paths(renderer.frame(unit({attributes}),10.3)).some(path=>path.includes("AttackParts")));
 for(const flag of [{mode:"ranged"},{attackMode:"ranged"},{dnaRanged:true}]){
  const agent=unit({attributes,attack:{startedAt:10,launchedAt:10.3,hitAt:10.6,endsAt:11,...flag}});
  assert.equal(combatEvolutionPose(agent,10.3,animations).action,"ranged");assert.deepEqual(paths(renderer.frame(agent,10.3)),[animations.idle.image]);
 }
});

test("cancel, hurt, birth, death, walk, harvest, neutral species and portrait preserve existing paths",async()=>{
 const {renderer}=await art();renderer.frame(unit(),10.3);
 for(const patch of [{attack:null},{attack:null,hurtStartedAt:10.2},{birth:{startedAt:10,readyAt:11}},{health:0,diedAt:10.1},{attack:null,moveStartedAt:10,moveDuration:1},{attack:null,mode:"harvest",harvestStarted:10},{species:"beetle"},{attack:{startedAt:11,speed:1}}]){
  assert.ok(!paths(renderer.frame(unit(patch),10.3)).some(path=>path.includes("sprout/blade/AttackParts/body.png")),JSON.stringify(patch));
 }
 assert.deepEqual(paths(renderer.portrait(unit())),[animations.idle.image]);assert.ok(paths(renderer.frame(unit(),10.3)).some(path=>path.includes("AttackParts")));
});

test("missing or mismatched source registration falls back without poisoning the pose cache",async()=>{
 for(const key of ["ready","badSize"]){const h=harness();h.state[key]=key!=="ready";const {renderer}=await art(h);
  assert.deepEqual(paths(renderer.frame(unit(),10.3)),[animations.attack.image]);h.state[key]=key==="ready";
  assert.ok(paths(renderer.frame(unit(),10.3)).some(path=>path.includes("AttackParts")));
 }
 const rig=definition(),im=images(rig);for(const scale of [Infinity,NaN,"0.357",0,-1])assert.equal(prepareBeanDominantAttack({...rig,scale},im),null);assert.equal(prepareBeanDominantAttack({...rig,approvedSource:"pending.png"},im),null);
 assert.equal(prepareBeanDominantAttack({...rig,root:[239,368]},im),null);delete im["attack-foliage-left"];assert.equal(prepareBeanDominantAttack(rig,im),null);
});

test("all sampled meshes stay positive, neutral endpoints match, and source geometry stays unchanged",()=>{
 const rig=definition(),before=JSON.stringify(rig),prepared=prepareBeanDominantAttack(rig,images(rig));assert.ok(prepared);
 for(let time=0;time<=1000;time+=5){const sample=sampleBeanDominantAttack(prepared,time);assert.ok(sample);assert.ok(sample.mapped.body.every(point=>point.every(Number.isFinite)));
  if(sample.neutralBody)assert.deepEqual(sample.mapped.body,prepared.meshes.body.points);
  prepared.meshes.body.points.forEach((point,i)=>{if(point[1]>=360)assert.deepEqual(sample.mapped.body[i],point);});
 }
 for(const time of [-1,1001,Infinity,NaN])assert.equal(sampleBeanDominantAttack(prepared,time),null);
 assert.equal(sampleBeanDominantAttack({...prepared,meshes:{...prepared.meshes,body:{...prepared.meshes.body,areas:prepared.meshes.body.areas.map(x=>-x)}}},300),null);assert.equal(JSON.stringify(rig),before);
});

test("real hit clocks, accelerated attacks, multi-hit samples and restored state are read-only",async()=>{
 const {renderer}=await art();
 for(const start of [0,10,500])for(const duration of [.15,.6,1.2]){
  const agent=unit({combat:{version:2},attack:{combatId:"bean-clock",startedAt:start,hitAt:start+duration*.3,endsAt:start+duration}}),copy=JSON.parse(JSON.stringify(agent));
  for(const time of [start,start+duration*.3,start+duration*.6]){
   assert.deepEqual(combatEvolutionPose(agent,time,animations),combatEvolutionPose(copy,time,animations));assert.equal(renderer.frame(agent,time),renderer.frame(copy,time));
   assert.ok(paths(renderer.frame(agent,time)).some(path=>path.includes("AttackParts")));
  }
  assert.equal(combatEvolutionPose(agent,start+duration*.3,animations).sampleTime,300);
  assert.deepEqual(paths(renderer.frame({...agent,attack:null},start+duration)),[animations.idle.image]);
 }
 for(const contacts of [[10.08],[10.08,10.2,10.32,10.44]]){
  const agent=unit({combat:{version:2},attack:{combatId:"bean-combo",startedAt:10,hitAt:contacts.at(-1),endsAt:contacts.at(-1),meleeContacts:contacts}}),before=JSON.stringify(agent);
  const expected=renderer.frame(agent,contacts[0]);
  for(const at of contacts){assert.equal(combatEvolutionPose(agent,at,animations).sampleTime,300);assert.equal(renderer.frame(agent,at),expected);}
  assert.deepEqual(paths(renderer.frame(agent,contacts.at(-1)+.0001)),[animations.idle.image]);
  assert.equal(JSON.stringify(agent),before);
 }
});

test("draw errors discard the private candidate and restore context before using the existing sheet",async()=>{
 const h=harness(),{renderer}=await art(h);h.state.drawFailure=true;assert.deepEqual(paths(renderer.frame(unit(),10.3)),[animations.attack.image]);
 h.state.drawFailure=false;assert.ok(paths(renderer.frame(unit(),10.3)).some(path=>path.includes("AttackParts")));
 const rig=definition(),im=images(rig);im["attack-body"].file="sprout/blade/AttackParts/body.png";const prepared=prepareBeanDominantAttack(rig,im),context=h.surface(512,512).getContext("2d");context.translate(12,34);const before=context.getTransform();h.state.drawFailure=true;
 assert.equal(renderBeanDominantAttack(context,sampleBeanDominantAttack(prepared,300)),false);assert.deepEqual(context.getTransform(),before);
});
