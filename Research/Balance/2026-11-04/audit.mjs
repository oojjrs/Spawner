import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { ATTRIBUTE_DNA as D } from '../../../server/dna.mjs';
import { unitCombatStats, combatProfile } from '../../../server/combat-stats.mjs';
import { createCombat } from '../../../server/combat.mjs';
import { CREATURE_MOVEMENT } from '../../../server/creature-movement.mjs';
import { encounterTerritory } from '../../../server/encounter-territory.mjs';
const root = new URL('../../../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const scope = {}; runInNewContext(await text('client/neutral-stat-model.js'), scope);
const M = scope.SpawnerNeutralCurves;

// The display table is a design input, not a runtime combat profile.
const html = await text('Design.html');
const table = html.split('<div id="neutral-unit-tier-design">')[1].split('</tbody>')[0];
const fields = JSON.parse(html.match(/const fields = (\[[^;]+\]);/)[1]);
const extras = JSON.parse(html.match(/const extraTiers = (\[[\s\S]+?\n  \]);/)[1]);
const byName = new Map(M.rows.map(row => [row.name.replaceAll(' ', ''), row.key]));
const tiers = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].filter(match=>match[1].includes('tier-unit-name-')).map((match, i) => {
  const name = match[1].match(/<span id="tier-unit-name-\d+">([^<]+)<\/span>/)?.[1];
  const base = [...match[1].matchAll(/<td class="text-end">(\d+)<\/td>/g)].map(m => Number(m[1]));
  const values = [...base, ...extras[i]];
  return { key: byName.get(name.replace(' ★', '').replaceAll(' ', '')), ranks: Object.fromEntries(fields.slice(2).map((field, n) => [field, values[n]])) };
});
const tierByKey = new Map(tiers.map(row => [row.key, row]));
const statFields = fields.slice(3), lineageViolations = [];
for(const field of statFields)if(tiers.map(row=>row.ranks[field]).sort((a,b)=>a-b).some((rank,index)=>rank!==index+1))throw new Error('Design stat ranks must be a 1..19 permutation: '+field);
for(const row of M.rows)for(const [axis,field]of Object.entries({hp:'health',power:'power',speed:'speed',defense:'armor',regen:'regeneration'}))if(row.ranks[axis]!==tierByKey.get(row.key).ranks[field])throw new Error('Editor/design rank drift: '+row.key+'/'+axis);
for (const field of statFields) for (let i=0;i<M.lineages.length;i++) for(let j=i+1;j<M.lineages.length;j++) {
  const [a,au]=M.lineages[i].map(key => tierByKey.get(key).ranks[field]);
  const [b,bu]=M.lineages[j].map(key => tierByKey.get(key).ranks[field]);
  if (Math.sign(a-b)!==Math.sign(au-bu)) lineageViolations.push({field,pairs:[M.lineages[i],M.lineages[j]],ranks:[a,b,au,bu]});
}
const runtime = M.rows.map(row => {
  const base = unitCombatStats(row.key), profile = combatProfile({species:row.key,attributes:{},stats:base});
  return {key:row.key,hp:base.health,power:profile.attackPower,speed:profile.attackSpeed,defense:profile.defense,regen:0,
    combatStrength:base.combatStrength,movement:CREATURE_MOVEMENT[row.key].speed,vision:encounterTerritory({species:row.key})?.detectionRadius??null};
});
const runtimeRankMismatches=[];
for(const axis of M.axes)for(let i=0;i<M.rows.length;i++)for(let j=i+1;j<M.rows.length;j++){
  const a=M.rows[i],b=M.rows[j],expected=Math.sign(a.ranks[axis.key]-b.ranks[axis.key]);
  const actual=Math.sign(runtime[i][axis.key]-runtime[j][axis.key]);
  if(expected!==actual)runtimeRankMismatches.push({axis:axis.key,keys:[a.key,b.key],kind:actual===0?'tie':'inversion'});
}

