import test from "node:test";
import assert from "node:assert/strict";
import { applyRaidCombatScale } from "./raid-combat-scale.mjs";
import { NEUTRAL_UNIT_STATS } from "./neutral-unit-stats.mjs";
import { createCreatures } from "./creatures.mjs";
import { createUnitIndex } from "./unit-index.mjs";

function fixture(phase, health, indexed) {
  const game = { agents: [], buildings: [], nest: null, isVisible: () => false,
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } };
  const room = { seed: 7, simSeconds: 720, damageRandom: () => .5, games: new Map([["owner", game]]),
    colonies: [], food: new Map(), world: { size: 32, seed: 7, sites: [],
      terrain: new Uint8Array(32 * 32).fill(4), hazards: new Uint8Array(32 * 32), encounters: [],
      burrows: [{ id: "home", type: "small", x: 25, y: 11, width: 1, height: 1, entrance: { x: 25, y: 12 } }] } };
  room.creatureSystem = createCreatures(room, null);
  const agent = room.creatureSystem.agents[0];
  Object.assign(agent, { x: 10, y: 12, renderFromX: 10, renderFromY: 12, homeX: 25, homeY: 12,
    moveStartedAt: 720, moveDuration: 0, mode: "idle", nextActionAt: 738,
    raid: { colonyId: 1, phase, departedAt: 700, activeUntil: phase === "active" ? 750 : null } });
  applyRaidCombatScale(agent, agent.raid.departedAt);
  room.creatureSystem.receiveDamage(agent, agent.stats.health * (1 - health / 100));
  agent.stats.vision = 8; agent.stats.combat = { ...agent.stats.combat, ranged: false };
  const target = { id: "unit", ownerId: "owner", x: 6, y: 12, renderFromX: 6, renderFromY: 12,
    health: 100, attributes: {}, combatDisposition: "peaceful", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, combatStrength: 20, speed: 1, vision: 4, attack: 1 } };
  game.agents.push(target);
  room.colonies.push({ id: 1, ownerId: "owner", x: 10, y: 10, occupiedCells: new Set() });
  function tick(time) {
    room.simSeconds = time;
    room.unitIndex = indexed ? createUnitIndex(room) : null;
    room.creatureSystem.tick();
    room.unitIndex = null;
  }
  if (phase === "returning") {
    room.creatureSystem = createCreatures(room, JSON.parse(JSON.stringify(room.creatureSystem.save())));
    Object.assign(room.creatureSystem.agents.find(candidate => candidate.id === agent.id).stats, { vision: 8, combat: { ...agent.stats.combat, ranged: false } });
  }
  return { room, game, agent: room.creatureSystem.agents.find(candidate => candidate.id === agent.id), target, tick };
}

test("생존 습격벌레는 체력과 이전 귀환 저장 여부에 관계없이 주변 유닛을 즉시 추격한다", () => {
  for (const phase of ["active", "returning"]) for (const health of [100, 40]) for (const indexed of [false, true]) {
    const f = fixture(phase, health, indexed);
    f.tick(720);
    assert.equal(f.agent.pursuitTargetId, f.target.id, phase + ":" + health + ":" + indexed);
    assert.equal(f.agent.mode, "walk");
    assert.deepEqual([f.agent.x, f.agent.y], [9, 12]);
    assert.equal(f.agent.moveDuration, 1 / NEUTRAL_UNIT_STATS["spiny-back-beetle"].movement);
    f.tick(720 + f.agent.moveDuration);
    assert.deepEqual([f.agent.x, f.agent.y], [8, 12]);
  }
});

test("이전 습격 귀환 저장은 활동 상태로 바뀌고 재저장에도 시한을 남기지 않는다", () => {
  for (const indexed of [false, true]) {
    const f = fixture("returning", 40, indexed);
    const saved = JSON.parse(JSON.stringify(f.room.creatureSystem.save()));
    f.room.creatureSystem = createCreatures(f.room, saved);
    const agent = f.room.creatureSystem.agents.find(agent => agent.id === f.agent.id);
    agent.stats.vision = 8; agent.stats.combat = { ...agent.stats.combat, ranged: false };
    f.tick(720);
    assert.equal(agent.pursuitTargetId, f.target.id);
    assert.deepEqual([agent.x, agent.y], [9, 12]);
    assert.ok(Math.abs(agent.health - agent.stats.health * .4) < 1e-8);
    assert.equal(agent.raid.phase, "active");
    assert.equal(Object.hasOwn(agent.raid, "activeUntil"), false);
  }
});

