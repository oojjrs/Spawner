import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA as M } from "./dna.mjs";
import { birthCost, unitTravelSpeed } from "./attributes.mjs";
import { dnaUnitStats, validateDna } from "./dna-unit.mjs";
import { createGame } from "./game.mjs";

function worker(capacity) {
  const pieces=M.pack(['gather',...Array(7).fill('capacity'),'movement'].map(gene=>({gene,grade:1,rotation:0})),1).slice(0,capacity+1);
  assert.ok(pieces);
  const dna={version:6,level:1,budget:0,pieces};
  assert.ok(validateDna(dna,1,100));
  return dna;
}

function income(dna,distance) {
  const stats=dnaUnitStats(dna),agent={dna,stats,carrying:0,attributes:{}};
  const seconds=distance/unitTravelSpeed(agent,0,'clay')+1+stats.capacity*stats.dna.harvestTime+distance/unitTravelSpeed(agent,stats.capacity,'clay')+1;
  return 60*stats.capacity/seconds;
}

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

test("실제 배치한 운반3과 운반7은 새 단가로 생산비를 계산하고 채집량을 유지한다",()=>{
  const small=worker(3),large=worker(7),smallCost=birthCost({dna:small},'bean'),largeCost=birthCost({dna:large},'bean');
  assert.equal(smallCost,26);assert.equal(largeCost,46);
  assert.equal(M.stats(small.pieces).harvest,1);assert.equal(M.stats(large.pieces).harvest,1);
  for(const distance of [1,2,3]){
    assert.ok(income(large,distance)>income(small,distance),'distance '+distance);
  }
  assert.ok(Math.abs(income(large,3)-480/54)<1e-9);
});

test("운반7의 새 생산비46를 실제 차감하고 과거 지불액은 복원과 복제에서 보존한다",()=>{
  const colony={id:1,ownerId:'pricing',x:40,y:40,tribe:'bean',occupiedCells:new Set(['0,0','1,0','2,0','0,1','1,1','2,1','0,2','1,2','2,2'])};
  const environment={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,colony);environment.games.set(colony.ownerId,game);
  const saved=JSON.parse(game.save());saved.state.evolutionPoints=45;saved.state.agents=[];game.restore(JSON.stringify(saved));
  const dna=worker(7),{templateId}=game.command({type:'design',templateId:null,name:'채집',dna,birth:false});
  assert.throws(()=>game.command({type:'birth',templateId}),/진화 포인트/);
  assert.equal(game.snapshot().evolutionPoints,45);assert.equal(game.agents.length,0);
  const funded=JSON.parse(game.save());funded.state.evolutionPoints=46;game.restore(JSON.stringify(funded));
  const {agentId}=game.command({type:'birth',templateId});
  assert.equal(game.snapshot().evolutionPoints,0);assert.equal(game.agents.find(a=>a.id===agentId).cost,46);
  const historical=JSON.parse(game.save());historical.state.agents.find(a=>a.id===agentId).cost=29;historical.state.evolutionPoints=46;game.restore(JSON.stringify(historical));
  assert.equal(game.agents.find(a=>a.id===agentId).cost,29);
  const copy=game.command({type:'birth',agentId});assert.equal(game.agents.find(a=>a.id===copy.agentId).cost,46);
  assert.equal(game.agents.find(a=>a.id===agentId).cost,29);assert.equal(game.snapshot().evolutionPoints,0);
});

test("기관1개와 운반8개는51P이며 기본3초 채집 주기를 적용한다",()=>{
  const pieces=M.pack(['gather',...Array(8).fill('capacity')].map(gene=>({gene,grade:1,rotation:0})),2);
  assert.ok(pieces);const dna={version:6,level:2,budget:0,pieces};assert.ok(validateDna(dna,2,100));
  const cost=birthCost({dna},'bean'),rate=income(dna,3);
  assert.equal(cost,51);
  assert.ok(Math.abs(rate-540/57)<1e-9);
  assert.equal(Math.ceil(cost/9)*57,342);
});
