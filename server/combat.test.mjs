import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCombat, combatDisposition, canPursueCombat, peacefulEscapeChance } from "./combat.mjs";
import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";
import { AGENT_ATTACK_DURATION, AGENT_ATTACK_HIT_TIME, attackAnimationElapsed } from "./attack.mjs";
import { unitAnimationPose } from "../client/unit-animation.mjs";
import { CREATURE_ATTACK_TIMINGS } from "./creature-attack.mjs";
import { combatDamage, combatProfile, unitCombatStats } from "./combat-stats.mjs";
import { BEETLE_ANIMATIONS } from "./beetle-animation.mjs";

function unit(id, ownerId, disposition) {
  return { id, ownerId, combatDisposition: disposition, x: 100, y: 100, renderFromX: 100, renderFromY: 100,
    moveStartedAt: 0, moveDuration: 0, health: 100, attributes: {},
    stats: { health: 100, attack: 1, speed: 1, vision: 4 }, mode: "idle", stepCount: 0 };
}

function fixture(units) {
  const hits = [], environment = { games: new Map(), colonies: [], simSeconds: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) }, combatRandom: () => .99, damageRandom: () => .5 };
  for (const owner of new Set(units.map(agent => agent.ownerId))) environment.games.set(owner, {
    agents: units.filter(agent => agent.ownerId === owner),
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); agent.hurtStartedAt = environment.simSeconds; hits.push(agent.id); }
  });
  const combat = createCombat(environment);
  function tick(time) {
    environment.simSeconds = time;
    for (const game of environment.games.values()) for (const agent of game.agents) if (agent.health > 0) combat.update(agent, time);
  }
  return { environment, combat, tick, hits };
}

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

function advanceUntil(f, predicate, seconds) {
  const startedAt = f.environment.simSeconds;
  for (let step = 0; step <= Math.ceil(seconds * 20) && !predicate(); step++) f.tick(startedAt + step / 20);
  assert.ok(predicate(), `expected combat event within ${seconds} seconds`);
}

function startAttacks(f, agents) {
  advanceUntil(f, () => agents.every(agent => agent.attack), 20);
}

function singleNativeAttack(agent) {
  const base = unitCombatStats(agent.species);
  agent.stats = { ...base, ...agent.stats, evasion: 0, parry: 0, block: 0, criticalChance: 0,
    combat: { ...base.combat, hits: 1, counter: 0, stun: 0, bleed: 0, area: 0, lifesteal: 0, reflection: 0, regeneration: 0 } };
}

function holdAttacks(f, agents) {
  f.tick(0);
  for (const agent of agents) { agent.attack = null; agent.attackReady = 1000; agent.combat.nextAttackAt = 1000; }
}

function enclose(fixture, agent) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) fixture.environment.world.terrain[(agent.y + dy) * 320 + agent.x + dx] = 0;
}


// The 2026-11-02 RPG contract supersedes alternating exchanges, injury penalties,
// precomputed damage and guaranteed postmortem counters. Exercise independent
// attacks and persisted event boundaries instead of the removed exchange fields.

test("비선공끼리는 싸우지 않으며 선공도 같은 셀에 도착한 뒤에만 캐칭한다", () => {
  assert.equal(combatDisposition({ attributes: { aggression: 1 } }), "passive");
  assert.equal(combatDisposition({ attributes: { peaceful: 1 } }), "passive");
  const a = unit("a", "left", "passive"), b = unit("b", "right", "passive");
  const f = fixture([a, b]);
  f.tick(0);
  assert.ok(!a.combat && !b.combat);
  a.combatDisposition = "aggressive";
  b.x++;
  f.tick(.1);
  assert.ok(!a.combat && !b.combat);
  a.renderFromX = a.x; a.x++; a.moveStartedAt = .1; a.moveDuration = 1;
  f.tick(.5);
  assert.ok(!a.combat && !b.combat);
  f.tick(1.1);
  assert.equal(a.combat.id, b.combat.id);
  assert.notEqual(a.combat.side, b.combat.side);
});

test("유니크는 비선공 또는 선공만 허용하고 일반 평화종과 구분한다", () => {
  for (const type of ENCOUNTER_TYPES.filter(entry => entry.unique)) assert.ok(["passive", "aggressive"].includes(combatDisposition({ species: type.key })));
  assert.equal(combatDisposition({ species: "spring-keeper", combatDisposition: "peaceful" }), "passive");
  assert.equal(combatDisposition({ species: "white-paw" }), "aggressive");
  assert.equal(combatDisposition({ species: "flower-tail-bird" }), "peaceful");
});

test("후퇴 중인 아군은 같은 셀의 전투에 자동 합류하지 않지만 적에게 붙잡힐 수 있다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive"), ally = unit("ally", "left", "passive");
  ally.retreat = { recoverHealth: 70, safeSince: null, startedAt: 0, attempts: 1 };
  const f = fixture([a, b, ally]);
  f.tick(0);
  assert.ok(a.combat && b.combat);
  assert.equal(ally.combat, undefined);
  b.combatDisposition = "aggressive";
  assert.equal(canPursueCombat(b, ally, 5), true);
  assert.equal(canPursueCombat(ally, b, 5), false);
});

