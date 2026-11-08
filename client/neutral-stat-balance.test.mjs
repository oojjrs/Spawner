import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const audit=JSON.parse(readFileSync(new URL('../Research/Balance/2026-11-04/audit.json',import.meta.url)));
test('all 34 design stat axes preserve the 510 original/unique comparisons',()=>{
  assert.equal(audit.design.axes,34);assert.equal(audit.design.lineageComparisons,510);assert.deepEqual(audit.design.lineageViolations,[]);
  assert.equal(audit.design.tiers.length,19);assert.equal(audit.design.runtimeRankMismatches.length,588);
});
test('actual engine results are finite, use fixed parties and separate initial draft results',()=>{
  assert.equal(audit.arena.results.length,19);
  for(const result of audit.arena.results){assert.equal(result.actual.result,'reference-win');assert.ok([.3,1.3].includes(result.actual.seconds));assert.ok(result.draft.seconds>result.actual.seconds);assert.ok(result.actual.survivors>0);assert.ok(Number.isFinite(result.draft.seconds))}
  assert.match(audit.arena.assumptions,/OUT OF COMBAT ONLY/);
});
test('historical proposal preserves its recorded parties and 19 engine victories within 10–60s',()=>{
  const proposal=audit.proposal;
  assert.equal(proposal.units.length,19);assert.equal(proposal.arena.length,19);assert.equal(proposal.actualArena.length,19);assert.deepEqual(proposal.derivedDpsInversions,[]);
  for(const row of proposal.arena){assert.equal(row.result,'reference-win');assert.ok(row.seconds>=10&&row.seconds<=60,row.key);assert.ok(row.survivors>0)}
  for(const [key,bound]of Object.entries(audit.dna.bounds))assert.ok(proposal.curves[key].at(-1)<bound.witness,key);
  for(const duel of proposal.priorityDuels)assert.equal(duel.result,'reference-win',duel.stronger+' > '+duel.weaker);
  assert.equal(proposal.appliedToGame,false);
});
