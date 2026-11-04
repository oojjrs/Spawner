import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ATTRIBUTE_DNA as M } from '../../../../server/dna.mjs';
import { validateDna } from '../../../../server/dna-unit.mjs';

const expectedFirst = { gather:[0,0], health:[0,1], blade:[0,2], movement:[0,5], secretion:[0,4] };
const first = M.catalog.filter(gene => gene.grade === 1);
if (first.length !== 5 || first.some(gene => JSON.stringify(gene.steps) !== JSON.stringify(expectedFirst[gene.id])))
  throw new Error('The user-fixed level-one catalog changed; reconcile it before continuing.');
const names = { power:'근접 공격력', speed:'근접 공속', capacity:'운반', antenna:'안테나', healer:'치유기관', carapace:'갑각',
  blade:'칼날', gather:'채집기관', movement:'이속', health:'체력' };
const genes = M.catalog.filter(gene => gene.grade === 2);
const current = Object.fromEntries(genes.map(gene => [gene.id, gene.steps]));
const plans = [
  { id:'current', title:'현행 배정 유지', shapes:current, gameCompatible:true },
  { id:'paired-capacity-l', title:'공격 쌍 맞물림 · 운반 L형', gameCompatible:false, shapes:{ ...current,
    power:[0,1,5], speed:[0,5,4], capacity:[0,0,1], antenna:[0,0,0] } },
  { id:'paired-antenna-l', title:'공격 쌍 맞물림 · 안테나 L형', gameCompatible:false, shapes:{ ...current,
    power:[0,1,5], speed:[0,5,4], capacity:[0,0,0], antenna:[0,0,1] } }
];
const cases = [
  { id:'one-attack-pair', title:'공격력1 + 공속1', counts:{ power:1, speed:1 } },
  { id:'two-attack-pairs', title:'공격력2 + 공속2', counts:{ power:2, speed:2 } },
  { id:'fighter', title:'칼날1 + 공격력2 + 공속2', counts:{ blade:1, power:2, speed:2 } },
  { id:'worker', title:'채집2 + 운반1 + 체력1 + 이속1', counts:{ gather:2, capacity:1, health:1, movement:1 } },
  { id:'scout', title:'안테나1 + 이속2 + 체력1', counts:{ antenna:1, movement:2, health:1 } },
  { id:'healer', title:'치유기관1 + 체력3', counts:{ healer:1, health:3 } },
  { id:'tank', title:'갑각2 + 체력3', counts:{ carapace:2, health:3 } }
];
const mod = value => (value % 6 + 6) % 6;
const normalize = path => path.map(value => mod(value - path[0]));
const reverse = path => normalize(path.toReversed().map(value => value + 3));
const reflect = path => path.map(value => mod(-value));
const outline = path => [path, reverse(path), reflect(path), reverse(reflect(path))].map(normalize)
  .map(path => path.join(',')).sort()[0];

function describe(trace, pieces) {
  const points = [...trace.occupied.keys()].map(key => { const [q,r] = key.split(',').map(Number); return {q,r}; });
  const qs = points.map(p => p.q), rs = points.map(p => p.r), zs = points.map(p => p.q + p.r);
  const q0=Math.min(...qs),q1=Math.max(...qs),r0=Math.min(...rs),r1=Math.max(...rs);
  const span=(q1-q0)+(r1-r0)+Math.max(...zs)-Math.min(...zs);
  const inverted = points.filter(p => trace.occupied.has((q0+q1-p.q)+','+(r0+r1-p.r))).length;
  const end = trace.nodes.at(-1), closedAtOrigin = end.q === 0 && end.r === 0;
  let extensions = 0;
  for (const gene of first) for (let rotation=0; rotation<6; rotation++)
    if (M.trace([...pieces,{ gene:gene.id, grade:1, rotation, shape:gene.steps }],2).valid) extensions++;
  return { occupied:points.length, closedAtOrigin, inversionMatched:inverted, inversionTotal:points.length,
    boundingSpan:span, extensions, score:(extensions ? 0 : 10000)+(closedAtOrigin ? 0 : 1000)+(1-inverted/points.length)*100+span };
}

