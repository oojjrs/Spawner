import test from "node:test";
import assert from "node:assert/strict";
import { UNIT_COMBAT_STATS, unitCombatStats, combatProfile, combatStrength, combatInjuryPenalty, combatDamage, migrateCombatStats } from "./combat-stats.mjs";
import { DNA_COMBAT_RULES, dnaCombatStats } from "./dna-combat-stats.mjs";
import { attributeCounts, unitStats } from "./attributes.mjs";
import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { PLAYER_TRIBES } from "./player-tribes.mjs";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";
import { createCombat } from "./combat.mjs";

function strength(value) {
  return { stats: { combatStrength: value } };
}

test("방어숙련은 조각당 5%p를 더하고 중립도 종별 블록 감경을 사용한다", () => {
  for (const species of Object.keys(UNIT_COMBAT_STATS)) {
    const expected=unitCombatStats(species).combat?.blockPower/100||.5;
    assert.equal(unitCombatStats(species).blockReduction, expected);
    for (const blockReduction of [0, .4, .65, .9, 1])
      assert.equal(combatProfile({ species, stats: { blockReduction } }).blockReduction, expected);
  }
  for (const [count, expected] of [[0, 50], [1, 55], [2, 60], [8, 90], [20, 90]]) {
    const stats = dnaCombatStats({ blockPower: count }, { blockPower: count * 4 });
    assert.ok(Math.abs(stats.blockPower - expected) < 1e-9);
    assert.ok(Math.abs(combatProfile({ stats: { dna: stats } }).blockReduction - expected / 100) < 1e-9);
  }
  assert.equal(combatProfile({ stats: { dna: {} } }).blockReduction, .5);
  assert.equal(combatProfile({ stats: { dna: { blockPower: 100 } } }).blockReduction, .9);
  const agent = { species: "vine-turtle", health: 37, attackReady: 9,
    stats: { health: 100, combatStrength: 28, block: .28, blockReduction: .65 } };
  migrateCombatStats(agent);
  assert.equal(agent.stats.blockReduction, unitCombatStats(agent.species).combat.blockPower/100);
  assert.deepEqual([agent.health, agent.attackReady, agent.stats.block], [unitCombatStats(agent.species).health * .37, 9, unitCombatStats(agent.species).block]);
});

test("중립 전투 프로필은 중복 필드 대신 같은 종 능력치의 공격·방어·블록 값을 사용한다", () => {
  const base=unitCombatStats("spiny-back-beetle");
  const combat={...base.combat,meleePower:17,rangedPower:13,meleeSpeed:1.7,rangedSpeed:1.3,armor:72,evasion:21,parry:32,block:43,blockPower:85};
  const agent={species:"spiny-back-beetle",stats:{...base,combat,attackPower:1,attackSpeed:.1,defense:0,evasion:0,parry:0,block:0,blockReduction:.5}};
  for(const mode of ["melee","ranged"]) {
    agent.attack={attackMode:mode};
    const profile=combatProfile(agent);
    assert.equal(profile.attackPower,mode==="melee"?17:13);assert.equal(profile.attackSpeed,mode==="melee"?1.7:1.3);
    assert.equal(profile.defense,72);assert.equal(profile.evasion,.21);assert.equal(profile.parry,.32);assert.equal(profile.block,.43);assert.equal(profile.blockReduction,.85);
  }
});

test("근접 폭딜·원거리 다수 제어·갑각 방어 투자는 서로 다른 강점을 만든다", () => {
  const melee = dnaCombatStats({ blade: 1 }, { power: 2, critical: 3, criticalPower: 4, focus: 4 });
  const ranged = dnaCombatStats({ secretion: 1 }, { rangedPower: 2, area: 3, areaPower: 4, stun: 3, stunTime: 4 });
  const armored = dnaCombatStats({ carapace: 1, blockPower: 1 }, { carapace: 2, block: 3, counter: 3, reflection: 4 });
  const worker = dnaCombatStats({ gather: 1 }, { counter: 3, counterPower: 4 });
  assert.ok(melee.meleePower > ranged.rangedPower * 2);
  assert.ok(melee.critical >= 30 && melee.criticalPower >= 250 && melee.focus < .15);
  assert.ok(ranged.rangedPower * (1 + ranged.area * ranged.areaPower / 100) > melee.meleePower);
  assert.ok(ranged.stun >= 18 && ranged.stunTime >= .75);
  assert.equal(armored.meleePower, 1); assert.equal(armored.counter, 30);
  assert.equal(worker.counter, 0); assert.equal(worker.counterPower, 0);
  assert.ok(armored.block >= 25 && armored.reflection >= 20);
  const source = { stats: { dna: { ...melee, meleePower: 20 } } }, target = { stats: { dna: armored } };
  assert.ok(Math.abs(combatDamage(source, target, .5) - 20 / 1.2) < 1e-9);
});

