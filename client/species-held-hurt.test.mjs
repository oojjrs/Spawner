import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { speciesHeldHurtSource, speciesHeldHurtPose, drawSpeciesHeldHurt, SPECIES_HELD_HURT_ASSETS } from './species-held-hurt.mjs';
import { SPECIES_HELD_HURT_SOURCES } from './species-held-hurt-assets.mjs';
import { beanHeldHurtAmount } from './bean-held-hurt.mjs';
import { unitAnimationPose } from './unit-animation.mjs';
import { unitRangedPose } from './unit-ranged.mjs';
import { unitDisplaySize, unitFacing } from './unit-size.mjs';
import { imageDimensions } from './image-audit.mjs';
import { createSimulationTrial } from './combat-simulation.mjs';

// The user removed obsolete Spore birth metadata in dd1e1d2e. These exact
// post-removal hashes retain the original held-hurt rig geometry and pixels.
const retiredBirthMetadataHashes = {
 'DesignAssets/Animations/CombatAttributesV7/spore/blade/rig.json':'9be58cc7481732be00d35247771920439fc66fb69af02b1e1404211c236c20c7',
 'DesignAssets/Animations/CombatAttributesV7/spore/piercing/rig.json':'705eb5ff528c786996fa5f062b4406d74e9f2971487b6e01eca92933edf9b622',
 'DesignAssets/Animations/CombatAttributesV7/spore/carapace/rig.json':'19d0227b2479e746b380f2fc16b1c4e69527dace21f3dbc7ac691c825850e73c',
};
const currentInputHash = (path, original) => retiredBirthMetadataHashes[path] || original;

const tribes=['spore','pebble','spring'];
const forms=['base','blade','carapace','secretion','antenna','feet'];
const unit=(tribe='spore',key='base',patch={})=>({id:'candidate',tribe,health:10,hurtStartedAt:10,facing:1,attributes:key==='base'?{}:{[key]:1},...patch});
const images=new Map(SPECIES_HELD_HURT_ASSETS.map(path=>{const[width,height]=imageDimensions(path);return[path,{path,width,height,complete:true}]}));
const context=()=>({calls:[],save(){},restore(){},translate(...a){this.calls.push(['translate',...a])},scale(...a){this.calls.push(['scale',...a])},drawImage(...a){this.calls.push(['draw',...a])}});

