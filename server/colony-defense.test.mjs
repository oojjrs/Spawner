import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";
import { createDecisionPool } from "../client/decision-pool.mjs";
import { createCombat, colonyDefenseTarget, canPursueCombat } from "./combat.mjs";

const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const decisionWorker = JSON.parse(worker.match(/^globalThis.SpawnerDecisionWorkerSource = ("[^\n]+");/)[1]);
const surfaces = [["소스", { createGame, createCombat, colonyDefenseTarget, canPursueCombat }]];
for (const [name, source, entry] of [["게임 워커", worker, "client/worker.mjs"], ["판단 워커", decisionWorker, "client/decision-worker.mjs"]]) {
  const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(source.slice(0, source.indexOf('modules["' + entry + '"]')) +
    'globalThis.api = { ...modules["server/game.mjs"], ...modules["server/combat.mjs"] }; })();', context);
  surfaces.push([name, context.api]);
}

function fixture(api, mode, victim) {
  const colony = { id: 1, ownerId: "defenders", tribe: "bean", x: 11, y: 10, occupiedCells: new Set(["2,2"]) };
  const tree = { x: 18, y: 12, amount: 12, initialAmount: 12, resourceType: "tree", kind: "resource" };
  const environment = { simSeconds: 0, hostId: colony.ownerId, colonies: [colony], games: new Map(),
    food: new Map([["18,12", tree]]), foodSpots: new Map(),
    world: { size: 40, seed: 13, generationVersion: 37,
      terrain: new Uint8Array(1600).fill(4), hazards: new Uint8Array(1600) } };
  const game = api.createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 2;
  saved.state.evolutionPoints = 20;
  saved.state.agents.splice(2);
  Object.assign(saved.state.agents[0], { dna: null, slots: ["feet", "blade"], attributeLevels: { feet: 1, blade: 1 },
    rulesVersion: 2, productionRole: "military" });
  game.restore(JSON.stringify(saved));
  const [soldier, ally] = game.agents;
  for (const agent of game.agents) Object.assign(agent, { birth: null, bornAt: 0, lifespan: 360,
    health: agent.stats.health, decisionPending: null, nextDecisionAt: 1000, knownEnemyIds: new Set(["beetle"]),
    survivalState: "stable", moveStartedAt: 0, moveDuration: 0, moveBudget: 0 });
  Object.assign(ally, { x: 13, y: 13, renderFromX: 13, renderFromY: 13, utility: null });
  Object.assign(soldier, { x: 18, y: 12, renderFromX: 18, renderFromY: 12, mode,
    carrying: mode === "return" ? 1 : 0, carryingType: mode === "return" ? "tree" : null,
    harvestStarted: 0, harvestReady: 0, harvestPrepared: true, targetFoodKey: "18,12", rememberedFoodKey: "18,12",
    utility: mode === "return" ? { action: "return", target: { x: 13, y: 12, key: "home" }, route: [], score: 1000 } :
      { action: "collect", target: { x: 18, y: 12, key: "18,12" }, plannedCargo: 1,
        route: [{ x: 18, y: 12 }], score: 1000 } });
  const enemy = { id: "beetle", species: "spiny-back-beetle", x: 14, y: 12, homeX: 14, homeY: 12,
    health: 100, stats: { health: 100, combatStrength: 32, speed: .2, attack: 1, vision: 4 },
    attributes: {}, carrying: 0, cost: 0, moveStartedAt: 0, moveDuration: 0,
    attack: victim === "none" ? null : { targetId: victim === "ally" ? ally.id : game.nest.id,
      targetKind: victim === "ally" ? "agent" : "nest", startedAt: 0, hitAt: .5, endsAt: 1 } };
  environment.creatureSystem = { agents: [enemy], burrows: [], receiveDamage(target, amount) { target.health -= amount; } };
  game.prepare(0);
  return { game, environment, soldier, ally, enemy, tree };
}

function tick(fixture, seconds) {
  fixture.environment.simSeconds += seconds;
  fixture.game.prepare(fixture.environment.simSeconds);
  fixture.game.tick(seconds);
}

