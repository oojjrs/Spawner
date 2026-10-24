import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";
import { BEETLE_ANIMATIONS } from "./beetle-animation.mjs";

function fixture() {
  const colony = { id: 1, ownerId: "nest-test", x: 40, y: 40,
    occupiedCells: new Set(["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1",
      "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"]) };
  const room = { simSeconds: 0, world: { seed: 13, sites: [[42, 42]], terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320), burrows: [
      { id: "large:1", type: "large", x: 80, y: 40, width: 3, height: 1, entrance: { x: 81, y: 41 } }
    ] }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(room, colony);
  room.games.set(colony.ownerId, game);
  return { game, room, colony };
}

test("둥지는 시간이 지나도 노화하지 않고 피해를 받으면 체력이 줄어든다", () => {
  const { game } = fixture();
  assert.equal(game.nest.health, 100);
  game.prepare(100000);
  game.tick(0);
  assert.equal(game.nest.health, 100);
  assert.equal(game.nest.lifespan, undefined);
  assert.equal(game.receiveNestDamage(Infinity), 100);
  assert.equal(game.receiveNestDamage(-1), 100);
  assert.equal(game.receiveNestDamage(25), 75);
  assert.equal(game.snapshot().nestHealth, 75);
  assert.equal(game.snapshot().nestMaxHealth, 100);
});

test("둥지 성장은 받은 피해를 유지하고 파괴된 둥지는 생산·성장·반납·회복하지 않는다", () => {
  const { game } = fixture();
  game.receiveNestDamage(25);
  const saved = JSON.parse(game.save());
  saved.state.evolutionPoints = 2000;
  game.restore(JSON.stringify(saved));
  game.command({ type: "upgrade" });
  assert.equal(game.nest.maxHealth, 200);
  assert.equal(game.nest.health, 175);
  const agent = game.agents[0];
  Object.assign(agent, { health: 1, carrying: 2, carryingType: "honey-mushrooms", mode: "unload",
    unloadReady: 0, utility: { action: "return", target: { x: 40, y: 40, key: "home" }, route: [] },
    foodDelivery: { receivedAt: null, arrivesAt: 0, amount: 2 } });
  assert.equal(game.receiveNestDamage(1000), 0);
  assert.equal(agent.foodDelivery, null);
  assert.equal(agent.utility, null);
  assert.throws(() => game.command({ type: "upgrade" }), /파괴된 둥지/);
  const result = game.command({ type: "design", templateId: null, name: "남은 설계", slots: [], birth: true });
  assert.equal(result.agentId, null);
  assert.throws(() => game.command({ type: "birth", templateId: result.templateId }), /파괴된 둥지/);
  const points = game.snapshot().evolutionPoints;
  game.prepare(1);
  game.tick(1);
  assert.equal(game.snapshot().evolutionPoints, points);
  assert.equal(agent.carrying, 2);
  assert.equal(agent.health, 1);
  assert.equal(game.agents.length, 2);
});

test("파괴 상태를 저장하고 복원하며 이전 저장의 둥지는 해당 레벨의 최대 체력으로 복원한다", () => {
  const { game } = fixture();
  game.receiveNestDamage(100);
  const restored = fixture().game;
  restored.restore(game.save());
  assert.equal(restored.nest.health, 0);
  const saved = JSON.parse(game.save());
  delete saved.state.nestHealth;
  saved.state.nestLevel = 3;
  restored.restore(JSON.stringify(saved));
  assert.equal(restored.nest.health, 400);
});

test("습격한 딱정벌레는 인접한 둥지를 공격 프레임에 한 번 타격하고 파괴되면 귀환한다", () => {
  const { game, room } = fixture();
  game.agents.splice(0);
  room.creatureSystem = createCreatures(room, null);
  const beetle = room.creatureSystem.agents[0];
  Object.assign(beetle, { x: 45, y: 42, renderFromX: 45, renderFromY: 42, mode: "idle",
    moveStartedAt: 180, moveDuration: 0, nextActionAt: 180,
    raid: { colonyId: 1, phase: "active", departedAt: 180, activeUntil: 240 } });
  room.simSeconds = 180;
  room.creatureSystem.tick();
  assert.equal(beetle.mode, "attack");
  assert.equal(beetle.attackTargetId, "nest:1");
  room.simSeconds = 180 + BEETLE_ANIMATIONS.attack.hitTimeMs / 1000 - 0.001;
  room.creatureSystem.tick();
  assert.equal(game.nest.health, 100);
  room.simSeconds += 0.001;
  room.creatureSystem.tick();
  assert.equal(game.nest.health, 97);
  room.creatureSystem.tick();
  assert.equal(game.nest.health, 97);
  game.receiveNestDamage(97);
  room.creatureSystem.tick();
  assert.equal(beetle.raid.phase, "returning");
});

test("군락 유닛도 다른 군락의 둥지에 접근해 정해진 공격 프레임에 피해를 준다", () => {
  const { game, room, colony } = fixture();
  const other = { ...colony, id: 2, ownerId: "other-nest", x: 50 };
  room.colonies.push(other);
  const enemy = createGame(room, other);
  room.games.set(other.ownerId, enemy);
  enemy.agents.splice(0);
  game.agents.splice(1);
  const agent = game.agents[0], target = enemy.nest;
  Object.assign(agent, { x: 49, y: 42, renderFromX: 49, renderFromY: 42, moveStartedAt: 0, moveDuration: 0,
    mode: "fight", moveBudget: 0, nextDecisionAt: 100, decisionPending: null, knownEnemyIds: new Set([target.id]),
    utility: { action: "fight", target: { id: target.id, kind: "nest", x: target.x, y: target.y, key: target.id }, route: [] } });
  agent.stats.attack = 5;
  game.prepare(10);
  enemy.prepare(10);
  game.tick(0.01);
  assert.equal(agent.attack.targetKind, "nest");
  assert.equal(enemy.nest.health, 100);
  game.prepare(10.3);
  game.tick(0.3);
  assert.equal(enemy.nest.health, 95);
  game.tick(0);
  assert.equal(enemy.nest.health, 95);
});

test("대상 종류가 없는 이전 공격 저장도 기존 유닛에게 피해를 전달한다", () => {
  const { game, room } = fixture();
  game.agents.splice(1);
  const agent = game.agents[0];
  const target = { id: "old-rival:1", x: 48, y: 42, health: 12, cost: 3, carrying: 0, attributes: {},
    stats: { health: 12, attack: 1, speed: 1, vision: 3 }, moveStartedAt: 0, moveDuration: 0 };
  room.games.set("old-rival", { agents: [target], receiveDamage(victim, amount) { victim.health -= amount; } });
  agent.attack = { startedAt: 10, speed: 1, hitAt: 10.3, endsAt: 11,
    targetId: target.id, targetX: target.x, targetY: target.y, damage: 1, resolved: false, hit: false };
  game.prepare(10.3);
  game.tick(0);
  assert.equal(target.health, 11);
  assert.equal(agent.attack.hit, true);
});