// A finite search yields witnesses, never a falsely claimed optimum.
// Every grade-g piece requires g new internal cells under native trace rules.
// With 91 cells and the origin occupied, floor(90/g) is a certified upper bound.
if(D.boardRadius(4)!==5)throw new Error('Re-derive DNA bounds for the changed level4 board');
const points=[];for(let q=-5;q<=5;q++)for(let r=-5;r<=5;r++)if(D.inside({q,r},4))points.push({q,r});
if(points.length!==91)throw new Error('Unexpected level4 board geometry');
const indices=new Map(points.map((p,i)=>[D.key(p),i]));
const bit=i=>1n<<BigInt(i),origin=indices.get('0,0');
const edges=new Map();for(let a=0;a<points.length;a++)for(let d=0;d<6;d++){const b=indices.get(D.key(D.step(points[a],d)));if(b!==undefined){const key=[a,b].sort((x,y)=>x-y).join(':');if(!edges.has(key))edges.set(key,edges.size)}}
function placements(gene){return points.map((p,start)=>Array.from({length:6},(_,rotation)=>{
  const route=D.route(p,gene,gene.grade,rotation,D.shape(gene,gene.grade)),ids=route.map(p=>indices.get(D.key(p)));
  if(ids.some(i=>i===undefined)||new Set(ids.slice(0,-1)).size!==ids.length-1)return null;
  let internal=0n,edge=0n;for(const i of ids.slice(1,-1))internal|=bit(i);
  for(let i=1;i<ids.length;i++){const mask=bit(edges.get([ids[i-1],ids[i]].sort((a,b)=>a-b).join(':')));if(edge&mask)return null;edge|=mask}
  const end=ids.at(-1);if(internal&bit(end))return null;
  return {rotation,start,end,internal,edge,newNodes:bit(end),newCells:internal|bit(end)};
}).filter(Boolean))}
function search(geneKey,withBlade){
  const gene=D.lookup.get(geneKey),options=placements(gene),prefix=Array.isArray(withBlade)?withBlade:withBlade?['blade']:[];
  let states=[{end:origin,occupied:bit(origin),paths:0n,nodes:bit(origin),edges:0n,pieces:[],cells:1}],best=states[0];
  const apply=(s,p,key)=>!(s.occupied&p.internal)&&!(s.paths&p.newNodes)&&!(s.edges&p.edge)?{
    end:p.end,occupied:s.occupied|p.newCells,paths:s.paths|p.internal,nodes:s.nodes|p.newNodes,edges:s.edges|p.edge,
    pieces:[...s.pieces,{gene:key,grade:D.lookup.get(key).grade,rotation:p.rotation,shape:D.shape(D.lookup.get(key),D.lookup.get(key).grade)}],
    cells:s.cells+D.lookup.get(key).grade+Number(!(s.occupied&p.newNodes))}:null;
  for(const key of prefix){const choices=placements(D.lookup.get(key));states=states.flatMap(s=>choices[s.end].map(p=>apply(s,p,key)).filter(Boolean))}
  let seed=0x39c7;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32};
  const upper=Math.floor((90-prefix.reduce((sum,key)=>sum+D.lookup.get(key).grade,0))/gene.grade);
  for(let count=0;count<upper&&states.length;count++){
    const next=new Map();for(const s of states)for(const p of options[s.end]){const value=apply(s,p,geneKey);if(!value)continue;
      const id=[value.end,value.paths.toString(36),value.nodes.toString(36),value.edges.toString(36)].join(':');
      if(!next.has(id)){value.score=value.cells+noise()*4;next.set(id,value)}
    }
    states=[...next.values()].sort((a,b)=>a.score-b.score).slice(0,1800);
    if(states.length)best=states[0];
  }
  const trace=D.trace(best.pieces,4);if(!trace.valid)throw new Error('Invalid witness '+geneKey);
  const count=best.pieces.filter(p=>p.gene===geneKey).length,stats=D.stats(best.pieces);
  return {gene:geneKey,grade:gene.grade,requiresBlade:prefix.includes('blade'),prefix,achievedCount:count,countUpperBound:upper,search:'deterministic beam width 1800; lower bound only',price:D.price(best.pieces),occupiedCells:trace.occupied.size,pieces:best.pieces,stats};
}
const witnesses=[search('health',false),search('power',true),search('speed',true),search('armor',false),search('regeneration',false)];
const referenceWitness=search('health',['blade','power']);
if(referenceWitness.stats.health<500)throw new Error('Reference layout no longer reaches 500HP');
const referencePieces=referenceWitness.pieces.slice(0,51),referenceStats=D.stats(referencePieces);
if(!D.trace(referencePieces,4).valid||referenceStats.health!==500)throw new Error('Invalid real reference layout');
const realReference={pieces:referencePieces,stats:referenceStats,price:D.price(referencePieces),level:4,description:'레벨4 실제 배치: 체력49 + 칼날1 + 공격강화1 · 500HP / 공격6 / 공속0.5 / 방어0'};
const bounds={hp:{upper:910,witness:witnesses[0].stats.health},power:{upper:178,witness:witnesses[1].stats.power},
  speed:{upper:4,witness:witnesses[2].stats.speed},defense:{upper:90,witness:witnesses[3].stats.armor},regen:{upper:8.8,witness:witnesses[4].stats.regeneration}};

