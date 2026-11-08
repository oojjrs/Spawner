import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createCreatures } from "./creatures.mjs";
import { prepareRaidCreature, applyRaidCombatScale, RAID_CREATURE_STAGES } from "./raid-combat-scale.mjs";
import { combatDisposition } from "./combat.mjs";
import { dnaUnitStats } from "./dna-unit.mjs";
import { startingWorkerDna } from "./tribe-start.mjs";
import { unitCombatStats, combatProfile } from "./combat-stats.mjs";
import { creatureAttackMode } from "./creature-attack-role.mjs";
import { combatPositionRole } from "./combat-position.mjs";

const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const decision = JSON.parse(worker.match(/^globalThis.SpawnerDecisionWorkerSource = ("[^\n]+");/)[1]);
const surfaces = [["source", { createCreatures, prepareRaidCreature, applyRaidCombatScale, combatDisposition, creatureAttackMode, combatPositionRole }]];
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
    test(name + ": combat helpers preserve the opening melee role", () => {
      const base = unitCombatStats("spiny-back-beetle");
      const raider = { species:"spiny-back-beetle", stats:{ ...base }, health:130 };
      prepareRaidCreature(raider, 300);
      assert.equal(api.creatureAttackMode(raider, 2), null);
      assert.equal(api.creatureAttackMode(raider, .5), "melee");
      assert.equal(api.combatPositionRole(raider), "middle");
      assert.equal(api.combatDisposition(raider), "aggressive");
    });
    continue;
  }
  test(name + ": three or four starting workers defeat the first raider in every tribe without casualties", () => {
    for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const count of [3, 4]) for (const seed of [1, 12, 24]) {
      const { room, system } = fixture(api);
      let randomState = seed;
      room.combatRandom = room.damageRandom = () => ((randomState = Math.imul(1664525, randomState) + 1013904223 >>> 0) / 4294967296);
      room.simSeconds = system.save().raidCooldowns[0].nextRaidAt; system.tick();
      const raider = system.agents.find(agent => agent.raid), startedAt = room.simSeconds;
      const workers = Array.from({ length:count }, (_, index) => {
        const dna = startingWorkerDna(tribe), stats = dnaUnitStats(dna, tribe);
        return { id:"worker:" + index, ownerId:"owner", tribe, dna, stats, health:stats.health,
          attributes:{}, x:20, y:20, moveStartedAt:0, moveDuration:0, mode:"idle" };
      });
      Object.assign(raider, { x:20, y:20, renderFromX:20, renderFromY:20, moveStartedAt:0, moveDuration:0 });
      const game = room.games.get("owner");
      game.agents = workers;
      game.receiveDamage = (agent, damage) => { agent.health = Math.max(0, agent.health - damage); };
      const combat = room.combatSystem;
      assert.equal(combat.engage(raider, workers[0], startedAt), true);
      let seconds = 0;
      for (; seconds < 35 && raider.health > 0 && workers.some(agent => agent.health > 0); seconds += .05) {
        room.simSeconds = startedAt + seconds;
        combat.update(raider, room.simSeconds);
        for (const agent of workers) combat.update(agent, room.simSeconds);
      }
      const context = tribe + "/" + count + "/" + seed;
      assert.equal(raider.health, 0, context);
      assert.ok(workers.every(agent => agent.health / agent.stats.health >= .35), context);
      assert.ok(seconds <= 35, context);
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

  test(name + ": opening melee role, injury and species survive later-time restore and retirement", () => {
    const { room, system } = fixture(api);
    room.simSeconds = system.save().raidCooldowns[0].nextRaidAt; system.tick();
    const raider = system.agents.find(agent => agent.raid);
    assert.equal(raider.stats.health, 16);
    assert.equal(raider.stats.attackPower, .75);
    assert.equal(api.creatureAttackMode(raider, 2), null);
    assert.equal(api.creatureAttackMode(raider, .5), "melee");
    assert.equal(api.combatPositionRole(raider), "middle");
    assert.equal(api.combatDisposition({ species:"soil-mole" }), "peaceful");
    system.receiveDamage(raider, 4);
    const saved = structuredClone(system.save());
    room.simSeconds = 2400;
    const restored = api.createCreatures(room, saved), resumed = restored.agents.find(agent => agent.id === raider.id);
    assert.equal(resumed.species, "soil-mole");
    assert.equal(resumed.health, 12);
    assert.equal(resumed.stats.health, 16);
    const retired = structuredClone(restored.save());
    delete retired.agents.find(agent => agent.id === raider.id).raid;
    const again = api.createCreatures(room, retired).agents.find(agent => agent.id === raider.id);
    assert.equal(again.health, 12);
    assert.equal(again.stats.attackPower, .75);
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

test("new cohort boundaries preserve injury and old version-one through three beetles", () => {
  for (const [index, stage] of RAID_CREATURE_STAGES.entries()) {
    const base = unitCombatStats("spiny-back-beetle");
    const agent = { species:"spiny-back-beetle", stats:{ ...base }, health:65, attributes:{} };
    prepareRaidCreature(agent, stage.at);
    assert.equal(agent.raidCombatScale.stage, index);
    assert.equal(agent.species, stage.species);
    assert.equal(agent.health, stage.health / 2);
    assert.equal(combatProfile(agent).attackPower, stage.power);
    assert.equal(agent.stats.combat.power, stage.power);
    const saved = structuredClone(agent);
    for (let repeat = 0; repeat < 3; repeat++) applyRaidCombatScale(agent);
    assert.deepEqual(agent, saved);
    agent.health = 0; applyRaidCombatScale(agent); assert.equal(agent.health, 0);
    if (index > 0) {
      prepareRaidCreature(agent, stage.at - .001);
      assert.equal(agent.raidCombatScale.stage, index - 1);
    }
  }
  for (const [version, maximum, power] of [[1,26,1.8], [2,26,1.8], [3,13,.45]]) {
    const agent = { species:"spiny-back-beetle", stats:{ ...unitCombatStats("spiny-back-beetle"), health:maximum },
      health:maximum / 2, attributes:{}, raidCombatScale:{ version, stage:0 } };
    applyRaidCombatScale(agent);
    assert.equal(agent.species, "spiny-back-beetle");
    assert.equal(agent.health, maximum / 2);
    assert.ok(Math.abs(agent.stats.attackPower - power) < 1e-9);
  }
});
