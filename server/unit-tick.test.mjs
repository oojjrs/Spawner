import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";
import { tickRoom, createRoom, saveRoom, restoreRoom } from "../client/room.mjs";

function fixture(saved) {
  const tribes = ["bean", "spore", "pebble", "spring"], sites = [[40, 40], [240, 40], [40, 240], [240, 240]];
  const room = { id: "test", title: "틱 검증", seed: 13, hostId: "bean", simSeconds: 0, revision: 0,
    games: new Map(), colonies: [], food: new Map(), foodSpots: new Map(), combatRandom: () => .5,
    world: { seed: 13, generationVersion: 15, sites, burrows: [
      { id: "beetle-home", type: "small", x: 150, y: 150, width: 1, height: 1, entrance: { x: 150, y: 151 } }
    ], terrain: new Uint8Array(102400).fill(4), hazards: new Uint8Array(102400), treeCells: new Uint8Array(102400) } };
  room.colonies = tribes.map((tribe, index) => ({ id: index + 1, ownerId: tribe, tribe,
    x: sites[index][0] - 2, y: sites[index][1] - 2, occupiedCells: new Set(["2,2"]) }));
  if (saved) room.food = structuredClone(saved.food);
  for (const colony of room.colonies) {
    const game = createGame(room, colony);
    room.games.set(colony.ownerId, game);
    if (saved) game.restore(saved.games.get(colony.ownerId));
  }
  room.creatureSystem = createCreatures(room, saved?.creatures || null);
  for (const game of room.games.values()) game.prepare(0);
  return room;
}

function referenceTick(room, elapsed) {
  room.simSeconds += elapsed;
  for (const game of room.games.values()) game.prepare(room.simSeconds);
  for (const game of room.games.values()) game.tick(elapsed);
  room.creatureSystem.tick();
  room.games.get(room.hostId).checkEnding();
  room.revision++;
}

test("안개 속 세 종족과 중립 유닛도 기존 시간 진행·이동·채집 결과를 유지한다", () => {
  const first = fixture(), saved = { food: first.food,
    games: new Map([...first.games].map(([owner, game]) => [owner, game.save()])), creatures: first.creatureSystem.save() };
  const indexed = fixture(structuredClone(saved)), reference = fixture(structuredClone(saved));
  for (let step = 0; step < 120; step++) {
    tickRoom(indexed, .1); referenceTick(reference, .1);
    if (step % 20 !== 19) continue;
    for (const [owner, game] of indexed.games) {
      const expected = reference.games.get(owner).snapshot(), actual = game.snapshot();
      for (const name of ["simSeconds", "evolutionPoints", "colonyFood", "resourceInventory"]) assert.deepEqual(actual[name], expected[name], owner + ":" + name);
      assert.deepEqual(actual.agents.map(agent => [agent.id, agent.x, agent.y, agent.health, agent.carrying, agent.stepCount]),
        expected.agents.map(agent => [agent.id, agent.x, agent.y, agent.health, agent.carrying, agent.stepCount]), owner);
    }
    assert.deepEqual(indexed.creatureSystem.save(), reference.creatureSystem.save());
  }
  for (const [owner, game] of indexed.games) {
    assert.ok(game.agents.some(agent => agent.stepCount > 0), owner + " 이동 유지");
    if (owner !== indexed.hostId) assert.ok(game.agents.every(agent => !indexed.games.get(indexed.hostId).isVisible(agent.x, agent.y)));
  }
  assert.ok(indexed.creatureSystem.agents.some(agent => agent.stepCount > 0), "안개 속 중립 이동 유지");
  assert.equal(indexed.unitIndex, null);
});

test("비가시 종족의 정기 재판단은 틱당 네 개로 분산하고 대기 개체를 굶기지 않는다", () => {
  const room = fixture(), game = room.games.get("spore"), saved = JSON.parse(game.save());
  const base = saved.state.agents[0];
  saved.state.agents = Array.from({ length: 24 }, (_, index) => ({ ...structuredClone(base), id: "2:" + (index + 1) }));
  game.restore(JSON.stringify(saved));
  for (const agent of game.agents) Object.assign(agent, { birth: null, utility: null, mode: "wait", decisionPending: null,
    nextDecisionAt: 0, lastDecisionAt: -1, knownEnemyIds: new Set(), survivalState: "stable", growthActivity: 0 });
  tickRoom(room, .1);
  assert.ok(game.agents.filter(agent => agent.lastDecisionAt >= 0).length <= 4);
  for (let step = 0; step < 8; step++) tickRoom(room, .1);
  assert.ok(game.agents.every(agent => agent.lastDecisionAt >= 0));
  assert.ok(game.agents.some(agent => agent.stepCount > 0 || agent.moveBudget > 0));
});