// The actual server combat engine, in a controlled same-cell arena. The 1200HP
// reference is the handoff's hypothetical attacker, not a producible DNA build.
// One reference owner joins all N units to the same side. No terrain exits;
// aggressive neutral disposition suppresses peaceful world escape.
function arena(row,stats,reference){
  const referenceDna=reference||{...D.stats([]),health:1200,melee:true,ranged:false,power:75,meleePower:75,meleeSpeed:1,speed:1,hits:1,armor:50,focus:.3,comboSpeed:.12,regeneration:10};
  const make=(id,options)=>({id,x:100,y:100,health:options.stats.health,attributes:{},carrying:0,mode:'fight',combatDisposition:'aggressive',moveDuration:0,animationStartedAt:0,...options});
  const players=Array.from({length:row.party},(_,i)=>make('reference-'+i,{ownerId:'reference',tribe:'bean',stats:{health:referenceDna.health,attackPower:referenceDna.power,attackSpeed:referenceDna.speed,defense:referenceDna.armor,vision:0,dna:{...referenceDna}}}));
  const neutral=make('neutral',{species:row.key,stats:{...stats,vision:0}}),agents=[...players,neutral];
  const hurt=(agent,damage)=>{agent.health=Math.max(0,agent.health-damage)};
  const environment={simSeconds:0,games:new Map([['reference',{agents:players,receiveDamage:hurt}]]),creatureSystem:{agents:[neutral],receiveDamage:hurt},colonies:[],world:{size:320,terrain:new Uint8Array(320*320)},damageRandom:()=>.5,combatRandom:()=>.5};
  environment.world.terrain[100*320+100]=4;
  const combat=createCombat(environment);combat.engage(players[0],neutral,0);
  if(!neutral.combat||players.some(player=>player.combat?.id!==neutral.combat.id||player.combat.side===neutral.combat.side))throw new Error('Incorrect comparison teams: '+row.key);
  for(let step=0;step<=120*60;step++){
    const time=step/60;environment.simSeconds=time;
    for(const agent of agents)if(agent.health>0)combat.update(agent,time);
    if(agents.some(agent=>!Number.isFinite(agent.health)))throw new Error('Non-finite arena health: '+row.key);
    if(neutral.health<=0||players.every(p=>p.health<=0))return {seconds:time,result:neutral.health<=0?'reference-win':'neutral-win',survivors:players.filter(p=>p.health>0).length};
  }
  return {seconds:120,result:'timeout',survivors:players.filter(p=>p.health>0).length};
}
const draft=M.calculate(M.initial()).units;
const arenaResults=runtime.map(row=>{
  const input=M.rows.find(r=>r.key===row.key),proposal=draft.find(r=>r.key===row.key);
  const custom={...D.stats([]),health:proposal.hp,melee:true,power:proposal.power,meleePower:proposal.power,meleeSpeed:proposal.speed,speed:proposal.speed,hits:1,armor:proposal.defense,focus:.3,comboSpeed:.12,regeneration:proposal.regen};
  return {key:row.key,actual:arena(input,{...unitCombatStats(row.key),attackPower:row.power,attackSpeed:row.speed,defense:row.defense}),draft:arena(input,{health:proposal.hp,dna:custom})};
});
const proposalCurves=M.runtimeScalePreset(),proposalUnits=M.calculate(proposalCurves,{reference:{power:6,speed:.5,defense:0},regenInCombat:false});
const proposalResults=proposalUnits.units.map(unit=>({key:unit.key,...arena(unit,{health:unit.hp,attackPower:unit.power,attackSpeed:unit.speed,defense:unit.defense},referenceStats)}));
const proposal={name:'실게임 규모 제안',appliedToGame:false,curves:proposalCurves,reference:realReference,
  regeneration:'전투중0, 전투종료5초후 회복값의 제안. 19개 순위를 실제 DNA 단위에 맞추기 위해 0.1HP/s 간격; 기존 정수 초안보다 세밀하게 편집함. 아직 중립 런타임에 재생 기능을 부여하지 않음.',
  units:proposalUnits.units,derivedDpsInversions:proposalUnits.inversions,arena:proposalResults,
  actualArena:runtime.map(row=>({key:row.key,...arena(M.rows.find(r=>r.key===row.key),{...unitCombatStats(row.key),attackPower:row.power,attackSpeed:row.speed,defense:row.defense},referenceStats)}))};
