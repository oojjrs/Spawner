import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { ATTRIBUTE_DNA as model } from '../../../../server/dna.mjs';
import { validateDna } from '../../../../server/dna-unit.mjs';
import { birthCost } from '../../../../server/attributes.mjs';

const root = new URL('../../../../', import.meta.url), scope = {};
for (const name of ['dna-layout-data.js', 'dna-layout-review.js'])
  runInNewContext(readFileSync(new URL('client/' + name, root), 'utf8'), scope);
const layouts = scope.SpawnerDnaLayoutData, geometry = scope.SpawnerDnaLayoutReview;
const clean = value => JSON.parse(JSON.stringify(value));
const firstLevel = model.catalog.filter(gene => gene.grade === 1);
const labels = { gather:'채집기관', health:'체력', movement:'이동', blade:'잎날', secretion:'분비기관' };

function assign(candidate, mirror) {
  const paths = clean(geometry.transformed(candidate, 0, mirror));
  const pieces = clean(geometry.piecesForTrace(paths)).map(piece => {
    const gene = firstLevel.find(gene => JSON.stringify(model.shape(gene, 1)) === JSON.stringify(piece.shape));
    if (!gene) throw new Error('NO CURRENT LEVEL-ONE GENE: ' + candidate.id);
    return { gene:gene.id, grade:gene.grade, rotation:piece.rotation, shape:model.shape(gene, 1).slice() };
  });
  const trace = model.trace(pieces, 1), dna = { version:3, pieces, budget:999999999, level:1 };
  if (!trace.valid || trace.occupied.size !== 19 || !validateDna(dna, 1, 999999999)) throw new Error('INVALID ACTUAL BLUEPRINT');
  for (let rotation=0;rotation<6;rotation++) {
    const rotated=pieces.map(piece=>({...piece,rotation:(piece.rotation+rotation)%6}));
    const checked=model.trace(rotated,1);
    if (!checked.valid || checked.occupied.size!==19 || !validateDna({...dna,pieces:rotated},1,999999999)) throw new Error('INVALID ROTATION');
  }
  const counts = model.counts(pieces), stats = model.stats(pieces), cost = birthCost({ dna }, 'bean');
  const unlocked = ['gather', 'blade', 'secretion'].filter(gene => counts[gene]);
  const steps = pieces.map((piece, index) => {
    const prefix = pieces.slice(0, index + 1), previous = pieces.slice(0, index);
    return { number:index + 1, gene:piece.gene, label:labels[piece.gene],
      kind:['gather', 'blade', 'secretion'].includes(piece.gene) && !previous.some(p => p.gene === piece.gene) ? 'unlock' : 'reinforce',
      dnaCost:model.price(prefix), birthCost:3 + model.price(prefix), stats:model.stats(prefix),
      occupied:model.trace(prefix, 1).occupied.size };
  });
  const affordable = steps.filter(step => step.birthCost <= 30).at(-1);
  return { candidateId:candidate.id, mirror, pieces, counts, dnaCost:model.price(pieces), birthCost:cost, stats,
    unlocked, openingPieces:unlocked.length, reinforcementPieces:pieces.length-unlocked.length,
    prefixAt30:affordable ? { pieces:affordable.number, birthCost:affordable.birthCost, occupied:affordable.occupied,
      stats:affordable.stats, hasGather:affordable.stats.gatherCount > 0 } : { pieces:0, birthCost:3, occupied:1, stats:model.stats([]), hasGather:false },
    steps:steps.map(({stats,...step})=>step), validatedRotations:6, nativeValid:true };
}
const assignments = layouts.candidates.flatMap(candidate => [false, true].map(mirror => assign(candidate, mirror)));
const sourceHashes = Object.fromEntries(['server/dna.mjs','server/dna-unit.mjs','server/attributes.mjs','client/dna-layout-data.js','client/dna-layout-review.js','Research/Dna/2026-11-04/followup/calculate.mjs'].map(path =>
  [path, createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex')]));
const result = { version:1, applied:false, boardLevel:1, baseBirthCost:3, startupPoints:30, currentGenes:firstLevel.map(gene =>
  ({ id:gene.id, label:labels[gene.id], grade:gene.grade, shape:gene.steps, price:gene.price })), sourceHashes, assignments };
writeFileSync(new URL('client/dna-layout-assignment-data.js', root), 'globalThis.SpawnerDnaLayoutAssignmentData = Object.freeze(' + JSON.stringify(result) + ');\n');
writeFileSync(new URL('./current-assignments.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(assignments.filter(a => !a.mirror).map(a => ({ id:a.candidateId, cost:a.birthCost, counts:a.counts,
  health:a.stats.health, movement:a.stats.movement, capacity:a.stats.capacity, harvest:a.stats.harvest, openings:a.openingPieces,
  prefix30:a.prefixAt30.pieces, prefixGather:a.prefixAt30.hasGather })), null, 2));
