import test from "node:test";
import assert from "node:assert/strict";
import { createCreatures } from "./creatures.mjs";
import { createUnitIndex } from "./unit-index.mjs";
import { BEETLE_ANIMATIONS } from "./beetle-animation.mjs";
import { CREATURE_ATTACK_TIMINGS } from "./creature-attack.mjs";
import { DNA_ACTION_RULES } from "./dna-actions.mjs";
import { canPursueCombat } from "./combat.mjs";

const attackers = ["spiny-back-beetle", "soil-boar", "bubble-toad", "vine-turtle", "shadow-weasel",
  "snare-vine", "talon-owl", "white-paw", "spiny-back-leader"];

function fixture(species, indexed) {
  const cells = [];
  for (let y = 85; y <= 115; y++) for (let x = 85; x <= 115; x++) cells.push(y * 320 + x);
  const hits = [], game = { agents: [], nest: null, discoveredKinds: new Set(),
    colonyFood: 0, isVisible: () => false,
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); },
    receiveNestDamage(amount) {
      hits.push({ id: this.nest.id, amount }); this.nest.health = Math.max(0, this.nest.health - amount);
      return this.nest.health;
    } };
  const room = { simSeconds: 720, damageRandom: () => .5, colonies: [], games: new Map([["test", game]]), food: new Map(),
    world: { seed: 7, sites: [], terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320),
      burrows: species === "spiny-back-beetle" ? [
        { id: "home", type: "small", x: 100, y: 95, width: 1, height: 1, entrance: { x: 100, y: 96 } }
      ] : [], encounters: species === "spiny-back-beetle" ? [] : [
        { key: species, x: 100, y: 100, radius: 12, safeRadius: 0, terrains: [4], nearWater: false,
          cells, route: [], spawnPoints: [32100], populationLimit: 1, homeId: null }
      ] } };
  room.creatureSystem = createCreatures(room, null);
  const agent = room.creatureSystem.agents[0];
  assert.ok(agent, species);
  Object.assign(agent, { x: 100, y: 100, homeX: 100, homeY: 100, renderFromX: 100, renderFromY: 100,
    mode: "idle", moveStartedAt: 720, moveDuration: 0, nextActionAt: 720 });
  agent.stats.vision = 8;
  if (indexed) room.unitIndex = createUnitIndex(room);
  return { room, game, agent, hits, indexed };
}

function nest(context, kind, x, y) {
  const target = { id: kind + ":test", kind, x, y, width: 3, height: 3, health: 120 };
  context.game.nest = target;
  return target;
}

function unit(context, x, y) {
  const agent = { id: "unit:test", ownerId: "test", x, y, health: 100, attributes: {},
    stats: { health: 100, combatStrength: 20, speed: 1, vision: 4, attack: 1 }, combatDisposition: "peaceful",
    moveStartedAt: 0, moveDuration: 0, renderFromX: x, renderFromY: y };
  context.game.agents.push(agent);
  context.room.unitIndex?.update(agent, context.game);
  return agent;
}

function tick(context, time) {
  context.room.simSeconds = time;
  context.room.creatureSystem.tick();
}

function beginNestAttack(context) {
  tick(context, 720);
  if (context.agent.species === "soil-boar") tick(context, 721);
  if (context.agent.species === "bubble-toad") tick(context, context.agent.spawn.readyAt);
  assert.equal(context.agent.attack?.targetKind, "nest", context.agent.species);
  return context.agent.attack.startedAt;
}

test("선공 중립 몹 9종은 유닛이 없으면 둥지를 종별 명중 시점에 한 번 타격한다", () => {
  for (const species of attackers) {
    const context = fixture(species, true), target = nest(context, "nest", 101, 100);
    const startedAt = beginNestAttack(context), timing = CREATURE_ATTACK_TIMINGS[species] || BEETLE_ANIMATIONS.attack;
    tick(context, startedAt + timing.hitTimeMs / 1000 - .001);
    assert.equal(target.health, 120, species);
    tick(context, startedAt + timing.hitTimeMs / 1000);
    tick(context, startedAt + timing.hitTimeMs / 1000);
    assert.equal(context.hits.length, 1, species);
    assert.ok(target.health < 120, species);
  }
});

test("더 가까운 둥지보다 공격 가능한 유닛을 우선 추적한다", () => {
  for (const species of ["spiny-back-beetle", "vine-turtle"]) for (const indexed of [false, true]) {
    const context = fixture(species, indexed);
    nest(context, "nest", 101, 100);
    const target = unit(context, 100, 100 + DNA_ACTION_RULES.rangedRange + (species === "spiny-back-beetle" ? 1 : 0));
    tick(context, 720);
    if (species === "spiny-back-beetle") {
      assert.equal(context.agent.mode, "walk", species);
      assert.equal(context.agent.y, 101, species);
      assert.equal(context.agent.attackTargetId ?? null, null, species);
    } else {
      assert.equal(context.agent.attack?.attackMode, "ranged", species);
      assert.equal(context.agent.attack.targetId, target.id, species);
      assert.equal(context.agent.y, 100, species);
    }
    assert.equal(context.hits.length, 0, species);
  }
});

