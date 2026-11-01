import test from "node:test";
import assert from "node:assert/strict";
import { createDecisionPool } from "./decision-pool.mjs";

function fixture() {
  const originalWorker = globalThis.Worker, workers = [];
  const originalPerformance = Object.getOwnPropertyDescriptor(globalThis, "performance");
  const clock = { now: 0, attempts: 0, failNext: false };
  Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock.now } });
  globalThis.Worker = class {
    constructor() {
      clock.attempts++;
      if (clock.failNext) { clock.failNext = false; throw new Error("Worker construction failed"); }
      this.messages = []; this.terminated = false; workers.push(this);
    }
    postMessage(message) {
      if (this.failNextMessage) { this.failNextMessage = false; throw new Error("Message failed"); }
      this.messages.push(structuredClone(message));
    }
    terminate() { this.terminated = true; }
  };
  const room = { simSeconds: 1, hostId: "0", world: {}, food: new Map(), colonies: [], games: new Map(),
    creatureSystem: { agents: [], burrows: [] } };
  for (let owner = 0; owner < 4; owner++) {
    const agents = Array.from({ length: 100 }, (_, index) => ({ id: String(index), x: index, y: owner * 30,
      health: 10, carrying: 0, carryingType: null, attributes: {}, level: 1 }));
    room.games.set(String(owner), { agents, buildings: [], nest: { health: 100 }, save: () => "saved", rememberForagers() {} });
  }
  const planner = createDecisionPool(room);
  return { room, planner, workers, clock, cleanup() {
    planner.dispose(); globalThis.Worker = originalWorker;
    Object.defineProperty(globalThis, "performance", originalPerformance);
  } };
}

function reply(worker, candidates) {
  const job = worker.messages.at(-1);
  worker.onmessage({ data: { results: job.requests.map(request => ({ ...request, time: job.simSeconds, candidates })) } });
  return job;
}

test("400개 판단 요청은 제한된 Worker와 4개 단위 작업으로 분산하며 원본 개체를 변경하지 않는다", () => {
  const f = fixture();
  try {
    const expected = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2));
    assert.equal(f.workers.length, expected);
    for (const [owner, game] of f.room.games) for (const agent of game.agents)
      assert.equal(f.planner.request(owner, agent, "periodic"), undefined);
    f.planner.flush();
    for (const worker of f.workers) {
      const job = worker.messages.at(-1);
      assert.equal(job.type, "plan");
      assert.equal(job.requests.length, 4);
      assert.equal(job.games.find(([owner]) => owner === job.owner)[1].agents.length, 0);
      assert.equal(job.games.filter(([owner]) => owner !== job.owner).reduce((sum, [, game]) => sum + game.agents.length, 0), 300);
    }
    const sent = f.workers.reduce((sum, worker) => sum + worker.messages.length, 0);
    f.planner.flush();
    assert.equal(f.workers.reduce((sum, worker) => sum + worker.messages.length, 0), sent);
    for (const game of f.room.games.values()) assert.ok(game.agents.every(agent => agent.x === Number(agent.id) && agent.health === 10));
    assert.equal(f.room.decisionPlanner, f.planner);
  } finally { f.cleanup(); }
});

test("이동하거나 화물을 바꾼 개체의 오래된 판단은 적용하지 않고 현재 상태로 다시 요청한다", () => {
  const f = fixture();
  try {
    const agent = f.room.games.get("0").agents[0];
    f.planner.request("0", agent, "completed"); f.planner.flush();
    const worker = f.workers.find(value => value.messages.at(-1).type === "plan");
    reply(worker, [{ action: "collect" }]);
    agent.x += 1;
    assert.equal(f.planner.request("0", agent, "completed"), undefined);
    f.planner.flush();
    const next = f.workers.find(value => value.messages.at(-1).type === "plan" && value.messages.at(-1).requests[0].signature.includes("[1,0,"));
    assert.ok(next);
    reply(next, [{ action: "return" }]);
    agent.carrying = 1;
    assert.equal(f.planner.request("0", agent, "completed"), undefined);
  } finally { f.cleanup(); }
});

test("유효한 빈 판단 결과도 소비하고 종료 시 모든 하위 Worker와 방 연결을 해제한다", () => {
  const f = fixture();
  try {
    const agent = f.room.games.get("0").agents[0];
    f.planner.request("0", agent, "periodic"); f.planner.flush();
    reply(f.workers[0], []);
    assert.deepEqual(f.planner.request("0", agent, "periodic"), []);
    f.planner.dispose();
    assert.ok(f.workers.every(worker => worker.terminated));
    assert.equal(f.room.decisionPlanner, null);
  } finally { f.cleanup(); }
});

