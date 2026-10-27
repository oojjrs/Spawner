import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";

function fixture(x, y) {
  const colony = { id: 1, ownerId: "test", x: 40, y: 40, occupiedCells: new Set([
    "1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2",
    "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"
  ]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set("test", game);
  game.agents.splice(1);
  const agent = game.agents[0];
  Object.assign(agent, { x, y, renderFromX: x, renderFromY: y, carrying: 2, carryingType: "clay", mode: "search", utility: null,
    birth: null, moveStartedAt: 0, moveDuration: 0, moveBudget: 0, decisionPending: "completed",
    personality: Object.freeze({ boldness: 0, aggression: 0, curiosity: 0 }) });
  return { game, environment, agent };
}

function advance(fixture) {
  fixture.environment.simSeconds += 0.1;
  fixture.game.prepare(fixture.environment.simSeconds);
  fixture.game.tick(0.1);
}

function deliver(fixture, x, y) {
  for (let step = 0; step < 150 && fixture.game.snapshot().colonyFood === 0; step++) {
    advance(fixture);
    if (fixture.agent.mode === "unload") {
      assert.deepEqual([fixture.agent.x, fixture.agent.y], [x, y]);
      assert.ok(fixture.environment.simSeconds - fixture.agent.moveStartedAt >= fixture.agent.moveDuration);
    }
  }
  assert.equal(fixture.game.snapshot().colonyFood, 2);
  assert.equal(fixture.agent.carrying, 0);
  assert.deepEqual([fixture.agent.foodDelivery.x, fixture.agent.foodDelivery.y], [x + 0.5, y + 0.5]);
}

test("둥지 바깥에서 반납하지 않고 5×5의 빈 모퉁이 네 칸까지 이동한 뒤 하역한다", () => {
  for (const [x, y, cornerX, cornerY] of [[42, 39, 40, 40], [45, 42, 44, 40],
    [42, 45, 40, 44], [39, 43, 40, 44]]) {
    const f = fixture(x, y);
    advance(f);
    assert.equal(f.agent.mode, "return");
    assert.equal(f.game.snapshot().colonyFood, 0);
    assert.equal(f.agent.carrying, 2);
    assert.deepEqual([f.agent.utility.target.x, f.agent.utility.target.y], [cornerX, cornerY]);
    deliver(f, cornerX, cornerY);
  }
});

test("막힌 모퉁이는 반납 목적지에서 제외한다", () => {
  const f = fixture(42, 39);
  f.environment.world.terrain[40 * 320 + 40] = 0;
  deliver(f, 44, 40);
});

test("기존 저장에서 둥지 바깥의 하역을 복원해도 모퉁이에 도착하기 전에는 반납하지 않는다", () => {
  const f = fixture(42, 39);
  Object.assign(f.agent, { mode: "unload", decisionPending: null, nextDecisionAt: 1000, unloadReady: 0,
    utility: { action: "return", target: { x: 42, y: 39, key: "home" }, route: [{ x: 42, y: 39 }] },
    foodDelivery: { colonyId: 1, x: 42.5, y: 39.5, startedAt: -1, arrivesAt: 0, receivedAt: null, amount: 2 } });
  f.game.restore(f.game.save());
  f.agent = f.game.agents[0];
  advance(f);
  assert.equal(f.game.snapshot().colonyFood, 0);
  assert.equal(f.agent.carrying, 2);
  assert.equal(f.agent.foodDelivery, null);
  deliver(f, 40, 40);
});

test("재료는 포인트 창고가 가득 차도 이동·하역하고 저장 복원 중 종류와 재고를 보존한다", () => {
  const f = fixture(46, 42);
  f.agent.carryingType = "iron-ore";
  const saved = JSON.parse(f.game.save());
  saved.state.evolutionPoints = 100;
  saved.state.resourceInventory = { dew: 3 };
  f.game.restore(JSON.stringify(saved));
  f.agent = f.game.agents[0];
  let throwing = false;
  for (let step = 0; step < 200 && !f.game.snapshot().resourceInventory["iron-ore"]; step++) {
    const saved = f.game.save();
    f.game = createGame(f.environment, f.environment.colonies[0]);
    f.game.restore(saved);
    f.environment.games.set("test", f.game);
    f.agent = f.game.agents[0];
    advance(f);
    if (f.agent.foodDelivery?.receivedAt === null) {
      throwing = true;
      assert.equal(f.agent.foodDelivery.resourceType, "iron-ore");
      assert.equal(f.agent.carryingType, "iron-ore");
    }
  }
  const snapshot = f.game.snapshot();
  assert.ok(throwing);
  assert.deepEqual(snapshot.resourceInventory, { dew: 3, "iron-ore": 2 });
  assert.equal(snapshot.evolutionPoints, 100);
  assert.equal(snapshot.colonyFood, 0);
  assert.equal(f.agent.carrying, 0);
  assert.equal(f.agent.carryingType, null);
  assert.equal(f.agent.foodDelivery.resourceType, "iron-ore");
  f.game.restore(f.game.save());
  assert.deepEqual(f.game.snapshot().resourceInventory, snapshot.resourceInventory);
});

test("식량 창고가 가득 차도 잠긴 재료를 채집하거나 운반하지 않는다", () => {
  const f = fixture(46, 42);
  Object.assign(f.agent, { carrying: 0, carryingType: null, actionPriorities: ["collect", "explore"] });
  const node = { x: 46, y: 42, amount: 6, terrain: "grassland", kind: "resource", resourceType: "grass-fiber" };
  f.environment.food.set("46,42", node);
  const saved = JSON.parse(f.game.save());
  saved.state.evolutionPoints = 100;
  f.game.restore(JSON.stringify(saved));
  f.agent = f.game.agents[0];
  let collected = false;
  for (let step = 0; step < 400 && !f.game.snapshot().resourceInventory["grass-fiber"]; step++) {
    if (step % 5 === 0) {
      const saved = f.game.save();
      f.game = createGame(f.environment, f.environment.colonies[0]);
      f.game.restore(saved);
      f.environment.games.set("test", f.game);
      f.agent = f.game.agents[0];
    }
    advance(f);
    if (f.agent.carrying > 0) {
      collected = true;
      assert.equal(f.agent.carryingType, "grass-fiber");
    }
  }
  assert.equal(collected, false);
  assert.equal(node.amount, 6);
  assert.equal(f.game.snapshot().resourceInventory["grass-fiber"], undefined);
  assert.equal(f.game.snapshot().evolutionPoints, 100);
  assert.equal(f.game.snapshot().colonyFood, 0);
});

test("수확 중 다른 종류로 바뀐 목표는 음식끼리도 섞지 않고 적재물을 반납한다", () => {
  for (const [carryingType, resourceType] of [["honey-mushrooms", "berry-bush"], ["iron-ore", "bark"]]) {
    const f = fixture(46, 42);
    const node = { x: 46, y: 42, amount: 8, terrain: "grassland", resourceType };
    f.environment.food.set("46,42", node);
    Object.assign(f.agent, { carrying: 1, carryingType, mode: "harvest", harvestReady: 0,
      decisionPending: null, nextDecisionAt: 1000,
      utility: { action: "collect", target: { x: 46, y: 42, key: "46,42" }, route: [{ x: 46, y: 42 }], plannedCargo: 2 } });
    advance(f);
    assert.equal(node.amount, 8);
    assert.equal(f.agent.carrying, 1);
    assert.equal(f.agent.carryingType, carryingType);
    assert.equal(f.agent.utility.action, "return");
  }
});

test("옛 저장의 적재물은 버섯으로 복원하고 새 재료 재고가 이전 복원의 값을 물려받지 않는다", () => {
  const f = fixture(46, 42);
  const saved = JSON.parse(f.game.save());
  delete saved.state.agents[0].carryingType;
  delete saved.state.resourceInventory;
  f.game.restore(JSON.stringify({ state: { ...saved.state, resourceInventory: { quartz: 9 } } }));
  f.game.restore(JSON.stringify(saved));
  assert.equal(f.game.agents[0].carryingType, "honey-mushrooms");
  assert.deepEqual(f.game.snapshot().resourceInventory, {});
});

test("사망한 운반자의 재료는 같은 종류로 떨어지고 고기량이나 식량 포인트로 변환되지 않는다", () => {
  const f = fixture(46, 42);
  Object.assign(f.agent, { carrying: 3, carryingType: "iron-ore" });
  const points = f.game.snapshot().evolutionPoints;
  f.game.receiveDamage(f.agent, f.agent.health);
  const nodes = [...f.environment.food.values()];
  assert.equal(nodes.filter(node => node.resourceType === "iron-ore").reduce((sum, node) => sum + node.amount, 0), 3);
  const corpse = nodes.find(node => node.kind === "corpse");
  assert.equal(corpse.resourceType, "meat");
  assert.equal(corpse.amount, Math.max(1, Math.floor(f.agent.cost / 2)));
  assert.equal(f.game.snapshot().evolutionPoints, points);
  assert.equal(f.game.snapshot().colonyFood, 0);
});
