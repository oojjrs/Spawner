import test from "node:test";
import assert from "node:assert/strict";
import { CREATURE_ATTACK_ROLES, creatureAttackRole, creatureAttackMode } from "./creature-attack-role.mjs";
import { createCombat, combatDisposition, canPursueCombat } from "./combat.mjs";
import { unitCombatStats, combatProfile, combatDamage } from "./combat-stats.mjs";
import { CREATURE_MOVEMENT } from "./creature-movement.mjs";
import { DNA_ACTION_RULES } from "./dna-actions.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { NEUTRAL_UNIT_STATS } from "./neutral-unit-stats.mjs";
import { ENCOUNTER_TYPES } from "./encounter-types.mjs";

const approved = [
  ["flower-tail-bird", "ranged", true, true, 8, "peaceful"],
  ["dew-rabbit", "melee", true, false, 10, "peaceful"],
  ["soil-mole", "hybrid", true, true, 14, "peaceful"],
  ["bundle-snail", "melee", true, false, 16, "peaceful"],
  ["cotton-sheep", "melee", true, false, 12, "peaceful"],
  ["rolling-acorn", "melee", true, false, 16, "peaceful"],
  ["bubble-toad", "hybrid", true, true, 28, "aggressive"],
  ["snare-vine", "melee", true, false, 34, "aggressive"],
  ["spiny-back-beetle", "hybrid", true, true, 32, "aggressive"],
  ["soil-boar", "melee", true, false, 36, "aggressive"],
  ["vine-turtle", "hybrid", true, true, 28, "aggressive"],
  ["shadow-weasel", "melee", true, false, 40, "aggressive"],
  ["talon-owl", "melee", true, false, 44, "aggressive"],
  ["spring-keeper", "melee", true, false, 36, "passive"],
  ["lantern-keeper", "ranged", false, true, 38, "passive"],
  ["old-garden-snail", "melee", true, false, 42, "passive"],
  ["walking-forest", "melee", true, false, 48, "passive"],
  ["white-paw", "melee", true, false, 64, "aggressive"],
  ["spiny-back-leader", "hybrid", true, true, 54, "aggressive"]
];
const rangedSpecies = approved.filter(entry => entry[3]).map(entry => entry[0]);
const contactSpecies = approved.filter(entry => entry[2] && entry[3]).map(entry => entry[0]);
const epsilon = 1e-6;

function creature(species, id, disposition) {
  const profile = unitCombatStats(species);
  const agent = { id, species, x: 100, y: 100, renderFromX: 100, renderFromY: 100,
    moveStartedAt: 0, moveDuration: 0, health: profile.health, attributes: {}, carrying: 0,
    stats: { ...profile, combat: { ...profile.combat, hits: 1, counter: 0, stun: 0, bleed: 0, area: 0, lifesteal: 0, reflection: 0, regeneration: 0 }, speed: CREATURE_MOVEMENT[species].speed, vision: 4, resistance: 1 }, mode: "idle", stepCount: 0 };
  if (disposition) agent.combatDisposition = disposition;
  return agent;
}

function fixture(species, separation, disposition) {
  const source = creature(species, "creature:" + species, disposition);
  const target = { id: "target", ownerId: "player", tribe: "bean", combatDisposition: "passive",
    x: 100 + separation, y: 100, renderFromX: 100 + separation, renderFromY: 100,
    moveStartedAt: 0, moveDuration: 0, attackReady: 1000, health: 100, attributes: {}, carrying: 0,
    stats: { ...unitCombatStats("bean"), speed: 1, vision: 4 }, mode: "idle", stepCount: 0 };
  const hits = [], events = [], environment = { games: new Map(), colonies: [], simSeconds: 0,
    food: new Map(), foodSpots: new Map(), combatRandom: () => .99, damageRandom: () => .5,
    onCombatEvent(event) { events.push(event); },
    world: { terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) } };
  function receiveDamage(agent, amount) {
    agent.health = Math.max(0, agent.health - amount);
    agent.hurtStartedAt = environment.simSeconds;
    hits.push({ id: agent.id, amount });
  }
  environment.games.set("player", { agents: [target], receiveDamage });
  environment.creatureSystem = { agents: [source], receiveDamage };
  const combat = createCombat(environment);
  function tick(time) {
    environment.simSeconds = time;
    combat.update(source, time);
    combat.update(target, time);
  }
  return { source, target, environment, combat, tick, hits, events };
}

