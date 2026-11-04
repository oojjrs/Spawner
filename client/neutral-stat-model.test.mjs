import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';
const scope={};runInNewContext(readFileSync(new URL('./neutral-stat-model.js',import.meta.url),'utf8'),scope);const M=scope.SpawnerNeutralCurves;
const close=(a,b)=>assert.ok(Math.abs(a-b)<.015,`${a} != ${b}`);
test('handoff baseline reproduces all 19 species and fixed comparison parties',()=>{const c=M.initial();assert.ok(M.valid(c));const {units}=M.calculate(c);assert.equal(units.length,19);const get=k=>units.find(u=>u.key===k);close(get('flower-tail-bird').seconds,10.98);close(get('bundle-snail').seconds,54.37);close(get('white-paw').seconds,15.60);close(get('walking-forest').seconds,28.68);assert.equal(get('bundle-snail').hp,3160);assert.equal(get('white-paw').hp,3781);assert.equal(get('walking-forest').party,6)});
test('drag limits preserve strict ranks for all five axes, including rounded integers',()=>{for(const a of M.axes){const c=M.initial();for(let i=0;i<19;i++){M.edit(c,a.key,i,-1e9);assert.ok(M.valid(c));M.edit(c,a.key,i,1e9);assert.ok(M.valid(c))}const values=c[a.key];for(let i=1;i<19;i++)assert.ok(values[i]>values[i-1]);assert.equal(M.edit(c,a.key,NaN,2),false)}});
test('curve changes update species stats, DPS and uncapped combat times from the same state',()=>{const c=M.initial(),old=M.calculate(c).units;M.edit(c,'hp',18,1000000);const next=M.calculate(c).units;assert.equal(next[18].hp,1000000);assert.ok(next[18].seconds>60);assert.equal(next[18].party,old[18].party);const k=old[0].ranks.power-1;M.edit(c,'power',k,c.power[k]+1);assert.ok(M.calculate(c).units[0].dps>old[0].dps)});
test('nonpositive net damage is impossible to kill, with no NaN or negative time',()=>{const c=M.initial();c.regen=c.regen.map((_,i)=>100000+i);const {units}=M.calculate(c);assert.ok(units.every(u=>u.seconds===Infinity&&u.outside));assert.equal(M.valid({...c,hp:[...c.hp.slice(0,18),NaN]}),false)});

test('extreme numeric input remains finite and cannot corrupt saved curve state',()=>{const c=M.initial();for(const a of M.axes){M.edit(c,a.key,18,1e308);assert.ok(M.valid(c));assert.ok(M.calculate(c).units.every(u=>Number.isFinite(u.dps)&&!Number.isNaN(u.seconds)))}assert.equal(M.valid({...c,speed:Array.from({length:19},(_,i)=>1e300+i)}),false)});
test('imports cannot introduce sub-step speed gaps that break the next drag',()=>{const c=M.initial();c.speed=c.speed.map((_,i)=>.1+i*.0001);assert.equal(M.valid(c),false);const normal=M.initial();normal.speed=normal.speed.map((_,i)=>.1+i*.001);assert.ok(M.valid(normal));M.edit(normal,'speed',9,.5);assert.ok(M.valid(normal))});
test('DNA review distinguishes proven impossible maxima from witnesses and unresolved bounds',()=>{
  const balance=JSON.parse(readFileSync(new URL('../Research/Balance/2026-11-04/audit.json',import.meta.url),'utf8'));
  const review=M.diagnose(M.initial(),balance),get=k=>review.bounds.find(b=>b.key===k);
  assert.deepEqual(Array.from(review.bounds.filter(b=>b.status==='blocked'),b=>b.key),['hp','defense','regen']);
  assert.equal(get('speed').status,'within-witness');assert.equal(get('power').status,'unproven');
  assert.equal(review.units.length,19);assert.ok(review.units.every(u=>u.current.hp===100&&u.current.regen===0));
});
test('runtime-scale proposal fits every verified DNA witness and preserves derived lineage order',()=>{
  const balance=JSON.parse(readFileSync(new URL('../Research/Balance/2026-11-04/audit.json',import.meta.url),'utf8'));
  const curves=M.runtimeScalePreset(),options={reference:{power:6,speed:.5,defense:0},regenInCombat:false};assert.ok(M.valid(curves));
  const result=M.calculate(curves,options);assert.equal(result.inversions.length,0);assert.ok(result.units.every(u=>u.seconds>=10&&u.seconds<=60));
  assert.ok(M.diagnose(curves,balance,options).bounds.every(bound=>bound.status==='within-witness'));
  const before=result.units[0].seconds;M.edit(curves,'regen',18,100000);assert.equal(M.calculate(curves,options).units[0].seconds,before);
});