test('eighteen own-source forms use the same real-time half-second hold and recovery',()=>{
 assert.equal(SPECIES_HELD_HURT_ASSETS.length,18);
 for(const tribe of tribes)for(const form of forms){
  const a=unit(tribe,form);
  for(const age of [0,.01,.12,.3,.499999,.5]){const p=speciesHeldHurtPose(a,10+age);assert.equal(p.source,SPECIES_HELD_HURT_SOURCES[tribe][form]);assert.equal(p.amount,1);assert.equal(p.hold,true);}
  for(const age of [.52,.6,.66,.72,.84,.875])assert.ok(Math.abs(speciesHeldHurtPose(a,10+age).amount-beanHeldHurtAmount(age))<1e-12);
  assert.equal(speciesHeldHurtPose(a,10.881),null);assert.equal(speciesHeldHurtPose(a,9.999),null);
 }
});
test('dominance and legacy guards do not replace unsupported artwork',()=>{
 for(const tribe of ['spore','pebble','spring']){
  for(const key of ['strength','arms','piercing','guard'])assert.equal(speciesHeldHurtSource(unit(tribe,'base',{attributes:{[key]:1}})),null,key);
  assert.equal(speciesHeldHurtSource(unit(tribe,'base',{attributes:{blade:1,secretion:1,carapace:1,feet:1}})),null);
  assert.equal(speciesHeldHurtSource(unit(tribe,'base',{attributes:{blade:1,feet:1}})),SPECIES_HELD_HURT_SOURCES[tribe].blade);
  assert.equal(speciesHeldHurtSource(unit(tribe,'base',{attributes:{legs:1}})),SPECIES_HELD_HURT_SOURCES[tribe].feet);
  // Combinations use their own authored hurt while a single gland keeps its source.
  assert.equal(speciesHeldHurtSource(unit(tribe,'base',{attributes:{secretion:1,carapace:1,feet:1}})),null);
  assert.equal(speciesHeldHurtSource(unit(tribe,'base',{attributes:{secretion:1,feet:1}})),SPECIES_HELD_HURT_SOURCES[tribe].secretion);
  for(const patch of [{health:0},{kind:'corpse'},{birth:{startedAt:10}},{species:'beetle'},{hurtStartedAt:NaN}])assert.equal(speciesHeldHurtPose(unit(tribe,'base',patch),10.2),null);
 }
 assert.equal(speciesHeldHurtSource(unit('bean')),null);
});
test('new hits restart the visible hold without changing attacks, shooting or motion',()=>{
 for(const tribe of tribes)for(const form of forms){
  const attack=form==='secretion'?{mode:'ranged',startedAt:10,launchedAt:10.2,hitAt:10.4,endsAt:11}:{startedAt:10,hitAt:10.3,endsAt:11};
  const a=unit(tribe,form,{combat:{version:2},attack,moveStartedAt:10,moveDuration:1});const before=JSON.stringify(a);
  const old=unitAnimationPose(a,10.6);const ranged=unitRangedPose(a,10.6);
  assert.equal(speciesHeldHurtPose({...a,hurtStartedAt:10.3},10.7).amount,1);
  assert.deepEqual(unitAnimationPose(a,10.6),old);assert.deepEqual(unitRangedPose(a,10.6),ranged);assert.equal(JSON.stringify(a),before);
 }
});
test('both strike directions and facing retain camera, native crop and source orientation',()=>{
 for(const tribe of tribes)for(const form of forms)for(const mirror of [false,true])for(const hitSide of [-1,1]){
  const a=unit(tribe,form),s=speciesHeldHurtSource(a),ctx=context(),before=JSON.stringify(a),scale=250*unitDisplaySize(a)/s.referenceLength;
  assert.ok(drawSpeciesHeldHurt(ctx,a,10.2,p=>images.get(p),{cell:250,mirror,hitSide}));
  const nativeFacing=["blade","carapace"].includes(form)?-1:1,displayFacing=(mirror?-1:1)*nativeFacing;
  const i=hitSide*displayFacing>0?s.times.length:0,draw=ctx.calls.find(c=>c[0]==='draw');
  assert.deepEqual(draw.slice(2,6),[i%s.columns*s.frameWidth,Math.floor(i/s.columns)*s.frameHeight,s.frameWidth,s.frameHeight]);
  assert.deepEqual(draw.slice(6),[-s.pivotX*scale,-s.pivotY*scale,s.frameWidth*scale,s.frameHeight*scale]);
  assert.deepEqual(ctx.calls.find(c=>c[0]==='scale'),['scale',displayFacing,1]);assert.equal(JSON.stringify(a),before);
 }
});
test('unavailable, partial and expired images fall through and loading recovers without timer reset',()=>{
 const a=unit(),ctx=context();
 assert.equal(drawSpeciesHeldHurt(ctx,a,10.2,()=>null),false);
 assert.equal(drawSpeciesHeldHurt(ctx,a,10.2,()=>({width:10,height:10,complete:true})),false);
 assert.equal(drawSpeciesHeldHurt(ctx,a,10.2,p=>images.get(p),{sourceScale:NaN}),false);
 assert.equal(drawSpeciesHeldHurt(ctx,a,10.45,p=>images.get(p),{sourceScale:.25}),true);
 assert.equal(drawSpeciesHeldHurt(ctx,a,10.881,p=>images.get(p)),false);
 assert.equal(speciesHeldHurtPose(a,10.45).amount,1);
});
test('source hashes, exact native atlases and material constraints match the generated assets',()=>{
 const qa=JSON.parse(fs.readFileSync('tools/species-held-hurt-20261105/verification.json'));
 assert.equal(qa.sources.length,6);
 for(const s of qa.sources){
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.sourceAnimation)).digest('hex'),s.sourceHash);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.image)).digest('hex'),s.atlasSha256);
  assert.deepEqual(imageDimensions(s.image),s.atlasDimensions);assert.ok(s.neutralExact&&s.decodedAtlasExact&&s.noEdgeClipping);
  assert.ok(s.minXDerivative>0&&s.minYDerivative>0);
  if(s.tribe==='pebble')assert.ok(s.rigidBody);else assert.ok(s.fixedLowerPixelsExact);
 }
});
test('observing the optional visual sampler does not alter real simulation outcomes or events',()=>{
 for(const tribe of ['spore','pebble','spring']){
  const settings={left:{key:tribe,organs:{ranged:1},counts:{vitality:3}},right:{key:'bean',organs:{attack:1},counts:{vitality:3}},distance:1,random:false};
  const a=createSimulationTrial(settings),b=createSimulationTrial(settings);
  for(let i=0;i<100;i++){a.advance(.05);b.advance(.05);for(const u of a.agents)speciesHeldHurtPose(u,a.time)}
  assert.deepEqual(a.agents,b.agents);assert.deepEqual(a.history,b.history);assert.deepEqual(a.result(),b.result());
  assert.deepEqual(JSON.parse(JSON.stringify(a.vfx).replaceAll(a.vfx.streamId,'stream')),JSON.parse(JSON.stringify(b.vfx).replaceAll(b.vfx.streamId,'stream')));
 }
});

