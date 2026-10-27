import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createRoom, saveRoom, restoreRoom, tickRoom, commandRoom, snapshotRoom } from "../client/room.mjs";

function fixture(points) {
  const colony = { id: 1, ownerId: "ending-test", tribe: "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.evolutionPoints = points;
  game.restore(JSON.stringify(saved));
  return game;
}

test("생존 유닛이 없고 기본 탄생 비용도 없으면 잔여 포인트와 사체에 관계없이 엔딩이다", () => {
  for (const points of [0, 2]) {
    const game = fixture(points);
    for (const agent of [...game.agents]) game.receiveDamage(agent, 1000);
    game.prepare(90);
    const ending = game.checkEnding();
    assert.equal(ending.reason, "extinction");
    assert.equal(ending.endedAt, 90);
    assert.equal(ending.bornCount, 2);
    assert.equal(ending.evolutionPoints, points);
  }
});

test("템플릿이 없어도 3포인트면 기본 유닛을 설계하고 생성해 회복할 수 있다", () => {
  const game = fixture(3);
  game.agents.splice(0);
  assert.equal(game.checkEnding(), null);
  const result = game.command({ type: "design", templateId: null, name: "새 생명", slots: [], birth: true });
  assert.ok(result.agentId);
  assert.equal(game.snapshot().evolutionPoints, 0);
  assert.equal(game.checkEnding(), null);
});

test("살아 있거나 탄생 중인 유닛이 남아 있으면 0포인트여도 엔딩이 아니다", () => {
  const game = fixture(0);
  assert.equal(game.checkEnding(), null);
  game.agents.splice(1);
  game.agents[0].birth = { startedAt: 0, readyAt: 10 };
  assert.equal(game.checkEnding(), null);
});

test("둥지가 파괴되어도 생존 유닛이 있으면 기다리고, 전멸하면 포인트가 남아도 엔딩이다", () => {
  const game = fixture(100);
  game.receiveNestDamage(1000);
  assert.equal(game.checkEnding(), null);
  game.agents.splice(0);
  assert.equal(game.checkEnding().reason, "nest-destroyed");
});

test("엔딩 보고서는 저장·복원되고 이후 시간과 기록이 바뀌지 않으며 생산은 거부한다", () => {
  const game = fixture(0);
  game.agents.splice(0);
  game.prepare(180);
  const report = structuredClone(game.checkEnding());
  const restored = fixture(0);
  restored.restore(game.save());
  restored.prepare(300);
  restored.tick(120);
  assert.deepEqual(restored.snapshot().ending, report);
  assert.equal(restored.snapshot().simSeconds, 180);
  assert.throws(() => restored.command({ type: "design", templateId: null, name: "금지", slots: [], birth: true }), /둘러보기/);
  assert.deepEqual(restored.command({ type: "read-discoveries", count: restored.snapshot().discoveries.length }), {});
});

test("종료된 방은 목록용 엔딩 정보를 저장하고 재접속해도 월드와 보고서를 유지한다", () => {
  const room = createRoom("마지막 군락", 13, "bean", null);
  const game = room.games.get(room.hostId);
  const data = JSON.parse(game.save());
  data.state.agents = [];
  data.state.evolutionPoints = 0;
  delete data.state.ending;
  game.restore(JSON.stringify(data));
  const saved = saveRoom(room);
  const restored = restoreRoom(saved);
  const report = snapshotRoom(restored, false).state.ending;
  assert.equal(report.reason, "extinction");
  assert.deepEqual(saveRoom(restored).ending, report);
  const before = saveRoom(restored);
  tickRoom(restored, 10);
  assert.equal(restored.simSeconds, before.simSeconds);
  assert.equal(restored.revision, before.revision);
  assert.deepEqual(saveRoom(restored).creatures, before.creatures);
  assert.deepEqual(snapshotRoom(restored, false).state.ending, report);
  assert.throws(() => commandRoom(restored, { type: "rename-colony", colonyId: 1, name: "변경" }), /둘러보기/);
});

test("부족을 선택하기 전에는 엔딩을 판정하지 않는다", () => {
  const room = createRoom("시작 전", 13, null, null);
  room.games.get(room.hostId).agents.splice(0);
  assert.equal(room.games.get(room.hostId).checkEnding(), null);
  tickRoom(room, 10);
  assert.equal(room.simSeconds, 0);
});
