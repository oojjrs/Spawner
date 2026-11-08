import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";

function fixture() {
  const colony = { id: 1, ownerId: "raid-owner", tribe: "bean", x: 20, y: 20,
    occupiedCells: new Set(["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1",
      "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"]) };
  const environment = { seed: 7, simSeconds: 0, hostId: colony.ownerId,
    world: { seed: 7, size: 64, generationVersion: 23, sites: [[22, 22]],
      terrain: new Uint8Array(64 * 64).fill(4), hazards: new Uint8Array(64 * 64),
      burrows: [{ id: "large:1", type: "large", x: 45, y: 40, width: 3, height: 1, entrance: { x: 46, y: 41 } }] },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  environment.creatureSystem = createCreatures(environment, null);
  return { environment, colony, game };
}

test("습격 치트는 시작 즉시 내 둥지 주변에 실제 중립 습격군을 만들고 자연 출정 일정을 보존한다", () => {
  const { environment, colony, game } = fixture();
  const before = structuredClone(environment.creatureSystem.save());
  const result = game.command({ type: "cheat-raid" });
  assert.ok(result.raiders.length > 0);
  const raiders = environment.creatureSystem.agents.filter(agent => result.raiders.includes(agent.id));
  assert.equal(raiders.length, result.raiders.length);
  assert.equal(new Set(raiders.map(agent => agent.x + "," + agent.y)).size, raiders.length);
  for (const agent of raiders) {
    assert.equal(agent.raid.colonyId, colony.id);
    assert.equal(agent.raid.phase, "active");
    assert.equal(agent.raid.departedAt, 0);
    assert.ok(agent.health > 0);
    assert.equal(colony.occupiedCells.has((agent.x - colony.x) + "," + (agent.y - colony.y)), false);
    assert.equal(environment.world.terrain[agent.y * 64 + agent.x], 4);
    assert.ok(Math.hypot(agent.x - colony.x - 2, agent.y - colony.y - 2) < 8);
  }
  assert.deepEqual(environment.creatureSystem.save().raidCooldowns, before.raidCooldowns);
  assert.deepEqual(environment.creatureSystem.save().burrows, before.burrows);
  assert.equal(environment.simSeconds, 0);
  const saved = structuredClone(environment.creatureSystem.save());
  environment.creatureSystem = createCreatures(environment, saved);
  assert.deepEqual(environment.creatureSystem.agents.filter(agent => result.raiders.includes(agent.id)), raiders);
  const next = game.command({ type: "cheat-raid" });
  assert.ok(next.raiders.length > 0);
  assert.ok(next.raiders.every(id => !result.raiders.includes(id)));
  for (let step = 0; step < 40; step++) {
    environment.simSeconds += .25;
    environment.creatureSystem.tick();
  }
  assert.ok(environment.creatureSystem.agents.some(agent => result.raiders.includes(agent.id) &&
    (agent.attackStartedAt >= 0 || agent.combat || agent.pursuitTargetId)));
});

test("습격 가능한 빈 땅이 없으면 치트는 개체나 출정 일정을 변경하지 않는다", () => {
  const { environment, game } = fixture();
  environment.world.terrain.fill(0);
  const before = structuredClone(environment.creatureSystem.save());
  assert.throws(() => game.command({ type: "cheat-raid" }), /빈 공간/);
  assert.deepEqual(environment.creatureSystem.save(), before);
});
