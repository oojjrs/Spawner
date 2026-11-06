import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createGame } from './game.mjs';
import { createUtilityAI } from './utility.mjs';
import { dnaCanMove, dnaUnitStats } from './dna-unit.mjs';
import { startingWorkerDna } from './tribe-start.mjs';
import { isColonyFood } from './resources.mjs';

const runtime = readFileSync(new URL('../client/runtime.js', import.meta.url), 'utf8');
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const decision = JSON.parse(worker.match(/^globalThis.SpawnerDecisionWorkerSource = ("[^\n]+");/)[1]);
const surfaces = [['소스', { createGame, createUtilityAI }]];
for (const [name, source, entry] of [['게임 워커', worker, 'client/worker.mjs'], ['판단 워커', decision, 'client/decision-worker.mjs']]) {
  const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(source.slice(0, source.indexOf('modules["' + entry + '"]')) +
    'globalThis.api = { ...modules["server/game.mjs"], ...modules["server/utility.mjs"] }; })();', context);
  surfaces.push([name, context.api]);
}

const primary = { bean: 'clay', spore: 'tree', pebble: 'pebbles', spring: 'dew' };

function aiFixture(api, tribe, coordinates) {
  const size = 32, home = { ownerId: 'home', x: 10, y: 10 };
  const dna = startingWorkerDna(tribe), stats = dnaUnitStats(dna);
  const agent = { id: 'worker', ownerId: 'home', tribe, x: 17, y: 12, dna, attributes: {}, stats,
    health: stats.health, carrying: 0, cost: 17, stepCount: 0,
    personality: { boldness: .5, aggression: .5, curiosity: .5 }, visited: new Set(), preciseHarvestTimes: new Map() };
  const knownFood = new Map(coordinates.map(([x, y]) => [x + ',' + y,
    { key: x + ',' + y, x, y, amount: 100, resourceType: primary[tribe] }]));
  const state = { simSeconds: 30, nestLevel: 1, evolutionPoints: 30, lastFoodAt: 30, colonyFood: 0,
    agents: [agent], explored: new Set(Array.from({ length: size * size }, (_, index) => index)),
    knownFood, markers: [], resourceInventory: {} };
  const context = { state, size, tribe, homeCells: () => [{ x: 10, y: 10 }], deliveryCells: () => [{ x: 10, y: 10 }],
    walkable: () => true, hazardAt: () => 0, enemies: () => [], synergy: () => false, canHarvest: () => true,
    isFood: type => isColonyFood(type, tribe, 41), canMove: (unit, x, y) => dnaCanMove(unit, x, y, [home]),
    materialSpace: () => 100, deliveryCapacity: () => 100 };
  return { agent, context, ai: api.createUtilityAI(context) };
}

function gameFixture(api, tribe, target, route) {
  const size = 32;
  const colony = { id: 1, ownerId: 'home', tribe, x: 10, y: 10, occupiedCells: new Set(['2,2']) };
  const food = { key: target.x + ',' + target.y, ...target, amount: 100, initialAmount: 100, resourceType: primary[tribe] };
  const environment = { simSeconds: 0, world: { size, seed: 13, generationVersion: 41,
    terrain: new Uint8Array(size * size).fill(4), hazards: new Uint8Array(size * size) },
    colonies: [colony], games: new Map(), food: new Map([[food.key, food]]), foodSpots: new Map() };
  const game = api.createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  Object.assign(game.agents[0], { x: 17, y: 12, renderFromX: 17, renderFromY: 12, birth: null, bornAt: 0,
    decisionPending: null, nextDecisionAt: 1000, mode: 'approach', moveStartedAt: 0, moveDuration: 0, moveBudget: 1,
    utility: { action: 'collect', target: { ...target, key: food.key }, route, plannedCargo: 1, score: 100 } });
  game.restore(game.save());
  const agent = game.agents[0];
  return { game, environment, agent };
}

function tick(fixture) {
  fixture.environment.simSeconds += .1;
  fixture.game.prepare(fixture.environment.simSeconds);
  fixture.game.tick(.1);
}

for (const [surface, api] of surfaces) for (const tribe of Object.keys(primary)) {
  test(surface + ' ' + tribe + ': 가까운 범위 밖 자원 6곳이 범위 안 채집 후보를 밀어내지 않는다', () => {
    const f = aiFixture(api, tribe, [[18,12], [18,11], [18,13], [18,10], [18,14], [19,12], [7,12]]);
    const plans = f.ai.evaluate(f.agent, false);
    assert.equal(plans[0]?.action, 'collect');
    assert.equal(plans[0].target.key, '7,12');
    assert.ok(plans.every(plan => f.context.canMove(f.agent, plan.target.x, plan.target.y)));
    assert.equal(f.agent.x, 17);
  });

  test(surface + ' ' + tribe + ': 범위 밖 구세이브는 귀환 중 다시 멀어지는 우회로를 계획하지 않는다', () => {
    const f = aiFixture(api, tribe, []);
    Object.assign(f.agent, { x: 20, y: 16 });
    const corridor = new Set(['20,16', '19,16', '19,17', '18,17', '17,17', '17,16', '17,15', '17,14']);
    f.context.walkable = (x, y) => corridor.has(x + ',' + y);
    const ai = api.createUtilityAI(f.context);
    assert.equal(ai.nextStep(f.agent, { x: 17, y: 14 }), null);
  });

  test(surface + ' ' + tribe + ': 저장된 범위 밖 채집 목표는 다음 주기까지 반복하지 않고 폐기한다', () => {
    const f = gameFixture(api, tribe, { x: 18, y: 12 }, [{ x: 17, y: 12 }, { x: 18, y: 12 }]);
    tick(f);
    assert.notEqual(f.agent.utility?.target?.key, '18,12');
    assert.ok(f.agent.x <= 17);
  });

  test(surface + ' ' + tribe + ': 목표는 범위 안이어도 저장 경로가 밖으로 나가면 안쪽 경로로 다시 계산한다', () => {
    const f = gameFixture(api, tribe, { x: 16, y: 12 }, [
      { x: 17, y: 12 }, { x: 18, y: 12 }, { x: 18, y: 11 }, { x: 17, y: 11 }, { x: 16, y: 11 }, { x: 16, y: 12 }
    ]);
    tick(f);
    assert.equal(f.agent.x, 16);
    assert.equal(f.agent.y, 12);
  });

  test(surface + ' ' + tribe + ': 비동기 판단이 범위 밖 목표를 돌려주면 유효한 귀환 후보를 선택한다', () => {
    const f = gameFixture(api, tribe, { x: 16, y: 12 }, []);
    Object.assign(f.agent, { carrying: 1, carryingType: primary[tribe], decisionPending: 'restore' });
    f.environment.decisionPlanner = { request() { return [
      { action: 'collect', target: { x: 18, y: 12, key: '18,12' }, route: [], plannedCargo: 2, score: 100 },
      { action: 'return', target: { x: 10, y: 10, key: 'home' }, route: [], score: 50 }
    ]; } };
    tick(f);
    assert.equal(f.agent.utility?.action, 'return');
    assert.equal(f.agent.utility.target.key, 'home');
    assert.equal(f.agent.carrying, 1);
  });
}