test("탈출할 인접 셀이 없으면 위급한 일꾼도 멈추지 않고 마지막 전투를 수행한다", () => {
  const a = unit("a", "left", "passive"), b = unit("b", "right", "aggressive");
  a.health = 20;
  const f = fixture([a, b]);
  for (const [x, y] of [[99, 100], [101, 100], [100, 99], [100, 101]]) f.environment.world.terrain[y * 320 + x] = 0;
  let rolls = 0;
  f.environment.combatRandom = () => { rolls++; return 0; };
  for (let step = 0; step <= 60 && !a.attack; step++) f.tick(step / 20);
  assert.ok(a.attack);
  assert.ok(a.retreat);
  assert.equal(rolls, 0);
});

function durable(...agents) {
  for (const agent of agents) agent.health = agent.stats.health = 10000;
  return agents;
}

function pair() {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive");
  return { a, b, ...fixture([a, b]) };
}

test("붙잡힌 비선공도 독립적으로 공격하고 일반 이동으로 전투를 해제하지 않는다", () => {
  const f = pair(), { a, b, tick } = f;
  startAttacks(f, [a, b]);
  assert.ok(a.attack && b.attack);
  assert.equal(a.attack.counter, false); assert.equal(b.attack.counter, false);
  const hitAt = a.attack.hitAt;
  const damageA = combatDamage(a, b, .5), damageB = combatDamage(b, a, .5);
  tick(hitAt - 1e-6);
  assert.deepEqual([a.health, b.health], [100, 100]);
  tick(hitAt);
  assert.deepEqual([a.health, b.health], [100 - damageB, 100 - damageA]);
  b.mode = "flee"; b.moveBudget = 5;
  tick(hitAt + .01);
  assert.equal(b.combat.id, a.combat.id); assert.equal(b.moveBudget, 0);
  assert.deepEqual([a.x, a.y, b.x, b.y], [100, 100, 100, 100]);
});

test("아군 증원은 기존 공격을 끊지 않고 접근 후 자기 공속으로 합류한다", () => {
  const [a, b, ally] = durable(unit("a", "left", "aggressive"), unit("b", "right", "passive"), unit("ally", "left", "passive"));
  ally.x--;
  const f = fixture([a, b, ally]); startAttacks(f, [a, b]);
  const attack = a.attack, joinedAt = f.environment.simSeconds + .01;
  assert.ok(canPursueCombat(ally, b, joinedAt));
  ally.x++; f.tick(joinedAt);
  assert.equal(ally.combat.id, a.combat.id); assert.equal(ally.combat.side, a.combat.side);
  assert.equal(a.attack, attack); assert.equal(ally.attack, null);
  startAttacks(f, [ally]);
  assert.ok(ally.attack.startedAt > joinedAt);
  near(ally.combat.nextAttackAt - ally.attack.endsAt, combatProfile(ally).attackInterval);
  const before = f.hits.filter(id => id === "b").length;
  f.tick(ally.attack.hitAt);
  assert.ok(f.hits.filter(id => id === "b").length > before);
});

for (const speed of [.1, .5, 1, 1.5, 2, 8]) {
  test(`이동 속도 ${speed}는 접근 시간과 별개로 공격 간격을 변경하지 않는다`, () => {
    const f = pair(); durable(f.a, f.b); f.a.stats.speed = speed;
    startAttacks(f, [f.a, f.b]);
    const first = f.a.attack;
    near(first.hitAt - first.startedAt, combatProfile(f.a).windup);
    near(f.a.combat.nextAttackAt - first.endsAt, combatProfile(f.a).attackInterval);
    near(f.b.combat.nextAttackAt - f.b.attack.endsAt, combatProfile(f.b).attackInterval);
    f.tick(f.a.combat.nextAttackAt);
    assert.equal(f.a.combat.attackCount, 2);
    near(f.a.attack.startedAt - first.endsAt, combatProfile(f.a).attackInterval);
  });
}

test("공격 속도가 다른 유닛은 공통 교대 차례를 기다리지 않는다", () => {
  const f = pair(); durable(f.a, f.b);
  f.a.stats.attackSpeed = 2; f.b.stats.attackSpeed = .5;
  startAttacks(f, [f.a, f.b]);
  const firstA = f.a.attack, firstB = f.b.attack;
  near(f.a.combat.nextAttackAt - firstA.endsAt, .5);
  near(f.b.combat.nextAttackAt - firstB.endsAt, 2);
  const nextA = f.a.combat.nextAttackAt;
  assert.ok(nextA < f.b.combat.nextAttackAt);
  f.tick(nextA);
  assert.equal(f.a.combat.attackCount, 2); assert.equal(f.b.combat.attackCount, 1);
});

