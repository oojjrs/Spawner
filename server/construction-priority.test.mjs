import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createUtilityAI } from "./utility.mjs";
import { attributeCounts, unitStats } from "./attributes.mjs";
import { canHarvestResource, isColonyFood } from "./resources.mjs";

const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const decisionWorker = JSON.parse(worker.match(/^globalThis.SpawnerDecisionWorkerSource = ("[^\n]+");/)[1]);
const surfaces = [["소스", createUtilityAI]];
for (const [name, source, entry] of [["게임 워커", worker, "client/worker.mjs"], ["판단 워커", decisionWorker, "client/decision-worker.mjs"]]) {
  const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(source.slice(0, source.indexOf('modules["' + entry + '"]')) +
    'globalThis.createAI = modules["server/utility.mjs"].createUtilityAI; })();', context);
  surfaces.push([name, context.createAI]);
}

function fixture(create, tribe, slots) {
  const size = 24, attributes = attributeCounts(slots), stats = unitStats(attributes, tribe);
  const agent = { id: "builder", ownerId: "colony", tribe, x: 10, y: 10, slots, attributes, stats,
    health: stats.health, cost: 5, carrying: 0, carryingType: null, bornAt: 0, lifespan: 180,
    stepCount: 0, mode: "search", visited: new Set(), preciseHarvestTimes: new Map(),
    personality: { boldness: .5, aggression: 1, curiosity: 1 } };
  const state = { simSeconds: 0, nestLevel: 2, evolutionPoints: 100, colonyFood: 0, agents: [agent],
    explored: new Set(), knownFood: new Map(), markers: [], resourceInventory: {} };
  for (let y = 7; y <= 15; y++) for (let x = 7; x <= 15; x++) state.explored.add(y * size + x);
  const plans = [], enemies = [];
  const ai = create({ state, size, tribe, homeCells: () => [{ x: 8, y: 10 }], deliveryCells: () => [{ x: 8, y: 10 }],
    walkable: () => true, terrainAt: () => 4, hazardAt: () => 0, enemies: () => enemies, synergy: () => false,
    canHarvest: (food, unit) => canHarvestResource(food, { generationVersion: 37 }, unit.attributes, tribe),
    resourceType: food => food.resourceType, isFood: type => isColonyFood(type, tribe, 37),
    materialSpace: () => 100, deliveryCapacity: () => 100, constructionPlans: () => plans });
  const build = () => plans.push({ buildingKey: "storage", x: 11, y: 10, buildSeconds: 3, gains: { materialGain: 20 } });
  return { ai, agent, state, plans, enemies, build };
}

for (const [surface, create] of surfaces) {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    test(surface + ": " + tribe + " 변태 개체는 건설 준비 중 탐색·채집으로 새지 않고 가능해지면 건설한다", () => {
      const f = fixture(create, tribe, ["construction", "antenna", "butchery"]);
      f.agent.productionRole = "scout";
      f.agent.utility = { action: "explore", target: { x: 15, y: 10, key: "frontier:255" } };
      f.agent.suspendedWork = f.agent.utility;
      f.state.knownFood.set("corpse", { x: 10, y: 10, key: "corpse", amount: 4, resourceType: "nutrients", kind: "corpse" });
      assert.equal(f.ai.evaluate(f.agent, true).length, 0);
      f.build();
      assert.equal(f.ai.evaluate(f.agent, true)[0]?.action, "build");
    });
  }

  test(surface + ": 군사 역할이 저장된 복합 변태 개체도 비방어 공격보다 건설한다", () => {
    const f = fixture(create, "bean", ["construction", "blade", "carapace", "guard"]);
    f.agent.productionRole = "military";
    f.agent.combatDisposition = "aggressive";
    f.enemies.push({ id: "enemy", ownerId: "rival", x: 15, y: 10, health: 1, carrying: 0, attributes: {},
      stats: { health: 1, attack: .01, speed: .1, vision: 1 }, combatDisposition: "passive" });
    f.build();
    assert.equal(f.ai.evaluate(f.agent, false)[0]?.action, "build");
    f.plans.length = 0;
    assert.ok(f.ai.evaluate(f.agent, false).every(candidate => !["explore", "fight"].includes(candidate.action)));
  });

  test(surface + ": 이미 든 자원은 먼저 납품하고 빈손이 되면 건설한다", () => {
    const f = fixture(create, "bean", ["construction"]);
    f.build(); f.agent.carrying = 1; f.agent.carryingType = "clay";
    assert.equal(f.ai.evaluate(f.agent, false)[0]?.action, "return");
    f.agent.carrying = 0; f.agent.carryingType = null;
    assert.equal(f.ai.evaluate(f.agent, false)[0]?.action, "build");
  });

  test(surface + ": 퇴각·중상에서는 회복하고 건설 수명이 부족하면 대기한다", () => {
    const f = fixture(create, "bean", ["construction"]);
    f.build(); f.agent.health /= 2;
    f.agent.retreat = { startedAt: 0, recoverHealth: f.agent.stats.health, safeSince: null };
    assert.equal(f.ai.evaluate(f.agent, false)[0]?.action, "recover");
    f.agent.health = f.agent.stats.health; f.agent.retreat = null; f.agent.lifespan = 5;
    assert.equal(f.ai.evaluate(f.agent, false).length, 0);
  });

  test(surface + ": 실제 아군 방어는 건설보다 먼저 수행한다", () => {
    const f = fixture(create, "bean", ["construction", "blade", "guard"]);
    f.agent.productionRole = "military";
    f.enemies.push({ id: "attacker", ownerId: "rival", x: 11, y: 10, health: 1, carrying: 0, attributes: {},
      stats: { health: 1, attack: .01, speed: .1, vision: 1 }, combatDisposition: "aggressive",
      attack: { targetId: f.agent.id } });
    f.build();
    assert.equal(f.ai.evaluate(f.agent, false)[0]?.defending, true);
  });
}
