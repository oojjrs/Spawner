import test from "node:test";
import assert from "node:assert/strict";
import { createCombat, combatDisposition, canPursueCombat, peacefulEscapeChance } from "./combat.mjs";
import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { createGame } from "./game.mjs";
import { createCreatures } from "./creatures.mjs";

function unit(id, ownerId, disposition) {
  return { id, ownerId, combatDisposition: disposition, x: 100, y: 100, renderFromX: 100, renderFromY: 100,
    moveStartedAt: 0, moveDuration: 0, health: 12, attributes: {},
    stats: { health: 12, attack: 1, speed: 1, vision: 4 }, mode: "idle", stepCount: 0 };
}

function fixture(units) {
  const hits = [], environment = { games: new Map(), colonies: [], simSeconds: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) }, combatRandom: () => .99 };
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
  f.tick(0); f.tick(.15); f.tick(.3); f.tick(.45);
  assert.equal(a.health, 11); assert.equal(b.health, 11);
  b.mode = "flee"; b.moveBudget = 5;
  f.tick(.6);
  assert.equal(b.combat.id, a.combat.id);
  assert.equal(b.moveBudget, 0);
  assert.deepEqual([a.x, a.y, b.x, b.y], [100, 100, 100, 100]);
});

test("아군 증원은 같은 편에 합류하고 서로 다른 시점에 개별 공격한다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "passive"), ally = unit("ally", "left", "passive");
  ally.x--;
  const f = fixture([a, b, ally]);
  f.tick(0);
  assert.ok(canPursueCombat(ally, b, .1));
  ally.x++;
  f.tick(.1);
  assert.equal(ally.combat.id, a.combat.id);
  assert.equal(ally.combat.side, a.combat.side);
  f.tick(.22);
  assert.notEqual(ally.attack.startedAt, a.attack.startedAt);
  f.tick(.3); f.tick(.52);
  assert.equal(b.health, 10);
});

test("평화형은 반격 없이 1.5초마다 재시도하며 성공하면 안전한 인접 셀로 이탈한다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "peaceful");
  const f = fixture([a, b]);
  let rolls = 0;
  f.environment.combatRandom = () => ++rolls === 1 ? .9 : .1;
  f.tick(0); f.tick(1.49);
  assert.equal(rolls, 0); assert.ok(!b.attack);
  f.tick(1.5); f.tick(1.6); f.tick(2.99);
  assert.equal(rolls, 1); assert.ok(b.combat); assert.ok(!b.attack);
  f.tick(3);
  assert.equal(rolls, 2);
  assert.ok(!b.combat && !a.combat);
  assert.equal(Math.abs(b.x - 100) + Math.abs(b.y - 100), 1);
  assert.ok(b.escapeUntil > 3 + b.moveDuration);
  a.x = b.x; a.y = b.y;
  f.tick(3.1);
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
  f.tick(0); f.tick(1.5);
  assert.ok(b.combat);
  a.stats.escapeSuppression = 0;
  f.tick(3);
  assert.ok(!b.combat);
});

test("출구가 막혔으면 평화형이 순간이동하지 않고 다음 기회까지 남는다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "peaceful");
  const f = fixture([a, b]);
  f.environment.combatRandom = () => 0;
  for (const [x, y] of [[99, 100], [101, 100], [100, 99], [100, 101]]) f.environment.world.terrain[y * 320 + x] = 0;
  f.tick(0); f.tick(1.5);
  assert.ok(b.combat); assert.deepEqual([b.x, b.y], [100, 100]);
  f.environment.world.terrain[100 * 320 + 99] = 4;
  f.tick(3);
  assert.equal(b.x, 99); assert.ok(!b.combat);
});

test("저장한 공격과 탈출 대기를 복원해도 중복 피해·즉시 재판정을 만들지 않는다", () => {
  const a = unit("a", "left", "aggressive"), b = unit("b", "right", "peaceful");
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
  assert.ok(!a.combat);
});

test("유니크는 비선공 또는 선공만 허용하고 일반 평화종과 구분한다", () => {
  for (const type of ENCOUNTER_TYPES.filter(entry => entry.unique)) assert.ok(["passive", "aggressive"].includes(combatDisposition({ species: type.key })));
  assert.equal(combatDisposition({ species: "spring-keeper", combatDisposition: "peaceful" }), "passive");
  assert.equal(combatDisposition({ species: "white-paw" }), "aggressive");
  assert.equal(combatDisposition({ species: "flower-tail-bird" }), "peaceful");
});

test("네 종족 모두 실제 게임에서 성향을 적용하고 전투 상태를 저장·복원한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const colony = { id: 1, ownerId: tribe, tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
    const environment = { simSeconds: 10, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
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
    assert.equal(target.health, 11);
    game.prepare(10.4); game.tick(.1);
    assert.equal(target.health, 11);
    assert.ok(agent);
  }
});

test("실제 딱정벌레는 인접 셀에서 원격 공격하지 않고 같은 셀에서 캐칭한다", () => {
  const environment = { simSeconds: 0, games: new Map(), colonies: [], food: new Map(), foodSpots: new Map(),
    world: { seed: 7, sites: [], terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320),
      burrows: [{ id: "home", type: "small", x: 130, y: 200, width: 1, height: 1, entrance: { x: 130, y: 201 } }] } };
  environment.creatureSystem = createCreatures(environment, null);
  const beetle = environment.creatureSystem.agents[0], target = unit("target", "player", "passive");
  Object.assign(beetle, { x: 100, y: 100, homeX: 100, homeY: 100, renderFromX: 100, renderFromY: 100 });
  target.x = 101;
  environment.games.set("player", { agents: [target], receiveDamage(victim, amount) { victim.health -= amount; } });
  environment.creatureSystem.tick();
  assert.equal(target.health, 12); assert.ok(!beetle.attack);
  assert.equal(beetle.x, target.x); assert.equal(beetle.mode, "walk");
  environment.simSeconds = beetle.moveDuration;
  environment.creatureSystem.tick();
  assert.equal(beetle.combat.id, target.combat.id);
  environment.simSeconds += .52;
  environment.creatureSystem.tick();
  assert.equal(target.health, 9);
});

test("중립으로 표시된 비선공 유니크도 실제 전투에 붙잡히면 반격한다", () => {
  const colony = { id: 1, ownerId: "player", tribe: "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 400, games: new Map(), colonies: [colony], food: new Map(), foodSpots: new Map(),
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
  environment.simSeconds = 400.15; environment.creatureSystem.tick();
  assert.ok(unique.attack);
  environment.simSeconds = 400.75; environment.creatureSystem.tick();
  assert.equal(game.agents[0].health, 11);
  assert.deepEqual([unique.x, unique.y], [140, 140]);
});