function until(f, predicate) {
  const at = f.environment.simSeconds;
  for (let step = 0; step <= 400 && !predicate(); step++) f.tick(at + step / 20);
  assert.ok(predicate(), "combat event within 20 seconds");
}
function roleFields(species) {
  const { role, melee, ranged, position } = creatureAttackRole(species);
  assert.ok(["front", "middle", "back"].includes(position));
  return { role, melee, ranged };
}
function expectedDamage(species) {
  const stats = NEUTRAL_UNIT_STATS[species];
  return stats.power * 100 / (100 + Math.max(0, 16 - stats.penetration));
}

function sourceEvents(context, kind) {
  return context.events.filter(event => event.sourceId === context.source.id && event.kind === kind);
}

function noDna(agent) {
  assert.equal(Object.hasOwn(agent, "dna"), false);
  assert.equal(Object.hasOwn(agent.stats, "dna"), false);
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}

test("중립 registry 19종을 빠짐없이 5겸용·2원딜·12근딜로 배정한다", () => {
  const registry = [...ENCOUNTER_TYPES.map(type => type.key), "spiny-back-beetle"].sort();
  assert.equal(registry.length, 19);
  assert.equal(new Set(registry).size, 19);
  assert.deepEqual(Object.keys(CREATURE_ATTACK_ROLES).sort(), registry);
  assert.deepEqual(approved.map(entry => entry[0]).sort(), registry);
  assert.deepEqual(["hybrid", "ranged", "melee"].map(role =>
    Object.values(CREATURE_ATTACK_ROLES).filter(entry => entry.role === role).length), [5, 2, 12]);
  for (const [species, role, melee, ranged] of approved)
    assert.deepEqual(roleFields(species), { role, melee, ranged }, species);
  assert.deepEqual(roleFields("flower-tail-bird"), { role: "ranged", melee: true, ranged: true });
  assert.deepEqual(roleFields("lantern-keeper"), { role: "ranged", melee: false, ranged: true });
});

test("공격 역할과 모드는 강약·이속·성향과 독립이며 기존 종별 전투력을 유지한다", () => {
  for (const [species, role, melee, ranged, strength, disposition] of approved) {
    const source = creature(species, species, undefined), before = structuredClone(source);
    assert.equal(source.stats.combatStrength, strength, species);
    assert.equal(combatDisposition(source), disposition, species);
    assert.deepEqual(roleFields(species), { role, melee, ranged });
    assert.equal(creatureAttackMode(source, 2), ranged ? "ranged" : null);
    assert.deepEqual(source, before);
    for (const power of [1, 1000]) {
      source.stats.combatStrength = power;
      source.stats.attackPower = power;
      source.stats.speed = power;
      source.combatDisposition = power === 1 ? "peaceful" : "aggressive";
      assert.equal(creatureAttackMode(source, 0), melee ? "melee" : "ranged", species);
      assert.equal(creatureAttackMode(source, 2), ranged ? "ranged" : null, species);
    }
  }
});

