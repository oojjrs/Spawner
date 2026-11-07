import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA as M } from "./dna.mjs";
import { validateDna, cloneDna } from "./dna-unit.mjs";
import { dnaHealAllocations, DNA_ACTION_RULES } from "./dna-actions.mjs";
import { createGame } from "./game.mjs";

const approvedShapes={health:[0,4],harvestSpeed:[0,5],blade:[0,2,3],power:[0,0,1],speed:[0,2,0],secretion:[0,1,3],rangedPower:[0,0,2],rangedSpeed:[0,0,4],healer:[0,2,1],healPower:[0,4,4],antenna:[0,4,0],carapace:[0,5,1]};
const fixtures=[
  [["power",0],["harvestSpeed",5],["speed",3],["health",5],["carapace",3],["carapace",2],["health",2],["antenna",2],["health",1],["health",1],["power",4],["blade",5],["carapace",1],["health",2],["health",5]],
  [["power",0],["harvestSpeed",5],["health",4],["harvestSpeed",3],["blade",1],["power",5],["health",5],["carapace",3],["carapace",2],["health",2],["speed",1],["health",1],["antenna",1],["power",5],["power",2]],
  [["secretion",0],["carapace",1],["rangedPower",3],["harvestSpeed",3],["rangedPower",4],["health",0],["rangedPower",3],["carapace",0],["antenna",0],["harvestSpeed",1],["harvestSpeed",2],["harvestSpeed",5],["rangedSpeed",4],["harvestSpeed",4],["harvestSpeed",3]],
  [["secretion",0],["rangedSpeed",1],["carapace",5],["carapace",4],["health",4],["harvestSpeed",4],["harvestSpeed",3],["harvestSpeed",0],["rangedPower",1],["carapace",3],["harvestSpeed",2],["carapace",0],["rangedPower",1],["antenna",4]],
  [["health",0],["antenna",0],["harvestSpeed",4],["harvestSpeed",3],["healPower",2],["harvestSpeed",4],["healPower",4],["health",2],["health",2],["harvestSpeed",2],["healPower",0],["healer",5],["harvestSpeed",2],["health",0],["health",0],["harvestSpeed",0],["health",4]],
  [["antenna",0],["healPower",0],["healPower",3],["carapace",1],["harvestSpeed",3],["health",2],["health",5],["healPower",4],["healer",3],["healPower",0],["harvestSpeed",0],["health",4],["health",4],["harvestSpeed",2],["healPower",3]]
];
const piece=id=>{const gene=M.lookup.get(id);return {gene:id,grade:gene.grade,rotation:0,shape:[...gene.steps]};};
function arrangement(ids,level) {
  function place(pieces,index) {
    if(index===ids.length)return pieces;
    for(let rotation=0;rotation<6;rotation++) {
      const next=pieces.concat({...piece(ids[index]),rotation});
      if(!M.trace(next,level).valid)continue;
      const result=place(next,index+1);
      if(result)return result;
    }
    return null;
  }
  const pieces=place([],0);assert.ok(pieces);
  return {version:3,pieces,budget:1000,level};
}

test("C5 geometries keep their paths while retired support builds cannot be produced",()=>{
  for(const [index,entries] of fixtures.entries()) {
    const pieces=entries.map(([gene,rotation])=>({gene,rotation,grade:approvedShapes[gene].length-1,shape:[...approvedShapes[gene]]}));
    const dna={version:3,pieces,level:2,budget:1000},trace=M.trace(pieces,2);
    assert.equal(trace.valid,true,String(index));assert.equal(trace.occupied.size,37,String(index));
    if(index<4)assert.ok(validateDna(dna,2,1000),String(index));else{assert.deepEqual(M.validate(dna),dna);assert.equal(validateDna(dna,2,1000),null,String(index));}
    assert.equal(M.stats(pieces).healPower,0);
  }
});

test("strict designs reject each duplicated organ but permit different organ roles without mandatory support stats",()=>{
  for(const id of ["gather","blade","secretion","antenna"]) {
    const dna=arrangement([id,id],4);assert.ok(M.validate(dna));assert.equal(validateDna(dna,4,1000),null,id);
    assert.ok(validateDna(arrangement([id],4),4,1000),id);
  }
  assert.ok(validateDna(arrangement(["gather","blade","secretion","antenna"],4),4,1000));
  for(const id of ["healer","healPower"]){assert.equal(M.lookup.get(id).retired,true);assert.equal(M.catalog.some(gene=>gene.id===id),false);assert.equal(validateDna(arrangement([id],4),4,1000),null,id);}
  assert.ok(validateDna(arrangement(["power"],2),2,1000));
});

