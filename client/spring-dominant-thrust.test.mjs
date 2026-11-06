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
  for(let mask=1;mask<32;mask+=2){const attributes=Object.fromEntries(["blade","carapace","antenna","feet","secretion"].map((key,i)=>[key,(mask>>i)&1]));assert.ok(springDominantThrustAppearance("spring",unitDisplayAttributes(unit({attributes}))));}
});

test("real compositor renders canonical attacks in the padded camera and caches each pose across agents",async()=>{
  const {renderer,state}=await art(),agent=unit(),before=JSON.stringify(agent);
  const sprite=renderer.frame(agent,10.300001);assert.deepEqual(sprite.combatCamera,SPRING_THRUST_CAMERA);assert.equal(sprite.width,896);assert.equal(sprite.height,640);
  assert.ok(paths(sprite).includes("DesignAssets/Animations/CombatAttributesV7/spring/blade/Parts/body.png"));
  assert.ok(paths(sprite).every(path=>!path.includes("/attack.png")&&!path.includes("AttackEffects")));
  assert.equal(state.reads,1);assert.equal(renderer.frame(unit({id:"other",attack:{startedAt:20,speed:1}}),20.300001),sprite);assert.equal(state.reads,1);
  assert.equal(JSON.stringify(agent),before);
});

test("mixed builds keep canonical melee while actual ranged launches retain the old recoil sheet",async()=>{
  const {renderer}=await art(),attributes={blade:1,secretion:1,feet:1,antenna:1,carapace:1};
  assert.equal(renderer.frame(unit({attributes}),10.300001).width,896);
  for(const flag of [{mode:"ranged"},{attackMode:"ranged"},{dnaRanged:true}]){
    const agent=unit({attributes,attack:{startedAt:10,launchedAt:10.3,hitAt:10.6,endsAt:11,...flag}}),sprite=renderer.frame(agent,10.3);
    assert.equal(sprite.width,512);assert.equal(sprite.combatCamera,undefined);assert.deepEqual(paths(sprite),[animations.idle.image]);
    assert.equal(combatEvolutionPose(agent,10.3,animations).action,"ranged");
  }
});

test("cancel, hurt, birth, death, walk, harvest, portrait and unsupported sources preserve their direct paths",async()=>{
  const {renderer}=await art();renderer.frame(unit(),10.3);
  for(const changes of [{attack:null},{attack:null,hurtStartedAt:10.2},{birth:{startedAt:10,readyAt:11}},{health:0,diedAt:10.1},
    {attack:null,moveStartedAt:10,moveDuration:1},{attack:null,mode:"harvest",harvestStarted:10},{species:"beetle"}]){
    const sprite=renderer.frame(unit(changes),10.3);assert.equal(sprite.width,512);assert.equal(sprite.combatCamera,undefined);
  }
  const portrait=renderer.portrait(unit());assert.equal(portrait.width,512);assert.deepEqual(paths(portrait),[animations.idle.image]);
  assert.equal(renderer.frame(unit(),10.300001).width,896,"retrigger is not poisoned by the neutral cache");
});

