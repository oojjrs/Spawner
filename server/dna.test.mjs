import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { validateDna, cloneDna, dnaUnitStats, dnaCanMove } from "./dna-unit.mjs";
import { createGame } from "./game.mjs";
import { birthCost } from "./attributes.mjs";
import { applyAgentGrowth } from "./growth.mjs";
import { canHarvestResource } from "./resources.mjs";
import { createCombat } from "./combat.mjs";
import { unitDisplaySize } from "../client/unit-size.mjs";

function design(ids, level) {
  let pieces=[];
  for (const id of ids) {
    const gene=ATTRIBUTE_DNA.lookup.get(id);
    let candidate=null;
    for(let rotation=0;rotation<6;rotation++) {
      const next=pieces.concat({gene:id,grade:gene.grade,rotation,shape:[...gene.steps]});
      if(ATTRIBUTE_DNA.trace(next,level).valid&&!ATTRIBUTE_DNA.trace(next,level).closed){candidate=next;break;}
    }
    assert.ok(candidate,id);pieces=candidate;
  }
  return {version:3,pieces,level,budget:10000};
}

function fixture(level, tribe) {
  const occupiedCells=new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"]);
  const colony={id:1,ownerId:"dna-test",x:40,y:40,tribe:tribe||"bean",occupiedCells};
  const environment={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},colonies:[colony],games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,colony);environment.games.set(colony.ownerId,game);
  const saved=JSON.parse(game.save());saved.state.evolutionPoints=10000;saved.state.nestLevel=level;game.restore(JSON.stringify(saved));
  return {game,environment,colony};
}

test("DNA 판은 처음 반경을 유지하며 한 레벨마다 한 겹 늘어난다",()=>{
  assert.deepEqual([1,2,3,4].map(ATTRIBUTE_DNA.boardRadius),[2,3,4,5]);
  assert.deepEqual([1,2,3,4].map(level=>{let count=0;for(let q=-6;q<=6;q++)for(let r=-6;r<=6;r++)if(ATTRIBUTE_DNA.inside({q,r},level))count++;return count;}),[19,37,61,91]);
});

test("DNA 명령은 포인트·등급·형태 위조를 거부하고 현재 판 안의 설계만 저장한다",()=>{
  const dna=design(["gather"],1);assert.ok(validateDna(dna,1,100));
  assert.equal(validateDna(dna,1,0),null);
  const forged=cloneDna(dna);forged.pieces[0].shape=[0,0];assert.equal(validateDna(forged,1,100),null);
  assert.equal(validateDna(design(["power"],2),1,100),null);
  const {game}=fixture(1),before=game.snapshot().templates.length;
  assert.throws(()=>game.command({type:"design",templateId:null,name:"위조",dna:forged,birth:false}),/설계 속성/);
  assert.equal(game.snapshot().templates.length,before);
});

test("실제 둥지 성장으로 DNA 등급을 열고 저장된 높은 레벨로 설계·탄생·복제를 우회하지 못한다",()=>{
  const {game}=fixture(1);
  for (const [level,gene] of [[2,"power"],[3,"combo"],[4,"parry"]]) {
    const dna=design([gene],4);
    assert.throws(()=>game.command({type:"design",templateId:null,name:gene,dna,birth:false}),/설계 속성/);
    game.command({type:"upgrade"});
    assert.equal(game.snapshot().nestLevel,level);
    const {templateId}=game.command({type:"design",templateId:null,name:gene,dna,birth:false});
    assert.equal(game.snapshot().templates.find(item=>item.id===templateId).dna.level,level);
    const {agentId}=game.command({type:"birth",templateId});
    const saved=JSON.parse(game.save());
    saved.state.nestLevel=level-1;
    game.restore(JSON.stringify(saved));
    const points=game.snapshot().evolutionPoints,count=game.agents.length;
    assert.throws(()=>game.command({type:"birth",templateId}),/설계를 수정/);
    assert.throws(()=>game.command({type:"birth",agentId}),/설계를 수정/);
    assert.equal(game.snapshot().evolutionPoints,points);
    assert.equal(game.agents.length,count);
    assert.deepEqual(game.agents.find(item=>item.id===agentId).dna.pieces,dna.pieces);
    saved.state.nestLevel=level;
    game.restore(JSON.stringify(saved));
  }
});

