import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createCreatures } from "./creatures.mjs";
import { prepareRaidCreature, RAID_CREATURE_STAGES } from "./raid-combat-scale.mjs";
import { combatDisposition } from "./combat.mjs";
import { unitCombatStats, combatProfile } from "./combat-stats.mjs";
import { creatureAttackMode } from "./creature-attack-role.mjs";
import { combatPositionRole } from "./combat-position.mjs";

const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const decision = JSON.parse(worker.match(/^globalThis.SpawnerDecisionWorkerSource = ("[^\n]+");/)[1]);
const surfaces = [["source", { createCreatures, prepareRaidCreature, combatDisposition, creatureAttackMode, combatPositionRole }]];
for (const [name, source, entry] of [["game worker", worker, "client/worker.mjs"], ["decision worker", decision, "client/decision-worker.mjs"]]) {
  const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(source.slice(0, source.indexOf('modules["' + entry + '"]')) +
    'globalThis.api = { ...modules["server/creatures.mjs"], ...modules["server/raid-combat-scale.mjs"], ...modules["server/combat.mjs"], ...modules["server/creature-attack-role.mjs"], ...modules["server/combat-position.mjs"] }; })();', context);
  surfaces.push([name, context.api]);
}

function fixture(api) {
  const colony = { id:1, ownerId:"owner", tribe:"bean", x:8, y:8, occupiedCells:new Set(["2,2"]) };
  const room = { seed:7, simSeconds:0, world:{ seed:7, size:64, generationVersion:38, sites:[[10,10]],
    terrain:new Uint8Array(4096).fill(4), hazards:new Uint8Array(4096), encounters:[],
    burrows:[{ id:"home", type:"large", x:44, y:10, width:3, height:1, entrance:{ x:45, y:11 } }] },
    colonies:[colony], food:new Map(), games:new Map([["owner", { agents:[], nest:{ health:100 } }]]) };
  const system = api.createCreatures(room, null);
  room.creatureSystem = system;
  return { room, system };
}

