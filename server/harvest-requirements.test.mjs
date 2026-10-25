import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ATTRIBUTES, attributeCounts } from "./attributes.mjs";
import { RESOURCE_TYPES, canHarvestResource, resourceHarvestRequirements, resourceDefinition } from "./resources.mjs";
import { isTreeFood } from "./food.mjs";
import { createGame } from "./game.mjs";
import { generateWorld } from "./world.mjs";

const requirements = {
  "tree-fruit": ["harvest", "climbing"],
  "berry-bush": ["harvest"], "seed-pods": ["harvest"], "nutrient-moss": ["harvest"],
  "root-bulbs": ["digging"], clay: [],
  sand: ["harvest"], pebbles: ["strength"],
  "grass-fiber": ["harvest", "strength"],
  meat: ["harvest", "strength"],
  "iron-ore": ["digging", "strength", "strength"], "copper-ore": ["digging", "strength", "strength"],
  quartz: ["digging", "strength", "strength"]
};

function fixture(resourceType, slots) {
  const colony = { id: 1, ownerId: "requirements-test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const terrain = resourceType === "tree-fruit" ? "forest" : "grassland";
  const food = { x: 46, y: 42, amount: 6, initialAmount: 6, resourceType, terrain,
    kind: resourceType === "meat" ? "corpse" : undefined };
  const environment = { simSeconds: 120, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
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

test("채집 가능한 먹이·자원의 필요 속성을 승인된 조합과 개수대로 검사한다", () => {
  const world = { hazards: new Uint8Array(320 * 320) };
  assert.equal(RESOURCE_TYPES.filter(entry => !entry.harvestLocked).length, Object.keys(requirements).length);
  assert.equal(resourceDefinition("tree").harvestLocked, true);
  assert.equal(resourceHarvestRequirements({ resourceType: "tree" }, world), null);
  assert.equal(canHarvestResource({ resourceType: "tree" }, world, attributeCounts(ATTRIBUTES.flatMap(item => [item.key, item.key]))), false);
  assert.equal(resourceHarvestRequirements(null, world), null);
  assert.equal(canHarvestResource({ resourceType: "unknown" }, world, attributeCounts(ATTRIBUTES.map(item => item.key))), false);
  for (const [key, slots] of Object.entries(requirements)) {
    const food = { x: 46, y: 42, terrain: key === "tree-fruit" ? "forest" : "grassland", resourceType: key };
    assert.deepEqual(resourceHarvestRequirements(food, world), attributeCounts(slots), key);
    assert.equal(canHarvestResource(food, world, attributeCounts(slots)), true, key);
    for (let index = 0; index < slots.length; index++) {
      assert.equal(canHarvestResource(food, world, attributeCounts(slots.filter((slot, candidate) => candidate !== index))), false, key);
    }
  }
});

test("나무 열매는 등반과 채집이 필요하고 낮은 덤불·떨어진 열매에는 등반을 요구하지 않는다", () => {
  const world = { hazards: new Uint8Array(320 * 320) };
  const fruit = { x: 46, y: 42, terrain: "forest", resourceType: "tree-fruit" };
  assert.equal(isTreeFood(fruit, world), true);
  assert.equal(canHarvestResource(fruit, world, attributeCounts(["harvest"])), false);
  assert.equal(canHarvestResource(fruit, world, attributeCounts(["climbing"])), false);
  assert.equal(canHarvestResource(fruit, world, attributeCounts(["harvest", "climbing"])), true);
  assert.equal(canHarvestResource({ ...fruit, resourceType: "berry-bush" }, world, attributeCounts(["harvest"])), true);
  assert.equal(isTreeFood({ ...fruit, kind: "food" }, world), false);
  assert.equal(canHarvestResource({ ...fruit, kind: "food" }, world, attributeCounts(["harvest"])), true);
  const legacy = { x: 46, y: 42, terrain: "forest" };
  assert.equal(canHarvestResource(legacy, world, attributeCounts(["harvest"])), false);
  assert.equal(canHarvestResource(legacy, world, attributeCounts(["harvest", "climbing"])), true);
});

test("필요한 속성을 갖춘 개체만 실제 준비·수확을 마치고 종류별 적재물을 얻는다", () => {
  for (const [key, slots] of Object.entries(requirements)) {
    const f = fixture(key, slots);
    advanceTo(f, 0);
    assert.equal(f.agent.mode, "harvest", key);
    advanceTo(f, 1);
    advanceTo(f, 1 + resourceDefinition(key).harvestSeconds + 0.001);
    assert.equal(f.food.amount, 5, key);
    assert.equal(f.agent.carrying, 1, key);
    assert.equal(f.agent.carryingType, key);
  }
});

test("필요 속성이 하나라도 부족하면 기존 접근 명령을 취소하고 수확·적재를 하지 않는다", () => {
  for (const [key, slots] of Object.entries(requirements)) {
    for (let index = 0; index < slots.length; index++) {
      const f = fixture(key, slots.filter((slot, candidate) => candidate !== index));
      advanceTo(f, 0);
      advanceTo(f, 10);
      assert.equal(f.food.amount, 6, key);
      assert.equal(f.agent.carrying, 0, key);
      assert.equal(f.agent.harvestResult, null, key);
      assert.ok(!f.agent.utility?.scores.some(score => score.action === "collect" && score.key === "46,42"), key);
    }
  }
});

test("수확 도중 능력을 잃은 저장을 복원하면 즉시 수확을 취소하고 새 속성 설계는 저장된다", () => {
  for (const key of ["root-bulbs", "quartz", "tree-fruit"]) {
    const f = fixture(key, requirements[key]);
    advanceTo(f, 0);
    advanceTo(f, 1);
    const saved = JSON.parse(f.game.save());
    saved.state.agents[0].slots = [];
    f.game.restore(JSON.stringify(saved));
    f.agent = f.game.agents[0];
    advanceTo(f, 10);
    assert.equal(f.food.amount, 6, key);
    assert.equal(f.agent.carrying, 0);
    assert.notEqual(f.agent.utility?.action, "collect");
    f.game.command({ type: "design", name: "새 채집 개체", templateId: null, slots: requirements[key], birth: true });
    f.game.restore(f.game.save());
    assert.deepEqual(f.game.snapshot().templates.at(-1).slots, requirements[key]);
    const agent = f.game.agents.at(-1);
    assert.deepEqual(agent.slots, requirements[key]);
    assert.deepEqual(agent.activeSlots, requirements[key].slice(0, 1));
    assert.deepEqual(agent.attributes, attributeCounts(requirements[key].slice(0, 1)));
    assert.ok(Object.values(agent.stats).every(Number.isFinite));
  }
});

test("기존 3세대 저장은 먹이·자원 배치를 유지한다", () => {
  const world = generateWorld(731047, 3);
  const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  assert.equal(digest(world.food), "de3df889f14e4213050129448300ce4be9121999a7483fe3f577a4634b2826bc");
  assert.equal(digest(world.resources), "963e0274b0373c29652255d73c01bd8f6fe9588d9ea6228c82c064b9d005460f");
});