test("습격벌레는 적을 놓치거나 옛 활동 시한이 지나도 출발 굴로 돌아가지 않는다", () => {
  const f = fixture("active", 40, true);
  f.tick(720);
  f.game.agents = [];
  f.tick(f.agent.moveStartedAt + f.agent.moveDuration);
  Object.assign(f.agent, { x: 15, y: 12, renderFromX: 15, renderFromY: 12, moveDuration: 0, nextActionAt: 1000 });
  const position = [f.agent.x, f.agent.y];
  f.tick(900);
  assert.deepEqual([f.agent.x, f.agent.y], position);
  assert.equal(f.agent.raid.phase, "active");
  assert.ok(!f.agent.returningHome);
});


test("습격벌레는 무효하거나 다른 진영인 목표를 추격하지 않는다", () => {
  for (const invalid of ["dead", "hidden", "birth", "escape", "distant", "other"]) {
    const f = fixture("returning", 40, true);
    f.agent.nextActionAt = 720;
    if (invalid === "dead") f.target.health = 0;
    if (invalid === "hidden") f.target.hidden = true;
    if (invalid === "birth") f.target.birth = { readyAt: 730 };
    if (invalid === "escape") f.target.escapeUntil = 730;
    if (invalid === "distant") f.target.x = 0;
    if (invalid === "other") {
      f.game.agents = [];
      f.room.games.set("other", { ...f.game, agents: [f.target] });
    }
    f.tick(720);
    assert.equal(f.agent.pursuitTargetId, null, invalid);
    assert.equal(f.agent.raid.phase, "active", invalid);
    assert.ok(!f.agent.combat, invalid);
  }
});

test("출정·귀환 중에도 같은 칸에 접촉한 적과 전투를 시작하고 유지한다", () => {
  for (const phase of ["outbound", "returning"]) for (const indexed of [false, true]) {
    const f = fixture(phase, 40, indexed);
    f.target.x = f.target.renderFromX = f.agent.x;
    f.tick(720);
    assert.ok(f.agent.combat, phase);
    assert.equal(f.agent.combat.id, f.target.combat.id);
    assert.deepEqual([f.agent.x, f.agent.y], [10, 12]);
    f.tick(720.1);
    assert.ok(f.agent.combat);
    assert.equal(f.agent.raid.phase, phase === "returning" ? "active" : phase);
  }
});

test("추격을 마친 딱정벌레는 남은 휴지를 버리고 원래 중심까지 연속 귀환한다", () => {
  for (const indexed of [false, true]) {
    const f = fixture("active", 40, indexed);
    delete f.agent.raid;
    f.game.agents = [];
    Object.assign(f.agent, { x: 16, renderFromX: 16, homeX: 10, homeY: 12, nextActionAt: 738 });
    f.tick(720);
    assert.equal(f.agent.x, 15);
    assert.equal(f.agent.returningHome, true);
    const saved = JSON.parse(JSON.stringify(f.room.creatureSystem.save()));
    saved.agents[0].nextActionAt += 18;
    f.room.creatureSystem = createCreatures(f.room, saved);
    const agent = f.room.creatureSystem.agents.find(agent => agent.id === f.agent.id);
    assert.equal(agent.nextActionAt, agent.moveStartedAt + agent.moveDuration);
    for (let x = 14; x >= 10; x--) {
      f.tick(agent.moveStartedAt + agent.moveDuration);
      assert.equal(agent.x, x);
      assert.equal(agent.nextActionAt, agent.moveStartedAt + agent.moveDuration);
    }
    f.tick(agent.moveStartedAt + agent.moveDuration);
    assert.equal(agent.returningHome, false);
    assert.equal(agent.x, 10);
    assert.equal(agent.mode, "idle");
  }
});

test("습격지에서 추격을 마치면 굴이 아닌 습격 중심으로 연속 복귀한다", () => {
  const f = fixture("active", 40, true);
  f.game.agents = [];
  Object.assign(f.agent, { x: 18, renderFromX: 18, nextActionAt: 738 });
  f.tick(720);
  assert.equal(f.agent.x, 17);
  assert.equal(f.agent.returningHome, true);
  for (const x of [16, 15]) {
    f.tick(f.agent.moveStartedAt + f.agent.moveDuration);
    assert.equal(f.agent.x, x);
  }
  f.tick(f.agent.moveStartedAt + f.agent.moveDuration);
  assert.equal(f.agent.returningHome, false);
  assert.equal(f.agent.x, 15);
  assert.equal(f.agent.raid.phase, "active");
});