test("같은 DNA는 네 종족 모두 기본비 3포인트로 저장하고 실제 탄생 비용을 차감한다",()=>{
  const dna=design(["gather","health"],2);
  for(const tribe of ["bean","spring","pebble","spore"]) {
    assert.equal(birthCost({dna:design([],1)},tribe),3,tribe);
    assert.equal(birthCost({dna},tribe),11,tribe);
    assert.equal(birthCost({dna,tribe}),11,tribe);
    const {game}=fixture(2,tribe),saved=JSON.parse(game.save());
    saved.state.agents=[];game.restore(JSON.stringify(saved));
    const points=game.snapshot().evolutionPoints;
    const {templateId}=game.command({type:"design",templateId:null,name:"공통 일꾼",dna,birth:false});
    assert.equal(game.snapshot().evolutionPoints,points,tribe);
    const {agentId}=game.command({type:"birth",templateId});
    assert.equal(game.snapshot().evolutionPoints,points-11,tribe);
    assert.equal(game.agents.find(agent=>agent.id===agentId).cost,11,tribe);
  }
});

test("채집 DNA는 8포인트로 탄생하고 7포인트에서는 자원을 차감하지 않는다",()=>{
  for(const points of [7,8]){
    const {game}=fixture(1),saved=JSON.parse(game.save());
    saved.state.evolutionPoints=points;saved.state.agents=[];game.restore(JSON.stringify(saved));
    const {templateId}=game.command({type:"design",templateId:null,name:"채집 DNA",dna:design(["gather"],1),birth:false});
    assert.equal(game.snapshot().evolutionPoints,points);
    if(points===7){
      assert.throws(()=>game.command({type:"birth",templateId}),/진화 포인트/);
      assert.equal(game.snapshot().evolutionPoints,7);
      assert.equal(game.agents.length,0);
    }else{
      const {agentId}=game.command({type:"birth",templateId});
      assert.equal(game.agents.find(agent=>agent.id===agentId).cost,8);
      assert.equal(game.snapshot().evolutionPoints,0);
    }
  }
});

test("DNA 저장·탄생·수정·복제·복원은 원본 개체의 서열과 실험 스탯을 보존한다",()=>{
  const {game}=fixture(2),dna=design(["gather","health"],2),points=game.snapshot().evolutionPoints;
  const {templateId}=game.command({type:"design",templateId:null,name:"일꾼 DNA",dna,birth:false});
  assert.equal(game.snapshot().evolutionPoints,points);
  const template=game.snapshot().templates.find(item=>item.id===templateId),cost=birthCost(template,"bean");
  assert.equal(cost,3+ATTRIBUTE_DNA.price(dna.pieces));
  const {agentId}=game.command({type:"birth",templateId}),agent=game.agents.find(item=>item.id===agentId);
  assert.equal(game.snapshot().evolutionPoints,points-cost);
  assert.deepEqual(agent.stats.dna,ATTRIBUTE_DNA.stats(dna.pieces));
  const original=cloneDna(agent.dna);game.command({type:"design",templateId,name:"전사 DNA",dna:design(["blade"],2),birth:false});
  assert.deepEqual(agent.dna,original);
  const copy=game.command({type:"birth",agentId});assert.deepEqual(game.agents.find(item=>item.id===copy.agentId).dna,original);
  game.restore(game.save());const restored=game.agents.find(item=>item.id===agentId);assert.deepEqual(restored.dna,original);
  restored.growthActivity=100;applyAgentGrowth(restored,0);assert.deepEqual(restored.stats.dna,ATTRIBUTE_DNA.stats(dna.pieces));
  assert.equal(unitDisplaySize(restored),unitDisplaySize({tribe:"bean"})*1.02);
});

test("DNA는 기관으로 행동을 열고 시작 개체도 같은 채집 DNA를 사용한다",()=>{
  const {game,colony,environment}=fixture(1),cell={x:40,y:38,resourceType:"clay",amount:10};
  assert.equal(canHarvestResource(cell,environment.world,{dnaGather:false},"bean"),false);
  assert.equal(canHarvestResource(cell,environment.world,{dnaGather:true},"bean"),true);
  assert.equal(canHarvestResource(cell,environment.world,{},"bean"),true);
  const dna=design(["gather"],1),unit={dna,stats:dnaUnitStats(dna)};
  assert.equal(dnaCanMove(unit,42,37,[colony]),true);assert.equal(dnaCanMove(unit,42,36,[colony]),false);
  const roaming=design(["antenna"],2);assert.equal(dnaCanMove({dna:roaming,stats:dnaUnitStats(roaming)},100,100,[colony]),true);
  assert.ok(game.agents.every(agent=>agent.dna&&agent.stats.capacity>=1));
});

