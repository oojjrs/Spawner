import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";
import { RESOURCE_TYPES } from "./resources.mjs";
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
  saved.state.resourceInventory = { tree: 3, meat: 2, clay: 4, sand: 7 };
  saved.state.resourceStores = [
    { id: "nest:1", kind: "nest", x: 40, y: 40, inventory: { tree: 3, meat: 2 } },
    { id: "warehouse", kind: "storage", x: 60, y: 40, inventory: { clay: 4, sand: 7 } },
    { id: "remains:fixture", kind: "remains", x: 70, y: 40, width: 1, height: 1, capacity: 0, inventory: { tree: 9, dew: 11 } }
  ];
  game.restore(JSON.stringify(saved));
  return game;
}

function verifyGrants(create) {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const game = fixture(tribe, create);
    const before = game.snapshot().resourceInventory;
    for (const count of [1, 2]) {
      game.command({ type: "cheat-resources" });
      const inventory = game.snapshot().resourceInventory;
      const saved = JSON.parse(game.save());
      for (const resource of RESOURCE_TYPES) {
        const expected = (before[resource.key] || 0) + (resource.category === "material" ? count * 100 : 0);
        assert.equal(inventory[resource.key] || 0, expected, tribe + resource.key);
        assert.equal(saved.state.resourceInventory[resource.key] || 0, expected, tribe + resource.key);
        assert.equal(saved.state.resourceStores.filter(store => store.kind !== "remains")
          .reduce((amount, store) => amount + (store.inventory[resource.key] || 0), 0), expected, tribe + resource.key);
      }
      assert.equal(JSON.stringify(saved.state.resourceStores.find(store => store.id === "warehouse").inventory), JSON.stringify({ clay: 4, sand: 7 }));
      assert.equal(JSON.stringify(saved.state.resourceStores.find(store => store.id === "remains:fixture").inventory), JSON.stringify({ tree: 9, dew: 11 }));
      game.restore(JSON.stringify(saved));
      const restored = game.snapshot().resourceInventory;
      for (const resource of RESOURCE_TYPES) assert.equal(restored[resource.key] || 0, inventory[resource.key] || 0, tribe + resource.key);
    }
  }
}

test("재료 치트는 네 종족의 창고별 재고를 갱신하고 재지급·저장·복원 시 지급분을 보존한다", () => {
  verifyGrants(createGame);
});

test("내장 워커도 재료 지급분을 보존하고 배포 번들은 재료 치트를 포함하지 않는다", () => {
  const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
  const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(worker.slice(0, worker.indexOf('modules["client/worker.mjs"]')) +
    'globalThis.createGame = modules["server/game.mjs"].createGame; })();', context);
  verifyGrants(context.createGame);
  assert.equal(productionRuntime(runtime).includes("cheat-resources"), false);
});
