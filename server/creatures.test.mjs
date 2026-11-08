import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCreatures } from "./creatures.mjs";
import { BURROW_TYPES } from "./burrows.mjs";
import { BEETLE_ANIMATIONS, beetleAnimationPose } from "./beetle-animation.mjs";
import { worldSize } from "./world-size.mjs";
import { CORPSE_LIFETIME } from "./corpses.mjs";
import { combatDamage } from "./combat-stats.mjs";
import { createGame } from "./game.mjs";
import { generateWorld, WORLD_GENERATION_VERSION } from "./world.mjs";
import { createRoom, saveRoom, restoreRoom, snapshotRoom } from "../client/room.mjs";

const attack = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/spiny-back-beetle-attack.json", import.meta.url), "utf8"));

function environment() {
  return { seed: 7, simSeconds: 0, damageRandom: () => .5, world: { seed: 7, sites: [[100, 100]], terrain: new Uint8Array(320 * 320).fill(4), creatureDensity: new Uint8Array(320 * 320).fill(255),
    hazards: new Uint8Array(320 * 320), burrows: [
      { id: "burrow:small:64130", type: "small", x: 130, y: 200, width: 1, height: 1, entrance: { x: 130, y: 201 } },
      { id: "burrow:large:64230", type: "large", x: 230, y: 200, width: 3, height: 1, entrance: { x: 231, y: 201 } }
    ] },
    games: new Map(), colonies: [], food: new Map(), foodSpots: new Map() };
}

function loneCreature(room) {
  const beetle = createCreatures(room, null).agents[0];
  room.creatureSystem = createCreatures(room, { version: 3, agents: [beetle] });
  return beetle;
}

function encounter() {
  const room = environment();
  const beetle = loneCreature(room);
  Object.assign(beetle, { x: 140, y: 140, homeX: 140, homeY: 140, renderFromX: 140, renderFromY: 140 });
  const victim = { id: "1:1", x: 140, y: 140, health: 1000, combatDisposition: "peaceful", stats: { health: 1000, speed: 1, attack: 1, combatStrength: 20 }, moveStartedAt: 0, moveDuration: 0 };
  const hits = [];
  room.games.set("first", { agents: [victim], receiveDamage(agent, amount) { hits.push({ time: room.simSeconds, amount }); agent.health -= amount; } });
  return { room, beetle, victim, hits };
}

test("굴마다 작은 굴 1마리·큰 굴 3마리를 입구 주변 빈 칸에 중복 없이 생성한다", () => {
  const room = environment();
  room.world.sites.push([130, 130], [160, 160]);
  const system = createCreatures(room, null);
  assert.equal(system.agents.length, 4);
  assert.equal(new Set(system.agents.map(agent => agent.x + "," + agent.y)).size, system.agents.length);
  assert.equal(new Set(system.agents.map(agent => agent.id)).size, system.agents.length);
  assert.ok(system.agents.some(agent => room.world.sites.every(site => Math.hypot(agent.x - site[0], agent.y - site[1]) > 80)));
  for (const agent of system.agents) {
    const burrow = room.world.burrows.find(burrow => burrow.id === agent.burrowId);
    assert.ok(burrow);
    assert.equal(agent.homeX, burrow.entrance.x);
    assert.equal(agent.homeY, burrow.entrance.y);
    assert.equal(system.agents.filter(other => other.burrowId === burrow.id).length, burrow.type === "small" ? 1 : 3);
    assert.ok(agent.x < burrow.x || agent.x >= burrow.x + burrow.width || agent.y !== burrow.y);
    assert.ok(room.world.sites.every(site => Math.hypot(agent.x - site[0], agent.y - site[1]) >= 26));
    assert.equal(room.world.terrain[agent.y * 320 + agent.x], 4);
    assert.equal(agent.mode, "idle");
  }
});

test("대기 후 보행하고 이동 완료 뒤 다시 대기한다", () => {
  const room = environment();
  const system = createCreatures(room, null);
  const beetle = system.agents[0];
  room.simSeconds = beetle.nextActionAt + 0.01;
  system.tick();
  assert.equal(beetle.mode, "walk");
  assert.equal(Math.abs(beetle.x - beetle.renderFromX) + Math.abs(beetle.y - beetle.renderFromY), 1);
  assert.equal(beetle.moveDuration, 1 / 1.2);
  room.simSeconds += beetle.moveDuration;
  system.tick();
  assert.equal(beetle.mode, "idle");
});

