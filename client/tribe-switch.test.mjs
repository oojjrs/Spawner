import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createRoom, chooseRoomTribe, saveRoom, restoreRoom, snapshotRoom, commandRoom, tickRoom } from "./room.mjs";
import { productionRuntime } from "./production.mjs";
import { PLAYER_TRIBES } from "../server/player-tribes.mjs";
import { migrateAttributeSlots, migrateAttributeLevels } from "../server/attributes.mjs";
import { PLAYER_STARTING_POINTS } from "../server/tribe-start.mjs";

const switchTribe = (room, tribe) => commandRoom(room, { type: "cheat-switch-tribe", tribe });

test("종족을 왕복 전환해도 모든 군락의 진행과 개체 소유권을 유지한다", () => {
  const room = createRoom("전환 시험", 13, "bean", null);
  const originalOwner = room.hostId;
  const games = new Map(room.games);
  for (const [index, tribe] of PLAYER_TRIBES.entries()) {
    switchTribe(room, tribe.key);
    commandRoom(room, { type: "cheat-evolution-points" });
    for (let level = 0; level < index; level++) commandRoom(room, { type: "cheat-upgrade" });
    commandRoom(room, { type: "design", templateId: null, name: tribe.name + " 설계", slots: [], birth: true });
    const game = room.games.get(room.hostId);
    game.receiveNestDamage(index + 1);
    const agent = game.agents[0];
    agent.health -= index + 1;
    const packet = snapshotRoom(room, false);
    commandRoom(room, { type: "rename-colony", colonyId: packet.colonyId, name: tribe.name + " 저장 둥지" });
  }
  const before = new Map([...room.games].map(([owner, game]) => [owner, game.save()]));
  const colonies = structuredClone(room.colonies);
  const food = structuredClone([...room.food]);
  const creatures = structuredClone(room.creatureSystem.save());
  const world = room.world;
  for (const tribe of [...PLAYER_TRIBES, ...PLAYER_TRIBES.toReversed()]) {
    const previousRevision = room.revision;
    const colony = room.colonies.find(entry => entry.tribe === tribe.key);
    assert.deepEqual(switchTribe(room, tribe.key), { colonyId: colony.id });
    assert.equal(room.revision, previousRevision + 1);
    const packet = snapshotRoom(room, false);
    assert.equal(packet.colonyId, colony.id);
    assert.equal(packet.state.tribe, tribe.key);
    assert.deepEqual(packet.state.templates, JSON.parse(before.get(colony.ownerId)).state.templates.map(template => ({ ...template, tribe: tribe.key })));
    assert.ok(packet.state.templates.some(template => template.name === tribe.name + " 설계"));
    for (const [owner, game] of room.games) {
      assert.equal(game, games.get(owner));
      assert.equal(game.save(), before.get(owner));
      assert.ok(game.agents.every(agent => agent.ownerId === owner));
    }
    assert.deepEqual(room.colonies, colonies);
    assert.deepEqual([...room.food], food);
    assert.deepEqual(room.creatureSystem.save(), creatures);
    assert.equal(room.world, world);
  }
  assert.equal(room.hostId, originalOwner);
  assert.throws(() => switchTribe(room, "invalid"), /종족을 선택/);
  assert.equal(room.hostId, originalOwner);
  tickRoom(room, .1);
  for (const game of room.games.values()) assert.equal(game.snapshot().simSeconds, .1);
});

