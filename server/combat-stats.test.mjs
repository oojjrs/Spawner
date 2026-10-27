import test from "node:test";
import assert from "node:assert/strict";
import { UNIT_COMBAT_STATS, unitCombatStats, combatDamage, migrateCombatStats } from "./combat-stats.mjs";
import { attributeCounts, unitStats } from "./attributes.mjs";
import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { PLAYER_TRIBES } from "./player-tribes.mjs";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";
import { createCombat } from "./combat.mjs";

function strength(value) {
  return { stats: { combatStrength: value } };
}

function environment() {
  return { simSeconds: 0, damageRandom: () => .5, games: new Map(), colonies: [], food: new Map(), foodSpots: new Map(),
    world: { seed: 7, sites: [], terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), burrows: [] } };
}

test("동급 피해 30과 전투력 차이 25의 지수 배율 및 최소 피해 1을 적용한다", () => {
  assert.equal(combatDamage(strength(20), strength(20)), 30);
  assert.equal(combatDamage(strength(30), strength(20)), 45);
  assert.equal(combatDamage(strength(60), strength(50)), 45);
  assert.equal(combatDamage(strength(45), strength(20)), 82);
  assert.equal(combatDamage(strength(20), strength(45)), 11);
  assert.equal(combatDamage(strength(0), strength(200)), 1);
  assert.equal(combatDamage(strength(20), strength(20), 0), 24);
  assert.equal(combatDamage(strength(20), strength(20), .5), 30);
  assert.equal(combatDamage(strength(20), strength(20), 1), 36);
});

test("4종족과 모든 생물 23종을 정의하고 체력은 모두 100이며 흰발 전투력이 최고다", () => {
  const players = PLAYER_TRIBES.map(tribe => unitCombatStats(tribe.key));
  const species = [...ENCOUNTER_TYPES.map(type => type.key), "spiny-back-beetle"];
  assert.equal(Object.keys(UNIT_COMBAT_STATS).length, 23);
  assert.deepEqual(players.map(profile => profile.health), [100, 100, 100, 100]);
  assert.equal(unitCombatStats("bean").combatStrength, 20);
  assert.equal(new Set(players.map(profile => profile.combatStrength)).size, 4);
  for (const key of species) {
    assert.ok(UNIT_COMBAT_STATS[key]);
    assert.equal(unitCombatStats(key).health, 100);
  }
  assert.equal(Math.max(...Object.values(UNIT_COMBAT_STATS).map(profile => profile.combatStrength)),
    unitCombatStats("white-paw").combatStrength);
  assert.ok(unitCombatStats("walking-forest").combatStrength < unitCombatStats("spiny-back-leader").combatStrength);
});

test("전투 수치를 바꿔도 4종족의 이속·시야·운반·수명 수치는 유지한다", () => {
  for (const tribe of PLAYER_TRIBES) {
    const stats = unitStats(attributeCounts(["feet", "antenna", "strength", "lifespan"]), tribe.key);
    assert.equal(stats.speed, 1.5);
    assert.equal(stats.vision, 5);
    assert.equal(stats.capacity, 2);
    assert.equal(stats.lifespan, 300);
    assert.equal(stats.resistance, 1);
    assert.equal(stats.combatStrength, unitCombatStats(tribe.key).combatStrength);
  }
});

test("이전 저장의 체력 비율과 이동·공격 대기를 보존하고 반복 복원으로 회복하지 않는다", () => {
  const agent = { species: "talon-owl", health: 6, stats: { health: 12, attack: 1, speed: .5, vision: 22 },
    moveStartedAt: 7, moveDuration: 2, nextActionAt: 15, attackReady: 19 };
  migrateCombatStats(agent);
  assert.equal(agent.health, 50);
  assert.equal(agent.stats.health, 100);
  assert.equal(agent.stats.combatStrength, 44);
  assert.deepEqual([agent.stats.speed, agent.stats.vision, agent.moveStartedAt, agent.moveDuration, agent.nextActionAt, agent.attackReady],
    [.5, 22, 7, 2, 15, 19]);
  agent.health -= 1;
  migrateCombatStats(agent);
  assert.equal(agent.health, 49);
  const dead = { species: "vine-turtle", health: 0, stats: { health: 12, speed: .5 } };
  migrateCombatStats(dead);
  assert.equal(dead.health, 0);
});

