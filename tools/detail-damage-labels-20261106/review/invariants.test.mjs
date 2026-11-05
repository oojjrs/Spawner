import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCombatVfxCursor} from '../../../client/combat-vfx-events.mjs';
import * as vfx from '../../../client/combat-detail-vfx.mjs';
const source=readFileSync(new URL('../../../client/game.js',import.meta.url),'utf8');
const fixture=readFileSync(new URL('../../../client/combat-detail-dodge.test.mjs',import.meta.url),'utf8');
const helper=fixture.slice(fixture.indexOf('function extract('),fixture.indexOf('const event = '))
 .replace('CREATURE_ATTACK_ANIMATIONS: {},','CREATURE_ATTACK_ANIMATIONS: {}, ...vfx,');
const box={assert,source,createContext,runInContext,createCombatVfxCursor,...vfx,vfx};
createContext(box);runInContext(helper,box);
const e=(kind,id=kind,extra={})=>({id,kind,at:1,sourceId:'source',targetId:'target',amount:0,...extra});
function labelBox(t) {const f=Number(t.font.match(/[\d.]+px/)?.[0].slice(0,-2))||17;return {left:t.x-t.text.length*f*.34-2,right:t.x+t.text.length*f*.34+2,top:t.y-f*.5-2,bottom:t.y+f*.5+2};}
function overlap(a,b) {return a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;}
const baseAgents=[{id:'source',health:10},{id:'target',health:10}], basePositions=new Map([['source',{x:100,y:300,width:50,height:100}],['target',{x:300,y:300,width:50,height:100}]]);
function scene(){
 const detail=vfx.createDetailCombatVfx(),cursor=createCombatVfxCursor(),view={scope:'fight',width:600,height:400,includeDirectDamage:true};
 function step(t,events,agents=baseAgents,positions=basePositions,extraView={}){
  detail.consume(cursor.consume({streamId:'s',events},t),t);return detail.vitalCommands(agents,positions,t,{...view,...extraView});
 }
 step(0,[]);return{detail,cursor,step,view};
}

test('same-ID replay, post-expiry, reset and lab opt-out do not duplicate direct damage',()=>{
 const {step,detail,cursor,view}=scene(),hit=e('hit','h',{amount:2});
 assert.equal(step(1.05,[hit,hit]).length,1);
 assert.equal(step(1.6,[hit]).length,1);
 assert.equal(step(1.85,[hit]).length,0);
 assert.equal(step(1.1,[hit]).length,0);
 const fresh=scene();fresh.step(1.05,[hit]);
 assert.equal(fresh.detail.vitalCommands(baseAgents,basePositions,1.05,{...view,includeDirectDamage:false}).length,0);
 fresh.detail.consume(fresh.cursor.consume({streamId:'new',events:[hit]},1.1),1.1);
 assert.equal(fresh.detail.vitalCommands(baseAgents,basePositions,1.1,view).length,0);
});

test('exact block event excludes residual duplication for the whole .85-second tail',()=>{
 const {step}=scene();const events=[e('block','b',{amount:.7}),e('hit','h',{amount:3})];
 assert.deepEqual(step(1.05,events).map(c=>c.amount),[3]);
 assert.deepEqual(step(1.6,events).map(c=>c.amount),[3]);
});

test('actual recipient, followup and critical facts survive normalization without mutating source evidence',()=>{
 const {step}=scene();const events=[e('hit','follow',{amount:.004,hitIndex:1}),e('critical','crit',{amount:5}),e('reflect','reflection',{amount:2,targetId:'target',toId:'source'}),e('area','splash',{amount:3,targetId:'target',toId:'source'})];
 const before=structuredClone(events),commands=step(1.05,events);
 assert.equal(commands.find(c=>c.eventId==='follow').kind,'followup');assert.equal(commands.find(c=>c.eventId==='crit').critical,true);
 assert.equal(commands.find(c=>c.eventId==='reflection').targetId,'source');assert.equal(commands.find(c=>c.eventId==='splash').targetId,'source');assert.deepEqual(events,before);
});

test('non-damage, canceled, future and invalid evidence does not produce a direct label',()=>{
 for(const kind of ['attack','shoot','dodge','parry','stun','bleed-apply','projectile-cancel'])assert.equal(scene().step(1.05,[e(kind,kind,{amount:4})]).length,0);
 for(const amount of [0,-1,NaN,Infinity])assert.equal(scene().step(1.05,[e('hit','h',{amount})]).length,0);
 assert.equal(scene().step(.99,[e('hit','h',{amount:2})]).length,0);
});

test('omitted living or never-observed killed units cannot invent a recipient anchor',()=>{
 const {step}=scene(),survivors=[baseAgents[0]],points=new Map([['source',basePositions.get('source')]]);
 assert.equal(step(1.05,[e('hit','h',{amount:2})],survivors,points).length,0);
 assert.equal(step(1.1,[e('hit','h',{amount:2}),e('death')],survivors,points).length,0);
});

test('current active redaction hides a label even if the old target is still in layout',()=>{
 const {step}=scene(),hit=e('hit','h',{amount:2});assert.equal(step(1.05,[hit]).length,1);
 assert.equal(step(1.1,[{...hit,targetId:null}]).length,0);
});

