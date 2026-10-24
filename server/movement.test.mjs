import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";

test("연속 정찰 이동은 틱 간격이 달라도 직전 이동 종료 시각에 이어진다", () => {
  const colony = { id: 1, ownerId: "test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set("test", game);
  game.agents.splice(1);
  const agent = game.agents[0];
  const elapsed = [0.07, 0.11, 0.13, 0.09];
  let previous = null, moves = 0;
  for (let index = 0; index < 500; index++) {
    const duration = elapsed[index % elapsed.length];
    environment.simSeconds += duration;
    game.prepare(environment.simSeconds);
    game.tick(duration);
    if (!agent.stepCount || previous?.step === agent.stepCount) continue;
    if (previous) assert.ok(Math.abs(agent.moveStartedAt - previous.endsAt) < 1e-7,
      "정찰 중 다음 칸을 시작하기 전에 틱 대기 시간이 누적되면 안 됩니다.");
    previous = { step: agent.stepCount, endsAt: agent.moveStartedAt + agent.moveDuration };
    moves++;
  }
  assert.ok(moves >= 20);
  assert.ok(agent.moveBudget >= 0);
});
