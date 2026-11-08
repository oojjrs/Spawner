import test from "node:test";
import assert from "node:assert/strict";
import { createDecisionPool } from "./decision-pool.mjs";

function fixture() {
  const previous = ["Worker", "SpawnerDecisionWorkerSource"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const workers = [];
  globalThis.SpawnerDecisionWorkerSource = "self.onmessage = () => {};";
  globalThis.Worker = class {
    constructor() { this.messages = []; this.terminated = false; workers.push(this); }
    postMessage(packet) { this.messages.push(structuredClone(packet)); }
    terminate() { this.terminated = true; }
    emit(data) { this.onmessage({ data }); }
  };
  const agent = { id: "agent", x: 4, y: 5, health: 10, level: 1, carrying: 0, attributes: {}, survivalState: "stable" };
  const game = { agents: [agent], buildings: [], nest: null,
    planDecisions() { throw new Error("AI must not execute on the game worker"); },
    save() { throw new Error("AI must not serialize the whole game"); },
    decisionSnapshot() { return { state: { agents: this.agents, explored: new Set([1]), knownFood: new Map() } }; }
  };
  const room = { simSeconds: 1, hostId: "owner", world: { size: 160 }, food: new Map(), colonies: [],
    games: new Map([["owner", game]]), creatureSystem: { agents: [], burrows: [] } };
  const planner = createDecisionPool(room);
  function answer(worker) {
    const packet = worker.messages.findLast(message => message.type === "plan");
    worker.emit({ results: packet.requests.map(request => ({ ...request, time: room.simSeconds,
      candidates: [{ action: "wait", target: { key: "wait" } }] })) });
  }
  function restore() {
    planner.dispose();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
  return { room, game, agent, workers, planner, answer, restore };
}

test("별도 판단 워커는 게임 계산을 실행하지 않고 Map과 Set 상태를 전달한다", () => {
  const f = fixture();
  try {
    assert.equal(f.planner.request("owner", f.agent, "periodic"), undefined);
    f.planner.flush();
    const worker = f.workers[0], packet = worker.messages.find(message => message.type === "plan");
    assert.ok(packet.saved.state.explored instanceof Set);
    assert.ok(packet.saved.state.knownFood instanceof Map);
    assert.equal(typeof packet.saved, "object");
    assert.equal(f.planner.request("owner", f.agent, "periodic"), undefined);
    f.answer(worker);
    assert.deepEqual(f.planner.request("owner", f.agent, "periodic"), [{ action: "wait", target: { key: "wait" } }]);
  } finally { f.restore(); }
});

test("이동·생존 상태·판단 이유가 바뀐 응답은 적용하지 않고 새 상태로 요청한다", () => {
  for (const kind of ["move", "survival", "reason"]) {
    const f = fixture();
    try {
      f.planner.request("owner", f.agent, "periodic"); f.planner.flush(); f.answer(f.workers[0]);
      if (kind === "move") f.agent.x++;
      if (kind === "survival") { f.agent.survivalState = "critical"; f.agent.retreat = { recoverHealth: 7 }; }
      const reason = kind === "reason" ? "defense" : "periodic";
      assert.equal(f.planner.request("owner", f.agent, reason), undefined);
      f.planner.flush(); f.answer(f.workers[0]);
      assert.deepEqual(f.planner.request("owner", f.agent, reason), [{ action: "wait", target: { key: "wait" } }]);
    } finally { f.restore(); }
  }
});

test("판단 워커 오류는 재시도하고 종료하면 워커와 대기 요청을 정리한다", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "performance");
  let clock = 0;
  Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
  const f = fixture();
  try {
    f.planner.request("owner", f.agent, "periodic"); f.planner.flush();
    f.workers[0].emit({ error: "planning failed" });
    assert.equal(f.workers[0].terminated, true);
    clock = 1100; f.planner.flush();
    assert.equal(f.workers.length, 2);
    f.answer(f.workers[1]);
    assert.ok(f.planner.request("owner", f.agent, "periodic"));
    f.planner.dispose();
    assert.equal(f.workers[1].terminated, true);
    assert.equal(f.room.decisionPlanner, null);
    f.planner.request("owner", f.agent, "periodic"); f.planner.flush();
    assert.equal(f.workers.length, 2);
  } finally { f.restore(); Object.defineProperty(globalThis, "performance", descriptor); }
});