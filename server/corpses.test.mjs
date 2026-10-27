import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";
import { createEncounters } from "./encounters.mjs";
import { canHarvestResource } from "./resources.mjs";
import { CORPSE_LIFETIME } from "./lifespan.mjs";
import { BEETLE_ANIMATIONS } from "./beetle-animation.mjs";
import { createRoom, saveRoom, restoreRoom } from "../client/room.mjs";

function fixture(tribe) {
  const colony = { id: 1, ownerId: "corpse-test", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { seed: 13, simSeconds: 0, world: { seed: 13, generationVersion: 11, sites: [[42,42]],
    terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), burrows: [] },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  return { game, environment };
}

function collect(game, agent, food) {
  Object.assign(agent, { x: food.x, y: food.y, renderFromX: food.x, renderFromY: food.y,
    moveStartedAt: 0, moveDuration: 0, moveBudget: 0, carrying: 0, carryingType: null,
    mode: "approach", birth: null, decisionPending: null, nextDecisionAt: 1000,
    utility: { action: "collect", target: { x: food.x, y: food.y, key: food.key || food.x + "," + food.y },
      route: [{ x: food.x, y: food.y }], plannedCargo: 1 } });
  game.snapshot();
}

test("사체는 자원·다른 사체와 같은 사망 칸에 남고 발견 기록을 만들지 않는다", () => {
  const { game, environment } = fixture("bean");
  const resource = { x: 46, y: 42, amount: 7, resourceType: "clay", kind: "resource" };
  environment.food.set("46,42", resource);
  for (const agent of [...game.agents]) {
    Object.assign(agent, { x: 46, y: 42, renderFromX: 46, renderFromY: 42 });
    game.receiveDamage(agent, 1000);
  }
  const snapshot = game.snapshot();
  assert.equal(environment.food.get("46,42"), resource);
  assert.equal(resource.amount, 7);
  assert.equal(snapshot.corpses.length, 2);
  assert.equal(new Set(snapshot.corpses.map(cell => cell.key)).size, 2);
  for (const corpse of snapshot.corpses) assert.deepEqual([corpse.x, corpse.y], [46,42]);
  assert.ok(snapshot.discoveries.some(entry => entry.key === "material:clay"));
  assert.ok(snapshot.discoveries.every(entry => entry.kind !== "corpse"));
  assert.ok(!game.discoveredKinds.has("corpse:meat"));
  game.prepare(CORPSE_LIFETIME); game.tick(0);
  assert.equal(game.snapshot().corpses.length, 0);
  assert.equal(environment.food.get("46,42").amount, 7);
});

test("옛 저장의 사체 발견을 제거하며 다른 발견과 읽음 상태는 보존한다", () => {
  const { game } = fixture("bean");
  const saved = JSON.parse(game.save());
  saved.state.discoveries = [
    { key: "material:clay", kind: "material", name: "비옥토" },
    { key: "corpse:meat", kind: "corpse", name: "사체" },
    { key: "material:sand", kind: "material", name: "모래" },
    { key: "corpse:carapace", kind: "corpse", name: "사체" },
    { key: "material:dew", kind: "material", name: "이슬방울" }
  ];
  saved.state.discoveryReadCount = 3;
  game.restore(JSON.stringify(saved));
  const snapshot = game.snapshot();
  assert.equal(snapshot.discoveryReadCount, 2);
  assert.ok(snapshot.discoveries.every(entry => entry.kind !== "corpse"));
  assert.deepEqual(snapshot.discoveries.slice(0,3).map(entry => entry.key), ["material:clay","material:sand","material:dew"]);
  assert.ok(!game.discoveredKinds.has("corpse:meat"));
});

test("유닛은 채집 속성이 없어도 사체가 놓인 칸을 통과한다", () => {
  const { game, environment } = fixture("bean");
  const [walker, victim] = game.agents;
  Object.assign(victim, { x: 47, y: 42 });
  game.receiveDamage(victim, 1000);
  const corpse = game.snapshot().corpses[0];
  const target = { x: 48, y: 42, amount: 3, resourceType: "clay", kind: "resource" };
  environment.food.set("48,42", target);
  collect(game, walker, target);
  Object.assign(walker, { x: 46, y: 42, renderFromX: 46, renderFromY: 42, moveBudget: 1 });
  walker.utility.route = [{ x: 46, y: 42 }, { x: 47, y: 42 }, { x: 48, y: 42 }];
  assert.equal(canHarvestResource(corpse, environment.world, walker.attributes, "bean"), false);
  game.prepare(0); game.tick(0);
  assert.deepEqual([walker.x, walker.y], [47,42]);
  game.prepare(2); game.tick(2);
  assert.deepEqual([walker.x, walker.y], [48,42]);
  assert.equal(environment.food.get(corpse.key).amount, corpse.amount);
});

test("겹친 사체도 지정한 대상을 채집하고 원래 자원을 보존한다", () => {
  const { game, environment } = fixture("bean");
  const saved = JSON.parse(game.save());
  saved.state.evolutionPoints = 10;
  game.restore(JSON.stringify(saved));
  const designed = game.command({ type: "design", templateId: null, name: "분해 유닛", slots: ["butchery"], birth: true });
  game.restore(game.save());
  const victim = game.agents[0];
  const harvester = game.agents.find(agent => agent.id === designed.agentId);
  assert.equal(harvester.attributes.butchery, 1);
  assert.equal(harvester.attributes.strength, 0);
  assert.equal(harvester.stats.capacity, 1);
  const resource = { x: 46, y: 42, amount: 7, resourceType: "clay", kind: "resource" };
  environment.food.set("46,42", resource);
  Object.assign(victim, { x: 46, y: 42 });
  game.receiveDamage(victim, 1000);
  const corpse = game.snapshot().corpses[0], before = corpse.amount;
  collect(game, harvester, corpse);
  game.prepare(0); game.tick(0);
  assert.equal(harvester.mode, "harvest");
  game.prepare(1); game.tick(1);
  game.prepare(2.501); game.tick(1.501);
  assert.equal(harvester.carryingType, "meat");
  assert.equal(harvester.carrying, 1);
  assert.equal(environment.food.get(corpse.key).amount, before - 1);
  assert.equal(resource.amount, 7);
});

test("고기 채집은 별도 속성으로 해금하고 네 종족의 시작 유닛은 모두 채집하지 못한다", () => {
  const corpse = { x: 46, y: 42, kind: "corpse", resourceType: "meat", amount: 4 };
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const { game, environment } = fixture(tribe);
    assert.equal(canHarvestResource(corpse, environment.world, {}, tribe), false, tribe);
    assert.equal(canHarvestResource(corpse, environment.world, { strength: 1 }, tribe), false, tribe);
    assert.equal(canHarvestResource(corpse, environment.world, { strength: 5 }, tribe), false, tribe);
    assert.equal(canHarvestResource(corpse, environment.world, { butchery: 1 }, tribe), true, tribe);
    assert.equal(canHarvestResource(corpse, environment.world, { butchery: 1, strength: 1 }, tribe), true, tribe);
    assert.equal(game.agents.filter(agent => canHarvestResource(corpse, environment.world, agent.attributes, tribe)).length, 0, tribe);
    const [victim, harvester] = game.agents;
    Object.assign(victim, { x: 46, y: 42 });
    game.receiveDamage(victim, 1000);
    const remains = game.snapshot().corpses[0], amount = remains.amount;
    collect(game, harvester, remains);
    game.prepare(0); game.tick(0);
    game.prepare(5); game.tick(5);
    assert.equal(environment.food.get(remains.key).amount, amount, tribe);
    assert.notEqual(harvester.carryingType, "meat", tribe);
    assert.notEqual(harvester.harvestResult?.resourceType, "meat", tribe);
  }
});

