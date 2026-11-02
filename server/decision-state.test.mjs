import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";

function fixture(saved) {
  const colony = { id: 1, ownerId: "owner", tribe: "bean", x: 38, y: 38, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, hostId: "owner", colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map(),
    creatureSystem: { agents: [], burrows: [] }, world: { size: 160, seed: 13, generationVersion: 15,
      terrain: new Uint8Array(25600).fill(4), hazards: new Uint8Array(25600), treeCells: new Uint8Array(25600), burrows: [] } };
  const game = createGame(environment, colony, saved);
  environment.games.set("owner", game); game.prepare(0);
  return { game, environment };
}

test("네이티브 판단 상태는 기존 저장 복원과 같은 후보를 만들고 컬렉션을 보존한다", () => {
  const source = fixture(undefined).game;
  const native = structuredClone(source.decisionSnapshot());
  assert.ok(native.state.knownFood instanceof Map);
  assert.ok(native.state.explored instanceof Set);
  const first = fixture(source.save()).game, second = fixture(native).game;
  const requests = first.agents.map(agent => ({ id: agent.id, reason: "periodic" }));
  assert.deepEqual(second.planDecisions(requests), first.planDecisions(requests));
});

test("계속 사용하는 판단 게임은 최신 개체 상태를 받고 기존 탐색 컬렉션을 유지한다", () => {
  const source = fixture(undefined).game, f = fixture(structuredClone(source.decisionSnapshot()));
  const explored = f.game.decisionSnapshot().state.explored;
  const next = structuredClone(source.decisionSnapshot());
  next.state.agents[0].x++; next.state.explored.add(1);
  f.environment.simSeconds = .1;
  f.game.updateDecisionState(next);
  assert.equal(f.game.agents[0].x, source.agents[0].x + 1);
  assert.equal(f.game.decisionSnapshot().state.explored, explored);
  assert.equal(explored.has(1), true);
  assert.equal(source.decisionSnapshot().state.explored.has(1), false);
});