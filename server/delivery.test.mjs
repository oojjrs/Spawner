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
  Object.assign(agent, { x, y, renderFromX: x, renderFromY: y, carrying: 2, mode: "search", utility: null,
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