for (const [left, right] of [[3, 1], [1, 3], [2, 2]]) {
  test(`${left} 대 ${right} 전투는 모든 생존자가 접근 후 독립적으로 공격한다`, () => {
    const agents = durable(...Array.from({ length: left + right }, (_, i) => unit(String(i), i < left ? "left" : "right", "aggressive")));
    const f = fixture(agents); f.tick(0);
    assert.equal(new Set(agents.map(a => a.combat.id)).size, 1);
    assert.ok(agents.every(a => !a.attack));
    advanceUntil(f, () => agents.every(agent => agent.combat.attackCount > 0 && agent.combat.completedExchanges > 0), 20);
    assert.ok(f.hits.length >= agents.length);
    const health = agents.map(a => a.health), hits = [...f.hits]; f.tick(f.environment.simSeconds);
    assert.deepEqual(agents.map(a => a.health), health); assert.deepEqual(f.hits, hits);
  });
}

test("피해 난수는 예약 시점이 아닌 실제 명중 때 한 번 소비한다", () => {
  const f = pair(); let rolls = 0;
  f.environment.damageRandom = () => { rolls++; return .5; };
  startAttacks(f, [f.a, f.b]); assert.equal(rolls, 0);
  f.tick(f.a.attack.hitAt); assert.equal(rolls, 2);
  f.tick(f.environment.simSeconds); assert.equal(rolls, 2);
});

test("부상은 현재 RPG 공격력을 감소시키지 않는다", () => {
  const healthy = pair(), injured = pair();
  injured.a.health = 70;
  startAttacks(healthy, [healthy.a, healthy.b]); startAttacks(injured, [injured.a, injured.b]);
  healthy.tick(healthy.a.attack.hitAt); injured.tick(injured.a.attack.hitAt);
  assert.equal(healthy.b.health, injured.b.health);
});

test("치명타로 죽은 대상의 예약 공격을 취소하고 전투를 즉시 해제한다", () => {
  const f = pair(); f.b.health = 1;
  startAttacks(f, [f.a, f.b]); const hitAt = f.a.attack.hitAt;
  f.tick(hitAt);
  assert.equal(f.b.health, 0); assert.equal(f.a.health, 100);
  assert.deepEqual(f.hits, ["b"]);
  assert.equal(f.b.attack, null); assert.equal(f.a.attack, null);
  assert.equal(f.a.combat, null); assert.equal(f.b.combat, null);
  assert.equal(f.a.nextDecisionAt, hitAt);
  f.tick(hitAt + 5); assert.deepEqual(f.hits, ["b"]);
});

for (const phase of ["windup", "recovery", "dead"]) {
  test(`${phase} 저장 복원은 피해나 사후 공격을 재실행하지 않는다`, () => {
    const f = pair(); if (phase === "dead") f.b.health = 1;
    startAttacks(f, [f.a, f.b]); const hitAt = f.a.attack.hitAt;
    if (phase !== "windup") f.tick(hitAt);
    const saved = JSON.parse(JSON.stringify([f.a, f.b])), next = fixture(saved);
    const before = saved.map(a => a.health);
    next.tick(hitAt); next.tick(hitAt);
    assert.equal(next.hits.length, phase === "windup" ? 2 : 0);
    if (phase !== "windup") assert.deepEqual(saved.map(a => a.health), before);
    const again = fixture(JSON.parse(JSON.stringify(saved)));
    again.tick(hitAt + .01); assert.deepEqual(again.hits, []);
  });
}

test("구형 교환 저장은 이미 적용한 피해를 보존하고 독립 공속 상태로 이행한다", () => {
  const f = pair(); startAttacks(f, [f.a, f.b]); f.tick(f.a.attack.hitAt);
  const saved = JSON.parse(JSON.stringify([f.a, f.b]));
  for (const a of saved) {
    delete a.combat.version;
    a.combat.pendingCounter = { hitAt: .5, damage: 99 };
    a.combat.nextAttackTurn = a.id === "a" ? .25 : 20;
    a.attack.exchange = { damage: 99, counterDamage: 99 };
  }
  const health = saved.map(a => a.health), next = fixture(saved); next.tick(f.environment.simSeconds + .1);
  assert.deepEqual(saved.map(a => a.health), health);
  assert.ok(saved.every(a => a.combat.version === 2));
  assert.ok(saved.every(a => !a.combat.pendingCounter && !a.attack?.exchange));
  startAttacks(next, saved); assert.ok(saved.every(a => !a.attack.counter));
});

function peacefulPair() {
  const a = unit("a", "left", "aggressive"), b = unit("b", null, "peaceful");
  b.species = "flower-tail-bird";
  const f = { a, b, ...fixture(durable(a, b)) }; holdAttacks(f, [a, b]); return f;
}

test("평화형은 공격 대기 중에도 일정 간격으로 안전한 인접 셀로 탈출한다", () => {
  const f = peacefulPair(); let rolls = 0;
  f.environment.combatRandom = () => ++rolls === 1 ? .9 : .1;
  f.tick(.4); assert.equal(f.hits.length, 0); assert.equal(rolls, 0);
  f.tick(1.5); assert.equal(rolls, 1); assert.ok(f.b.combat);
  f.tick(3); assert.equal(rolls, 2); assert.equal(f.b.combat, null);
  assert.equal(Math.abs(f.b.x - 100) + Math.abs(f.b.y - 100), 1);
  assert.ok(f.b.escapeUntil > f.b.moveStartedAt + f.b.moveDuration);
  f.a.x = f.b.x; f.a.y = f.b.y; f.tick(3.1);
  assert.equal(f.a.combat, null); assert.equal(f.b.combat, null);
});