function environment() {
  return { simSeconds: 0, damageRandom: () => .5, games: new Map(), colonies: [], food: new Map(), foodSpots: new Map(),
    world: { seed: 7, sites: [], terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), burrows: [] } };
}

test("RPG 공격력·방어력의 비율과 난수 범위 및 최소 피해 1을 적용한다", () => {
  // P = 12 + strength * .35, D = 8 + strength * .4;
  // round(P * 100 / (100 + D)), with a clamped 0.8–1.2 variation.
  for (const [attack, defense, expected] of [[20, 20, 16], [30, 20, 19],
    [60, 50, 26], [45, 20, 24], [20, 45, 15], [0, 10000, 1]]) {
    assert.equal(combatDamage(strength(attack), strength(defense)), expected);
  }
  for (const [variation, expected] of [[-1, 13], [0, 13], [.5, 16], [1, 20], [2, 20]]) {
    assert.equal(combatDamage(strength(20), strength(20), variation), expected);
  }
});

test("체력 손실을 최대 10의 부상 페널티로 반올림하며 기본 전투력은 보존한다", () => {
  const agent = { tribe: "bean", health: 100, stats: { health: 100, combatStrength: 20 } };
  for (const [health, penalty, effective] of [[100, 0, 20], [96, 0, 20], [95, 1, 19], [94, 1, 19],
    [70, 3, 17], [50, 5, 15], [10, 9, 11], [1, 10, 10], [0, 10, 10]]) {
    agent.health = health;
    assert.equal(combatInjuryPenalty(agent), penalty);
    assert.equal(combatStrength(agent), effective);
    assert.equal(agent.stats.combatStrength, 20);
  }
  agent.health = 100;
  assert.equal(combatStrength(agent), 20);
  assert.equal(combatStrength({ tribe: "bean", health: 50 }), 15);
});

test("RPG 피해는 현재 체력에 따른 구형 부상 페널티를 사용하지 않는다", () => {
  const healthy = { health: 100, stats: { health: 100, combatStrength: 20 } };
  const injured = { health: 50, stats: { health: 100, combatStrength: 20 } };
  assert.equal(combatDamage(injured, healthy), 16);
  assert.equal(combatDamage(healthy, injured), 16);
  assert.equal(combatDamage(injured, injured), 16);
});

test("4종족과 모든 생물 23종을 정의하고 중립은 종별 기획 체력을 사용한다", () => {
  const players = PLAYER_TRIBES.map(tribe => unitCombatStats(tribe.key));
  const species = [...ENCOUNTER_TYPES.map(type => type.key), "spiny-back-beetle"];
  assert.equal(Object.keys(UNIT_COMBAT_STATS).length, 23);
  assert.deepEqual(players.map(profile => profile.health), [100, 100, 100, 100]);
  assert.equal(unitCombatStats("bean").combatStrength, 20);
  assert.equal(new Set(players.map(profile => profile.combatStrength)).size, 4);
  for (const key of species) {
    assert.ok(UNIT_COMBAT_STATS[key]);
    assert.equal(unitCombatStats(key).health, unitCombatStats(key).combat.health);
  }
  assert.equal(Math.max(...Object.values(UNIT_COMBAT_STATS).map(profile => profile.combatStrength)),
    unitCombatStats("white-paw").combatStrength);
  assert.ok(unitCombatStats("walking-forest").combatStrength < unitCombatStats("spiny-back-leader").combatStrength);
});