test("턱이 닫히는 프레임에서 한 번만 피해를 주고 공격을 마친다", () => {
  const { room, beetle, victim, hits } = encounter();
  room.creatureSystem.tick();
  assert.equal(beetle.mode, "attack");
  const health = victim.health, activeAttack = beetle.attack;
  room.simSeconds = activeAttack.hitAt - 0.001;
  room.creatureSystem.tick();
  assert.equal(victim.health, health);
  room.simSeconds = activeAttack.hitAt;
  room.creatureSystem.tick();
  room.creatureSystem.tick();
  assert.equal(hits.length, 1);
  assert.equal(victim.health, health - combatDamage(beetle, victim, .5));
  room.simSeconds = activeAttack.endsAt;
  room.creatureSystem.tick();
  assert.equal(beetleAnimationPose(beetle, room.simSeconds).action, "idle");
  assert.equal(beetle.attack, null);
  assert.ok(beetle.combat.nextAttackAt > room.simSeconds);
});

test("공격 준비 중 전투 셀에서 사라진 개체는 맞지 않는다", () => {
  const { room, victim, hits } = encounter();
  room.creatureSystem.tick();
  victim.x += 2;
  room.simSeconds = attack.hitTimeMs / 1000;
  room.creatureSystem.tick();
  assert.equal(hits.length, 0);
});

test("공격 중 저장·복원해도 공격 시간과 단발 피해를 유지한다", () => {
  const { room, hits } = encounter();
  room.creatureSystem.tick();
  room.simSeconds = 0.3;
  room.creatureSystem = createCreatures(room, JSON.parse(JSON.stringify(room.creatureSystem.save())));
  room.simSeconds = attack.hitTimeMs / 1000;
  room.creatureSystem.tick();
  assert.equal(hits.length, 1);
  room.creatureSystem = createCreatures(room, JSON.parse(JSON.stringify(room.creatureSystem.save())));
  room.simSeconds = 0.8;
  room.creatureSystem.tick();
  assert.equal(hits.length, 1);
});

test("시야 안에서만 표시하고 처치 시 사체를 한 번 남긴다", () => {
  const room = environment();
  const colony = { id: 1, ownerId: "owner", x: 98, y: 98, occupiedCells: new Set(["2,2"]) };
  room.colonies.push(colony);
  const beetle = loneCreature(room);
  Object.assign(beetle, { x: 140, y: 140, homeX: 140, homeY: 140, health: 1, renderFromX: 140, renderFromY: 140 });
  const game = createGame(room, colony);
  room.games.set("owner", game);
  game.command({ type: "design", templateId: null, name: "확인용 개체", slots: [], birth: true });
  const agent = game.agents[0];
  Object.assign(agent, { x: 100, y: 102, renderFromX: 100, renderFromY: 102 });
  game.prepare(0);
  assert.equal(game.snapshot().rivals.length, 0);
  Object.assign(agent, { x: 139, y: 140, renderFromX: 139, renderFromY: 140 });
  assert.equal(game.snapshot().rivals[0].species, "spiny-back-beetle");
  assert.equal(game.snapshot().rivals[0].faction, "hostile");
  const points = game.snapshot().evolutionPoints;
  room.simSeconds = 1;
  game.prepare(1);
  game.tick(1);
  room.creatureSystem.receiveDamage(beetle, 100);
  room.simSeconds += BEETLE_ANIMATIONS.death.durationMs / 1000;
  room.creatureSystem.tick();
  room.creatureSystem.tick();
  assert.equal(room.creatureSystem.agents.length, 0);
  const corpses = [...room.food.values()].filter(cell => cell.species === "spiny-back-beetle");
  assert.equal(corpses.length, 1);
  assert.equal("amount" in corpses[0], false);
  assert.equal("resourceType" in corpses[0], false);
  assert.equal(corpses[0].decaysAt, corpses[0].diedAt + CORPSE_LIFETIME);
  room.simSeconds = corpses[0].decaysAt; room.creatureSystem.tick();
  assert.equal([...room.food.values()].filter(cell => cell.kind === "corpse").length, 0);
  assert.equal(game.snapshot().evolutionPoints, points);
  const restored = createCreatures(room, JSON.parse(JSON.stringify(room.creatureSystem.save())));
  assert.equal(restored.agents.length, 0);
});

