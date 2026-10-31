import test from "node:test";
import assert from "node:assert/strict";
import { createUnitIndex } from "./unit-index.mjs";
import { createCombat } from "./combat.mjs";

test("같은 틱의 이동·출발 칸 예약·생성·제거를 즉시 반영한다", () => {
  const agent = { id: "1", x: 10, y: 10, health: 12, moveDuration: 0 };
  const game = { agents: [agent] }, room = { simSeconds: 1, games: new Map([[1, game]]), creatureSystem: { agents: [] } };
  const index = createUnitIndex(room);
  assert.equal(index.at(10, 10)[0].agent, agent);
  Object.assign(agent, { x: 11, renderFromX: 10, renderFromY: 10, moveStartedAt: 1, moveDuration: 1 });
  index.update(agent);
  assert.equal(index.at(10, 10).length, 0);
  assert.equal(index.occupied(10, 10, null, true), true);
  assert.equal(index.occupied(10, 10, null, false), false);
  assert.equal(index.nearby(9, 10, 2)[0].agent, agent);
  room.simSeconds = 2;
  assert.equal(index.occupied(10, 10, null, true), false);
  const spawned = { id: "2", x: 12, y: 10, health: 2 };
  index.update(spawned, game);
  assert.equal(index.occupied(12, 10, null, false), true);
  agent.x = 12; index.update(agent);
  assert.deepEqual(index.at(12, 10).map(record => record.agent.id), ["1", "2"]);
  assert.deepEqual(index.nearby(12, 10, 1).map(record => record.agent.id), ["1", "2"]);
  agent.x = 11; index.update(agent);
  index.remove(spawned);
  assert.equal(index.occupied(12, 10, null, false), false);
  agent.health = 0;
  assert.equal(index.occupied(11, 10, null, true), false);
});

test("800개 유닛의 접촉 검사는 전체 목록을 만들지 않고 같은 칸에서 교전을 시작한다", () => {
  const stats = { health: 12, strength: 4, attack: 1, speed: 1, resistance: 1 };
  const agents = Array.from({ length: 800 }, (_, index) => ({ id: "unit:" + index, ownerId: index ? "b" : "a",
    x: index % 100, y: Math.floor(index / 100), health: 12, stats: { ...stats }, attributes: {},
    moveDuration: 0, combatDisposition: index ? "passive" : "aggressive", mode: "idle" }));
  const game = { agents, receiveDamage(agent, damage) { agent.health -= damage; } };
  const room = { simSeconds: 1, games: new Map([[1, game]]), world: { terrain: new Uint8Array(102400).fill(4) }, colonies: [] };
  room.unitIndex = createUnitIndex(room);
  room.unitIndex.entries = () => { throw new Error("전체 유닛 검색 금지"); };
  const combat = createCombat(room);
  for (const agent of agents) assert.equal(combat.update(agent, 1), false);
  agents[1].x = 0; agents[1].y = 0;
  room.unitIndex.update(agents[1]);
  assert.equal(combat.engage(agents[0], agents[1], 1), true);
  assert.ok(agents[0].combat);
  assert.equal(agents[0].combat.id, agents[1].combat.id);
});