test("모든 중립의 거리 0·1·1초과·3·3초과 경계를 기존 사거리로 판정한다", () => {
  assert.equal(DNA_ACTION_RULES.meleeRange, 1);
  assert.equal(DNA_ACTION_RULES.rangedRange, 3);
  assert.equal(DNA_ACTION_RULES.projectileSpeed, 6);
  for (const [species, , melee, ranged] of approved) {
    const source = creature(species, species, "aggressive");
    for (const separation of [0, 1]) assert.equal(creatureAttackMode(source, separation), melee ? "melee" : "ranged", species);
    for (const separation of [1 + epsilon, 3]) assert.equal(creatureAttackMode(source, separation), ranged ? "ranged" : null, species);
    assert.equal(creatureAttackMode(source, 3 + epsilon), null, species);
  }
  assert.equal(creatureAttackRole("unknown-creature"), null);
  assert.equal(creatureAttackMode({ species: "unknown-creature" }, 0), null);
  for (const separation of [-1, NaN, Infinity, -Infinity, undefined, null, "2"])
    assert.equal(creatureAttackMode({ species: "bubble-toad" }, separation), null);
});

for (const species of rangedSpecies) {
  test(`${species}: 거리 2의 실제 투사체는 발사 뒤 비행하고 도착 때 기존 피해를 한 번 준다`, () => {
    const f = fixture(species, 2, "aggressive"), before = structuredClone(f.source.stats);
    const damage = expectedDamage(species);
    near(combatDamage(f.source, f.target, .5), damage);
    f.tick(0);
    const attack = f.source.attack;
    assert.equal(attack?.attackMode, "ranged");
    assert.equal(attack.targetId, f.target.id);
    assert.ok(!f.source.combat && !f.target.combat);
    near(attack.launchedAt, f.source.stats.combat.focus);
    near(attack.hitAt, attack.launchedAt + 2 / 6);
    near(f.source.attackReady - attack.endsAt, 1 / f.source.stats.combat.rangedSpeed);
    f.tick(attack.launchedAt - epsilon);
    assert.equal(sourceEvents(f, "shoot").length, 0);
    assert.equal(f.target.health, 100);
    f.tick(attack.launchedAt);
    assert.equal(sourceEvents(f, "shoot").length, 1);
    assert.equal(f.target.health, 100);
    f.tick(attack.hitAt - epsilon);
    assert.equal(f.target.health, 100);
    f.tick(attack.hitAt);
    f.tick(attack.hitAt);
    near(f.target.health, 100 - damage);
    assert.equal(f.hits.length, 1); assert.equal(f.hits[0].id, f.target.id); near(f.hits[0].amount, damage);
    const shot = sourceEvents(f, "shoot")[0], hit = sourceEvents(f, "hit")[0];
    assert.equal(sourceEvents(f, "hit").length, 1);
    assert.equal(hit.mode, "ranged");
    assert.equal(hit.at, attack.hitAt);
    near(hit.amount, damage);
    assert.equal(hit.projectileId, shot.projectileId);
    assert.equal(hit.causeId, shot.causeId);
    near(shot.arrivesAt - shot.at, 2 / 6);
    assert.deepEqual(f.source.dnaProjectiles, []);
    assert.deepEqual(f.source.stats, before);
    noDna(f.source);
    noDna(f.target);
  });

  test(`${species}: 실제 원거리 사거리 3은 포함하고 3초과는 제외한다`, () => {
    for (const separation of [3, 3 + epsilon]) {
      const f = fixture(species, separation, "aggressive");
      f.tick(0);
      if (separation === 3) {
        assert.equal(f.source.attack?.attackMode, "ranged");
        const attack = f.source.attack;
        near(attack.hitAt - attack.launchedAt, .5);
        f.tick(attack.hitAt - epsilon);
        assert.equal(f.target.health, 100);
        f.tick(attack.hitAt);
        assert.ok(f.target.health < 100);
      } else {
        f.tick(1);
        assert.ok(!f.source.attack && !f.source.combat);
        assert.equal(sourceEvents(f, "shoot").length, 0);
        assert.equal(f.target.health, 100);
      }
    }
  });

  test(`${species}: 발사 전 취소는 피해를 없애고 발사 후 공격 종료는 비행탄을 유지한다`, () => {
    const cancelled = fixture(species, 2, "aggressive");
    cancelled.tick(0);
    const cancelledAttack = cancelled.source.attack, ready = cancelled.source.attackReady;
    cancelled.source.attack = null;
    cancelled.tick(cancelledAttack.hitAt);
    assert.equal(cancelled.target.health, 100);
    assert.equal(sourceEvents(cancelled, "shoot").length, 0);
    assert.equal(sourceEvents(cancelled, "projectile-cancel").length, 1);
    assert.deepEqual(cancelled.source.dnaProjectiles, []);
    assert.equal(cancelled.source.attackReady, ready);
    const launched = fixture(species, 2, "aggressive");
    launched.tick(0);
    const attack = launched.source.attack;
    launched.tick(attack.launchedAt);
    launched.source.attack = null;
    launched.tick(attack.hitAt);
    assert.ok(launched.target.health < 100);
    assert.equal(sourceEvents(launched, "shoot").length, 1);
    assert.equal(sourceEvents(launched, "hit").length, 1);
    assert.equal(sourceEvents(launched, "projectile-cancel").length, 0);
  });

  test(`${species}: 발사 후 사망·숨김은 취소하고 후퇴해도 이미 발사된 투사체는 도달한다`, () => {
    for (const participant of ["source", "target"]) for (const field of ["health", "hidden", "retreat"]) {
      const f = fixture(species, 2, "aggressive");
      f.tick(0);
      const attack = f.source.attack;
      f.tick(attack.launchedAt);
      f[participant][field] = field === "health" ? 0 : true;
      const health = f.target.health;
      f.tick(attack.hitAt);
      if (field === "retreat") {
        assert.ok(f.target.health < health, participant);
        assert.equal(sourceEvents(f, "hit").length, 1);
        assert.equal(sourceEvents(f, "projectile-cancel").length, 0);
      } else {
        assert.equal(f.target.health, health, participant + ":" + field);
        assert.equal(sourceEvents(f, "hit").length, 0);
        assert.equal(sourceEvents(f, "projectile-cancel").length, 1);
      }
      assert.deepEqual(f.source.dnaProjectiles, []);
    }
  });

  test(`${species}: 같은 종과 다른 중립 종은 같은 셀과 원거리 모두 공격하지 않는다`, () => {
    for (const targetSpecies of [species, "dew-rabbit"])
      for (const separation of [0, 2]) {
        const f = fixture(species, separation, "aggressive");
        const other = creature(targetSpecies, "other", "aggressive");
        other.x += separation;
        other.renderFromX = other.x;
        f.environment.games.clear();
        f.environment.creatureSystem.agents.push(other);
        assert.equal(canPursueCombat(f.source, other, 0), false);
        f.combat.update(f.source, 0);
        f.combat.update(other, 0);
        f.environment.simSeconds = 1;
        f.combat.update(f.source, 1);
        f.combat.update(other, 1);
        assert.ok(!f.source.attack && !f.source.combat && !other.attack && !other.combat);
        assert.equal(other.health, unitCombatStats(targetSpecies).health);
        assert.equal(f.events.length, 0);
      }
  });
}