proposal.priorityDuels=[['white-paw','spiny-back-leader'],['walking-forest','white-paw']].map(([stronger,weaker])=>{
  const a=proposal.units.find(unit=>unit.key===stronger),b=proposal.units.find(unit=>unit.key===weaker);
  const reference={...D.stats([]),health:a.hp,melee:true,power:a.power,meleePower:a.power,meleeSpeed:a.speed,speed:a.speed,hits:1,armor:a.defense,focus:.3,comboSpeed:.12};
  return {stronger,weaker,...arena({...b,party:1},{health:b.hp,attackPower:b.power,attackSpeed:b.speed,defense:b.defense},reference)};
});
const sourcePaths=['server/combat-stats.mjs','server/combat.mjs','server/dna.mjs','server/dna-actions.mjs','server/dna-unit.mjs','server/encounters.mjs','server/creature-movement.mjs','server/creature-movement-profiles.mjs','server/encounter-territory.mjs','Design.html'];
const sources=Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,sha(await readFile(new URL(p,root)))])));
const audit={version:1,scope:'runtime snapshot and design review; no gameplay values changed',sources,
  design:{axes:statFields.length,lineageComparisons:statFields.length*15,lineageViolations,tiers,runtimeRankMismatches},runtime,arena:{engine:'server/combat.mjs',assumptions:'1200HP/75 power/1Hz/50 defense hypothetical reference, fixed N on one team; aggressive neutral in same-cell arena, no walkable exits, deterministic random .5. Actual uses neutral runtime; draft uses only five proposed stats with other effects zero. Engine regeneration is OUT OF COMBAT ONLY, 5s after combat; analytical draft instead assumes in-combat HPS. Neither reference nor proposed DNA is a validated producible build.',results:arenaResults},
  dna:{level:4,cells:91,proof:'Each grade-g piece introduces g previously unoccupied internal path cells. The board has 91 cells; its occupied origin leaves at most 90 internal cells. Thus sum(grade*count) <= 90. Blade needs at least one internal cell; power/speed bounds reserve that cell. These are certified upper bounds, not asserted attainable maxima. Witnesses are native-trace-valid lower bounds.',bounds,witnesses},
  proposal,blockers:Object.entries(bounds).filter(([key,bound])=>M.initial()[key].at(-1)>=bound.upper).map(([key,bound])=>({axis:key,draftMaximum:M.initial()[key].at(-1),dnaCertifiedUpperBound:bound.upper})),draftBaseline:draft.map(({key,hp,power,speed,defense,regen,seconds})=>({key,hp,power,speed,defense,regen,seconds}))};
await writeFile(new URL('audit.json',import.meta.url),JSON.stringify(audit,null,2)+'\n');
await writeFile(new URL('proposal.json',import.meta.url),JSON.stringify({status:'review-proposal-not-applied',reference:realReference,
  profiles:Object.fromEntries(proposal.units.map(unit=>[unit.key,{tier:unit.tier,health:unit.hp,attackPower:unit.power,attackSpeed:unit.speed,defense:unit.defense,regenerationOutOfCombat:unit.regen,comparisonParty:unit.party}])),arena:proposal.arena,priorityDuels:proposal.priorityDuels},null,2)+'\n');
