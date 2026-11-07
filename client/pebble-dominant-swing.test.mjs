import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pebbleDominantSwingAppearance, preparePebbleDominantSwing, samplePebbleDominantSwing, renderPebbleDominantSwing } from './pebble-dominant-swing.mjs';
import { unitDisplayAttributes } from './unit-display-appearance.mjs';
import { createCombatEvolutionArt, combatEvolutionPose } from './combat-evolution.mjs';
import { COMBAT_EVOLUTION_CATALOG } from './combat-evolution-assets.mjs';
const rig = () => JSON.parse(fs.readFileSync(new URL('../DesignAssets/Animations/CombatAttributesV7/pebble/blade/rig.json',import.meta.url)));
const images = definition => Object.fromEntries(definition.parts.map(p=>[p.id,{width:440,height:360,id:p.id}]));
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function context(fail=false){
 let m=[1,0,0,1,0,0],stack=[];const calls=[];
 return {calls,globalCompositeOperation:'source-over',save(){stack.push({m:[...m],op:this.globalCompositeOperation});},restore(){const s=stack.pop();m=s.m;this.globalCompositeOperation=s.op;},transform(...b){m=mul(m,b);},translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},getTransform(){return [...m];},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},rect(){},drawImage(image,...args){if(fail)throw Error('Missing pixels');calls.push({id:image.id,args,matrix:[...m]});}};
}
test('only projected canonical pebble blade opts in',()=>{
 assert.ok(pebbleDominantSwingAppearance('pebble',{blade:1}));
 for(const key of ['carapace','antenna','strength','arms','feet','legs','secretion','piercing'])assert.equal(pebbleDominantSwingAppearance('pebble',{blade:1,[key]:1}),false);
 for(const tribe of ['bean','spore','spring'])assert.equal(pebbleDominantSwingAppearance(tribe,{blade:1}),false);
 for(let mask=1;mask<32;mask+=2){const attributes=Object.fromEntries(['blade','carapace','antenna','feet','secretion'].map((k,i)=>[k,(mask>>i)&1]));assert.equal(pebbleDominantSwingAppearance('pebble',unitDisplayAttributes({tribe:'pebble',attributes})), [1, 9].includes(mask));}
});
test('approved source registration is exact and missing parts reject safely',()=>{
 const definition=rig(),im=images(definition);assert.ok(preparePebbleDominantSwing(definition,im));
 for(const change of [{scale:NaN},{scale:0},{scale:-1},{canvas:[512,512]},{root:[230,356]},{approvedSource:'pending.png'},{tribe:'spore'},{variant:'carapace'}])assert.equal(preparePebbleDominantSwing({...definition,...change},im),null);
 assert.equal(preparePebbleDominantSwing(definition,{...im,body:{width:440,height:360,complete:false}}),null);
 assert.equal(preparePebbleDominantSwing(definition,{...im,body:{width:440,height:359}}),null);
 delete im['eye-0'];assert.equal(preparePebbleDominantSwing(definition,im),null);
});
test('all mesh samples preserve orientation and lower support; endpoints and source stay unchanged',()=>{
 const definition=rig(),before=JSON.stringify(definition),p=preparePebbleDominantSwing(definition,images(definition));
 for(let time=0;time<=1000;time+=2){const s=samplePebbleDominantSwing(p,time);assert.ok(s,'time '+time);assert.ok(s.minRatio>.02);p.vertices.forEach((v,i)=>{if(v[1]>=335)assert.deepEqual(s.points[i],v);});}
 assert.deepEqual(samplePebbleDominantSwing(p,0).points,samplePebbleDominantSwing(p,1000).points);
 assert.equal(samplePebbleDominantSwing(p,220).pose.angle,-.56);assert.equal(samplePebbleDominantSwing(p,300).pose.angle,.58);assert.equal(samplePebbleDominantSwing(p,340).pose.angle,.7);
 for(const time of [-1,1001,NaN,Infinity])assert.equal(samplePebbleDominantSwing(p,time),null);
 assert.equal(JSON.stringify(definition),before);
});
test('feet use identical approved pixels and transforms through the complete sweep',()=>{
 const definition=rig(),p=preparePebbleDominantSwing(definition,images(definition)),neutral=context();assert.ok(renderPebbleDominantSwing(neutral,samplePebbleDominantSwing(p,0)));
 const feet=c=>c.calls.filter(c=>c.id.startsWith('foot-'));
 for(let time=0;time<=1000;time+=20){const ctx=context();assert.ok(renderPebbleDominantSwing(ctx,samplePebbleDominantSwing(p,time)));assert.deepEqual(feet(ctx),feet(neutral));assert.deepEqual(ctx.getTransform(),[1,0,0,1,0,0]);}
 const ctx=context(true);ctx.translate(5,8);const before=ctx.getTransform();assert.equal(renderPebbleDominantSwing(ctx,samplePebbleDominantSwing(p,300)),false);assert.deepEqual(ctx.getTransform(),before);
});
test('existing authoritative contact clock selects the new 300 ms contact without gameplay writes',()=>{
 const animations=COMBAT_EVOLUTION_CATALOG['pebble/blade'].animations;
 for(const startedAt of [0,10,200])for(const duration of [.15,.6,1,2]){
  const agent={id:'clock',tribe:'pebble',attributes:{blade:1},health:10,bornAt:0,hurtStartedAt:-Infinity,combat:{version:2},attack:{combatId:'test-clock',startedAt,hitAt:startedAt+duration*.3,endsAt:startedAt+duration}},before=JSON.stringify(agent);
  const pose=combatEvolutionPose(agent,agent.attack.hitAt,animations);assert.equal(pose.action,'attack');assert.equal(pose.sampleTime,300);assert.equal(JSON.stringify(agent),before);
 }
});