for (const [species, , melee, ranged] of approved) {
  test(`${species}: 같은 셀 접근 후 고유 공격 시각과 단일 피해를 처리한다`, () => {
    const f = fixture(species, melee ? 1 : 0, "aggressive"), before = structuredClone(f.source.stats);
    if (melee) {
      f.tick(0);
      assert.ok(!f.source.attack && !f.source.combat && !f.target.combat);
      assert.equal(sourceEvents(f, "shoot").length, 0);
      f.target.x = f.target.renderFromX = f.source.x;
    }
    until(f, () => f.source.attack);
    const attack = f.source.attack;
    assert.ok(attack.attackMode === "melee" ? melee : ranged);
    assert.equal(f.source.combat.id, f.target.combat.id);
    near(attack.hitAt - attack.startedAt, f.source.stats.combat.focus);
    near(f.source.combat.nextAttackAt - attack.endsAt, 1 / f.source.stats.attackSpeed);
    f.tick(attack.hitAt - epsilon); assert.equal(f.target.health, 100);
    f.tick(attack.hitAt);
    if (attack.attackMode === "ranged") {
      assert.equal(f.target.health, 100);
      const projectile = f.source.dnaProjectiles.find(entry => entry.launchedAt === attack.hitAt);
      f.tick(projectile.hitAt - epsilon); assert.equal(f.target.health, 100);
      f.tick(projectile.hitAt);
    }
    f.tick(f.environment.simSeconds);
    near(f.target.health, 100 - expectedDamage(species));
    const hit = sourceEvents(f, "hit")[0];
    assert.equal(sourceEvents(f, "hit").length, 1);
    assert.equal(hit.mode, attack.attackMode); near(hit.amount, expectedDamage(species));
    const shots = sourceEvents(f, "shoot");
    assert.equal(shots.length, attack.attackMode === "melee" ? 0 : 1);
    if (shots.length) { assert.ok(shots[0].at < hit.at); assert.equal(shots[0].projectileId, hit.projectileId); }
    assert.deepEqual(f.source.stats, before); noDna(f.source);
  });
}

