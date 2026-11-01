import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCombat, combatDisposition, canPursueCombat, peacefulEscapeChance, COMBAT_EXCHANGE_PAUSE } from "./combat.mjs";
import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";
import { AGENT_ATTACK_DURATION, AGENT_ATTACK_HIT_TIME, AGENT_HURT_DURATION } from "./attack.mjs";
import { unitAnimationPose } from "../client/unit-animation.mjs";
import { CREATURE_ATTACK_TIMINGS } from "./creature-attack.mjs";
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

function enclose(fixture, agent) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) fixture.environment.world.terrain[(agent.y + dy) * 320 + agent.x + dx] = 0;
}

function finishExchange(fixture) {
  const agents = [...fixture.environment.games.values()].flatMap(game => game.agents);
  const attack = agents.find(agent => agent.attack)?.attack;
  assert.ok(attack && !attack.counter);
  fixture.tick(attack.hitAt);
  fixture.tick(attack.exchangeEndsAt);
  const counter = agents.find(agent => agent.attack?.counter)?.attack;
  if (counter) {
    fixture.tick(counter.hitAt);
    fixture.tick(counter.exchangeEndsAt);
  } else {
    const pending = agents.find(agent => agent.combat?.pendingCounter)?.combat.pendingCounter;
    if (pending) { fixture.tick(pending.hitAt); fixture.tick(pending.endsAt); }
  }
}

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

test("비선공은 붙잡히면 반격하고 일반 행동·도주는 전투를 해제하지 않는다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive");
  const f = fixture([a, b]);
  f.tick(0); f.tick(.3);
  assert.equal(a.health, 100); assert.equal(b.health, 85);
  const next = a.attack.exchangeEndsAt;
  f.tick(next); f.tick(next + .3);
  assert.equal(a.health, 85); assert.equal(b.health, 85);
  b.mode = "flee"; b.moveBudget = 5;
  f.tick(next + .4);
  assert.equal(b.combat.id, a.combat.id);
  assert.equal(b.moveBudget, 0);
  assert.deepEqual([a.x, a.y, b.x, b.y], [100, 100, 100, 100]);
});

test("아군 증원은 진행 중인 교환을 끊지 않고 자기 차례에 공격한다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive"), ally = unit("ally", "left", "passive");
  a.health = b.health = ally.health = 1000;
  ally.x--;
  const f = fixture([a, b, ally]);
  f.tick(0);
  assert.ok(canPursueCombat(ally, b, .1));
  ally.x++;
  f.tick(.1);
  assert.equal(ally.combat.id, a.combat.id);
  assert.equal(ally.combat.side, a.combat.side);
  f.tick(.22);
  assert.equal(ally.attack, null);
  const starts = [];
  for (let step = 3; step <= 200; step++) {
    f.tick(step / 10);
    const attacking = [a, b, ally].filter(agent => agent.attack);
    assert.equal(attacking.length, 1);
    if (attacking[0].attack.startedAt === step / 10) starts.push(attacking[0].id);
  }
  assert.ok(starts.includes("ally"));
  assert.ok(b.health < 1000);
});

test("평화형은 근접 교전에서 반격하고 교전 사이에 안전한 인접 셀로 이탈한다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", null, "peaceful");
  b.species = "flower-tail-bird"; b.stats.combatStrength = 20;
  const f = fixture([a, b]);
  let rolls = 0;
  f.environment.combatRandom = () => ++rolls === 1 ? .9 : .1;
  f.tick(0); f.tick(.3);
  assert.equal(a.health, 100); assert.equal(b.health, 85);
  assert.equal(rolls, 0);
  const counterAt = a.attack.exchangeEndsAt;
  f.tick(counterAt);
  assert.ok(b.attack.counter);
  f.tick(b.attack.hitAt);
  f.tick(b.attack.exchangeEndsAt);
  assert.equal(rolls, 1); assert.ok(b.combat);
  finishExchange(f);
  assert.equal(rolls, 2);
  assert.ok(!b.combat && !a.combat);
  assert.equal(Math.abs(b.x - 100) + Math.abs(b.y - 100), 1);
  assert.ok(b.escapeUntil > b.moveStartedAt + b.moveDuration);
  a.x = b.x; a.y = b.y;
  f.tick(b.moveStartedAt + .1);
  assert.ok(!a.combat && !b.combat);
});

