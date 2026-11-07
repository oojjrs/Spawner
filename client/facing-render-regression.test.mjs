import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {runInNewContext} from 'node:vm';
test('production body transforms preserve target facing across all 87 appearances', async () => {
const root = process.env.SPAWNER_REPO || new URL('../', import.meta.url).pathname;
const load = name => import(root + 'client/' + name + '.mjs');
const {WELCOME_UNIT_APPEARANCES,welcomeTravelMotion}=await load('welcome-presentation');
const {UNIT_ACTION_ART}=await load('unit-action-art-assets');
const {unitActionArtPose}=await load('unit-action-art');
const {createUnitPresentation}=await load('unit-presentation');
const {createCombatStage}=await load('combat-stage');
const animation=await load('unit-animation');
const {COMBAT_LAB_UNITS}=await load('combat-lab');
const {unitStats}=await import(root+'server/attributes.mjs');
const {TALON_OWL_IDLE}=await load('talon-owl-idle');
const beetle=await import(root+'server/beetle-animation.mjs');
const {CREATURE_RANGED_ANIMATIONS}=await load('creature-ranged');
const {UNIT_COMBINATION_FORMS}=await load('unit-combination-forms');
const forms=['base','gather','antenna','blade','secretion','carapace',...UNIT_COMBINATION_FORMS.map(x=>x.key)];
const truth = {};
const {BEAN_HELD_HURT_SOURCES}=await load('bean-held-hurt-assets');
const {SPECIES_HELD_HURT_SOURCES}=await load('species-held-hurt-assets');
for(const a of [...Object.values(BEAN_HELD_HURT_SOURCES),...Object.values(SPECIES_HELD_HURT_SOURCES).flatMap(Object.values)])truth[a.image]=a.sourceFacing;
for(const d of Object.values(UNIT_ACTION_ART))for(const a of [d.reference,...Object.values(d.actions)])truth[a.image]=a.sourceFacing;
for(const registry of [animation.CREATURE_IDLE_ANIMATIONS,animation.CREATURE_WALK_ANIMATIONS,animation.CREATURE_ATTACK_ANIMATIONS,animation.CREATURE_HURT_ANIMATIONS,animation.CREATURE_DEATH_ANIMATIONS,CREATURE_RANGED_ANIMATIONS])for(const a of Object.values(registry))truth[a.image]=a.sourceFacing||a.facing||'left';
for(const a of [TALON_OWL_IDLE,beetle.BEETLE_SPRITE,beetle.BEETLE_ATTACK_SPRITE])truth[a.image]=a.sourceFacing||a.facing||'left';
truth['DesignAssets/Animations/BeetleDeath/dead-v2.png']='left';
// Optional independent pixel-auditor map takes precedence. Never rewrite metadata to satisfy this test.
if(process.env.FACING_PIXEL_TRUTH)Object.assign(truth,JSON.parse(fs.readFileSync(process.env.FACING_PIXEL_TRUTH,'utf8')));
function surface(width=1040,height=480){let sx=1,sy=1,x=0,y=0;const stack=[],calls=[];const c=new Proxy({save(){stack.push([sx,sy,x,y])},restore(){[sx,sy,x,y]=stack.pop()},setTransform(a,b,c,d,e,f){sx=a;sy=d;x=e;y=f},translate(a,b){x+=sx*a;y+=sy*b},scale(a,b){sx*=a;sy*=b},drawImage(image,...args){calls.push({image:image.src,sx,x,y,args})},getImageData(){return {data:new Uint8ClampedArray(width*height*4).fill(255)}}},{get:(t,k)=>t[k]??(()=>{})});return {width,height,clientWidth:width,clientHeight:height,calls,getContext:()=>c};}
globalThis.window={devicePixelRatio:1,matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>surface(1,1)};
globalThis.SpawnerAssets={source:x=>x};
globalThis.Image=class{complete=true;naturalWidth=4096;naturalHeight=4096;async decode(){}};
const failures=[],counts={world:0,welcome:0,combat:0};
function check(calls,direction,label,kind){const bodies=calls.filter(c=>truth[c.image]);if(!bodies.length){failures.push(label+': no registered body draw');return}for(const call of bodies){counts[kind]++;const actual=Math.sign(call.sx)*(truth[call.image]==='left'?-1:1);if(actual!==direction)failures.push(`${label}: ${call.image} rendered ${actual}, expected ${direction}`)}}
const stateAgent=(a,action)=>({...a,mode:action==='walk'?'walk':'idle',health:action==='death'?0:10,diedAt:0,animationStartedAt:0,moveStartedAt:0,moveDuration:action==='walk'?1:0,stepCount:1,hurtStartedAt:action==='hurt'?0:undefined,attack:['attack','ranged'].includes(action)?{startedAt:0,hitAt:.3,launchedAt:.3,endsAt:1,speed:1,directionX:a.facing,mode:action==='ranged'?'ranged':'melee'}:null});
const presentation=createUnitPresentation({model:{},height:.7,time:()=>.05,reducedMotion:()=>false,displayScale:()=>1,createSurface:surface});
const source=fs.readFileSync(root+'client/welcome-header.js','utf8');
const welcomeDraw=source.slice(source.indexOf('  function drawPreparedUnit('),source.indexOf('  function active('));
for(const tribe of ['bean','spore','pebble','spring'])for(const [i,attributes]of WELCOME_UNIT_APPEARANCES.entries()){
 const base={id:tribe+'/'+forms[i],tribe,attributes,stats:unitStats(attributes,tribe),facing:1};
 for(const action of ['idle','walk','attack','ranged','hurt','death'])for(const facing of [-1,1]){
  const a=stateAgent({...base,facing},action);if(a.attack)a.facing=-facing;const pose=unitActionArtPose(a,.05);assert.equal(pose.reference,UNIT_ACTION_ART[base.id].reference,base.id+' selects actual form');
  await presentation.prepareAnimation(a);presentation.drawAgentAppearanceBody(surface().getContext(),0,a,100,{x:0,y:0},{x:0,y:0},null,null);await new Promise(setImmediate);
  const s=surface();presentation.drawRootMotion(s.getContext(),0,a,100,{x:0,y:0},{x:0,y:0},null,()=>presentation.drawAgentAppearanceBody(s.getContext(),0,a,100,{x:0,y:0},{x:0,y:0},null,null));check(s.calls,facing,base.id+'/'+action+'/world','world');
 }
 for(const phase of ['enter','perform','exit']){
  const request={key:tribe,attributes,width:480,size:100,elapsedMs:50,timeline:.05,phase,startedAt:0};
  const motion=welcomeTravelMotion({unitStats,...animation},request);await presentation.prepareAnimation(motion.agent);
  const s=surface();runInNewContext(welcomeDraw+'\ndrawPreparedUnit(motion);',{motion,width:480,height:280,context:s.getContext(),nativeAssets:{displayScale:()=>1},groundY:()=>214,unitPresentation:presentation,performance:{now:()=>50},model:{},timeline:.05,reducedMotion:{matches:false}});check(s.calls,-1,base.id+'/'+phase+'/welcome','welcome');
  if(phase!=='perform'){const later=welcomeTravelMotion({unitStats,...animation},{...request,elapsedMs:100,timeline:.1});assert.ok(later.x<=motion.x,base.id+' travels right to left');}
 }
}
for(const build of [...['bean','spore','pebble','spring'].flatMap(tribe=>WELCOME_UNIT_APPEARANCES.map((attributes,i)=>({tribe,key:tribe,attributes,name:tribe+'/'+forms[i],stats:unitStats(attributes,tribe)}))),...COMBAT_LAB_UNITS.filter(x=>!['bean','spore','pebble','spring'].includes(x.key)).map(x=>({key:x.key,species:x.key,name:x.key,attributes:{},stats:{health:10}}))])for(const action of ['idle','walk','attack','ranged','hurt','death']){
 const s=surface(),stage=createCombatStage(s);const agents=[0,1].map(side=>stateAgent({...build,id:build.name+side,facing:side?1:-1,combat:{side,version:2}},action));
 const trial={agents,history:[],projectiles:[],time:.05,result:()=>null};for(let n=0;n<3;n++){stage.render(trial,1000+n,false);await new Promise(setImmediate)}s.calls.length=0;stage.render(trial,1004,false);
 for(const c of s.calls.filter(x=>truth[x.image]))check([c],c.x>520?-1:1,build.name+'/'+action+'/combat','combat');
 if(!s.calls.some(x=>truth[x.image]))failures.push(build.name+'/'+action+'/combat: no body');
}
const creatureModel={...animation,...beetle,...await load('talon-owl-idle'),...await load('image-geometry'),...await load('creature-presentation')};
const sprite=a=>({src:a.image,complete:true,naturalWidth:4096,naturalHeight:4096});
const registry=r=>new Map(Object.entries(r).map(([k,a])=>[k,{animation:a,sprite:sprite(a),scale:1}]));
const resources={idle:registry(animation.CREATURE_IDLE_ANIMATIONS),walk:registry(animation.CREATURE_WALK_ANIMATIONS),attack:registry(animation.CREATURE_ATTACK_ANIMATIONS),hurt:registry(animation.CREATURE_HURT_ANIMATIONS),ranged:registry(CREATURE_RANGED_ANIMATIONS),beetleSheet:sprite(beetle.BEETLE_SPRITE),beetleAttackSheet:sprite(beetle.BEETLE_ATTACK_SPRITE),owlFrames:new Map(Array.from({length:100},(_,i)=>[i,sprite(TALON_OWL_IDLE)]))};
for(const unit of COMBAT_LAB_UNITS.filter(x=>!['bean','spore','pebble','spring'].includes(x.key))){
 for(const action of ['idle','walk','attack','ranged','hurt'])for(const facing of [-1,1]){
  const agent=stateAgent({species:unit.key,id:unit.key,facing,combat:{version:2}},action);if(agent.attack && (action==='attack'?animation.CREATURE_ATTACK_ANIMATIONS[unit.key]||unit.key==='spiny-back-beetle':CREATURE_RANGED_ANIMATIONS[unit.key]))agent.facing=-facing;
  const pose=creatureModel.creaturePresentationPose(creatureModel,agent,.05,false,resources,'hurt') || creatureModel.creaturePresentationPose(creatureModel,agent,.05,false,resources,'attack') || creatureModel.creaturePresentationPose(creatureModel,agent,.05,false,resources,null);const s=surface();
  creatureModel.drawCreaturePresentation(s.getContext(),pose,100,200,100,null,null);check(s.calls,facing,unit.key+'/'+action+'/world','world');
 }
 for(const phase of ['enter','perform','exit']){
  const motion=welcomeTravelMotion({unitStats,...creatureModel},{key:unit.key,width:480,size:100,elapsedMs:50,timeline:.05,phase,startedAt:0});
  const s=surface();runInNewContext(welcomeDraw+'\ndrawPreparedUnit(motion);',{motion,width:480,height:280,context:s.getContext(),nativeAssets:{displayScale:()=>1},groundY:()=>214,unitPresentation:presentation,performance:{now:()=>50},model:creatureModel,creatureResources:resources,timeline:.05,reducedMotion:{matches:false}});check(s.calls,-1,unit.key+'/'+phase+'/welcome','welcome');
 }
}
let gameSource=fs.readFileSync(root+'client/game.js','utf8');
const corpseSource=gameSource.match(/^    function drawCreatureDeath\([^]*?^    }/m)[0]+'\n'+gameSource.match(/^    function drawCreatureCorpse\([^]*?^    }/m)[0];
for(const unit of COMBAT_LAB_UNITS.filter(x=>!['bean','spore','pebble','spring'].includes(x.key)))for(const facing of [-1,1]){
 const s=surface();const scope={context:s.getContext(),corpse:{species:unit.key,facing,diedAt:0},creatureDeathSheets:registry(animation.CREATURE_DEATH_ANIMATIONS),Spawner:{...creatureModel,...await load('unit-size')},idleMotion:{matches:false},corpsePlaybackTime:()=>.05,state:{simSeconds:.05},beetleCorpseSprite:{src:'DesignAssets/Animations/BeetleDeath/dead-v2.png',complete:true,naturalWidth:185},beetleCorpseAnimation:creatureModel.imageAnimation({image:'DesignAssets/Animations/BeetleDeath/dead-v2.png',frameSize:185,columns:1,pivotX:95.5,pivotY:163}),beetleCorpseScale:1,talonOwlFrames:resources.owlFrames,encounterSprites:new Map(),clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};
 runInNewContext(corpseSource+'\ndrawCreatureCorpse(context,corpse,100,200,100,null,1);',scope);check(s.calls,facing,unit.key+'/death/world','world');
}
const shadowSource=gameSource.match(/^    function drawCorpseGroundShadow\([^]*?^    }/m)[0];
for(const facing of [-1,1]){
 const shadows=[],beetleCorpseAnimation=creatureModel.imageAnimation({image:'DesignAssets/Animations/BeetleDeath/dead-v2.png',frameSize:185,columns:1,pivotX:95.5,pivotY:163});
 assert.ok(beetleCorpseAnimation.groundRadiusX>0,'registered beetle uses centered authored ellipse, not obsolete contact offset');
 runInNewContext(shadowSource+'\ndrawCorpseGroundShadow(corpse,point);',{corpse:{species:'spiny-back-beetle',facing,diedAt:0},point:{x:100,y:200},creatureDeathSheets:new Map(),beetleCorpseAnimation,beetleCorpseScale:1,corpsePlaybackTime:()=>.05,idleMotion:{matches:false},Spawner:creatureModel,state:{camera:{zoom:100}},drawGroundShadow:(...args)=>shadows.push(args)});
 assert.equal(shadows.length,1);assert.equal(shadows[0][0],100);assert.equal(shadows[0][1],200);
}
console.log(JSON.stringify({counts,failures,pixelTruth:process.env.FACING_PIXEL_TRUTH||'metadata-only pending independent auditor'},null,2));assert.deepEqual(failures, [], 'actual rendered directions must match authored pixel truth (metadata fallback when no independent truth supplied)');
});
