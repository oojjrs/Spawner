import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTRIBUTE_DNA as M } from '../server/dna.mjs';
import { dnaUnitStats } from '../server/dna-unit.mjs';
import { dnaGeneNames } from './dna-editor.mjs';
import { dnaGeneEffects, dnaGeneTooltip, DNA_EFFECT_ROWS } from './dna-gene-effects.mjs';
const piece=gene=>({gene,grade:M.lookup.get(gene).grade,rotation:0,q:0,r:0});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const effect=(result,key)=>result.effects.find(value=>value.key===key);

for(const tribe of ['bean','spore','pebble','spring'])test(`${tribe}: 모든 40개 속성의 수치는 실제 유닛 계산과 같다`,()=>{
  for(const gene of M.catalog)for(const pieces of [[],['blade','secretion','gather','carapace','combo','block','critical','stun','bleed','area'].filter(id=>id!==gene.id).map(piece)]){
    const before=dnaUnitStats({pieces},tribe).dna,after=dnaUnitStats({pieces:[...pieces,piece(gene.id)]},tribe).dna;
    const result=dnaGeneEffects(M,pieces,gene.id,tribe),text=dnaGeneTooltip(M,pieces,gene.id,tribe,dnaGeneNames);
    assert.deepEqual(result.before,before);assert.deepEqual(result.after,after);
    assert.match(text,/조각 1개/);assert.match(text,/추가 시/);assert.doesNotMatch(text,/undefined|NaN|Infinity/);
    assert.ok(result.effects.length||result.conditional.length||gene.id==='antenna',gene.id);
    for(const value of result.effects){close(value.before,before[value.key]);close(value.after,after[value.key]);close(value.delta,after[value.key]-before[value.key]);}
    for(const [key] of DNA_EFFECT_ROWS)if(Math.abs(after[key]-before[key])>1e-9)assert.ok(result.effects.some(value=>value.key===key),gene.id+': '+key);
    // A full catalog must contain a human explanation for every current gene.
    assert.notEqual(text.split('\n')[1],'능력치를 높입니다.',gene.id);
  }
});

test('기관 없는 강화는 실제 0과 활성 후 효과를 구분한다',()=>{
  const result=dnaGeneEffects(M,[],'power','spring');assert.deepEqual(result.missing,[['blade']]);
  assert.equal(effect(result,'meleePower').delta,0);close(result.conditional.find(row=>row.key==='meleePower').delta,9.6);
  const text=dnaGeneTooltip(M,[],'power','spring',dnaGeneNames);
  assert.match(text,/효과 활성에 필요: 칼날/);assert.match(text,/1 → 1 \(0\)/);assert.match(text,/2.2 → 11.8 \(\+9.6\)/);
  assert.deepEqual(dnaGeneEffects(M,[],'stunTime','bean').missing,[['blade','secretion'],['stun']]);
  assert.deepEqual(dnaGeneEffects(M,[piece('blade')],'comboPower','bean').missing,[['combo']]);
  assert.deepEqual(dnaGeneEffects(M,[],'blockPower','bean').missing,[['block']]);
  assert.match(dnaGeneTooltip(M,[],'antenna','bean',dnaGeneNames),/사냥 가능/);
});

test('종족별 실제 증가량과 중복 배치·상한·하한을 반영한다',()=>{
  for(const [tribe,gain] of [['bean',8],['spore',6.4],['pebble',6.8],['spring',9.6]])close(effect(dnaGeneEffects(M,[piece('blade')],'power',tribe),'meleePower').delta,gain);
  const repeated=[piece('gather'),piece('harvestSpeed'),piece('harvestSpeed')];
  const harvest=effect(dnaGeneEffects(M,repeated,'harvestSpeed','bean'),'harvestTime');
  close(harvest.before,M.stats(repeated,'bean').harvestTime);close(harvest.after,M.stats([...repeated,piece('harvestSpeed')],'bean').harvestTime);assert.ok(harvest.delta<0);
  assert.ok(Math.abs(harvest.delta)<Math.abs(effect(dnaGeneEffects(M,[piece('gather')],'harvestSpeed','bean'),'harvestTime').delta));
  for(const [id,base] of [['critical',[piece('blade')]],['vision',[]],['focus',[piece('blade')]],['blockPower',[piece('block')]]]){
    const text=dnaGeneTooltip(M,[...base,...Array.from({length:30},()=>piece(id))],id,'bean',dnaGeneNames);
    assert.match(text,/상한\/하한/);assert.match(text,/\(0/);
  }
  assert.match(dnaGeneTooltip(M,[piece('blade')],'critical','bean',dnaGeneNames),/0% → 30% \(\+30%p\)/);
});

test('기관이 켜는 기존 강화 효과와 원거리 전환의 손실도 숨기지 않는다',()=>{
  const result=dnaGeneEffects(M,[piece('power')],'blade','bean');close(effect(result,'meleePower').before,1);close(effect(result,'meleePower').after,10);
  const ranged=dnaGeneEffects(M,[],'secretion','bean');assert.equal(effect(ranged,'meleePower').delta,-1);assert.equal(effect(ranged,'meleeSpeed').delta,-.5);
  const gather=dnaGeneEffects(M,[],'gather','bean');assert.equal(effect(gather,'capacity').delta,1);assert.equal(effect(gather,'harvestTime').delta,4);
  const text=dnaGeneTooltip(M,[piece('blade')],'area','bean',dnaGeneNames);assert.match(text,/추가 대상 0명 → 3명/);assert.doesNotMatch(text,/3칸/);
});
