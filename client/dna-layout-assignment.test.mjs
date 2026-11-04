import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { ATTRIBUTE_DNA } from '../server/dna.mjs';
import { validateDna } from '../server/dna-unit.mjs';
import { birthCost } from '../server/attributes.mjs';

const scope = {}, clean = value => JSON.parse(JSON.stringify(value));
for(const file of ['dna-layout-data.js','dna-layout-assignment-data.js','dna-layout-review.js'])
  runInNewContext(readFileSync(new URL('./'+file,import.meta.url),'utf8'),scope);
const layouts=scope.SpawnerDnaLayoutData, model=scope.SpawnerDnaLayoutReview, data=scope.SpawnerDnaLayoutAssignmentData;

test('current assignments bind to the actual DNA definitions, validation and production price',()=>{
  assert.equal(data.assignments.length,14);
  assert.equal(data.applied,false);
  for(const [path,hash] of Object.entries(data.sourceHashes))
    assert.equal(createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex'),hash,path);
  assert.deepEqual(clean(data.currentGenes.map(g=>g.id)).sort(),ATTRIBUTE_DNA.catalog.filter(g=>g.grade===1).map(g=>g.id).sort());
});

test('all seven actual assignments remain valid across six rotations and both reflections without changing any gene shape',()=>{
  for(const candidate of layouts.candidates)for(const mirror of [false,true])for(let rotation=0;rotation<6;rotation++){
    const assignment=clean(model.assignmentFor(candidate,rotation,mirror));
    const dna={version:3,level:1,budget:assignment.dnaCost,pieces:assignment.pieces};
    assert.ok(validateDna(dna,1,assignment.dnaCost),`${candidate.id}/${rotation}/${mirror}`);
    const trace=ATTRIBUTE_DNA.trace(dna.pieces,1);
    assert.equal(trace.occupied.size,19);
    assert.deepEqual(trace.paths.map(path=>path.points),clean(model.transformed(candidate,rotation,mirror).map(path=>path.points)));
    assert.equal(birthCost({dna},'bean'),assignment.birthCost);
    assert.deepEqual(ATTRIBUTE_DNA.stats(dna.pieces),assignment.stats);
    assert.deepEqual(ATTRIBUTE_DNA.counts(dna.pieces),assignment.counts);
    for(const piece of dna.pieces){
      const gene=ATTRIBUTE_DNA.lookup.get(piece.gene);
      assert.equal(gene.grade,1);
      assert.deepEqual(piece.shape,ATTRIBUTE_DNA.shape(gene,gene.grade));
    }
  }
});

test('startup prefix never exceeds actual 30P and the next prefix is unaffordable',()=>{
  for(const assignment of data.assignments){
    const prefix=assignment.prefixAt30;
    assert.ok(prefix.birthCost<=30);
    assert.ok(assignment.steps[prefix.pieces].birthCost>30);
    assert.equal(prefix.hasGather,prefix.stats.gatherCount>0);
    assert.equal(assignment.openingPieces+assignment.reinforcementPieces,assignment.pieces.length);
    assert.equal(assignment.steps.filter(s=>s.kind==='unlock').length,assignment.openingPieces);
  }
});

test('same anonymous outline can change actual organs on reflection and all-B does not open an action',()=>{
  const symmetric=layouts.candidates.find(candidate=>candidate.id==='symmetric-4');
  const normal=clean(model.assignmentFor(symmetric)),mirror=clean(model.assignmentFor(symmetric,0,true));
  assert.equal(normal.birthCost,83);assert.equal(mirror.birthCost,83);
  assert.equal(normal.counts.secretion,2);assert.equal(normal.counts.blade,undefined);
  assert.equal(mirror.counts.blade,2);assert.equal(mirror.counts.secretion,undefined);
  const dense=clean(model.assignmentFor(layouts.candidates.find(c=>c.id==='dense-12')));
  assert.equal(dense.birthCost,63);assert.equal(dense.openingPieces,0);
  assert.equal(dense.stats.gatherCount,0);assert.equal(dense.stats.melee,false);assert.equal(dense.stats.ranged,false);
});

test('assignment export carries valid proposal DNA but explicitly remains unapplied and unapproved',()=>{
  const exported=clean(model.exportAssignment(layouts.candidates[0],13,true));
  assert.equal(exported.format,'spawner-dna-layout-assignment-proposal');
  assert.equal(exported.applied,false);assert.equal(exported.approved,false);assert.equal(exported.gameBlueprint,false);
  assert.equal(exported.rotation,1);
  assert.ok(validateDna(exported.proposalDna,1,exported.proposalDna.budget));
  assert.ok(exported.sourceHashes['server/dna.mjs']);
});
