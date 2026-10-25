import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";

function fixture() {
  const occupiedCells = new Set(["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"]);
  const colony = { id: 1, ownerId: "pebble-birth", tribe: "pebble", x: 40, y: 40, occupiedCells };
  const environment = { world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.evolutionPoints = 500;
  game.restore(JSON.stringify(saved));
  return { game, environment, colony };
}

test("몽돌은 둥지 앞 빈 칸에 태어나 2.62초까지 행동하지 않고 저장 후에도 이어진다", () => {
  const { game, colony } = fixture();
  const occupied = new Set(game.agents.map(agent => agent.x + "," + agent.y));
  const result = game.command({ type: "design", templateId: null, name: "몽돌", slots: [], birth: true });
  const agent = game.agents.find(value => value.id === result.agentId);
  const position = { x: agent.x, y: agent.y };
  assert.ok(agent.y >= colony.y + 4);
  assert.equal(occupied.has(agent.x + "," + agent.y), false);
  assert.equal(colony.occupiedCells.has((agent.x - colony.x) + "," + (agent.y - colony.y)), false);
  assert.equal(agent.birth.readyAt, 2.62);
  game.prepare(2.61); game.tick(.01);
  assert.deepEqual({ x: agent.x, y: agent.y }, position);
  assert.equal(agent.stepCount, 0);
  assert.equal(agent.mode, "birth");
  game.restore(game.save());
  game.prepare(2.63); game.tick(.01);
  const restored = game.agents.find(value => value.id === result.agentId);
  assert.equal(restored.birth, null);
  assert.notEqual(restored.mode, "birth");
});

test("몽돌 앞쪽이 막히면 뒤로 떨어뜨리지 않고 탄생 비용도 차감하지 않는다", () => {
  const { game, environment } = fixture();
  game.command({ type: "design", templateId: null, name: "몽돌", slots: [], birth: false });
  environment.world.terrain.fill(0, 44 * 320);
  const points = game.snapshot().evolutionPoints, count = game.agents.length;
  assert.throws(() => game.command({ type: "birth", templateId: 1 }), /둥지 앞쪽의 탄생 공간/);
  assert.equal(game.snapshot().evolutionPoints, points);
  assert.equal(game.agents.length, count);
});

test("이전 저장의 몽돌 탄생 대기 시간도 새 애니메이션 길이로 복구한다", () => {
  const { game } = fixture();
  const result = game.command({ type: "design", templateId: null, name: "몽돌", slots: [], birth: true });
  const saved = JSON.parse(game.save());
  saved.state.agents.find(agent => agent.id === result.agentId).birth.readyAt = 3.85;
  game.restore(JSON.stringify(saved));
  assert.equal(game.agents.find(agent => agent.id === result.agentId).birth.readyAt, 2.62);
});
