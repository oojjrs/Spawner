import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ATTRIBUTE_DNA as M } from '../../../../server/dna.mjs';
import { validateDna } from '../../../../server/dna-unit.mjs';

// Follow stage 2 with stage 3, then stage 4. These are conditional design
// references, not approvals of a new catalog or a reason to revisit level one.
const stage2=JSON.parse(readFileSync(new URL('../level2/comparison.json',import.meta.url)));
if(createHash('sha256').update(readFileSync(new URL('../../../../server/dna.mjs',import.meta.url))).digest('hex')!==stage2.sourceHash)
  throw new Error('Stage-two source changed; reconcile before inspecting later stages.');
const names={...Object.fromEntries(stage2.currentGenes.map(g=>[g.gene,g.label])),
  gather:'채집기관',health:'체력',blade:'칼날',movement:'이속',secretion:'분비기관',combo:'연타',legs:'다리',armor:'경화',vision:'시야',harvest:'채집량',harvestSpeed:'채집속도',loadSpeed:'하중적응',accuracy:'정밀',tenacity:'강인함',healing:'회복력',block:'방어본능',evasion:'회피',rangedPower:'원거리 공격력',rangedSpeed:'원거리 공속',parry:'패링',counter:'반격',critical:'치명',criticalPower:'치명위력',penetration:'예리함',comboPower:'연격숙련',blockPower:'방어숙련',counterPower:'반격위력',reduction:'완충',stun:'기절',stunTime:'기절연장',bleed:'출혈',bleedPower:'출혈강도',area:'범위공격',areaPower:'확산위력',lifesteal:'흡혈',reflection:'반사',regeneration:'재생',comboSpeed:'연타속도',focus:'집중'};
const cases={3:[
  {id:'ranged',title:'원거리 기본 강화',genes:['secretion','rangedPower','rangedSpeed','health']},
  {id:'gather',title:'채집량·속도와 운반 용량',genes:['gather','gather','capacity','capacity','harvest','harvestSpeed','movement']},
  {id:'defense',title:'갑각·경화·방어본능',genes:['carapace','armor','block','health','health']},
  {id:'combo',title:'칼날·공격력·연타',genes:['blade','power','power','combo','health']},
  {id:'scout',title:'안테나·시야·이속',genes:['antenna','vision','movement','movement','health']},
  {id:'loaded',title:'운반·하중적응',genes:['gather','capacity','loadSpeed','movement','health']}
],4:[
  {id:'critical',title:'치명·치명위력',genes:['blade','power','speed','critical','criticalPower','health']},
  {id:'stun',title:'기절·기절연장',genes:['blade','power','stun','stunTime','health']},
  {id:'bleed',title:'출혈·출혈강도',genes:['blade','power','bleed','bleedPower','health']},
  {id:'area',title:'범위공격·확산위력',genes:['blade','power','area','areaPower','health']},
  {id:'counter',title:'방어 판정·반격·반격위력',genes:['blade','carapace','block','parry','counter','counterPower','health']},
  {id:'recovery',title:'전투후 재생·받는 회복량',genes:['health','health','health','regeneration','healing']},
  {id:'combo-timing',title:'연타·연격숙련·연타속도·집중',genes:['blade','power','combo','comboPower','comboSpeed','focus','health']}
]};

