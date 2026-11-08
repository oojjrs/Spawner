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





test("all sampled meshes stay positive, neutral endpoints match, and source geometry stays unchanged",()=>{
 const rig=definition(),before=JSON.stringify(rig),prepared=prepareBeanDominantAttack(rig,images(rig));assert.ok(prepared);
 for(let time=0;time<=1000;time+=5){const sample=sampleBeanDominantAttack(prepared,time);assert.ok(sample);assert.ok(sample.mapped.body.every(point=>point.every(Number.isFinite)));
  if(sample.neutralBody)assert.deepEqual(sample.mapped.body,prepared.meshes.body.points);
  prepared.meshes.body.points.forEach((point,i)=>{if(point[1]>=360)assert.deepEqual(sample.mapped.body[i],point);});
 }
 for(const time of [-1,1001,Infinity,NaN])assert.equal(sampleBeanDominantAttack(prepared,time),null);
 assert.equal(sampleBeanDominantAttack({...prepared,meshes:{...prepared.meshes,body:{...prepared.meshes.body,areas:prepared.meshes.body.areas.map(x=>-x)}}},300),null);assert.equal(JSON.stringify(rig),before);
});