test("평화형 탈출은 기본 80%이며 사냥 억제 수치로 낮출 수 있다", () => {
  assert.equal(peacefulEscapeChance(0), .8); assert.equal(peacefulEscapeChance(.5), .4); assert.equal(peacefulEscapeChance(2), 0);
  const f = peacefulPair(); f.a.stats.escapeSuppression = .5;
  f.environment.combatRandom = () => .6;
  f.tick(0); f.tick(1.5); assert.ok(f.b.combat);
  f.a.stats.escapeSuppression = 0;
  f.tick(3); assert.equal(f.b.combat, null);
});

test("막힌 출구는 난수를 소비하거나 순간이동하지 않고 다음 탈출 기회를 기다린다", () => {
  const f = peacefulPair(); enclose(f, f.b); let rolls = 0;
  f.environment.combatRandom = () => { rolls++; return 0; };
  f.tick(0); f.tick(1.5);
  assert.ok(f.b.combat); assert.equal(rolls, 0);
  assert.deepEqual([f.b.x, f.b.y], [100, 100]);
  f.environment.world.terrain[100 * 320 + 99] = 4;
  f.tick(3); assert.equal(f.b.x, 99); assert.equal(f.b.combat, null);
});

test("실패한 탈출 대기의 저장 복원은 같은 시각에 다시 판정하지 않는다", () => {
  const f = peacefulPair(); f.tick(0); f.tick(1.5);
  const saved = JSON.parse(JSON.stringify([f.a, f.b])), next = fixture(saved); let rolls = 0;
  next.environment.combatRandom = () => { rolls++; return 0; };
  next.tick(1.5); assert.equal(rolls, 0); assert.equal(saved[1].combat.nextEscapeAt, 3);
  next.tick(3); assert.equal(rolls, 1); assert.equal(saved[1].combat, null);
});

test("소속 유닛의 평화 성향에 중립 생물의 탈출 예외를 적용하지 않는다", () => {
  const f = pair(); durable(f.a, f.b); f.a.combatDisposition = "peaceful"; f.b.combatDisposition = "aggressive";
  let rolls = 0; f.environment.combatRandom = () => { rolls++; return 0; };
  holdAttacks(f, [f.a, f.b]); f.tick(1.5); assert.equal(rolls, 0); assert.ok(f.a.combat && f.b.combat);
});

for (const species of Object.keys(CREATURE_ATTACK_TIMINGS)) {
  test(`${species} 단일 공격은 원본 타격 셀과 실제 명중 또는 투사체 도달을 한 번 처리한다`, () => {
    const animation = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/CreatureAttackV2/" + species + "/attack.json", import.meta.url), "utf8"));
    const hitTime = animation.durationsMs.slice(0, animation.impactFrame).reduce((a, b) => a + b, 0) / 1000;
    const duration = animation.durationsMs.reduce((a, b) => a + b, 0) / 1000;
    assert.deepEqual(CREATURE_ATTACK_TIMINGS[species], { durationMs: duration * 1000, hitTimeMs: hitTime * 1000 });
    const f = pair(); durable(f.a, f.b); f.a.species = species; singleNativeAttack(f.a);
    startAttacks(f, [f.a]); const attack = f.a.attack;
    near(attack.hitAt - attack.startedAt, combatProfile(f.a).windup);
    near(attackAnimationElapsed(attack, attack.hitAt, hitTime, duration), hitTime);
    const before = f.b.health;
    f.tick(attack.hitAt - 1e-6); assert.equal(f.b.health, before);
    f.tick(attack.hitAt);
    if (attack.attackMode === "ranged") {
      assert.equal(f.b.health, before);
      const projectile = f.a.dnaProjectiles.find(entry => entry.launchedAt === attack.hitAt);
      assert.ok(projectile.hitAt > attack.hitAt);
      f.tick(projectile.hitAt - 1e-6); assert.equal(f.b.health, before);
      f.tick(projectile.hitAt);
    }
    assert.ok(f.b.health < before);
    assert.equal(f.hits.filter(id => id === "b").length, 1);
    f.tick(f.environment.simSeconds); assert.equal(f.hits.filter(id => id === "b").length, 1);
    if (f.environment.simSeconds < attack.endsAt) {
      f.tick(attack.endsAt - 1e-6); assert.equal(f.a.attack, attack);
      f.tick(attack.endsAt); assert.equal(f.a.attack, null);
    }
  });
}