test("평화형 탈출은 기본 80%이며 사냥 억제 수치로 낮출 수 있다", () => {
  assert.equal(peacefulEscapeChance(0), .8);
  assert.equal(peacefulEscapeChance(.5), .4);
  assert.equal(peacefulEscapeChance(2), 0);
  const a = unit("a", "left", "aggressive"), b = unit("b", null, "peaceful");
  b.species = "flower-tail-bird"; b.stats.combatStrength = 20;
  const f = fixture([a, b]);
  a.stats.escapeSuppression = .5;
  f.environment.combatRandom = () => .6;
  f.tick(0); finishExchange(f);
  assert.ok(b.combat);
  a.stats.escapeSuppression = 0;
  finishExchange(f);
  assert.ok(!b.combat);
});

test("출구가 막혔으면 평화형이 순간이동하지 않고 다음 교전까지 남는다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", null, "peaceful");
  b.species = "flower-tail-bird"; b.stats.combatStrength = 20;
  const f = fixture([a, b]);
  f.environment.combatRandom = () => 0;
  for (const [x, y] of [[99, 100], [101, 100], [100, 99], [100, 101]]) f.environment.world.terrain[y * 320 + x] = 0;
  f.tick(0); finishExchange(f);
  assert.ok(b.combat);
  assert.deepEqual([b.x, b.y], [100, 100]);
  f.environment.world.terrain[100 * 320 + 99] = 4;
  finishExchange(f);
  assert.equal(b.x, 99); assert.ok(!b.combat);
});

test("저장한 공격과 탈출 대기를 복원해도 중복 피해·즉시 재판정을 만들지 않는다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", null, "peaceful");
  b.species = "flower-tail-bird"; b.stats.combatStrength = 20;
  const f = fixture([a, b]);
  f.tick(0);
  const restored = JSON.parse(JSON.stringify([a, b]));
  const next = fixture(restored);
  next.tick(.3); next.tick(.3);
  assert.deepEqual(next.hits, ["b"]);
  const again = fixture(JSON.parse(JSON.stringify(restored)));
  again.tick(.4);
  assert.equal(again.hits.length, 0);
  assert.equal(restored[1].combat.nextEscapeAt, 1.5);
});

test("마지막 적이 죽으면 전투를 해제하며 죽은 생명체의 사망 상태는 보존한다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive");
  const f = fixture([a, b]);
  b.health = 1;
  f.tick(0); b.mode = "death"; f.tick(.3);
  assert.equal(b.health, 0);
  assert.equal(b.mode, "death");
  assert.ok(a.combat);
  f.tick(a.attack.exchangeEndsAt);
  const pending = a.combat.pendingCounter;
  f.tick(pending.hitAt);
  f.tick(pending.endsAt);
  assert.ok(!a.combat);
});

test("유니크는 비선공 또는 선공만 허용하고 일반 평화종과 구분한다", () => {
  for (const type of ENCOUNTER_TYPES.filter(entry => entry.unique)) assert.ok(["passive", "aggressive"].includes(combatDisposition({ species: type.key })));
  assert.equal(combatDisposition({ species: "spring-keeper", combatDisposition: "peaceful" }), "passive");
  assert.equal(combatDisposition({ species: "white-paw" }), "aggressive");
  assert.equal(combatDisposition({ species: "flower-tail-bird" }), "peaceful");
});

