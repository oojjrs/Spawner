import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCreatures } from "./creatures.mjs";
import { BEETLE_ANIMATIONS } from "./beetle-animation.mjs";
import { createGame } from "./game.mjs";
import { generateWorld } from "./world.mjs";
import { createRoom, saveRoom, restoreRoom, snapshotRoom } from "../client/room.mjs";

const attack = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/spiny-back-beetle-attack.json", import.meta.url), "utf8"));

function environment() {
  return { seed: 7, simSeconds: 0, world: { seed: 7, sites: [[100, 100]], terrain: new Uint8Array(320 * 320).fill(4), creatureDensity: new Uint8Array(320 * 320).fill(255),
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
  const victim = { id: "1:1", x: 141, y: 140, health: 12, moveStartedAt: 0, moveDuration: 0 };
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
  assert.equal(beetle.moveDuration, 1.28);
  room.simSeconds += 1.28;
  system.tick();
  assert.equal(beetle.mode, "idle");
});

test("턱이 닫히는 프레임에서 한 번만 피해를 주고 공격을 마친다", () => {
  const { room, beetle, victim, hits } = encounter();
  room.creatureSystem.tick();
  assert.equal(beetle.mode, "attack");
  const health = victim.health;
  room.simSeconds = attack.hitTimeMs / 1000 - 0.001;
  room.creatureSystem.tick();
  assert.equal(victim.health, health);
  room.simSeconds = attack.hitTimeMs / 1000;
  room.creatureSystem.tick();
  room.creatureSystem.tick();
  assert.equal(hits.length, 1);
  assert.equal(victim.health, health - beetle.stats.attack);
  room.simSeconds = attack.durationMs / 1000;
  room.creatureSystem.tick();
  assert.equal(beetle.mode, "idle");
});

test("공격 준비 중 사거리에서 벗어난 개체는 맞지 않는다", () => {
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
  assert.equal(corpses[0].amount, 4);
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
  const positions = [[139, 140], [140, 139], [141, 140]];
  const actions = new Set();
  for (let index = 0; index < count; index++) {
    game.command({ type: "design", templateId: null, name: "기본 콩 " + index, slots: [], birth: true });
    const [x, y] = positions[index];
    Object.assign(game.agents[index], { x, y, renderFromX: x, renderFromY: y,
      personality: Object.freeze({ boldness: 0.2, aggression: 0.2, curiosity: 0.2 }) });
  }
  for (let step = 1; step <= 600 && beetle.health > 0 && game.agents.length > 0; step++) {
    room.simSeconds = step / 10;
    game.prepare(room.simSeconds);
    game.tick(0.1);
    for (const agent of game.agents) actions.add(agent.utility?.action);
    room.creatureSystem.tick();
  }
  return { beetle, agents: game.agents, duration: room.simSeconds, actions };
}

test("신중한 개체는 이득이 낮은 강적과 강제 교전하지 않고 생존한다", () => {
  for (const count of [1, 2, 3]) {
    const result = fight(count);
    assert.equal(result.agents.length, count);
    assert.equal(result.beetle.health, result.beetle.stats.health);
    assert.ok(result.agents.every(agent => agent.health > 0));
    assert.ok(!result.actions.has("fight"));
    if (count === 1) assert.ok(result.actions.has("flee"));
  }
});

test("밀도 대신 생성된 굴을 개체 생성 기준으로 삼고 월드 안전 거리를 지킨다", () => {
  const empty = environment();
  empty.world.burrows = [];
  assert.equal(createCreatures(empty, null).agents.length, 0);
  const room = environment();
  room.world = generateWorld(7);
  const system = createCreatures(room, null);
  assert.ok(system.agents.length > 0);
  for (const agent of system.agents) {
    assert.ok(room.world.burrows.some(burrow => burrow.id === agent.burrowId));
    assert.ok(room.world.sites.every(site => Math.hypot(agent.x - site[0], agent.y - site[1]) >= 26));
  }
  for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) {
    if (room.world.sites.some(site => Math.hypot(x - site[0], y - site[1]) < 26)) assert.equal(room.world.creatureDensity[y * 320 + x], 0);
  }
  assert.deepEqual(createCreatures(room, null).save(), system.save());
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

test("작은 굴 120초·큰 굴 60초 주기로 한 마리씩 늘고 각 상한 3·6마리를 지킨다", () => {
  const room = environment(), system = createCreatures(room, null);
  assert.deepEqual(population(system, room), [1, 3]);
  for (const [time, counts] of [[59.999, [1, 3]], [60, [1, 4]], [119.999, [1, 4]], [120, [2, 5]], [180, [2, 6]], [240, [3, 6]], [3600, [3, 6]]]) {
    room.simSeconds = time; system.tick();
    assert.deepEqual(population(system, room), counts, String(time));
  }
});

test("굴에서 멀리 나간 개체도 생존 상한에 포함하며 상한 중 지난 회차를 쌓아 두지 않는다", () => {
  const room = environment(), system = createCreatures(room, null);
  room.simSeconds = 360; system.tick();
  const small = system.agents.filter(agent => agent.burrowId === room.world.burrows[0].id);
  for (const [index, agent] of small.entries()) Object.assign(agent, { x: 280 + index, y: 280, renderFromX: 280 + index, renderFromY: 280 });
  room.simSeconds = 480; system.tick();
  assert.deepEqual(population(system, room), [3, 6]);
  system.receiveDamage(small[0], 100);
  room.simSeconds = 480.1; system.tick();
  assert.deepEqual(population(system, room), [2, 6]);
  room.simSeconds = 600; system.tick();
  assert.deepEqual(population(system, room), [3, 6]);
});

test("전멸해도 굴이 남으면 다음 회차에 한 마리씩 다시 생성한다", () => {
  const room = environment(), system = createCreatures(room, null);
  for (const agent of system.agents) system.receiveDamage(agent, 100);
  room.simSeconds = 59.99; system.tick();
  assert.deepEqual(population(system, room), [0, 0]);
  room.simSeconds = 60; system.tick();
  assert.deepEqual(population(system, room), [0, 1]);
  room.simSeconds = 120; system.tick();
  assert.deepEqual(population(system, room), [1, 2]);
});

test("저장·복원으로 증식 시각이 초기화되지 않고 새 개체 식별자를 재사용하지 않는다", () => {
  const room = environment(); let system = createCreatures(room, null);
  room.simSeconds = 60; system.tick();
  const ids = new Set(system.agents.map(agent => agent.id));
  room.simSeconds = 90;
  const saved = JSON.parse(JSON.stringify(system.save()));
  system = createCreatures(room, saved);
  assert.deepEqual(system.save(), saved);
  room.simSeconds = 119.99; system.tick();
  assert.deepEqual(population(system, room), [1, 4]);
  room.simSeconds = 120; system.tick();
  assert.deepEqual(population(system, room), [2, 5]);
  const newer = system.agents.filter(agent => !ids.has(agent.id));
  assert.equal(newer.length, 2);
  for (const agent of system.agents) system.receiveDamage(agent, 100);
  room.simSeconds = 240; system.tick();
  assert.ok(system.agents.every(agent => !ids.has(agent.id) && !newer.some(previous => previous.id === agent.id)));
});

test("입구 주변이 막히면 겹쳐 생성하지 않고 빈 칸이 생긴 다음 회차에 증식한다", () => {
  const room = environment(), system = createCreatures(room, null), burrow = room.world.burrows[0];
  for (let y = 198; y <= 204; y++) for (let x = 127; x <= 133; x++) room.world.hazards[y * 320 + x] = 1;
  room.simSeconds = 120; system.tick();
  assert.deepEqual(population(system, room), [1, 5]);
  room.world.hazards.fill(0);
  room.simSeconds = 240; system.tick();
  assert.deepEqual(population(system, room), [2, 6]);
  const births = system.agents.filter(agent => agent.burrowId === burrow.id);
  assert.equal(new Set(births.map(agent => agent.x + "," + agent.y)).size, births.length);
});

test("굴이 파괴된 저장 상태에서는 기존 개체를 남기고 추가 증식만 중단한다", () => {
  const room = environment(), original = createCreatures(room, null), saved = JSON.parse(JSON.stringify(original.save()));
  saved.burrows[0].health = 0;
  const system = createCreatures(room, saved), survivor = system.agents[0];
  room.simSeconds = 360; system.tick();
  assert.deepEqual(population(system, room), [1, 6]);
  assert.ok(system.agents.includes(survivor));
  system.receiveDamage(survivor, 100);
  room.simSeconds = 480; system.tick();
  assert.deepEqual(population(system, room), [0, 6]);
});

test("이전 저장에서 상한보다 많은 생존 개체를 보존하고 빈자리 전에는 더 만들지 않는다", () => {
  const room = environment(), original = createCreatures(room, null).agents[0];
  const agents = Array.from({ length: 4 }, (_, index) => ({ ...original, id: "legacy:" + index, x: 130 + index, renderFromX: 130 + index }));
  const system = createCreatures(room, { version: 3, agents });
  assert.deepEqual(population(system, room), [4, 0]);
  room.simSeconds = 120; system.tick();
  assert.deepEqual(population(system, room), [4, 2]);
});

test("실제 월드를 저장·복원하고 스냅샷에서 소속 굴을 유지하며 증식을 이어간다", () => {
  const room = createRoom("굴 저장 확인", 731047);
  room.simSeconds = 90; room.creatureSystem.tick();
  const saved = JSON.parse(JSON.stringify(saveRoom(room))), restored = restoreRoom(saved);
  assert.deepEqual(restored.creatureSystem.save(), room.creatureSystem.save());
  restored.simSeconds = 120; restored.creatureSystem.tick();
  for (const burrow of restored.world.burrows) {
    const count = restored.creatureSystem.agents.filter(agent => agent.health > 0 && agent.burrowId === burrow.id).length;
    assert.equal(count, burrow.type === "small" ? 2 : 5);
  }
  const colony = restored.colonies[0], beetle = restored.creatureSystem.agents[0];
  Object.assign(beetle, { x: colony.x + 2, y: colony.y + 3 });
  const packet = snapshotRoom(restored, true);
  assert.equal(packet.state.rivals.find(agent => agent.id === beetle.id).burrowId, beetle.burrowId);
  const broken = JSON.parse(JSON.stringify(saved)); broken.creatures.burrows[0].nextSpawnAt = null;
  assert.throws(() => restoreRoom(broken), /굴 저장 형식/);
});