test("플레이어와 딱정벌레는 공속 기반 시간과 원본 애니메이션을 분리한다", () => {
  for (const species of [null, "spiny-back-beetle"]) {
    const f = pair(); durable(f.a, f.b); f.a.species = species; if (species) singleNativeAttack(f.a); startAttacks(f, [f.a]);
    const nativeHit = species ? BEETLE_ANIMATIONS.attack.hitTimeMs / 1000 : AGENT_ATTACK_HIT_TIME;
    const nativeDuration = species ? BEETLE_ANIMATIONS.attack.durationMs / 1000 : AGENT_ATTACK_DURATION;
    near(attackAnimationElapsed(f.a.attack, f.a.attack.hitAt, nativeHit, nativeDuration), nativeHit);
    near(f.a.attack.speed, nativeDuration / (f.a.attack.endsAt - f.a.attack.startedAt));
    if (!species) assert.equal(unitAnimationPose(f.a, f.a.attack.hitAt).action, "attack");
  }
});

test("네 종족 모두 실제 게임에서 성향을 적용하고 전투 상태를 저장·복원한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const colony = { id: 1, ownerId: tribe, tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
    const environment = { simSeconds: 10, damageRandom: () => .5, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
      colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
    const game = createGame(environment, colony);
    environment.games.set(tribe, game);
    game.agents.splice(1);
    const agent = game.agents[0], saved = JSON.parse(game.save());
    saved.state.agents[0].combatDisposition = "aggressive";
    saved.state.agents[0].dna = null; // Explicit legacy combat migration fixture, not a starting worker.
    // Construction metamorphosis was removed; legacy saves must not freeze combat.
    saved.state.agents[0].construction = { state: "transforming", buildingKey: "storage" };
    saved.state.agents[0].mode = "transform";
    Object.assign(saved.state.agents[0], { x: 100, y: 100, renderFromX: 100, renderFromY: 100 });
    game.restore(JSON.stringify(saved));
    assert.equal(game.agents[0].construction, undefined);
    assert.notEqual(game.agents[0].mode, "transform");
    const target = unit("target", "other", "passive");
    environment.games.set("other", { agents: [target], receiveDamage(victim, amount) { victim.health -= amount; } });
    game.prepare(10); game.tick(.1);
    assert.equal(game.snapshot().agents[0].combatDisposition, "aggressive");
    assert.ok(game.agents[0].combat);
    const id = game.agents[0].combat.id;
    const live = { environment, tick(time) { const elapsed = time - environment.simSeconds; environment.simSeconds = time; game.prepare(time); game.tick(elapsed); } };
    startAttacks(live, [game.agents[0]]);
    game.restore(game.save());
    assert.equal(game.agents[0].combat.id, id);
    const hitAt = game.agents[0].attack.hitAt;
    const remaining = target.health - combatDamage(game.agents[0], target, .5);
    const elapsed = hitAt - environment.simSeconds; environment.simSeconds = hitAt; game.prepare(hitAt); game.tick(elapsed);
    assert.equal(target.health, remaining);
    environment.simSeconds = hitAt + .01; game.prepare(hitAt + .01); game.tick(.01);
    assert.equal(target.health, remaining);
    assert.ok(agent);
  }
});

test("실제 딱정벌레는 인접 셀에서 원격 공격하지 않고 같은 셀에서 캐칭한다", () => {
  const environment = { simSeconds: 0, damageRandom: () => .5, games: new Map(), colonies: [], food: new Map(), foodSpots: new Map(),
    world: { seed: 7, sites: [], terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320),
      burrows: [{ id: "home", type: "small", x: 130, y: 200, width: 1, height: 1, entrance: { x: 130, y: 201 } }] } };
  environment.creatureSystem = createCreatures(environment, null);
  const beetle = environment.creatureSystem.agents[0], target = unit("target", "player", "passive");
  Object.assign(beetle, { x: 100, y: 100, homeX: 100, homeY: 100, renderFromX: 100, renderFromY: 100 });
  target.x = 101;
  environment.games.set("player", { agents: [target], receiveDamage(victim, amount) { victim.health -= amount; } });
  environment.creatureSystem.tick();
  assert.equal(target.health, 100); assert.ok(!beetle.attack);
  assert.equal(beetle.x, target.x); assert.equal(beetle.mode, "walk");
  environment.simSeconds = beetle.moveDuration;
  environment.creatureSystem.tick();
  assert.equal(beetle.combat.id, target.combat.id);
  assert.ok(beetle.attack);
  const attack = beetle.attack;
  const remaining = target.health - combatDamage(beetle, target, .5);
  environment.simSeconds = attack.hitAt;
  environment.creatureSystem.tick();
  assert.equal(attack.attackMode, "ranged");
  assert.equal(target.health, 100);
  const projectile = beetle.dnaProjectiles.find(entry => entry.launchedAt === attack.hitAt);
  assert.ok(projectile.hitAt > attack.hitAt);
  environment.simSeconds = projectile.hitAt;
  environment.creatureSystem.tick();
  near(target.health, remaining);
});

