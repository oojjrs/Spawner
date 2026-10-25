import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createContext, runInContext, runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import { RESOURCE_TYPES, resourceDefinition, populateResourceNodes, populateForestResources, resourceHarvestSeconds } from "../server/resources.mjs";
import { isTreeFood } from "../server/food.mjs";
import { createGame } from "../server/game.mjs";
import { generateMapWorld } from "../server/map.mjs";
import { createRoom, saveRoom, restoreRoom } from "./room.mjs";
import { RESOURCE_HARVEST_ANIMATIONS } from "./harvest-assets.mjs";
import { createHarvestPlayback, harvestPlaybackPose } from "./harvest.mjs";

test("기획서의 자원 원화·운반물과 실행 참조가 일치하고 삭제한 애니메이션은 등록하지 않는다", () => {
  const design = readFileSync(new URL("../Design.html", import.meta.url), "utf8");
  for (const definition of RESOURCE_TYPES) {
    const key = definition.key;
    const aliases = [key, key === "tree" ? "wood" : key === "honey-mushrooms" ? "basic-mushroom" : key];
    const row = aliases.map(alias => design.match(new RegExp('<tr data-resource="' + alias + '"[^>]*>[^]*?</tr>'))).find(Boolean);
    assert.ok(row, key);
    const sources = [...row[0].matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]);
    assert.equal(definition.image, sources[0], key + " original");
    assert.equal(definition.carryImage, sources[1], key + " carry");
    assert.ok(existsSync(definition.image));
    assert.ok(existsSync(definition.carryImage));
  }
  for (const key of ["meat", "carapace", "iron-ore", "copper-ore", "quartz"]) {
    assert.ok(RESOURCE_HARVEST_ANIMATIONS.every(animation => animation.resourceType !== key));
  }
  for (const animation of RESOURCE_HARVEST_ANIMATIONS) {
    const png = readFileSync(animation.image);
    assert.equal(png.readUInt32BE(16), animation.columns * animation.frameSize, animation.resourceType);
    assert.ok(png.readUInt32BE(20) >= Math.ceil(animation.frameCount / animation.columns) * animation.frameSize, animation.resourceType);
    if (animation.loopDurationsMs) assert.equal(animation.loopDurationsMs.length, animation.frameCount);
  }
});

test("살아 있는 목재 나무는 스냅샷마다 유지하고 소진한 나무만 지도와 축소 캐시에서 제거한다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const sync = source.match(/      foodCellMap.clear\(\);[^]*?      if \(forestChanged\) [^\r\n]+/)[0];
  const trees = [10, 11, 12].map(column => ({ column, row: 20 }));
  const forest = { trees, cells: new Map(trees.map(tree => [tree.column + ",20", tree])),
    revealed: new Map(trees.map(tree => [20 * 320 + tree.column, tree])) };
  const worldMap = { treeCells: new Uint8Array(320 * 320).fill(1) }, changed = [];
  const context = createContext({ forest, worldMap, WORLD_SIZE: 320, FOOD_REGION_SIZE: 18,
    Spawner: { isTreeFood }, foodCellMap: new Map(), foodSpotCache: new Map(),
    updateForestRegion: (x, y) => changed.push([x, y]),
    food: [{ x: 10, y: 20, resourceType: "tree", amount: 2 },
      { x: 11, y: 20, resourceType: "clay", amount: 12 },
      { x: 12, y: 20, kind: "corpse", resourceType: "meat", amount: 4 }] });
  runInContext("{" + sync + "}", context);
  assert.equal(forest.cells.has("10,20"), true);
  assert.equal(forest.cells.has("11,20"), false);
  assert.equal(forest.cells.has("12,20"), true);
  context.food[0].amount = 0;
  Object.assign(context.food[2], { key: "corpse:beetle", kind: "resource", resourceType: "carapace" });
  runInContext("{" + sync + "}", context);
  assert.equal(forest.cells.has("10,20"), false);
  assert.equal(forest.revealed.has(20 * 320 + 10), false);
  assert.equal(forest.cells.has("12,20"), true);
  assert.equal(worldMap.treeCells[20 * 320 + 10], 0);
  assert.deepEqual(changed, [[11, 20], [10, 20]]);
});

