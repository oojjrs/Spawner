import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";
import { createEncounters } from "./encounters.mjs";
import { canHarvestResource, resourceDefinition, migrateResourceType } from "./resources.mjs";
import { CORPSE_LIFETIME, placeCorpse, expireCorpses } from "./corpses.mjs";
import { BEETLE_ANIMATIONS } from "./beetle-animation.mjs";

function fixture(tribe) {
  const colony = { id: 1, ownerId: "corpse-test", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { seed: 13, simSeconds: 0, world: { seed: 13, generationVersion: 11, sites: [[42,42]],
    terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), burrows: [] },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  return { game, environment };
}

test("모든 종족은 비용과 무관하게 비자원 사체를 3초 남긴다", () => {
  assert.equal(CORPSE_LIFETIME, 3);
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const cost of [0, .1, 10]) {
    const { game, environment } = fixture(tribe);
    const ground = { x: 46, y: 42, amount: 7, resourceType: "clay", kind: "resource" };
    environment.food.set("46,42", ground);
    const victims = [...game.agents];
    for (const agent of victims) { Object.assign(agent, { x: 46, y: 42, cost }); game.receiveDamage(agent, 1000); }
    const snapshot = game.snapshot();
    assert.equal(game.agents.length, 0);
    assert.equal(snapshot.corpses.length, victims.length);
    assert.equal(new Set(snapshot.corpses.map(cell => cell.key)).size, victims.length);
    for (const corpse of snapshot.corpses) {
      assert.equal(corpse.key, "corpse:" + corpse.agentId);
      for (const key of ["resourceType", "amount", "initialAmount"]) assert.equal(key in corpse, false);
      assert.equal(canHarvestResource(corpse, environment.world, { butchery: 1 }, tribe), false);
    }
    assert.ok(snapshot.food.every(cell => cell.kind !== "corpse"));
    assert.ok(JSON.parse(game.save()).state.knownFood.entries.every(([, cell]) => cell.kind !== "corpse"));
    game.prepare(2.999); assert.equal(game.snapshot().corpses.length, victims.length);
    game.prepare(3); assert.deepEqual(game.snapshot().corpses, []);
    assert.equal([...environment.food.values()].some(cell => cell.kind === "corpse"), false);
    assert.equal(environment.food.get("46,42"), ground);
    assert.equal(ground.amount, 7);
  }
});

test("구버전 사체는 수량을 버리고 사망 시각부터 3초로 수명을 줄인다", () => {
  const ground = { x: 5, y: 5, resourceType: "clay", amount: 4 }, food = new Map([["5,5", ground]]);
  for (const amount of [0, .1, 4]) placeCorpse(food, { agentId: String(amount), kind: "corpse", x: 5, y: 5,
    amount, resourceType: "meat", initialAmount: amount, diedAt: 10, decaysAt: 310,
    attributes: { butchery: 1, blade: 1 }, appearanceAttributes: { condensation: 1 } });
  expireCorpses(food, 12.999);
  assert.equal(food.size, 4);
  for (const corpse of [...food.values()].filter(cell => cell.kind === "corpse")) {
    assert.equal(corpse.decaysAt, 13); assert.deepEqual(corpse.attributes, { blade: 1 });
    assert.deepEqual(corpse.appearanceAttributes, {}); assert.equal("amount" in corpse, false);
  }
  expireCorpses(food, 13); assert.deepEqual([...food.values()], [ground]);
  for (const type of ["nutrients", "meat"]) { assert.equal(migrateResourceType(type), null); assert.equal(resourceDefinition(type), undefined); }
});

for (const nextTick of [BEETLE_ANIMATIONS.death.durationMs / 1000, 5]) test("딱정벌레 사체는 최초 사망 3초에 끝난다: " + nextTick, () => {
  const { environment } = fixture("bean");
  environment.world.burrows = [{ id: "burrow:small:64130", type: "small", x: 130, y: 200, width: 1, height: 1, entrance: { x: 130, y: 201 } }];
  const creatures = createCreatures(environment, null), beetle = creatures.agents[0];
  creatures.receiveDamage(beetle, 1000); environment.simSeconds = nextTick; creatures.tick();
  if (nextTick < 3) {
    const corpse = [...environment.food.values()].find(cell => cell.agentId === beetle.id);
    assert.ok(corpse); assert.equal(corpse.decaysAt, 3); assert.equal("amount" in corpse, false);
  }
  environment.simSeconds = Math.max(3, nextTick); creatures.tick();
  assert.equal(creatures.agents.includes(beetle), false);
  assert.equal([...environment.food.values()].some(cell => cell.agentId === beetle.id), false);
});

test("중립 생물도 자원을 밀지 않고 3초 동안 비자원 사체만 남긴다", () => {
  const { environment } = fixture("bean"), index = 150 * 320 + 150;
  environment.world.encounters = [{ key: "dew-rabbit", x: 150, y: 150, cells: [index], terrains: [4], nearWater: false }];
  const rabbit = { id: "rabbit-test", species: "dew-rabbit", x: 150, y: 150, health: 1, stats: { health: 14, combatStrength: 10, speed: .5, attack: 1, vision: 4 }, moveStartedAt: 0, nextActionAt: 0 };
  const encounters = createEncounters(environment, { version: 1, agents: [rabbit], kills: {}, records: [
    { key: "dew-rabbit", x: 150, y: 150, sequence: 1, spawned: true, dead: false, missingSince: null, nextSpawnAt: null, warningUntil: null }
  ] }, []);
  environment.food.set("150,150", { x: 150, y: 150, amount: 5, resourceType: "clay" });
  encounters.receiveDamage(rabbit, 100);
  const corpse = environment.food.get("corpse:rabbit-test");
  assert.equal(corpse.decaysAt, 3); assert.equal("resourceType" in corpse, false);
  assert.equal(encounters.agents.includes(rabbit), false);
  expireCorpses(environment.food, 3);
  assert.equal(environment.food.has(corpse.key), false); assert.equal(environment.food.get("150,150").amount, 5);
});
