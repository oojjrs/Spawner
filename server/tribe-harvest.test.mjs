import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";
import { canHarvestResource, resourceHarvestRequirements } from "./resources.mjs";

const foods = [["bean", "clay"], ["spore", "tree"], ["pebble", "pebbles"], ["spring", "dew"]];

function fixture(tribe, ownFood, create) {
  const colony = { id: 1, ownerId: "tribe-harvest", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const types = foods.map(([, type]) => type).filter(type => type !== ownFood).concat("sand", "meat");
  const cells = types.map((resourceType, index) => ({ x: 43 + index % 3, y: 42 + Math.floor(index / 3),
    amount: 12, initialAmount: 12, kind: "resource", terrain: "grassland", resourceType }));
  if (ownFood) cells.push({ x: 47, y: 42, amount: 12, initialAmount: 12, kind: "resource", terrain: "grassland", resourceType: ownFood });
  const environment = { simSeconds: 120, world: { seed: 13, generationVersion: 15,
    terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(cells.map(cell => [cell.x + "," + cell.y, cell])), foodSpots: new Map() };
  const game = create(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.agents.splice(1);
  saved.state.nestLevel = 4;
  saved.state.evolutionPoints = 20;
  Object.assign(saved.state.agents[0], { x: 43, y: 42, renderFromX: 43, renderFromY: 42, bornAt: 120, birth: null,
    slots: ["antenna", "strength", "strength", "butchery"], rulesVersion: 2,
    carrying: 0, carryingType: null, utility: null, mode: "search", decisionPending: "restore",
    nextDecisionAt: 120, actionPriorities: ["collect", "explore"], personality: { boldness: 0, aggression: 0, curiosity: 0 } });
  game.restore(JSON.stringify(saved));
  return { game, environment, ownFood };
}

function advance(fixture, seconds) {
  for (let elapsed = 0; elapsed < seconds; elapsed += .25) {
    fixture.environment.simSeconds += .25;
    fixture.game.prepare(fixture.environment.simSeconds);
    fixture.game.tick(.25);
  }
}

test("네 종족의 기본 먹이만 채집 가능하며 다른 종족 먹이는 기존 속성으로 해금하지 않는다", () => {
  for (const generationVersion of [undefined, 10, 11, 15]) for (const [tribe, ownFood] of foods) {
    for (const [, resourceType] of foods) for (const attributes of [{}, { antenna: 2, strength: 2, butchery: 1, feet: 2 }]) {
      const world = { generationVersion };
      assert.equal(canHarvestResource({ resourceType }, world, attributes, tribe), resourceType === ownFood, tribe + ":" + resourceType);
      assert.deepEqual(resourceHarvestRequirements({ resourceType }, world, tribe), resourceType === ownFood ? {} : null);
    }
  }
  assert.equal(canHarvestResource({ resourceType: "meat" }, { generationVersion: 15 }, {}, "bean"), false);
  assert.equal(canHarvestResource({ resourceType: "meat" }, { generationVersion: 15 }, { butchery: 1 }, "bean"), true);
});

for (const [tribe, ownFood] of foods) {
  test(tribe + "은 더 가까운 다른 먹이·재료 대신 자기 먹이만 자동 채집한다", () => {
    const f = fixture(tribe, ownFood, createGame);
    advance(f, .25);
    const candidates = f.game.agents[0].utility.scores.filter(candidate => candidate.action === "collect");
    assert.ok(candidates.length > 0);
    assert.ok(candidates.every(candidate => candidate.key === "47,42"));
    advance(f, 24);
    assert.ok(f.environment.food.get("47,42").amount < 12);
    for (const [key, cell] of f.environment.food) if (key !== "47,42") assert.equal(cell.amount, 12, tribe + ":" + cell.resourceType);
  });

  test(tribe + "은 자기 먹이가 없으면 다른 먹이를 채집하지 않는다", () => {
    const f = fixture(tribe, null, createGame);
    for (const [key, cell] of f.environment.food) if (cell.resourceType === ownFood) f.environment.food.delete(key);
    advance(f, 4);
    assert.ok(f.game.agents[0].utility.scores.every(candidate => candidate.action !== "collect"));
    for (const cell of f.environment.food.values()) assert.equal(cell.amount, 12);
    assert.equal(f.game.agents[0].carrying, 0);
  });

  test(tribe + "의 저장된 타 종족 먹이 채집은 복원 후 중단하고 기존 재료는 보존한다", () => {
    const f = fixture(tribe, ownFood, createGame);
    advance(f, .25);
    f.environment.world.generationVersion = 10;
    const cell = [...f.environment.food.values()].find(cell => foods.some(([, type]) => type === cell.resourceType) && cell.resourceType !== ownFood);
    const key = cell.x + "," + cell.y;
    Object.assign(f.game.agents[0], { x: cell.x, y: cell.y, renderFromX: cell.x, renderFromY: cell.y,
      mode: "harvest", harvestPrepared: true, harvestReady: 120, decisionPending: null, nextDecisionAt: 1000,
      utility: { action: "collect", target: { x: cell.x, y: cell.y, key }, route: [{ x: cell.x, y: cell.y }], plannedCargo: 2 } });
    const saved = JSON.parse(f.game.save());
    saved.state.resourceInventory = { dew: 7, sand: 3 };
    f.game.restore(JSON.stringify(saved));
    advance(f, .25);
    assert.equal(cell.amount, 12);
    assert.ok(f.game.agents[0].utility?.action !== "collect" || f.game.agents[0].utility.target.key !== key);
    assert.deepEqual(f.game.snapshot().resourceInventory, { dew: 7, sand: 3 });
  });
}

test("브라우저 번들과 내장 워커에도 동일한 종족별 채집 규칙을 적용한다", () => {
  const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
  const browser = {};
  runInNewContext(runtime, browser);
  for (const [tribe, ownFood] of foods) for (const [, resourceType] of foods) {
    assert.equal(browser.Spawner.canHarvestResource({ resourceType }, { generationVersion: 15 }, { strength: 2 }, tribe), resourceType === ownFood);
  }
  const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const context = { Map, Set, Uint8Array };
  runInNewContext(worker.slice(0, worker.indexOf('modules["client/worker.mjs"]')) +
    'globalThis.createGame = modules["server/game.mjs"].createGame; })();', context);
  for (const [tribe, ownFood] of foods) {
    const f = fixture(tribe, ownFood, context.createGame);
    advance(f, .25);
    const candidates = f.game.agents[0].utility.scores.filter(candidate => candidate.action === "collect");
    assert.ok(candidates.length > 0);
    assert.ok(candidates.every(candidate => candidate.key === "47,42"));
  }
});

test("저장된 일반 재료 자동 채집도 즉시 중단한다", () => {
  const f = fixture("bean", "clay", createGame);
  advance(f, .25);
  const cell = [...f.environment.food.values()].find(cell => cell.resourceType === "sand");
  const key = cell.x + "," + cell.y;
  Object.assign(f.game.agents[0], { x: cell.x, y: cell.y, renderFromX: cell.x, renderFromY: cell.y,
    mode: "harvest", harvestPrepared: true, harvestReady: 120, decisionPending: null, nextDecisionAt: 1000,
    utility: { action: "collect", target: { x: cell.x, y: cell.y, key }, route: [{ x: cell.x, y: cell.y }], plannedCargo: 2 } });
  f.game.restore(f.game.save());
  advance(f, .25);
  assert.equal(cell.amount, 12);
  assert.ok(f.game.agents[0].utility?.action !== "collect" || f.game.agents[0].utility.target.key !== key);
});
