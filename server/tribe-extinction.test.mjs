import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";

function workerGame() {
  const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
  const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const context = { Map, Set, Uint8Array, crypto, performance, structuredClone, setTimeout, clearTimeout };
  runInNewContext(worker.slice(0, worker.indexOf('modules["client/worker.mjs"]')) +
    'globalThis.createGame = modules["server/game.mjs"].createGame; })();', context);
  return context.createGame;
}

function fixture(create) {
  const colonies = ["bean", "spore", "pebble", "spring"].map((tribe, index) => ({
    id: index + 1, ownerId: tribe, tribe, x: 20 + index * 70, y: 20 + index * 70,
    occupiedCells: new Set(["2,2"])
  }));
  const room = { simSeconds: 0, hostId: "bean", colonies, games: new Map(), food: new Map(), foodSpots: new Map(),
    world: { seed: 13, size: 320, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) } };
  for (const colony of colonies) room.games.set(colony.ownerId, create(room, colony));
  for (const game of room.games.values()) game.prepare(0);
  const host = room.games.get(room.hostId);
  host.snapshot();
  return { room, host, enemy: room.games.get("spore") };
}

for (const [name, load] of [["source", () => createGame], ["worker", workerGame]]) {
  test(name + ": 시야에서 만난 종족은 떠난 뒤에도 이름을 공개하고 저장복원 후 중복 기록하지 않는다", () => {
    const create = load(), { room, host, enemy } = fixture(create);
    const agent = enemy.agents[0], origin = { x: agent.x, y: agent.y };
    Object.assign(agent, { x: 22, y: 24 });
    host.snapshot();
    Object.assign(agent, origin);
    host.snapshot();
    host.restore(host.save());
    enemy.receiveNestDamage(enemy.nest.health);
    host.checkEnding();
    const events = host.snapshot().tribeExtinctions;
    assert.equal(events.length, 1);
    assert.equal(events[0].tribe, "spore");
    const saved = host.save();
    const restored = create(room, room.colonies[0], saved);
    room.games.set(room.hostId, restored);
    restored.prepare(1);
    restored.checkEnding();
    assert.equal(JSON.stringify(restored.snapshot().tribeExtinctions), JSON.stringify(events));
  });

  test(name + ": 미조우 종족은 종족명과 좌표를 공개하지 않으며 나중에 봐도 알림은 익명이다", () => {
    const { host, enemy } = fixture(load());
    enemy.receiveNestDamage(enemy.nest.health);
    host.checkEnding();
    const event = host.snapshot().tribeExtinctions[0];
    assert.equal(event.tribe, null);
    assert.deepEqual(Object.keys(event).sort(), ["endedAt", "id", "tribe"]);
    Object.assign(enemy.agents[0], { x: 22, y: 24 });
    host.snapshot();
    host.checkEnding();
    assert.equal(host.snapshot().tribeExtinctions[0].tribe, null);
  });

  test(name + ": 구저장의 탐사한 둥지는 조우로 복원하고 회생 불가능한 AI 종족의 멸망도 알린다", () => {
    const { host, enemy, room } = fixture(load());
    const saved = JSON.parse(host.save());
    delete saved.state.knownTribes;
    delete saved.state.tribeExtinctions;
    const colony = room.colonies[1];
    saved.state.explored.entries.push((colony.y + 2) * 320 + colony.x + 2);
    host.restore(JSON.stringify(saved));
    const enemySaved = JSON.parse(enemy.save());
    enemySaved.state.agents = [];
    enemySaved.state.evolutionPoints = 0;
    enemy.restore(JSON.stringify(enemySaved));
    host.checkEnding();
    assert.equal(enemy.ending.reason, "extinction");
    assert.equal(host.snapshot().tribeExtinctions[0].tribe, "spore");
  });

  test(name + ": 동시 멸망한 세 AI 종족을 모두 알리고 조종 종족은 제외한다", () => {
    const { room, host } = fixture(load());
    for (const game of room.games.values()) game.receiveNestDamage(game.nest.health);
    host.checkEnding();
    const events = host.snapshot().tribeExtinctions;
    assert.equal(events.length, 3);
    assert.equal(new Set(events.map(entry => entry.id)).size, 3);
    assert.ok(events.every(entry => entry.tribe === null));
    assert.equal(host.ending.reason, "nest-destroyed");
    host.checkEnding();
    assert.equal(host.snapshot().tribeExtinctions.length, 3);
  });
}
