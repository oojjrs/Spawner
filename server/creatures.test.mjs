import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCreatures } from "./creatures.mjs";
import { createGame } from "./game.mjs";
import { generateWorld } from "./world.mjs";

const attack = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/spiny-back-beetle-attack.json", import.meta.url), "utf8"));

function environment() {
  return { seed: 7, simSeconds: 0, world: { seed: 7, sites: [[100, 100]], terrain: new Uint8Array(320 * 320).fill(4), creatureDensity: new Uint8Array(320 * 320).fill(255) },
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

test("둥지에서 떨어진 통행 가능한 위치에 중복 없이 생성한다", () => {
  const room = environment();
  room.world.sites.push([130, 130], [160, 160]);
  const system = createCreatures(room, null);
  assert.ok(system.agents.length > room.world.sites.length * 3);
  assert.equal(new Set(system.agents.map(agent => agent.x + "," + agent.y)).size, system.agents.length);
  assert.equal(new Set(system.agents.map(agent => agent.id)).size, system.agents.length);
  assert.ok(system.agents.some(agent => room.world.sites.every(site => Math.hypot(agent.x - site[0], agent.y - site[1]) > 80)));
  for (const agent of system.agents) {
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

test("몹 밀도 0인 지역에는 생성하지 않고 별도 노이즈맵의 안전 거리를 지킨다", () => {
  const empty = environment();
  empty.world.creatureDensity.fill(0);
  assert.equal(createCreatures(empty, null).agents.length, 0);
  const room = environment();
  room.world = generateWorld(7);
  const system = createCreatures(room, null);
  assert.ok(system.agents.length > 0);
  for (const agent of system.agents) {
    assert.ok(room.world.creatureDensity[agent.y * 320 + agent.x] > 0);
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
  assert.equal(system.save().version, 3);
  assert.ok(system.agents.length > 1);
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

test("같은 면적에서 노이즈 밀도가 높은 지역에 여러 마리가 더 많이 생성된다", () => {
  const room = environment();
  room.world.creatureDensity.fill(0);
  for (let y = 180; y < 260; y++) for (let offset = 0; offset < 80; offset++) {
    room.world.creatureDensity[y * 320 + 40 + offset] = 96;
    room.world.creatureDensity[y * 320 + 200 + offset] = 224;
  }
  const system = createCreatures(room, null);
  const sparse = system.agents.filter(agent => agent.x < 160);
  const dense = system.agents.filter(agent => agent.x >= 160);
  assert.ok(dense.length > 1);
  assert.ok(dense.length > sparse.length * 2);
  for (const agent of system.agents) {
    assert.ok(room.world.creatureDensity[agent.y * 320 + agent.x] > 0);
    for (const other of system.agents) if (agent !== other) assert.ok(Math.hypot(agent.x - other.x, agent.y - other.y) >= 6);
  }
});

test("기존 방에는 한 번만 추가하며 저장·복원과 전멸 뒤에 재생성하지 않는다", () => {
  const room = environment();
  const original = loneCreature(room);
  original.health = 7;
  const system = createCreatures(room, { version: 2, agents: [original] });
  assert.ok(system.agents.length > 1);
  assert.equal(system.agents.find(agent => agent.id === original.id).health, 7);
  const saved = JSON.parse(JSON.stringify(system.save()));
  saved.agents.splice(1, 1);
  const restored = createCreatures(room, saved);
  assert.deepEqual(restored.save(), saved);
  assert.equal(createCreatures(room, { version: 2, agents: [] }).agents.length, 0);
  assert.equal(createCreatures(room, { version: 3, agents: [] }).agents.length, 0);
});