function fight(count) {
  const room = environment();
  const colony = { id: 1, ownerId: "owner", x: 98, y: 98, occupiedCells: new Set(["2,2"]) };
  room.colonies.push(colony);
  const beetle = loneCreature(room);
  Object.assign(beetle, { x: 140, y: 140, homeX: 140, homeY: 140, renderFromX: 140, renderFromY: 140 });
  const game = createGame(room, colony);
  room.games.set("owner", game);
  const saved = JSON.parse(game.save());
  saved.state.agents = [];
  saved.state.evolutionPoints = 20;
  game.restore(JSON.stringify(saved));
  const positions = [[139, 140], [140, 139], [141, 140]];
  const actions = new Set(), combatSides = new Set();
  let retreats = false;
  for (let index = 0; index < count; index++) {
    const result = game.command({ type: "design", templateId: null, name: "기본 콩 " + index, slots: [], birth: true });
    assert.ok(result.agentId, "교전 검사에 필요한 개체가 실제로 생성되어야 합니다.");
    const agent = game.agents.find(candidate => candidate.id === result.agentId);
    const [x, y] = positions[index];
    Object.assign(agent, { x, y, renderFromX: x, renderFromY: y, birth: null,
      personality: Object.freeze({ boldness: 0.2, aggression: 0.2, curiosity: 0.2 }) });
  }
  assert.equal(game.agents.length, count);
  for (let step = 1; step <= 600 && beetle.health > 0 && game.agents.length > 0; step++) {
    room.simSeconds = step / 10;
    game.prepare(room.simSeconds);
    game.tick(0.1);
    for (const agent of game.agents) {
      actions.add(agent.utility?.action);
      if (agent.combat) combatSides.add(agent.combat.side);
      if (step !== 1) continue;
      const next = agent.utility?.route?.[1];
      if (next && Math.abs(next.x - beetle.x) + Math.abs(next.y - beetle.y) >
        Math.abs(agent.x - beetle.x) + Math.abs(agent.y - beetle.y)) retreats = true;
    }
    room.creatureSystem.tick();
  }
  return { beetle, agents: game.agents, duration: room.simSeconds, actions, combatSides, retreats };
}

test("신중한 비선공 개체는 강적을 먼저 공격하지 않고 붙잡혔을 때 반격한다", () => {
  for (const count of [1, 2, 3]) {
    const result = fight(count);
    assert.deepEqual([...result.combatSides], [1]);
    assert.ok(!result.actions.has("fight"));
    if (count === 1) assert.ok(result.retreats, "혼자인 개체는 첫 이동부터 강적과 거리를 벌려야 합니다.");
  }
});

test("밀도 대신 생성된 굴을 개체 생성 기준으로 삼고 월드 안전 거리를 지킨다", () => {
  const empty = environment();
  empty.world.burrows = [];
  assert.equal(createCreatures(empty, null).agents.length, 0);
  for (const [version, safeRadius] of [[1, 26], [WORLD_GENERATION_VERSION, 10]]) {
    const room = environment();
    room.world = generateWorld(7, version);
    assert.equal(room.world.generationVersion, version);
    const system = createCreatures(room, null);
    const beetles = system.agents.filter(agent => agent.species === "spiny-back-beetle");
    assert.ok(beetles.length > 0);
    for (const agent of beetles) {
      const burrow = room.world.burrows.find(burrow => burrow.id === agent.burrowId);
      assert.ok(burrow);
      assert.ok(!burrow.creature?.unique);
      assert.ok(room.world.sites.every(site => Math.hypot(agent.x - site[0], agent.y - site[1]) >= safeRadius));
    }
    const size = worldSize(room.world);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (room.world.sites.some(site => Math.hypot(x - site[0], y - site[1]) < safeRadius)) assert.equal(room.world.creatureDensity[y * size + x], 0);
    }
    assert.deepEqual(createCreatures(room, null).save(), system.save());
    const withoutDensity = { ...room, world: { ...room.world, creatureDensity: new Uint8Array(size * size) } };
    assert.deepEqual(createCreatures(withoutDensity, null).save(), system.save());
  }
});

test("배회와 추격 중 둥지 안전 반경으로 들어가지 않는다", () => {
  const room = environment();
  const beetle = loneCreature(room);
  Object.assign(beetle, { x: 118, y: 100, homeX: 126, homeY: 100, renderFromX: 118, renderFromY: 100 });
  const victim = { id: "1:1", x: 117, y: 100, health: 12, moveStartedAt: 0, moveDuration: 0 };
  room.games.set("first", { agents: [victim], receiveDamage() { assert.fail("안전 반경의 개체를 공격했다"); } });
  for (let step = 0; step < 600; step++) {
    room.simSeconds = step / 10;
    room.creatureSystem.tick();
    assert.ok(Math.hypot(beetle.x - 100, beetle.y - 100) >= 18);
    assert.notEqual(beetle.mode, "attack");
  }
});

