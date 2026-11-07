import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA as M } from "./dna.mjs";
import { validateDna, cloneDna } from "./dna-unit.mjs";
import { DNA_STARTER_DESIGNS } from "../client/dna-starter-designs.mjs";
import { startingWorkerDna } from "./tribe-start.mjs";
import { createGame } from "./game.mjs";

function piece(id){const gene=M.lookup.get(id);return {gene:id,grade:gene.grade,rotation:0,q:0,r:0};}
function arrangement(ids,level){return {version:4,pieces:M.pack(ids.map(piece),level),budget:1000,level};}
function signature(points){let variants=[];for(let turn=0;turn<6;turn++){const sorted=points.slice().sort((a,b)=>a.q-b.q||a.r-b.r),origin=sorted[0];variants.push(JSON.stringify(sorted.map(p=>[p.q-origin.q,p.r-origin.r])));points=points.map(p=>({q:-p.r,r:p.q+p.r}));}return variants.sort()[0];}

test("41개 조각은 연결된 칸 모양이며 1레벨 3칸과 고레벨의 다양한 모양을 유지한다",()=>{
  assert.equal(M.catalog.length,41);const shapes=new Set(),sizes=new Set();
  for(const gene of M.catalog){
    const cells=M.pieceCells(piece(gene.id)),remaining=new Set(cells.map(M.key)),queue=[cells[0]];remaining.delete(M.key(cells[0]));
    for(const point of queue)for(const [q,r] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]){const next={q:point.q+q,r:point.r+r};if(remaining.delete(M.key(next)))queue.push(next);}
    assert.equal(remaining.size,0,gene.id);assert.equal(new Set(cells.map(M.key)).size,cells.length);sizes.add(cells.length);
    const shape=signature(cells);if(gene.grade>1)assert.equal(shapes.has(shape),false,gene.id);shapes.add(shape);
    for(let rotation=0;rotation<6;rotation++){const d=arrangement([gene.id],gene.grade);assert.ok(d.pieces,gene.id);const rotated={...piece(gene.id),rotation};assert.equal(M.pieceCells(rotated).length,cells.length);assert.ok(validateDna(d,gene.grade,1000));}
  }
  assert.deepEqual([...sizes].sort(),[3,4,5,6]);assert.equal(M.route,undefined);assert.equal(M.shape,undefined);
});

test("각 레벨은 독립 조각으로 채우고 겹침·범위·좌표·모양 위조를 거부한다",()=>{
  for(const [index,total] of [19,37,61,91].entries()){
    const level=index+1,pieces=M.pack(Array.from({length:2},()=>piece('capacity')),level),dna={version:4,pieces,level,budget:10000};
    assert.ok(pieces);assert.equal(M.trace([],level).filled,0);assert.equal(M.trace(pieces,level).total,total);assert.equal(M.trace(pieces,level).filled,6);assert.equal(M.trace(pieces,level).complete,false);assert.ok(validateDna(dna,level,10000));
    assert.equal(validateDna({...dna,pieces:pieces.concat(pieces[0])},level,10000),null);
    for(const mutation of [{q:100},{r:.5},{rotation:6},{grade:4},{cells:[[0,0]]},{shape:[0,1]}])assert.equal(validateDna({...dna,pieces:[{...pieces[0],...mutation}]},level,10000),null);
  }
});

test("기관은 종류별 하나이고 스탯·가격·낮은 레벨 제한은 유지한다",()=>{
  for(const id of ['gather','blade','secretion','antenna']){assert.equal(validateDna(arrangement([id,id],4),4,1000),null);assert.ok(validateDna(arrangement([id],4),4,1000));}
  assert.ok(validateDna(arrangement(['gather','blade','secretion','antenna'],4),4,1000));
  assert.equal(validateDna(arrangement(['blade'],2),1,1000),null);
  const stats=M.stats([piece('carapace'),piece('block')]);assert.equal(stats.armor,2);assert.equal(stats.block,15);assert.equal(M.price([piece('carapace')]),4);assert.equal(M.cost([]),3);
});

test("기본 설계와 네 부족 시작 유닛은 새 좌표로 생성되고 비용을 유지한다",()=>{
  for(const entry of DNA_STARTER_DESIGNS){assert.equal(entry.design.version,4);assert.ok(validateDna(entry.design,entry.design.level,1000),entry.id);}
  for(const tribe of ['bean','spore','pebble','spring']){const dna=startingWorkerDna(tribe);assert.equal(dna.version,4);assert.ok(validateDna(dna,1,30));assert.equal(M.cost(dna.pieces),17);assert.ok(dna.pieces.every(p=>p.shape===undefined&&Number.isInteger(p.q)&&Number.isInteger(p.r)));}
});

test("예전 저장은 조각·등급·스탯·지불 비용을 보존하며 좌표 형식으로 한 번 변환한다",()=>{
  const colony={id:1,ownerId:'legacy-board',x:40,y:40,tribe:'bean',occupiedCells:new Set(['1,0'])},env={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()},game=createGame(env,colony);env.games.set(colony.ownerId,game);
  for(const input of [{gene:'armor',grade:3,rotation:0,shape:[0,1,2,0]},{gene:'legs',grade:3,rotation:0,shape:[0,1,0,4]},{gene:'rangedPower',grade:3,rotation:0,shape:[0,5,4,4]},{gene:'critical',grade:4,rotation:0,shape:[0,2,1,0,2]}]){
    const dna={version:3,pieces:[input],level:4,budget:1000},converted=M.validate(dna);assert.equal(converted.version,4);assert.deepEqual(M.stats(converted.pieces),M.stats(dna.pieces));assert.deepEqual(cloneDna(dna),converted);assert.deepEqual(M.validate(converted),converted);
    const saved=JSON.parse(game.save());saved.state.nestLevel=4;saved.state.agents=[{...saved.state.agents[0],dna,cost:143}];game.restore(JSON.stringify(saved));assert.deepEqual(game.agents[0].dna,converted);assert.equal(game.agents[0].cost,143);assert.equal(validateDna(converted,4,1000),null);
  }
});

test("작은 판에 들어가지 않는 예전 설계도 조각과 능력치를 버리지 않는다",()=>{
  const old={version:3,pieces:Array.from({length:20},()=>({gene:'health',grade:1,rotation:0,shape:[0,4]})),level:1,budget:1000},migrated=M.validate(old);
  assert.equal(migrated.pieces.length,20);assert.deepEqual(M.stats(migrated.pieces),M.stats(old.pieces));assert.equal(M.trace(migrated.pieces,1).reason,'boundary');assert.equal(validateDna(migrated,1,1000),null);assert.deepEqual(cloneDna(migrated),migrated);
});
