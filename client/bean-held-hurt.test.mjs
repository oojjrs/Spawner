import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {beanHeldHurtAmount,beanHeldHurtSource,beanHeldHurtPose,drawBeanHeldHurt,BEAN_HELD_HURT_ASSETS} from './bean-held-hurt.mjs';
import {BEAN_HELD_HURT_SOURCES} from './bean-held-hurt-assets.mjs';
import {sampleHurtHold} from '../tools/bean-hurt-amplify-20261105/hold-clock.mjs';
import {unitAnimationPose} from './unit-animation.mjs';
import {unitDisplaySize} from './unit-size.mjs';
import {imageDimensions,auditImages} from './image-audit.mjs';
const unit=(patch={})=>({id:'b',tribe:'bean',health:10,hurtStartedAt:10,facing:1,...patch});
const context=()=>{const calls=[];return{calls,save(){calls.push(['save']);},restore(){calls.push(['restore']);},translate(...a){calls.push(['translate',...a]);},scale(...a){calls.push(['scale',...a]);},drawImage(...a){calls.push(['draw',...a]);}};};
const images=new Map(BEAN_HELD_HURT_ASSETS.map(p=>{const[w,h]=imageDimensions(p);return[p,{src:p,width:w,height:h,complete:true}];}));

test('production clock exactly matches the accepted real-time hold and rebound',()=>{
 for(let i=0;i<1000;i++){const age=i/1000;assert.ok(Math.abs(beanHeldHurtAmount(age)-sampleHurtHold(age,[{at:0}]).amount)<1e-12);}
 for(const age of [0,.1,.3,.499999,.5]){const pose=beanHeldHurtPose(unit(),10+age);assert.equal(pose.amount,1);assert.equal(pose.hold,true);}
 assert.equal(beanHeldHurtPose(unit(),10.881),null);assert.equal(beanHeldHurtPose(unit(),9.999),null);
});
test('new hits reset hold independently of outgoing attack, shooting and movement clocks',()=>{
 for(const attack of [{startedAt:10,hitAt:10.3,endsAt:11},{mode:'ranged',startedAt:10,launchedAt:10.2,hitAt:10.3,endsAt:11}]){
  const a=unit({combat:{version:2},attack,moveStartedAt:10,moveDuration:1,hurtStartedAt:10.2}),before=JSON.stringify(a);
  assert.ok(beanHeldHurtPose(a,10.65));assert.equal(beanHeldHurtPose(a,10.65).amount,1);assert.ok(unitAnimationPose(a,10.65));
  const newer={...a,hurtStartedAt:10.5};assert.equal(beanHeldHurtPose(newer,10.95).amount,1);assert.equal(JSON.stringify(a),before);
 }
});
test('six dominant live silhouettes keep their source; legacy species, birth and death are excluded',()=>{
 assert.equal(Object.keys(BEAN_HELD_HURT_SOURCES).length,6);
 for(const key of ['base','blade','carapace','secretion','antenna','feet'])assert.equal(beanHeldHurtSource(unit({attributes:key==='base'?{}:{[key]:1}})),BEAN_HELD_HURT_SOURCES[key]);
 assert.equal(beanHeldHurtSource(unit({attributes:{blade:1,secretion:1,feet:1}})),null);
 assert.equal(beanHeldHurtSource(unit({attributes:{blade:1,feet:1}})),BEAN_HELD_HURT_SOURCES.blade);
 for(const patch of [{species:'beetle'},{tribe:'spore'},{health:0},{birth:{startedAt:10}},{attributes:{strength:1}},{hurtStartedAt:NaN}])assert.equal(beanHeldHurtPose(unit(patch),10.2),null);
});
test('both hit sides use separate cells while preserving source orientation and read-only state',()=>{
 for(const source of Object.values(BEAN_HELD_HURT_SOURCES))assert.equal(source.times.length,12);
 for(const mirror of [false,true])for(const hitSide of [-1,1]){
  const ctx=context(),a=unit({attributes:{secretion:1}}),before=JSON.stringify(a),src=beanHeldHurtSource(a);
  assert.ok(drawBeanHeldHurt(ctx,a,10.2,p=>images.get(p),{cell:250,mirror,hitSide}));
  const index=(hitSide*(mirror?-1:1)>0?12:0);const call=ctx.calls.find(x=>x[0]==='draw');
  assert.equal(call[2],index%src.columns*src.frameWidth);assert.equal(call[3],Math.floor(index/src.columns)*src.frameHeight);
  assert.deepEqual(ctx.calls.find(x=>x[0]==='scale'),['scale',mirror?-1:1,1]);assert.equal(JSON.stringify(a),before);
 }
});
test('loading failure falls through, then recovers without timer restart; pose expires normally',()=>{
 const ctx=context(),a=unit(),load=[];
 assert.equal(drawBeanHeldHurt(ctx,a,10.2,p=>{load.push(p);return null;}),false);
 assert.equal(drawBeanHeldHurt(ctx,a,10.45,p=>images.get(p),{cell:200}),true);
 assert.equal(beanHeldHurtPose(a,10.45).age,.4499999999999993);
 assert.equal(drawBeanHeldHurt(ctx,a,10.9,p=>images.get(p)),false);
 assert.equal(drawBeanHeldHurt(ctx,a,10.2,()=>({width:10,height:10,complete:true})),false);
 assert.equal(load.length,1);
});
test('lab nonuniform original mapping and rectangle crop are retained',()=>{
 const a=unit({attributes:{antenna:1}}),s=beanHeldHurtSource(a),ctx=context(),K=250*unitDisplaySize(a)/247;
 assert.ok(drawBeanHeldHurt(ctx,a,10.2,p=>images.get(p),{cell:250,sourceScaleX:K*194/239,sourceScaleY:K*154/214,nativePivotX:256.1159793814433,nativePivotY:486.3336156597027}));
 const c=ctx.calls.find(x=>x[0]==='draw');assert.ok(Math.abs(c[6]+(s.pivotX+.1159793814433)*K*194/239)<1e-8);assert.ok(Math.abs(c[7]+(s.pivotY+5.0536156597027)*K*154/214)<1e-8);
 assert.ok(Math.abs(c[8]-s.frameWidth*K*194/239)<1e-8);assert.ok(Math.abs(c[9]-s.frameHeight*K*154/214)<1e-8);
});
test('world/detail/lab hooks precede body fallback without clearing attack state',()=>{
 const game=fs.readFileSync(new URL('./game.js',import.meta.url),'utf8'),stage=fs.readFileSync(new URL('./combat-stage.mjs',import.meta.url),'utf8');
 assert.match(game,/function drawAgentAppearance[\s\S]*?drawAgentHeldHurt[\s\S]*?appearanceWorld.draw/);
 assert.match(game,/drawAgentHeldHurt\(context, visual, cell, 0, 0/);assert.match(stage,/const heldDrawn = drawBeanHeldHurt/);
 const helper=game.match(/^    function drawAgentHeldHurt\([^]*?^    }/m)[0];assert.ok(!/attack\s*=|hurtStartedAt\s*=|stunnedUntil\s*=/.test(helper));
 assert.match(game,/frozen && \(agent.tribe \|\| "bean"\) !== "bean"/);
 assert.match(game,/const sourceHeight = frame \? frame.height \|\| frame.size/);
});
test('new native atlases are registered exactly and source pixel comparisons passed',()=>{
 assert.equal(auditImages(process.cwd(),BEAN_HELD_HURT_ASSETS),6);
 const qa=JSON.parse(fs.readFileSync('tools/bean-hurt-amplify-20261105/runtime-verification.json'));
 for(const r of qa.sources){assert.equal(r.frames,24);assert.equal(r.fixedLowerPixelsMaxError,0);assert.ok(r.minXDerivative>0);assert.ok(r.minYDerivative>0);assert.ok(r.exactAtlasRgba);}
});

test('actual laboratory stage draws held body through overlapping attacks, refresh and expiry',async()=>{
 const {createCombatStage}=await import('./combat-stage.mjs');
 const helpers=fs.readFileSync(new URL('./combat-stage-vfx.test.mjs',import.meta.url),'utf8');
 const box={assert,createCombatStage,globalThis,setImmediate};vm.createContext(box);
 vm.runInContext(helpers.slice(helpers.indexOf('const root ='),helpers.indexOf('\ntest(')),box);
 for(const key of ['base','blade','carapace','secretion','antenna','feet']) await box.withStage(async({draw,calls})=>{
  const {trial,target}=box.setup();target.attributes=key==='base'?{}:{[key]:1};target.stats={health:100};
  target.hurtStartedAt=1;target.attack={startedAt:1,hitAt:1.3,endsAt:2};trial.time=1.45;
  const before=JSON.stringify(trial.agents);await draw(trial);
  const held=()=>calls.filter(c=>c.name==='drawImage'&&c.args[0]?.src.includes('/BeanHeldHurtV1/'));
  assert.equal(held().length,1,key);assert.ok(held()[0].args[0].src.endsWith('/'+key+'.webp'));assert.equal(JSON.stringify(trial.agents),before);
  target.hurtStartedAt=1.4;trial.time=1.85;await draw(trial);assert.equal(held().length,1,key+' reset');
  trial.time=2.281;await draw(trial);assert.equal(held().length,0,key+' expired');
 });
});
