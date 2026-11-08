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
  ['capacity','운반량','개'],['harvest','회당 채집량','개'],['harvestTime','채집 시간','초'],['loadSpeed','적재 시 이동속도 비율','%'],
  ['movement','이동속도','칸/초'],['vision','시야','칸'],['lifespan','수명','초']
];

const descriptions = {
  blade:'근접 선제 공격을 할 수 있습니다.', secretion:'원거리 선제 공격을 할 수 있습니다.',
  carapace:'방어력을 높입니다. 안테나와 함께 있으면 사냥도 할 수 있습니다.',
  antenna:'칼날·분비기관·갑각 중 하나와 함께 있으면 사냥 대상을 찾습니다.',
  gather:'자기 종족의 자원을 채집하고 둥지로 운반합니다.',
  power:'칼날의 근접 공격력을 높입니다.', speed:'칼날의 초당 근접 공격 횟수를 높입니다.',
  rangedPower:'분비기관의 원거리 공격력을 높입니다.', rangedSpeed:'분비기관의 초당 원거리 공격 횟수를 높입니다.',
  health:'최대 체력을 높입니다.', movement:'초당 이동하는 거리를 늘립니다.',
  capacity:'한 번에 운반할 수 있는 자원 수를 늘립니다.', harvestSpeed:'자원 한 번을 채집하는 시간을 줄입니다.',
  vision:'볼 수 있는 거리를 늘립니다.', lifespan:'태어난 뒤 살 수 있는 시간을 늘립니다.',
  combo:'한 번의 공격에 추가 타격을 붙입니다.', comboPower:'첫 타격 이후 추가 타격의 피해 배율을 높입니다.',
  comboSpeed:'추가 타격 사이의 시간을 줄입니다.', critical:'치명타가 발생할 확률을 높입니다.',
  criticalPower:'치명타의 피해 배율을 높입니다.', accuracy:'상대의 회피 확률을 낮춥니다.',
  penetration:'상대 방어력을 일부 무시합니다.', evasion:'피격을 회피할 확률을 높입니다.',
  parry:'근접 공격을 막아 피해를 없앨 확률을 높입니다.', block:'공격을 블록해 피해를 줄일 확률을 높입니다.',
  blockPower:'블록에 성공했을 때 줄이는 피해 비율을 높입니다.',
  counter:'패링·블록 성공 뒤 반격할 확률을 높입니다.', counterPower:'반격의 피해 배율을 높입니다.',
  tenacity:'적에게 받은 기절의 지속시간을 줄입니다.', reduction:'받는 피해를 줄입니다.',
  stun:'명중한 적을 기절시킬 확률을 높입니다.', stunTime:'적에게 거는 기절의 지속시간을 늘립니다.',
  bleed:'명중한 적에게 지속 출혈을 걸 확률을 높입니다.', bleedPower:'출혈의 초당 피해를 높입니다.',
  area:'같은 전투에서 추가로 피해를 줄 대상 수를 늘립니다.', areaPower:'추가 대상에게 주는 범위 피해 배율을 높입니다.',
  lifesteal:'실제로 준 피해의 일부를 체력으로 회복합니다.', reflection:'피격 시 피해의 일부를 공격자에게 돌려줍니다.',
  regeneration:'시간에 따라 체력을 회복합니다.', focus:'공격이 시작된 뒤 첫 타격까지의 준비시간을 줄입니다.'
};
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
const primary = {blade:'meleePower',secretion:'rangedPower',carapace:'armor',gather:'capacity',power:'meleePower',speed:'meleeSpeed',combo:'hits',harvestSpeed:'harvestTime'};
const tribeNames={bean:'새싹콩',pebble:'몽돌',spore:'포자버섯',spring:'샘방울'};
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

function effectLine(effect) {
  const {label,unit,before,after,delta}=effect;
  return label+' '+format(before)+unit+' → '+format(after)+unit+' ('+(delta>0?'+':'')+format(delta)+(unit==='%'?'%p':unit)+')';
}

export function dnaGeneTooltip(M,pieces,geneId,tribe,names) {
  const gene=M.lookup.get(geneId),existing=gene?.category==='organ'?pieces.findIndex(piece=>piece.gene===geneId):-1;
  const baseline=existing>=0?pieces.filter((_,index)=>index!==existing):pieces;
  const result=dnaGeneEffects(M,baseline,geneId,tribe);
  if(!result)return '';
  const lines=[names[geneId]+' · '+(tribeNames[tribe]||tribeNames.bean)+' 기준', descriptions[geneId]||'능력치를 높입니다.',
    '조각 1개 · '+gene.cells.length+'칸 · 비용 +'+M.piecePrice({gene:geneId,grade:gene.grade})+'P',
    existing>=0?'이미 배치된 기관 1개의 효과:':'현재 설계에 1개 추가 시:'];
  if(result.missing.length)lines.push('효과 활성에 필요: '+result.missing.map(options=>options.map(id=>names[id]).join(' 또는 ')).join(' + '));
  if(result.effects.length)lines.push(...result.effects.map(effectLine));
  else lines.push('현재 능력치 변화 없음');
  if(result.before.hunting!==result.after.hunting)lines.push('사냥 '+(result.after.hunting?'가능':'불가'));
  if(result.missing.length){
    lines.push('필요 속성을 함께 배치하면:');
    lines.push(...result.conditional.map(effectLine));
    if(geneId==='antenna')lines.push('사냥 가능');
  }else if(result.effects.length&&result.effects.every(effect=>Math.abs(effect.delta)<1e-9))lines.push('상한/하한에 도달해 더 늘어나지 않습니다.');
  lines.push('크기 '+format(result.before.scale)+'배 → '+format(result.after.scale)+'배');
  if(gene.category==='organ')lines.push('같은 기관은 하나만 배치할 수 있습니다.');
  return lines.join('\n');
}