for (const [surface, api] of surfaces) {
  for (const victim of ["nest", "ally"]) for (const mode of ["harvest", "return"]) {
    test(surface + ": 비선공 전사는 " + victim + " 공격에 " + mode + "보다 방어를 우선한다", () => {
      const f = fixture(api, mode, victim);
      const carrying = f.soldier.carrying;
      const plans = f.game.planDecisions([{ id: f.soldier.id, reason: "periodic" }])[0];
      assert.equal(plans[0]?.action, "fight");
      assert.equal(plans[0]?.target.id, f.enemy.id);
      assert.equal(plans[0]?.defending, true);
      tick(f, .1);
      assert.equal(f.soldier.utility?.action, "fight");
      assert.equal(f.soldier.utility?.defending, true);
      assert.equal(f.soldier.lastDecisionReason, "defense");
      assert.ok(f.soldier.lastDecisionAt < 1000);
      assert.equal(f.soldier.carrying, carrying);
      assert.equal(f.tree.amount, 12);
    });
  }
  test(surface + ": 이미 알던 적의 공격 시작도 병렬 판단을 기다리지 않고 방어한다", () => {
    const f = fixture(api, "harvest", "none");
    const calls = [];
    f.environment.decisionPlanner = { request(owner, agent) { calls.push(agent.id); return undefined; } };
    f.enemy.attack = { targetId: f.game.nest.id, targetKind: "nest", hitAt: .5, endsAt: 1 };
    tick(f, .1);
    assert.equal(f.soldier.utility?.action, "fight");
    assert.equal(f.soldier.utility?.target.id, f.enemy.id);
    assert.equal(calls.includes(f.soldier.id), false);
  });
  test(surface + ": 공격 동작 사이에도 방어 추격을 유지하고 비선공이 실제 교전에 합류한다", () => {
    const f = fixture(api, "return", "nest");
    tick(f, .1);
    f.enemy.attack = null;
    f.enemy.combatDisposition = "passive";
    const plans = f.game.planDecisions([{ id: f.soldier.id, reason: "periodic" }])[0];
    assert.equal(plans[0]?.action, "fight");
    assert.equal(plans[0]?.target.id, f.enemy.id);
    Object.assign(f.soldier, { x: f.enemy.x, y: f.enemy.y, moveDuration: 0 });
    assert.equal(api.createCombat(f.environment).engage(f.soldier, f.enemy, f.environment.simSeconds), true);
    assert.ok(f.soldier.combat && f.enemy.combat);
  });
  test(surface + ": 가까운 비위협 여섯 마리가 있어도 아군 공격자를 후보에서 놓치지 않는다", () => {
    const f = fixture(api, "harvest", "nest");
    for (let index = 0; index < 6; index++) f.environment.creatureSystem.agents.push({ ...f.enemy,
      id: "bystander:" + index, x: 17, y: 12, combatDisposition: "peaceful", attack: null });
    f.game.prepare(0);
    const plans = f.game.planDecisions([{ id: f.soldier.id, reason: "periodic" }])[0];
    assert.equal(plans[0]?.action, "fight");
    assert.equal(plans[0]?.target.id, f.enemy.id);
  });
  test(surface + ": 비선공은 무관한 적이나 다른 군락 공격자를 먼저 공격하지 않는다", () => {
    const f = fixture(api, "harvest", "none");
    assert.equal(api.colonyDefenseTarget(f.soldier, f.enemy, f.game.agents, [f.game.nest]), false);
    assert.equal(api.canPursueCombat(f.soldier, f.enemy, 0), false);
    f.enemy.attack = { targetId: "nest:other", targetKind: "nest" };
    assert.equal(api.colonyDefenseTarget(f.soldier, f.enemy, f.game.agents, [f.game.nest]), false);
    tick(f, .1);
    assert.notEqual(f.soldier.utility?.action, "fight");
  });
  test(surface + ": 평화형과 일반 일꾼에게 전사 방어 출동을 적용하지 않는다", () => {
    const f = fixture(api, "harvest", "nest");
    f.soldier.combatDisposition = "peaceful";
    assert.equal(api.colonyDefenseTarget(f.soldier, f.enemy, f.game.agents, [f.game.nest]), false);
    f.soldier.combatDisposition = "passive";
    f.soldier.productionRole = "worker";
    f.soldier.slots = [];
    assert.equal(api.colonyDefenseTarget(f.soldier, f.enemy, f.game.agents, [f.game.nest]), false);
  });
  test(surface + ": 공격자가 사라지면 중단했던 귀환 작업으로 복귀한다", () => {
    const f = fixture(api, "return", "nest");
    tick(f, .1);
    f.enemy.health = 0;
    tick(f, .1);
    assert.equal(f.soldier.utility?.action, "return");
    assert.equal(f.soldier.utility?.resuming, true);
    assert.equal(f.soldier.suspendedWork, null);
    assert.equal(f.soldier.carrying, 1);
  });
  test(surface + ": 방어 종료 후 다른 자원보다 원래 채집 목표와 계획량을 유지한다", () => {
    const f = fixture(api, "harvest", "nest");
    f.soldier.stats.capacity = 3;
    f.soldier.utility.plannedCargo = 2;
    f.environment.food.set("17,12", { x: 17, y: 12, amount: 100, initialAmount: 100, resourceType: "clay", kind: "resource" });
    tick(f, .1);
    assert.equal(f.soldier.suspendedWork?.target.key, "18,12");
    assert.equal(f.soldier.suspendedWork?.plannedCargo, 2);
    f.enemy.health = 0;
    tick(f, .1);
    assert.equal(f.soldier.utility?.action, "collect");
    assert.equal(f.soldier.utility?.target.key, "18,12");
    assert.equal(f.soldier.utility?.plannedCargo, 2);
    assert.equal(f.soldier.suspendedWork, null);
    tick(f, 3.1);
    assert.equal(f.soldier.utility?.target.key, "18,12");
    assert.equal(f.soldier.utility?.plannedCargo, 2);
  });
  test(surface + ": 방어 중 저장하고 불러와도 중단했던 채집으로 복귀한다", () => {
    const f = fixture(api, "harvest", "nest");
    tick(f, .1);
    const id = f.soldier.id;
    f.game.restore(f.game.save());
    f.soldier = f.game.agents.find(agent => agent.id === id);
    assert.equal(f.soldier.suspendedWork?.target.key, "18,12");
    f.enemy.health = 0;
    tick(f, .1);
    assert.equal(f.soldier.utility?.action, "collect");
    assert.equal(f.soldier.utility?.target.key, "18,12");
    assert.equal(f.soldier.suspendedWork, null);
  });
  test(surface + ": 같은 칸에서 바로 교전에 들어가도 실제 전투 종료 후 채집으로 복귀한다", () => {
    const f = fixture(api, "harvest", "nest");
    Object.assign(f.soldier, { x: f.enemy.x, y: f.enemy.y });
    f.enemy.health = 1;
    assert.equal(api.createCombat(f.environment).engage(f.soldier, f.enemy, 0), true);
    assert.equal(f.soldier.suspendedWork?.target.key, "18,12");
    for (let step = 0; step < 120 && (f.soldier.combat || !f.soldier.utility); step++) tick(f, .1);
    assert.equal(f.soldier.combat, null);
    assert.equal(f.soldier.utility?.action, "collect");
    assert.equal(f.soldier.utility?.target.key, "18,12");
    assert.equal(f.soldier.suspendedWork, null);
  });
  test(surface + ": 연달아 방어해도 처음 중단한 작업을 덮어쓰지 않는다", () => {
    const f = fixture(api, "harvest", "nest");
    tick(f, .1);
    const saved = f.soldier.suspendedWork;
    const second = { ...f.enemy, id: "second-beetle", x: 15 };
    f.environment.creatureSystem.agents.push(second);
    f.enemy.health = 0;
    tick(f, .1);
    assert.equal(f.soldier.utility?.target.id, second.id);
    assert.equal(f.soldier.suspendedWork, saved);
    second.health = 0;
    tick(f, .1);
    assert.equal(f.soldier.utility?.action, "collect");
    assert.equal(f.soldier.utility?.target.key, "18,12");
  });
  for (const invalid of ["depleted", "locked"]) {
    test(surface + ": " + invalid + "인 원래 채집 목표는 복귀하지 않고 작업 기억을 해제한다", () => {
      const f = fixture(api, "harvest", "nest");
      tick(f, .1);
      if (invalid === "depleted") f.tree.amount = 0;
      else f.soldier.attributes.blade = 0;
      f.enemy.health = 0;
      tick(f, .1);
      assert.ok(f.soldier.utility?.action !== "collect" || f.soldier.utility.target.key !== "18,12");
      assert.equal(f.soldier.suspendedWork, null);
    });
  }
  test(surface + ": 회복이 필요한 동안 작업을 기억하고 회복 후 원래 채집으로 복귀한다", () => {
    const f = fixture(api, "harvest", "nest");
    tick(f, .1);
    f.enemy.health = 0;
    f.soldier.health = 50;
    tick(f, .1);
    assert.equal(f.soldier.suspendedWork?.target.key, "18,12");
    assert.equal(f.soldier.utility?.action, "recover");
    f.soldier.health = f.soldier.stats.health;
    f.soldier.decisionPending = "completed";
    tick(f, .1);
    assert.equal(f.soldier.utility?.action, "collect");
    assert.equal(f.soldier.utility?.target.key, "18,12");
    assert.equal(f.soldier.suspendedWork, null);
  });
}