test("전투 수치를 바꿔도 4종족의 이속·시야·운반 수치는 유지한다", () => {
  for (const tribe of PLAYER_TRIBES) {
    const stats = unitStats(attributeCounts(["feet", "antenna", "strength"]), tribe.key);
    const speeds = { bean: .8, spore: .8, pebble: .65, spring: 1.2 };
    assert.ok(Math.abs(stats.speed - speeds[tribe.key]) < 1e-12);
    assert.equal(stats.vision, 6);
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
  assert.equal(agent.health, unitCombatStats(agent.species).health / 2);
  assert.equal(agent.stats.health, unitCombatStats(agent.species).health);
  assert.equal(agent.stats.combatStrength, 44);
  assert.deepEqual([agent.stats.speed, agent.stats.vision, agent.moveStartedAt, agent.moveDuration, agent.nextActionAt, agent.attackReady],
    [unitCombatStats(agent.species).speed, unitCombatStats(agent.species).vision, 7, 2, 15, 19]);
  agent.health -= 1;
  migrateCombatStats(agent);
  assert.equal(agent.health, unitCombatStats(agent.species).health / 2 - 1);
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
      agent.dna = null; delete agent.stats.dna; // Explicit old-save migration.
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
  room.simSeconds = ENCOUNTER_TYPES.find(type => type.key === "talon-owl").firstSpawnAt;
  room.world.encounters = [{ key: "talon-owl", x: 140, y: 140, radius: 22, safeRadius: 10, terrains: [4],
    cells: [140 * 320 + 140], spawnPoints: [140 * 320 + 140], route: [] }];
  const creatures = createCreatures(room, null);
  assert.equal(creatures.agents.length, 1);
  assert.equal(creatures.agents[0].species, "talon-owl");
  assert.equal(creatures.agents[0].stats.combatStrength, 44);
  assert.equal(creatures.agents[0].health, unitCombatStats("talon-owl").health);
  const saved = JSON.parse(JSON.stringify(creatures.save()));
  const owl = saved.encounters.agents[0];
  delete owl.stats.combatStrength;
  owl.stats.health = 12;
  owl.health = 6;
  const restored = createCreatures(room, saved).agents[0];
  assert.equal(restored.health, unitCombatStats("talon-owl").health / 2);
  assert.equal(restored.stats.combatStrength, 44);
  assert.equal(restored.stats.speed, unitCombatStats("talon-owl").speed);
});

test("탈출로 없는 교전은 이속 강화가 공격 차례를 늘리지 않고 새싹콩이 갈퀴부엉이에게 진다", () => {
  const room = environment();
  for (const [x, y] of [[99, 100], [101, 100], [100, 99], [100, 101]]) room.world.terrain[y * 320 + x] = 0;
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

test("실제 군락의 마지막 방어자 사망은 즉시 엔딩을 확정하고 복원 후 사후 반격하지 않는다", () => {
  const room = environment();
  for (const [x, y] of [[99, 100], [101, 100], [100, 99], [100, 101]]) room.world.terrain[y * 320 + x] = 0;
  const games = ["left", "right"].map((ownerId, index) => {
    const colony = { id: index + 1, ownerId, tribe: "bean", x: 40 + index * 10, y: 40, occupiedCells: new Set(["2,2"]) };
    room.colonies.push(colony);
    const game = createGame(room, colony);
    room.games.set(ownerId, game);
    game.agents.splice(1);
    Object.assign(game.agents[0], { dna:null, attributes:{}, stats:unitStats({}, "bean"), x: 100, y: 100, renderFromX: 100, renderFromY: 100,
      health: 1, moveStartedAt: 0, moveDuration: 0, combatDisposition: index ? "passive" : "aggressive" });
    return game;
  });
  const [left, right] = games.map(game => game.agents[0]);
  games[1].receiveNestDamage(100);
  room.combatSystem.update(left, 0);
  assert.ok(left.combat); assert.equal(left.attack, null);
  for (const [index, agent] of [left, right].entries())
    Object.assign(agent.combat.position, { x: index ? .4 : -.4, y: 0, fromX: index ? .4 : -.4, fromY: 0 });
  room.simSeconds = .05;
  room.combatSystem.update(left, room.simSeconds);
  assert.equal(left.attack.targetId, right.id);
  assert.equal(right.attack.targetId, left.id);
  room.simSeconds = left.attack.hitAt;
  for (const game of games) game.prepare(room.simSeconds);
  room.combatSystem.update(left, room.simSeconds);
  assert.equal(left.health, 1); assert.equal(right.health, 0);
  assert.deepEqual(games.map(game => game.agents.length), [1, 0]);
  const ending = games[1].checkEnding();
  assert.equal(ending.reason, "nest-destroyed");
  assert.equal(ending.endedAt, room.simSeconds);
  assert.equal(left.combat, null); assert.equal(left.attack, null);
  games[0].restore(games[0].save());
  const restored = games[0].agents[0];
  room.simSeconds += 2;
  for (const game of games) game.prepare(room.simSeconds);
  room.combatSystem.update(restored, room.simSeconds);
  assert.equal(restored.health, 1);
  assert.equal(restored.combat, null); assert.equal(restored.attack, null);
  assert.deepEqual(games.map(game => game.agents.length), [1, 0]);
  assert.deepEqual(games[1].checkEnding(), ending);
});
