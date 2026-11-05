import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {unitDisplayAttributes} from './unit-display-appearance.mjs';
import {sproutRootGeometry} from './sprout-roots.mjs';
import {AGENT_DEATH_ANIMATION} from './agent-death.mjs';
const source=readFileSync(new URL('./game.js',import.meta.url),'utf8');
function setup() {
 const roots={name:'roots',complete:true,naturalWidth:264,naturalHeight:84},body={name:'body',complete:true,naturalWidth:104,naturalHeight:153};
 const sheet={name:'authored-death',complete:true,naturalWidth:1264},attributes={name:'attributes'};
 const entry={animation:AGENT_DEATH_ANIMATION,sprite:sheet,bodyBounds:Array.from({length:16},(_,i)=>({x:90,y:150+i,width:136,height:110-i*2})),bodyFrames:Array(16).fill({name:'masked-body'}),floors:Array(16).fill(276),attributeFrames:new Map()};
 const surface=()=>{const c={width:0,height:0,calls:[]};let y=0,stack=[];const ctx={translate(x,dy){y+=dy;},save(){stack.push(y);},restore(){y=stack.pop();},beginPath(){c.calls.push(['path']);},rect(...args){c.calls.push(['rect',...args]);},clip(){c.calls.push(['clip']);},drawImage(...args){c.calls.push(['draw',y,...args]);}};c.getContext=()=>ctx;return c;};
 const scope=createContext({Spawner:{unitDisplayAttributes,sproutRootGeometry},agentParts:new Map([['feet-1',roots]]),agentBaseParts:new Map([['body',body]]),sproutCombatMounts:new Map(),document:{createElement:surface},agentSprite:(agent,layer)=>layer==='body'?body:attributes,tribeArt:{bounds:()=>({x:136,y:110,width:240,height:350})}});
 for(const name of ['agentAppearanceKey','sproutCombatFrame'])runInContext(source.match(new RegExp('^    function '+name+'\\([^]*?^    }','m'))[0],scope);
 return {draw:scope.sproutCombatFrame,entry,roots,body,sheet,attributes};
}
test('bean feet retain every authored death body cell and supported roots through all 16 frames',()=>{
 const f=setup(),corpse={kind:'corpse',tribe:'bean',health:0,attributes:{feet:1}},before=structuredClone(corpse);
 for(let i=0;i<16;i++){
  const frame=f.draw(corpse,f.entry,i),draws=frame.calls.filter(c=>c[0]==='draw');
  assert.ok(frame);assert.equal(frame.width,474);assert.equal(frame.height,474);
  assert.equal(frame.calls.some(c=>c[0]==='clip'),false,'do not cut the authored bulb');
  assert.equal(draws[0][2],f.roots);
  const native=draws.find(c=>c[2]===f.sheet);assert.ok(native,'use the actual death image rather than idle');
  assert.deepEqual(native.slice(3),[i%4*316,Math.floor(i/4)*316,316,316,0,0,316,316]);
  const root=draws[0];assert.ok(root[1]+root[4]+root[6]<=79+f.entry.floors[i]+1e-9,'roots never sink below the original floor');
  assert.equal(f.draw(corpse,f.entry,i),frame,'bounded per-action frame reuse');
 }
 assert.deepEqual(corpse,before);assert.equal(f.entry.attributeFrames.size,1);assert.equal([...f.entry.attributeFrames.values()][0].size,16);
});
test('missing or not-yet-decoded roots fall back without poisoning the cache, and recover on load',()=>{
 const f=setup(),corpse={kind:'corpse',tribe:'bean',attributes:{feet:1}};
 f.roots.complete=false;assert.equal(f.draw(corpse,f.entry,0),null);assert.equal(f.entry.attributeFrames.size,0);
 f.roots.complete=true;f.roots.naturalWidth=0;assert.equal(f.draw(corpse,f.entry,0),null);
 f.roots.naturalWidth=264;assert.ok(f.draw(corpse,f.entry,0));
 f.body.complete=false;assert.equal(f.draw(corpse,f.entry,1),null);
 f.body.complete=true;assert.ok(f.draw(corpse,f.entry,1));
 assert.equal(f.draw(corpse,{...f.entry,bodyBounds:[]},0),null);
 assert.equal(f.draw(corpse,{...f.entry,bodyFrames:[]},0),null);
});
test('living attack/hurt compositions retain their own clipping and cache identity',()=>{
 const f=setup(),living={tribe:'bean',health:1,attributes:{feet:1}},corpse={...living,kind:'corpse',health:0};
 const prior=f.draw(living,f.entry,0),death=f.draw(corpse,f.entry,0);
 assert.notEqual(prior,death);assert.equal(prior.calls.some(c=>c[0]==='clip'),true);assert.equal(death.calls.some(c=>c[0]==='clip'),false);
});
