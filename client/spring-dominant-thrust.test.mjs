import { unitPresentationTestSource } from "./unit-presentation-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { springDominantThrustAppearance, springDominantThrustPose, prepareSpringDominantThrust, sampleSpringDominantThrust, renderSpringDominantThrust } from "./spring-dominant-thrust.mjs";
import { createCombatEvolutionArt, combatEvolutionPose } from "./combat-evolution.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { COMBAT_EVOLUTION_CATALOG } from "./combat-evolution-assets.mjs";
import { combatAttributeKeys, hasCombatEvolution } from "./combat-attributes.mjs";
import { SPRING_THRUST_CAMERA } from "./spring-attachment-thrust.mjs";

const read = path => readFileSync(new URL("../" + path, import.meta.url));
const definition = () => JSON.parse(read("DesignAssets/Animations/CombatAttributesV7/spring/blade/rig.json"));
const animations = COMBAT_EVOLUTION_CATALOG["spring/blade"].animations;
const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function harness() {
  const state = { ready: true, reads: 0, badDimensions: false, tainted: false };
  const surface = (width,height) => {
    let matrix=[1,0,0,1,0,0], stack=[]; const result={width,height,calls:[]};
    const context={canvas:result,globalAlpha:1,globalCompositeOperation:"source-over",
      save(){stack.push({matrix:[...matrix],alpha:this.globalAlpha,operation:this.globalCompositeOperation});},
      restore(){const value=stack.pop();matrix=value.matrix;this.globalAlpha=value.alpha;this.globalCompositeOperation=value.operation;},
      transform(...m){matrix=multiply(matrix,m);},translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},
      getTransform(){return Object.fromEntries(["a","b","c","d","e","f"].map((key,i)=>[key,matrix[i]]));},
      beginPath(){},moveTo(){},lineTo(){},closePath(){},rect(){},clip(){},
      getImageData(){state.reads++;if(state.tainted)throw Error("Unavailable source pixels");const data=new Uint8ClampedArray(width*height*4);if(state.ready&&width===428&&height===391)data[(8*width+426)*4+3]=255;return{data};},
      drawImage(image,...args){if(state.drawFailure&&state.reads>0&&image?.file?.endsWith("spring/blade/Parts/body.png"))throw Error("Transient body draw failure");result.calls.push({image,args,matrix:[...matrix],alpha:this.globalAlpha,operation:this.globalCompositeOperation});}};
    result.getContext=()=>context;return result;
  };
  const load=async file=>({file,width:file.endsWith("spring/blade/Parts/body.png")&&!state.badDimensions?428:512,height:file.endsWith("spring/blade/Parts/body.png")&&!state.badDimensions?391:512});
  return {state,surface,load};
}
async function art(h=harness()) {const renderer=createCombatEvolutionArt(path=>"data:application/json;base64,"+read(path).toString("base64"),h.surface,h.load);await renderer.prepare("spring");return {...h,renderer};}
const unit = overrides => ({id:"canonical-spring",tribe:"spring",attributes:{blade:1},health:10,bornAt:0,hurtStartedAt:-Infinity,attack:{startedAt:10,speed:1},...overrides});
const paths = sprite => sprite.calls.map(call=>call.image?.file).filter(Boolean);

test("only the projected canonical spring blade uses the new adapter",()=>{
  assert.ok(springDominantThrustAppearance("spring",{blade:1}));
  for(const attributes of [{}, {blade:1,strength:1}, {blade:1,arms:1}, {blade:1,piercing:1}, {blade:1,carapace:1}, {blade:1,antenna:1}, {blade:1,feet:1}, {blade:1,secretion:1}])assert.equal(springDominantThrustAppearance("spring",attributes),false);
  for(const tribe of ["bean","spore","pebble"])assert.equal(springDominantThrustAppearance(tribe,{blade:1}),false);
  for(let mask=1;mask<32;mask+=2){const attributes=Object.fromEntries(["blade","carapace","antenna","feet","secretion"].map((key,i)=>[key,(mask>>i)&1]));assert.equal(springDominantThrustAppearance("spring",unitDisplayAttributes(unit({attributes}))), [1, 9].includes(mask));}
});





test("the prepared source is read-only, retains exact neutral geometry, and validates every sampled mesh",()=>{
  const rig=definition(),before=JSON.stringify(rig),h=harness(),images=Object.fromEntries(rig.parts.map(part=>[part.id,{width:part.width,height:part.height}]));
  const prepared=prepareSpringDominantThrust(rig,images,h.surface);assert.ok(prepared);
  for(let time=0;time<=1000;time+=5){const sample=sampleSpringDominantThrust(prepared,time);assert.ok(sample);
    for(const point of prepared.points)if(point[1]>=sample.mapping.source[1])assert.deepEqual(sample.mapping.point(point),point);
    if([0,860,940,1000].includes(time))assert.deepEqual(sample.points,prepared.points);
  }
  assert.equal(JSON.stringify(rig),before);
  for(const time of [-1,NaN,Infinity,1001])assert.equal(sampleSpringDominantThrust(prepared,time),null);
  const invalid={...prepared,areas:prepared.areas.map(value=>-value)};assert.equal(sampleSpringDominantThrust(invalid,300),null);
  assert.equal(springDominantThrustPose(300,rig,[1,rig.face[1]]),null);
});


test("malformed UVs or attack channels retain fallback rather than partially drawing or throwing",()=>{
  const rig=definition(),h=harness(),images=Object.fromEntries(rig.parts.map(part=>[part.id,{width:part.width,height:part.height}]));
  const invalidUv=structuredClone(rig),mesh=invalidUv.attackMotion.meshes.body;
  for(const vertex of mesh.vertices)vertex.point=[...(vertex.point||vertex.uv)];
  const [a,b]=mesh.triangles[0];mesh.vertices[b].uv=[...mesh.vertices[a].uv];
  assert.ok(prepareSpringDominantThrust(invalidUv,images,h.surface)===null);
  for(const patch of [{body:null},{parts:null},{waterChannels:null}]){
    const malformed=structuredClone(rig);Object.assign(malformed.attackMotion,patch);
    const prepared=prepareSpringDominantThrust(malformed,images,h.surface);
    assert.equal(sampleSpringDominantThrust(prepared,300),null);
  }
});