test("네 종족 모두 실제 게임에서 성향을 적용하고 전투 상태를 저장·복원한다", () => {
  for (const [tribe, remaining] of [["bean", 85], ["spore", 86], ["pebble", 84], ["spring", 86]]) {
    const colony = { id: 1, ownerId: tribe, tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
    const environment = { simSeconds: 10, damageRandom: () => .5, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
      colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
    const game = createGame(environment, colony);
    environment.games.set(tribe, game);
    game.agents.splice(1);
    const agent = game.agents[0], saved = JSON.parse(game.save());
    saved.state.agents[0].combatDisposition = "aggressive";
    Object.assign(saved.state.agents[0], { x: 100, y: 100, renderFromX: 100, renderFromY: 100 });
    game.restore(JSON.stringify(saved));
    const target = unit("target", "other", "passive");
    environment.games.set("other", { agents: [target], receiveDamage(victim, amount) { victim.health -= amount; } });
    game.prepare(10); game.tick(.1);
    assert.equal(game.snapshot().agents[0].combatDisposition, "aggressive");
    assert.ok(game.agents[0].combat);
    const id = game.agents[0].combat.id;
    game.restore(game.save());
    assert.equal(game.agents[0].combat.id, id);
    game.prepare(10.3); game.tick(.3);
    assert.equal(target.health, remaining);
    game.prepare(10.4); game.tick(.1);
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
  environment.simSeconds = beetle.attack.hitAt;
  environment.creatureSystem.tick();
  assert.equal(target.health, 76);
});

test("중립으로 표시된 비선공 유니크도 실제 전투에 붙잡히면 반격한다", () => {
  const colony = { id: 1, ownerId: "player", tribe: "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 400, damageRandom: () => .5, games: new Map(), colonies: [colony], food: new Map(), foodSpots: new Map(),
    world: { seed: 7, sites: [], terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), burrows: [],
      encounters: [{ key: "old-garden-snail", x: 140, y: 140, radius: 5, safeRadius: 10, terrains: [4],
        cells: [140 * 320 + 140], spawnPoints: [140 * 320 + 140], route: [] }] } };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  const data = JSON.parse(game.save());
  Object.assign(data.state.agents[0], { combatDisposition: "aggressive", x: 140, y: 140, renderFromX: 140, renderFromY: 140 });
  game.restore(JSON.stringify(data));
  game.agents[0].x = 139;
  environment.creatureSystem = createCreatures(environment, null);
  const unique = environment.creatureSystem.agents[0];
  assert.equal(unique.faction, "neutral");
  game.agents[0].x = 140;
  enclose({ environment }, game.agents[0]);
  game.prepare(400); game.tick(.01);
  assert.equal(unique.combat.id, game.agents[0].combat.id);
  for (let exchange = 0; exchange < 3 && !unique.attack; exchange++) {
    const attack = game.agents[0].attack;
    environment.simSeconds = attack.hitAt; game.prepare(environment.simSeconds); environment.creatureSystem.tick();
    environment.simSeconds = attack.exchangeEndsAt; game.prepare(environment.simSeconds); environment.creatureSystem.tick();
  }
  assert.ok(unique.attack);
  environment.simSeconds = unique.attack.hitAt; game.prepare(environment.simSeconds); environment.creatureSystem.tick();
  assert.equal(game.agents[0].health, 64);
  assert.deepEqual([unique.x, unique.y], [140, 140]);
});

for (const speed of [.1, .5, 1, 1.5, 2, 8]) {
  const expected = "ABABAB";
  test("이속 수치 " + speed + "와 무관하게 완전한 공격·피격과 휴식 후 " + expected + " 순서로 진행한다", () => {
    for (const reverse of [false, true]) {
      const a = unit("A", "left", "aggressive"), b = unit("B", "right", "passive");
      a.stats.speed = speed;
      a.health = b.health = 1000;
      a.tribe = b.tribe = "bean";
      const f = fixture(reverse ? [b, a] : [a, b]);
      f.combat.engage(a, b, 0);
      const starts = [], seen = new Set();
      let previousEnd = -Infinity;
      for (let step = 0; step < 1500 && starts.length < expected.length; step++) {
        const time = step * .02;
        f.tick(time);
        const active = [a, b].filter(agent => agent.attack);
        assert.equal(active.length, 1);
        const attacker = active[0], target = attacker === a ? b : a, attack = attacker.attack;
        const key = attacker.id + ":" + attack.startedAt;
        if (!seen.has(key)) {
          assert.ok(time + 1e-8 >= previousEnd);
          assert.equal(attack.speed, 1);
          assert.ok(Math.abs(attack.endsAt - attack.startedAt - AGENT_ATTACK_DURATION) < 1e-8);
          previousEnd = attack.exchangeEndsAt;
          seen.add(key); if (!attack.counter) starts.push(attacker.id);
        }
        if (attack.resolved) {
          assert.ok(Math.abs(target.hurtStartedAt - attack.hitAt) < .021);
          assert.ok(attack.exchangeEndsAt + 1e-8 >= target.hurtStartedAt + AGENT_HURT_DURATION + COMBAT_EXCHANGE_PAUSE);
          if (time < attack.endsAt) assert.equal(unitAnimationPose(attacker, time).action, "attack");
          if (time < target.hurtStartedAt + AGENT_HURT_DURATION - 1e-8) assert.equal(unitAnimationPose(target, time).action, "hurt");
        }
      }
      assert.equal(starts.join(""), expected);
    }
  });
}

test("교환 중 저장·복원해도 차례·남은 휴식·명중 1회를 보존한다", () => {
  const a = unit("A", "left", "aggressive"), b = unit("B", "right", "passive");
  a.stats.speed = 1.5;
  let f = fixture([a, b]);
  f.tick(0); f.tick(AGENT_ATTACK_HIT_TIME);
  const saved = JSON.parse(JSON.stringify([a, b]));
  const [nextA, nextB] = saved;
  f = fixture(saved);
  f.tick(.5);
  assert.deepEqual(f.hits, []);
  assert.equal(nextB.attack, null);
  const next = nextA.attack.exchangeEndsAt;
  f.tick(next - .001); assert.equal(nextB.attack, null);
  f.tick(next); assert.ok(nextB.attack); assert.equal(nextA.attack, null);
});

test("구형 저장에서 겹친 공격은 한 교환으로 정리하고 피해를 중복 적용하지 않는다", () => {
  const a = unit("A", "left", "aggressive"), b = unit("B", "right", "passive"), f = fixture([a, b]);
  f.tick(0);
  b.attack = { ...a.attack, targetId: a.id, startedAt: .15, hitAt: .45, endsAt: 1.15 };
  delete a.attack.exchangeEndsAt;
  delete a.combat.nextAttackTurn; delete b.combat.nextAttackTurn;
  f.tick(.5); f.tick(.5);
  assert.equal(b.attack, null);
  assert.deepEqual(f.hits, ["B"]);
});

for (const [leftCount, rightCount] of [[3, 1], [1, 3], [2, 2]]) {
  test(leftCount + ":" + rightCount + " 근접전은 개체별 차례마다 공격과 반격을 한 번씩 교환한다", () => {
    for (const reverse of [false, true]) {
      const left = Array.from({ length: leftCount }, (_, index) => unit("A" + (index + 1), "left", "aggressive"));
      const right = Array.from({ length: rightCount }, (_, index) => unit("B" + (index + 1), "right", "passive"));
      const agents = [...left, ...right];
      for (const [index, agent] of agents.entries()) { agent.health = 1000; agent.stats.speed = [.1, 8, .5, 2][index]; }
      const f = fixture(reverse ? [...agents].reverse() : agents);
      f.combat.engage(left[0], right[0], 0);
      const cycle = agents.flatMap(agent => [agent.id, agent.combat.side === 0 ? right[0].id : left[0].id]);
      const expected = [...cycle, ...cycle], phases = [], seen = new Set();
      for (let step = 0; step < 3000 && phases.length < expected.length; step++) {
        f.tick(step * .02);
        const active = agents.filter(agent => agent.attack);
        assert.equal(active.length, 1);
        const attack = active[0].attack, key = active[0].id + ":" + attack.startedAt;
        if (!seen.has(key)) { seen.add(key); phases.push(active[0].id); }
      }
      assert.deepEqual(phases, expected);
    }
  });
}

test("양쪽 피해를 교전 시작에 확정하고 공격과 반격의 명중 시점에 따로 차감한다", () => {
  for (const first of ["A", "B"]) {
    const a = unit("A", "left", "aggressive"), b = unit("B", "right", "aggressive"), f = fixture([a, b]);
    f.combat.engage(first === "A" ? a : b, first === "A" ? b : a, 0);
    f.tick(0); f.tick(AGENT_ATTACK_HIT_TIME - .001);
    assert.deepEqual([a.health, b.health], [100, 100]);
    f.tick(AGENT_ATTACK_HIT_TIME);
    assert.deepEqual([a.health, b.health], first === "A" ? [100, 85] : [85, 100]);
    const attacker = first === "A" ? a : b, defender = first === "A" ? b : a;
    f.tick(attacker.attack.exchangeEndsAt);
    const hitAt = defender.attack.hitAt;
    f.tick(hitAt - .001);
    assert.deepEqual([a.health, b.health], first === "A" ? [100, 85] : [85, 100]);
    f.tick(hitAt);
    assert.deepEqual([a.health, b.health], [85, 85]);
    assert.deepEqual([...f.hits].sort(), ["A", "B"]);
  }
});

test("부상은 교전 시작 체력을 기준으로 양쪽 피해에 한 번 반영한다", () => {
  for (const first of ["A", "B"]) {
    const a = unit("A", "left", "aggressive"), b = unit("B", "right", "aggressive");
    a.health = 50;
    const f = fixture([a, b]);
    enclose(f, a);
    f.combat.engage(first === "A" ? a : b, first === "A" ? b : a, 0);
    f.tick(0);
    finishExchange(f);
    assert.deepEqual([a.health, b.health], [32, 88]);
    assert.equal(f.hits.length, 2);
  }
});

test("구형 저장의 미명중 교전은 부상을 반영하되 명중한 교전은 다시 적용하지 않는다", () => {
  const a = unit("A", "left", "aggressive"), b = unit("B", "right", "passive");
  a.health = 50;
  let f = fixture([a, b]);
  enclose(f, a);
  f.tick(0);
  a.attack.exchange = { ...a.attack.exchange, attackDamage: 30, counterDamage: 30 };
  delete a.attack.exchange.damageVersion;
  let saved = JSON.parse(JSON.stringify([a, b]));
  f = fixture(saved);
  f.tick(AGENT_ATTACK_HIT_TIME);
  assert.deepEqual(saved.map(agent => agent.health), [50, 88]);
  delete saved[0].attack.exchange.damageVersion;
  saved = JSON.parse(JSON.stringify(saved));
  f = fixture(saved);
  f.tick(.5);
  assert.deepEqual(saved.map(agent => agent.health), [50, 88]);
  assert.deepEqual(f.hits, []);
  f.tick(saved[0].attack.exchangeEndsAt);
  f.tick(saved[1].attack.hitAt);
  assert.deepEqual(saved.map(agent => agent.health), [32, 88]);
});

test("방어자가 첫 타격에 죽어 제거돼도 확정한 반격은 다음 명중 시점에 한 번 처리한다", () => {
  const a = unit("A", "left", "aggressive"), b = unit("B", "right", "passive"), f = fixture([a, b]);
  a.health = b.health = 1;
  enclose(f, a);
  f.tick(0); f.tick(AGENT_ATTACK_HIT_TIME);
  assert.equal(a.health, 1); assert.equal(b.health, 0);
  assert.deepEqual(f.hits, ["B"]);
  f.environment.games.get("right").agents.length = 0;
  f.tick(a.attack.exchangeEndsAt);
  assert.equal(b.attack, null);
  assert.equal(a.health, 1);
  const pending = a.combat.pendingCounter;
  assert.ok(pending);
  f.tick(pending.hitAt - .001);
  assert.equal(a.health, 1);
  f.tick(pending.hitAt);
  assert.equal(a.health, 0);
  assert.deepEqual(f.hits, ["B", "A"]);
});

test("교전 시작에 양쪽 난수를 한 번씩 뽑고 반격 명중 때 다시 뽑지 않는다", () => {
  const a = unit("A", "left", "aggressive"), b = unit("B", "right", "passive"), f = fixture([a, b]);
  let rolls = 0;
  f.environment.damageRandom = () => { rolls++; return .5; };
  f.tick(0);
  assert.equal(rolls, 2);
  assert.deepEqual([a.attack.exchange.attackerHealth, a.attack.exchange.targetHealth], [100, 100]);
  finishExchange(f);
  assert.deepEqual([a.health, b.health], [85, 85]);
  assert.equal(rolls, 4);
});

test("방어자 제거 뒤 저장한 확정 반격도 복원 후 중복 없이 처리한다", () => {
  const a = unit("A", "left", "aggressive"), b = unit("B", "right", "passive");
  b.health = 1;
  let f = fixture([a, b]);
  f.tick(0); f.tick(AGENT_ATTACK_HIT_TIME); f.tick(a.attack.exchangeEndsAt);
  const saved = JSON.parse(JSON.stringify(a));
  f = fixture([saved]);
  f.tick(saved.combat.pendingCounter.hitAt);
  assert.equal(saved.health, 90);
  assert.deepEqual(f.hits, ["A"]);
  const again = JSON.parse(JSON.stringify(saved));
  const restored = fixture([again]);
  restored.tick(again.combat.pendingCounter.hitAt + .01);
  assert.equal(again.health, 90);
  assert.deepEqual(restored.hits, []);
});

test("이전 동시 피해 저장에서 이미 차감한 반격을 새 명중 시점에 다시 차감하지 않는다", () => {
  const a = unit("A", "left", "aggressive"), b = unit("B", "right", "passive");
  let f = fixture([a, b]);
  f.tick(0);
  a.health = b.health = 70;
  a.attack.resolved = a.attack.hit = true;
  Object.assign(a.attack.exchange, { damageVersion: 2, attackApplied: true, counterApplied: true,
    attackDamage: 30, counterDamage: 30, resolved: true });
  const saved = JSON.parse(JSON.stringify([a, b]));
  f = fixture(saved);
  f.tick(saved[0].attack.exchangeEndsAt);
  f.tick(saved[1].attack.hitAt);
  assert.deepEqual(saved.map(agent => agent.health), [70, 70]);
  assert.deepEqual(f.hits, []);
});

test("구형 딱정벌레의 인접 공격도 같은 셀에 이동해 새 근접전 명중부터 처리한다", () => {
  const environment = { simSeconds: 0, damageRandom: () => .5, games: new Map(), colonies: [], food: new Map(), foodSpots: new Map(),
    world: { seed: 7, sites: [], terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320),
      burrows: [{ id: "home", type: "small", x: 130, y: 200, width: 1, height: 1, entrance: { x: 130, y: 201 } }] } };
  environment.creatureSystem = createCreatures(environment, null);
  const beetle = environment.creatureSystem.agents[0], target = unit("target", "player", "passive");
  target.x = 101;
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
  environment.simSeconds = hitAt;
  environment.creatureSystem.tick();
  assert.equal(target.health, 76);
  assert.equal(beetle.health, 100);
});

test("반격 연출 중 저장·복원해도 피해와 차례를 다시 적용하지 않는다", () => {
  const a = unit("A", "left", "aggressive"), b = unit("B", "right", "passive");
  let f = fixture([a, b]);
  f.tick(0); f.tick(AGENT_ATTACK_HIT_TIME);
  f.tick(a.attack.exchangeEndsAt);
  assert.ok(b.attack.counter);
  assert.equal(b.combat.nextAttackTurn, 1);
  const saved = JSON.parse(JSON.stringify([a, b]));
  f = fixture(saved);
  f.tick(saved[1].attack.hitAt);
  assert.deepEqual(saved.map(agent => agent.health), [85, 85]);
  assert.deepEqual(f.hits, ["A"]);
  const restored = fixture(JSON.parse(JSON.stringify(saved)));
  restored.tick(saved[1].attack.hitAt + .01);
  assert.deepEqual(restored.hits, []);
  f.tick(saved[1].attack.exchangeEndsAt);
  assert.ok(saved[1].attack && !saved[1].attack.counter);
  assert.equal(saved[1].combat.nextAttackTurn, 2);
});

test("이동 속도로 가중된 이전 저장 차례를 교대 교전으로 변환한다", () => {
  const a = unit("A", "left", "aggressive"), b = unit("B", "right", "passive");
  let f = fixture([a, b]);
  f.tick(0);
  delete a.combat.turnOrderVersion; delete b.combat.turnOrderVersion;
  a.combat.nextAttackTurn = .25; b.combat.nextAttackTurn = 20;
  const saved = JSON.parse(JSON.stringify([a, b]));
  f = fixture(saved);
  finishExchange(f);
  assert.ok(saved[1].attack && !saved[1].attack.counter);
  assert.equal(saved[0].combat.turnOrderVersion, 1);
  assert.equal(saved[1].combat.turnOrderVersion, 1);
});

test("18종의 공격과 반격은 V2 타격 셀에서 한 번 명중하고 전체 동작을 마친다", () => {
  assert.equal(Object.keys(CREATURE_ATTACK_TIMINGS).length, 18);
  for (const species of Object.keys(CREATURE_ATTACK_TIMINGS)) {
    const animation = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/CreatureAttackV2/" + species + "/attack.json", import.meta.url), "utf8"));
    const hitTime = animation.durationsMs.slice(0, animation.impactFrame).reduce((total, duration) => total + duration, 0) / 1000;
    const duration = animation.durationsMs.reduce((total, value) => total + value, 0) / 1000;
    assert.deepEqual(CREATURE_ATTACK_TIMINGS[species], { durationMs: duration * 1000, hitTimeMs: hitTime * 1000 });
    for (const counter of [false, true]) {
      const creature = unit("creature", "wild", "aggressive"), player = unit("player", "colony", "aggressive");
      creature.species = species;
      const f = fixture([creature, player]);
      enclose(f, player);
      f.combat.engage(counter ? player : creature, counter ? creature : player, 0);
      f.tick(0);
      if (counter) {
        assert.equal(player.attack.exchange.counterHitTime, hitTime);
        assert.equal(player.attack.exchange.counterDuration, duration);
        f.tick(player.attack.hitAt);
        f.tick(player.attack.exchangeEndsAt);
      }
      const attack = creature.attack;
      assert.equal(attack.counter, counter);
      assert.ok(Math.abs(attack.hitAt - attack.startedAt - hitTime) < 1e-8);
      assert.ok(Math.abs(attack.endsAt - attack.startedAt - duration) < 1e-8);
      const health = player.health, hits = f.hits.length;
      f.tick(attack.hitAt - .000001);
      assert.equal(player.health, health);
      f.tick(attack.hitAt);
      assert.ok(player.health < health);
      assert.equal(f.hits.length, hits + 1);
      const remaining = player.health;
      f.tick(attack.hitAt);
      assert.equal(player.health, remaining);
      f.tick(attack.endsAt - .000001);
      assert.equal(creature.attack, attack);
    }
  }
});

test("플레이어와 기존 딱정벌레의 공격 명중 및 종료 시점은 유지한다", () => {
  for (const species of [null, "spiny-back-beetle"]) {
    const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive"), f = fixture([a, b]);
    a.species = species;
    f.tick(0);
    assert.equal(a.attack.hitAt, species ? BEETLE_ANIMATIONS.attack.hitTimeMs / 1000 : AGENT_ATTACK_HIT_TIME);
    assert.equal(a.attack.endsAt, species ? BEETLE_ANIMATIONS.attack.durationMs / 1000 : AGENT_ATTACK_DURATION);
  }
});

test("이전 종별 공격 저장은 새 타격 시점으로 옮기며 이미 적용한 피해는 보존한다", () => {
  for (const resolved of [false, true]) {
    const creature = unit("creature", "wild", "aggressive"), player = unit("player", "colony", "passive");
    creature.species = "old-garden-snail";
    let f = fixture([creature, player]);
    f.tick(0);
    if (resolved) f.tick(creature.attack.hitAt);
    Object.assign(creature.attack, { hitAt: .3, endsAt: 1, exchangeEndsAt: 1.2 });
    const saved = JSON.parse(JSON.stringify([creature, player])), health = saved[1].health;
    f = fixture(saved);
    f.tick(.31);
    assert.equal(saved[0].attack.hitAt, .59);
    assert.equal(saved[0].attack.endsAt, 1.57);
    assert.equal(saved[1].health, health);
    f.tick(.59);
    assert.equal(f.hits.length, resolved ? 0 : 1);
    f.tick(.59);
    assert.equal(f.hits.length, resolved ? 0 : 1);
  }
});

test("제거된 생명체의 저장된 확정 반격도 해당 종의 타격 시점과 길이를 따른다", () => {
  const player = unit("player", "colony", "aggressive"), creature = unit("creature", "wild", "passive");
  creature.species = "old-garden-snail";
  creature.health = 1;
  let f = fixture([player, creature]);
  f.tick(0);
  f.tick(player.attack.hitAt);
  f.environment.games.get("wild").agents.length = 0;
  f.tick(player.attack.exchangeEndsAt);
  const pending = player.combat.pendingCounter, startedAt = pending.startedAt;
  Object.assign(pending, { hitAt: startedAt + .3, endsAt: startedAt + 1.2 });
  Object.assign(pending.exchange, { counterHitTime: .3, counterDuration: 1 });
  delete pending.startedAt;
  const saved = JSON.parse(JSON.stringify(player));
  f = fixture([saved]);
  f.tick(startedAt + .31);
  assert.equal(saved.health, 100);
  assert.ok(Math.abs(saved.combat.pendingCounter.hitAt - startedAt - .59) < 1e-8);
  assert.ok(Math.abs(saved.combat.pendingCounter.endsAt - startedAt - (1.57 + COMBAT_EXCHANGE_PAUSE)) < 1e-8);
  f.tick(startedAt + .59);
  assert.equal(f.hits.length, 1);
  const health = saved.health;
  f.tick(startedAt + .59);
  assert.equal(saved.health, health);
});

test("일반 유닛은 공격과 반격을 두 번 마치기 전에는 도주하지 않는다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive");
  a.health = 70;
  const f = fixture([a, b]);
  let rolls = 0;
  f.environment.combatRandom = () => { rolls++; return .1; };
  f.tick(0);
  assert.equal(rolls, 0);
  assert.ok(a.attack);
  finishExchange(f);
  assert.equal(rolls, 0);
  assert.ok(a.combat && b.combat);
  assert.deepEqual(f.hits, ["b", "a"]);
  finishExchange(f);
  assert.equal(rolls, 1);
  assert.equal(a.attack, null);
  assert.equal(a.combat, null);
  assert.equal(a.retreat.recoverHealth, 70);
  assert.equal(a.retreat.attempts, 1);
  assert.equal(a.mode, "flee");
  assert.equal(canPursueCombat(a, b, 10), false);
  assert.deepEqual(f.hits, ["b", "a", "a", "b"]);
});

