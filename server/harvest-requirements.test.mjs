import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTES, attributeCounts } from "./attributes.mjs";
import { RESOURCE_TYPES, canHarvestResource, resourceHarvestRequirements } from "./resources.mjs";
import { createGame } from "./game.mjs";
import { generateWorld } from "./world.mjs";

const requirements = { clay: [], tree: [], dew: [], pebbles: [] };
const tribes = { clay: "bean", tree: "spore", dew: "spring", pebbles: "pebble" };

function fixture(resourceType, slots) {
  const colony = { id: 1, ownerId: "requirements-test", tribe: tribes[resourceType] || "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const terrain = resourceType === "tree" ? "forest" : "grassland";
  const food = { x: 46, y: 42, amount: 6, initialAmount: 6, resourceType, terrain,
    kind: "resource" };
  const environment = { simSeconds: 120, world: { seed: 13, generationVersion: 16, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(),
    food: new Map([["46,42", food]]), foodSpots: new Map() };
  environment.world.terrain[42 * 320 + 46] = terrain === "forest" ? 5 : 4;
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 4;
  saved.state.evolutionPoints = 50;
  Object.assign(saved.state.agents[0], { x: 46, y: 42, renderFromX: 46, renderFromY: 42,
    slots, rulesVersion: 2, carrying: 0, carryingType: null, birth: null, bornAt: 0,
    mode: "approach", moveStartedAt: 0, moveDuration: 0, moveBudget: 0,
    harvestResult: null, decisionPending: null, nextDecisionAt: 1000,
    personality: { boldness: 0, aggression: 0, curiosity: 0 },
    utility: { action: "collect", target: { x: 46, y: 42, key: "46,42" },
      route: [{ x: 46, y: 42 }], plannedCargo: 2 } });
  game.restore(JSON.stringify(saved));
  return { game, environment, food, agent: game.agents[0] };
}

function advanceTo(fixture, seconds) {
  const time = seconds + 120;
  const elapsed = time - fixture.environment.simSeconds;
  fixture.environment.simSeconds = time;
  fixture.game.prepare(time);
  fixture.game.tick(elapsed);
}

test("채집 가능한 자원의 필요 속성을 자원 묶음대로 검사한다", () => {
  const world = { hazards: new Uint8Array(320 * 320) };
  assert.equal(RESOURCE_TYPES.filter(entry => !entry.harvestLocked).length, Object.keys(requirements).length);
  assert.equal(resourceHarvestRequirements({ resourceType: "honey-mushrooms" }, world), null);
  assert.equal(canHarvestResource({ resourceType: "honey-mushrooms" }, world, attributeCounts(ATTRIBUTES.flatMap(item => [item.key, item.key]))), false);
  assert.equal(resourceHarvestRequirements(null, world), null);
  assert.equal(canHarvestResource({ resourceType: "unknown" }, world, attributeCounts(ATTRIBUTES.map(item => item.key))), false);
  for (const [key, slots] of Object.entries(requirements)) {
    const food = { x: 46, y: 42, terrain: key === "tree" ? "forest" : "grassland", resourceType: key };
    assert.deepEqual(resourceHarvestRequirements(food, world, tribes[key]), tribes[key] ? {} : attributeCounts(slots), key);
    assert.equal(canHarvestResource(food, world, attributeCounts(slots), tribes[key]), true, key);
    for (let index = 0; index < slots.length; index++) {
      assert.equal(canHarvestResource(food, world, attributeCounts(slots.filter((slot, candidate) => candidate !== index))), false, key);
    }
  }
});

test("폐기한 열매·뿌리·이끼는 현재 속성을 모두 갖춰도 수확할 수 없다", () => {
  const world = { hazards: new Uint8Array(320 * 320) };
  const attributes = attributeCounts(ATTRIBUTES.flatMap(item => [item.key, item.key]));
  for (const resourceType of ["tree-fruit", "berry-bush", "seed-pods", "root-bulbs", "nutrient-moss"]) {
    const food = { x: 46, y: 42, terrain: "forest", resourceType };
    assert.equal(resourceHarvestRequirements(food, world), null, resourceType);
    assert.equal(canHarvestResource(food, world, attributes), false, resourceType);
  }
  assert.equal(canHarvestResource({ x: 46, y: 42, terrain: "forest" }, world, attributes), false);
});

test("필요한 속성을 갖춘 개체만 실제 준비·수확을 마치고 종류별 적재물을 얻는다", () => {
  for (const [key, slots] of Object.entries(requirements)) {
    const f = fixture(key, slots);
    assert.ok(f.agent.dna, key + " retains the tribe's starting DNA");
    assert.equal(f.agent.stats.dna.harvest, 1, key);
    const harvestSeconds = f.agent.stats.dna.harvestTime;
    assert.ok(Number.isFinite(harvestSeconds) && harvestSeconds > 0, key);
    advanceTo(f, 0);
    assert.equal(f.agent.mode, "harvest", key);
    assert.equal(f.agent.harvestReady, 121, key + " preparation deadline");
    advanceTo(f, 0.999);
    assert.equal(f.agent.harvestPrepared, false, key);
    assert.equal(f.food.amount, 6, key);
    assert.equal(f.agent.carrying, 0, key);
    advanceTo(f, 1);
    assert.equal(f.agent.harvestPrepared, true, key);
    assert.equal(f.agent.harvestReady, 121 + harvestSeconds, key + " DNA harvest deadline");
    advanceTo(f, 1 + harvestSeconds - 0.001);
    assert.equal(f.food.amount, 6, key + " no early depletion");
    assert.equal(f.agent.carrying, 0, key + " no early cargo");
    assert.equal(f.agent.harvestResult, null, key);
    advanceTo(f, 1 + harvestSeconds);
    assert.equal(f.food.amount, 5, key);
    assert.equal(f.agent.carrying, 1, key);
    assert.equal(f.agent.carryingType, key);
    assert.equal(f.agent.harvestResult.completedAt, 121 + harvestSeconds, key);
    assert.equal(f.agent.harvestResult.amount, 1, key);
    assert.equal(f.agent.harvestResult.remaining, 5, key);
  }
});

test("기존 3세대 월드에도 삭제 자원을 생성하지 않는다", () => {
  const world = generateWorld(731047, 3);
  for (const point of [...world.food, ...world.resources]) {
    assert.ok(!["nutrients", "sand", "grass-fiber", "iron-ore", "copper-ore", "quartz", "root-fiber"].includes(point[3]));
  }
});
