
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { attributeCounts, attributeUpgradeCost, birthCost, unitCarryCapacity, unitStats, unitTravelSpeed } from "./attributes.mjs";
import { createGame } from "./game.mjs";
import { applyAgentGrowth, growthThreshold } from "./growth.mjs";

const native = { bean: ["clay", "excavation"], spring: ["dew", "butchery"], pebble: ["pebbles", "piercing"], spore: ["tree", "blade"] };

function fixture(tribe, slots, grade, distance, scouting) {
  const terrain = new Uint8Array(320 * 320);
  if (scouting) terrain.fill(4);
  else {
    for (let y = 39; y <= 45; y++) for (let x = 39; x <= 46; x++) terrain[y * 320 + x] = 4;
    for (let x = 44; x <= 44 + distance; x++) terrain[40 * 320 + x] = 4;
  }
  const colony = { id: 1, ownerId: "efficiency", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { generationVersion: 23, seed: 13, terrain, hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  const levels = Object.fromEntries(slots.map(key => [key, grade]));
  Object.assign(saved.state, { agents: [], nestLevel: 4, evolutionPoints: 100, nextTemplateId: 2,
    templates: [{ id: 1, name: "효율", slots, attributeLevels: levels, unlockedAttributeLevels: levels, revision: 1 }] });
  if (!scouting) {
    saved.state.explored = { collection: "Set", entries: [] };
    for (let y = 30; y <= 60; y++) for (let x = 30; x <= 56 + distance; x++) saved.state.explored.entries.push(y * 320 + x);
    const food = { x: 44 + distance, y: 40, amount: 100000, initialAmount: 100000, resourceType: native[tribe][0], kind: "resource" };
    environment.food.set(food.x + "," + food.y, food);
    saved.state.knownFood = { collection: "Map", entries: [[food.x + "," + food.y, food]] };
  }
  game.restore(JSON.stringify(saved));
  const points = game.snapshot().evolutionPoints;
  const { agentId } = game.command({ type: "birth", templateId: 1 });
  const agent = game.agents.find(entry => entry.id === agentId);
  Object.assign(agent, { x: 44, y: 40, renderFromX: 44, renderFromY: 40, personality: { boldness: .5, aggression: .5, curiosity: .5 } });
  assert.ok(Math.abs(points - game.snapshot().evolutionPoints - agent.cost) < 1e-8);
  return { environment, game, agent };
}

function gather(tribe, slots, grade, distance, frozen) {
  const f = fixture(tribe, slots, grade, distance, false);
  let level = 1;
  for (let step = 1; step <= f.agent.lifespan * 10; step++) {
    const time = step / 10;
    if (frozen) {
      f.agent.growthActivity = growthThreshold(1);
      f.agent.level = 0;
      applyAgentGrowth(f.agent, time);
    }
    f.environment.simSeconds = time;
    f.game.prepare(time);
    f.game.tick(.1);
    level = Math.max(level, f.agent.level);
  }
  return { amount: JSON.parse(f.game.save()).state.colonyFood, cost: f.agent.cost, level };
}

test("네 종족의 채집 단속성은 자연 숙성을 포함한 생산비당 생애 성과가 무속성을 확실히 넘는다", t => {
  for (const tribe of Object.keys(native)) {
    const plain = gather(tribe, [], 1, 8, false);
    const efficiencies = {};
    for (const key of ["strength", "feet", "lifespan", native[tribe][1]]) {
      const result = gather(tribe, [key], 1, 8, false);
      const ratio = (result.amount / result.cost) / (plain.amount / plain.cost);
      assert.ok(result.level > 1, tribe + ":" + key);
      assert.ok(ratio > 1.15, tribe + ":" + key + ":" + ratio);
      efficiencies[key] = Number(ratio.toFixed(2));
    }
    t.diagnostic(JSON.stringify({ tribe, efficiencies }));
  }
});

test("관련 속성 조합은 같은 생산비 기준으로 단속성보다 생애 성과가 크게 높다", () => {
  const singles = ["strength", "feet", "lifespan"].map(key => gather("bean", [key], 1, 12, false));
  const best = Math.max(...singles.map(result => result.amount / result.cost));
  const pair = gather("bean", ["strength", "feet"], 1, 12, false);
  const triple = gather("bean", ["strength", "feet", "lifespan"], 1, 12, false);
  assert.ok(pair.amount / pair.cost > best * 1.4);
  assert.ok(triple.amount / triple.cost > pair.amount / pair.cost * 1.4);
});

test("숙성과 강화 생산비를 반영해 단계별 연구비와 재료 투자를 생애 추가 수익으로 회수한다", t => {
  const slots = ["strength", "feet", "lifespan"];
  const results = [1, 2, 3, 4].map(grade => gather("bean", slots, grade, 12, false));
  const fresh = gather("bean", slots, 4, 12, true);
  assert.ok(results[3].level > 10);
  assert.ok(results[3].amount > fresh.amount * 1.35);
  let totalResearch = 0;
  for (let grade = 2; grade <= 4; grade++) {
    const research = slots.reduce((sum, key) => {
      const cost = attributeUpgradeCost(key, grade);
      return sum + cost.evolutionPoints + Object.values(cost.materials).reduce((items, amount) => items + amount, 0) * 2;
    }, 0);
    const previous = results[grade - 2], current = results[grade - 1];
    const extraNet = current.amount - previous.amount - (current.cost - previous.cost);
    assert.ok(extraNet > 0);
    assert.ok(Math.ceil(research / extraNet) <= 5, "grade " + grade);
    totalResearch += research;
  }
  const fullExtra = results[3].amount - results[0].amount - (results[3].cost - results[0].cost);
  assert.ok(Math.ceil(totalResearch / fullExtra) <= 3);
  t.diagnostic(JSON.stringify({ results, fresh, research: totalResearch, payback: Math.ceil(totalResearch / fullExtra), materialValue: 2 }));
});

test("감지 단속성의 생애 정찰 효율과 관련 조합의 탐색량은 상시 시야 밖 실제 확보 지형으로 비교한다", t => {
  const results = [];
  for (const slots of [[], ["antenna"], ["antenna", "feet"], ["antenna", "feet", "lifespan"]]) {
    const f = fixture("bean", slots, 1, 0, true);
    for (let step = 1; step <= f.agent.lifespan * 5; step++) {
      const time = step / 5;
      f.environment.simSeconds = time;
      f.game.prepare(time);
      f.game.tick(.2);
      if (time > 5 && f.agent.mode === "wait") break;
    }
    const area = f.game.snapshot().explored.filter(index => {
      const x = index % 320 - 42, y = Math.floor(index / 320) - 42;
      return x * x + y * y > 36 && x * x + y * y < 900;
    }).length;
    results.push({ area, cost: f.agent.cost });
  }
  assert.ok(results[1].area / results[1].cost > results[0].area / results[0].cost * 1.3);
  assert.ok(results[2].area > results[1].area * 1.7);
  assert.ok(results[3].area > results[2].area * 1.2);
  assert.ok(results.every(result => result.area <= 2696));
  t.diagnostic(JSON.stringify(results));
});

test("강화 생산비는 종족별 상한까지 오르고 혼합 강화도 실제 장착 단계만 반영한다", () => {
  const slots = ["strength", "feet", "lifespan"];
  assert.deepEqual([1, 2, 3, 4].map(grade => birthCost({ slots, attributeLevels: Object.fromEntries(slots.map(key => [key, grade])) }, "bean")),
    [6, 8, 10, 12]);
  assert.equal(birthCost({ slots, attributeLevels: { strength: 4, feet: 1, lifespan: 1 } }, "bean"), 8);
  assert.equal(birthCost({ slots: [] }, "bean"), 3);
  for (const tribe of Object.keys(native)) for (let count = 0; count <= 4; count++) for (let grade = 1; grade <= 4; grade++) {
    const slots = ["strength", "feet", "lifespan", "antenna"].slice(0, count);
    const cost = birthCost({ slots, attributeLevels: Object.fromEntries(slots.map(key => [key, grade])) }, tribe);
    assert.ok(Number.isInteger(cost), tribe + ":" + count + ":" + grade);
  }
});

test("운반량은 채집량 증가만 반영하고 서버·브라우저·워커의 적재 속도가 일치한다", () => {
  const source = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
  const browser = {};
  runInNewContext(source, browser);
  const workerSource = JSON.parse(source.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const worker = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(workerSource.slice(0, workerSource.indexOf('modules["client/worker.mjs"]')) +
    'globalThis.rules = modules["server/attributes.mjs"]; })();', worker);
  for (const rules of [{ unitCarryCapacity, unitTravelSpeed }, browser.Spawner, worker.rules]) {
    for (const key of ["excavation", "blade", "piercing", "butchery"]) for (let level = 1; level <= 4; level++) {
      for (let strength = 0; strength <= 4; strength++) {
        const attributes = { [key]: level, strength };
        const agent = { tribe: "bean", attributes, stats: unitStats(attributes, "bean"), carryingType: "clay" };
        for (const resourceType of ["clay", "sand", "tree", "grass-fiber", "pebbles", "iron-ore", "copper-ore", "quartz", "dew", "nutrients"]) {
          assert.equal(rules.unitCarryCapacity(agent, resourceType), 1 + strength, key + ":" + level + ":" + resourceType);
          assert.equal(rules.unitTravelSpeed(agent, 1 + strength, resourceType), .4);
        }
        agent.carryingType = null;
        assert.equal(rules.unitCarryCapacity(agent), 1 + strength);
      }
    }
  }
});
