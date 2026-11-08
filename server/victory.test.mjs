import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as source from "../client/room.mjs";

let savedWorld;

function fixture(api, tribe) {
  if (!savedWorld) savedWorld = source.saveRoom(source.createRoom("승리", 13, null, null));
  const room = api.restoreRoom(structuredClone(savedWorld));
  if (tribe !== null) api.chooseRoomTribe(room, tribe);
  return room;
}

function bundledRoom() {
  const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
  const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const context = { Map, Set, Uint8Array, crypto, performance, structuredClone, setTimeout, clearTimeout };
  runInNewContext(worker.slice(0, worker.indexOf('modules["client/worker.mjs"]')) +
    'globalThis.room = modules["client/room.mjs"]; })();', context);
  return context.room;
}

for (const [name, load] of [["source", () => source], ["worker", bundledRoom]]) {
  test(name + ": 네 종족 모두 마지막 상대 멸망 때만 승리하고 중립과 자신의 생존 상태를 보존한다", () => {
    const api = load();
    for (const tribe of ["bean", "spore", "pebble", "spring"]) {
      const room = fixture(api, tribe);
      const host = room.games.get(room.hostId);
      const enemies = [...room.games].filter(([owner]) => owner !== room.hostId).map(([, game]) => game);
      const neutrals = JSON.stringify(room.creatureSystem.save());
      const agents = JSON.stringify(host.agents);
      for (const enemy of enemies) {
        assert.equal(host.checkEnding(), null);
        enemy.receiveNestDamage(enemy.nest.health);
      }
      const report = host.checkEnding();
      assert.equal(report.reason, "victory", tribe);
      assert.equal(JSON.stringify(host.agents), agents);
      assert.equal(JSON.stringify(room.creatureSystem.save()), neutrals);
      assert.ok(enemies.every(game => game.ending.reason === "nest-destroyed"));
      const restored = api.restoreRoom(api.saveRoom(room));
      const saved = JSON.stringify(restored.games.get(restored.hostId).ending);
      api.tickRoom(restored, 20);
      assert.equal(JSON.stringify(restored.games.get(restored.hostId).ending), saved);
      assert.equal(restored.simSeconds, report.endedAt);
      assert.throws(() => api.commandRoom(restored, { type: "cheat-upgrade" }), /둘러보기/);
    }
  });

  test(name + ": 승리 치트는 모든 상대 종족을 멸망시키고 승리 보고서를 즉시 만든다", () => {
    const api = load();
    const room = fixture(api, "spring");
    const host = room.games.get(room.hostId);
    const own = JSON.stringify(host.agents);
    const neutrals = JSON.stringify(room.creatureSystem.save());
    api.commandRoom(room, { type: "cheat-victory" });
    assert.equal(host.ending.reason, "victory");
    assert.equal(JSON.stringify(host.agents), own);
    assert.equal(JSON.stringify(room.creatureSystem.save()), neutrals);
    for (const [owner, game] of room.games) {
      if (owner === room.hostId) continue;
      assert.equal(game.nest.health, 0);
      assert.equal(game.agents.length, 0);
      assert.ok(game.ending);
    }
    assert.equal(api.snapshotRoom(room, false).state.ending.reason, "victory");
    assert.equal(api.saveRoom(room).ending.reason, "victory");
  });
}

test("상대가 회생할 수 있으면 승리하지 않고 회생 수단까지 사라지면 승리한다", () => {
  const room = fixture(source, "bean");
  const enemies = [...room.games].filter(([owner]) => owner !== room.hostId).map(([, game]) => game);
  for (const enemy of enemies.slice(1)) enemy.receiveNestDamage(enemy.nest.health);
  const last = enemies[0];
  const data = JSON.parse(last.save());
  data.state.agents = [];
  data.state.evolutionPoints = 3;
  last.restore(JSON.stringify(data));
  assert.equal(room.games.get(room.hostId).checkEnding(), null);
  data.state.evolutionPoints = 0;
  last.restore(JSON.stringify(data));
  source.tickRoom(room, .1);
  assert.equal(last.ending.reason, "extinction");
  assert.equal(room.games.get(room.hostId).ending.reason, "victory");
});

test("종족 선택 전과 자기 종족도 함께 멸망한 상태에서는 승리하지 않는다", () => {
  const room = fixture(source, null);
  assert.equal(room.games.get(room.hostId).checkEnding(), null);
  assert.throws(() => source.commandRoom(room, { type: "cheat-victory" }), /먼저 선택/);
  source.chooseRoomTribe(room, "pebble");
  for (const game of room.games.values()) game.receiveNestDamage(game.nest.health);
  source.tickRoom(room, .1);
  assert.equal(room.games.get(room.hostId).ending.reason, "nest-destroyed");
});
