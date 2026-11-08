import test from "node:test";
import assert from "node:assert/strict";
import { createCreatures } from "./creatures.mjs";
import { applyRaidCombatScale, raidCombatStage, RAID_COMBAT_STAGES } from "./raid-combat-scale.mjs";
import { combatDamage, unitCombatStats } from "./combat-stats.mjs";
import { updateCreatureNestAttack } from "./creature-combat.mjs";

function fixture(extra) {
  const colony = { id:1, ownerId:"owner", x:98, y:98, occupiedCells:new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"]) };
  const victim = { id:"unit:1", x:103, y:100, health:10000, combatDisposition:"peaceful", stats:{ health:10000, speed:1, attack:1, combatStrength:20 }, moveStartedAt:0, moveDuration:0 }, hits = [];
  const room = { seed:7, simSeconds:0, world:{ seed:7, sites:[[100,100]], terrain:new Uint8Array(102400).fill(4), hazards:new Uint8Array(102400), burrows:[
    { id:"large:1", type:"large", x:148, y:100, width:3, height:1, entrance:{x:149,y:101} },
    { id:"small:1", type:"small", x:140, y:140, width:1, height:1, entrance:{x:140,y:141} }
  ] }, colonies:[colony], food:new Map(), games:new Map([["owner", { agents:[victim], receiveDamage(agent, amount) { hits.push({time:room.simSeconds,amount}); agent.health -= amount; } }]]) };
  if (extra) room.world.burrows.push({ id:"large:2", type:"large", x:148, y:140, width:3, height:1, entrance:{x:149,y:141} });
  const system = createCreatures(room, null); room.creatureSystem = system;
  return { room, system, victim, hits };
}

const beetle = () => ({ species:"spiny-back-beetle", attributes:{}, health:130,
  stats:{ ...unitCombatStats("spiny-back-beetle"), speed:1, vision:4 } });

test("raid cohorts rise at the exact stage boundary and never exceed baseline", () => {
  assert.deepEqual(RAID_COMBAT_STAGES.map(stage => raidCombatStage(stage.at)), RAID_COMBAT_STAGES.map((_, index) => index));
  for (let index = 1; index < RAID_COMBAT_STAGES.length; index++)
    assert.equal(raidCombatStage(RAID_COMBAT_STAGES[index].at - .001), index - 1);
  for (const [index, stage] of RAID_COMBAT_STAGES.entries()) {
    const agent = beetle(); applyRaidCombatScale(agent, stage.at);
    assert.equal(agent.raidCombatScale.stage, index);
    assert.equal(agent.stats.health, 130 * stage.health);
    assert.ok(Math.abs(agent.stats.attackPower - 18 * stage.damage) < 1e-8);
    assert.equal(agent.stats.attack, 18 * stage.damage);
  }
});

test("midgame stages retain opening and progressively approach full strength", () => {
  assert.deepEqual(RAID_COMBAT_STAGES.map(s => [s.at,s.health,s.damage]), [
    [300,.1,.025],[480,.2,.05],[720,.4,.2],[1080,.5,.2],
    [1500,.65,.25],[1800,.8,.4],[2100,.9,.6],[2400,1,1]
  ]);
  for(let i=1;i<RAID_COMBAT_STAGES.length;i++) {
    assert.ok(RAID_COMBAT_STAGES[i].health>=RAID_COMBAT_STAGES[i-1].health);
    assert.ok(RAID_COMBAT_STAGES[i].damage>=RAID_COMBAT_STAGES[i-1].damage);
  }
});

test("reapplication preserves injury/death without compounding saved stats", () => {
  for (const health of [0,25,50,100]) {
    const agent = beetle(); agent.health = health; applyRaidCombatScale(agent, 300);
    const first = structuredClone(agent);
    for (let index = 0; index < 4; index++) applyRaidCombatScale(agent);
    assert.deepEqual(agent, first);
  }
  assert.throws(() => applyRaidCombatScale({...beetle(),raidCombatScale:{version:1,stage:99}}));
  assert.throws(() => applyRaidCombatScale(beetle(), NaN));
});

test("non-raiders and unrelated species keep their original stats", () => {
  const agent = beetle(), before = structuredClone(agent);
  assert.equal(applyRaidCombatScale(agent), false); assert.deepEqual(agent, before);
  const other = {...beetle(),species:"bubble-toad"}, original = structuredClone(other);
  assert.equal(applyRaidCombatScale(other, 300), false); assert.deepEqual(other, original);
});

test("dispatch prepares only the departing mole and save restore retains its cohort", () => {
  const {room,system} = fixture(false);
  room.simSeconds = system.save().burrows[0].nextRaidAt; system.tick();
  const raider = system.agents.find(agent => agent.raid);
  assert.ok(raider); assert.equal(raider.species,"soil-mole"); assert.equal(raider.stats.health,16); assert.equal(raider.stats.attack,.75);
  assert.ok(system.agents.filter(agent => !agent.raid).every(agent => agent.stats.health===130 && agent.stats.attack===18));
  system.receiveDamage(raider, 5);
  const saved = JSON.parse(JSON.stringify(system.save()));
  room.simSeconds = 1600;
  const restored = createCreatures(room, saved), resumed = restored.agents.find(agent => agent.id===raider.id);
  assert.equal(resumed.health,11); assert.equal(resumed.stats.health,16); assert.equal(resumed.raidCombatScale.stage,0);
  const second = createCreatures(room, JSON.parse(JSON.stringify(restored.save()))).agents.find(agent=>agent.id===raider.id);
  assert.deepEqual(second.stats,resumed.stats); assert.equal(second.health,11);
});

test("old active raids migrate by departure time; retired raiders remain weak after reload", () => {
  const {room,system} = fixture(false);
  room.simSeconds=system.save().burrows[0].nextRaidAt; system.tick();
  const saved=JSON.parse(JSON.stringify(system.save())), raider=saved.agents.find(agent=>agent.raid);
  delete raider.raidCombatScale;raider.species="spiny-back-beetle";raider.stats={...beetle().stats};raider.health=65;
  room.simSeconds=1500;
  const restored=createCreatures(room,saved), a=restored.agents.find(agent=>agent.id===raider.id);
  assert.equal(a.health,6.5);assert.equal(a.stats.health,13);
  const again=JSON.parse(JSON.stringify(restored.save()));delete again.agents.find(agent=>agent.id===a.id).raid;
  const b=createCreatures(room,again).agents.find(agent=>agent.id===a.id);
  assert.equal(b.health,6.5);assert.equal(b.stats.health,13);assert.equal(b.raidCombatScale.stage,0);
});

test("early cohort scales unit damage and nest damage consistently", () => {
  const original=beetle(),weak=beetle();applyRaidCombatScale(weak,300);
  const target={stats:{health:30,dna:{melee:true,power:2,speed:.5,armor:0,focus:.3,hits:1,comboSpeed:.12}},health:30};
  assert.ok(Math.abs(combatDamage(weak,target,.5) / combatDamage(original,target,.5)-.025)<1e-8);
  Object.assign(weak,{id:"b",x:5,y:5,facing:1,combatDisposition:"aggressive",mode:"idle",attackReadyAt:0});
  let nestHp=100;
  const nest={agent:{id:"nest",kind:"nest",x:5,y:5,width:5,height:5,health:100},game:{receiveNestDamage(damage){nestHp-=damage;return nestHp;}}};
  assert.equal(updateCreatureNestAttack(weak,nest,0),true);
  updateCreatureNestAttack(weak,nest,weak.attack.hitAt);
  assert.ok(Math.abs(nestHp-99.55)<1e-8);
});

test("every cohort keeps damage and fractional injury through creature serialization", () => {
  for (const [index,stage] of RAID_COMBAT_STAGES.entries()) {
    const {room,system}=fixture(false);
    room.simSeconds=system.save().burrows[0].nextRaidAt;system.tick();
    const a=system.agents.find(agent=>agent.raid);Object.assign(a,beetle());delete a.raidCombatScale;applyRaidCombatScale(a,stage.at);a.raid.departedAt=stage.at;
    a.health=a.stats.health*.6;
    const expected=structuredClone(a.stats), saved=JSON.parse(JSON.stringify(system.save()));
    room.simSeconds=2000;
    const b=createCreatures(room,saved).agents.find(agent=>agent.id===a.id);
    assert.equal(b.raidCombatScale.stage,index);assert.deepEqual(b.stats,expected);
    assert.ok(Math.abs(b.health-stage.health*78)<1e-8);
  }
});


test("version-one cohorts preserve old strength while new cohorts use calibrated stages",()=>{
  const old = {...beetle(), health:50, raidCombatScale:{version:1,stage:4}};
  applyRaidCombatScale(old);
  assert.equal(old.health,50); assert.equal(old.stats.health,130);
  assert.equal(old.stats.attack,18);
  const current=beetle();applyRaidCombatScale(current,1500);
  assert.equal(current.raidCombatScale.version,3);
  assert.equal(current.stats.health,84.5);assert.equal(current.stats.attack,4.5);
  current.health/=2;applyRaidCombatScale(current);
  assert.equal(current.health,42.25);
});