test('actual world/detail helper preserves native animation scale, secretion scale, growth and routing',async()=>{
 const vm=await import('node:vm');
 const game=fs.readFileSync(new URL('./game.js',import.meta.url),'utf8');
 const helper=game.match(/^    function drawAgentHeldHurt\([^]*?^    }/m)[0];
 const state={simSeconds:10.3},draws=[],ctx=context();
 const Spawner={beanHeldHurtSource:()=>null,speciesHeldHurtSource,unitDisplaySize,unitFacing,
  drawSpeciesHeldHurt:(...a)=>{draws.push(a);return drawSpeciesHeldHurt(...a)}};
 const scope=vm.createContext({Spawner,state,AGENT_HEIGHT:.7,ctx,unitDisplayScale:()=>1.5,agentRangedImage:p=>images.get(p),
  unitAnimationSheets:new Map(['spore','pebble','spring'].map(t=>[t,new Map([['idle',{scale:1.25}]])])),unitBodySize:()=>{throw new Error('Wrong body fallback')}});
 vm.runInContext(helper,scope);
 for(const tribe of tribes)for(const form of forms)for(const externalScale of [1,1.5]){
  const a=unit(tribe,form,{stats:{pieceCount:5},facing:-1}),before=JSON.stringify(a),s=speciesHeldHurtSource(a);
  assert.equal(scope.drawAgentHeldHurt(ctx,a,100,50,80,null,externalScale),true);
  const options=draws.at(-1)[4];
  const expected=s.worldScale==='animation'?100*.7*1.25/s.nativeFrameSize*1.5/externalScale:s.worldScale==='evolution'?100*.7*2/512*1.5/externalScale:100*unitDisplaySize(a)/s.referenceLength/externalScale;
  assert.ok(Math.abs(options.sourceScale-expected)<1e-12);assert.equal(options.mirror,true);assert.equal(JSON.stringify(a),before);
 }
 assert.match(game,/frozen && \(agent.tribe \|\| "bean"\) !== "bean" && !Spawner.speciesHeldHurtSource\?\.\(agent\)/);
 assert.match(game,/Spawner.speciesHeldHurtSource\?\.\(visual\)\) && drawAgentHeldHurt/);
});
test('actual laboratory stage draws each held source once through attack overlap, hit reset, and expiry',async()=>{
 const vm=await import('node:vm');const{createCombatStage}=await import('./combat-stage.mjs');
 const helpers=fs.readFileSync(new URL('./combat-stage-vfx.test.mjs',import.meta.url),'utf8');
 const box={assert,createCombatStage,globalThis,setImmediate};vm.createContext(box);vm.runInContext(helpers.slice(helpers.indexOf('const root ='),helpers.indexOf('\ntest(')),box);
 for(const tribe of tribes)for(const form of forms)for(const side of [0,1])await box.withStage(async({draw,calls})=>{
  const{trial}=box.setup();const target=trial.agents[side];Object.assign(target,unit(tribe,form,{id:target.id,stats:{health:100},combat:{version:2,side}}));
  target.hurtStartedAt=1;target.attack=form==='base'?{startedAt:1,hitAt:1.3,endsAt:2}:{mode:'ranged',startedAt:1,launchedAt:1.2,hitAt:1.4,endsAt:2};trial.time=1.45;
  const before=JSON.stringify(trial.agents);await draw(trial);
  const held=()=>calls.filter(c=>c.name==='drawImage'&&['/SpeciesHeldHurtV1/','/MinorHeldHurtV1/'].some(folder=>c.args[0]?.src.includes(folder)));
  assert.equal(held().length,1);assert.ok(held()[0].args[0].src.endsWith('/'+tribe+'-'+form+'.webp'));assert.equal(JSON.stringify(trial.agents),before);
  target.hurtStartedAt=1.4;trial.time=1.85;await draw(trial);assert.equal(held().length,1);
  trial.time=2.281;await draw(trial);assert.equal(held().length,0);
 });
});
test('all eighteen native atlases are registered without promoting unfinished action sets',async()=>{
 const{auditImages}=await import('./image-audit.mjs');const{unitAppearanceInventory}=await import('./unit-appearance.mjs');
 assert.equal(auditImages(process.cwd(),SPECIES_HELD_HURT_ASSETS),18);assert.equal(unitAppearanceInventory().filter(r=>r.worldReady).length,0);
});

test('six live V7 blade and carapace sources preserve rig landmarks and material constraints',()=>{
 const qa=JSON.parse(fs.readFileSync('tools/weapons-held-hurt-20261105/verification.json'));
 const provenance=JSON.parse(fs.readFileSync('tools/weapons-held-hurt-20261105/source-metadata.json'));
 assert.equal(qa.sources.length,6);
 for(const [path,hash] of Object.entries(provenance.inputs))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),currentInputHash(path,hash),path);
 for(const s of qa.sources){
  assert.equal(speciesHeldHurtSource(unit(s.tribe,s.form)),SPECIES_HELD_HURT_SOURCES[s.tribe][s.form]);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.sourceImage)).digest('hex'),s.sourceHash);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.sourceRig)).digest('hex'),currentInputHash(s.sourceRig,s.rigHash));
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.image)).digest('hex'),s.atlasSha256);
  assert.deepEqual(imageDimensions(s.image),s.atlasDimensions);
  assert.ok(s.liveRigLandmarks&&s.neutralExact&&s.decodedAtlasExact&&s.noEdgeClipping);
  assert.ok(s.minXDerivative>0&&s.minYDerivative>0);
  assert.equal(s.worldScale,'evolution');assert.equal(s.nativeFrameSize,512);assert.equal(s.times.length,14);
  if(s.tribe==='pebble')assert.ok(s.rigidBody);else assert.ok(s.fixedLowerPixelsExact);
 }
});
