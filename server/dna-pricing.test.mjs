import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA as M } from "./dna.mjs";

test("모든 레벨의 기관·중첩 가격과 합산 순서가 고정 가격표를 따른다",()=>{
  for(const [grade,organ,stack] of [[1,8,5],[2,12,7],[3,11,11],[4,15,15]])for(const gene of M.catalog.filter(gene=>gene.grade===grade)){assert.equal(M.piecePrice({gene:gene.id,grade}),gene.category==='organ'?organ:stack,gene.id);assert.equal(gene.price,gene.category==='organ'?organ:stack,gene.id);}
  const reinforcement=['capacity','harvestSpeed','health','movement'].map(gene=>({gene,grade:1}));
  for(const piece of reinforcement)assert.equal(M.piecePrice(piece),5);
  assert.equal(M.price(reinforcement),20);
  assert.equal(M.price(reinforcement.slice(0,3)),15);
  assert.equal(M.price(reinforcement.slice(0,2)),10);
  assert.equal(M.cost([]),3);
  assert.equal(M.cost([{gene:'gather',grade:1}]),11);
  const upper=[{gene:'power',grade:2},{gene:'antenna',grade:2},{gene:'parry',grade:4}];
  assert.deepEqual(upper.map(M.piecePrice),[7,12,15]);
  const mixed=[...upper,...reinforcement];
  assert.equal(M.price(mixed),54);
  assert.equal(M.price(mixed.toReversed()),54);
  assert.ok(M.cost(mixed)<M.cost(upper)+M.cost(reinforcement));
});
