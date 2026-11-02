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

function fixture(create, tribe) {
  const size = 24, slots = ["butchery"], attributes = attributeCounts(slots), stats = unitStats(attributes, tribe);
  const agent = { id: "collector", tribe, x: 10, y: 10, slots, attributes, stats, health: stats.health, cost: 5,
    carrying: 0, carryingType: null, bornAt: 0, lifespan: 180, stepCount: 0, mode: "approach",
    visited: new Set(), preciseHarvestTimes: new Map(), personality: { boldness: .5, aggression: .5, curiosity: .5 } };
  const dew = { key: "10,10", x: 10, y: 10, amount: 100, resourceType: "dew" };
  const corpse = { key: "corpse:nearby", id: "corpse:nearby", x: 11, y: 10, amount: 4,
    kind: "corpse", resourceType: "nutrients", diedAt: 0, decaysAt: 300 };
  const state = { simSeconds: 0, nestLevel: 2, evolutionPoints: 100, colonyFood: 0, agents: [agent],
    explored: new Set(Array.from({ length: size * size }, (_, index) => index)),
    knownFood: new Map([[dew.key, dew], [corpse.key, corpse]]), markers: [], resourceInventory: {} };
  let blocked = false, space = 100;
  const ai = create({ state, size, tribe, homeCells: () => [{ x: 8, y: 10 }], deliveryCells: () => [{ x: 8, y: 10 }],
    walkable: x => !blocked || x !== 11, terrainAt: () => 4, hazardAt: () => 0, enemies: () => [], synergy: () => false,
    canHarvest: (food, unit) => canHarvestResource(food, { generationVersion: 37 }, unit.attributes, tribe),
    resourceType: cell => cell.resourceType, isFood: type => isColonyFood(type, tribe, 37),
    materialSpace: () => 100, deliveryCapacity: () => space });
  const retain = food => { agent.utility = { action: "collect", target: { x: food.x, y: food.y, key: food.key }, plannedCargo: 1 }; };
  return { ai, agent, state, dew, corpse, retain, block() { blocked = true; }, fill() { space = 0; } };
}

for (const [surface, create] of surfaces) {
  test(surface + ": 사체는 알려진 음식에 남아도 채집 후보가 아니며 이슬을 계속 채집한다", () => {
    const f = fixture(create, "spring");
    const candidates = f.ai.evaluate(f.agent, false);
    assert.equal(candidates[0]?.target.key, f.dew.key);
    assert.ok(candidates.every(candidate => candidate.target.key !== f.corpse.key));
    f.retain(f.corpse);
    assert.ok(f.ai.evaluate(f.agent, true).every(candidate => candidate.target.key !== f.corpse.key));
  });
}