test("일반 전투와 같은 목표라도 방어 전환 전의 판단 결과는 적용하지 않는다", () => {
  const agent = { id: "one", x: 1, y: 1, health: 100, carrying: 0, attributes: {},
    utility: { action: "fight", target: { key: "beetle" }, defending: false } };
  let candidates = [{ action: "return" }], calls = 0;
  const game = { agents: [agent], planDecisions(requests) {
    assert.deepEqual(requests.map(request => request.id), [agent.id]);
    calls++; return [candidates];
  } };
  const room = { games: new Map([["owner", game]]), simSeconds: 0, world: {size:40} };
  const pool = createDecisionPool(room);
  try {
    pool.request("owner", agent, "periodic"); pool.flush();
    assert.deepEqual(pool.request("owner", agent, "periodic"), [{ action: "return" }]);
    pool.request("owner", agent, "periodic"); pool.flush();
    agent.utility.defending = true;
    candidates = [{ action: "fight", defending: true }];
    assert.equal(pool.request("owner", agent, "periodic"), undefined);
    pool.flush();
    assert.deepEqual(pool.request("owner", agent, "periodic"), [{ action: "fight", defending: true }]);
    assert.equal(calls, 3);
  } finally { pool.dispose(); }
});


test("방어 전의 판단 결과는 같은 채집 작업에 복귀한 뒤에도 적용하지 않는다", () => {
  const agent = { id: "one", x: 1, y: 1, health: 100, carrying: 0, attributes: {},
    utility: { action: "collect", target: { key: "18,12" } }, defenseRevision: 0 };
  let candidates = [{ action: "explore" }], calls = 0;
  const game = { agents: [agent], planDecisions(requests) {
    assert.deepEqual(requests.map(request => request.id), [agent.id]);
    calls++; return [candidates];
  } };
  const room = { games: new Map([["owner", game]]), simSeconds: 0, world: {size:40} };
  const pool = createDecisionPool(room);
  try {
    pool.request("owner", agent, "periodic"); pool.flush();
    assert.deepEqual(pool.request("owner", agent, "periodic"), [{ action: "explore" }]);
    pool.request("owner", agent, "periodic"); pool.flush();
    agent.utility = { action: "fight", target: { key: "beetle" }, defending: true };
    agent.defenseRevision = 1;
    agent.utility = { action: "collect", target: { key: "18,12" } };
    candidates = [{ action: "collect", target: { key: "18,12" } }];
    assert.equal(pool.request("owner", agent, "periodic"), undefined);
    pool.flush();
    assert.deepEqual(pool.request("owner", agent, "periodic"), [{ action: "collect", target: { key: "18,12" } }]);
    assert.equal(calls, 3);
  } finally { pool.dispose(); }
});
