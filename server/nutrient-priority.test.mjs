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
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    test(surface + ": " + tribe + " 회수 개체는 빠른 이슬보다 양분을 먼저 회수한다", () => {
      const f = fixture(create, tribe);
      assert.equal(f.ai.evaluate(f.agent, false)[0]?.target.key, f.corpse.key);
    });
  }
  test(surface + ": 기존 이슬 작업을 유지 중이어도 인접 사체로 전환한다", () => {
    const f = fixture(create, "spring"); f.retain(f.dew);
    assert.equal(f.ai.evaluate(f.agent, true)[0]?.target.key, f.corpse.key);
  });
  test(surface + ": 가까운 이슬 후보가 여섯 개를 넘어도 사체를 평가한다", () => {
    const f = fixture(create, "spring"); f.corpse.x = 13;
    for (const [x, y] of [[9, 10], [10, 9], [10, 11], [11, 10], [9, 9], [9, 11]]) {
      const key = x + "," + y;
      f.state.knownFood.set(key, { key, x, y, amount: 100, resourceType: "dew" });
    }
    assert.equal(f.ai.evaluate(f.agent, false)[0]?.target.key, f.corpse.key);
  });
  test(surface + ": 멀리 있는 사체를 향하던 빈손 개체도 옆 사체를 먼저 회수한다", () => {
    const f = fixture(create, "spring"), far = { ...f.corpse, key: "corpse:far", x: 15 };
    f.state.knownFood.set(far.key, far); f.retain(far);
    assert.equal(f.ai.evaluate(f.agent, true)[0]?.target.key, f.corpse.key);
  });
  test(surface + ": 고갈·예약·막힌 경로·적재물·보관 한도는 양분 우선에서도 지킨다", () => {
    for (const invalid of ["고갈", "예약", "경로", "적재", "한도"]) {
      const f = fixture(create, "spring");
      if (invalid === "고갈") f.corpse.amount = 0;
      if (invalid === "예약") f.state.agents.push({ ...f.agent, id: "other", utility: {
        action: "collect", target: { key: f.corpse.key }, plannedCargo: 4 } });
      if (invalid === "경로") f.block();
      if (invalid === "적재") { f.agent.carrying = 1; f.agent.carryingType = "dew"; }
      if (invalid === "한도") f.fill();
      assert.notEqual(f.ai.evaluate(f.agent, false)[0]?.target.key, f.corpse.key, invalid);
    }
  });
  test(surface + ": 양분을 구할 수 없으면 이슬을 채집하고 퇴각 중에는 회수를 우선하지 않는다", () => {
    const f = fixture(create, "spring"); f.corpse.amount = 0;
    assert.equal(f.ai.evaluate(f.agent, false)[0]?.target.key, f.dew.key);
    f.corpse.amount = 4; f.agent.health /= 2;
    f.agent.retreat = { startedAt: 0, recoverHealth: f.agent.stats.health, safeSince: null };
    assert.notEqual(f.ai.evaluate(f.agent, true)[0]?.action, "collect");
  });
}