test("실제 4종족의 생성·이전 저장·성장·재복원에 종족별 전투 수치를 적용한다", () => {
  for (const tribe of PLAYER_TRIBES) {
    const room = environment();
    const colony = { id: 1, ownerId: tribe.key, tribe: tribe.key, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
    room.colonies.push(colony);
    const game = createGame(room, colony);
    room.games.set(colony.ownerId, game);
    const saved = JSON.parse(game.save());
    for (const agent of saved.state.agents) {
      delete agent.stats.combatStrength;
      agent.stats.health = 12;
      agent.health = 6;
    }
    game.restore(JSON.stringify(saved));
    assert.equal(game.agents[0].health, unitCombatStats(tribe.key).health / 2);
    assert.equal(game.agents[0].stats.combatStrength, unitCombatStats(tribe.key).combatStrength);
    game.prepare(35);
    game.tick(0);
    assert.ok(game.agents.every(agent => agent.stats.health === 100));
    const before = game.agents.map(agent => ({ health: agent.health, stats: { ...agent.stats } }));
    game.restore(game.save());
    assert.deepEqual(game.agents.map(agent => ({ health: agent.health, stats: { ...agent.stats } })), before);
  }
});

test("실제 생물 생성과 이전 저장 복원에서도 생물별 전투 수치를 사용한다", () => {
  const room = environment();
  room.world.encounters = [{ key: "talon-owl", x: 140, y: 140, radius: 22, safeRadius: 10, terrains: [4],
    cells: [140 * 320 + 140], spawnPoints: [140 * 320 + 140], route: [] }];
  const creatures = createCreatures(room, null);
  assert.equal(creatures.agents[0].stats.combatStrength, 44);
  assert.equal(creatures.agents[0].health, 100);
  const saved = JSON.parse(JSON.stringify(creatures.save()));
  const owl = saved.encounters.agents[0];
  delete owl.stats.combatStrength;
  owl.stats.health = 12;
  owl.health = 6;
  const restored = createCreatures(room, saved).agents[0];
  assert.equal(restored.health, 50);
  assert.equal(restored.stats.combatStrength, 44);
  assert.equal(restored.stats.speed, .5);
});

test("이속 강화가 공격 차례를 늘리지 않고 새싹콩 혼자 갈퀴부엉이를 이기지 못한다", () => {
  const room = environment();
  const bean = { id: "bean", ownerId: "player", tribe: "bean", combatDisposition: "passive", x: 100, y: 100,
    health: 100, stats: { ...unitCombatStats("bean"), speed: 1.5 }, moveStartedAt: 0, moveDuration: 0 };
  const owl = { id: "owl", species: "talon-owl", x: 100, y: 100, health: 100,
    stats: { ...unitCombatStats("talon-owl"), speed: .5 }, moveStartedAt: 0, moveDuration: 0 };
  room.games.set("player", { agents: [bean], receiveDamage(agent, damage) {
    agent.health = Math.max(0, agent.health - damage); agent.hurtStartedAt = room.simSeconds;
  } });
  room.creatureSystem = { agents: [owl], receiveDamage(agent, damage) {
    agent.health = Math.max(0, agent.health - damage); agent.hurtStartedAt = room.simSeconds;
  } };
  const combat = createCombat(room);
  for (let step = 0; step < 2000 && bean.health > 0 && owl.health > 0; step++) {
    room.simSeconds = step * .02;
    combat.update(bean, room.simSeconds);
    combat.update(owl, room.simSeconds);
  }
  assert.equal(bean.health, 0);
  assert.ok(owl.health > 0);
  assert.equal(bean.stats.speed, 1.5);
  assert.equal(owl.stats.speed, .5);
});

test("실제 군락 유닛끼리 치명적인 근접 피해를 교환하면 양쪽 사망을 모두 처리한다", () => {
  const room = environment();
  const games = ["left", "right"].map((ownerId, index) => {
    const colony = { id: index + 1, ownerId, tribe: "bean", x: 40 + index * 10, y: 40, occupiedCells: new Set(["2,2"]) };
    room.colonies.push(colony);
    const game = createGame(room, colony);
    room.games.set(ownerId, game);
    game.agents.splice(1);
    Object.assign(game.agents[0], { x: 100, y: 100, renderFromX: 100, renderFromY: 100,
      health: 1, moveStartedAt: 0, moveDuration: 0, combatDisposition: index ? "passive" : "aggressive" });
    return game;
  });
  const [left, right] = games.map(game => game.agents[0]);
  room.combatSystem.update(left, 0);
  room.simSeconds = left.attack.hitAt;
  for (const game of games) game.prepare(room.simSeconds);
  room.combatSystem.update(left, room.simSeconds);
  assert.equal(left.health, 0); assert.equal(right.health, 0);
  assert.ok(games.every(game => game.agents.length === 0));
});
