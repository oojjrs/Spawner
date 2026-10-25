import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { AGENT_LIFESPAN } from "./lifespan.mjs";

function fixture(simSeconds) {
  const colony = { id: 1, ownerId: "lifespan-test", x: 40, y: 40,
    occupiedCells: new Set(["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1",
      "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"]) };
  const environment = { simSeconds, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  return { game, environment, agent: game.agents[0] };
}

test("군락 유닛은 게임 시간 3분까지 살고 수명에 도달하면 자연사한다", () => {
  const { game, agent, environment } = fixture(0);
  assert.equal(AGENT_LIFESPAN, 180);
  assert.equal(agent.lifespan, 180);
  Object.assign(agent, { carrying: 3, carryingType: "pebbles", shield: 1000, shieldUntil: 1000 });
  game.prepare(179.999);
  game.tick(0);
  assert.equal(game.agents.length, 1);
  assert.ok(agent.health > 0);
  game.prepare(180);
  game.tick(0.001);
  assert.equal(agent.health, 0);
  assert.equal(game.agents.length, 0);
  assert.equal([...environment.food.values()].filter(cell => cell.kind === "corpse").length, 1);
  assert.equal([...environment.food.values()].filter(cell => cell.resourceType === "pebbles")
    .reduce((sum, cell) => sum + cell.amount, 0), 3);
  game.prepare(181);
  game.tick(1);
  assert.equal([...environment.food.values()].filter(cell => cell.kind === "corpse").length, 1);
});

test("저장과 복원은 나이와 개체별 수명을 초기화하지 않는다", () => {
  const { game, agent } = fixture(60);
  agent.lifespan = 240;
  game.prepare(200);
  game.tick(0);
  const restored = fixture(200).game;
  restored.restore(game.save());
  assert.equal(restored.agents[0].bornAt, 60);
  assert.equal(restored.agents[0].lifespan, 240);
  const visible = restored.snapshot().agents[0];
  assert.equal(visible.bornAt, 60);
  assert.equal(visible.lifespan, 240);
  restored.prepare(299.999);
  restored.tick(0);
  assert.equal(restored.agents.length, 1);
  restored.prepare(300);
  restored.tick(0.001);
  assert.equal(restored.agents.length, 0);
});

test("수명 필드가 없는 이전 저장에도 기존 탄생 시각을 기준으로 3분을 적용한다", () => {
  const { game } = fixture(0);
  game.prepare(100);
  const saved = JSON.parse(game.save());
  delete saved.state.agents[0].lifespan;
  const restored = fixture(100).game;
  restored.restore(JSON.stringify(saved));
  assert.equal(restored.agents[0].bornAt, 0);
  assert.equal(restored.agents[0].lifespan, 180);
  restored.prepare(180);
  restored.tick(0);
  assert.equal(restored.agents.length, 0);
});

test("나중에 생긴 군락과 새로 생산한 개체는 자신의 탄생 시각부터 나이를 센다", () => {
  const { game, agent } = fixture(120);
  assert.equal(agent.bornAt, 120);
  const saved = JSON.parse(game.save());
  saved.state.evolutionPoints = 20;
  game.restore(JSON.stringify(saved));
  game.prepare(240);
  const birth = game.command({ type: "design", templateId: null, name: "수명 시험", slots: [], birth: true });
  const child = game.agents.find(candidate => candidate.id === birth.agentId);
  assert.equal(child.bornAt, 240);
  assert.equal(child.lifespan, 180);
  game.prepare(300);
  game.tick(0);
  assert.deepEqual(game.agents.map(candidate => candidate.id), [child.id]);
  game.prepare(420);
  game.tick(0);
  assert.equal(game.agents.length, 0);
});