test("중립으로 표시된 비선공 유니크도 실제 전투에 붙잡히면 반격한다", () => {
  const colony = { id: 1, ownerId: "player", tribe: "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 400, damageRandom: () => .5, combatRandom: () => .99, games: new Map(), colonies: [colony], food: new Map(), foodSpots: new Map(),
    world: { seed: 7, sites: [], terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), burrows: [],
      encounters: [{ key: "old-garden-snail", x: 140, y: 140, radius: 5, safeRadius: 10, terrains: [4],
        cells: [140 * 320 + 140], spawnPoints: [140 * 320 + 140], route: [] }] } };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  const data = JSON.parse(game.save());
  data.state.simSeconds = 400;
  Object.assign(data.state.agents[0], { bornAt: 400, lifespanStartedAt: 400, dna: null, combatDisposition: "aggressive", x: 140, y: 140, renderFromX: 140, renderFromY: 140 });
  game.restore(JSON.stringify(data));
  game.agents[0].x = 139;
  environment.creatureSystem = createCreatures(environment, null);
  const unique = environment.creatureSystem.agents[0];
  assert.equal(unique.faction, "neutral");
  game.agents[0].x = 140; game.agents[0].attackReady = 1000; durable(game.agents[0]);
  enclose({ environment }, game.agents[0]);
  game.prepare(400); game.tick(.01);
  assert.equal(unique.combat.id, game.agents[0].combat.id);
  const live = { environment, tick(time) { const elapsed = time - environment.simSeconds; environment.simSeconds = time; game.prepare(time); game.tick(elapsed); environment.creatureSystem.tick(); } };
  startAttacks(live, [unique]);
  const remaining = game.agents[0].health - combatDamage(unique, game.agents[0], .5);
  environment.simSeconds = unique.attack.hitAt; game.prepare(environment.simSeconds); environment.creatureSystem.tick();
  assert.equal(game.agents[0].health, remaining);
  assert.deepEqual([unique.x, unique.y], [140, 140]);
});

test("방어 반격의 저장 복원은 명중을 한 번 처리하고 일반 공격 예약을 소비한다", () => {
  const f = pair(); durable(f.a, f.b); f.b.attributes = { carapace: 1 }; f.b.attackReady = 1000;
  startAttacks(f, [f.a]); f.tick(f.a.attack.hitAt);
  assert.equal(f.b.attack.counter, true);
  const counter = { ...f.b.attack }, readyAt = f.b.combat.nextAttackAt;
  const saved = JSON.parse(JSON.stringify([f.a, f.b])), next = fixture(saved);
  next.tick(counter.hitAt); next.tick(counter.hitAt);
  assert.deepEqual(next.hits, ["a"]);
  assert.equal(saved[1].combat.nextAttackAt, readyAt);
  const again = fixture(JSON.parse(JSON.stringify(saved)));
  again.tick(counter.hitAt + .01); assert.deepEqual(again.hits, []);
});

test("일꾼의 후퇴 저장은 탈출 대기를 유지하고 안전한 칸으로 탈출한다", () => {
  const f = pair(); f.a.health = 20;
  f.a.combatDisposition = "passive"; f.b.combatDisposition = "aggressive";
  f.a.stats.attackPower = f.b.stats.attackPower = 1;
  let time = 0;
  for (let step = 0; step <= 200 && !(f.a.retreat?.attempts > 0); step++) {
    time = step / 20;
    f.tick(time);
  }
  assert.ok(f.a.retreat.attempts > 0);
  const saved = JSON.parse(JSON.stringify([f.a, f.b])), next = fixture(saved);
  const attempts = saved[0].retreat.attempts, nextEscapeAt = saved[0].combat.nextEscapeAt;
  next.environment.combatRandom = () => 0;
  next.tick(time);
  assert.equal(saved[0].retreat.attempts, attempts);
  assert.equal(saved[0].combat.nextEscapeAt, nextEscapeAt);
  for (let step = 1; step <= 200 && saved[0].combat; step++) next.tick(time + step / 20);
  assert.equal(saved[0].combat, null);
  assert.equal(saved[0].retreat.attempts, attempts + 1);
  assert.equal(saved[0].mode, "flee");
  assert.equal(Math.abs(saved[0].x - 100) + Math.abs(saved[0].y - 100), 1);
});

test("일꾼은 후퇴 탈출 실패 뒤에도 공격을 계속하고 같은 시각에 재시도하지 않는다", () => {
  const f = pair(); f.a.health = 20;
  f.a.combatDisposition = "passive"; f.b.combatDisposition = "aggressive";
  f.a.stats.attackPower = f.b.stats.attackPower = 1;
  let time = 0;
  for (let step = 0; step <= 200 && !(f.a.retreat?.attempts > 0); step++) {
    time = step / 20;
    f.tick(time);
  }
  assert.ok(f.a.retreat.attempts > 0);
  assert.ok(f.a.combat);
  const attempts = f.a.retreat.attempts, count = f.hits.length;
  f.tick(time);
  assert.equal(f.a.retreat.attempts, attempts);
  assert.equal(f.hits.length, count);
  for (let step = 1; step <= 200 && f.hits.length === count; step++) f.tick(time + step / 20);
  assert.ok(f.hits.length > count);
  assert.ok(f.a.combat);
});