function findLayout(ids,level,shapePlan) {
  const remaining={};for(const id of ids)remaining[id]=(remaining[id]||0)+1;
  const pieces=[];let visits=0;
  function visit() {
    if(++visits>250000)throw Error('Search budget exhausted; do not claim impossibility.');
    if(pieces.length===ids.length)return pieces.map(p=>({...p,shape:[...p.shape]}));
    for(const id of Object.keys(remaining))if(remaining[id]){
      const gene=M.lookup.get(id);remaining[id]--;
      for(let rotation=0;rotation<(pieces.length?6:1);rotation++){
        pieces.push({gene:id,grade:gene.grade,rotation,shape:shapePlan[id]||gene.steps});
        if(M.trace(pieces,level).valid){const result=visit();if(result)return result;}
        pieces.pop();
      }
      remaining[id]++;
    }
    return null;
  }
  const result=visit();if(!result)throw Error('No layout found for '+ids.join(','));
  return {pieces:result,searchVisits:visits,selection:'first legal witness; not an optimum or exhaustive count'};
}
function piece(id){const gene=M.lookup.get(id);return{gene:id,grade:gene.grade,rotation:0,shape:gene.steps}}
function stats(ids){return M.stats(ids.map(piece))}
function effectFields(before,after){return Object.fromEntries(Object.keys(after).filter(key=>after[key]!==before[key]).map(key=>[key,{before:before[key],after:after[key]}]));}
const empty=M.stats([]);
const groups={
  3:[{role:'근접·원거리 강화',genes:['combo','accuracy','rangedPower','rangedSpeed']},
    {role:'경제 강화',genes:['harvest','harvestSpeed','loadSpeed']},
    {role:'생존 강화',genes:['legs','armor','block','evasion','tenacity']},
    {role:'정찰',genes:['vision']},{role:'받는 회복량',genes:['healing']}],
  4:[{role:'공격 강화',genes:['critical','criticalPower','penetration','comboPower']},
    {role:'공격 주기·연타 간격',genes:['comboSpeed','focus']},
    {role:'방어·반격',genes:['parry','counter','blockPower','counterPower','reduction']},
    {role:'제어',genes:['stun','stunTime']},{role:'출혈',genes:['bleed','bleedPower']},
    {role:'광역',genes:['area','areaPower']},{role:'유지력·반사',genes:['lifesteal','reflection','regeneration']}]
};
const prerequisites={combo:['blade'],accuracy:['blade'],rangedPower:['secretion'],rangedSpeed:['secretion'],harvest:['gather','capacity'],harvestSpeed:['gather'],loadSpeed:['gather'],vision:['antenna'],critical:['blade'],criticalPower:['blade','critical'],penetration:['blade'],comboPower:['blade','combo'],comboSpeed:['blade','combo'],focus:['blade'],counter:['blade','carapace'],counterPower:['blade','carapace','counter'],blockPower:['carapace'],stun:['blade'],stunTime:['blade','stun'],bleed:['blade'],bleedPower:['blade','bleed'],area:['blade'],areaPower:['blade','area'],lifesteal:['blade']};
const steps=[];
for(const level of [3,4]){
  const catalog=M.catalog.filter(gene=>gene.grade===level);
  const grouped=groups[level].flatMap(group=>group.genes);
  if(new Set(grouped).size!==catalog.length||catalog.some(gene=>!grouped.includes(gene.id)))throw Error('Incomplete stage grouping');
  const examples=cases[level].map(entry=>{
    const layouts=stage2.results.slice(0,2).map(plan=>{
      const sample=findLayout(entry.genes,level,plan.shapes),trace=M.trace(sample.pieces,level),cost=M.price(sample.pieces);
      const rotations=Array.from({length:6},(_,rotation)=>{
        const pieces=sample.pieces.map(p=>({...p,rotation:(p.rotation+rotation)%6}));
        const geometric=M.trace(pieces,level).valid,native=!!validateDna({version:3,pieces,budget:cost,level},level,cost);
        if(!geometric||plan.gameCompatible&&!native)throw Error('Invalid higher-stage witness');
        return {rotation,geometric,native};
      });
      return {stage2Plan:plan.id,...sample,paths:trace.paths.map(path=>({gene:path.gene,points:path.points})),occupied:trace.occupied.size,rotations};
    });
    const value=stats(entry.genes);
    return {...entry,birthCost:3+M.price(entry.genes.map(piece)),stats:value,layouts};
  });
  steps.push({level,boardNodes:level===3?61:91,catalog:catalog.map(gene=>({gene:gene.id,label:names[gene.id],grade:gene.grade,shape:gene.steps,cost:M.price([piece(gene.id)]),
    related:prerequisites[gene.id]||[],standaloneDelta:effectFields(empty,stats([gene.id])),
    relatedDelta:effectFields(stats(prerequisites[gene.id]||[]),stats([...(prerequisites[gene.id]||[]),gene.id]))})),groups:groups[level],examples});
}
const dependencyChecks={
  harvestWithoutExtraCapacity:stats(['gather','harvest']).harvest,
  gatherBaseline:stats(['gather']).harvest,
  harvestWithOneCapacity:stats(['gather','capacity','harvest']).harvest,
  harvestWithTwoCapacity:stats(['gather','capacity','capacity','harvest']).harvest,
  legsEvasion:stats(['legs']).evasion,evasionEvasion:stats(['evasion']).evasion,
  healingReceivedMultiplier:1+stats(['healing']).healing/100,
  critPowerWithoutCritChance:stats(['blade','criticalPower']).critical,
  noStunStunTime:stats(['blade','stunTime']).stunTime,
  noBleedBleedPower:stats(['blade','bleedPower']).bleedPower,
  noAreaAreaPower:stats(['blade','areaPower']).areaPower,
  regenerationPerSecond:stats(['regeneration']).regeneration,
  regenerationWithHealingPerSecond:stats(['regeneration']).regeneration*(1+stats(['healing']).healing/100)
};
const data={version:1,applied:false,firstLevelFixed:true,stageOrder:[2,3,4],
  stage2Decision:'still a proposal; higher-stage witnesses are conditional on current or stage2-A shapes',
  sourceHash:stage2.sourceHash,dependencyChecks,stages:steps,
  limits:['Catalog grouping describes existing genes; it does not approve their final shape assignments.',
    'Examples are placement and effect witnesses, not optimal builds or combat/income simulations.',
    'Current catalog witnesses pass native validation. Stage2-A shape witnesses may require migration before game use.',
    'Related genes are representative builds, not exclusive prerequisites; ranged organs and alternative defense triggers can also apply.',
    'Healing is received recovery; regeneration is out of combat after the existing five-second delay.']};
writeFileSync(new URL('./higher-levels.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({dependencies:dependencyChecks,stages:steps.map(stage=>({level:stage.level,genes:stage.catalog.length,examples:stage.examples.map(e=>({id:e.id,cost:e.birthCost,occupied:e.layouts.map(l=>l.occupied),visits:e.layouts.map(l=>l.searchVisits)}))}))},null,2));