test("이전 저장의 생존 개체는 체력 비율과 식별자를 유지하며 둥지 밖으로 재배치한다", () => {
  const room = environment();
  const original = createCreatures(room, null).agents[0];
  Object.assign(original, { x: 112, y: 100, homeX: 112, homeY: 100, health: 6, stats: { ...original.stats, health: 12, attack: 2 } });
  const saved = { version: 1, agents: [original] };
  const system = createCreatures(room, saved);
  const beetle = system.agents.find(agent => agent.id === original.id);
  assert.equal(system.save().version, 5);
  assert.equal(system.agents.length, 1);
  assert.ok(beetle.burrowId);
  assert.equal(beetle.id, original.id);
  assert.equal(beetle.health / beetle.stats.health, 0.5);
  assert.equal(beetle.stats.attack, 3);
  assert.ok(Math.hypot(beetle.homeX - 100, beetle.homeY - 100) >= 26);
  assert.equal(beetle.mode, "idle");
  assert.deepEqual(createCreatures(room, JSON.parse(JSON.stringify(system.save()))).save(), system.save());
  assert.equal(createCreatures(room, { version: 1, agents: [] }).agents.length, 0);
});

test("이전 저장 개체는 밀도 후보가 없어도 안전한 빈 칸으로 옮겨 보존한다", () => {
  const room = environment();
  const original = createCreatures(room, null).agents[0];
  Object.assign(original, { x: 112, y: 100, homeX: 112, homeY: 100, health: 6, stats: { ...original.stats, health: 12, attack: 2 } });
  room.world.creatureDensity.fill(0);
  const system = createCreatures(room, { version: 1, agents: [original] });
  assert.equal(system.agents.length, 1);
  assert.equal(system.agents[0].id, original.id);
  assert.equal(system.agents[0].health / system.agents[0].stats.health, 0.5);
  assert.ok(Math.hypot(system.agents[0].x - 100, system.agents[0].y - 100) >= 26);
});

test("같은 굴 배치에서는 밀도 노이즈를 바꿔도 개체를 추가로 흩뿌리지 않는다", () => {
  const room = environment();
  const system = createCreatures(room, null);
  room.world.creatureDensity.fill(0);
  assert.deepEqual(createCreatures(room, null).save(), system.save());
});

test("기존 방 개체의 식별자·체력·위치를 보존해 가까운 굴에 연결하고 불러오기만으로 추가하지 않는다", () => {
  const room = environment();
  const original = loneCreature(room);
  original.health = 7;
  const system = createCreatures(room, { version: 2, agents: [original] });
  assert.equal(system.agents.length, 1);
  assert.equal(system.agents.find(agent => agent.id === original.id).health, 7);
  const saved = JSON.parse(JSON.stringify(system.save()));
  assert.equal(system.agents[0].burrowId, room.world.burrows[0].id);
  assert.equal(system.agents[0].x, original.x);
  const restored = createCreatures(room, saved);
  assert.deepEqual(restored.save(), saved);
  assert.equal(createCreatures(room, { version: 2, agents: [] }).agents.length, 0);
  assert.equal(createCreatures(room, { version: 3, agents: [] }).agents.length, 0);
});

function population(system, room) {
  return room.world.burrows.map(burrow => system.agents.filter(agent => agent.burrowId === burrow.id && agent.health > 0).length);
}

test("굴은 최초 개체만 배치하며 시간이 지나거나 멀리 이동해도 증식하지 않는다", () => {
  const room = environment(), system = createCreatures(room, null);
  const initialIds = system.agents.map(agent => agent.id);
  Object.assign(system.agents[0], { x: 280, y: 280, renderFromX: 280, renderFromY: 280 });
  for (const time of [60, 120, 180, 240, 3600, 36000]) {
    room.simSeconds = time; system.tick();
    assert.deepEqual(population(system, room), [1, 3]);
    assert.deepEqual(system.agents.map(agent => agent.id), initialIds);
  }
});

test("전멸한 굴은 입구가 열려 있어도 다시 생성하지 않는다", () => {
  const room = environment(), system = createCreatures(room, null);
  for (const agent of system.agents) system.receiveDamage(agent, agent.health);
  room.simSeconds = 36000; system.tick();
  assert.deepEqual(population(system, room), [0, 0]);
  assert.equal(system.agents.length, 0);
  for (let index = 0; index < 1000; index++) { room.simSeconds++; system.tick(); }
  assert.equal(system.agents.length, 0);
});