test("둥지 타격 직전 유닛이 접근하면 타격을 취소하고 유닛을 추적한다", () => {
  for (const species of ["spiny-back-beetle", "vine-turtle"]) {
    const context = fixture(species, true), target = nest(context, "nest", 101, 100);
    const startedAt = beginNestAttack(context);
    unit(context, 100, 102);
    tick(context, startedAt + .5);
    assert.equal(target.health, 120, species);
    assert.equal(context.agent.attack, null, species);
    assert.equal(context.agent.mode, "walk", species);
    assert.equal(context.agent.y, 101, species);
  }
});

test("죽거나 숨거나 등장·탄생·도주 중이거나 도달 불가능한 유닛은 둥지 공격을 막지 않는다", () => {
  for (const species of ["spiny-back-beetle", "vine-turtle"]) for (const indexed of [false, true]) for (const condition of ["dead", "hidden", "spawn", "birth", "escape", "blocked"]) {
    const context = fixture(species, indexed);
    nest(context, "nest", 101, 100);
    const target = unit(context, 100, 100 + DNA_ACTION_RULES.rangedRange + (condition === "blocked" ? 1 : 0));
    if (condition === "dead") target.health = 0;
    if (condition === "hidden") target.hidden = true;
    if (condition === "spawn") target.spawn = { startedAt: 720, readyAt: 730 };
    if (condition === "birth") target.birth = { readyAt: 730 };
    if (condition === "escape") target.escapeUntil = 730;
    if (condition === "blocked") for (const [x, y] of [[target.x - 1, target.y], [target.x + 1, target.y], [target.x, target.y - 1], [target.x, target.y + 1]])
      context.room.world.terrain[y * 320 + x] = 0;
    beginNestAttack(context);
  }
});

test("타격 전후 저장·복원해도 둥지 피해가 중복되지 않고 파괴된 목표를 버린다", () => {
  for (const species of ["spiny-back-beetle", "vine-turtle"]) {
    const context = fixture(species, false), target = nest(context, "nest", 101, 100);
    const startedAt = beginNestAttack(context), timing = CREATURE_ATTACK_TIMINGS[species] || BEETLE_ANIMATIONS.attack;
    context.room.creatureSystem = createCreatures(context.room, structuredClone(context.room.creatureSystem.save()));
    tick(context, startedAt + timing.hitTimeMs / 1000);
    assert.equal(context.hits.length, 1, species);
    context.room.creatureSystem = createCreatures(context.room, structuredClone(context.room.creatureSystem.save()));
    tick(context, startedAt + timing.hitTimeMs / 1000 + .1);
    assert.equal(context.hits.length, 1, species);
    target.health = 0;
    tick(context, startedAt + timing.hitTimeMs / 1000 + .2);
    assert.equal(context.room.creatureSystem.agents[0].attack, null, species);
  }
});

test("평화형·비선공 중립 몹은 인접 둥지를 선공하지 않는다", () => {
  for (const species of ["dew-rabbit", "spring-keeper"]) {
    const context = fixture(species, false), target = nest(context, "nest", 101, 100);
    tick(context, 720);
    assert.equal(context.agent.attack, undefined, species);
    assert.equal(target.health, 120, species);
  }
});

test("둥지 접근·둥지 공격은 점유 셀을 침범하지 않고 활동 반경을 지킨다", () => {
  for (const species of ["spiny-back-beetle", "vine-turtle"]) {
    const context = fixture(species, true), target = nest(context, "nest", 102, 100);
    context.room.colonies.push({ id: 1, ownerId: "test", x: 102, y: 100,
      occupiedCells: new Set(Array.from({ length: 9 }, (_, index) => index % 3 + "," + Math.floor(index / 3))) });
    tick(context, 720);
    assert.equal(context.agent.x, 101, species);
    tick(context, context.agent.moveStartedAt + context.agent.moveDuration);
    assert.equal(context.agent.attack?.targetKind, "nest", species);
    tick(context, context.agent.attack.hitAt);
    assert.ok(target.health < 120, species);
  }
  const context = fixture("vine-turtle", false);
  Object.assign(context.agent, { x: 104, renderFromX: 104 });
  nest(context, "nest", 107, 100);
  tick(context, 720);
  assert.equal(context.agent.attack, undefined);
  assert.ok(Math.hypot(context.agent.x - 100, context.agent.y - 100) <= 4);
});

test("추적하던 마지막 유닛이 죽으면 이동 완료 뒤 둥지 공격으로 전환한다", () => {
  for (const species of ["spiny-back-beetle", "vine-turtle"]) {
    const context = fixture(species, true);
    nest(context, "nest", 101, 100);
    const target = unit(context, 100, 100 + (species === "spiny-back-beetle" ? DNA_ACTION_RULES.rangedRange + 1 : DNA_ACTION_RULES.meleeRange));
    tick(context, 720);
    assert.equal(context.agent.mode, "walk", species);
    target.health = 0;
    tick(context, context.agent.moveStartedAt + context.agent.moveDuration);
    assert.equal(context.agent.attack?.targetKind, "nest", species);
  }
});