test("딱정벌레와 중립 생물도 기존 자원을 밀지 않고 같은 칸에 사체를 남긴다", () => {
  const { environment } = fixture("bean");
  environment.world.burrows = [{ id: "burrow:small:64130", type: "small", x: 130, y: 200,
    width: 1, height: 1, entrance: { x: 130, y: 201 } }];
  const creatures = createCreatures(environment, null), beetle = creatures.agents[0];
  const resource = { x: beetle.x, y: beetle.y, amount: 7, resourceType: "clay", kind: "resource" };
  const position = beetle.x + "," + beetle.y;
  environment.food.set(position, resource);
  creatures.receiveDamage(beetle, 1000);
  environment.simSeconds = BEETLE_ANIMATIONS.death.durationMs / 1000;
  creatures.tick();
  const corpse = [...environment.food.values()].find(cell => cell.agentId === beetle.id);
  assert.deepEqual([corpse.x, corpse.y], [beetle.x, beetle.y]);
  assert.equal(environment.food.get(position), resource);
  const index = 150 * 320 + 150;
  environment.world.encounters = [{ key: "dew-rabbit", x: 150, y: 150, cells: [index], terrains: [4], nearWater: false }];
  const rabbit = { id: "rabbit-test", species: "dew-rabbit", x: 150, y: 150, health: 1, stats: { health: 14, combatStrength: 10, speed: .5, attack: 1, vision: 4 }, moveStartedAt: 0, nextActionAt: 0 };
  const encounters = createEncounters(environment, { version: 1, agents: [rabbit], kills: {}, records: [
    { key: "dew-rabbit", x: 150, y: 150, sequence: 1, spawned: true, dead: false, missingSince: null, nextSpawnAt: null, warningUntil: null }
  ] }, []);
  environment.food.set("150,150", { x: 150, y: 150, amount: 5, resourceType: "clay" });
  encounters.receiveDamage(rabbit, 100);
  const remains = [...environment.food.values()].find(cell => cell.agentId === rabbit.id);
  assert.deepEqual([remains.x, remains.y], [150,150]);
  assert.equal(environment.food.get("150,150").amount, 5);
});

