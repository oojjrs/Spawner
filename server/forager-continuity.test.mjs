import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createUtilityAI } from "./utility.mjs";
import { createConstructionSupply } from "./construction-supply.mjs";
import { createGame } from "./game.mjs";
import { attributeCounts, unitStats, hasSynergy } from "./attributes.mjs";

const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const decisionWorker = JSON.parse(worker.match(/^globalThis.SpawnerDecisionWorkerSource = ("[^\n]+");/)[1]);
const surfaces = [["소스", { createUtilityAI, createConstructionSupply, createGame }]];
for (const [name, source, entry] of [["게임 워커", worker, "client/worker.mjs"], ["판단 워커", decisionWorker, "client/decision-worker.mjs"]]) {
  const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(source.slice(0, source.indexOf('modules["' + entry + '"]')) +
    'globalThis.testModules = { ...modules["server/utility.mjs"], ...modules["server/construction-supply.mjs"], ...modules["server/game.mjs"] }; })();', context);
  surfaces.push([name, context.testModules]);
}

function scoutFixture(create) {
  const size = 24;
  const make = (id, slots, x) => {
    const attributes = attributeCounts(slots), stats = unitStats(attributes, "bean");
    return { id, tribe: "bean", x, y: 10, slots, attributes, stats, health: stats.health, cost: 3,
      carrying: 0, carryingType: null, bornAt: 0, lifespan: 600, stepCount: 0, mode: "approach",
      visited: new Set(), preciseHarvestTimes: new Map(), personality: { boldness: .5, aggression: .5, curiosity: .5 } };
  };
  const agent = make("advanced", ["antenna", "feet", "lifespan"], 10), other = make("worker", [], 8);
  const food = { x: 5, y: 10, key: "5,10", resourceType: "clay", amount: 100 };
  const state = { simSeconds: 0, nestLevel: 3, evolutionPoints: 100, colonyFood: 0, agents: [other, agent],
    explored: new Set(Array.from({ length: size * size }, (_, index) => index).filter(index => index % size < 15)),
    knownFood: new Map([[food.key, food]]), markers: [], resourceInventory: {} };
  let assigned = true;
  const ai = create({ state, size, tribe: "bean", homeCells: () => [{ x: 8, y: 10 }], deliveryCells: () => [{ x: 8, y: 10 }],
    permanentVisionSources: () => [{ x: 8, y: 10, radius: 6 }], walkable: () => true, terrainAt: () => 4,
    hazardAt: () => 0, enemies: () => [], synergy: (unit, keys) => hasSynergy(unit.attributes, keys),
    canHarvest: () => true, resourceType: cell => cell.resourceType, isFood: type => type === "clay",
    constructionAllocation: () => ({ ids: new Set([assigned ? agent.id : other.id]), weights: new Map([[agent.id, assigned ? 1 : .05]]) }) });
  agent.utility = ai.evaluate(agent, false)[0];
  assert.equal(agent.utility?.action, "collect");
  return { ai, agent, other, state, food, release() { assigned = false; } };
}

function supplyFixture(create) {
  const attributes = attributeCounts(["strength"]), stats = unitStats(attributes, "bean");
  const agents = Array.from({ length: 4 }, (_, index) => ({ id: "worker:" + index, tribe: "bean", x: 0, y: 0,
    bornAt: 0, lifespan: 160, slots: ["strength"], attributes, stats, health: stats.health, carrying: 0, carryingType: null }));
  const food = { x: 1, y: 0, resourceType: "clay", amount: 1000 };
  const state = { simSeconds: 0, nestLevel: 2, evolutionPoints: 5.4, agents, knownFood: new Map([["1,0", food]]),
    foragerMemory: { time: 0, ids: [agents[3].id] }, resourceInventory: {}, resourceStores: [] };
  const supply = create({ state, colony: { tribe: "bean" }, storage: { refresh() {} }, walkable: () => true,
    isFood: type => type === "clay", deliveryCells: () => [{ x: 0, y: 0 }], harvestSeconds: () => 2,
    canHarvest: () => true, deliveryCapacity: () => 1000,
    route: (agent, target) => agent.x === target.x ? [{ x: agent.x, y: 0 }] : [{ x: agent.x, y: 0 }, { x: target.x, y: 0 }] });
  return { supply, state, agents };
}