test("missing, tainted or mismatched source registration falls back and retries successfully",async()=>{
  for(const kind of ["missing","tainted"]){const h=harness();if(kind==="missing")h.state.ready=false;else h.state.tainted=true;
    const {renderer}=await art(h),waiting=renderer.frame(unit(),10.3);assert.equal(waiting.width,512);assert.deepEqual(paths(waiting),[animations.attack.image]);
    h.state.ready=true;h.state.tainted=false;const recovered=renderer.frame(unit(),10.3);assert.equal(recovered.width,896);assert.notEqual(recovered,waiting);assert.equal(renderer.frame(unit(),10.3),recovered);
  }
  const h=harness();h.state.badDimensions=true;const {renderer}=await art(h);assert.equal(renderer.frame(unit(),10.3).width,512);assert.equal(h.state.reads,0);
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

test("actual hit clocks, multi-hit recovery and saved state preserve the visual sampling contract",async()=>{
  const {renderer}=await art();
  for(const start of [0,10,500])for(const duration of [.15,.6,1.2]){
    const agent=unit({combat:{version:2},attack:{startedAt:start,hitAt:start+duration*.3,endsAt:start+duration}}),copy=JSON.parse(JSON.stringify(agent));
    for(const time of [start,start+duration*.3,start+duration*.6]){
      assert.deepEqual(combatEvolutionPose(agent,time,animations),combatEvolutionPose(copy,time,animations));
      assert.equal(renderer.frame(agent,time).width,896);assert.equal(renderer.frame(copy,time),renderer.frame(agent,time));
    }
    assert.equal(renderer.frame({...agent,attack:null},start+duration).width,512);
  }
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

test("a draw exception unwinds transforms, discards the private frame and retries only the old sheet",async()=>{
  const h=harness(),{renderer}=await art(h);h.state.drawFailure=true;
  const fallback=renderer.frame(unit(),10.3);assert.equal(fallback.width,512);assert.deepEqual(paths(fallback),[animations.attack.image]);
  h.state.drawFailure=false;assert.equal(renderer.frame(unit(),10.3).width,896);
  const rig=definition(),images=Object.fromEntries(rig.parts.map(part=>[part.id,{file:"DesignAssets/Animations/CombatAttributesV7/spring/blade/Parts/"+part.id+".png",width:part.width,height:part.height}]));
  const prepared=prepareSpringDominantThrust(rig,images,h.surface),sample=sampleSpringDominantThrust(prepared,300),surface=h.surface(896,640),context=surface.getContext("2d");
  context.translate(192,64);const before=context.getTransform();h.state.drawFailure=true;
  assert.equal(renderSpringDominantThrust(context,sample),false);assert.deepEqual(context.getTransform(),before);assert.equal(context.globalCompositeOperation,"source-over");
});

test("the real world/detail draw function preserves padded pivot, facing, size and outline coordinates",async()=>{
  const {renderer,surface}=await art(),source=unitPresentationTestSource(readFileSync(new URL("./game.js",import.meta.url),"utf8")),outlines=[];
  const scope={Spawner:{unitDisplayAttributes,combatAttributeKeys,hasCombatEvolution,unitAnimationPose:()=>({action:"attack"})},state:{simSeconds:10.3},idleMotion:{matches:false},AGENT_HEIGHT:.7,
    unitAnimationSheets:new Map(),drawCombatAgentAttributes(){},drawAgentAppearanceBody(){throw Error("Unexpected base fallback");},drawSelectionOutline:(...args)=>outlines.push(args),
    combatAttributeArt:{ready:()=>true,frame:(agent,time,scale,drawBody,drawAttributes)=>renderer.frame(agent,time,drawAttributes,drawBody)}};
  vm.createContext(scope);vm.runInContext(source.match(/^    function drawAgentAppearanceLayer\([^]*?^    }/m)[0],scope);
  for(const cell of [8,50,140])for(const facing of [-1,1])for(const dpr of [1,2,3]){
    const canvas=surface(1024,1024),context=canvas.getContext("2d");context.scale(dpr,dpr);
    scope.drawAgentAppearanceLayer(context,0,unit({facing}),cell,{x:0,y:0},null,null,"selected");
    const call=canvas.calls.at(-1),scale=cell*.7*2/512;assert.deepEqual(call.image.combatCamera,SPRING_THRUST_CAMERA);
    assert.equal(call.matrix[0],dpr*facing);assert.equal(call.matrix[3],dpr);
    for(const [actual,expected]of call.args.map((value,i)=>[value,[-448*scale,-512*scale,896*scale,640*scale][i]]))assert.ok(Math.abs(actual-expected)<1e-10);
    assert.deepEqual(outlines.at(-1).slice(1,5),call.args);
  }
});
