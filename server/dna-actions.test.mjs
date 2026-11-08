import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { validateDna, cloneDna } from "./dna-unit.mjs";
import { createCombat } from "./combat.mjs";
import { dnaAttackMode } from "./dna-actions.mjs";

const piece = id => { const gene = ATTRIBUTE_DNA.lookup.get(id); return { gene:id, grade:gene.grade, q:0,r:0,rotation:0 }; };
const stats = ids => ATTRIBUTE_DNA.stats(ids.map(piece));
function fixture(ids) {
  const source = { id:"source", ownerId:"a", tribe:"bean", x:100, y:100, health:10, attributes:{}, combatDisposition:"aggressive", moveStartedAt:0, moveDuration:0, stats:{ health:10, speed:1, vision:4, dna:stats(ids) } };
  const target = { id:"target", ownerId:"b", tribe:"bean", x:100, y:100, health:100, attributes:{}, combatDisposition:"passive", moveStartedAt:0, moveDuration:0, stats:{ health:100, speed:1, combatStrength:10, dna:stats([]) } };
  const ally = { ...target, id:"ally", ownerId:"a", x:99, health:50 };
  const game = agents => ({ agents, receiveDamage(agent, amount) { agent.health=Math.max(0,agent.health-amount); } });
  const env = { world:{terrain:new Uint8Array(320*320)}, games:new Map([["a",game([source,ally])],["b",game([target])]]), combatRandom:()=>.99, damageRandom:()=>.5 };
  const combat=createCombat(env); combat.engage(source,target,0);
  for(const [unit,x] of [[source,-1.2],[target,1.2]]) Object.assign(unit.combat.position,{x,y:0,fromX:x,fromY:0});
  return { source,target,ally,env,combat };
}

test("level one opens gathering with six repeatable utility stats",()=>{
  assert.deepEqual(ATTRIBUTE_DNA.catalog.filter(g=>g.grade===1).map(g=>g.id),["capacity","gather","harvestSpeed","health","movement","regeneration","vision"]);
  assert.ok(ATTRIBUTE_DNA.catalog.filter(g=>g.category!=="organ"&&!["capacity","harvestSpeed","health","movement","regeneration","vision"].includes(g.id)).every(g=>g.grade>=2));
  assert.equal(stats(["armor"]).armor,30); assert.equal(stats(["evasion"]).evasion,9);
  assert.equal(stats(["carapace"]).armor,20); assert.equal(stats(["legs"]).evasion,9);
  const once=stats(["gather","antenna","blade","secretion"]), twice=stats(["gather","antenna","blade","secretion","gather","antenna","blade","secretion"]);
  assert.equal(twice.capacity,2*once.capacity); assert.equal(twice.harvest,1); assert.equal(twice.meleePower,2*once.meleePower); assert.equal(twice.rangedPower,2*once.rangedPower); assert.equal(twice.meleeSpeed,once.meleeSpeed); assert.equal(twice.rangedSpeed,once.rangedSpeed);
});

test("legacy snapshots survive schema restore while new designs require the current catalog",()=>{
  for(const entry of [{gene:"health",grade:1,shape:[0,1],rotation:0},{gene:"health",grade:2,shape:[0,1,2],rotation:0},{gene:"antenna",grade:1,shape:[0,1],rotation:0},{gene:"movement",grade:2,shape:[0,1,3],rotation:0}]) {
    const dna={version:3,pieces:[entry],budget:1000,level:2};
    const migrated=ATTRIBUTE_DNA.validate(dna);assert.equal(migrated.version,6);assert.deepEqual(ATTRIBUTE_DNA.stats(migrated.pieces),ATTRIBUTE_DNA.stats(dna.pieces));assert.deepEqual(cloneDna(dna),migrated);assert.equal(validateDna(dna,2,1000),null);
  }
  assert.ok(validateDna({version:6,pieces:[piece("antenna")],budget:1000,level:2},2,1000));
  assert.equal(validateDna({version:3,pieces:[null],budget:100,level:1},1,100),null);
});

test("same-cell ranged shot applies damage only after flight and retains its shared cycle",()=>{
  const f=fixture(["blade","secretion"]); f.combat.update(f.source,0);
  const attack=f.source.attack, ready=f.source.attackReady;
  assert.equal(attack.attackMode,"ranged"); assert.equal(attack.combatId,f.source.combat.id);
  assert.equal(f.target.health,100); assert.equal(ready,attack.endsAt+attack.interval);
  f.combat.update(f.source,attack.launchedAt);
  const arrival=f.source.dnaProjectiles[0].hitAt;
  f.combat.update(f.source,arrival-.001); assert.equal(f.target.health,100);
  f.combat.update(f.source,arrival); assert.ok(f.target.health<100); assert.equal(f.source.attackReady,ready);
  assert.equal(dnaAttackMode(f.source.stats.dna,1),"melee");
  assert.equal(dnaAttackMode(stats(["secretion"]),0),"ranged");
});