test("시야 밖 안전한 군락은 다음 행동까지 쉬고 보이는 군락은 매 틱 갱신한다", () => {
  const room = fixture(), hidden = room.games.get("spore"), host = room.games.get("bean");
  for (const agent of hidden.agents) Object.assign(agent, { birth: null, utility: null, mode: "wait", decisionPending: null, nextDecisionAt: 100 });
  const tick = hidden.tick;
  let hiddenTicks = 0, hostTicks = 0, elapsed = 0;
  hidden.tick = seconds => { hiddenTicks++; elapsed += seconds; tick(seconds); };
  const hostTick = host.tick;
  host.tick = seconds => { hostTicks++; hostTick(seconds); };
  for (let step = 0; step < 11; step++) tickRoom(room, .1);
  assert.equal(hostTicks, 11);
  assert.ok(hiddenTicks <= 3, String(hiddenTicks));
  assert.ok(Math.abs(elapsed - 1.1) < 1e-8);
  assert.equal(hidden.snapshot().simSeconds, room.simSeconds);
});

test("시야 밖 군락 근처에 다른 군락 유닛이 오면 예약 시각 전에도 즉시 깨어난다", () => {
  const room = fixture(), hidden = room.games.get("spore");
  for (const agent of hidden.agents) Object.assign(agent, { birth: null, utility: null, mode: "wait", decisionPending: null, nextDecisionAt: 100 });
  let ticks = 0;
  const tick = hidden.tick;
  hidden.tick = seconds => { ticks++; tick(seconds); };
  tickRoom(room, .1); tickRoom(room, .1);
  assert.equal(ticks, 1);
  const visitor = room.games.get("bean").agents[0], target = hidden.agents[0];
  Object.assign(visitor, { x: target.x + 1, y: target.y, renderFromX: target.x + 1, renderFromY: target.y });
  tickRoom(room, .1);
  assert.equal(ticks, 2);
});

test("시야 밖 유닛의 수명 만료는 다음 정기 갱신까지 미루지 않는다", () => {
  const room = fixture(), hidden = room.games.get("spore");
  hidden.produce = () => null;
  for (const agent of hidden.agents) Object.assign(agent, { bornAt: 0, lifespan: 1, cost: 10, birth: null, utility: null,
    mode: "wait", decisionPending: null, nextDecisionAt: 100 });
  const count = hidden.agents.length;
  for (let step = 0; step < 9; step++) tickRoom(room, .1);
  assert.equal(hidden.agents.length, count);
  tickRoom(room, .100000001);
  assert.equal(hidden.agents.length, 0);
  assert.equal([...room.food.values()].filter(cell => cell.kind === "corpse" && cell.colonyId === 2).length, count);
});

test("저장·복원은 비가시 군락의 미처리 경과 시간과 갱신 예약을 보존한다", () => {
  const room = createRoom("예약 저장", 13, "bean", null, false, false), owner = "tribe:spore", hidden = room.games.get(owner);
  for (const agent of hidden.agents) Object.assign(agent, { birth: null, utility: null, mode: "wait", decisionPending: null, nextDecisionAt: 100 });
  hidden.produce = () => null;
  for (let step = 0; step < 4; step++) tickRoom(room, .1);
  const saved = saveRoom(room), update = saved.simulationUpdates.find(entry => entry[0] === owner)[1];
  assert.ok(update.time < room.simSeconds);
  const restored = restoreRoom(structuredClone(saved));
  assert.deepEqual(saveRoom(restored).simulationUpdates, saved.simulationUpdates);
  const game = restored.games.get(owner), tick = game.tick;
  let elapsed = 0;
  game.tick = seconds => { elapsed += seconds; tick(seconds); };
  for (let step = 0; step < 2; step++) tickRoom(restored, .1);
  assert.ok(Math.abs(elapsed - (restored.simSeconds - update.time)) < 1e-8);
  const legacy = structuredClone(saved); delete legacy.simulationUpdates;
  assert.doesNotThrow(() => restoreRoom(legacy));
  const invalid = structuredClone(saved); invalid.simulationUpdates[0][1] = { time: room.simSeconds + 1, at: 1, count: 1 };
  assert.throws(() => restoreRoom(invalid), /월드 저장 형식/);
});