for (const [surface, api] of surfaces) {
  test(surface + ": 빈손 채집 개체가 담당에서 빠져도 유효한 채집을 계속한다", () => {
    const f = scoutFixture(api.createUtilityAI);
    f.release();
    const plans = f.ai.evaluate(f.agent, true);
    assert.equal(plans[0]?.action, "collect");
    assert.equal(plans[0]?.target.key, f.food.key);
    f.agent.x = f.food.x; f.agent.mode = "harvest"; f.agent.harvestPrepared = false; f.agent.harvestReady = 1;
    assert.equal(f.ai.evaluate(f.agent, true)[0]?.action, "collect");
  });
  test(surface + ": 채집 완료 뒤에는 정찰로 재배정할 수 있다", () => {
    const f = scoutFixture(api.createUtilityAI); f.release();
    assert.equal(f.ai.evaluate(f.agent, false)[0]?.action, "explore");
  });
  test(surface + ": 고갈과 퇴각은 진행 중인 채집 유지를 해제한다", () => {
    const depleted = scoutFixture(api.createUtilityAI); depleted.release(); depleted.food.amount = 0;
    assert.ok(depleted.ai.evaluate(depleted.agent, true).every(plan => plan.action !== "collect"));
    const retreating = scoutFixture(api.createUtilityAI); retreating.release();
    retreating.agent.health /= 2;
    retreating.agent.retreat = { startedAt: 0, recoverHealth: retreating.agent.stats.health, safeSince: null };
    assert.notEqual(retreating.ai.evaluate(retreating.agent, true)[0]?.action, "collect");
  });
  test(surface + ": 새 판단 인스턴스도 이전 담당자 우대를 유지한다", () => {
    const f = supplyFixture(api.createConstructionSupply);
    const result = f.supply.allocation();
    assert.equal(result.ids.size, 1);
    assert.equal(result.ids.has(f.agents[3].id), true);
    assert.deepEqual(Array.from(f.state.foragerMemory.ids), [f.agents[3].id]);
    f.state.simSeconds = 2;
    assert.equal(f.supply.rememberForagers({ time: 2, ids: [f.agents[2].id, "dead"] }), true);
    assert.equal(f.supply.rememberForagers({ time: 1, ids: [f.agents[0].id] }), false);
    assert.equal(f.supply.rememberForagers({ time: 3, ids: [f.agents[0].id] }), false);
    assert.deepEqual(Array.from(f.supply.foragerMemory().ids), [f.agents[2].id]);
  });
  test(surface + ": 담당자 기억은 게임 저장과 복원을 통과한다", () => {
    const colony = { id: 1, ownerId: "memory", tribe: "bean", x: 10, y: 10, occupiedCells: new Set(["2,2"]) };
    const environment = { simSeconds: 0, world: { size: 32, seed: 13, generationVersion: 37,
      terrain: new Uint8Array(32 * 32).fill(4), hazards: new Uint8Array(32 * 32) },
      colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
    const game = api.createGame(environment, colony);
    const id = game.agents[0].id;
    assert.equal(game.rememberForagers({ time: 0, ids: [id] }), true);
    const restored = api.createGame(environment, colony, game.save());
    assert.deepEqual(Array.from(restored.foragerMemory.ids), [id]);
    const legacy = JSON.parse(game.save()); delete legacy.state.foragerMemory;
    restored.restore(JSON.stringify(legacy));
    assert.equal(restored.foragerMemory, null);
  });
}

test("병렬 결과가 채택될 때만 담당자 기억을 본 게임에 전달한다", () => {
  const slots = [], remembered = [];
  class Worker {
    constructor() { this.messages = []; slots.push(this); }
    postMessage(message) { this.messages.push(message); }
    terminate() {}
  }
  const context = { navigator: { hardwareConcurrency: 3 }, Worker, Blob: class {},
    URL: { createObjectURL: () => "worker", revokeObjectURL() {} } };
  const source = readFileSync(new URL("../client/decision-pool.mjs", import.meta.url), "utf8");
  runInNewContext(source.replace(/^export /gm, "") + ";globalThis.createPool = createDecisionPool;", context);
  const agent = { id: "one", x: 0, y: 0, health: 10, carrying: 0, level: 1, attributes: {} };
  const game = { agents: [agent], buildings: [], nest: {}, save: () => "saved", rememberForagers: memory => remembered.push(memory) };
  const room = { games: new Map([["owner", game]]), simSeconds: 0, world: {}, food: new Map(), colonies: [] };
  const pool = context.createPool(room);
  pool.request("owner", agent, "periodic"); pool.flush();
  const request = slots[0].messages.find(message => message.type === "plan").requests[0];
  const memory = { time: 0, ids: [agent.id] }, candidates = [{ action: "collect" }];
  slots[0].onmessage({ data: { results: [{ ...request, time: 0, candidates, foragerMemory: memory }] } });
  assert.equal(remembered.length, 0);
  assert.equal(pool.request("owner", agent, "periodic"), candidates);
  assert.equal(remembered[0], memory);
  pool.request("owner", agent, "periodic"); pool.flush();
  const next = slots[0].messages.at(-1).requests[0];
  slots[0].onmessage({ data: { results: [{ ...next, time: 0, candidates, foragerMemory: memory }] } });
  agent.x = 1;
  assert.equal(pool.request("owner", agent, "periodic"), undefined);
  assert.equal(remembered.length, 1);
  pool.dispose();
});

test("판단 워커는 후보와 함께 담당자 기억을 반환한다", () => {
  let response;
  const memory = { time: 0, ids: ["one"] }, self = {};
  const game = { prepare() {}, planDecisions: () => [[{ action: "collect" }]], foragerMemory: memory };
  const context = { self, Map, postMessage: message => { response = message; }, createGame: () => game, buildingContains: () => false };
  const source = readFileSync(new URL("../client/decision-worker.mjs", import.meta.url), "utf8").replace(/^import .*\r?\n/gm, "");
  runInNewContext(source, context);
  self.onmessage({ data: { type: "world", world: {} } });
  self.onmessage({ data: { type: "plan", owner: "owner", saved: "saved", simSeconds: 0, colonies: [{ ownerId: "owner" }],
    games: [], food: [], creatures: { agents: [], burrows: [] }, requests: [{ id: "one", key: "owner/one" }] } });
  assert.equal(response.error, undefined);
  assert.equal(response.results[0].foragerMemory, memory);
});