// Coverage retained from the exchange-era regression suite: death/corpse state,
// surviving allies, reversed iteration, removed entries and legacy creature saves.
test("마지막 적 처치 후 전투를 해제해도 사망 상태와 시각을 보존한다", () => {
  const f = pair(); f.b.health = 1;
  const game = f.environment.games.get("right"), receive = game.receiveDamage;
  game.receiveDamage = (agent, amount) => {
    receive(agent, amount);
    if (agent.health <= 0) { agent.mode = "death"; agent.diedAt = f.environment.simSeconds; }
  };
  startAttacks(f, [f.a, f.b]); const hitAt = f.a.attack.hitAt; f.tick(hitAt); f.tick(hitAt + 1);
  assert.equal(f.b.mode, "death"); assert.equal(f.b.diedAt, hitAt);
  assert.equal(f.b.attack, null); assert.equal(f.b.combat, null);
  assert.equal(f.a.combat, null); assert.equal(f.a.nextDecisionAt, hitAt);
});

for (const reverse of [false, true]) {
  test(`반격 처치 뒤 ${reverse ? "역순" : "정순"} 갱신도 마지막 적 전투를 즉시 끝낸다`, () => {
    const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive");
    a.health = 1; b.attributes = { carapace: 1 }; b.attackReady = 1000;
    const f = fixture(reverse ? [b, a] : [a, b]); enclose(f, a);
    f.combat.engage(a, b, 0); startAttacks(f, [a]); f.tick(a.attack.hitAt);
    assert.ok(b.attack.counter); const hitAt = b.attack.hitAt;
    f.tick(hitAt - 1e-6); assert.equal(a.health, 1);
    f.tick(hitAt); assert.equal(a.health, 0);
    assert.equal(b.combat, null); assert.equal(b.attack, null); assert.equal(b.nextDecisionAt, hitAt);
    assert.deepEqual(f.hits, ["b", "a"]);
  });
}

test("반격으로 적 하나를 처치해도 남은 적과 전투를 계속하고 재표적한다", () => {
  const a = unit("a", "left", "aggressive"), ally = unit("ally", "left", "passive"), b = unit("b", "right", "passive");
  durable(a, ally, b); a.health = 1; b.attributes = { carapace: 1 }; b.attackReady = 1000;
  const f = fixture([a, ally, b]); enclose(f, a);
  startAttacks(f, [a]); f.tick(a.attack.hitAt); const counter = b.attack;
  assert.ok(counter.counter); f.tick(counter.hitAt);
  assert.equal(a.health, 0); assert.ok(ally.combat && b.combat);
  assert.equal(ally.combat.id, b.combat.id); assert.equal(b.attack, counter);
  f.tick(counter.endsAt); assert.equal(b.attack, null);
  f.tick(b.combat.nextAttackAt);
  assert.equal(b.attack.targetId, ally.id); assert.equal(b.attack.counter, false);
  assert.ok(ally.combat && b.combat);
});

test("사망 후 실제 목록에서 제거된 대상은 저장 복원 후에도 사후 피해를 만들지 않는다", () => {
  const f = pair(); f.a.health = f.b.health = 1; enclose(f, f.a);
  startAttacks(f, [f.a, f.b]); f.tick(f.a.attack.hitAt);
  assert.equal(f.b.health, 0); assert.equal(f.a.health, 1);
  f.environment.games.get("right").agents.length = 0;
  f.tick(1); assert.equal(f.a.health, 1); assert.deepEqual(f.hits, ["b"]);
  const [saved] = JSON.parse(JSON.stringify([f.a])), next = fixture([saved]);
  next.tick(2); next.tick(2);
  assert.equal(saved.health, 1); assert.equal(saved.attack, null); assert.equal(saved.combat, null);
  assert.deepEqual(next.hits, []);
});

test("역순 다대다도 여러 공속 주기 동안 같은 표적·피해·공격 횟수를 유지한다", () => {
  for (const [left, right] of [[3, 1], [1, 3], [2, 2]]) {
    const run = reverse => {
      const agents = durable(...Array.from({ length: left + right }, (_, i) => unit(String(i), i < left ? "left" : "right", i < left ? "aggressive" : "passive")));
      agents.forEach((a, i) => { a.stats.speed = [.1, 8, .5, 2][i]; a.stats.attackSpeed = [1, 2, .5, 1.5][i]; });
      const f = fixture(reverse ? [...agents].reverse() : agents);
      f.combat.engage(agents[0], agents[left], 0);
      for (let step = 0; step <= 600; step++) f.tick(step * .05);
      assert.ok(agents.every(a => a.combat.attackCount >= 3));
      return { hits: f.hits, states: agents.map(a => ({ health: a.health, target: a.combat.targetId, attacks: a.combat.attackCount })) };
    };
    assert.deepEqual(run(true), run(false));
  }
});

