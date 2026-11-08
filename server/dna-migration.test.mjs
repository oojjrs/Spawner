import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA as M } from "./dna.mjs";
import { cloneDna, validateDna } from "./dna-unit.mjs";
import { createGame } from "./game.mjs";

function previousDesign() {
  return {version:5,level:1,budget:30,pieces:[
    {gene:'gather',grade:1,rotation:0,q:0,r:0},
    {gene:'capacity',grade:1,rotation:0,q:0,r:-1},
    {gene:'harvestSpeed',grade:1,rotation:1,q:-1,r:0}
  ]};
}

test('v1~v5 저장 설계는 조각 수를 보존하며 v6으로 한 번 재배치한다',()=>{
  for(const version of [1,2,3,4,5]) {
    const previous={...previousDesign(),version},before=structuredClone(previous),migrated=M.validate(previous);
    assert.equal(migrated.version,6);
    assert.deepEqual(M.counts(migrated.pieces),M.counts(previous.pieces));
    assert.ok(validateDna(migrated,1,30));
    assert.equal(M.trace(migrated.pieces,1).filled,12);
    assert.deepEqual(M.validate(migrated),migrated);
    assert.deepEqual(cloneDna(previous),migrated);
    assert.deepEqual(cloneDna(migrated),migrated);
    assert.deepEqual(previous,before);
  }
});

test('v5 이관은 하중적응만 제거하고 시야·재생을 1등급으로 낮춘다',()=>{
  const genes=[['loadSpeed',2],['vision',3],['regeneration',4],['vision',3],['legs',3],['armor',3],['harvest',2]],
    previous={version:5,level:4,budget:887,pieces:genes.map(([gene,grade],index)=>({gene,grade,rotation:index%6,q:index,r:0}))},
    migrated=M.validate(previous);
  assert.equal(migrated.version,6);
  assert.equal(migrated.budget,887);
  assert.deepEqual(migrated.pieces.map(piece=>[piece.gene,piece.grade]),[['vision',1],['regeneration',1],['vision',1],['legs',3],['armor',3],['harvest',2]]);
  assert.deepEqual(M.validate(migrated),migrated);
});

test('v6 좌표는 다시 포장하지 않고 겹치는 새 설계를 거부한다',()=>{
  const pieces=M.pack(['gather','health'].map(gene=>({gene,grade:1,rotation:0})),1),
    current={version:6,level:4,budget:100,pieces:pieces.map(piece=>({...piece,q:piece.q+1,r:piece.r+1}))};
  assert.deepEqual(M.validate(current),current);
  assert.deepEqual(cloneDna(current),current);
  assert.equal(M.validate({...current,pieces:[current.pieces[0],current.pieces[0]]}),null);
});

test('v5 과밀 설계는 판 밖 보존으로 이관하고 재저장해도 조각을 버리지 않는다',()=>{
  const previous={version:5,level:1,budget:1000,pieces:Array.from({length:20},(_,index)=>({gene:'health',grade:1,rotation:0,q:index*5,r:0}))},
    migrated=M.validate(previous);
  assert.equal(migrated.version,6);
  assert.equal(migrated.pieces.length,20);
  assert.equal(M.trace(migrated.pieces,1).reason,'boundary');
  assert.equal(validateDna(migrated,1,1000),null);
  assert.deepEqual(M.validate(migrated),migrated);
  assert.deepEqual(cloneDna(migrated),migrated);
});

test('게임 복원은 v5 템플릿과 생존 유닛을 이관하며 지불 비용을 유지한다',()=>{
  const colony={id:1,ownerId:'v6-migration',x:40,y:40,tribe:'bean',occupiedCells:new Set(['1,0'])},
    environment={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()},
    game=createGame(environment,colony);
  environment.games.set(colony.ownerId,game);
  game.command({type:'design',templateId:null,name:'복원 대상',dna:M.validate(previousDesign()),birth:false});
  const saved=JSON.parse(game.save()),dna=previousDesign();
  saved.state.agents=[{...saved.state.agents[0],dna,cost:143}];
  saved.state.templates[0].dna=dna;
  game.restore(JSON.stringify(saved));
  assert.equal(game.agents[0].cost,143);
  assert.deepEqual(game.agents[0].dna,M.validate(dna));
  assert.deepEqual(game.snapshot().templates[0].dna,M.validate(dna));
  const once=cloneDna(game.agents[0].dna);
  game.restore(game.save());
  assert.equal(game.agents[0].cost,143);
  assert.deepEqual(game.agents[0].dna,once);
});