test("나머지 근딜 12종은 거리 2에서 원거리 공격을 만들지 않는다", () => {
  for (const [species, role] of approved.filter(entry => entry[1] === "melee")) {
    const f = fixture(species, 2, "aggressive");
    assert.equal(role, "melee");
    f.tick(0);
    f.tick(1);
    assert.ok(!f.source.attack && !f.source.combat);
    assert.equal(f.target.health, 100);
    assert.equal(f.events.length, 0);
  }
});

test("역할 추가는 기존 19종의 선공·비선공·평화 성향과 선공 금지를 바꾸지 않는다", () => {
  for (const [species, , , ranged, , disposition] of approved) {
    const f = fixture(species, 2, undefined);
    assert.equal(combatDisposition(f.source), disposition, species);
    f.tick(0);
    assert.equal(!!f.source.attack, disposition === "aggressive" && ranged, species);
    if (disposition !== "aggressive") {
      f.tick(1);
      assert.equal(f.target.health, 100);
      assert.equal(f.events.length, 0);
      const contact = fixture(species, 0, undefined);
      contact.tick(0);
      assert.ok(!contact.source.combat && !contact.target.combat, species);
      assert.equal(contact.events.length, 0);
    }
  }
});

for (const species of contactSpecies) {
  test(`${species}: 원거리에서 같은 셀로 바뀌어도 이미 소비한 공속 대기 후 전투 공격한다`, () => {
    const f = fixture(species, 2, "aggressive");
    f.tick(0);
    const attack = f.source.attack, ready = f.source.attackReady;
    f.tick(attack.hitAt);
    f.target.x = f.target.renderFromX = f.source.x;
    f.tick(attack.hitAt + .01);
    assert.ok(f.source.combat);
    near(f.source.combat.nextAttackAt, ready);
    assert.ok(!f.source.attack);
    f.tick(ready - epsilon);
    assert.ok(!f.source.attack);
    f.tick(ready);
    until(f, () => f.source.attack);
    assert.ok(["melee", "ranged"].includes(f.source.attack.attackMode));
    assert.ok(f.source.attack.startedAt >= ready);
    near(f.source.combat.nextAttackAt - f.source.attack.endsAt, combatProfile(f.source).attackInterval);
    noDna(f.source);
  });
}