function combatFixture(sourceStats,targetStats) {
  const unit=(id,owner,stats)=>({id,ownerId:owner,tribe:"bean",x:100,y:100,health:100,combatDisposition:"aggressive",attributes:{},stats:{...stats,health:100,speed:1,vision:3},moveStartedAt:0,moveDuration:0});
  const a=unit("a","left",sourceStats),b=unit("b","right",targetStats),c=unit("c","right",targetStats),units=[a,b,c];
  const environment={games:new Map(),colonies:[],world:{terrain:new Uint8Array(320*320).fill(4)},combatRandom:()=>.99,damageRandom:()=>.5};
  for(const owner of ["left","right"])environment.games.set(owner,{agents:units.filter(agent=>agent.ownerId===owner),receiveDamage(agent,amount){agent.health=Math.max(0,agent.health-amount);}});
  const combat=createCombat(environment);const tick=time=>{environment.simSeconds=time;for(const agent of units)if(agent.health>0)combat.update(agent,time);};
  return {a,b,c,tick};
}

test("칼날 없는 DNA는 실제 전투에서 공격하지 않는다",()=>{
  const stats=dnaUnitStats(design([],1)),f=combatFixture(stats,stats);f.tick(0);f.tick(10);
  assert.equal(f.a.health,100);assert.equal(f.b.health,100);assert.ok(!f.a.attack);
});

test("DNA 연타는 같은 공격 주기 안에 후속 타격하고 범위 공격은 주 대상 사망 때도 발생한다",()=>{
  const base=dnaUnitStats(design(["blade"],2));
  const source={...base,dna:{...base.dna,hits:3,area:1,areaPower:50}},target=dnaUnitStats(design([],1));
  const f=combatFixture(source,target);f.tick(0);const first=f.a.attack.hitAt;f.tick(first);const health=f.b.health;
  f.tick(first+source.dna.comboSpeed);assert.ok(f.b.health<health);
  const lethal=combatFixture({...base,dna:{...base.dna,power:1000,meleePower:1000,area:1,areaPower:50}},target);lethal.tick(0);lethal.tick(lethal.a.attack.hitAt);
  assert.equal(lethal.b.health,0);assert.ok(lethal.c.health<100);
});
test("DNA 원이 중앙에 겹친 뒤 빈 선으로 계속 배치하고 겹치는 선은 거부한다",()=>{
  const piece=(gene,rotation)=>{const entry=ATTRIBUTE_DNA.lookup.get(gene);return {gene,rotation,grade:entry.grade,shape:[...entry.steps]};};
  const loop=[piece("harvestSpeed",0),piece("harvestSpeed",2),piece("harvestSpeed",4)];
  assert.equal(ATTRIBUTE_DNA.trace(loop,1).closed,true);
  const pieces=loop.concat(piece("capacity",5)),dna={version:3,pieces,level:1,budget:10000};
  assert.equal(ATTRIBUTE_DNA.trace(pieces,1).valid,true);
  assert.equal(ATTRIBUTE_DNA.trace(pieces,1).closed,false);
  assert.ok(validateDna(dna,1,10000));
  assert.equal(ATTRIBUTE_DNA.trace(loop.concat(piece("harvestSpeed",0)),1).reason,"collision");
  assert.equal(ATTRIBUTE_DNA.trace(loop.concat(piece("capacity",1)),1).reason,"collision");
  assert.equal(ATTRIBUTE_DNA.trace(loop.concat(piece("harvestSpeed",5)),1).reason,"collision");
  const overlap=[{gene:"gather",grade:1,rotation:0,shape:[0,3]}];
  assert.equal(ATTRIBUTE_DNA.trace(overlap,1).reason,"collision");
  const {game}=fixture(1);
  const {templateId}=game.command({type:"design",templateId:null,name:"겹친 원",dna,birth:false});
  const {agentId}=game.command({type:"birth",templateId});
  assert.deepEqual(game.agents.find(agent=>agent.id===agentId).dna.pieces,pieces);
});

test("0포인트에서도 DNA를 저장하지만 실제 탄생은 차단한다",()=>{
  const {game}=fixture(1),dna=design(["gather"],1),saved=JSON.parse(game.save());
  saved.state.evolutionPoints=0;game.restore(JSON.stringify(saved));
  const count=game.agents.length;
  assert.ok(ATTRIBUTE_DNA.price(dna.pieces)>0);
  const {templateId}=game.command({type:"design",templateId:null,name:"미리 설계",dna,birth:false});
  assert.equal(game.snapshot().evolutionPoints,0);
  assert.deepEqual(game.snapshot().templates.find(item=>item.id===templateId).dna.pieces,dna.pieces);
  const before=game.save();
  assert.throws(()=>game.command({type:"birth",templateId}),/설계를 수정|포인트가 부족/);
  assert.equal(game.save(),before);
  const result=game.command({type:"design",templateId,name:"미리 설계",dna,birth:true});
  assert.equal(result.agentId,null);
  assert.equal(game.snapshot().evolutionPoints,0);
  assert.equal(game.agents.length,count);
});
