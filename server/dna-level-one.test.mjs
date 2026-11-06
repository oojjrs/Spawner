import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA as M } from "./dna.mjs";
import { validateDna } from "./dna-unit.mjs";
import { birthCost } from "./attributes.mjs";

const piece=(gene,rotation)=>{const entry=M.lookup.get(gene);return {gene,rotation,grade:entry.grade,shape:[...entry.steps]};};
const fixtures=[
  [["harvestSpeed",0],["gather",3],["harvestSpeed",5],["capacity",5],["capacity",1],["capacity",2],["capacity",3],["capacity",4],["capacity",5],["capacity",0]],
  [["capacity",0],["gather",2],["harvestSpeed",1],["harvestSpeed",3],["harvestSpeed",3],["harvestSpeed",3],["harvestSpeed",5],["harvestSpeed",5],["harvestSpeed",5]],
  [["harvestSpeed",0],["harvestSpeed",3],["capacity",3],["capacity",1],["capacity",0],["capacity",5],["capacity",4],["gather",2],["harvestSpeed",3],["harvestSpeed",0]]
];

test("level one has the approved five shapes and unchanged per-grade stat formulas",()=>{
  assert.deepEqual(M.catalog.filter(g=>g.grade===1).map(g=>[g.id,g.steps]),[["capacity",[0,0]],["gather",[0,1]],["harvestSpeed",[0,2]],["health",[0,4]],["movement",[0,5]]]);
  assert.deepEqual(["blade","secretion"].map(id=>{const g=M.lookup.get(id);return [g.grade,g.steps];}),[[2,[0,1,5]],[2,[0,0,2]]]);
  const pieces=[piece("gather",0),piece("capacity",0),piece("harvestSpeed",0),piece("health",0),piece("movement",0)],stats=M.stats(pieces);
  assert.equal(stats.capacity,2);assert.equal(stats.harvestTime,4/1.1);assert.equal(stats.health,20);assert.equal(stats.movement,.29);
  assert.equal(M.price(pieces),17);assert.equal(birthCost({dna:{pieces}},"bean"),20);
  for(const id of ["blade","secretion"]){assert.equal(M.price([piece(id,0)]),7);assert.equal(validateDna({version:3,pieces:[piece(id,0)],budget:100,level:1},1,100),null);}
});

test("new designs reject a second gathering organ without restricting other organ copies",()=>{
  const pieces=[piece("gather",0),piece("gather",3)],dna={version:3,pieces,budget:100,level:1};
  assert.equal(M.trace(pieces,1).valid,true);assert.ok(M.validate(dna));assert.equal(validateDna(dna,1,100),null);
  const blades={version:3,pieces:[piece("blade",0),piece("blade",1)],budget:100,level:4};
  assert.equal(M.trace(blades.pieces,4).valid,true);assert.ok(validateDna(blades,4,100));
});

test("three approved worker arrangements retain all nineteen board points under the strict catalog",()=>{
  for(const [index,entries] of fixtures.entries()){
    const pieces=entries.map(([gene,rotation])=>piece(gene,rotation)),dna={version:3,pieces,budget:100,level:1},trace=M.trace(pieces,1);
    assert.equal(trace.valid,true);assert.equal(trace.occupied.size,19);assert.equal(M.counts(pieces).gather,1);
    assert.ok(validateDna(dna,1,100));assert.equal(M.price(pieces),[32,29,32][index]);
  }
});
