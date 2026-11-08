import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";
import { productionRuntime } from "../client/production.mjs";

function fixture(tribe, create) {
  const colony = { id: 1, ownerId: "cheats-test", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, generationVersion: 23,
    terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = create(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.buildings = [{ id: "warehouse", key: "storage", x: 60, y: 40, health: 100 }];
  saved.state.resourceInventory = { tree: 3, nutrients: 2, clay: 4, sand: 7 };
  saved.state.resourceStores = [
    { id: "nest:1", kind: "nest", x: 40, y: 40, inventory: { tree: 3, nutrients: 2 } },
    { id: "warehouse", kind: "storage", x: 60, y: 40, inventory: { clay: 4, sand: 7 } },
    { id: "remains:fixture", kind: "remains", x: 70, y: 40, width: 1, height: 1, capacity: 0, inventory: { tree: 9, dew: 11 } }
  ];
  game.restore(JSON.stringify(saved));
  return game;
}

function verifyGrants(create) {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const game = fixture(tribe, create);
    assert.equal(game.snapshot().evolutionPoints, 7);
    assert.equal(game.snapshot().resourceInventory, undefined);
    assert.equal(game.snapshot().resourceStores, undefined);
    for (const count of [1, 2]) {
      game.command({ type: "cheat-evolution-points" });
      const saved = JSON.parse(game.save());
      assert.equal(saved.state.evolutionPoints, 7 + count * 10000);
      assert.equal(saved.state.resourceInventory, undefined);
      assert.equal(saved.state.resourceStores, undefined);
      game.restore(JSON.stringify(saved));
      assert.equal(game.snapshot().evolutionPoints, 7 + count * 10000);
    }
  }
}

test("구저장 재고는 한 번 포인트로 바뀌고 포인트 치트는 저장 후 유지한다", () => {
  verifyGrants(createGame);
});

test("내장 워커도 포인트만 저장하고 배포 번들은 재료 치트를 포함하지 않는다", () => {
  const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
  const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(worker.slice(0, worker.indexOf('modules["client/worker.mjs"]')) +
    'globalThis.createGame = modules["server/game.mjs"].createGame; })();', context);
  verifyGrants(context.createGame);
  assert.equal(productionRuntime(runtime).includes("cheat-resources"), false);
});

test("옛 재고는 저장 한도 내에서 한 번만 전환하고 중복 창고 및 폐기 자원은 더하지 않는다", () => {
  const game = fixture("bean", createGame), saved = JSON.parse(game.save());
  saved.state.evolutionPoints = 195;
  saved.state.resourceInventory = { tree: 7, dew: 3, nutrients: 100, unknown: 50, clay: -2 };
  saved.state.resourceStores = [{ kind: "nest", inventory: { tree: 7, dew: 3 } }];
  game.restore(JSON.stringify(saved));
  assert.equal(game.snapshot().evolutionPoints, 200);
  game.restore(game.save());
  assert.equal(game.snapshot().evolutionPoints, 200);
  for (const field of ["resourceInventory", "resourceStores", "resourceCapacity", "resourceInventoryLimits"]) {
    assert.equal(Object.hasOwn(game.snapshot(), field), false);
    assert.equal(Object.hasOwn(JSON.parse(game.save()).state, field), false);
  }
  saved.state.evolutionPoints = 10;
  delete saved.state.resourceInventory;
  saved.state.resourceStores = [{ kind: "nest", inventory: { dew: 2 } },
    { kind: "storage", inventory: { clay: 3 } }, { kind: "remains", inventory: { tree: 100 } }];
  game.restore(JSON.stringify(saved));
  assert.equal(game.snapshot().evolutionPoints, 15);
  game.restore(game.save());
  assert.equal(game.snapshot().evolutionPoints, 15);
});