test("탈출 실패는 차례를 소모하고 진행 중인 반격 뒤 다음 자기 차례에 다시 시도한다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive");
  a.health = 70;
  const f = fixture([a, b]);
  let rolls = 0;
  f.environment.combatRandom = () => ++rolls === 1 ? .99 : .1;
  f.tick(0);
  finishExchange(f); finishExchange(f);
  assert.equal(rolls, 1);
  assert.ok(a.retreat);
  assert.equal(a.attack, null);
  const failedAt = f.environment.simSeconds;
  f.tick(failedAt); f.tick(failedAt + .1);
  assert.equal(rolls, 1);
  f.tick(failedAt + COMBAT_EXCHANGE_PAUSE);
  assert.ok(b.attack && !b.attack.counter);
  f.tick(b.attack.hitAt);
  assert.equal(rolls, 1);
  const savedRetreat = structuredClone(a.retreat);
  f.tick(b.attack.exchangeEndsAt);
  assert.ok(a.attack.counter);
  assert.deepEqual(a.retreat, savedRetreat);
  f.tick(a.attack.hitAt);
  const endedAt = a.attack.exchangeEndsAt;
  f.tick(endedAt);
  assert.equal(rolls, 2);
  assert.equal(a.combat, null);
  assert.equal(a.retreat.attempts, 2);
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

