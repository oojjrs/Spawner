import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";
import { createUtilityAI } from "./utility.mjs";
import { combatDisposition } from "./combat.mjs";
import { dnaUnitStats, dnaAppearance, dnaCanMove } from "./dna-unit.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";

const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const decision = JSON.parse(worker.match(/^globalThis.SpawnerDecisionWorkerSource = ("[^\n]+");/)[1]);
const surfaces = [["소스", { createGame, createUtilityAI, combatDisposition }]];
for (const [name, source, entry] of [["게임 워커", worker, "client/worker.mjs"], ["판단 워커", decision, "client/decision-worker.mjs"]]) {
  const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(source.slice(0, source.indexOf('modules["' + entry + '"]')) +
    'globalThis.api = { ...modules["server/game.mjs"], ...modules["server/utility.mjs"], ...modules["server/combat.mjs"] }; })();', context);
  surfaces.push([name, context.api]);
}

function fixture(api, genes) {
  const size = 32, colony = { id: 1, ownerId: "home", tribe: "bean", x: 10, y: 10, occupiedCells: new Set(Array.from({ length: 25 }, (_, index) => index % 5 + "," + Math.floor(index / 5))) };
  const dna = { version: 4, level: 4, budget: 999, pieces: ATTRIBUTE_DNA.pack(genes.map(id => {
    const gene = ATTRIBUTE_DNA.lookup.get(id);
    return { gene: id, grade: gene.grade, rotation: 0, q: 0, r: 0 };
  }), 4) };
  const stats = dnaUnitStats(dna);
  const agent = { id: "home:1", ownerId: "home", tribe: "bean", dna, attributes: dnaAppearance(dna), stats,
    slots: [], x: 15, y: 12, health: stats.health, cost: 5, carrying: 0, stepCount: 0,
    visited: new Set(["15,12"]), path: [{ x: 15, y: 12 }], preciseHarvestTimes: new Map(),
    personality: { boldness: .5, aggression: .5, curiosity: 1 } };
  const food = { key: "16,12", x: 16, y: 12, amount: 100, resourceType: "clay" };
  const enemies = [];
  const state = { simSeconds: 0, nestLevel: 4, evolutionPoints: 30, agents: [agent], knownFood: new Map([[food.key, food]]),
    explored: new Set(Array.from({ length: size * size }, (_, index) => index)), markers: [], lastFoodAt: 0 };
  const context = { state, size, tribe: "bean", homeCells: () => [{ x: 14, y: 12 }],
    deliveryCells: () => [{ x: 14, y: 12 }], permanentVisionSources: () => [{ x: 12, y: 12, radius: 6 }],
    walkable: (x, y) => x >= 0 && y >= 0 && x < size && y < size,
    hazardAt: () => 0, enemies: () => enemies, synergy: () => false,
    canMove: (unit, x, y) => dnaCanMove(unit, x, y, [colony]),
    resourceType: food => food.resourceType, isFood: type => type === "clay", foodType: "clay",
    canHarvest: (food, unit) => unit.stats.dna.harvest > 0, harvestSeconds: () => stats.dna.harvestTime,
    materialSpace: () => 100, deliveryCapacity: () => 100 };
  return { api, ai: api.createUtilityAI(context), agent, state, context, enemies, size, colony, food };
}

function addEnemy(f) {
  const dna = { version: 4, level: 1, budget: 30, pieces: [] }, stats = dnaUnitStats(dna);
  const target = { id: "rival:1", ownerId: "rival", tribe: "bean", dna, stats, health: 1,
    x: 17, y: 12, carrying: 0, attributes: {}, slots: [] };
  f.enemies.push(target);
  return target;
}