test('late redaction also hides a retained dead-recipient label after the semantic hit expires',()=>{
 const {step}=scene();step(.95,[]);
 const hit=e('hit','h',{amount:2}),death=e('death'),survivors=[baseAgents[0]],points=new Map([['source',basePositions.get('source')]]);
 assert.equal(step(1.05,[hit,death],survivors,points).length,1);
 assert.equal(step(1.6,[{...hit,targetId:null},{...death,targetId:null}],survivors,points).length,0,'redacted recipient must not render from a cached death anchor');
});

for(const kind of ['block','parry','dodge'])test(`compact actual modal preserves ${kind} caption readability alongside four hits`,()=>{
 const scene=box.modal({width:320,height:240}),events=[e(kind,'defense',{amount:kind==='block'?.7:0}),...Array.from({length:4},(_,i)=>e(i%2?'hit':'critical','h'+i,{amount:2+i}))];
 const result=scene.draw(1.08,events),caption=result.texts.find(t=>t.text==={block:'방어',parry:'패링',dodge:'회피'}[kind]);
 assert.ok(caption,'defense caption exists');
 for(const amount of result.texts.filter(t=>t.text.startsWith('−'))) assert.ok(!overlap(labelBox(caption),labelBox(amount)),JSON.stringify({caption,amount}));
});

test('packed viewport omits excess labels while drawn labels stay inside the viewport',()=>{
 const canvas={save(){},restore(){},measureText(text){return{width:text.length*12};}},commands=Array.from({length:18},(_,i)=>({kind:i%2?'hit':'critical',critical:!(i%2),directDamage:true,channel:'impact',targetId:'target',amount:i+1,age:.08,x:180,y:150,bodyHeight:100}));
 for(const [width,height] of [[320,240],[1040,480],[80,60],[24,24]]){
  const positions=new Map([['target',{x:width/2,y:height*.75,width:width*.2,height:height*.4}]]);
  const placed=vfx.layoutDetailCombatLabels(canvas,{vitals:commands.map(c=>({...c,x:width/2,y:height*.5,bodyHeight:height*.4}))},{width,height,positions});
  const shown=placed.vitals.filter(c=>!c.labelHidden);assert.ok(shown.length<commands.length,'some labels must yield in a packed viewport');
  for(const c of shown){assert.ok(c.labelLeft>=8&&c.labelRight<=width-8&&c.labelTop>=8&&c.labelBottom<=height-8,JSON.stringify(c));}
  for(let a=0;a<shown.length;a++)for(let b=a+1;b<shown.length;b++)assert.ok(!overlap({left:shown[a].labelLeft,right:shown[a].labelRight,top:shown[a].labelTop,bottom:shown[a].labelBottom},{left:shown[b].labelLeft,right:shown[b].labelRight,top:shown[b].labelTop,bottom:shown[b].labelBottom}));
 }
});

test('reduced-motion placement stays fixed as effect age changes without other events',()=>{
 const ctx={save(){},restore(){},measureText:()=>({width:40})},base={kind:'critical',critical:true,directDamage:true,channel:'impact',targetId:'target',amount:3,x:300,y:180,bodyHeight:100};
 const options={width:600,height:400,reducedMotion:true,positions:new Map([['target',{x:300,y:230,width:50,height:100}]])};
 const a=vfx.layoutDetailCombatLabels(ctx,{vitals:[{...base,age:.05}]},options).vitals[0],b=vfx.layoutDetailCombatLabels(ctx,{vitals:[{...base,age:.6}]},options).vitals[0];
 assert.equal(a.labelX,b.labelX);assert.equal(a.labelY,b.labelY);assert.equal(a.labelHidden,b.labelHidden);
});

test('a measured label wider than the viewport is hidden rather than given shrunken bounds',()=>{
 const ctx={save(){},restore(){},measureText:()=>({width:48})},command={kind:'hit',directDamage:true,channel:'impact',amount:2,age:0,x:20,y:180,bodyHeight:100};
 const [placed]=vfx.layoutDetailCombatLabels(ctx,{vitals:[command]},{width:40,height:240}).vitals;
 assert.ok(placed.labelHidden,'the actual 48px text cannot fit a 40px canvas or its 24px padded interior');
});


test('the actual production bundler emits and exposes the new layout exports',()=>{
 const root=fileURLToPath(new URL('../../../',import.meta.url)),build=readFileSync(new URL('../../../client/build.mjs',import.meta.url),'utf8');
 const code=build.slice(build.indexOf('const imports ='),build.indexOf('function writeDesignResources()'));
 const buildBox={root,resolve,relative,dirname,readFileSync};createContext(buildBox);runInContext(code+'\nglobalThis.reviewBundle = bundle;',buildBox);
 const bundled=buildBox.reviewBundle(['client/combat-detail-vfx.mjs','client/combat-vfx-events.mjs']);
 const runtime={};createContext(runtime);runInContext(bundled+'\nglobalThis.Spawner = { ...modules["client/combat-detail-vfx.mjs"], ...modules["client/combat-vfx-events.mjs"] };',runtime);
 assert.equal(typeof runtime.Spawner.layoutDetailCombatLabels,'function');
 assert.equal(typeof runtime.Spawner.layoutDetailVitalLabels,'function');
 assert.equal(typeof runtime.Spawner.createDetailCombatVfx,'function');
 assert.match(build,/\.\.\.modules\["client\/combat-detail-vfx\.mjs"\]/);
 assert.match(source,/Spawner\.layoutDetailCombatLabels\?\./);
});
