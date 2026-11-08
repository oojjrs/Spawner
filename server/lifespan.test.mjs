import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";
import { tickRoom } from "../client/room.mjs";
import { ATTRIBUTE_DNA as M } from "./dna.mjs";
import { validateDna } from "./dna-unit.mjs";
import { agentRemainingLifespan } from "./lifespan.mjs";
import { codexGeneDetails, CODEX_GENES } from "../client/codex-content.mjs";

function fixture(create, tribe) {
  const colony = { id: 1, ownerId: "lifespan", tribe, x: 20, y: 20, occupiedCells: new Set(["2,2"]) };
  const room = { simSeconds: 0, hostId: colony.ownerId, world: { size: 80, seed: 13, generationVersion: 38,
    terrain: new Uint8Array(6400).fill(4), hazards: new Uint8Array(6400) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = create(room, colony);
  room.games.set(colony.ownerId, game);
  return { room, game };
}

function design(count) {
  return { version: 6, level: 3, budget: 1000, pieces: M.pack(Array.from({ length: count }, () =>
    ({ gene: "lifespan", grade: 3, rotation: 0 })), 3) };
}

test("수명은 3레벨에 개방되며 조각마다 2분씩 중첩되고 다른 DNA 코드를 바꾸지 않는다", () => {
  const gene = M.lookup.get("lifespan");
  assert.equal(gene.grade, 3);
  assert.equal(gene.price, 11);
  assert.equal(M.lookup.get("stun").code, "TCG");
  assert.equal(validateDna(design(1), 2, 1000), null);
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const count of [0, 1, 2]) {
    const dna = design(count);
    assert.ok(validateDna(dna, 3, 1000));
    assert.equal(M.stats(dna.pieces, tribe).lifespan, [300, 420, 540][count]);
  }
  assert.deepEqual(codexGeneDetails(CODEX_GENES.find(value => value.id === "lifespan"), "bean").effects, [["수명", "+2분"]]);
});

test("5분 경계 자연사는 사체와 적재 자원을 한 번만 남기고 인구 자리를 반환한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const { game, room } = fixture(createGame, tribe);
    game.agents.splice(1);
    const agent = game.agents[0], id = agent.id;
    agent.carrying = 2; agent.carryingType = "clay";
    game.prepare(299.99); game.tick(0);
    assert.ok(game.agents.some(value => value.id === id));
    game.prepare(300); game.tick(0);
    assert.equal(game.agents.length, 0);
    assert.equal(agent.health, 0);
    assert.equal([...room.food.values()].filter(cell => cell.agentId === id).length, 1);
    assert.equal([...room.food.values()].filter(cell => cell.resourceType === "clay").reduce((sum, cell) => sum + cell.amount, 0), 2);
    game.tick(0);
    assert.equal([...room.food.values()].filter(cell => cell.agentId === id).length, 1);
    const result = game.command({ type: "birth", templateId: game.snapshot().templates[0].id });
    assert.equal(game.agents.find(value => value.id === result.agentId).lifespanStartedAt, 300);
  }
});

test("구저장은 출생 기록을 보존해 유예하고 새 저장과 판단 상태는 남은 수명을 늘리지 않는다", () => {
  const { game, room } = fixture(createGame, "bean"), saved = JSON.parse(game.save());
  saved.state.simSeconds = 10000;
  for (const agent of saved.state.agents) { delete agent.lifespanStartedAt; agent.lifespan = 1; }
  game.restore(JSON.stringify(saved));
  const agent = game.agents[0];
  assert.equal(agent.bornAt, 0);
  assert.equal(agent.lifespanStartedAt, 10000);
  game.prepare(10100);
  game.restore(game.save());
  assert.equal(agentRemainingLifespan(game.agents[0], 10100), 200);
  room.simSeconds = 10100;
  game.updateDecisionState(structuredClone(game.decisionSnapshot()));
  assert.equal(game.agents[0].lifespan, 300);
  assert.equal(game.agents[0].stats.lifespan, 300);
  assert.equal(agentRemainingLifespan(game.agents[0], 10100), 200);
  game.prepare(10300); game.tick(0);
  assert.equal(game.agents.length, 0);
});

