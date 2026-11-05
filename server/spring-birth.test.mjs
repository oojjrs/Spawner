import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { SPRING_BIRTH_DURATION } from "./birth.mjs";

function fixture() {
  const occupiedCells = new Set(["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"]);
  const colony = { id: 1, ownerId: "spring-birth", tribe: "spring", x: 40, y: 40, occupiedCells };
  const environment = { world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.evolutionPoints = 500;
  game.restore(JSON.stringify(saved));
  return { game, environment, colony };
}

test("샘방울은 둥지 앞쪽과 양옆의 빈 칸에서 태어나며 탄생이 끝나기 전에는 이동하지 않는다", () => {
  const { game, colony } = fixture();
  const occupied = new Set(game.agents.map(agent => agent.x + "," + agent.y));
  const result = game.command({ type: "design", templateId: null, name: "물방울", slots: [], birth: true });
  const agent = game.agents.find(value => value.id === result.agentId);
  const position = { x: agent.x, y: agent.y };
  assert.equal(agent.tribe, "spring");
  assert.ok(agent.y >= colony.y + 1);
  assert.equal(occupied.has(agent.x + "," + agent.y), false);
  assert.equal(colony.occupiedCells.has((agent.x - colony.x) + "," + (agent.y - colony.y)), false);
  assert.equal(agent.birth.readyAt, SPRING_BIRTH_DURATION);
  game.prepare(1.78);
  game.tick(.1);
  assert.deepEqual({ x: agent.x, y: agent.y }, position);
  assert.equal(agent.stepCount, 0);
  assert.equal(agent.mode, "birth");
  const saved = game.save();
  game.restore(saved);
  game.prepare(1.8);
  game.tick(.02);
  const restored = game.agents.find(value => value.id === result.agentId);
  assert.equal(restored.birth, null);
  assert.notEqual(restored.mode, "birth");
});

test("샘방울 앞쪽이 막혀도 양옆의 빈 칸에서 탄생한다", () => {
  const { game, environment, colony } = fixture();
  game.command({ type: "design", templateId: null, name: "샘방울", slots: [], birth: false });
  environment.world.terrain.fill(0, 44 * 320);
  const result = game.command({ type: "birth", templateId: 1 });
  const agent = game.agents.find(value => value.id === result.agentId);
  assert.ok(agent.x === colony.x - 1 || agent.x === colony.x + 5);
  assert.ok(agent.y >= colony.y + 1 && agent.y <= colony.y + 3);
});

test("샘방울은 앞쪽과 양옆 11칸에 분산하고 모두 차면 비용을 차감하지 않는다", () => {
  const { game, colony } = fixture();
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 4; // Keep the population cap above the 11 landing cells under test.
  saved.state.agents = [];
  game.restore(JSON.stringify(saved));
  game.command({ type: "design", templateId: null, name: "샘방울", slots: [], birth: false });
  const positions = [];
  const random = Math.random;
  try {
    for (let index = 0; index < 11; index++) {
      Math.random = () => index % 2 ? .999999 : 0;
      const result = game.command({ type: "birth", templateId: 1 });
      const agent = game.agents.find(value => value.id === result.agentId);
      positions.push([agent.x - colony.x, agent.y - colony.y]);
    }
  } finally { Math.random = random; }
  const expected = [[-1,1],[5,1],[-1,2],[5,2],[-1,3],[5,3],[0,4],[4,4],[1,5],[2,5],[3,5]];
  assert.deepEqual(positions.map(cell => cell.join(",")).sort(), expected.map(cell => cell.join(",")).sort());
  assert.ok(Math.abs(positions[0][0] - positions[1][0]) + Math.abs(positions[0][1] - positions[1][1]) >= 4);
  const points = game.snapshot().evolutionPoints;
  assert.throws(() => game.command({ type: "birth", templateId: 1 }), /둥지 앞쪽과 양옆의 탄생 공간/);
  assert.equal(game.snapshot().evolutionPoints, points);
  assert.equal(game.agents.length, 11);
});
