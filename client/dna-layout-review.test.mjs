import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {ATTRIBUTE_DNA} from '../server/dna.mjs';
const scope={};
for(const file of ['dna-layout-data.js','dna-layout-review.js'])runInNewContext(readFileSync(new URL('./'+file,import.meta.url),'utf8'),scope);
const data=scope.SpawnerDnaLayoutData,model=scope.SpawnerDnaLayoutReview;
const clean=value=>JSON.parse(JSON.stringify(value));
test('seven anonymous candidates preserve archived geometry and cover all 19 level-one points',()=>{
  assert.equal(data.boardLevel,1);assert.equal(data.boardPoints.length,19);assert.equal(data.candidates.length,7);
  for(const candidate of data.candidates){
    assert.equal(createHash('sha256').update(readFileSync(new URL('../'+candidate.source,import.meta.url))).digest('hex'),candidate.sourceSha256);
    const traced=ATTRIBUTE_DNA.trace(clean(model.piecesForTrace(candidate.paths)),1);
    assert.ok(traced.valid,candidate.id);assert.equal(traced.occupied.size,19,candidate.id);
    assert.deepEqual(clean(traced.paths.map(p=>p.points)),clean(candidate.paths.map(p=>p.points)),candidate.id);
    assert.deepEqual(clean(candidate.counts),Object.fromEntries(['A','B','C'].map(type=>[type,candidate.paths.filter(p=>p.type===type).length])));
  }
});
test('rotations and reflections retain native trace validity, source scale and point coverage',()=>{
  for(const candidate of data.candidates)for(let rotation=0;rotation<6;rotation++)for(const mirror of [false,true]){
    const paths=model.transformed(candidate,rotation,mirror),trace=ATTRIBUTE_DNA.trace(clean(model.piecesForTrace(paths)),1);
    assert.ok(trace.valid,`${candidate.id}/${rotation}/${mirror}`);assert.equal(trace.occupied.size,19);
    assert.deepEqual(clean(trace.paths.map(p=>p.points)),clean(paths.map(p=>p.points)));
  }
});
test('dense 12-strand candidate is all-B and nine-strand comparison remains available',()=>{
  const dense=data.candidates.find(c=>c.id==='dense-12'),minimal=data.candidates.find(c=>c.id==='minimal-9');
  assert.equal(dense.paths.length,12);assert.deepEqual(clean(dense.counts),{A:0,B:12,C:0});assert.equal(minimal.paths.length,9);
});
test('export is an unassigned geometry record, never an applied game blueprint',()=>{
  const record=clean(model.exportSelection(data.candidates[0],7,true));
  assert.equal(record.boardLevel,1);assert.equal(record.boardPoints,19);assert.equal(record.rotation,1);assert.equal(record.attributesAssigned,false);assert.equal(record.gameBlueprint,false);
  assert.ok(record.paths.every(p=>!Object.hasOwn(p,'gene')&&!Object.hasOwn(p,'attribute')));assert.ok(record.source.sha256.length===64);
});
