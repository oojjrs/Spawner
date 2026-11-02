import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";
import { canHarvestResource } from "./resources.mjs";

const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
runInNewContext(worker.slice(0, worker.indexOf('modules["client/worker.mjs"]')) +
  'globalThis.createGame = modules["server/game.mjs"].createGame; })();', context);

function fixture(create, tribe, resourceType, attribute) {
  const colony = { id: 1, ownerId: "harvest-target", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const food = { x: 46, y: 42, amount: 12, initialAmount: 12, terrain: "grassland", kind: "resource", resourceType };
  const environment = { simSeconds: 0, world: { size: 64, seed: 13, generationVersion: 37,
    terrain: new Uint8Array(64 * 64).fill(4), hazards: new Uint8Array(64 * 64) },
    colonies: [colony], games: new Map(), food: new Map([["46,42", food]]), foodSpots: new Map() };
  const game = create(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.agents.splice(1);
  saved.state.nestLevel = 4;
  Object.assign(saved.state.agents[0], { slots: [attribute].filter(Boolean), attributeLevels: attribute ? { [attribute]: 1 } : {},
    bornAt: 0, birth: null, growthActivity: 0, rulesVersion: 2 });
  game.restore(JSON.stringify(saved));
  const agent = game.agents[0];
  Object.assign(agent, { x: 45, y: 42, renderFromX: 45, renderFromY: 42, carrying: 0, carryingType: null,
    mode: "approach", moveStartedAt: 0, moveDuration: 0, moveBudget: 1, decisionPending: null,
    nextDecisionAt: 1000, survivalState: "stable", harvestResult: null,
    utility: { action: "collect", target: { x: 46, y: 42, key: "46,42" },
      route: [{ x: 45, y: 42 }, { x: 46, y: 42 }], plannedCargo: 2 } });
  return { game, environment, food, agent };
}

function advance(fixture, seconds) {
  const elapsed = seconds - fixture.environment.simSeconds;
  fixture.environment.simSeconds = seconds;
  fixture.game.prepare(seconds);
  fixture.game.tick(elapsed);
}

for (const [surface, create] of [["소스", createGame], ["브라우저 워커", context.createGame]]) {
  for (const [tribe, resourceType, attribute] of [
    ["bean", "clay", null], ["spore", "clay", null],
    ["pebble", "clay", null], ["spring", "clay", null],
    ["bean", "tree", "blade"], ["bean", "pebbles", "piercing"],
    ["bean", "dew", null], ["spore", "clay", null]
  ]) {
    test(surface + ": " + tribe + "의 해금된 " + resourceType + " 목표를 접근부터 첫 채집까지 유지한다", () => {
      const f = fixture(create, tribe, resourceType, attribute);
      assert.equal(canHarvestResource(f.food, f.environment.world, f.agent.attributes, tribe), true);
      advance(f, 0);
      assert.notEqual(f.agent.lastDecisionReason, "targetLost");
      assert.equal(f.agent.utility?.target.key, "46,42");
      assert.equal(f.agent.x, 46);
      for (let step = 1; step <= 40 && !f.agent.harvestResult; step++) {
        advance(f, step * .25);
        assert.notEqual(f.agent.lastDecisionReason, "targetLost");
      }
      assert.ok(f.agent.carrying > 0);
      assert.equal(f.agent.carryingType, resourceType);
      assert.equal(f.agent.harvestResult?.resourceType, resourceType);
      assert.ok(f.food.amount < 12);
    });
  }

  for (const invalid of ["속성 부족", "고갈", "다른 적재물"]) {
    test(surface + ": " + invalid + "인 채집 목표는 계속 무효 처리한다", () => {
      const f = fixture(create, "bean", "tree", "blade");
      if (invalid === "속성 부족") f.agent.attributes.blade = 0;
      if (invalid === "고갈") f.food.amount = 0;
      if (invalid === "다른 적재물") { f.agent.carrying = 1; f.agent.carryingType = "clay"; }
      advance(f, 0);
      assert.equal(f.agent.lastDecisionReason, "targetLost");
      assert.ok(f.agent.utility?.action !== "collect" || f.agent.utility.target.key !== "46,42");
      assert.equal(f.agent.harvestResult, null);
    });
  }
}
