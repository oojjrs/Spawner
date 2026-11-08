import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createCombat } from "./combat.mjs";
import { createGame } from "./game.mjs";
import { RESOURCE_TYPES, dropCarriedResources, populateForestResources } from "./resources.mjs";
import { saveRoom, restoreRoom } from "../client/room.mjs";
import { createHarvestPlayback, syncHarvestPlayback } from "../client/harvest.mjs";
import { createPebbleBirthRuntime } from "../client/pebble-birth-runtime.mjs";

function unit(id, ownerId, disposition, type) {
  return { id, ownerId, combatDisposition: disposition, tribe: "bean", x: 46, y: 42,
    moveStartedAt: 0, moveDuration: 0, health: 100, attributes: {},
    stats: { health: 100, attack: 1, speed: 1, vision: 4 }, carrying: 2, carryingType: type,
    transportCargo: { siteId: "site" }, transport: { phase: "deliver" }, transportReadyAt: 10 };
}

test("전투에 걸린 운반자와 증원은 모든 자원을 그 셀에 보존하고 빈손으로 싸운다", () => {
  for (const definition of RESOURCE_TYPES) {
    const attacker = unit("attacker", "enemy", "aggressive", definition.key);
    const worker = unit("worker", "home", "passive", definition.key);
    const ally = unit("ally", "home", "passive", definition.key);
    const original = { x: 46, y: 42, resourceType: "tree", amount: 50 };
    const corpse = { key: "corpse:old", x: 46, y: 42, kind: "corpse", amount: 3 };
    const room = { food: new Map([["46,42", original], [corpse.key, corpse]]), foodSpots: new Map(),
      world: { size: 160 }, colonies: [], games: new Map([
        ["home", { agents: [worker, ally] }], ["enemy", { agents: [attacker] }]]) };
    const combat = createCombat(room);
    assert.equal(combat.engage(attacker, worker, 0), true);
    const key = "drop:" + definition.key + ":46,42";
    assert.equal(room.food.get(key).amount, 6, definition.key);
    assert.equal(room.food.get("46,42"), original);
    assert.equal(room.food.get(corpse.key), corpse);
    for (const agent of [attacker, worker, ally]) {
      assert.equal(agent.carrying, 0);
      assert.equal(agent.carryingType, null);
      assert.equal(agent.transportCargo, undefined);
      assert.equal(agent.transport, undefined);
      assert.equal(agent.transportReadyAt, undefined);
      assert.equal(agent.mode, "fight");
      dropCarriedResources(room, agent);
    }
    assert.equal(room.food.get(key).amount, 6);
    assert.equal(room.foodSpots.get("2,2").cells.length, 1);
  }
});

