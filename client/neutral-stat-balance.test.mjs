import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ATTRIBUTE_DNA as D} from '../server/dna.mjs';
import {validateDna} from '../server/dna-unit.mjs';
import {combatProfile,unitCombatStats} from '../server/combat-stats.mjs';
const audit=JSON.parse(readFileSync(new URL('../Research/Balance/2026-11-04/audit.json',import.meta.url)));
test('all 34 design stat axes preserve the 510 original/unique comparisons',()=>{
  assert.equal(audit.design.axes,34);assert.equal(audit.design.lineageComparisons,510);assert.deepEqual(audit.design.lineageViolations,[]);
  assert.equal(audit.design.tiers.length,19);assert.equal(audit.design.runtimeRankMismatches.length,588);
});
test('actual snapshot matches runtime profiles, with source hash freshness',()=>{
  for(const [path,expected]of Object.entries(audit.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex'),expected,path);
  for(const row of audit.runtime){const base=unitCombatStats(row.key),p=combatProfile({species:row.key,stats:base,attributes:{}});assert.equal(row.hp,base.health);assert.equal(row.power,p.attackPower);assert.equal(row.defense,p.defense);assert.equal(row.speed,p.attackSpeed)}
});
test('every DNA lower-bound witness is a native valid level4 source-shape layout',()=>{
  for(const witness of audit.dna.witnesses){assert.ok(D.trace(witness.pieces,4).valid,witness.gene);for(const piece of witness.pieces){const gene=D.lookup.get(piece.gene);assert.equal(piece.grade,gene.grade);assert.deepEqual(piece.shape,D.shape(gene,gene.grade))}assert.ok(witness.achievedCount<=witness.countUpperBound);assert.equal(D.price(witness.pieces),witness.price);assert.deepEqual(D.stats(witness.pieces),witness.stats)}
});
test('actual engine results are finite, use fixed parties and separate initial draft results',()=>{
  assert.equal(audit.arena.results.length,19);
  for(const result of audit.arena.results){assert.equal(result.actual.result,'reference-win');assert.ok([.3,1.3].includes(result.actual.seconds));assert.ok(result.draft.seconds>result.actual.seconds);assert.ok(result.actual.survivors>0);assert.ok(Number.isFinite(result.draft.seconds))}
  assert.match(audit.arena.assumptions,/OUT OF COMBAT ONLY/);
});
test('concrete proposal has a real 500HP DNA baseline and 19 server-engine victories within 10–60s',()=>{
  const proposal=audit.proposal,reference=proposal.reference;
  assert.ok(validateDna({version:3,pieces:reference.pieces,level:4,budget:reference.price},4,reference.price));
  assert.ok(D.trace(reference.pieces,4).valid);assert.equal(D.stats(reference.pieces).health,500);assert.equal(D.stats(reference.pieces).power,6);assert.equal(D.stats(reference.pieces).speed,.5);assert.equal(D.price(reference.pieces),262);
  assert.equal(proposal.units.length,19);assert.equal(proposal.arena.length,19);assert.equal(proposal.actualArena.length,19);assert.deepEqual(proposal.derivedDpsInversions,[]);
  for(const row of proposal.arena){assert.equal(row.result,'reference-win');assert.ok(row.seconds>=10&&row.seconds<=60,row.key);assert.ok(row.survivors>0)}
  for(const [key,bound]of Object.entries(audit.dna.bounds))assert.ok(proposal.curves[key].at(-1)<bound.witness,key);
  for(const duel of proposal.priorityDuels)assert.equal(duel.result,'reference-win',duel.stronger+' > '+duel.weaker);
  assert.equal(proposal.appliedToGame,false);
});
