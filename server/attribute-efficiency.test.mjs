
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { attributeCounts, attributeUpgradeCost, birthCost, unitCarryCapacity, unitStats, unitTravelSpeed } from "./attributes.mjs";
import { resourceHarvestMultiplier } from "./resources.mjs";
import { createGame } from "./game.mjs";
import { applyAgentGrowth } from "./growth.mjs";

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

const speeds = { bean: [.5, .4], spore: [.5, .4], pebble: [.35, .3], spring: [.9, .275] };
const prices = { bean: [3, 5, 8, 12, 17], spore: [2, 3, 5, 8, 12], pebble: [4, 7, 11, 16, 22], spring: [3, 5, 7, 10, 14] };

test("네 종족의 단속성 개체는 실제 생산비와 정해진 개별 효과를 적용한다", () => {
  for (const tribe of Object.keys(native)) {
    const plain = fixture(tribe, [], 1, 8, false).agent;
    assert.equal(plain.cost, prices[tribe][0], tribe);
    assert.equal(plain.stats.capacity, 1, tribe);
    assert.equal(plain.stats.vision, 3, tribe);
    assert.equal(plain.lifespan, 180, tribe);
    for (const key of ["strength", "feet", "lifespan", native[tribe][1]]) {
      const { agent } = fixture(tribe, [key], 1, 8, false);
      const context = tribe + ":" + key;
      assert.equal(agent.cost, prices[tribe][1], context);
      assert.equal(agent.level, 1, context);
      assert.equal(agent.stats.capacity, key === "strength" ? 2 : 1, context);
      assert.ok(Math.abs(agent.stats.speed - speeds[tribe][0] - (key === "feet" ? .3 : 0)) < 1e-12, context);
      assert.equal(agent.lifespan, key === "lifespan" ? (tribe === "pebble" ? 360 : 300) : 180, context);
      assert.equal(resourceHarvestMultiplier(native[tribe][0], agent.attributes, tribe), key === native[tribe][1] ? .75 : 1, context);
    }
  }
});

test("복합 속성 개체는 개수별 생산비와 개별 효과만 적용하고 추가 시너지를 얻지 않는다", () => {
  for (const tribe of Object.keys(native)) {
    for (const slots of [["strength", "feet"], ["strength", "feet", "lifespan"], ["strength", "feet", native[tribe][1]]]) {
      const { agent } = fixture(tribe, slots, 1, 12, false);
      const context = tribe + ":" + slots.join(",");
      assert.equal(agent.cost, prices[tribe][slots.length], context);
      assert.equal(agent.stats.capacity, 2, context);
      assert.ok(Math.abs(agent.stats.speed - speeds[tribe][0] - .3) < 1e-12, context);
      assert.ok(Math.abs(unitTravelSpeed(agent, 2, native[tribe][0]) - speeds[tribe][1] - .3) < 1e-12, context);
      assert.equal(agent.stats.vision, 3, context);
      assert.equal(agent.stats.movementMultiplier, 1, context);
      assert.equal(agent.stats.harvestSpeedMultiplier, 1, context);
      assert.equal(agent.lifespan, slots.includes("lifespan") ? (tribe === "pebble" ? 360 : 300) : 180, context);
      assert.equal(resourceHarvestMultiplier(native[tribe][0], agent.attributes, tribe), slots.includes(native[tribe][1]) ? .75 : 1, context);
    }
  }
});

test("이전 강화 설계는 1단계로 생산하고 개체 숙성은 10레벨에서 멈춘다", () => {
  const slots = ["strength", "feet", "lifespan"];
  const baseline = fixture("bean", slots, 1, 12, false).agent;
  for (const grade of [1, 2, 3, 4]) {
    const { game, agent } = fixture("bean", slots, grade, 12, false);
    assert.deepEqual(agent.attributeLevels, { strength: 1, feet: 1, lifespan: 1 });
    assert.deepEqual(agent.stats, baseline.stats);
    assert.equal(agent.cost, 12);
    const template = JSON.parse(game.save()).state.templates[0];
    assert.deepEqual(template.attributeLevels, { strength: 1, feet: 1, lifespan: 1 });
    for (const key of slots) for (const targetLevel of [2, 3, 4]) assert.equal(attributeUpgradeCost(key, targetLevel), null);
    agent.growthActivity = Number.MAX_SAFE_INTEGER;
    applyAgentGrowth(agent, 0);
    assert.equal(agent.level, 10);
    assert.deepEqual(agent.activeSlots, slots);
    assert.equal(agent.lifespan, baseline.lifespan);
    const matureStats = { ...agent.stats };
    assert.equal(applyAgentGrowth(agent, 1), false);
    assert.deepEqual(agent.stats, matureStats);
  }
});