function fixture(tribe = "bean") {
  const colony = { id: 1, ownerId: "home", tribe, name: "둥지", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const room = { id: "drops", title: "자원 회수", hostId: "home", seed: 7, simSeconds: 10, resourceVersion: 3,
    world: { seed: 7, size: 160, generationVersion: 20, sites: [[42, 42]], burrows: [], resources: [], encounters: [],
      terrain: new Uint8Array(160 * 160).fill(4), hazards: new Uint8Array(160 * 160), treeCells: new Uint8Array(160 * 160) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map(),
    creatureSystem: { agents: [], burrows: [], save: () => ({ version: 5, agents: [], burrows: [], raidCooldowns: [] }) } };
  const game = createGame(room, colony);
  room.games.set("home", game);
  return { room, game };
}

test("내려놓은 서로 다른 자원은 저장·복원 후에도 수량과 위치를 유지하고 나무를 생성하지 않는다", () => {
  const { room } = fixture();
  for (const type of ["tree", "clay", "dew"]) dropCarriedResources(room, unit(type, "home", "passive", type));
  const restored = restoreRoom(structuredClone(saveRoom(room)));
  for (const type of ["tree", "clay", "dew"]) {
    const cell = restored.food.get("drop:" + type + ":46,42");
    assert.equal(cell.amount, 2);
    assert.deepEqual([cell.x, cell.y], [46, 42]);
    assert.equal(cell.dropped, true);
    assert.ok(restored.games.get("home").snapshot().food.some(food => food.key === cell.key));
  }
  populateForestResources(restored);
  assert.equal(restored.world.treeCells[42 * 160 + 46], 0);
});

test("도구 없는 포자 일꾼도 내려놓은 목재를 회수하며 같은 셀의 나무와 벌목 연출을 건드리지 않는다", () => {
  const { room, game } = fixture("spore");
  const tree = { x: 46, y: 42, resourceType: "tree", kind: "resource", amount: 50, initialAmount: 50 };
  room.food.set("46,42", tree);
  room.world.treeCells[42 * 160 + 46] = 1;
  const carrier = unit("carrier", "home", "passive", "tree");
  carrier.carrying = 1;
  dropCarriedResources(room, carrier);
  const key = "drop:tree:46,42";
  const saved = JSON.parse(game.save());
  saved.state.agents.splice(1);
  Object.assign(saved.state.agents[0], { x: 46, y: 42, renderFromX: 46, renderFromY: 42, slots: [],
    carrying: 0, carryingType: null, birth: null, bornAt: 10, mode: "approach", moveStartedAt: 0,
    moveDuration: 0, moveBudget: 0, decisionPending: null, nextDecisionAt: 1000,
    utility: { action: "collect", target: { x: 46, y: 42, key }, route: [{ x: 46, y: 42 }], plannedCargo: 1 } });
  game.restore(JSON.stringify(saved));
  for (const time of [10, 11, 20]) {
    const elapsed = time - room.simSeconds;
    room.simSeconds = time;
    game.prepare(time);
    game.tick(elapsed);
  }
  const agent = game.agents[0];
  assert.equal(agent.carrying, 1);
  assert.equal(agent.carryingType, "tree");
  assert.equal(room.food.has(key), false);
  assert.equal(tree.amount, 50);
  assert.equal(room.world.treeCells[42 * 160 + 46], 1);
  assert.equal(room.world.depletedTrees?.has(42 * 160 + 46) || false, false);
  const playback = createHarvestPlayback();
  syncHarvestPlayback(playback, [agent], 20, false);
  assert.equal(playback.effects.size, 0);
});

test("실제 그리기 경로는 바닥 자원을 전투 먼지와 전투 뒤 유닛보다 먼저 그린다", () => {
  const source = readFileSync(new URL("../client/game.js", import.meta.url), "utf8");
  const declarations = ["drawDroppedResource", "drawWorldObjects", "drawCombatDust"].map(name => {
    const match = source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
    assert.ok(match, name);
    return match[0];
  }).join("\n");
  for (const mode of ["combat", "idle", "selected"]) {
    const draws = [];
    const agent = { x: 5, y: 5, combat: mode === "combat" ? { id: "battle", x: 5, y: 5 } : null };
    const cell = { x: 5, y: 5, resourceType: "tree", dropped: true, amount: 2 };
    const pebbleBirthRuntime = createPebbleBirthRuntime({
      source: path => path,
      image: () => assert.fail("a non-birth frame must not load birth images"),
      createCanvas: () => assert.fail("a non-birth frame must not allocate birth canvases")
    });
    const context = createContext({
      state: { agents: [agent], rivals: [], simSeconds: 0, camera: { zoom: 64 }, visible: new Set([5 * 160 + 5]),
        selection: mode === "selected" ? { kind: "agent" } : null },
      pebbleBirthRuntime, displayedAgent: value => value,
      combatGroups: () => new Map(mode === "combat" ? [["battle", [agent]]] : []), idleMotion: { matches: true },
      viewport: { width: 640, height: 640 }, WORLD_SIZE: 160, AGENT_HEIGHT: .4,
      screenToWorld: (x, y) => ({ x: x / 64, y: y / 64 }), worldToScreen: (x, y) => ({ x: x * 64, y: y * 64 }),
      colonyEntries: [], worldMap: { burrows: [] }, forest: { revealed: new Map() },
      resourceCarrySprites: new Map([["tree", { complete: true, naturalWidth: 100, naturalHeight: 100 }]]),
      resourceCarryBounds: new Map([["tree", { x: 0, y: 0, width: 100, height: 100 }]]),
      foodHarvestStarts: () => new Map(), selectedMovementAgents: () => [],
      agentRenderCandidates: () => [agent], visibleAgents: () => [agent], interpolatedAgentPosition: value => value,
      agentBirthPose: () => null, resourceNodeCells: () => [cell], objectOutlineColor: () => null,
      drawGroundShadow() {}, drawCorpses() {}, drawSelectedAgentMovement() {}, drawAgent: () => draws.push("unit"),
      ctx: { save() {}, restore() {}, drawImage: () => draws.push("drop"),
        beginPath() {}, ellipse() {}, arc() {}, translate() {}, scale() {},
        createRadialGradient: () => ({ addColorStop() {} }), fill: () => draws.push("dust") }
    });
    runInContext(declarations + "\ndrawWorldObjects(0); drawCombatDust();", context);
    if (mode === "combat") {
      assert.deepEqual(draws.slice(0, 2), ["drop", "drop"]);
      assert.ok(draws.length > 2);
      assert.ok(draws.slice(2).every(draw => draw === "dust"));
    } else assert.deepEqual(draws, ["drop", "drop", "unit"], mode);
  }
});