test("둥지 공격 중 같은 셀의 적과 교전하면 근접전을 먼저 처리한다", () => {
  for (const species of ["spiny-back-beetle", "vine-turtle"]) {
    const context = fixture(species, true), target = nest(context, "nest", 101, 100);
    const startedAt = beginNestAttack(context);
    unit(context, 100, 100);
    tick(context, startedAt + .2);
    assert.ok(context.agent.combat, species);
    assert.equal(context.agent.attack.targetKind, "agent", species);
    assert.equal(target.health, 120, species);
  }
});

test("두꺼비는 마지막 둥지가 사라져 다시 숨을 때 준비 중인 타격을 버린다", () => {
  const context = fixture("bubble-toad", false), target = nest(context, "nest", 101, 100);
  const startedAt = beginNestAttack(context);
  target.health = 0;
  tick(context, startedAt + .1);
  assert.equal(context.agent.hidden, true);
  assert.equal(context.agent.attack, null);
  assert.equal(context.hits.length, 0);
});

test("공격 객체가 없는 이전 딱정벌레 저장도 이미 준 둥지 피해를 보존한다", () => {
  for (const hit of [false, true]) {
    const context = fixture("spiny-back-beetle", false);
    nest(context, "nest", 101, 100);
    const startedAt = beginNestAttack(context);
    if (hit) tick(context, startedAt + BEETLE_ANIMATIONS.attack.hitTimeMs / 1000);
    const saved = structuredClone(context.room.creatureSystem.save());
    delete saved.agents[0].attack;
    context.room.creatureSystem = createCreatures(context.room, saved);
    tick(context, startedAt + BEETLE_ANIMATIONS.attack.hitTimeMs / 1000 + .1);
    assert.equal(context.hits.length, 1);
  }
});

test("둥지 주변 배회 제한 안에서도 유닛을 우선 추적하고 둥지가 사라지면 귀환한다", () => {
  const context = fixture("shadow-weasel", true), target = nest(context, "nest", 106, 100);
  context.room.colonies.push({ id: 1, ownerId: "test", x: 106, y: 100,
    occupiedCells: new Set(Array.from({ length: 9 }, (_, index) => index % 3 + "," + Math.floor(index / 3))) });
  Object.assign(context.agent, { x: 105, renderFromX: 105 });
  context.room.unitIndex.update(context.agent);
  const victim = unit(context, 105, 102);
  tick(context, 720);
  assert.equal(context.agent.mode, "walk");
  assert.equal(context.agent.y, 101);
  victim.health = 0;
  tick(context, 722);
  assert.equal(context.agent.attack?.targetKind, "nest");
  target.health = 0;
  tick(context, 723);
  assert.equal(context.agent.attack, null);
  assert.equal(context.agent.returningHome, true);
  assert.equal(context.agent.mode, "walk");
  assert.equal(context.agent.x, 104);
});


test("겸용 중립은 사거리 안에서 둥지보다 유닛을 먼저 사격하고 근접 경로 차단에도 타격한다", () => {
  for (const species of ["spiny-back-beetle", "vine-turtle"]) for (const indexed of [false, true]) for (const blocked of [false, true]) {
    const context = fixture(species, indexed), building = nest(context, "nest", 101, 100);
    const target = unit(context, 100, 100 + DNA_ACTION_RULES.rangedRange);
    if (blocked) for (const [x, y] of [[target.x - 1, target.y], [target.x + 1, target.y], [target.x, target.y - 1], [target.x, target.y + 1]])
      context.room.world.terrain[y * 320 + x] = 0;
    tick(context, 720);
    const attack = context.agent.attack;
    assert.equal(attack?.attackMode, "ranged", species);
    assert.equal(attack.targetKind, "agent", species);
    assert.equal(attack.targetId, target.id, species);
    assert.equal(context.agent.x, 100); assert.equal(context.agent.y, 100);
    assert.equal(target.health, 100); assert.equal(building.health, 120);
    tick(context, attack.launchedAt);
    tick(context, attack.hitAt - .001); assert.equal(target.health, 100);
    tick(context, attack.hitAt); assert.ok(target.health < 100, species);
    const health = target.health; tick(context, attack.hitAt);
    assert.equal(target.health, health); assert.equal(building.health, 120); assert.equal(context.hits.length, 0);
  }
});

test("탄생 준비 중인 개체는 공통 추적·원거리 선정에서 제외하고 완료 시각부터 허용한다", () => {
  for (const species of ["spiny-back-beetle", "vine-turtle"]) for (const participant of ["source", "target"]) {
    const context = fixture(species, true), target = unit(context, 100, 103);
    const source = context.agent, pending = participant === "source" ? source : target;
    source.nextActionAt = 730;
    pending.birth = { readyAt: 730 };
    assert.equal(canPursueCombat(source, target, 730 - .001), false, participant);
    assert.equal(canPursueCombat(source, target, 730), true, participant);
    tick(context, 720); assert.ok(!source.attack, participant);
    tick(context, 730); assert.equal(source.attack?.targetId, target.id, participant);
  }
});