for (const [name, api] of surfaces) {
  if (!api.createCreatures) {
    test(name + ": combat helpers use the species role for raiders", () => {
      const base = unitCombatStats("spiny-back-beetle");
      const raider = { species:"spiny-back-beetle", stats:{ ...base }, health:130 };
      prepareRaidCreature(raider, 300);
      assert.equal(api.creatureAttackMode(raider, 2), "ranged");
      assert.equal(api.creatureAttackMode(raider, .5), "melee");
      assert.equal(api.combatPositionRole(raider), "back");
      assert.equal(api.combatDisposition(raider), "aggressive");
    });
    continue;
  }
  test(name + ": every raid wave uses its wild species stats at every departure time", () => {
    for (const time of [300,479.999,480,719.999,720,1080,1500,1800,2100,2400,100000]) {
      const {room,system}=fixture(api);
      room.simSeconds=time;
      const {raiders}=system.spawnRaid(1);
      for(const agent of system.agents.filter(entry=>raiders.includes(entry.id))) {
        const expected=unitCombatStats(agent.species);
        for(const [key,value] of Object.entries(expected)) assert.equal(JSON.stringify(agent.stats[key]),JSON.stringify(value),name+":"+time+":"+key);
        assert.equal(agent.raidCombatScale,undefined);
      }
    }
  });
  test(name + ": natural sorties progress through mole, beetle and boar without replenishment", () => {
    const { room, system } = fixture(api), first = system.save().raidCooldowns[0].nextRaidAt;
    const population = system.agents.length;
    room.simSeconds = 299.999; system.tick();
    assert.equal(system.agents.filter(agent => agent.raid).length, 0);
    for (const [time, species, next] of [[first,"soil-mole",480], [480,"spiny-back-beetle",720], [720,"soil-boar",795]]) {
      room.simSeconds = time; system.tick();
      const raider = system.agents.find(agent => agent.health > 0 && agent.raid);
      assert.ok(raider);
      assert.equal(raider.species, species);
      assert.equal(api.combatDisposition(raider), "aggressive");
      assert.equal(system.save().raidCooldowns[0].nextRaidAt, next);
      assert.ok(system.agents.length <= population);
      system.receiveDamage(raider, raider.health);
      room.simSeconds = next - .001; system.tick();
      assert.equal(system.agents.filter(agent => agent.health > 0 && agent.raid).length, 0);
    }
    room.simSeconds = 2000; system.tick();
    assert.equal(system.agents.filter(agent => agent.health > 0 && agent.raid).length, 0);
  });

  test(name + ": species role and fractional injury survive later-time restore and retirement", () => {
    const { room, system } = fixture(api);
    room.simSeconds = system.save().raidCooldowns[0].nextRaidAt; system.tick();
    const raider = system.agents.find(agent => agent.raid);
    const base=unitCombatStats("soil-mole");
    assert.equal(raider.stats.health, base.health);
    assert.equal(raider.stats.attackPower, base.attackPower);
    assert.equal(api.creatureAttackMode(raider, 2), "ranged");
    assert.equal(api.creatureAttackMode(raider, .5), "melee");
    assert.equal(api.combatPositionRole(raider), "back");
    assert.equal(api.combatDisposition({ species:"soil-mole" }), "peaceful");
    system.receiveDamage(raider, base.health*.25);
    const saved = structuredClone(system.save());
    room.simSeconds = 2400;
    const restored = api.createCreatures(room, saved), resumed = restored.agents.find(agent => agent.id === raider.id);
    assert.equal(resumed.species, "soil-mole");
    assert.ok(Math.abs(resumed.health-base.health*.75)<1e-8);
    assert.equal(resumed.stats.health, base.health);
    const retired = structuredClone(restored.save());
    delete retired.agents.find(agent => agent.id === raider.id).raid;
    const again = api.createCreatures(room, retired).agents.find(agent => agent.id === raider.id);
    assert.ok(Math.abs(again.health-base.health*.75)<1e-8);
    assert.equal(again.stats.attackPower, base.attackPower);
    assert.equal(again.species, "soil-mole");
  });

  test(name + ": cheat waves use the current species and corpses keep their identity", () => {
    for (const [time, species] of [[0,"soil-mole"], [480,"spiny-back-beetle"], [720,"soil-boar"]]) {
      const { room, system } = fixture(api);
      room.simSeconds = time;
      const schedules = JSON.stringify(system.save().raidCooldowns);
      const { raiders } = system.spawnRaid(1);
      const units = system.agents.filter(agent => raiders.includes(agent.id));
      assert.equal(units.length, 3);
      assert.ok(units.every(agent => agent.species === species));
      assert.equal(JSON.stringify(system.save().raidCooldowns), schedules);
      system.receiveDamage(units[0], units[0].health);
      room.simSeconds += 1.5; system.tick();
      assert.equal(room.food.get("corpse:" + units[0].id)?.species, species);
    }
  });
}

test("species boundaries preserve injury without creating a difficulty marker", () => {
  for(const [index,stage] of RAID_CREATURE_STAGES.entries()) {
    const base=unitCombatStats("spiny-back-beetle"),agent={species:"spiny-back-beetle",stats:{...base},health:base.health/2,attributes:{}};
    assert.equal(prepareRaidCreature(agent,stage.at),index);
    const expected=unitCombatStats(stage.species);
    assert.equal(agent.species,stage.species);
    assert.equal(agent.health,expected.health/2);
    assert.equal(combatProfile(agent).attackPower,expected.attackPower);
    assert.deepEqual(agent.stats.combat,expected.combat);
    assert.equal(agent.raidCombatScale,undefined);
    if(index>0) assert.equal(prepareRaidCreature(agent,stage.at-.001),index-1);
  }
});