test("중립 원거리도 기존 공격속도와 이동속도의 독립성·피해 난수 공식을 유지한다", () => {
  for (const species of rangedSpecies) for (const speed of [.5, 2]) {
    const f = fixture(species, 2, "aggressive");
    f.source.stats.attackSpeed = speed; f.source.stats.combat.rangedSpeed = speed;
    f.source.stats.speed = speed === .5 ? 8 : .1;
    const profile = combatProfile(f.source), damage = combatDamage(f.source, f.target, .5);
    let rolls = 0;
    f.environment.damageRandom = () => { rolls++; return .5; };
    f.tick(0);
    const attack = f.source.attack;
    const ready = f.source.attackReady; near(ready - attack.endsAt, 1 / speed);
    near(attack.launchedAt, f.source.stats.combat.focus);
    near(profile.attackInterval, 1 / speed);
    assert.equal(rolls, 0);
    f.tick(attack.launchedAt);
    assert.equal(rolls, 0);
    f.tick(attack.hitAt);
    f.tick(attack.hitAt);
    assert.equal(rolls, 1);
    near(f.target.health, 100 - damage);
    f.tick(ready - epsilon);
    assert.equal(sourceEvents(f, "attack").length, 1);
    f.tick(ready);
    assert.equal(sourceEvents(f, "attack").length, 2);
    near(f.source.attackReady - f.source.attack.endsAt, 1 / speed);
    noDna(f.source);
  }
});

for (const species of ["flower-tail-bird", "soil-mole"]) {
  test(`${species}: 미공격 평화형은 자신을 겨냥하지 않은 공격에도 선공하지 않는다`, () => {
    for (const targetId of [null, "unrelated-unit"]) {
      const f = fixture(species, 2, undefined), before = structuredClone(f.source.stats);
      if (targetId) f.target.attack = { targetId };
      f.tick(0);
      f.tick(1);
      assert.equal(combatDisposition(f.source), "peaceful");
      assert.ok(!f.source.attack && !f.source.combat);
      assert.equal(sourceEvents(f, "attack").length, 0);
      assert.equal(sourceEvents(f, "shoot").length, 0);
      assert.equal(f.target.health, 100);
      assert.equal(Object.hasOwn(f.source, "combatDisposition"), false);
      assert.deepEqual(f.source.stats, before);
      noDna(f.source);
    }
  });

  test(`${species}: 자신을 겨냥한 원거리 공격에만 기존 평화 성향 그대로 방어 사격한다`, () => {
    const f = fixture(species, 2, undefined), before = structuredClone(f.source.stats);
    const role = structuredClone(creatureAttackRole(species));
    const damage = expectedDamage(species);
    f.target.attack = { targetId: f.source.id };
    assert.equal(combatDisposition(f.source), "peaceful");
    f.tick(0);
    const attack = f.source.attack, ready = f.source.attackReady;
    assert.equal(attack?.attackMode, "ranged");
    assert.equal(attack.targetId, f.target.id);
    assert.equal(combatDisposition(f.source), "peaceful");
    near(attack.launchedAt, f.source.stats.combat.focus);
    near(attack.hitAt, attack.launchedAt + 2 / 6);
    near(ready - attack.endsAt, 1 / f.source.stats.combat.rangedSpeed);
    f.tick(attack.launchedAt);
    assert.equal(sourceEvents(f, "shoot").length, 1);
    assert.equal(f.target.health, 100);
    f.tick(attack.hitAt - epsilon);
    assert.equal(f.target.health, 100);
    f.tick(attack.hitAt);
    f.tick(attack.hitAt);
    near(f.target.health, 100 - damage);
    assert.equal(sourceEvents(f, "hit").length, 1);
    assert.equal(sourceEvents(f, "hit")[0].mode, "ranged");
    near(sourceEvents(f, "hit")[0].amount, damage);
    f.target.attack = null;
    f.tick(ready);
    assert.ok(!f.source.attack);
    assert.equal(sourceEvents(f, "attack").length, 1);
    assert.equal(combatDisposition(f.source), "peaceful");
    assert.equal(Object.hasOwn(f.source, "combatDisposition"), false);
    assert.deepEqual(f.source.stats, before);
    assert.deepEqual(creatureAttackRole(species), role);
    noDna(f.source);
  });

  test(`${species}: 방어 중에도 거리 1의 근접 전환과 거리 3초과 사격 금지를 지킨다`, () => {
    for (const separation of [1, 3 + epsilon]) {
      const f = fixture(species, separation, undefined);
      f.target.attack = { targetId: f.source.id };
      f.tick(0);
      f.tick(1);
      assert.ok(!f.source.attack && !f.source.combat);
      assert.equal(sourceEvents(f, "shoot").length, 0);
      assert.equal(f.target.health, 100);
      assert.equal(combatDisposition(f.source), "peaceful");
      assert.equal(Object.hasOwn(f.source, "combatDisposition"), false);
      noDna(f.source);
    }
  });
}