test("active shapes have the expected point count without equal same-grade paths",()=>{
  const signatures=new Set();
  for(const gene of M.catalog) {
    const points=M.route({q:0,r:0},gene,gene.grade,0,gene.steps),signature=gene.grade+":"+JSON.stringify(gene.steps);
    assert.equal(points.length,gene.grade+2,gene.id);assert.equal(new Set(points.map(M.key)).size,points.length,gene.id);
    assert.equal(signatures.has(signature),false,gene.id);signatures.add(signature);
  }
});

test("retired donor genes stay inactive while legacy support budgets preserve receiving multipliers",()=>{
  const stats=ids=>M.stats(ids.map(piece));
  assert.equal(stats(["healPower"]).healPower,0);
  assert.equal(stats(["healer"]).healPower,0);
  assert.equal(stats(["healer","healPower","healPower"]).healPower,0);
  assert.equal(stats(["healer","healing"]).healPower,0);
  assert.equal(stats(["healer","healer","healer"]).healPower,0);
  assert.equal(stats(["healing"]).healing,30);
  assert.equal(DNA_ACTION_RULES.healInterval,2);
  const source={id:"source",team:"a",health:1,stats:{health:20,dna:stats(["healer","healPower","healPower"])}};
  const first={id:"first",team:"a",health:2,stats:{health:20,dna:{healing:100}}};
  const second={id:"second",team:"a",health:9,stats:{health:10}};
  const excluded=[{...first,id:"enemy",team:"b"},{...first,id:"hidden",hidden:true},{...first,id:"retreat",retreat:true},{...first,id:"dead",health:0},{...first,id:"far"}];
  const allocate=()=>dnaHealAllocations(source,[source,second,first,...excluded],agent=>agent.team,(a,b)=>b.id==="far"?3:1);
  assert.deepEqual(allocate(),[]);
  source.stats.dna={healerCount:5};
  assert.deepEqual(allocate().map(a=>[a.target.id,a.amount]),[["first",10]]);
  first.health=18;second.health=8;
  assert.deepEqual(allocate().map(a=>[a.target.id,a.amount]),[["second",2],["first",2]]);
  source.stats.dna={healerCount:2};first.health=10;second.health=10;
  assert.deepEqual(allocate().map(a=>[a.target.id,a.amount]),[["first",4]]);
  source.stats.dna={healerCount:2,healPower:0};assert.deepEqual(allocate(),[]);
});

test("carapace adds pure armor at the ordinary stat price and worker boosts keep their grade weights",()=>{
  const stats=M.stats([piece("carapace"),piece("block")]);
  assert.equal(stats.armor,2);assert.equal(stats.block,15);
  assert.equal(M.stats([piece("carapace")]).block,0);assert.equal(M.price([piece("carapace")]),4);
  assert.equal(M.cost([]),3);assert.equal(M.lookup.get("healPower").code,"GCT");assert.equal(M.lookup.get("rangedSpeed").code,"GCA");
  const worker=M.stats([piece("gather"),...Array.from({length:4},()=>piece("capacity")),piece("harvest"),piece("loadSpeed")]);
  assert.equal(worker.harvest,4);assert.equal(worker.loadSpeed,85);
});

test("retired and moved legacy pieces preserve explicit shape grade and paid cost on game restore",()=>{
  const colony={id:1,ownerId:"legacy-c5",x:40,y:40,tribe:"bean",occupiedCells:new Set(["1,0"])};
  const env={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(env,colony);env.games.set(colony.ownerId,game);
  for(const entry of [{gene:"armor",grade:3,rotation:0,shape:[0,1,2,0]},{gene:"legs",grade:3,rotation:0,shape:[0,1,0,4]},{gene:"rangedPower",grade:3,rotation:0,shape:[0,5,4,4]},{gene:"critical",grade:4,rotation:0,shape:[0,2,1,0,2]}]) {
    const dna={version:3,pieces:[entry],budget:1000,level:4};
    assert.deepEqual(M.validate(dna),dna);assert.deepEqual(cloneDna(dna),dna);assert.equal(validateDna(dna,4,1000),null);
    const saved=JSON.parse(game.save());saved.state.nestLevel=4;saved.state.evolutionPoints=1000;
    saved.state.agents=[{...saved.state.agents[0],dna,cost:143}];game.restore(JSON.stringify(saved));
    const agent=game.agents[0];assert.deepEqual(agent.dna,dna);assert.equal(agent.cost,143);
    assert.throws(()=>game.command({type:"birth",agentId:agent.id}),/설계를 수정/);assert.equal(agent.cost,143);
  }
  assert.equal(M.stats([{gene:"armor",grade:3},{gene:"legs",grade:3}]).armor,3);
  assert.equal(M.stats([{gene:"armor",grade:3},{gene:"legs",grade:3}]).evasion,9);
});
