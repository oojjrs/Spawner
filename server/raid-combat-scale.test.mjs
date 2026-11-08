import test from "node:test";
import assert from "node:assert/strict";
import { createCreatures } from "./creatures.mjs";
import { prepareRaidCreature, RAID_CREATURE_STAGES } from "./raid-combat-scale.mjs";
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

function assertSpeciesStats(agent) {
  const expected = unitCombatStats(agent.species);
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(agent.stats[key], value, agent.species + ":" + key);
}

test("dispatch changes species at the boundaries without a second stat table", () => {
  assert.deepEqual(RAID_CREATURE_STAGES.map(stage => [stage.at,stage.species]), [[300,"soil-mole"],[480,"spiny-back-beetle"],[720,"soil-boar"]]);
  for (const [time, species, stage] of [[0,"soil-mole",0],[479.999,"soil-mole",0],[480,"spiny-back-beetle",1],[719.999,"spiny-back-beetle",1],[720,"soil-boar",2],[100000,"soil-boar",2]]) {
    const base = unitCombatStats("spiny-back-beetle"), agent = { species:"spiny-back-beetle", attributes:{}, health:base.health, stats:{...base} };
    assert.equal(prepareRaidCreature(agent,time),stage);
    assert.equal(agent.species,species);
    assertSpeciesStats(agent);
    assert.equal(agent.health,agent.stats.health);
    assert.equal(agent.raidCombatScale,undefined);
  }
});

test("dispatch preserves fractional injury and death while rejecting invalid times", () => {
  for (const fraction of [0,.25,.5,1]) for (const stage of RAID_CREATURE_STAGES) {
    const base = unitCombatStats("spiny-back-beetle"), agent = { species:"spiny-back-beetle", health:base.health*fraction, stats:{...base} };
    prepareRaidCreature(agent,stage.at);
    assert.equal(agent.health,unitCombatStats(stage.species).health*fraction);
    assertSpeciesStats(agent);
  }
  for (const time of [NaN,Infinity,-1]) assert.throws(() => prepareRaidCreature({},time));
});

test("natural dispatch uses the same species stats as wild creatures and restores injury", () => {
  const {room,system}=fixture(false);
  room.simSeconds=system.save().burrows[0].nextRaidAt;system.tick();
  const raider=system.agents.find(agent=>agent.raid);
  assert.equal(raider.species,"soil-mole");assertSpeciesStats(raider);
  for(const guard of system.agents.filter(agent=>!agent.raid)) assertSpeciesStats(guard);
  system.receiveDamage(raider,raider.stats.health*.25);
  room.simSeconds=1600;
  const restored=createCreatures(room,JSON.parse(JSON.stringify(system.save())));
  const resumed=restored.agents.find(agent=>agent.id===raider.id);
  assert.equal(resumed.species,"soil-mole");assertSpeciesStats(resumed);
  assert.ok(Math.abs(resumed.health-resumed.stats.health*.75)<1e-8);
  assert.equal(resumed.raidCombatScale,undefined);
});

test("all legacy raid versions normalize by current species without changing injury", () => {
  for(const [version,species,stage,maximum,power] of [[1,"spiny-back-beetle",0,26,1.8],[2,"spiny-back-beetle",0,26,1.8],[3,"spiny-back-beetle",0,13,.45],[4,"soil-mole",0,16,.75],[4,"spiny-back-beetle",1,26,.9],[4,"soil-boar",7,180,31]]) {
    for(const fraction of [0,.5,1]) {
      const {room,system}=fixture(false),saved=JSON.parse(JSON.stringify(system.save()));
      const agent=saved.agents[0],base=unitCombatStats(species);
      Object.assign(agent,{species,health:maximum*fraction,raidCombatScale:{version,stage},stats:{...base,health:maximum,attack:power,attackPower:power,
        combat:{...base.combat,health:maximum,power,meleePower:power,rangedPower:0,melee:true,ranged:false,position:"middle",regeneration:0}}});
      room.simSeconds=3000;
      const restored=createCreatures(room,saved),result=restored.agents.find(entry=>entry.id===agent.id);
      assert.equal(result.species,species);assertSpeciesStats(result);
      assert.ok(Math.abs(result.health-base.health*fraction)<1e-8);
      assert.equal(result.raidCombatScale,undefined);
      const repeated=createCreatures(room,JSON.parse(JSON.stringify(restored.save()))).agents.find(entry=>entry.id===agent.id);
      assert.deepEqual(repeated.stats,result.stats);assert.equal(repeated.health,result.health);
    }
  }
});

test("legacy active raids without scale markers and retired raiders share canonical stats", () => {
  const {room,system}=fixture(false);
  room.simSeconds=system.save().burrows[0].nextRaidAt;system.tick();
  const saved=JSON.parse(JSON.stringify(system.save())),agent=saved.agents.find(entry=>entry.raid);
  agent.species="spiny-back-beetle";agent.stats={...unitCombatStats(agent.species),health:26,attackPower:.9};agent.health=13;
  delete agent.raidCombatScale;
  room.simSeconds=1500;
  const restored=createCreatures(room,saved),result=restored.agents.find(entry=>entry.id===agent.id);
  assertSpeciesStats(result);assert.equal(result.health,result.stats.health/2);
  const retired=JSON.parse(JSON.stringify(restored.save()));delete retired.agents.find(entry=>entry.id===agent.id).raid;
  const again=createCreatures(room,retired).agents.find(entry=>entry.id===agent.id);
  assertSpeciesStats(again);assert.equal(again.health,result.health);assert.equal(again.species,agent.species);
});

test("raid unit and nest damage use the same unscaled species attack", () => {
  for(const time of [300,480,720,2400]) {
    const base=unitCombatStats("spiny-back-beetle"),raider={species:"spiny-back-beetle",attributes:{},health:base.health,stats:{...base}};
    prepareRaidCreature(raider,time);
    const wild={species:raider.species,attributes:{},health:raider.stats.health,stats:{...unitCombatStats(raider.species)}};
    const target={stats:{health:30,dna:{melee:true,power:2,speed:.5,armor:0,focus:.3,hits:1,comboSpeed:.12}},health:30};
    assert.equal(combatDamage(raider,target,.5),combatDamage(wild,target,.5));
    Object.assign(raider,{id:"raider",x:5,y:5,facing:1,mode:"idle",attackReadyAt:0});
    let received=0;
    const nest={agent:{id:"nest",kind:"nest",x:5,y:5,width:5,height:5,health:10000},game:{receiveNestDamage(damage){received+=damage;return 10000-received;}}};
    assert.equal(updateCreatureNestAttack(raider,nest,0),true);
    updateCreatureNestAttack(raider,nest,raider.attack.hitAt);
    assert.equal(received,unitCombatStats(raider.species).attackPower);
  }
});