test("등불지기 같은 셀에서 발사된 투사체는 시전자·목표의 후퇴 뒤에도 도달한다", () => {
  for (const participant of ["source", "target"]) {
    const f = fixture("lantern-keeper", 0, "aggressive");
    until(f, () => f.source.attack);
    const attack = f.source.attack; assert.equal(attack.attackMode, "ranged");
    f.tick(attack.hitAt);
    const projectile = f.source.dnaProjectiles.find(entry => entry.launchedAt === attack.hitAt);
    f[participant].retreat = { startedAt: attack.hitAt, attempts: 0, safeSince: null, recoverHealth: 70 };
    assert.doesNotThrow(() => f.tick(projectile.hitAt));
    near(f.target.health, 100 - expectedDamage("lantern-keeper"));
    assert.equal(sourceEvents(f, "hit").length, 1); noDna(f.source);
  }
});

test("soil-boar: 수동 DNA 원거리 기관은 자연중립 근딜 역할보다 우선한다", () => {
  const f = fixture("soil-boar", 2, "aggressive");
  const gene = ATTRIBUTE_DNA.lookup.get("secretion");
  const dna = ATTRIBUTE_DNA.stats([{ gene: gene.id, grade: gene.grade, q: 0, r: 0, rotation: 0 }]);
  assert.equal(creatureAttackRole(f.source.species).role, "melee");
  assert.equal(creatureAttackMode(f.source, 2), null);
  near(combatProfile(f.source).attackInterval, 1 / NEUTRAL_UNIT_STATS["soil-boar"].speed);
  assert.equal(dna.ranged, true);
  assert.equal(dna.melee, false);
  near(dna.rangedPower, 1.4);
  near(dna.rangedSpeed, .5);
  f.source.stats.dna = dna;
  f.source.animationStartedAt = -6;
  f.source.attackStartedAt = -5;
  const before = structuredClone(f.source.stats), damage = 1.4 * 100 / 116;
  f.tick(0);
  const attack = f.source.attack;
  assert.equal(attack?.attackMode, "ranged");
  assert.equal(attack.targetId, f.target.id);
  assert.ok(!f.source.combat && !f.target.combat);
  near(attack.launchedAt, .3);
  near(attack.hitAt, .3 + 2 / 6);
  const ready = f.source.attackReady; near(ready - attack.endsAt, 2);
  f.tick(attack.launchedAt - epsilon);
  assert.equal(sourceEvents(f, "shoot").length, 0);
  f.tick(attack.launchedAt);
  assert.equal(sourceEvents(f, "shoot").length, 1);
  assert.equal(f.target.health, 100);
  f.tick(attack.hitAt - epsilon);
  assert.equal(f.target.health, 100);
  f.tick(attack.hitAt);
  f.tick(attack.hitAt);
  near(f.target.health, 100 - damage);
  assert.equal(sourceEvents(f, "hit").length, 1);
  const hit = sourceEvents(f, "hit")[0], shot = sourceEvents(f, "shoot")[0];
  assert.equal(hit.mode, "ranged");
  assert.equal(hit.projectileId, shot.projectileId);
  near(hit.amount, damage);
  near(hit.at - shot.at, 2 / 6);
  f.tick(ready - epsilon);
  assert.equal(sourceEvents(f, "attack").length, 1);
  f.tick(ready);
  assert.equal(sourceEvents(f, "attack").length, 2);
  near(f.source.attack.startedAt, ready);
  near(f.source.attackReady - f.source.attack.endsAt, 2);
  assert.equal(f.source.animationStartedAt, -6);
  assert.equal(f.source.attackStartedAt, -5);
  assert.deepEqual(f.source.stats, before);
});