test("옛 증식 예약을 저장복원해도 생존 개체를 늘리거나 죽은 개체를 재생성하지 않는다", () => {
  const room = environment(); let system = createCreatures(room, null);
  const original = system.agents[0];
  system.receiveDamage(original, original.health);
  room.simSeconds = 10; system.tick();
  const saved = JSON.parse(JSON.stringify(system.save()));
  const ids = system.agents.map(agent => agent.id);
  system = createCreatures(room, saved);
  room.simSeconds = 36000; system.tick();
  assert.deepEqual(system.agents.map(agent => agent.id), ids);
  assert.deepEqual(population(system, room), [0, 3]);
});

test("막힌 굴의 최초 배치 실패는 통로가 열린 뒤에도 재시도하지 않는다", () => {
  const room = environment();
  for (let y = 198; y <= 204; y++) for (let x = 127; x <= 133; x++) room.world.hazards[y * 320 + x] = 1;
  const system = createCreatures(room, null);
  assert.deepEqual(population(system, room), [0, 3]);
  room.world.hazards.fill(0);
  room.simSeconds = 36000; system.tick();
  assert.deepEqual(population(system, room), [0, 3]);
});

test("굴이 파괴된 저장 상태에서는 기존 개체를 남기고 추가 증식만 중단한다", () => {
  const room = environment(), original = createCreatures(room, null), saved = JSON.parse(JSON.stringify(original.save()));
  saved.burrows[0].health = 0;
  const system = createCreatures(room, saved), survivor = system.agents[0];
  room.simSeconds = 360; system.tick();
  assert.deepEqual(population(system, room), [1, 3]);
  assert.ok(system.agents.includes(survivor));
  system.receiveDamage(survivor, survivor.health);
  room.simSeconds = 480; system.tick();
  assert.deepEqual(population(system, room), [0, 3]);
});

test("이전 저장에서 상한보다 많은 생존 개체를 보존하고 빈자리 전에는 더 만들지 않는다", () => {
  const room = environment(), original = createCreatures(room, null).agents[0];
  const agents = Array.from({ length: 4 }, (_, index) => ({ ...original, id: "legacy:" + index, x: 130 + index, renderFromX: 130 + index }));
  const system = createCreatures(room, { version: 3, agents });
  assert.deepEqual(population(system, room), [4, 0]);
  room.simSeconds = 120; system.tick();
  assert.deepEqual(population(system, room), [4, 0]);
});

test("실제 월드를 저장·복원하고 스냅샷에서 소속 굴과 소모된 개체 수를 유지한다", () => {
  const room = createRoom("굴 저장 확인", 731047);
  room.simSeconds = 90; room.creatureSystem.tick();
  const saved = JSON.parse(JSON.stringify(saveRoom(room))), restored = restoreRoom(saved);
  assert.deepEqual(restored.creatureSystem.save(), room.creatureSystem.save());
  assert.equal(restored.world.generationVersion, room.world.generationVersion);
  assert.deepEqual(restored.world.burrows, room.world.burrows);
  assert.ok(restored.world.encounters.some(plan => plan.unique));
  const savedCounts = new Map(saved.creatures.burrows.map(record => [record.id,
    saved.creatures.agents.filter(agent => agent.health > 0 && agent.burrowId === record.id).length]));
  restored.simSeconds = 120; restored.creatureSystem.tick();
  for (const burrow of restored.world.burrows) {
    const count = restored.creatureSystem.agents.filter(agent => agent.species === "spiny-back-beetle" && agent.health > 0 && agent.burrowId === burrow.id).length;
    assert.equal(count, savedCounts.get(burrow.id), burrow.id);
  }
  const colony = restored.colonies[0], beetle = restored.creatureSystem.agents.find(agent => agent.species === "spiny-back-beetle");
  Object.assign(beetle, { x: colony.x + 2, y: colony.y + 3 });
  const packet = snapshotRoom(restored, true);
  assert.equal(packet.state.rivals.find(agent => agent.id === beetle.id).burrowId, beetle.burrowId);
  const broken = JSON.parse(JSON.stringify(saved)); broken.creatures.burrows[0].nextSpawnAt = null;
  assert.throws(() => restoreRoom(broken), /굴 저장 형식/);
});
