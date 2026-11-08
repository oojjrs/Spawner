import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTRIBUTE_DNA as M } from '../server/dna.mjs';
import { dnaUnitStats } from '../server/dna-unit.mjs';
import { dnaGeneNames } from './dna-editor.mjs';
import { dnaGeneEffects, dnaGeneTooltip, dnaGeneCapped, DNA_EFFECT_ROWS } from './dna-gene-effects.mjs';
const piece=gene=>({gene,grade:M.lookup.get(gene).grade,rotation:0,q:0,r:0});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const effect=(result,key)=>result.effects.find(value=>value.key===key);

test('상한은 누적 효과로 판단하고 미배치 선행 속성 때문에 첫 조각을 막지 않는다',()=>{
  for(const gene of M.catalog)assert.equal(dnaGeneCapped(M,[],gene.id,'bean'),false,gene.id);
  for(const [gene,count] of [['critical',3],['blockPower',3],['reduction',3],['comboSpeed',2],['focus',2],['areaPower',1],['harvestSpeed',10]]){
    const capped=Array.from({length:count},()=>piece(gene));
    assert.equal(dnaGeneCapped(M,capped,gene,'bean'),true,gene);
    assert.equal(dnaGeneCapped(M,capped.slice(1),gene,'bean'),false,gene);
  }
  assert.equal(dnaGeneCapped(M,Array.from({length:3},()=>piece('critical')),'critical','spore'),true);
  assert.equal(dnaGeneCapped(M,Array.from({length:3},()=>piece('block')),'block','pebble'),true);
  assert.equal(dnaGeneCapped(M,Array.from({length:3},()=>piece('block')),'block','bean'),false);
});

for(const tribe of ['bean','spore','pebble','spring'])test(`${tribe}: 모든 40개 속성의 수치는 실제 유닛 계산과 같다`,()=>{
  for(const gene of M.catalog)for(const pieces of [[],['blade','secretion','gather','carapace','combo','block','critical','stun','bleed','area'].filter(id=>id!==gene.id).map(piece)]){
    const before=dnaUnitStats({pieces},tribe).dna,after=dnaUnitStats({pieces:[...pieces,piece(gene.id)]},tribe).dna;
    const result=dnaGeneEffects(M,pieces,gene.id,tribe),text=dnaGeneTooltip(M,pieces,gene.id,tribe,dnaGeneNames);
    assert.deepEqual(result.before,before);assert.deepEqual(result.after,after);
    assert.ok(text.length>0);assert.ok(text.split('\n').length<=3,gene.id+': '+text);assert.doesNotMatch(text,/undefined|NaN|Infinity|→|조건|필요|비용|크기|종족|기본|조각/);
    assert.ok(result.effects.length||result.conditional.length||gene.id==='antenna',gene.id);
    for(const value of result.effects){close(value.before,before[value.key]);close(value.after,after[value.key]);close(value.delta,after[value.key]-before[value.key]);}
    for(const [key] of DNA_EFFECT_ROWS)if(Math.abs(after[key]-before[key])>1e-9)assert.ok(result.effects.some(value=>value.key===key),gene.id+': '+key);
    // One concise effect line replaces the old full-unit explanation.
    assert.ok(text.includes('+')||text.includes('-')||text.includes('사냥 가능'),gene.id);
  }
});

test('기관이 없어도 배치할 조각의 증가량을 한 줄로 안내한다',()=>{
  const result=dnaGeneEffects(M,[],'power','spring');assert.deepEqual(result.missing,[['blade']]);
  assert.equal(effect(result,'meleePower').delta,0);close(result.conditional.find(row=>row.key==='meleePower').delta,9.6);
  const text=dnaGeneTooltip(M,[],'power','spring',dnaGeneNames);
  assert.equal(text,'근접 공격력 +9.6');
  assert.deepEqual(dnaGeneEffects(M,[],'stunTime','bean').missing,[['blade','secretion'],['stun']]);
  assert.deepEqual(dnaGeneEffects(M,[piece('blade')],'comboPower','bean').missing,[['combo']]);
  assert.deepEqual(dnaGeneEffects(M,[],'blockPower','bean').missing,[['block']]);
  assert.match(dnaGeneTooltip(M,[],'antenna','bean',dnaGeneNames),/사냥 가능/);
});

test('종족별 실제 증가량과 중복 배치·상한·하한을 반영한다',()=>{
  for(const [tribe,gain] of [['bean',8],['spore',6.4],['pebble',6.8],['spring',9.6]])close(effect(dnaGeneEffects(M,[piece('blade')],'power',tribe),'meleePower').delta,gain);
  for(const tribe of ['bean','spore','pebble','spring'])assert.match(dnaGeneTooltip(M,[piece('gather')],'harvestSpeed',tribe,dnaGeneNames),/^채집 시간 -10%p$/);
  const repeated=[piece('gather'),piece('harvestSpeed'),piece('harvestSpeed')];
  const harvest=effect(dnaGeneEffects(M,repeated,'harvestSpeed','bean'),'harvestTime');
  close(harvest.before,M.stats(repeated,'bean').harvestTime);close(harvest.after,M.stats([...repeated,piece('harvestSpeed')],'bean').harvestTime);assert.ok(harvest.delta<0);
  close(harvest.delta,effect(dnaGeneEffects(M,[piece('gather')],'harvestSpeed','bean'),'harvestTime').delta);
  for(const [id,base] of [['critical',[piece('blade')]],['harvestSpeed',[piece('gather')]],['vision',[]],['focus',[piece('blade')]],['blockPower',[piece('block')]]]){
    const text=dnaGeneTooltip(M,[...base,...Array.from({length:30},()=>piece(id))],id,'bean',dnaGeneNames);
    assert.match(text,/\+0/);assert.equal(text.split('\n').length,1);
  }
  assert.match(dnaGeneTooltip(M,[piece('blade')],'critical','bean',dnaGeneNames),/^치명 확률 \+30%p$/);
});

test('기관이 켜는 기존 강화 효과와 원거리 전환의 손실도 숨기지 않는다',()=>{
  const result=dnaGeneEffects(M,[piece('power')],'blade','bean');close(effect(result,'meleePower').before,1);close(effect(result,'meleePower').after,10);
  const ranged=dnaGeneEffects(M,[],'secretion','bean');assert.equal(effect(ranged,'meleePower').delta,-1);assert.equal(effect(ranged,'meleeSpeed').delta,-.5);
  const gather=dnaGeneEffects(M,[],'gather','bean');assert.equal(effect(gather,'capacity').delta,1);assert.equal(effect(gather,'harvestTime').delta,M.stats([piece('gather')],'bean').harvestTime);
  const text=dnaGeneTooltip(M,[piece('blade')],'area','bean',dnaGeneNames);assert.match(text,/^범위공격 추가 대상 \+3명$/);assert.doesNotMatch(text,/3칸/);
});

test('체력과 재생 hover에는 해당 조각 증가량만 남긴다',()=>{
  for(const tribe of ['bean','spore','pebble','spring'])for(const gene of ['health','regeneration']) {
    const pieces=[piece('health')],result=dnaGeneEffects(M,pieces,gene,tribe),text=dnaGeneTooltip(M,pieces,gene,tribe,dnaGeneNames);
    const row=effect(result,gene),delta=String(Number(row.delta.toFixed(3)));
    assert.equal(text,row.label+' +'+delta+row.unit);
    assert.doesNotMatch(text,/기본|추가|총회복|교전|출혈|→|크기/);
  }
});