for (const [surface, api] of surfaces) {
  test(surface + " · 채집 기관 유닛은 높은 호기심과 옛 정찰 역할에도 채집한다", () => {
    for (const genes of [["gather", "capacity"], ["gather", "capacity", "antenna"]]) {
      const f = fixture(api, genes);
      f.agent.productionRole = "scout";
      const plans = f.ai.evaluate(f.agent, false);
      assert.equal(plans[0].action, "collect");
      assert.equal(plans[0].target.key, f.food.key);
      assert.ok(plans.every(plan => plan.action !== "explore"));
    }
  });

  test(surface + " · 안테나만으로는 채집·적 수색·선공을 하지 않는다", () => {
    const f = fixture(api, ["antenna"]);
    addEnemy(f);
    assert.equal(api.combatDisposition(f.agent), "passive");
    assert.ok(f.ai.evaluate(f.agent, false).every(plan => !["collect", "fight", "explore"].includes(plan.action)));
  });

  test(surface + " · 근접·원거리 기관은 공유 시야의 적을 공격 대상으로 삼는다", () => {
    for (const genes of [["blade"], ["secretion"], ["gather", "blade"]]) {
      const f = fixture(api, genes), target = addEnemy(f);
      assert.equal(api.combatDisposition(f.agent), "aggressive");
      const plan = f.ai.evaluate(f.agent, false)[0];
      assert.equal(plan.action, "fight");
      assert.equal(plan.target.id, target.id);
      assert.ok(Math.hypot(target.x - f.agent.x, target.y - f.agent.y) > f.agent.stats.vision);
    }
  });

  test(surface + " · 안개가 전부 밝혀져도 공격 기관은 적 수색을 계속한다", () => {
    const f = fixture(api, ["blade", "antenna"]);
    const plan = f.ai.evaluate(f.agent, false)[0];
    assert.equal(plan.action, "explore");
    assert.match(plan.target.key, /^enemy-search:/);
    assert.equal(plan.informationGain, 0);
    assert.ok(plan.combatGain > 0);
    assert.ok(plan.route.length > 1);
  });

  test(surface + " · 안테나의 외부 이동은 시간·다리·생산 역할에 묶이지 않는다", () => {
    const f = fixture(api, ["blade", "antenna"]);
    f.agent.x = 25;
    f.agent.y = 24;
    f.agent.visited.clear();
    const plan = f.ai.evaluate(f.agent, false)[0];
    assert.equal(plan.action, "explore");
    assert.ok(plan.route.some(cell => cell.x > 17 || cell.y > 17));
    assert.equal(f.state.simSeconds, 0);
  });

  test(surface + " · 안테나 없는 공격 기관의 수색도 둥지 이동 범위를 지킨다", () => {
    const f = fixture(api, ["blade"]);
    const plans = f.ai.evaluate(f.agent, false);
    assert.ok(plans.length > 0);
    for (const plan of plans) for (const cell of plan.route) assert.ok(dnaCanMove(f.agent, cell.x, cell.y, [f.colony]));
  });

  test(surface + " · 다른 유닛의 안테나와 시야가 채집 담당을 정찰로 바꾸지 않는다", () => {
    const f = fixture(api, ["gather", "capacity"]);
    const other = fixture(api, ["antenna", "vision", "vision"]).agent;
    other.id = "home:2";
    f.state.agents.push(other);
    assert.equal(f.ai.evaluate(f.agent, false)[0].action, "collect");
  });

  test(surface + " · 채집 기관은 먹이를 모를 때 자원을 찾고 운반 중에는 납품한다", () => {
    const f = fixture(api, ["gather", "antenna"]);
    f.state.knownFood.clear();
    for (const index of [...f.state.explored]) if (index % f.size > 20) f.state.explored.delete(index);
    const search = f.ai.evaluate(f.agent, false)[0];
    assert.match(search.target.key, /^resource-search:/);
    f.agent.carrying = 1;
    f.agent.carryingType = "clay";
    assert.equal(f.ai.evaluate(f.agent, false)[0].action, "return");
  });

  test(surface + " · 옛 저장의 정찰 역할과 안개 탐색 목표를 복원하지 않는다", () => {
    const f = fixture(api, ["gather"]);
    const environment = { hostId: "home", simSeconds: 0, world: { size: f.size, seed: 13, terrain: new Uint8Array(f.size * f.size).fill(4), hazards: new Uint8Array(f.size * f.size) },
      colonies: [f.colony], games: new Map(), food: new Map(), foodSpots: new Map() };
    const game = api.createGame(environment, f.colony);
    environment.games.set("home", game);
    game.command({ type: "design", templateId: null, name: "호환 검사", dna: f.agent.dna, birth: false });
    const saved = JSON.parse(game.save());
    saved.state.templates[0].productionRole = "scout";
    for (const agent of saved.state.agents) {
      agent.productionRole = "scout";
      agent.utility = { action: "explore", target: { key: "frontier:0", x: 0, y: 0 }, route: [] };
    }
    game.restore(JSON.stringify(saved));
    assert.ok(game.agents.every(agent => agent.productionRole === null && agent.utility === null));
    assert.ok(game.snapshot().templates.every(template => template.productionRole !== "scout"));
  });
}
