import test from "node:test";
import assert from "node:assert/strict";
import { createCombat, combatDisposition, canPursueCombat, peacefulEscapeChance, COMBAT_EXCHANGE_PAUSE } from "./combat.mjs";
import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";
import { AGENT_ATTACK_DURATION, AGENT_ATTACK_HIT_TIME, AGENT_HURT_DURATION } from "./attack.mjs";
import { unitAnimationPose } from "../client/unit-animation.mjs";

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
  assert.equal(a.health, 70); assert.equal(b.health, 70);
  const next = a.attack.exchangeEndsAt;
  f.tick(next); f.tick(next + .3);
  assert.equal(a.health, 70); assert.equal(b.health, 70);
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
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "peaceful");
  const f = fixture([a, b]);
  let rolls = 0;
  f.environment.combatRandom = () => ++rolls === 1 ? .9 : .1;
  f.tick(0); f.tick(.3);
  assert.equal(a.health, 70); assert.equal(b.health, 70);
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
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "peaceful");
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
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "peaceful");
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
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "peaceful");
  const f = fixture([a, b]);
  f.tick(0);
  const restored = JSON.parse(JSON.stringify([a, b]));
  const next = fixture(restored);
  next.tick(.3); next.tick(.3);
  assert.deepEqual(next.hits, ["b", "a"]);
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
  assert.ok(!a.combat);
});

test("유니크는 비선공 또는 선공만 허용하고 일반 평화종과 구분한다", () => {
  for (const type of ENCOUNTER_TYPES.filter(entry => entry.unique)) assert.ok(["passive", "aggressive"].includes(combatDisposition({ species: type.key })));
  assert.equal(combatDisposition({ species: "spring-keeper", combatDisposition: "peaceful" }), "passive");
  assert.equal(combatDisposition({ species: "white-paw" }), "aggressive");
  assert.equal(combatDisposition({ species: "flower-tail-bird" }), "peaceful");
});

test("네 종족 모두 실제 게임에서 성향을 적용하고 전투 상태를 저장·복원한다", () => {
  for (const [tribe, remaining] of [["bean", 70], ["spore", 72], ["pebble", 68], ["spring", 71]]) {
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
  assert.equal(target.health, 52);
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
  game.prepare(400); game.tick(.01);
  assert.equal(unique.combat.id, game.agents[0].combat.id);
  for (let exchange = 0; exchange < 3 && !unique.attack; exchange++) {
    const attack = game.agents[0].attack;
    environment.simSeconds = attack.hitAt; game.prepare(environment.simSeconds); environment.creatureSystem.tick();
    environment.simSeconds = attack.exchangeEndsAt; game.prepare(environment.simSeconds); environment.creatureSystem.tick();
  }
  assert.ok(unique.attack);
  environment.simSeconds = unique.attack.hitAt; game.prepare(environment.simSeconds); environment.creatureSystem.tick();
  assert.equal(game.agents[0].health, 28);
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
  assert.deepEqual(f.hits, ["B", "A"]);
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

test("누가 근접전을 시작해도 같은 교전에서 양쪽 피해를 적용한다", () => {
  for (const first of ["A", "B"]) {
    const a = unit("A", "left", "aggressive"), b = unit("B", "right", "aggressive"), f = fixture([a, b]);
    f.combat.engage(first === "A" ? a : b, first === "A" ? b : a, 0);
    f.tick(0); f.tick(AGENT_ATTACK_HIT_TIME);
    assert.equal(a.health, 70); assert.equal(b.health, 70);
    assert.deepEqual([...f.hits].sort(), ["A", "B"]);
  }
});

test("치명타로 양쪽이 사망해도 이미 성립한 반격 피해를 누락하지 않는다", () => {
  const a = unit("A", "left", "aggressive"), b = unit("B", "right", "passive"), f = fixture([a, b]);
  a.health = b.health = 1;
  f.tick(0); f.tick(AGENT_ATTACK_HIT_TIME);
  assert.equal(a.health, 0); assert.equal(b.health, 0);
  assert.deepEqual(f.hits, ["B", "A"]);
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
  assert.deepEqual(saved.map(agent => agent.health), [70, 70]);
  assert.deepEqual(f.hits, []);
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