test("동일 칸의 원래 자원과 여러 사체를 저장·복원한다", () => {
  const room = createRoom("사체 저장", 13, "bean");
  const game = room.games.get(room.hostId), victim = game.agents[0];
  const resource = [...room.food.values()].find(cell => cell.amount > 0 && cell.resourceType === "clay");
  Object.assign(victim, { x: resource.x, y: resource.y });
  game.receiveDamage(victim, 1000);
  const corpse = [...room.food.values()].find(cell => cell.agentId === victim.id);
  const restored = restoreRoom(saveRoom(room));
  assert.deepEqual(restored.food.get(corpse.key), corpse);
  assert.deepEqual(restored.food.get(resource.x + "," + resource.y), resource);
});


test("아군 사체는 부패 직전까지 반경 1칸을 밝히고 사라지면 시야도 끝난다", () => {
  for (const cause of ["age", "combat"]) {
    const { game } = fixture("bean");
    game.agents.splice(1);
    const victim = game.agents[0];
    Object.assign(victim, { x: 100, y: 100, renderFromX: 100, renderFromY: 100, moveDuration: 0 });
    const deathAt = cause === "age" ? 180 : 10;
    game.prepare(deathAt);
    if (cause === "age") game.tick(0);
    else game.receiveDamage(victim, 1000);
    let snapshot = game.snapshot();
    assert.equal(snapshot.corpses.length, 1);
    assert.equal(snapshot.corpses[0].decaysAt, deathAt + 300);
    for (const [x, y] of [[100,100], [99,100], [101,100], [100,99], [100,101]]) assert.equal(game.isVisible(x, y), true);
    assert.equal(game.isVisible(102, 100), false);
    assert.equal(game.isVisible(101, 101), false);
    game.prepare(deathAt + 299.999); game.tick(0);
    assert.equal(game.isVisible(100, 100), true);
    game.prepare(deathAt + 300); game.tick(0);
    snapshot = game.snapshot();
    assert.equal(snapshot.corpses.length, 0);
    assert.equal(game.isVisible(100, 100), false);
    assert.ok(snapshot.explored.includes(100 * 320 + 100));
  }
});

test("적 사체와 회수된 아군 사체는 시야를 제공하지 않는다", () => {
  const { game, environment } = fixture("bean");
  game.agents.splice(0);
  const corpse = { kind: "corpse", colonyId: 2, x: 100, y: 100, amount: 4, diedAt: 0, decaysAt: 300 };
  environment.food.set("100,100", corpse);
  game.snapshot();
  assert.equal(game.isVisible(100, 100), false);
  corpse.colonyId = 1;
  game.snapshot();
  assert.equal(game.isVisible(100, 100), true);
  corpse.amount = 0;
  game.snapshot();
  assert.equal(game.isVisible(100, 100), false);
});