test("탈출할 인접 셀이 없으면 위급해도 멈추지 않고 마지막 전투를 수행한다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive");
  a.health = 20;
  const f = fixture([a, b]);
  for (const [x, y] of [[99, 100], [101, 100], [100, 99], [100, 101]]) f.environment.world.terrain[y * 320 + x] = 0;
  let rolls = 0;
  f.environment.combatRandom = () => { rolls++; return 0; };
  f.tick(0);
  assert.ok(a.attack);
  assert.ok(a.retreat);
  assert.equal(rolls, 0);
});

test("변태 중에도 공격받지만 반격이나 도주로 행동을 바꾸지 않는다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive");
  b.construction = { state: "transforming" };
  const f = fixture([a, b]);
  f.tick(0);
  assert.ok(b.combat);
  assert.equal(b.mode, "transform");
  f.tick(a.attack.hitAt);
  assert.equal(b.health, 85);
  f.tick(a.attack.exchangeEndsAt);
  assert.equal(b.attack, null);
  assert.equal(b.retreat, undefined);
  assert.equal(b.mode, "transform");
  assert.equal(a.health, 100);
});

test("한 번 교전한 저장을 복원해도 두 번째 교전 전에는 도주하지 않는다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive");
  a.health = 70;
  const f = fixture([a, b]);
  f.tick(0); finishExchange(f);
  const restored = JSON.parse(JSON.stringify([a, b])), next = fixture(restored);
  let rolls = 0;
  next.environment.combatRandom = () => { rolls++; return 0; };
  next.tick(f.environment.simSeconds);
  assert.equal(rolls, 0);
  assert.ok(restored.every(agent => agent.combat));
  finishExchange(next);
  assert.equal(rolls, 1);
  assert.equal(restored[0].combat, null);
});

test("소속 유닛의 평화형 성향에는 중립 몹의 즉시 도주 예외를 적용하지 않는다", () => {
  const a = unit("a", "left", "peaceful"), b = unit("b", "right", "aggressive");
  a.health = 70;
  const f = fixture([a, b]);
  let rolls = 0;
  f.environment.combatRandom = () => { rolls++; return 0; };
  f.tick(0); finishExchange(f);
  assert.equal(rolls, 0);
  assert.ok(a.combat && b.combat);
  assert.deepEqual(f.hits, ["a", "b"]);
});
