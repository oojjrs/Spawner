import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";
import { createUnitIndex } from "./unit-index.mjs";
import { prepareRaidCreature } from "./raid-combat-scale.mjs";
import { unitCombatStats, combatProfile, combatDamage } from "./combat-stats.mjs";

const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const decisionWorker = JSON.parse(worker.match(/^globalThis.SpawnerDecisionWorkerSource = ("[^\n]+");/)[1]);
const surfaces = [["source", { createGame, createCreatures, createUnitIndex }]];
for (const [name, source, entry] of [["game worker", worker, "client/worker.mjs"], ["decision worker", decisionWorker, "client/decision-worker.mjs"]]) {
  const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(source.slice(0, source.indexOf('modules["' + entry + '"]')) +
    'globalThis.api = { ...modules["server/game.mjs"], ...modules["server/creatures.mjs"], ...modules["server/unit-index.mjs"] }; })();', context);
  surfaces.push([name, context.api]);
}

function fixture(api) {
  const colony = { id: 1, ownerId: "owner", tribe: "bean", x: 8, y: 8,
    occupiedCells: new Set(Array.from({ length: 25 }, (_, i) => i % 5 + "," + Math.floor(i / 5))) };
  const room = { seed: 7, simSeconds: 0, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map(),
    world: { size: 40, seed: 7, generationVersion: 37, sites: [[10, 10]], terrain: new Uint8Array(1600).fill(4),
      hazards: new Uint8Array(1600), encounters: [],
      burrows: [{ id: "home", type: "large", x: 30, y: 10, width: 3, height: 1, entrance: { x: 31, y: 11 } }] } };
  const game = api.createGame(room, colony);
  room.games.set(colony.ownerId, game);
  game.agents.splice(0);
  return { api, room, game };
}

function tick(f, time, elapsed) {
  f.room.simSeconds = time;
  f.game.prepare(time);
  f.game.tick(elapsed);
}

