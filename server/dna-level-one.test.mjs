import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA as M } from "./dna.mjs";
import { birthCost } from "./attributes.mjs";

test("1레벨은 일곱 종류의 네 칸 조각으로 빈칸을 채우고 스탯과 가격을 유지한다",()=>{
  const catalog=M.catalog.filter(g=>g.grade===1);
  assert.deepEqual(catalog.map(g=>[g.id,g.cells.length]),[['capacity',4],['gather',4],['harvestSpeed',4],['health',4],['movement',4],['regeneration',4],['vision',4]]);
  const pieces=M.pack(catalog.map(g=>({gene:g.id,grade:g.grade,rotation:0})),1),stats=M.stats(pieces);
  assert.equal(M.trace(pieces,1).valid,true);assert.equal(stats.capacity,2);assert.equal(stats.harvestTime,3/1.5);assert.equal(stats.health,30);assert.equal(stats.movement,.36);assert.equal(M.price(pieces),38);assert.equal(birthCost({dna:{pieces}},'bean'),41);
});