test("전환한 종족의 저장은 미지급 시작 지원금을 한 번만 적용하고 진행을 유지한다", () => {
  const room = createRoom("저장 전환", 13, "spring", null);
  const originalOwner = room.hostId;
  commandRoom(room, { type: "design", templateId: null, name: "샘방울 설계", slots: [], birth: false });
  switchTribe(room, "spore");
  commandRoom(room, { type: "cheat-evolution-points" });
  commandRoom(room, { type: "cheat-upgrade" });
  commandRoom(room, { type: "design", templateId: null, name: "포자 설계", slots: [], birth: true });
  const before = snapshotRoom(room, false);
  const saved = saveRoom(room);
  assert.equal(JSON.parse(saved.games.find(([owner]) => owner === saved.hostId)[1]).state.startingPointsGranted, false);
  const restored = restoreRoom(structuredClone(saved));
  const after = snapshotRoom(restored, false);
  assert.equal(after.state.tribe, "spore");
  assert.equal(after.colonyId, before.colonyId);
  assert.equal(after.state.evolutionPoints, before.state.evolutionPoints + PLAYER_STARTING_POINTS);
  assert.equal(JSON.parse(restored.games.get(restored.hostId).save()).state.startingPointsGranted, true);
  const reopened = restoreRoom(structuredClone(saveRoom(restored)));
  assert.equal(snapshotRoom(reopened, false).state.evolutionPoints, after.state.evolutionPoints);
  const templates = before.state.templates.map(template => ({ ...template,
    slots: migrateAttributeSlots(template.slots),
    attributeLevels: migrateAttributeLevels(template.slots, template.attributeLevels, before.state.nestLevel),
    unlockedAttributeLevels: migrateAttributeLevels(Object.keys(template.unlockedAttributeLevels), template.unlockedAttributeLevels, before.state.nestLevel) }));
  assert.deepEqual(after.state.templates, templates);
  for (const key of ["resourceInventory", "nestLevel", "nestHealth", "explored", "discoveries"])
    assert.deepEqual(after.state[key], before.state[key]);
  assert.deepEqual(after.state.agents.map(agent => agent.id), before.state.agents.map(agent => agent.id));
  switchTribe(restored, "spring");
  assert.equal(restored.hostId, originalOwner);
  assert.ok(snapshotRoom(restored, false).state.templates.some(template => template.name === "샘방울 설계"));
  const legacy = saveRoom(createRoom("기존 저장", 13, "pebble", null));
  delete legacy.cheats;
  const oldRoom = restoreRoom(legacy);
  switchTribe(oldRoom, "bean");
  assert.equal(snapshotRoom(oldRoom, false).state.tribe, "bean");
});

test("멸망한 군락에서도 다른 종족으로 전환하고 돌아올 수 있다", () => {
  const room = createRoom("멸망 전환", 13, "pebble", null);
  commandRoom(room, { type: "cheat-extinction" });
  const ending = snapshotRoom(room, false).state.ending;
  switchTribe(room, "spring");
  assert.equal(snapshotRoom(room, false).state.ending, null);
  tickRoom(room, .25);
  assert.equal(room.simSeconds, .25);
  switchTribe(room, "pebble");
  assert.deepEqual(snapshotRoom(room, false).state.ending, ending);
  switchTribe(room, "bean");
  assert.equal(snapshotRoom(room, false).state.tribe, "bean");
  const unchosen = createRoom("선택 전", 13, null, null);
  assert.throws(() => switchTribe(unchosen, "bean"), /부족을 먼저 선택/);
});

test("프로덕션에서는 저장 설정과 직접 명령으로도 종족을 전환할 수 없다", () => {
  const development = readFileSync(new URL("./runtime.js", import.meta.url), "utf8");
  assert.ok(development.includes("cheat-switch-tribe"));
  const production = productionRuntime(development);
  for (const marker of ["cheat-switch-tribe", "cheat-tribe-", "cheat-tribes", "종족 전환", "room.hostId = colony.ownerId"])
    assert.equal(production.includes(marker), false, marker);
  const browser = createContext({});
  runInContext(production, browser);
  assert.equal(browser.Spawner.createCheats({ createElement() { assert.fail("프로덕션 치트 UI"); } }, null), null);
  const worker = JSON.parse(production.match(/^const workerSource = (.+);$/m)[1]);
  const context = createContext({ crypto, structuredClone, Uint8Array, navigator: {}, self: {}, setInterval() {} });
  runInContext(worker.slice(0, worker.lastIndexOf("})();")) + 'globalThis.model = modules["client/room.mjs"];})();', context);
  const model = context.model;
  for (const room of [model.createRoom("프로덕션", 13, "bean", null),
    model.restoreRoom(structuredClone(saveRoom(createRoom("개발 저장", 13, "spring", null, true))))]) {
    room.cheats = true;
    const owner = room.hostId;
    const before = [...room.games].map(([key, game]) => [key, game.save()]);
    assert.throws(() => model.commandRoom(room, { type: "cheat-switch-tribe", tribe: "spore" }), /지원하지 않는 요청/);
    assert.throws(() => model.chooseRoomTribe(room, "spore"), /바꿀 수 없습니다/);
    assert.equal(room.hostId, owner);
    assert.deepEqual([...room.games].map(([key, game]) => [key, game.save()]), before);
  }
});
