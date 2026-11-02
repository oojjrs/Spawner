import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { unitStats, unitTravelSpeed, unitTerrainSpeedMultiplier, attributeCounts, attributeLevelLimit, attributeUpgradeCost } from "./attributes.mjs";
import { TRIBE_UNIT_STATS, ATTRIBUTE_STAT_VALUES } from "./unit-stats.mjs";
import { applyAgentGrowth, AGENT_GROWTH_BONUSES } from "./growth.mjs";
import { createGame } from "./game.mjs";
import { materialCapacity } from "./nests.mjs";

const bases = { bean: [.5, .4], spore: [.5, .4], pebble: [.35, .3], spring: [.9, .275] };
const bonuses = [0, .3, .3, .3, .3];

function verifyTravel(rules) {
  for (const [tribe, speeds] of Object.entries(bases)) for (let level = 0; level <= 4; level++) {
    const agent = { tribe, stats: rules.unitStats({ feet: level }, tribe) };
    assert.equal("lifespan" in agent.stats, false, tribe);
    assert.ok(Math.abs(agent.stats.speed - speeds[0] - bonuses[level]) < 1e-12, tribe);
    for (const load of [0, .25, .5, 1]) {
      const expected = speeds[0] * (1 - load) + speeds[1] * load + bonuses[level];
      assert.ok(Math.abs(rules.unitTravelSpeed(agent, load) - expected) < 1e-12, tribe + ":" + level + ":" + load);
    }
  }
}

test("종족별 실제 기본 속도와 모든 적재율에 고정 이속 보너스를 더한다", () => {
  verifyTravel({ unitStats, unitTravelSpeed });
  for (const [tribe, speeds] of Object.entries(bases)) {
    assert.equal(TRIBE_UNIT_STATS[tribe].speed, speeds[0]);
    assert.equal(TRIBE_UNIT_STATS[tribe].loadedSpeed, speeds[1]);
  }
  assert.equal(unitTerrainSpeedMultiplier({tribe:"pebble"}, 9), 0);
});

test("서버·브라우저·시뮬레이션 워커는 같은 고정 스탯을 적용한다", () => {
  const source = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
  const browser = {};
  runInNewContext(source, browser);
  const workerSource = JSON.parse(source.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const worker = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(workerSource.slice(0, workerSource.indexOf('modules["client/worker.mjs"]')) +
    'globalThis.rules = modules["server/attributes.mjs"]; })();', worker);
  verifyTravel(browser.Spawner);
  verifyTravel(worker.rules);
  const decisionSource = JSON.parse(workerSource.match(/globalThis\.SpawnerDecisionWorkerSource = ("[^\r\n]+");/)[1]);
  const planner = { Map, Set, Uint8Array };
  runInNewContext(decisionSource.slice(0, decisionSource.indexOf('modules["client/decision-worker.mjs"]')) +
    'globalThis.rules = modules["server/attributes.mjs"]; })();', planner);
  verifyTravel(planner.rules);
});

test("운반량과 숙성 스탯은 명시된 단계 값을 적용한다", () => {
  for (const tribe of Object.keys(bases)) for (let level = 0; level <= 4; level++) {
    const stats = unitStats({ strength:level }, tribe);
    assert.equal("lifespan" in stats, false);
    assert.equal(stats.capacity, [1,2,2,2,2][level]);
  }
  assert.equal(ATTRIBUTE_STAT_VALUES.movementBonus, .3);
  assert.equal(attributeLevelLimit(4), 1);
  assert.equal(attributeCounts(["feet"], {feet:4}).feet, 1);
  assert.equal(attributeUpgradeCost("feet", 2), null);
  for (const tribe of Object.keys(bases)) {
    const slots = ["feet"], stats = unitStats({feet:1}, tribe);
    const agent = {tribe, slots, attributeLevels:{feet:1}, stats, health:43,
      growthActivity:100};
    applyAgentGrowth(agent, 0);
    assert.equal(agent.level, 5);
    assert.equal(agent.stats.harvestSpeedMultiplier, 1.2);
    assert.equal(agent.stats.movementMultiplier, 1.08);
    const once = {...agent.stats};
    agent.level = 0;
    applyAgentGrowth(agent, 0);
    assert.deepEqual(agent.stats, once);
    assert.equal(agent.health, 43);
  }
  assert.equal(AGENT_GROWTH_BONUSES.length, 10);
  assert.deepEqual([1,2,3,4].map(level => materialCapacity(level, [])), [30,40,50,60]);
});

test("이전 저장의 속도 필드를 종족 상수와 장착 속성으로 복원한다", () => {
  for (const tribe of Object.keys(bases)) {
    const colony = { id:1, ownerId:"stats", tribe, x:40, y:40, occupiedCells:new Set(["2,2"]) };
    const environment = {simSeconds:0, world:{seed:13, terrain:new Uint8Array(320*320).fill(4),
      hazards:new Uint8Array(320*320)}, colonies:[colony], games:new Map(), food:new Map(), foodSpots:new Map()};
    const game = createGame(environment, colony);
    environment.games.set("stats", game);
    const saved = JSON.parse(game.save());
    saved.state.agents = saved.state.agents.slice(0,1);
    Object.assign(saved.state.agents[0], {slots:["feet"], attributeLevels:{feet:1}, growthActivity:0, health:43});
    saved.state.agents[0].stats.speed = 99;
    game.restore(JSON.stringify(saved));
    assert.ok(Math.abs(game.agents[0].stats.speed - bases[tribe][0] - .3) < 1e-12);
    const once = {...game.agents[0].stats};
    game.restore(game.save());
    assert.deepEqual(game.agents[0].stats, once);
    assert.equal(game.agents[0].health, 43);
  }
});