test("오류가 난 Worker의 요청은 보존하고 정상 Worker는 계속 처리하며 1초 뒤 다시 생성한다", () => {
  const f = fixture();
  try {
    const agent = f.room.games.get("0").agents[0];
    f.planner.request("0", agent, "periodic"); f.planner.flush();
    const failed = f.workers[0], lateReply = failed.onmessage, count = f.workers.length;
    failed.onerror();
    assert.equal(failed.terminated, true);
    assert.equal(f.room.decisionPlanner, f.planner);
    assert.ok(f.workers.slice(1).every(worker => !worker.terminated));
    f.planner.flush();
    assert.equal(f.workers.length, count);
    lateReply({ data: { results: [{ ...failed.messages.at(-1).requests[0], time: 1, candidates: [{ action: "fight" }] }] } });
    assert.equal(f.planner.request("0", agent, "periodic"), undefined);
    f.clock.now = 999; f.planner.flush(); assert.equal(f.workers.length, count);
    f.clock.now = 1000; f.planner.flush(); assert.equal(f.workers.length, count + 1);
    const processor = f.workers.find(worker => !worker.terminated && worker.messages.at(-1).type === "plan");
    assert.ok(processor);
    reply(processor, [{ action: "collect" }]);
    assert.equal(f.planner.request("0", agent, "periodic")[0].action, "collect");
  } finally { f.cleanup(); }
});

test("연속 오류와 생성 실패의 재시도 간격은 최대 30초까지 늘고 성공하면 1초로 돌아온다", () => {
  const f = fixture();
  try {
    let worker = f.workers[0];
    worker.onerror();
    f.clock.failNext = true;
    f.clock.now = 1000; f.planner.flush();
    let attempts = f.clock.attempts;
    f.clock.now = 2999; f.planner.flush(); assert.equal(f.clock.attempts, attempts);
    f.clock.now = 3000; f.planner.flush(); assert.equal(f.clock.attempts, attempts + 1);
    worker = f.workers.at(-1);
    for (const delay of [4000, 8000, 16000, 30000, 30000]) {
      worker.onerror(); attempts = f.clock.attempts;
      f.clock.now += delay - 1; f.planner.flush(); assert.equal(f.clock.attempts, attempts);
      f.clock.now++; f.planner.flush(); assert.equal(f.clock.attempts, attempts + 1);
      worker = f.workers.at(-1);
    }
    const agent = f.room.games.get("0").agents[0];
    f.planner.request("0", agent, "periodic"); f.planner.flush(); reply(worker, []);
    assert.deepEqual(f.planner.request("0", agent, "periodic"), []);
    worker.onerror(); attempts = f.clock.attempts;
    f.clock.now += 999; f.planner.flush(); assert.equal(f.clock.attempts, attempts);
    f.clock.now++; f.planner.flush(); assert.equal(f.clock.attempts, attempts + 1);
  } finally { f.cleanup(); }
});

test("Worker 내부 오류·메시지 역직렬화 오류·10초 무응답도 요청을 잃지 않고 복구한다", () => {
  for (const fault of ["response", "message", "timeout"]) {
    const f = fixture();
    try {
      const agent = f.room.games.get("0").agents[0];
      f.planner.request("0", agent, "completed"); f.planner.flush();
      const worker = f.workers[0];
      if (fault === "response") worker.onmessage({ data: { error: "Planning failed" } });
      else if (fault === "message") worker.onmessageerror();
      else { f.clock.now = 10000; f.planner.flush(); }
      assert.equal(worker.terminated, true, fault);
      f.clock.now += 1000; f.planner.flush();
      const processor = f.workers.find(value => !value.terminated && value.messages.at(-1).type === "plan");
      assert.ok(processor, fault); reply(processor, []);
      assert.deepEqual(f.planner.request("0", agent, "completed"), [], fault);
    } finally { f.cleanup(); }
  }
});

test("방을 닫은 뒤에는 늦은 오류·응답이나 재시도 시각이 지나도 Worker를 만들지 않는다", () => {
  const f = fixture();
  try {
    const worker = f.workers[0], count = f.workers.length;
    worker.onerror(); f.planner.dispose();
    worker.onerror(); worker.onmessage({ data: { error: "late" } });
    f.clock.now = 100000; f.planner.flush();
    assert.equal(f.workers.length, count);
    assert.ok(f.workers.every(value => value.terminated));
    assert.equal(f.room.decisionPlanner, null);
  } finally { f.cleanup(); }
});

test("작업 전송 실패나 잘못된 결과도 정상 Worker를 유지하며 다시 요청한다", () => {
  for (const fault of ["send", "null", "duplicate"]) {
    const f = fixture();
    try {
      const agent = f.room.games.get("0").agents[0], worker = f.workers[0];
      f.planner.request("0", agent, "completed");
      if (fault === "send") worker.failNextMessage = true;
      f.planner.flush();
      if (fault === "null") worker.onmessage({ data: null });
      if (fault === "duplicate") worker.onmessage({ data: { results: [{ key: "unknown", candidates: [] }] } });
      assert.equal(worker.terminated, true, fault);
      assert.equal(f.room.decisionPlanner, f.planner);
      f.clock.now += 1000; f.planner.flush();
      const processor = f.workers.find(value => !value.terminated && value.messages.at(-1).type === "plan");
      assert.ok(processor, fault); reply(processor, []);
      assert.deepEqual(f.planner.request("0", agent, "completed"), [], fault);
    } finally { f.cleanup(); }
  }
});
