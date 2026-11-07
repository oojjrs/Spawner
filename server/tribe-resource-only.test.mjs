import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { canHarvestResource, resourceHarvestRequirements } from "./resources.mjs";

const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
runInNewContext(worker.slice(0, worker.indexOf('modules["client/worker.mjs"]')) +
  'globalThis.createGame = modules["server/game.mjs"].createGame; })();', context);

function fixture(create, tribe, resourceType, dnaEnabled) {
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
  saved.state.resourceInventory = { tree: 7, dew: 5, pebbles: 3 };
  Object.assign(saved.state.agents[0], { dna: dnaEnabled ? { version: 5, level: 1, budget: 10000, pieces: ATTRIBUTE_DNA.pack([{ gene: "gather", grade: 1, rotation: 0 }], 1) } : null,
    health: 100, slots: ["blade", "piercing", "antenna", "feet", "strength"], attributeLevels: {},
    bornAt: 0, birth: null, rulesVersion: 2 });
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


for (const [surface, create] of [["source", createGame], ["worker", context.createGame]]) {
  for (const [tribe, own] of [["bean", "clay"], ["spore", "tree"], ["pebble", "pebbles"], ["spring", "dew"]]) for (const dna of [false, true]) {
    test(`${surface}: ${tribe} ${dna ? "DNA" : "legacy"} chooses only ${own}`, () => {
      const f = fixture(create, tribe, own, dna);
      for (const [index, resourceType] of ["tree", "dew", "pebbles", "clay"].filter(type => type !== own).entries()) {
        const cell = { ...f.food, x: 43 + index, y: 43, resourceType };
        f.environment.food.set(`${cell.x},${cell.y}`, cell);
      }
      Object.assign(f.agent, { utility: null, mode: "search", decisionPending: "restore", nextDecisionAt: 0 });
      advance(f, .25);
      const candidates = f.agent.utility.scores.filter(item => item.action === "collect");
      assert.ok(candidates.length > 0);
      assert.ok(candidates.every(item => f.environment.food.get(item.key).resourceType === own));
    });
    test(`${surface}: ${tribe} ${dna ? "DNA" : "legacy"} still harvests ${own}`, () => {
      const f = fixture(create, tribe, own, dna);
      for (let i = 0; i < 80 && !f.agent.harvestResult; i++) advance(f, i * .25);
      assert.equal(f.agent.harvestResult?.resourceType, own);
      assert.ok(f.food.amount < 12);
    });
    for (const type of ["tree", "dew", "pebbles", "clay"].filter(type => type !== own)) for (const mode of ["approach", "harvest"]) {
      test(`${surface}: ${tribe} ${dna ? "DNA" : "legacy"} rejects ${type} in ${mode} without erasing stock/cargo`, () => {
        const f = fixture(create, tribe, type, dna);
        Object.assign(f.agent, { x: 46, y: 42, mode, harvestReady: 0, harvestPrepared: true,
          carrying: 1, carryingType: type });
        f.game.restore(f.game.save());
        const agent = f.game.agents[0];
        advance(f, .25);
        assert.equal(f.food.amount, 12);
        assert.equal(agent.harvestResult, null);
        assert.ok(agent.utility?.action !== "collect" || agent.utility.target.key !== "46,42");
        assert.equal(agent.carrying, 1);
        assert.equal(agent.carryingType, type);
        assert.deepEqual(JSON.parse(JSON.stringify(f.game.snapshot().resourceInventory)), { tree: 7, dew: 5, pebbles: 3 });
      });
    }
  }
}

test("bean restriction precedes DNA and legacy unlocks, including dropped resources", () => {
  for (const attributes of [{ dnaGather: true }, { dnaGather: false }, {}, { blade: 9, piercing: 9 }]) {
    for (const resourceType of ["tree", "wood", "dew", "pebbles", "unknown", "nutrients"]) {
      for (const dropped of [false, true]) assert.equal(canHarvestResource({ resourceType, dropped }, {}, attributes, "bean"), false);
    }
    assert.equal(canHarvestResource({ resourceType: "clay" }, {}, attributes, "bean"), attributes.dnaGather !== false);
    assert.equal(canHarvestResource({ resourceType: "clay", kind: "corpse" }, {}, attributes, "bean"), false);
  }
  for (const tribe of ["spore", "pebble", "spring"]) for (const resourceType of ["tree", "dew", "pebbles", "clay"]) {
    assert.equal(canHarvestResource({ resourceType }, {}, { dnaGather: true }, tribe), ({spore:"tree", pebble:"pebbles", spring:"dew"})[tribe] === resourceType);
    assert.equal(canHarvestResource({ resourceType }, {}, { blade: 1, piercing: 1 }, tribe), ({spore:"tree", pebble:"pebbles", spring:"dew"})[tribe] === resourceType);
  }
});


test("resource details report unavailable for foreign resources rather than unlock attributes", () => {
  const browser = {};
  runInNewContext(runtime, browser);
  for (const rules of [{ resourceHarvestRequirements }, browser.Spawner]) {
    for (const [tribe, own] of [["bean", "clay"], ["spore", "tree"], ["pebble", "pebbles"], ["spring", "dew"]]) {
      for (const resourceType of ["clay", "tree", "pebbles", "dew"]) for (const dropped of [true, false]) {
        const requirements = rules.resourceHarvestRequirements({ resourceType, dropped }, {}, tribe);
        if (resourceType === own) assert.deepEqual(Object.keys(requirements), []);
        else assert.equal(requirements, null);
      }
    }
  }
  assert.match(readFileSync(new URL("../client/game.js", import.meta.url), "utf8"), /if \(requirements === null\) return \[tribe.name, "채집 불가"\]/);
});
