import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./room.mjs", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");

function fixture() {
  const world = { seed: 7, size: 320, generationVersion: 15, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320), treeCells: new Uint8Array(320 * 320), sites: [[40, 40]], burrows: [], resources: [] };
  world.terrain[10] = 5;
  world.treeCells[10] = 1;
  const state = { agents: [], templates: [], evolutionPoints: 0, nestLevel: 1 };
  const room = { id: "room", title: "저장 복원", hostId: "host", seed: 7, world, simSeconds: 12, revision: 8, resourceVersion: 2,
    colonies: [{ id: 1, ownerId: "host", tribe: "bean", name: "둥지", x: 38, y: 38, occupiedCells: new Set(["2,2"]) }],
    food: new Map([["10,0", { x: 10, y: 0, resourceType: "tree", amount: 2 }]]),
    games: new Map([["host", { ending: null, save: () => JSON.stringify({ state }) }]]),
    creatureSystem: { save: () => ({ version: 5, agents: [] }) } };
  let generations = 0, forests = 0;
  const context = createContext({
    structuredClone, Uint8Array,
    generateWorld() { generations++; return structuredClone(world); },
    populateResourceNodes() {}, clearResourceHazards() {}, populateColonyFood() {},
    populateForestResources(room) { forests++; room.world.treeCells = new Uint8Array(world.treeCells); },
    createGame: () => ({ prepare() {}, restore() {}, checkEnding() {}, save: () => JSON.stringify({ state }) }),
    createCreatures: () => room.creatureSystem, PLAYER_TRIBES: [{ key: "bean" }]
  });
  runInContext(source, context);
  return { room, context, generations: () => generations, forests: () => forests };
}

test("확정 지형과 벌목 상태는 저장본 그대로 복원하고 생성기를 호출하지 않는다", () => {
  const client = fixture();
  client.room.world.terrain[20] = 9;
  client.room.world.depletedTrees = new Set([10]);
  client.room.food.get("10,0").amount = 0;
  const saved = structuredClone(client.context.saveRoom(client.room));
  const restored = client.context.restoreRoom(saved);
  assert.equal(client.generations(), 0);
  assert.equal(client.forests(), 0);
  assert.deepEqual(restored.world.terrain, client.room.world.terrain);
  assert.equal(restored.world.treeCells[10], 0);
  assert.equal(restored.world.depletedTrees.has(10), true);
  assert.equal(restored.food.get("10,0").amount, 0);
  restored.world.terrain[20] = 4;
  assert.equal(saved.world.terrain[20], 9);
});

test("이전 저장은 한 번 생성하여 변환한 다음부터 저장된 지형을 사용한다", () => {
  const client = fixture(), legacy = structuredClone(client.context.saveRoom(client.room));
  legacy.version = 1;
  delete legacy.world;
  const converted = client.context.restoreRoom(legacy);
  const saved = structuredClone(client.context.saveRoom(converted));
  assert.equal(saved.version, 2);
  client.context.restoreRoom(saved);
  assert.equal(client.generations(), 1);
  assert.equal(client.forests(), 1);
});

test("JSON 왕복 저장도 복원하고 손상된 새 지형을 시드로 덮어쓰지 않는다", () => {
  const client = fixture(), saved = JSON.parse(JSON.stringify(client.context.saveRoom(client.room)));
  assert.deepEqual(client.context.restoreRoom(saved).world.terrain, client.room.world.terrain);
  saved.world.terrain = [4];
  assert.throws(() => client.context.restoreRoom(saved), /지형 저장 형식/);
  assert.equal(client.generations(), 0);
});
