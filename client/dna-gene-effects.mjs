// All values come from the same model as live units, including tribe growth,
// dependencies, repeated pieces, and stat caps. No balance values live here.
export const DNA_EFFECT_ROWS = [
  ['health','체력',''],['meleePower','근접 공격력',''],['rangedPower','원거리 공격력',''],
  ['meleeSpeed','근접 공속','회/초'],['rangedSpeed','원거리 공속','회/초'],['hits','공격횟수','회'],
  ['armor','방어력',''],['evasion','회피 확률','%'],['parry','패링 확률','%'],['block','블록 확률','%'],
  ['blockPower','블록 피해 감소율','%'],['counter','방어 성공 후 반격 확률','%'],['counterPower','반격 피해 배율','%'],
  ['comboPower','추가 타격 피해 배율','%'],['critical','치명 확률','%'],['criticalPower','치명 피해 배율','%'],
  ['accuracy','상대 회피 확률 감소','%'],['penetration','방어 관통',''],['tenacity','기절 시간 감소율','%'],['reduction','받는 피해 감소율','%'],
  ['stun','기절 확률','%'],['stunTime','기절 지속시간','초'],['bleed','출혈 확률','%'],['bleedPower','출혈 피해','/초'],
  ['area','범위공격 추가 대상','명'],['areaPower','범위공격 피해 배율','%'],['lifesteal','준 피해 흡혈률','%'],
  ['reflection','피해 반사율','%'],['regeneration','체력 재생','/초'],['comboSpeed','추가 타격 간격','초'],['focus','공격 준비시간','초'],
  ['capacity','운반량','개'],['harvest','회당 채집량','개'],['harvestTime','채집 시간','초'],['harvestReduction','채집 시간','%'],['loadSpeed','적재 시 이동속도 비율','%'],
  ['movement','이동속도','칸/초'],['vision','시야','칸'],['lifespan','수명','초']
];

const attack = ['blade','secretion'];
const requirements = {
  antenna:[['blade','secretion','carapace']], power:[['blade']], speed:[['blade']],
  rangedPower:[['secretion']], rangedSpeed:[['secretion']], capacity:[['gather']], harvestSpeed:[['gather']],
  combo:[attack], comboPower:[attack,['combo']], comboSpeed:[attack,['combo']],
  critical:[attack], criticalPower:[attack,['critical']], accuracy:[attack], penetration:[attack],
  counter:[['blade','secretion','carapace'],['parry','block']],
  counterPower:[['blade','secretion','carapace'],['parry','block'],['counter']], blockPower:[['block']],
  stun:[attack], stunTime:[attack,['stun']], bleed:[attack], bleedPower:[attack,['bleed']],
  area:[attack], areaPower:[attack,['area']], lifesteal:[attack], focus:[attack]
};
const primary = {blade:'meleePower',secretion:'rangedPower',carapace:'armor',gather:'capacity',power:'meleePower',speed:'meleeSpeed',combo:'hits',harvestSpeed:'harvestReduction'};
const format = value => String(Number(value.toFixed(3)));

function difference(before,after,requiredKey) {
  return DNA_EFFECT_ROWS.filter(([key])=>Number.isFinite(before[key])&&Number.isFinite(after[key])&&(Math.abs(after[key]-before[key])>1e-9||key===requiredKey))
    .map(([key,label,unit])=>({key,label,unit,before:before[key],after:after[key],delta:after[key]-before[key]}));
}

export function dnaGeneEffects(M,pieces,geneId,tribe) {
  const gene=M.lookup.get(geneId);
  if(!gene)return null;
  const piece={gene:gene.id,grade:gene.grade,rotation:0,q:0,r:0};
  const before=M.stats(pieces,tribe),after=M.stats([...pieces,piece],tribe);
  const counts=M.counts(pieces),missing=(requirements[geneId]||[]).filter(options=>!options.some(id=>counts[id]));
  // Show the real increment if prerequisites are later supplied, without changing
  // the actual design or claiming those organs have already been placed.
  const activated=[...pieces,...missing.map(options=>{const entry=M.lookup.get(options[0]);return {gene:entry.id,grade:entry.grade,rotation:0,q:0,r:0};})];
  return {before,after,missing,effects:difference(before,after,primary[geneId]||geneId),
    conditional:missing.length?difference(M.stats(activated,tribe),M.stats([...activated,piece],tribe),primary[geneId]||geneId):[]};
}

export function dnaGeneCapped(M,pieces,geneId,tribe) {
  const gene=M.lookup.get(geneId);
  if(!gene||gene.category==='organ')return false;
  const result=dnaGeneEffects(M,pieces,geneId,tribe);
  const effects=result.missing.length?result.conditional:result.effects;
  return effects.length>0&&effects.every(effect=>Math.abs(effect.delta)<1e-9);
}

function effectLine(effect) {
  const {label,unit,delta}=effect;
  if(effect.key==='harvestReduction')return label+' '+(delta===0?'+0':format(-delta))+'%p';
  return label+' '+(delta>=0?'+':'')+format(delta)+(unit==='%'?'%p':unit);
}

export function dnaGeneTooltip(M,pieces,geneId,tribe,names) {
  const gene=M.lookup.get(geneId),existing=gene?.category==='organ'?pieces.findIndex(piece=>piece.gene===geneId):-1;
  const baseline=existing>=0?pieces.filter((_,index)=>index!==existing):pieces;
  const result=dnaGeneEffects(M,baseline,geneId,tribe);
  if(!result)return '';
  // Describe this piece's own effect, not the entire resulting unit. If its
  // organ is absent, use the same model with that organ enabled for the gain.
  const effects=result.missing.length?result.conditional:result.effects;
  const keys={blade:['meleePower','meleeSpeed'],secretion:['rangedPower','rangedSpeed'],gather:['capacity']}[geneId]||[primary[geneId]||geneId];
  const ability={blade:'근접 공격 가능',secretion:'원거리 공격 가능',gather:'자원 채집 가능',antenna:'사냥 가능'}[geneId];
  const lines=ability?[ability]:[];
  for(const effect of effects)if(keys.includes(effect.key))lines.push(effectLine(effect));
  return lines.join('\n')||names[geneId]||'';
}