test("목재·자갈·이슬은 승인된 루프를 재생하고 정지하면 원화를 유지한다", () => {
  for (const key of ["tree", "pebbles", "dew"]) {
    const definition = RESOURCE_HARVEST_ANIMATIONS.find(animation => animation.resourceType === key);
    const cell = { x: 1, y: 2, resourceType: key, amount: 2 };
    const agent = { x: 1, y: 2, health: 12, mode: "harvest", harvestStarted: 10, carryingType: key };
    const playback = createHarvestPlayback();
    const first = harvestPlaybackPose(playback, cell, [agent], 11, definition);
    const motion = harvestPlaybackPose(playback, cell, [agent], 11.65, definition);
    assert.equal(first.frame, 0);
    assert.ok(motion.frame > 0 && motion.frame < 9);
    agent.mode = "return";
    const idle = harvestPlaybackPose(playback, cell, [agent], 12, definition);
    assert.equal(idle.frame, 0);
    assert.equal(idle.visible, true);
  }
});

function fixture(resourceType, amount, carapaceAmount) {
  const tribe = resourceType === "tree" ? "spore" : resourceType === "dew" ? "spring" : "bean";
  const colony = { id: 1, ownerId: "integration", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const key = resourceType === "meat" ? "corpse:beetle" : "46,42";
  const cell = { x: 46, y: 42, resourceType, amount, initialAmount: amount, carapaceAmount,
    ...(resourceType === "meat" ? { key, agentId: "beetle" } : {}),
    kind: resourceType === "meat" ? "corpse" : "resource", terrain: resourceType === "tree" ? "forest" : "grassland" };
  const environment = { simSeconds: 120, world: { seed: 13, generationVersion: 11,
    terrain: new Uint8Array(320 * 320).fill(resourceType === "tree" ? 5 : 4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map([[key, cell]]), foodSpots: new Map() };
  populateForestResources(environment);
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.agents.splice(1);
  Object.assign(saved.state.agents[0], { x: 46, y: 42, renderFromX: 46, renderFromY: 42, slots: ["strength"],
    carrying: 0, carryingType: null, birth: null, bornAt: 120, mode: "approach", moveStartedAt: 0,
    moveDuration: 0, moveBudget: 0, harvestResult: null, decisionPending: null, nextDecisionAt: 1000,
    utility: { action: "collect", target: { x: 46, y: 42, key }, route: [{ x: 46, y: 42 }], plannedCargo: 2 } });
  game.restore(JSON.stringify(saved));
  return { game, environment, cell, agent: game.agents[0] };
}

function advance(f, age) {
  const time = 120 + age, elapsed = time - f.environment.simSeconds;
  f.environment.simSeconds = time;
  f.game.prepare(time);
  f.game.tick(elapsed);
}

test("목재·이슬을 실제 수확하고 소진한 나무는 시야 정보와 지도에 잔량 0으로 전달한다", () => {
  for (const key of ["tree", "dew"]) {
    const f = fixture(key, 1, 0), seconds = resourceHarvestSeconds(key, f.environment.world);
    advance(f, 0);
    advance(f, 1);
    advance(f, 1 + seconds + .001);
    assert.equal(f.agent.carrying, 1, key);
    assert.equal(f.agent.carryingType, key);
    assert.equal(f.cell.amount, 0);
    if (key === "tree") {
      assert.equal(f.environment.world.treeCells[42 * 320 + 46], 0);
      assert.ok(f.environment.world.depletedTrees.has(42 * 320 + 46));
      assert.equal(f.game.snapshot().food.find(cell => cell.x === 46 && cell.y === 42).amount, 0);
    }
  }
});

test("딱정벌레 사체의 고기를 회수한 뒤 갑각을 별도 재료로 회수한다", () => {
  const f = fixture("meat", 1, 4);
  advance(f, 0); advance(f, 1); advance(f, 2.501);
  assert.equal(f.agent.carryingType, "meat");
  assert.equal(f.agent.carrying, 1);
  assert.equal(f.cell.resourceType, "carapace");
  assert.equal(f.cell.kind, "resource");
  assert.equal(f.cell.amount, 4);
  const shell = fixture("carapace", 1, 0);
  advance(shell, 0); advance(shell, 1); advance(shell, 3.001);
  assert.equal(shell.agent.carryingType, "carapace");
  assert.equal(shell.agent.carrying, 1);
  const saved = JSON.parse(shell.game.save());
  Object.assign(saved.state.agents[0], { x: 40, y: 40, renderFromX: 40, renderFromY: 40,
    mode: "unload", unloadReady: shell.environment.simSeconds, moveDuration: 0, returnPath: [],
    decisionPending: null, nextDecisionAt: 1000,
    utility: { action: "return", target: { x: 40, y: 40, key: "home" }, route: [{ x: 40, y: 40 }] } });
  shell.game.restore(JSON.stringify(saved));
  advance(shell, 3.002);
  assert.equal(shell.game.snapshot().resourceInventory.carapace, 1);
  assert.equal(shell.game.snapshot().evolutionPoints, 0);
});

test("이전 저장의 목재·이슬을 지형 이동 없이 추가하고 기존 노드와 소진 기록을 보존한다", () => {
  const terrain = new Uint8Array(320 * 320);
  for (const [x, type] of [[10, 5], [11, 4], [12, 5], [13, 5]]) terrain[10 * 320 + x] = type;
  const room = { resourceVersion: 1, colonies: [], world: { generationVersion: 8, terrain, hazards: new Uint8Array(320 * 320),
    resources: [], burrows: [], depletedTrees: new Set([10 * 320 + 13]) },
    food: new Map([["12,10", { x: 12, y: 10, resourceType: "clay", amount: 17 }]]) };
  const before = Uint8Array.from(terrain);
  populateResourceNodes(room);
  assert.equal(room.food.get("10,10").resourceType, "tree");
  assert.equal(room.food.get("11,10").resourceType, "dew");
  assert.equal(room.food.get("12,10").amount, 17);
  assert.equal(room.food.has("13,10"), false);
  assert.deepEqual(terrain, before);
});

test("소진 나무 위치를 저장·복원하고 같은 칸이 사체로 바뀌어도 나무를 되살리지 않는다", () => {
  const room = createRoom("목재 저장", 1669442258, "spore");
  const cell = [...room.food.values()].find(cell => cell.resourceType === "tree");
  const index = cell.y * 320 + cell.x;
  room.world.depletedTrees.add(index);
  room.food.set(cell.x + "," + cell.y, { ...cell, kind: "corpse", resourceType: "meat", amount: 4 });
  const restored = restoreRoom(saveRoom(room));
  assert.ok(restored.world.depletedTrees.has(index));
  assert.equal(restored.world.treeCells[index], 0);
});

test("기획서 미리보기와 실행 맵이 같은 최신 생성 로직을 사용한다", () => {
  const html = readFileSync(new URL("../Design.html", import.meta.url), "utf8");
  const context = {};
  runInNewContext(html.match(/<script id="design-world-model">([^]*?)<\/script>/)[1], context);
  const preview = context.SpawnerDesignWorld.generateWorld(1669442258);
  const runtime = generateMapWorld(1669442258);
  const hash = world => createHash("sha256").update(JSON.stringify([
    [...world.terrain], [...world.hazards], world.camps, world.food, world.resources, world.resourceAreas, world.economy
  ])).digest("hex");
  assert.equal(hash(runtime), hash(preview));
});