test("미명중과 명중 후 구형 종별 저장은 기존 피해를 보존하고 새 공격만 예약한다", () => {
  for (const resolved of [false, true]) {
    const f = pair(); durable(f.a, f.b); f.a.species = "old-garden-snail"; singleNativeAttack(f.a);
    startAttacks(f, [f.a, f.b]); if (resolved) f.tick(f.a.attack.hitAt);
    const saved = JSON.parse(JSON.stringify([f.a, f.b])), health = saved.map(a => a.health);
    for (const agent of saved) {
      delete agent.combat.version;
      Object.assign(agent.attack, { hitAt: .3, endsAt: 1, exchangeEndsAt: 1.2 });
      agent.attack.exchange = { attackApplied: resolved, counterApplied: resolved, attackDamage: 30, counterDamage: 30 };
    }
    const next = fixture(saved), resumedAt = f.environment.simSeconds + .1; next.tick(resumedAt); next.tick(resumedAt);
    assert.deepEqual(saved.map(a => a.health), health); assert.deepEqual(next.hits, []);
    startAttacks(next, saved);
    assert.ok(saved.every(a => !a.attack.exchange));
    const before = [...next.hits], pending = saved.filter(agent => !agent.attack.resolved).map(agent => agent.attack.targetId);
    const hitAt = Math.max(...saved.map(agent => agent.attack.hitAt)); next.tick(hitAt); next.tick(hitAt);
    assert.deepEqual(next.hits.slice(before.length).sort(), pending.sort());
    assert.deepEqual([...new Set(next.hits)].sort(), ["a", "b"]);
    assert.ok(saved.every((a, i) => a.health < health[i]));
  }
});

test("18종의 확정 방어·반격 fixture도 저장 복원 시 원본 타격 셀과 단일 피해를 보존한다", () => {
  for (const species of Object.keys(CREATURE_ATTACK_TIMINGS)) {
    const f = pair(); durable(f.a, f.b); f.b.species = species; singleNativeAttack(f.b);
    Object.assign(f.b.stats.combat, { evasion: 0, parry: 0, block: 100, counter: 100 });
    assert.equal(combatProfile(f.b).block, 1, species);
    assert.equal(combatProfile(f.b).evasion, 0, species);
    f.b.stats.speed = 0; f.b.attackReady = 1000;
    startAttacks(f, [f.a]); f.tick(f.a.attack.hitAt);
    advanceUntil(f, () => f.b.attack?.counter, 20);
    assert.ok(f.b.attack.counter, species);
    const saved = JSON.parse(JSON.stringify([f.a, f.b])), next = fixture(saved), attack = saved[1].attack;
    const native = CREATURE_ATTACK_TIMINGS[species];
    near(attackAnimationElapsed(attack, attack.hitAt, native.hitTimeMs / 1000, native.durationMs / 1000), native.hitTimeMs / 1000);
    next.tick(attack.hitAt - 1e-6); assert.deepEqual(next.hits, []);
    next.tick(attack.hitAt); next.tick(attack.hitAt);
    if (attack.attackMode === "ranged") {
      assert.deepEqual(next.hits, []);
      const projectile = saved[1].dnaProjectiles.find(entry => entry.launchedAt === attack.hitAt);
      next.tick(projectile.hitAt);
    }
    assert.deepEqual(next.hits, ["a"]);
    const again = fixture(JSON.parse(JSON.stringify(saved))); again.tick(next.environment.simSeconds + .01);
    assert.deepEqual(again.hits, []);
    if (next.environment.simSeconds < attack.endsAt) {
      next.tick(attack.endsAt - 1e-6); assert.equal(saved[1].attack, attack);
      next.tick(attack.endsAt); assert.equal(saved[1].attack, null);
    }
  }
});

test("구형 딱정벌레의 인접 공격도 같은 셀로 이동해 새 투사체 도달부터 처리한다", () => {
  const environment = { simSeconds: 0, damageRandom: () => .5, games: new Map(), colonies: [], food: new Map(), foodSpots: new Map(),
    world: { seed: 7, sites: [], terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320),
      burrows: [{ id: "home", type: "small", x: 130, y: 200, width: 1, height: 1, entrance: { x: 130, y: 201 } }] } };
  environment.creatureSystem = createCreatures(environment, null);
  const beetle = environment.creatureSystem.agents[0], target = unit("target", "player", "passive");
  target.x = 101; target.attackReady = 1000;
  Object.assign(beetle, { x: 100, y: 100, homeX: 100, homeY: 100, renderFromX: 100, renderFromY: 100,
    mode: "attack", attackStartedAt: -1, attackTargetId: target.id, attackHit: false });
  environment.games.set("player", { agents: [target], receiveDamage(agent, damage) { agent.health -= damage; } });
  environment.creatureSystem.tick();
  assert.equal(target.health, 100);
  assert.equal(beetle.mode, "walk");
  environment.simSeconds = beetle.moveDuration;
  environment.creatureSystem.tick();
  assert.ok(beetle.attack?.combatId);
  const hitAt = beetle.attack.hitAt;
  const remaining = target.health - combatDamage(beetle, target, .5);
  const beetleRemaining = beetle.health;
  environment.simSeconds = hitAt;
  environment.creatureSystem.tick();
  assert.equal(target.health, 100);
  const projectile = beetle.dnaProjectiles.find(entry => entry.launchedAt === hitAt);
  environment.simSeconds = projectile.hitAt;
  environment.creatureSystem.tick();
  near(target.health, remaining);
  assert.equal(beetle.health, beetleRemaining);
});
