import test from "node:test";
import assert from "node:assert/strict";
import { createDecisionPool } from "./decision-pool.mjs";

function fixture() {
  const calls = [], room = { simSeconds: 1, world: { size: 160 }, games: new Map(), creatureSystem: { agents: [] } };
  for (let owner = 0; owner < 4; owner++) {
    const agents = Array.from({ length: 100 }, (_, index) => ({ id: String(index), x: index, y: owner * 30,
      health: 10, carrying: 0, carryingType: null, attributes: {}, level: 1 }));
    const key = String(owner);
    room.games.set(key, { agents, save() { throw new Error("Decision planning must not serialize a game"); },
      planDecisions(requests) {
        assert.ok(room.unitIndex);
        calls.push({ owner: key, ids: requests.map(request => request.id) });
        return requests.map(request => [{ action: "collect", x: agents.find(agent => agent.id === request.id).x }]);
      } });
  }
  return { room, calls, planner: createDecisionPool(room) };
}

test("400개 판단은 상태 복사 없이 기존 공간 인덱스를 공유하며 군락별 네 개씩 모두 처리한다", () => {
  const f = fixture(), sentinel = {}, originalWorker = globalThis.Worker;
  globalThis.Worker = class { constructor() { throw new Error("Decision planning must not create a Worker"); } };
  f.room.unitIndex = sentinel;
  try {
    for (const [owner, game] of f.room.games) for (const agent of game.agents) f.planner.request(owner, agent, "periodic");
    f.planner.flush();
    assert.ok(f.calls.length >= 1 && f.calls.length <= 4);
    assert.ok(f.calls.every(call => call.ids.length === 4));
    assert.equal(f.room.unitIndex, sentinel);
    for (let round = 0; round < 100 && f.calls.length < 100; round++) f.planner.flush();
    assert.equal(f.calls.flatMap(call => call.ids).length, 400);
    for (const [owner, game] of f.room.games) for (const agent of game.agents)
      assert.deepEqual(f.planner.request(owner, agent, "periodic"), [{ action: "collect", x: Number(agent.id) }]);
    assert.ok([...f.room.games.values()].every(game => game.agents.every(agent => agent.health === 10 && agent.x === Number(agent.id))));
  } finally { f.planner.dispose(); globalThis.Worker = originalWorker; }
});

test("이동하거나 1초가 지난 판단은 현재 상태로 다시 요청한다", () => {
  const f = fixture(), agent = f.room.games.get("0").agents[0];
  f.planner.request("0", agent, "completed"); f.planner.flush();
  agent.x = 2;
  assert.equal(f.planner.request("0", agent, "completed"), undefined);
  f.planner.flush();
  assert.deepEqual(f.planner.request("0", agent, "completed"), [{ action: "collect", x: 2 }]);
  f.planner.flush();
  f.planner.request("0", agent, "periodic"); f.planner.flush();
  f.room.simSeconds += 2;
  assert.equal(f.planner.request("0", agent, "periodic"), undefined);
  f.planner.flush();
  assert.deepEqual(f.planner.request("0", agent, "periodic"), [{ action: "collect", x: 2 }]);
  assert.equal(f.room.unitIndex, undefined);
  f.planner.dispose();
});

test("죽거나 교전 중인 대기 요청은 제외하고 빈 결과도 한 번 소비한다", () => {
  const f = fixture(), game = f.room.games.get("0"), agents = game.agents.slice(0, 3);
  for (const agent of agents) f.planner.request("0", agent, "periodic");
  agents[0].health = 0; agents[1].combat = {};
  game.planDecisions = requests => { assert.deepEqual(requests.map(request => request.id), [agents[2].id]); return [[]]; };
  f.planner.flush();
  assert.deepEqual(f.planner.request("0", agents[2], "periodic"), []);
  f.planner.dispose();
});

test("판단 실패 후 인덱스를 복원하고 종료 뒤에는 대기 작업을 실행하지 않는다", () => {
  const f = fixture(), game = f.room.games.get("0"), agent = game.agents[0];
  game.planDecisions = () => { throw new Error("planning failed"); };
  f.planner.request("0", agent, "periodic");
  assert.throws(() => f.planner.flush(), /planning failed/);
  assert.equal(f.room.unitIndex, undefined);
  f.planner.dispose();
  f.planner.request("0", agent, "periodic");
  assert.doesNotThrow(() => f.planner.flush());
  assert.equal(f.room.decisionPlanner, null);
});
test("오래 걸린 판단은 다음 틱으로 분산하고 군락 순환으로 요청을 빠짐없이 처리한다", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "performance");
  let clock = 0;
  Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
  const f = fixture();
  try {
    for (const [owner, game] of f.room.games) {
      const evaluate = game.planDecisions;
      game.planDecisions = requests => { clock += 50; return evaluate(requests); };
      for (const agent of game.agents) f.planner.request(owner, agent, "periodic");
    }
    f.planner.flush();
    assert.equal(f.calls.length, 1);
    for (let round = 1; round < 100; round++) f.planner.flush();
    for (const owner of f.room.games.keys()) {
      const ids = f.calls.filter(call => call.owner === owner).flatMap(call => call.ids);
      assert.equal(ids.length, 100);
      assert.equal(new Set(ids).size, 100);
    }
  } finally { f.planner.dispose(); Object.defineProperty(globalThis, "performance", descriptor); }
});