test("감지 조합은 정해진 시야와 생산비로 상시 시야 밖 지형을 실제 탐색한다", t => {
  const results = [];
  for (const slots of [[], ["antenna"], ["antenna", "feet"], ["antenna", "feet", "lifespan"]]) {
    const f = fixture("bean", slots, 1, 0, true);
    const initial = new Set(f.game.snapshot().explored);
    assert.equal(f.agent.stats.vision, slots.includes("antenna") ? 6 : 3);
    assert.equal(f.agent.cost, prices.bean[slots.length]);
    for (let step = 1; step <= f.agent.lifespan * 5; step++) {
      const time = step / 5;
      f.environment.simSeconds = time;
      f.game.prepare(time);
      f.game.tick(.2);
      if (time > 5 && f.agent.mode === "wait") break;
    }
    const area = f.game.snapshot().explored.filter(index => {
      const x = index % 320 - 42, y = Math.floor(index / 320) - 42;
      return !initial.has(index) && x * x + y * y > 36 && x * x + y * y < 900;
    }).length;
    assert.ok(area > 0 && area <= 2696, slots.join(",") + ":" + area);
    results.push({ slots, area, cost: f.agent.cost });
  }
  t.diagnostic(JSON.stringify(results));
});

test("생산비는 종족별 장착 속성 개수로 정하고 강화 단계는 반영하지 않는다", () => {
  const slots = ["strength", "feet", "lifespan"];
  assert.deepEqual([1, 2, 3, 4].map(grade => birthCost({ slots, attributeLevels: Object.fromEntries(slots.map(key => [key, grade])) }, "bean")),
    [12, 12, 12, 12]);
  assert.equal(birthCost({ slots, attributeLevels: { strength: 4, feet: 1, lifespan: 1 } }, "bean"), 12);
  assert.equal(birthCost({ slots: [] }, "bean"), 3);
  const prices = { bean: [3, 5, 8, 12, 17], spring: [3, 5, 7, 10, 14], pebble: [4, 7, 11, 16, 22], spore: [2, 3, 5, 8, 12] };
  for (const tribe of Object.keys(native)) for (let count = 0; count <= 4; count++) for (let grade = 1; grade <= 4; grade++) {
    const slots = ["strength", "feet", "lifespan", "antenna"].slice(0, count);
    const cost = birthCost({ slots, attributeLevels: Object.fromEntries(slots.map(key => [key, grade])) }, tribe);
    assert.equal(cost, prices[tribe][count], tribe + ":" + count + ":" + grade);
  }
});

test("운반량은 채집량 증가 유무만 반영하고 서버·브라우저·워커의 종족별 적재 속도가 일치한다", () => {
  const source = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
  const browser = {};
  runInNewContext(source, browser);
  const workerSource = JSON.parse(source.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const worker = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(workerSource.slice(0, workerSource.indexOf('modules["client/worker.mjs"]')) +
    'globalThis.rules = modules["server/attributes.mjs"]; })();', worker);
  for (const rules of [{ unitStats, unitCarryCapacity, unitTravelSpeed }, browser.Spawner, worker.rules]) {
    for (const tribe of Object.keys(native)) for (const key of ["excavation", "blade", "piercing", "butchery"]) {
      for (let strength = 0; strength <= 4; strength++) for (const feet of [0, 1]) {
        const capacity = strength > 0 ? 2 : 1;
        const attributes = { [key]: 1, strength, feet };
        const agent = { tribe, attributes, stats: rules.unitStats(attributes, tribe), carryingType: "clay" };
        const emptySpeed = speeds[tribe][0] + (feet ? .3 : 0);
        const loadedSpeed = speeds[tribe][1] + (feet ? .3 : 0);
        for (const resourceType of ["clay", "sand", "tree", "grass-fiber", "pebbles", "iron-ore", "copper-ore", "quartz", "dew", "nutrients"]) {
          const context = tribe + ":" + key + ":" + strength + ":" + feet + ":" + resourceType;
          assert.equal(rules.unitCarryCapacity(agent, resourceType), capacity, context);
          for (const [load, expected] of [[0, emptySpeed], [capacity / 2, (emptySpeed + loadedSpeed) / 2], [capacity, loadedSpeed], [capacity + 1, loadedSpeed]]) {
            assert.ok(Math.abs(rules.unitTravelSpeed(agent, load, resourceType) - expected) < 1e-12, context + ":" + load);
          }
        }
        agent.carryingType = null;
        assert.equal(rules.unitCarryCapacity(agent), capacity);
      }
    }
  }
});