test("수명 조각으로 태어난 개체는 저장 후에도 7분 경계에 사망한다", () => {
  const { game } = fixture(createGame, "bean"), saved = JSON.parse(game.save());
  saved.state.nestLevel = 3; saved.state.evolutionPoints = 1000;
  game.restore(JSON.stringify(saved));
  game.agents.splice(0);
  const result = game.command({ type: "design", templateId: null, name: "수명", dna: design(1), birth: true });
  assert.ok(result.agentId);
  game.prepare(419.99); game.tick(0);
  game.restore(game.save());
  assert.equal(game.agents[0].id, result.agentId);
  assert.equal(game.agents[0].lifespan, 420);
  game.prepare(420); game.tick(0);
  assert.equal(game.agents.length, 0);
});

test("실제 브라우저·시뮬레이션·판단 Worker에 수명과 저장 전환이 함께 반영된다", () => {
  const source = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8"), browser = {};
  runInNewContext(source, browser);
  assert.equal(browser.Spawner.ATTRIBUTE_DNA.stats(design(2).pieces).lifespan, 540);
  assert.equal(browser.Spawner.agentRemainingLifespan({ lifespan: 300, lifespanStartedAt: 10 }, 20), 290);
  const worker = JSON.parse(source.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const decision = JSON.parse(worker.match(/globalThis\.SpawnerDecisionWorkerSource = ("[^\r\n]+");/)[1]);
  for (const [code, entry] of [[worker, "client/worker.mjs"], [decision, "client/decision-worker.mjs"]]) {
    const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
    runInNewContext(code.slice(0, code.indexOf(`modules["${entry}"]`)) + 'globalThis.create = modules["server/game.mjs"].createGame; })();', context);
    const { game } = fixture(context.create, "bean");
    assert.equal(game.agents[0].lifespan, 300);
    game.prepare(299); game.restore(game.save());
    assert.ok(game.agents.length);
    game.prepare(300); game.tick(0);
    assert.equal(game.agents.length, 0);
  }
});


test("군락 갱신 순서와 무관하게 수명과 타격이 겹치면 자연사만 처리하고 전투 참조를 정리한다", () => {
  for (const expires of ["a", "b", "both"]) {
    const room = { hostId: "a", simSeconds: 0, revision: 0, games: new Map(), food: new Map(), foodSpots: new Map(), colonies: [],
      combatRandom: () => .99, damageRandom: () => .5, world: { size: 160, seed: 13, generationVersion: 38,
        terrain: new Uint8Array(25600).fill(4), hazards: new Uint8Array(25600), treeCells: new Uint8Array(25600) },
      creatureSystem: { agents: [], tick() {} } };
    const events = [], actors = [];
    room.onCombatEvent = event => events.push(event);
    for (const [index, owner] of ["a", "b"].entries()) {
      const colony = { id: index + 1, ownerId: owner, tribe: "bean", name: owner, x: 30 + index * 30, y: 30,
        occupiedCells: new Set(["2,2"]) };
      room.colonies.push(colony);
      const game = createGame(room, colony);
      room.games.set(owner, game);
      const saved = JSON.parse(game.save());
      saved.state.agents = saved.state.agents.slice(0, 1);
      saved.state.nestLevel = 3; saved.state.evolutionPoints = 500; saved.state.productionReadyAt = 10000;
      const agent = saved.state.agents[0];
      agent.dna = { version: 6, level: 3, budget: 1000, pieces: M.pack(["blade", "antenna"].map(gene =>
        ({ gene, grade: M.lookup.get(gene).grade, rotation: 0 })), 3) };
      agent.x = agent.renderFromX = agent.y = agent.renderFromY = 50;
      agent.birth = null; agent.moveDuration = 0; agent.utility = null;
      game.restore(JSON.stringify(saved));
      const unit = game.agents[0];
      unit.health = unit.stats.health = unit.stats.dna.health = 10000;
      unit.lifespan = expires === "both" || expires === owner ? 1.25 : 300;
      actors.push(unit);
    }
    room.simSeconds = .9; tickRoom(room, 0);
    for (const [index, agent] of actors.entries()) {
      assert.ok(agent.combat);
      Object.assign(agent.combat.position, { x: index ? .4 : -.4, y: 0, fromX: index ? .4 : -.4, fromY: 0 });
    }
    for (let step = 0; step < 4; step++) tickRoom(room, .1);
    const expired = actors.filter(agent => agent.lifespan === 1.25);
    assert.ok(expired.every(agent => agent.health === 0 && agent.attack === null && agent.combat === null));
    assert.ok(actors.filter(agent => agent.health > 0).every(agent => agent.health === 10000 && !agent.combat && !agent.attack));
    assert.equal(events.filter(event => event.at >= 1.25 && ["hit", "death", "counter", "reflect"].includes(event.kind)).length, 0);
    assert.equal([...room.food.values()].filter(cell => cell.kind === "corpse").length, expired.length);
    tickRoom(room, .1);
    assert.equal([...room.food.values()].filter(cell => cell.kind === "corpse").length, expired.length);
  }
});


test("셀 전투 마지막 사수나 표적의 자연사는 준비 공격과 발사된 투사체를 취소한다", () => {
  for (const expires of ["source", "target", "both", "neither"]) for (const lifespan of [1.1, 1.25]) {
    const { room, game } = fixture(createGame, "bean");
    room.revision = 0; room.combatRandom = () => .99; room.damageRandom = () => .5;
    room.creatureSystem = { agents: [], tick() {} };
    const colony = { id: 2, ownerId: "enemy", tribe: "bean", x: 60, y: 30, occupiedCells: new Set(["2,2"]) };
    room.colonies.push(colony);
    const enemy = createGame(room, colony); room.games.set(colony.ownerId, enemy);
    const actors = [], events = [];
    room.onCombatEvent = event => events.push(event);
    for (const [index, current] of [game, enemy].entries()) {
      const saved = JSON.parse(current.save());
      saved.state.agents = saved.state.agents.slice(0, 1);
      saved.state.nestLevel = 3; saved.state.evolutionPoints = 500; saved.state.productionReadyAt = 10000;
      const agent = saved.state.agents[0];
      agent.dna = { version: 6, level: 3, budget: 1000, pieces: M.pack([index ? "blade" : "secretion", "antenna"].map(gene =>
        ({ gene, grade: M.lookup.get(gene).grade, rotation: 0 })), 3) };
      agent.x = agent.renderFromX = 50; agent.y = agent.renderFromY = 50;
      agent.birth = null; agent.moveDuration = 0; agent.utility = null;
      current.restore(JSON.stringify(saved));
      const unit = current.agents[0];
      unit.health = expires === "neither" && index ? 1 : 10000;
      unit.stats.health = unit.stats.dna.health = 10000;
      unit.lifespan = expires === "both" || expires === (index ? "target" : "source") ? lifespan : 300;
      unit.stats.dna.focus = .3;
      actors.push(unit);
    }
    room.simSeconds = .9;
    actors[1].attackReady = 1000;
    assert.ok(room.combatSystem.engage(actors[0], actors[1], .9));
    for (const [unit, x] of [[actors[0], -1], [actors[1], 1]]) Object.assign(unit.combat.position, { x, y: 0, fromX: x, fromY: 0 });
    tickRoom(room, 0);
    assert.equal(actors[0].attack.attackMode, "ranged");
    assert.equal(actors[0].dnaProjectiles?.length || 0, 0);
    for (let step = 0; step < 8; step++) tickRoom(room, .1);
    assert.equal(actors[0].dnaProjectiles?.length || 0, 0);
    const canceled = events.filter(event => event.kind === "projectile-cancel");
    assert.equal(canceled.length, expires !== "neither" && lifespan > 1.2 ? 1 : 0);
    assert.equal(events.filter(event => event.kind === "shoot").length, expires === "neither" || lifespan > 1.2 ? 1 : 0);
    if (expires === "neither") {
      assert.equal(actors[1].health, 0);
      assert.equal(events.filter(event => event.kind === "death").length, 1);
    } else {
      assert.equal(events.filter(event => ["hit", "death"].includes(event.kind)).length, 0);
      assert.ok(actors.filter(agent => agent.health > 0).every(agent => agent.health === 10000));
      assert.ok(actors.filter(agent => agent.health === 0).every(agent => !agent.attack && !agent.combat));
    }
  }
});