const unit = patch => ({id:'pebble-swing',tribe:'pebble',attributes:{blade:1},health:10,bornAt:0,hurtStartedAt:-Infinity,attack:{combatId:'swing',startedAt:10,hitAt:10.3,endsAt:11},...patch});
async function production() {
  const state={ready:true,badSize:false,fail:false},body='DesignAssets/Animations/CombatAttributesV7/pebble/blade/Parts/body.png';
  const surface=(width,height)=>{
    const ctx=context(),canvas={width,height,calls:ctx.calls,getContext:()=>ctx};ctx.canvas=canvas;
    const draw=ctx.drawImage.bind(ctx);ctx.drawImage=(image,...args)=>{if(state.fail&&image.id===body)throw Error('Missing pixels');draw(image,...args);};return canvas;
  };
  const load=async file=>({id:file,file,get complete(){return file!==body||state.ready;},get width(){return file===body&&state.badSize?439:440;},height:360});
  const renderer=createCombatEvolutionArt(file=>'data:application/json;base64,'+fs.readFileSync(new URL('../'+file,import.meta.url)).toString('base64'),surface,load);
  await renderer.prepare('pebble');return {renderer,state,body};
}
test('production uses approved body at 300 ms and shares only equivalent canonical pose caches',async()=>{
 const {renderer,body}=await production(),agent=unit(),before=JSON.stringify(agent),sprite=renderer.frame(agent,10.3);
 assert.equal(sprite.width,512);assert.equal(sprite.height,512);assert.equal(sprite.combatCamera,undefined);assert.ok(sprite.calls.some(c=>c.id===body));
 assert.equal(sprite.calls.filter(c=>c.id.endsWith('/foot-0.png')).length,1);assert.equal(sprite.calls.filter(c=>c.id.endsWith('/foot-1.png')).length,1);
 assert.equal(renderer.frame(unit({id:'another',attack:{combatId:'another',startedAt:20,hitAt:20.3,endsAt:21}}),20.3),sprite);
 assert.equal(renderer.frame(unit({attributes:{blade:1,carapace:1,secretion:1,antenna:1,feet:1}}),10.3),sprite);assert.equal(JSON.stringify(agent),before);
});
test('production preserves hidden ranged shots, cancellation, all non-melee actions and armor',async()=>{
 const {renderer,body}=await production(),animations=COMBAT_EVOLUTION_CATALOG['pebble/blade'].animations;
 renderer.frame(unit(),10.3);
 for(const patch of [{attack:null},{attack:null,hurtStartedAt:10.2},{birth:{startedAt:10,readyAt:11}},{health:0,diedAt:10.1},{attack:null,moveStartedAt:10,moveDuration:1},{attack:null,mode:'harvest',harvestStarted:10},{species:'beetle'},{attack:{startedAt:11,speed:1}},{attributes:{carapace:1}}])assert.ok(!renderer.frame(unit(patch),10.3).calls.some(c=>c.id===body),JSON.stringify(patch));
 assert.deepEqual(renderer.portrait(unit()).calls.map(c=>c.id),[animations.idle.image]);
 for(const flag of [{mode:'ranged'},{attackMode:'ranged'},{dnaRanged:true}]){
  const agent=unit({attributes:{blade:1,secretion:1},attack:{combatId:'ranged',startedAt:10,launchedAt:10.3,hitAt:10.6,endsAt:11,...flag}});
  assert.deepEqual(renderer.frame(agent,10.3).calls.map(c=>c.id),[animations.idle.image]);
 }
 assert.ok(renderer.frame(unit(),10.3).calls.some(c=>c.id===body));
});
test('missing, mismatched or failed drawing returns the old sheet and retries without cache poisoning',async()=>{
 for(const key of ['ready','badSize','fail']){
  const {renderer,state,body}=await production();state[key]=key!=='ready';
  assert.deepEqual(renderer.frame(unit(),10.3).calls.map(c=>c.id),[COMBAT_EVOLUTION_CATALOG['pebble/blade'].animations.attack.image]);
  state[key]=key==='ready';assert.ok(renderer.frame(unit(),10.3).calls.some(c=>c.id===body));
 }
});
test('each authoritative multi-hit contact keeps the same approved pose and leaves the attack unchanged',async()=>{
 const {renderer,body}=await production(),animations=COMBAT_EVOLUTION_CATALOG['pebble/blade'].animations;
 for(const start of [0,10,500])for(const gap of [.03,.12,.6])for(const count of [1,4]){
  const contacts=Array.from({length:count},(_,i)=>start+.08+i*gap),agent=unit({attack:{combatId:'multi',startedAt:start,hitAt:contacts.at(-1),endsAt:contacts.at(-1)+.35,meleeContacts:contacts}}),before=JSON.stringify(agent);
  for(const time of contacts){assert.equal(combatEvolutionPose(agent,time,animations).sampleTime,300);assert.ok(renderer.frame(agent,time).calls.some(c=>c.id===body));}
  assert.equal(JSON.stringify(agent),before);
 }
});
