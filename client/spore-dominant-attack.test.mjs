import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sporeDominantAttackAppearance, prepareSporeDominantAttack, sampleSporeDominantAttack, renderSporeDominantAttack } from "./spore-dominant-attack.mjs";
import { createCombatEvolutionArt, combatEvolutionPose } from "./combat-evolution.mjs";
import { COMBAT_EVOLUTION_CATALOG } from "./combat-evolution-assets.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
const read = path => fs.readFileSync(new URL("../" + path, import.meta.url));
const definition = () => JSON.parse(read("DesignAssets/Animations/CombatAttributesV7/spore/blade/rig.json"));
const animations = COMBAT_EVOLUTION_CATALOG["spore/blade"].animations;
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function harness() {
  const state={ready:true,badSize:false,drawFailure:false};
  const surface=(width,height)=>{
    const result={width,height,calls:[]};let m=[1,0,0,1,0,0],stack=[];
    const context={canvas:result,globalAlpha:1,globalCompositeOperation:"source-over",save(){stack.push({m:[...m],alpha:this.globalAlpha,operation:this.globalCompositeOperation});},restore(){const s=stack.pop();m=s.m;this.globalAlpha=s.alpha;this.globalCompositeOperation=s.operation;},transform(...b){m=mul(m,b);},translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},getTransform(){return Object.fromEntries(["a","b","c","d","e","f"].map((k,i)=>[k,m[i]]));},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},rect(){},drawImage(image,...args){if(state.drawFailure&&image.file?.endsWith("spore/blade/AttackParts/body.png"))throw Error("Unavailable pixels");result.calls.push({image,args,matrix:[...m]});},getImageData(){return{data:new Uint8ClampedArray(width*height*4)};}};
    result.getContext=()=>context;return result;
  };
  const load=async file=>({file,get complete(){return !file.endsWith("spore/blade/AttackParts/body.png")||state.ready;},width:512,get height(){return state.badSize&&file.endsWith("spore/blade/AttackParts/body.png")?512:322;}});
  return {state,surface,load};
}
async function art(h=harness()){const renderer=createCombatEvolutionArt(path=>"data:application/json;base64,"+read(path).toString("base64"),h.surface,h.load);await renderer.prepare("spore");return{...h,renderer};}
const unit=overrides=>({id:"spore-canonical",tribe:"spore",attributes:{blade:1},health:10,bornAt:0,hurtStartedAt:-Infinity,attack:{startedAt:10,speed:1},...overrides});
const paths=sprite=>sprite.calls.map(call=>call.image.file).filter(Boolean);
const images=rig=>Object.fromEntries(rig.parts.flatMap(part=>[[part.id,{width:512,height:322}],...["body","cap-left"].includes(part.id)?[["attack-"+part.id,{width:512,height:322}]]:[]]));

test("only projected canonical spore blade opts into its own-art attack",()=>{
 assert.equal(sporeDominantAttackAppearance("spore",{blade:1}),true);
 for(const extra of ["strength","arms","piercing","antenna","carapace","feet","legs","secretion"])assert.equal(sporeDominantAttackAppearance("spore",{blade:1,[extra]:1}),false);
 for(const tribe of ["bean","pebble","spring"])assert.equal(sporeDominantAttackAppearance(tribe,{blade:1}),false);
 for(let mask=1;mask<32;mask+=2){const attributes=Object.fromEntries(["blade","carapace","antenna","feet","secretion"].map((k,i)=>[k,(mask>>i)&1]));assert.equal(sporeDominantAttackAppearance("spore",unitDisplayAttributes(unit({attributes}))), [1, 9].includes(mask));}
});





test("all sampled meshes stay positive, neutral endpoints match, and source geometry stays unchanged",()=>{
 const rig=definition(),before=JSON.stringify(rig),prepared=prepareSporeDominantAttack(rig,images(rig));assert.ok(prepared);
 for(let time=0;time<=1000;time+=5){const sample=sampleSporeDominantAttack(prepared,time);assert.ok(sample);assert.ok(sample.motion.every(Number.isFinite));
  if(sample.neutral)assert.deepEqual(sample.points,prepared.vertices);
 }
 for(const time of [-1,1001,Infinity,NaN])assert.equal(sampleSporeDominantAttack(prepared,time),null);
 assert.equal(sampleSporeDominantAttack({...prepared,areas:prepared.areas.map(x=>-x)},300),null);assert.equal(JSON.stringify(rig),before);
});

test("horizontal cap swing crosses the target side without vertical chopping or moving planted support",()=>{
 const rig=definition(),prepared=prepareSporeDominantAttack(rig,images(rig));
 for(let time=0;time<=1000;time+=5){
  const sample=sampleSporeDominantAttack(prepared,time);assert.ok(sample);
  assert.equal(sample.motion[1],0);assert.equal(sample.motion[2],0);assert.equal(sample.motion[4],1);
  for(let i=0;i<prepared.vertices.length;i++){
   assert.equal(sample.points[i][1],prepared.vertices[i][1]);
   if(prepared.vertices[i][1]>=310)assert.deepEqual(sample.points[i],prepared.vertices[i]);
  }
 }
 const windup=sampleSporeDominantAttack(prepared,240),turn=sampleSporeDominantAttack(prepared,280);
 const contact=sampleSporeDominantAttack(prepared,300),follow=sampleSporeDominantAttack(prepared,370);
 assert.ok(windup.motion[3]<-.8);assert.ok(turn.motion[3]>0&&turn.motion[3]<.5);
 assert.ok(contact.motion[3]>1);assert.ok(follow.motion[0]>contact.motion[0]);
 assert.equal(contact.index,5);assert.equal(contact.motion[8],.5588235294117647);
 const pivot=prepared.parts["cap-left"].pivot,tipX=sample=>pivot[0]+sample.motion[0]+(505-pivot[0])*sample.motion[3];
 assert.ok(tipX(windup)<pivot[0]);assert.ok(tipX(contact)>pivot[0]);
 assert.ok(tipX(contact)-tipX(windup)>550);
 const h=harness(),render=sample=>{const surface=h.surface(512,512);assert.equal(renderSporeDominantAttack(surface.getContext("2d"),sample),true);return surface.calls;};
 const before=render(windup),hit=render(contact),cap=list=>list.find(call=>call.image===prepared.images["cap-left"]);
 assert.ok(cap(before).matrix[0]<0);assert.ok(cap(hit).matrix[0]>0);
 assert.equal(cap(before).matrix[1],0);assert.equal(cap(hit).matrix[1],0);
 assert.equal(cap(before).matrix[5],cap(hit).matrix[5]);
 for(const id of ["foot-0","foot-1"])assert.deepEqual(before.find(call=>call.image===prepared.images[id]).matrix,hit.find(call=>call.image===prepared.images[id]).matrix);
});
