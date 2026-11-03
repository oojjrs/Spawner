import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { validateDna } from "./dna-unit.mjs";
import { createCombat } from "./combat.mjs";
import { dnaAttackMode } from "./dna-actions.mjs";

const piece = id => { const gene = ATTRIBUTE_DNA.lookup.get(id); return { gene:id, grade:gene.grade, shape:[...gene.steps], rotation:0 }; };
const stats = ids => ATTRIBUTE_DNA.stats(ids.map(piece));
function fixture(ids) {
  const source = { id:"source", ownerId:"a", tribe:"bean", x:100, y:100, health:10, attributes:{}, combatDisposition:"aggressive", moveStartedAt:0, moveDuration:0, stats:{ health:10, speed:1, vision:4, dna:stats(ids) } };
  const target = { id:"target", ownerId:"b", tribe:"bean", x:102, y:100, health:100, attributes:{}, combatDisposition:"passive", moveStartedAt:0, moveDuration:0, stats:{ health:100, speed:1, combatStrength:10 } };
  const ally = { ...target, id:"ally", ownerId:"a", x:100, health:50 };
  const game = agents => ({ agents, receiveDamage(agent, amount) { agent.health=Math.max(0,agent.health-amount); } });
  const env = { world:{terrain:new Uint8Array(320*320)}, games:new Map([["a",game([source,ally])],["b",game([target])]]), combatRandom:()=>.99, damageRandom:()=>.5 };
  return { source,target,ally,env,combat:createCombat(env) };
}

test("level one mixes three unlocks with two basic stats",()=>{
  assert.deepEqual(ATTRIBUTE_DNA.catalog.filter(g=>g.grade===1).map(g=>g.id),["gather","health","blade","movement","secretion"]);
  assert.ok(ATTRIBUTE_DNA.catalog.filter(g=>g.category!=="organ"&&!["health","movement"].includes(g.id)).every(g=>g.grade>=2));
  assert.equal(stats(["armor"]).armor,3); assert.equal(stats(["evasion"]).evasion,9);
  assert.equal(stats(["carapace"]).armor,2); assert.equal(stats(["legs"]).evasion,9);
  const once=stats(["gather","antenna","blade","healer","secretion"]), twice=stats(["gather","antenna","blade","healer","secretion","gather","antenna","blade","healer","secretion"]);
  assert.equal(twice.capacity,2*once.capacity); assert.equal(twice.harvest,2*once.harvest); assert.equal(twice.meleePower,2*once.meleePower); assert.equal(twice.rangedPower,2*once.rangedPower); assert.equal(twice.healerCount,2*once.healerCount); assert.equal(twice.meleeSpeed,once.meleeSpeed); assert.equal(twice.rangedSpeed,once.rangedSpeed);
});

test("legacy health and antenna snapshots survive without accepting malformed DNA",()=>{
  for(const entry of [{gene:"health",grade:1,shape:[0,1],rotation:0},{gene:"antenna",grade:2,shape:[0,1,2],rotation:0},{gene:"health",grade:2,shape:[0,1,2],rotation:0},{gene:"antenna",grade:1,shape:[0,1],rotation:0},{gene:"movement",grade:2,shape:[0,1,3],rotation:0},{gene:"healer",grade:1,shape:[0,5],rotation:0}]) {
    const dna={version:3,pieces:[entry],budget:1000,level:2}; assert.ok(validateDna(dna,2,1000));
  }
  assert.equal(validateDna({version:3,pieces:[null],budget:100,level:1},1,100),null);
});

test("ranged shot hits outside contact after travel and spends one shared cycle",()=>{
  const f=fixture(["blade","secretion"]); f.combat.update(f.source,0);
  assert.equal(f.source.attack.attackMode,"ranged"); assert.equal(f.target.health,100); assert.equal(f.source.attackReady,2);
  f.combat.update(f.source,.5); assert.equal(f.target.health,100);
  f.combat.update(f.source,.7); assert.ok(f.target.health<100); assert.equal(f.source.attackReady,2);
  assert.equal(dnaAttackMode(f.source.stats.dna,1),"melee");
  assert.equal(dnaAttackMode(stats(["secretion"]),0),"ranged");
});

test("support heals a different ally while its ranged attack is running",()=>{
  const f=fixture(["healer","secretion"]); f.source.health=5; f.combat.update(f.source,0);
  assert.equal(f.ally.health,51); assert.equal(f.source.health,5); assert.equal(f.source.attack.attackMode,"ranged");
  f.combat.update(f.source,1); assert.equal(f.ally.health,51);
  f.combat.update(f.source,2); assert.equal(f.ally.health,52);
});