for (const [surface, api] of surfaces) {
  test(surface + ": nest recovery waits after damage and integrates only elapsed simulation time", () => {
    const f = fixture(api);
    f.game.receiveNestDamage(50);
    tick(f, 15, 15);
    assert.equal(f.game.nest.health, 50);
    tick(f, 16, 1);
    assert.equal(f.game.nest.health, 50.5);
    tick(f, 16, 1);
    assert.equal(f.game.nest.health, 50.5);
    tick(f, 100, 0);
    assert.equal(f.game.nest.health, 50.5);
    tick(f, 101, 1);
    assert.equal(f.game.nest.health, 51);
  });
  test(surface + ": repeated attacks interrupt recovery and invalid damage does not", () => {
    const f = fixture(api);
    f.game.receiveNestDamage(50);
    tick(f, 10, 10);
    f.game.receiveNestDamage(1);
    tick(f, 20, 10);
    assert.equal(f.game.nest.health, 49);
    for (const amount of [0, -1, Infinity, NaN]) f.game.receiveNestDamage(amount);
    tick(f, 26, 6);
    assert.equal(f.game.nest.health, 49.5);
  });
  test(surface + ": recovery is capped at each level and never revives destroyed nests", () => {
    for (const [level, maximum] of [[1, 100], [2, 200], [3, 400], [4, 800]]) {
      const f = fixture(api), saved = JSON.parse(f.game.save());
      Object.assign(saved.state, { nestLevel: level, nestHealth: maximum / 2, nestDamagedAt: 0 });
      f.game.restore(JSON.stringify(saved));
      tick(f, 25, 25);
      assert.ok(Math.abs(f.game.nest.health - maximum * .55) < 1e-9);
      tick(f, 500, 475);
      assert.equal(f.game.nest.health, maximum);
      f.game.receiveNestDamage(maximum);
      tick(f, 1000, 500);
      assert.equal(f.game.nest.health, 0);
    }
  });
  test(surface + ": save restore keeps the damage cooldown without adding offline recovery", () => {
    const f = fixture(api);
    tick(f, 10, 10);
    f.game.receiveNestDamage(50);
    tick(f, 20, 10);
    const saved = f.game.save();
    f.game.restore(saved);
    tick(f, 25, 5);
    assert.equal(f.game.nest.health, 50);
    tick(f, 26, 1);
    assert.equal(f.game.nest.health, 50.5);
    const old = JSON.parse(saved);
    delete old.state.nestDamagedAt;
    f.game.restore(JSON.stringify(old));
    tick(f, 35, 15);
    assert.equal(f.game.nest.health, 50);
    tick(f, 36, 1);
    assert.equal(f.game.nest.health, 50.5);
  });
  test(surface + ": a finished game keeps its final nest health", () => {
    const f = fixture(api), saved = JSON.parse(f.game.save());
    Object.assign(saved.state, { nestHealth: 50, nestDamagedAt: 0,
      ending: { result: "defeat", endedAt: 20, evolutionPoints: 0, colonyFood: 0 } });
    f.game.restore(JSON.stringify(saved));
    tick(f, 100, 100);
    assert.equal(f.game.nest.health, 50);
  });
  if (!api.createCreatures) continue;
  test(surface + ": actual dispatch and restore use the species baseline", () => {
    const f = fixture(api);
    f.room.creatureSystem = api.createCreatures(f.room, null);
    f.room.creatureSystem.save().raidCooldowns[0].nextRaidAt = 300;
    f.room.simSeconds = 360;
    f.game.prepare(360);
    f.room.creatureSystem.tick();
    const agent = f.room.creatureSystem.agents.find(unit => unit.raid);
    assert.ok(agent);
    const base=unitCombatStats("soil-mole");
    assert.equal(agent.raidCombatScale, undefined);
    assert.equal(agent.stats.health, base.health);
    assert.equal(agent.stats.attackPower, base.attackPower);
    f.room.creatureSystem.receiveDamage(agent, base.health*.25);
    const saved = JSON.parse(JSON.stringify(f.room.creatureSystem.save()));
    f.room.creatureSystem = api.createCreatures(f.room, saved);
    const restored = f.room.creatureSystem.agents.find(unit => unit.id === agent.id);
    assert.ok(Math.abs(restored.health-base.health*.75)<1e-8);
    assert.equal(restored.stats.health, base.health);
    assert.equal(restored.stats.attackPower, base.attackPower);
  });
  for (const indexed of [false, true]) {
    function raid(phase) {
      const f = fixture(api);
      f.room.creatureSystem = api.createCreatures(f.room, null);
      const agent = f.room.creatureSystem.agents[0];
      Object.assign(agent, { x: 20, y: 10, renderFromX: 20, renderFromY: 10, mode: "idle", moveDuration: 0,
        nextActionAt: 300, raid: { colonyId: 1, phase, departedAt: 300 } });
      f.room.simSeconds = 300;
      f.game.prepare(300);
      for (const cooldown of f.room.creatureSystem.save().raidCooldowns) cooldown.nextRaidAt = 1000;
      return { ...f, agent };
    }
    function target(f, x, y) {
      const agent = { id: "worker", ownerId: "owner", x, y, health: 10, attributes: {}, combatDisposition: "peaceful",
        stats: { health: 10, speed: 1, attack: 1, vision: 1 }, moveStartedAt: 0, moveDuration: 0 };
      f.game.agents.push(agent);
      return agent;
    }
    function creatures(f) {
      f.room.unitIndex = indexed ? api.createUnitIndex(f.room) : null;
      f.room.creatureSystem.tick();
    }
    test(surface + ": outbound raider pursues a visible worker before marching (" + indexed + ")", () => {
      const f = raid("outbound"), worker = target(f, 20, 11);
      creatures(f);
      assert.equal(f.agent.pursuitTargetId, worker.id);
      assert.equal(f.agent.y, 11);
      assert.equal(f.agent.raid.phase, "outbound");
      worker.hidden = true;
      f.room.simSeconds += f.agent.moveDuration;
      creatures(f);
      assert.equal(f.agent.pursuitTargetId, null);
      assert.equal(f.agent.x, 19);
    });
    test(surface + ": hidden and out-of-sight units do not reveal themselves to marching raiders (" + indexed + ")", () => {
      for (const hidden of [false, true]) {
        const f = raid("outbound"), worker = target(f, 20, hidden ? 13 : 15);
        worker.hidden = hidden;
        creatures(f);
        assert.equal(f.agent.pursuitTargetId, null);
        assert.equal(f.agent.x, 19);
      }
    });
    test(surface + ": active raider prefers a reachable worker over the adjacent nest (" + indexed + ")", () => {
      const f = raid("active");
      Object.assign(f.agent, { x: 13, y: 10, renderFromX: 13, renderFromY: 10 });
      const worker = target(f, 13, 11);
      creatures(f);
      assert.equal(f.agent.pursuitTargetId, worker.id);
      assert.equal(f.agent.attack?.targetKind, undefined);
      assert.equal(f.game.nest.health, 100);
    });
    test(surface + ": a raider still attacks an undefended nest (" + indexed + ")", () => {
      const f = raid("active");
      Object.assign(f.agent, { x: 13, y: 10, renderFromX: 13, renderFromY: 10 });
      creatures(f);
      assert.equal(f.agent.attack?.targetKind, "nest");
      f.room.simSeconds = f.agent.attack.hitAt;
      creatures(f);
      assert.ok(f.game.nest.health < 100);
    });
  }
}

test("raid attacks use canonical unit damage at every species stage", () => {
  for(const time of [300,480,720,2400]) {
    const base=unitCombatStats("spiny-back-beetle"),agent={species:"spiny-back-beetle",health:base.health,stats:{...base},attributes:{}};
    prepareRaidCreature(agent,time);
    const expected=unitCombatStats(agent.species),wild={species:agent.species,health:expected.health,stats:{...expected},attributes:{}};
    const target={health:10,stats:{health:10,defense:0},attributes:{}};
    assert.equal(agent.health,expected.health);
    assert.equal(combatProfile(agent).attackPower,expected.attackPower);
    assert.equal(combatDamage(agent,target,.5),combatDamage(wild,target,.5));
  }
});