function search(plan, specification) {
  const remaining = { ...specification.counts }, pieces=[];
  let completed=0, closedAtOrigin=0, extendable=0, best=null, bestClosed=null;
  function visit() {
    if (Object.values(remaining).every(value => value === 0)) {
      completed++;
      const trace=M.trace(pieces,2),description=describe(trace,pieces);
      if(description.closedAtOrigin)closedAtOrigin++;
      if(description.extensions)extendable++;
      const value={ pieces:pieces.map(piece=>({...piece,shape:[...piece.shape]})),
        paths:trace.paths.map(path=>({gene:path.gene,points:path.points})),...description };
      if(!best||value.score<best.score)best=value;
      if(description.closedAtOrigin&&(!bestClosed||value.score<bestClosed.score))bestClosed=value;
      return;
    }
    for(const id of Object.keys(remaining)) {
      if(!remaining[id])continue;
      const gene=M.lookup.get(id),shape=plan.shapes[id]||gene.steps;
      remaining[id]--;
      // All six global rotations are equivalent on a centered hexagonal board.
      for(let rotation=0;rotation<(pieces.length ? 6 : 1);rotation++) {
        pieces.push({gene:id,grade:gene.grade,rotation,shape});
        if(M.trace(pieces,2).valid)visit();
        pieces.pop();
      }
      remaining[id]++;
    }
  }
  visit();
  if(!best)throw new Error('No layout: '+plan.id+'/'+specification.id);
  const representative=bestClosed||best,stats=M.stats(representative.pieces),dnaCost=M.price(representative.pieces);
  const nativeChecks=Array.from({length:6},(_,rotation)=>{
    const pieces=representative.pieces.map(piece=>({...piece,rotation:(piece.rotation+rotation)%6}));
    const geometric=M.trace(pieces,2).valid,native=!!validateDna({version:3,pieces,level:2,budget:dnaCost},2,dnaCost);
    if(!geometric||plan.gameCompatible&&!native)throw new Error('Invalid claimed layout');
    return {rotation,geometric,native};
  });
  return { ...specification, layoutsModuloRotation:completed, closedAtOriginModuloRotation:closedAtOrigin,
    extendableModuloRotation:extendable, birthCost:3+dnaCost, stats, representative, nativeChecks,
    healerHpPerSecond:(specification.counts.healer||0)/2,
    note:specification.id.includes('attack-pair') ? '공격기관 없는 형상 비교입니다. 실제 근접 공격에는 칼날이 필요합니다.' : undefined };
}

const sourcePath=new URL('../../../../server/dna.mjs',import.meta.url);
const results=plans.map(plan=>({ ...plan, distinctUndirectedOutlines:new Set(Object.values(plan.shapes).map(outline)).size,
  changes:genes.filter(gene=>JSON.stringify(plan.shapes[gene.id])!==JSON.stringify(gene.steps)).map(gene=>({gene:gene.id,label:names[gene.id],from:gene.steps,to:plan.shapes[gene.id]})),
  cases:cases.map(specification=>search(plan,specification)) }));
const data={ version:1, applied:false, firstLevel:{ userFixed:true, shapes:expectedFirst },
  activeStage:2, laterStages:[3,4], board:{level:2,radius:3,nodes:37},
  sourceHash:createHash('sha256').update(readFileSync(sourcePath)).digest('hex'),
  currentGenes:genes.map(gene=>({gene:gene.id,label:names[gene.id],shape:gene.steps,grade:gene.grade,cost:M.price([{gene:gene.id,grade:gene.grade}])})),
  method:'Exact multiset order and legal rotation enumeration; first rotation normalized to zero; native boundary/collision/node-join rules; representative aesthetics are a heuristic, not user approval.',
  constraints:['Level-one mapping is fixed.','No changed stats, prices, genes, grades or set bonuses.',
    'Remapped shapes pass geometry only and require catalog/migration work before game use.','No level-three/four assignment is decided before level two.'],results };
writeFileSync(new URL('./comparison.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify(results.map(plan=>({id:plan.id,outlines:plan.distinctUndirectedOutlines,cases:plan.cases.map(c=>({id:c.id,valid:c.layoutsModuloRotation,closed:c.closedAtOriginModuloRotation,cost:c.birthCost,occupied:c.representative.occupied,native:c.nativeChecks.every(v=>v.native)}))})),null,2));
