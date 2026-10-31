import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { createRoom, chooseRoomTribe, saveRoom, restoreRoom, snapshotRoom, commandRoom, tickRoom } from "./room.mjs";
import { prepareSite } from "../hosting/prepare-site.mjs";

test("개발판 치트는 새 방과 기존 저장의 치트 설정에 관계없이 사용할 수 있다", () => {
  const normal = createRoom("개발 방", 13, "bean", null);
  const points = snapshotRoom(normal, false).state.evolutionPoints;
  commandRoom(normal, { type: "cheat-evolution-points" });
  assert.equal(snapshotRoom(normal, false).state.evolutionPoints, points + 10000);
  const saved = saveRoom(normal);
  for (const enabled of [false, undefined]) {
    if (enabled === undefined) delete saved.cheats;
    else saved.cheats = enabled;
    const restored = restoreRoom(saved);
    commandRoom(restored, { type: "cheat-evolution-points" });
    assert.equal(snapshotRoom(restored, false).state.evolutionPoints, points + 20000);
  }
  const room = createRoom("부족 선택 전", 13, null, null);
  assert.throws(() => commandRoom(room, { type: "cheat-evolution-points" }), /부족을 먼저 선택/);
  chooseRoomTribe(room, "spring");
  const initial = snapshotRoom(room, false).state.evolutionPoints;
  commandRoom(room, { type: "cheat-evolution-points" });
  assert.equal(snapshotRoom(room, false).state.evolutionPoints, initial + 10000);
});

test("멸망 치트는 탄생 중인 유닛까지 같은 시점에 사망시키고 다른 종족과 야생 생물을 보존한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const room = createRoom("멸망 시험", 13, tribe, null, true);
    const game = room.games.get(room.hostId);
    const data = JSON.parse(game.save());
    data.state.evolutionPoints = 100;
    game.restore(JSON.stringify(data));
    commandRoom(room, { type: "design", templateId: null, name: "탄생 중", slots: [], birth: true });
    const ids = game.agents.map(agent => agent.id);
    const health = game.nest.health;
    const others = [...room.games].filter(([owner]) => owner !== room.hostId).map(([, entry]) => entry.save());
    const creatures = room.creatureSystem.save();
    commandRoom(room, { type: "cheat-extinction" });
    const packet = snapshotRoom(room, false);
    assert.equal(game.agents.length, 0);
    assert.equal(packet.state.ending.reason, "extinction");
    assert.equal(packet.state.ending.endedAt, room.simSeconds);
    assert.equal(packet.state.evolutionPoints, 0);
    assert.equal(game.nest.health, health);
    const corpses = [...room.food.values()].filter(cell => cell.kind === "corpse" && ids.includes(cell.agentId));
    assert.equal(corpses.length, ids.length);
    assert.ok(corpses.every(cell => cell.diedAt === room.simSeconds));
    assert.deepEqual([...room.games].filter(([owner]) => owner !== room.hostId).map(([, entry]) => entry.save()), others);
    assert.deepEqual(room.creatureSystem.save(), creatures);
    const report = packet.state.ending;
    tickRoom(room, 10);
    assert.deepEqual(snapshotRoom(restoreRoom(saveRoom(room)), false).state.ending, report);
    assert.throws(() => commandRoom(room, { type: "cheat-extinction" }), /둘러보기/);
  }
});

test("개발·배포 구분은 빌드에서만 처리하고 배포판은 치트 UI와 실행 코드를 포함하지 않는다", () => {
  const destination = new URL("../$Trash/cheats-production/", import.meta.url);
  mkdirSync(new URL(".openai/", destination), { recursive: true });
  writeFileSync(new URL(".openai/hosting.json", destination), readFileSync(new URL("../.openai/hosting.json", import.meta.url)));
  const runtime = readFileSync(new URL("./runtime.js", import.meta.url), "utf8");
  assert.equal(runtime.includes("DEVELOPMENT"), false);
  assert.ok(runtime.includes("cheat-extinction"));
  assert.equal(runtime.includes("room-cheats"), false);
  prepareSite(fileURLToPath(destination), name => Buffer.from(name === "Spawner.html" ?
    '<script src="./client/runtime.js"></script>' : runtime), "cheats-test");
  const production = readFileSync(new URL("dist/client/runtime.js", destination), "utf8");
  assert.equal(production.includes("DEVELOPMENT"), false);
  for (const ui of ["치트 활성화", 'checkbox.id = "room-cheats"', 'panel.id = "cheat-panel"', "cheat-evolution-points", "cheat-resources", "cheat-upgrade", "cheat-heal", "cheat-extinction"]) {
    assert.equal(production.includes(ui), false);
  }
  const browser = createContext({});
  runInContext(production, browser);
  const document = { createElement() { assert.fail("배포판은 치트 UI를 생성하면 안 된다"); } };
  assert.equal(browser.Spawner.createCheats(document, null), null);
  const worker = JSON.parse(production.match(/^const workerSource = (.+);$/m)[1]);
  function workerModel(source) {
    const context = createContext({ crypto, structuredClone, Uint8Array, navigator: {}, self: {}, setInterval() {} });
    runInContext(source.slice(0, source.lastIndexOf("})();")) + 'globalThis.roomModel = modules["client/room.mjs"];})();', context);
    return context.roomModel;
  }
  const model = workerModel(worker);
  const room = model.createRoom("배포 방", 13, "bean", null);
  assert.equal(room.cheats, false);
  room.cheats = true;
  const before = room.games.get(room.hostId).save();
  assert.throws(() => model.commandRoom(room, { type: "cheat-extinction" }), /지원하지 않는 요청/);
  assert.equal(room.games.get(room.hostId).save(), before);
  const saved = model.saveRoom(room);
  saved.cheats = true;
  const restored = model.restoreRoom(saved);
  assert.equal(model.snapshotRoom(restored, false).cheats, true);
  assert.throws(() => model.commandRoom(restored, { type: "cheat-extinction" }), /지원하지 않는 요청/);
});