test("dead or hidden projectile participants cancel damage",()=>{
  for(const field of ["health","hidden","retreat"]) {
    const f=fixture(["secretion"]); f.combat.update(f.source,0); f.source[field]=field==="health"?0:true;
    f.combat.update(f.ally,1); assert.equal(f.target.health,100,field);
  }
});

test("windup cancellation removes unlaunched shots while launched combo shots remain",()=>{
  const f=fixture(["secretion","combo"]); f.combat.update(f.source,0);
  assert.equal(f.source.dnaProjectiles.length,4);
  assert.deepEqual(f.source.dnaProjectiles.map(p=>Math.round(p.launchedAt*100)),[30,42,54,66]);
  f.combat.update(f.source,.31); f.source.attack=null;
  f.combat.update(f.ally,.35); assert.equal(f.source.dnaProjectiles.length,1);
  f.combat.update(f.ally,.7); assert.ok(f.target.health<100); assert.equal(f.source.dnaProjectiles.length,0);
  const cancelled=fixture(["secretion"]); cancelled.combat.update(cancelled.source,0); cancelled.source.attack=null;
  cancelled.combat.update(cancelled.ally,1); assert.equal(cancelled.target.health,100);
});

test("projectile flight does not block a later attack or inherit its counter multiplier",()=>{
  const f=fixture(["secretion"]); f.target.stats.defense=0; f.source.stats.dna.rangedSpeed=4; f.source.stats.dna.focus=.1; f.source.stats.dna.counterPower=200;
  f.combat.update(f.source,0); f.combat.update(f.source,.11); f.combat.update(f.source,.3);
  assert.equal(f.source.dnaProjectiles.length,2); assert.equal(f.source.attack.startedAt,.3);
  const newAttack=f.source.attack; newAttack.counter=true;
  f.combat.update(f.ally,.44);
  assert.ok(Math.abs(f.target.health-98.6)<1e-8); assert.equal(newAttack.resolved,false);
});

test("hybrid can shoot an adjacent world cell before same-cell melee contact",()=>{
  const f=fixture(["blade","secretion"]); f.target.x=101; f.combat.update(f.source,0);
  assert.equal(f.source.attack.attackMode,"ranged"); assert.equal(f.source.combat,undefined);
  f.combat.update(f.ally,.5); assert.ok(f.target.health<100);
  assert.equal(f.source.dnaActionEvent.kind,"ranged"); assert.equal(f.target.dnaActionEvent.targetId,f.target.id);
});

test("restoring a colony discards in-flight references and keeps its spent cooldown",()=>{
  const f=fixture(["secretion"]); f.combat.update(f.source,0); f.combat.update(f.source,.31);
  const restored={...f.source,attack:null,dnaProjectiles:[]}; f.env.games.get("a").agents=[restored,f.ally];
  f.combat.update(f.ally,1); assert.equal(f.target.health,100); assert.equal(restored.attackReady,2);
});
test("melee and ranged investment change only their own power and rate",()=>{
  const melee=stats(["blade","secretion","power","speed"]),ranged=stats(["blade","secretion","rangedPower","rangedSpeed"]);
  assert.equal(melee.meleePower,6); assert.equal(melee.meleeSpeed,.6); assert.equal(melee.rangedPower,1.4); assert.equal(melee.rangedSpeed,.5);
  assert.equal(ranged.meleePower,2); assert.equal(ranged.meleeSpeed,.5); assert.ok(Math.abs(ranged.rangedPower-5.6)<1e-9); assert.equal(ranged.rangedSpeed,.65);
  assert.equal(stats(["secretion"]).power,1.4); assert.equal(stats(["secretion"]).speed,.5);
  for(const id of ["rangedPower","rangedSpeed"]) { const g=ATTRIBUTE_DNA.lookup.get(id);assert.equal(g.grade,3);assert.equal(g.steps.length,4);assert.ok(ATTRIBUTE_DNA.trace([piece(id)],3).valid); }
});

test("ranged damage is the visible base and selected rate owns the shared cooldown",()=>{
  const f=fixture(["blade","secretion","power","speed","rangedSpeed"]); f.target.stats.defense=0; f.target.stats.attackPower=0;
  f.combat.update(f.source,0); const ready=1/.65; assert.equal(f.source.attackReady,ready);
  f.combat.update(f.source,.7); assert.ok(Math.abs(f.target.health-98.6)<1e-8);
  f.source.x=f.target.x; f.combat.update(f.source,.8); assert.equal(f.source.combat.nextAttackAt,ready);
  f.combat.update(f.source,ready); assert.equal(f.source.attack.attackMode,"melee"); assert.ok(Math.abs(f.source.combat.nextAttackAt-(ready+1/.6))<1e-9);
});