const report=`# 중립 19종 실제값과 실게임 규모 제안\n\n기존 게임값을 변경하지 않은 검토안이다. NeutralStats.html에서 “실게임 규모 제안 불러오기”를 누르면 실제 배치 기준과 전투 중 재생 0 계산으로 전환된다. 원래 HP1200 초안도 별도로 보존한다.\n\n- 설계표 34축의 원종·유니크 계보 510쌍은 역전 0이다. 실제 게임 5축의 종간 비교는 855쌍 중 ${runtimeRankMismatches.length}쌍이 동률이거나 설계 순서와 다르다. 실제 중립은 모두 HP100/기본 공속0.8/자기재생0이며 공격·방어는 전투력에서 나온다. 설계표를 실제 게임 수치가 이미 적용된 것으로 보아서는 안 된다.\n- 레벨4 보드 91칸에서 grade-g DNA는 g개의 새 내부칸을 필요로 하므로 grade 합은 90 이하다. 이 보수적 증명 상한은 HP910/방어90/재생8.8이다. 원래 초안의 4200/172/19는 이를 넘는다. HP1200 기준 유닛도 현 DNA로 생산할 수 없는 가상 기준이다.\n- 탐색으로 찾은 실제 유효 배치 하한은 HP600/공격54/공속2.9/방어45/재생4이다. 최적해라고 주장하지 않는다. 새 제안의 각 최고값 590/53/1.12/44/1.9는 각 검증 배치보다 엄격히 낮다.\n- 실제 엔진의 DNA 재생은 전투 종료 5초 뒤에만 작동한다. 새 제안은 전투 중 재생0, 재생 곡선은 전투 후 회복값이다. 정수 재생으로 19개 순위를 만들면 최소0~18이어서 현 단위의 DNA 상한8.8에 들어갈 수 없다. 검토기 재생 정밀도를 실제 DNA와 같은0.1HP/s로 확장했다. 다른4축 순위와 기존 초안 값은 보존했다.\n- 새 기준은 유효한 레벨4 DNA51조각(체력49/칼날1/공격강화1), 262P, HP500/공격6/공속0.5/방어0이다. 시작 유닛이나 초반 경제 기준을 뜻하지 않는다. 정확한 배치와 원본 해시는 audit.json에 있다.\n- 고정N으로 실제 server/combat.mjs를 사용한 19종 비교는 모두10.3~48.3초에 처치했다. 공속·타격 이산 시점과 전투 중 사망도 계산했다. 정적 시간 범위는10.2~47.2초다. 파생 DPS의 계보 서열 역전도0이다. 흰발>가시등우두머리, 걸어가는산>흰발은 별도1:1에서도 확인했다. 전체19종의 종합 전투력 서열이나 모든 실제 월드 전투를 검증한 것은 아니다.\n\n| 티어 | 종 | N | HP | 공격 | 공속 | 방어 | 전투후 재생 | 정적초 | 엔진초 | 생존N |\n|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${proposal.units.map(unit=>{const result=proposal.arena.find(r=>r.key===unit.key);return '| '+[unit.tier,unit.name,unit.party,unit.hp,unit.power,unit.speed,unit.defense,unit.regen,unit.seconds.toFixed(2),result.seconds.toFixed(2),result.survivors].join(' | ')+' |'}).join('\n')}\n\n엔진 실험은 같은 칸에서 모든 기준 유닛을 같은 편에 묶고, 확률0.5 고정·이탈 가능한 지형 없음·중립 선공 성향으로 실행했다. 기준 DNA에는 다른 전투 효과가 없고 중립도 제안5축만 바꿨다. 실제 월드의 도주·이동·증원·고유 행동·확률 분포 및 나머지29개 설계 축을 추가한 결과는 아니다. 살아 있는 인원이 줄면 실제 엔진에서 피해량도 함께 줄어든다.\n\n실제 반영 시에는 unitCombatStats의 종별 프로필뿐 아니라 migrateCombatStats의 고정HP100 처리, 저장 복원 시 체력 비율, combatStrength 기반 표시·의사결정, 중립 전투후 재생의 별도 구현까지 함께 검토해야 한다. 단순히 테이블만 바꾸면 복원 경로가 다시HP100으로 만들 수 있다. 이번 결과는 이 검토를 위한 정확한 profiles를 proposal.json에 제공하며 서버 수치를 덮어쓰지 않는다.\n\n재생성: node Research/Balance/2026-11-04/audit.mjs\n검증: node client/neutral-stat-model.test.mjs 및 node client/neutral-stat-balance.test.mjs\n`;
await writeFile(new URL('README.md',import.meta.url),report);
const browser={version:1,sources,runtime,design:{axes:statFields.length,lineageComparisons:statFields.length*15,lineageViolations,runtimeRankMismatches},dna:{level:4,cells:91,bounds,proof:audit.dna.proof},arena:audit.arena,proposal,blockers:audit.blockers};
await writeFile(new URL('client/neutral-stat-balance-data.js',root),'// Generated by Research/Balance/2026-11-04/audit.mjs from the named source hashes.\n'+'globalThis.SpawnerNeutralBalance = '+JSON.stringify(browser)+';\n');
console.log(JSON.stringify({runtime:runtime.length,designAxes:statFields.length,lineageComparisons:audit.design.lineageComparisons,lineageViolations:lineageViolations.length,dnaBounds:bounds,blockers:audit.blockers,arena:arenaResults,proposal:proposalResults},null,2));