test("dead or hidden projectile participants cancel same-cell damage",()=>{
  for(const participant of ["source","target"]) for(const field of ["health","hidden"]) {
    const f=fixture(["secretion"]); f.combat.update(f.source,0); f.combat.update(f.source,f.source.attack.launchedAt);
    const arrival=f.source.dnaProjectiles[0].hitAt;
    f[participant][field]=field==="health"?0:true;
    const health=f.target.health;
    if(field==="health") f.combat.release(f[participant],arrival);
    f.combat.update(f.target,arrival);
    assert.equal(f.target.health,health,participant+field);
    assert.equal(f.source.dnaProjectiles.length,0);
  }
});

test("canceling a cell attack prevents pending combo shots while a launched shot remains",()=>{
  for(const emitted of [0,1]) {
    const f=fixture(["secretion","combo"]); f.combat.update(f.source,0);
    const attack=f.source.attack;
    if(emitted) f.combat.update(f.source,attack.launchedAt);
    assert.equal(f.source.dnaProjectiles?.length||0,emitted);
    f.source.attack=null; f.source.combat.nextAttackAt=Infinity;
    f.combat.update(f.target,2);
    assert.equal(f.target.health,100-emitted*1.4);
    assert.equal(f.source.dnaProjectiles?.length||0,0);
  }
});

test("launched cell projectile retains its attack when a later counter starts",()=>{
  const f=fixture(["secretion"]); f.source.stats.dna.counterPower=200;
  f.combat.update(f.source,0); const first=f.source.attack;
  f.combat.update(f.source,first.launchedAt); const arrival=f.source.dnaProjectiles[0].hitAt;
  f.source.attack=null; f.source.combat.nextAttackAt=first.launchedAt+.01;
  f.combat.update(f.source,first.launchedAt+.01);
  const later=f.source.attack; later.counter=true;
  f.combat.update(f.target,arrival);
  assert.ok(Math.abs(f.target.health-98.6)<1e-8);
  assert.notEqual(later,first); assert.equal(first.counter,false);
});

test("hybrid cannot shoot an adjacent world cell before same-cell contact",()=>{
  const f=fixture(["blade","secretion"]); f.source.combat=null; f.target.combat=null; f.target.x=101;
  for(const time of [0,.5,1,3]) assert.equal(f.combat.update(f.source,time),false);
  assert.ok(!f.source.attack); assert.ok(!f.source.combat);
  assert.equal(f.source.dnaProjectiles?.length||0,0); assert.equal(f.target.health,100);
});

test("restoring a colony discards in-flight references and keeps its spent cooldown",()=>{
  const f=fixture(["secretion"]); f.combat.update(f.source,0); f.combat.update(f.source,f.source.attack.launchedAt);
  const ready=f.source.attackReady;
  const restored={...f.source,attack:null,dnaProjectiles:[]}; f.env.games.get("a").agents=[restored,f.ally];
  restored.combat.nextAttackAt=Infinity;
  f.combat.update(f.target,1); assert.equal(f.target.health,100); assert.equal(restored.attackReady,ready);
});

test("melee and ranged investment change only their own power and rate",()=>{
  const melee=stats(["blade","secretion","power","speed"]),ranged=stats(["blade","secretion","rangedPower","rangedSpeed"]);
  assert.equal(melee.meleePower,10); assert.equal(melee.meleeSpeed,.6); assert.equal(melee.rangedPower,1.4); assert.equal(melee.rangedSpeed,.5);
  assert.equal(ranged.meleePower,2); assert.equal(ranged.meleeSpeed,.5); assert.ok(Math.abs(ranged.rangedPower-4.2)<1e-9); assert.equal(ranged.rangedSpeed,.6);
  assert.equal(stats(["secretion"]).power,1.4); assert.equal(stats(["secretion"]).speed,.5);
  for(const id of ["rangedPower","rangedSpeed"]) { const g=ATTRIBUTE_DNA.lookup.get(id);assert.equal(g.grade,2);assert.ok(g.cells.length>=3);assert.ok(ATTRIBUTE_DNA.trace([piece(id)],2).valid); }
});

test("ranged and melee cell attacks use their own visible power and full interval",()=>{
  const f=fixture(["blade","secretion","power","speed","rangedSpeed"]);
  f.combat.update(f.source,0); const attack=f.source.attack, ready=f.source.attackReady;
  assert.ok(Math.abs(ready-attack.endsAt-1/.6)<1e-9);
  f.combat.update(f.source,attack.launchedAt);
  f.combat.update(f.source,f.source.dnaProjectiles[0].hitAt);
  assert.ok(Math.abs(f.target.health-98.6)<1e-8);
  f.combat.update(f.source,attack.endsAt);
  for(const unit of [f.source,f.target]) Object.assign(unit.combat.position,{x:unit.combat.side?.4:-.4,y:0,fromX:unit.combat.side?.4:-.4,fromY:0});
  f.combat.update(f.source,ready); assert.equal(f.source.attack.attackMode,"melee");
  assert.ok(Math.abs(f.source.combat.nextAttackAt-f.source.attack.endsAt-1/.6)<1e-9);
});
