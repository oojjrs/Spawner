import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function declaration(name) {
  const match = source.match(new RegExp("^    (?:async )?function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

function bitmap(pixel) {
  return { width: 1, height: 1, pixel, closed: false, close() { this.closed = true; } };
}

function storage() {
  const maps = new Map();
  let clock = 0;
  return {
    maps, now: () => ++clock,
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction() {
            let pending = 0;
            function request(result) {
              pending++;
              const request = { result };
              queueMicrotask(() => {
                request.onsuccess?.();
                pending--;
                if (!pending) queueMicrotask(() => { if (!pending) transaction.oncomplete(); });
              });
              return request;
            }
            const transaction = {
              objectStore: () => ({
                get: key => request(maps.get(key)),
                getAll: () => request([...maps.values()]),
                put: value => request(maps.set(value.key, structuredClone(value))),
                delete: key => request(maps.delete(key))
              })
            };
            return transaction;
          }
        };
        request.onsuccess();
      });
      return request;
    }
  };
}

function session(database, assets) {
  const stats = { terrain: 0, trees: [], requests: [], statuses: [], regions: [], placements: 0, hazards: 0, grounds: 0 };
  const rendering = {
    types: new Uint8Array(320 * 320), edges: new Uint8Array(320 * 320), slots: new Int32Array(320 * 320),
    colors: Array.from({ length: 10 }, () => [0, 0, 0]), grounds: new Map(), atlases: [],
    overview: null, medium: new Map(), forest: new Map(), key: null, forestKeys: new Map(), resolution: 64,
    revealed: new Uint8Array(320 * 320), regions: new Set()
  };
  const forest = {
    trees: [], cells: new Map(), revealed: new Map(), regions: new Set(), steps: new Map(), shakes: new Map(), overrides: new Map(), cacheWrite: Promise.resolve(), cacheKey: null,
    sprite: { ...bitmap(assets.tree), decode: async () => {} }
  };
  const worldMap = {};
  async function decode(value) {
    if (value.broken) throw new Error("Invalid cached image");
    return bitmap(value.pixel);
  }
  class Canvas {
    constructor() {
      let pixel = 0;
      this.context = {
        drawImage: image => { pixel = image.pixel; },
        getImageData: () => ({ data: Uint8Array.of(pixel) }),
        putImageData() {}, fillRect() {}, translate() {}, clearRect() {}
      };
    }
    getContext() { return this.context; }
    async convertToBlob() { return new Blob(["image"]); }
    toBlob(action) {
      if (assets.encode) assets.encode(action);
      else queueMicrotask(() => action(new Blob(["live image"])));
    }
    transferToImageBitmap() { return bitmap(0); }
  }
  class Worker {
    constructor() {
      let cached = false;
      this.context = createContext({
        self: {}, Blob, Uint8Array, crypto: webcrypto, indexedDB: database, OffscreenCanvas: Canvas,
        URL, createImageBitmap: decode, Date: { now: database.now },
        ImageData: class { constructor(data) { this.data = data; } },
        createTerrainPatch: () => { stats.terrain++; return { colors: {} }; },
        createTerrainSamples() {}, buildTerrainAtlas() {},
        drawForestTree: (context, tree) => stats.trees.push(tree.column),
        postMessage: message => {
          if (message.type === "status") cached = message.cached;
          if (message.type === "forest") stats.regions.push({ index: message.index, cached });
          this.onmessage({ data: message });
        }
      });
      runInContext(declaration("buildTerrainImages") + "\nbuildTerrainImages();", this.context);
    }
    postMessage(data) {
      stats.requests.push({ layer: data.layer, key: data.key, regions: data.regions?.map(region => region.index) });
      this.context.self.onmessage({ data }).catch(error => this.onerror({ message: error.message }));
    }
    terminate() {}
  }
  const context = createContext({
    WORLD_SIZE: 320, COLONY_SIZE: 5, TERRAIN_TYPES: Array.from({ length: 10 }, (value, index) => index),
    worldMap, terrainRendering: rendering, forest,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    grassGround: { decode: async () => {} }, terrainGrounds: {},
    terrainGroundPixels: () => { stats.grounds++; return Uint8Array.of(assets.ground); },
    terrainWorkerSource: "worker", Blob, Worker, URL, createImageBitmap: decode,
    indexedDB: database, Date: { now: database.now }, document: { createElement: () => new Canvas() },
    drawForestTree() {}, treeOverlapsColony: () => false,
    hazardCells: [], hazardGroundTiles: new Map(), hazardCanvas: new Canvas(), connectionStatus: {}, Path2D: class {},
    foodCellMap: new Map(), foodSpotCache: new Map(), FOOD_REGION_SIZE: 16,
    Spawner: { isTreeFood: () => false, renderingAssets: assets.manifest ? { terrain: "ground:" + assets.ground, forest: "tree:" + assets.tree, hazards: "hazards" } : null },
    updateForest() {
      stats.placements++;
      forest.trees = [];
      forest.cells.clear();
      forest.overrides.clear();
      for (let index = 0; index < worldMap.treeCells.length; index++) {
        if (worldMap.treeCells[index]) {
          const column = index % 320, row = Math.floor(index / 320);
          const tree = { column, row, x: column + 0.5, y: row + 0.9, height: 0.8, ...assets.positions?.[index] };
          forest.trees.push(tree);
          forest.cells.set(column + "," + row, tree);
        }
      }
    },
    updateHazards() { stats.hazards++; }, updateRoomCreationProgress() {}, welcomeStatus: {},
    setEvolutionText: (element, text) => stats.statuses.push(text)
  });
  for (const name of ["updateTerrainRendering", "forestTreeRegions", "forestRegionKey", "forestImageRegions",
    "openRenderingStorage", "worldRenderingKey", "worldRenderingMatches", "readWorldRendering", "restoreWorldRendering",
    "worldRenderingRecord", "saveWorldRendering", "reportRenderingCacheError", "resetForestRendering",
    "prepareWorldRendering", "saveForestRegion", "updateForestRegion"]) runInContext(declaration(name), context);
  const snapshotStart = source.indexOf("      let forestChanged = false;");
  const snapshotEnd = source.indexOf("      if (selection) {", snapshotStart);
  assert.ok(snapshotStart >= 0 && snapshotEnd > snapshotStart);
  const snapshot = source.slice(snapshotStart, snapshotEnd);
  return {
    stats, rendering, forest, prepare: (world, colonies) => context.prepareWorldRendering(world, colonies),
    flush: () => forest.cacheWrite,
    cut(map, index) {
      map.treeCells[index] = 0;
      context.food = [{ x: index % 320, y: Math.floor(index / 320), resourceType: "tree", amount: 0 }];
      runInContext("(function () {" + snapshot + "})();", context);
    }
  };
}

function world() {
  const treeCells = new Uint8Array(320 * 320);
  treeCells[10] = treeCells[20] = 1;
  return { seed: 7, terrain: new Uint8Array(320 * 320).fill(5), treeCells, resourceCells: [] };
}

test("같은 페이지에서는 벌목 구역 하나만 생성하고 바닥과 나머지 숲 이미지를 유지한다", async () => {
  const client = session(storage(), { ground: 1, tree: 1 });
  const map = world();
  await client.prepare(map, []);
  const overview = client.rendering.overview;
  const medium = client.rendering.medium.get(0);
  const images = new Map(client.rendering.forest);
  client.stats.requests.length = 0;
  client.stats.regions.length = 0;
  map.treeCells[10] = 0;
  await client.prepare(map, []);
  assert.deepEqual(client.stats.requests.map(request => request.layer), ["forest"]);
  assert.strictEqual(client.rendering.overview, overview);
  assert.strictEqual(client.rendering.medium.get(0), medium);
  assert.equal(overview.closed, false);
  assert.equal(client.stats.terrain, 1);
  assert.deepEqual(client.stats.trees, [10, 20]);
  assert.deepEqual(client.stats.regions, [{ index: 0, cached: false }]);
  assert.deepEqual(Array.from(client.stats.requests[0].regions), [0]);
  assert.equal(images.get(0).closed, true);
  for (let index = 1; index < 400; index++) {
    assert.strictEqual(client.rendering.forest.get(index), images.get(index));
    assert.equal(images.get(index).closed, false);
  }
  client.stats.requests.length = 0;
  await client.prepare(map, []);
  assert.equal(client.stats.requests.length, 0);
});

test("새로고침 후에는 벌목 구역 하나만 생성하고 나머지 399구역과 바닥을 불러온다", async () => {
  const database = storage();
  const map = world();
  const first = session(database, { ground: 1, tree: 1 });
  await first.prepare(map, []);
  assert.ok(first.stats.statuses.includes("고정 지형 이미지 생성 중…"));
  assert.ok(first.stats.statuses.includes("숲 이미지 생성 중…"));
  map.treeCells[10] = 0;
  const resumed = session(database, { ground: 1, tree: 1 });
  await resumed.prepare(map, []);
  assert.equal(resumed.stats.terrain, 0);
  assert.equal(resumed.stats.trees.length, 0);
  assert.deepEqual(resumed.stats.regions.filter(region => !region.cached), [{ index: 0, cached: false }]);
  assert.equal(resumed.stats.regions.filter(region => region.cached).length, 399);
  assert.ok(resumed.stats.statuses.includes("고정 지형 이미지 불러오는 중…"));
  assert.equal(resumed.stats.statuses.includes("고정 지형 이미지 생성 중…"), false);
  assert.ok(resumed.stats.statuses.includes("숲 이미지 생성 중…"));
  const unchanged = session(database, { ground: 1, tree: 1 });
  await unchanged.prepare(map, []);
  assert.equal(unchanged.stats.terrain, 0);
  assert.equal(unchanged.stats.trees.length, 0);
  assert.equal(unchanged.stats.statuses.some(text => text.includes("생성 중")), false);
  assert.ok(unchanged.stats.statuses.includes("숲 이미지 불러오는 중…"));
  assert.equal(unchanged.stats.regions.filter(region => region.cached).length, 400);
});

test("숲 이미지 변경과 캐시 정리가 바닥 캐시에 영향을 주지 않고 바닥 텍스처 변경도 숲을 유지한다", async () => {
  const database = storage();
  const map = world();
  await session(database, { ground: 1, tree: 1 }).prepare(map, []);
  for (const tree of [2, 3, 4]) {
    const changed = session(database, { ground: 1, tree });
    await changed.prepare(map, []);
    assert.equal(changed.stats.terrain, 0);
    assert.deepEqual(changed.stats.trees, [10, 20]);
  }
  assert.equal([...database.maps.values()].filter(map => map.layer === "terrain").length, 1);
  assert.equal([...database.maps.values()].filter(map => map.layer === "forest").length, 4);
  const changed = session(database, { ground: 2, tree: 4 });
  await changed.prepare(map, []);
  assert.equal(changed.stats.terrain, 1);
  assert.equal(changed.stats.trees.length, 0);
});

test("숲 캐시가 손상되면 해당 구역만 다시 생성하고 나머지 캐시는 불러온다", async () => {
  const database = storage();
  const map = world();
  await session(database, { ground: 1, tree: 1 }).prepare(map, []);
  const cached = [...database.maps.values()].find(map => map.layer === "forest");
  cached.records[0].image.broken = true;
  const resumed = session(database, { ground: 1, tree: 1 });
  await resumed.prepare(map, []);
  assert.equal(resumed.stats.terrain, 0);
  assert.deepEqual(resumed.stats.trees, [10]);
  assert.deepEqual(resumed.stats.regions.filter(region => !region.cached), [{ index: 0, cached: false }]);
  assert.equal(resumed.stats.regions.filter(region => region.cached).length, 399);
  assert.ok(resumed.stats.statuses.includes("숲 이미지 불러오는 중…"));
  assert.ok(resumed.stats.statuses.includes("숲 이미지 생성 중…"));
});

test("경계에 걸친 나무를 베면 이미지가 겹친 네 구역만 갱신한다", async () => {
  const map = world();
  map.treeCells.fill(0);
  const index = 15 * 320 + 15;
  map.treeCells[index] = 1;
  const client = session(storage(), { ground: 1, tree: 1, positions: { [index]: { x: 16, y: 16, height: 1 } } });
  await client.prepare(map, []);
  const images = new Map(client.rendering.forest);
  client.stats.regions.length = 0;
  map.treeCells[index] = 0;
  await client.prepare(map, []);
  assert.deepEqual(client.stats.regions.map(region => region.index).sort((a, b) => a - b), [0, 1, 20, 21]);
  for (const [index, image] of images) {
    if ([0, 1, 20, 21].includes(index)) assert.equal(image.closed, true);
    else assert.strictEqual(client.rendering.forest.get(index), image);
  }
});

test("시드 0의 원점 나무를 베어도 빈 구역으로 바뀐 사실을 감지한다", async () => {
  const map = world();
  map.seed = 0;
  map.treeCells.fill(0);
  map.treeCells[0] = 1;
  const client = session(storage(), { ground: 1, tree: 1 });
  await client.prepare(map, []);
  client.stats.regions.length = 0;
  map.treeCells[0] = 0;
  await client.prepare(map, []);
  assert.deepEqual(client.stats.regions, [{ index: 0, cached: false }]);
});

test("플레이 중 벌목 이미지를 저장한 뒤 바로 이어해도 같은 페이지와 새 페이지에서 재생성하지 않는다", async () => {
  const database = storage(), encodes = [];
  const map = world();
  const client = session(database, { ground: 1, tree: 1, encode: action => encodes.push(action) });
  await client.prepare(map, []);
  const unchanged = client.rendering.forest.get(1);
  client.stats.requests.length = 0;
  client.cut(map, 10);
  const updated = client.rendering.forest.get(0);
  const entering = client.prepare(map, []);
  assert.equal(encodes.length, 1);
  encodes[0](new Blob(["cut region"]));
  await entering;
  assert.equal(client.stats.requests.length, 0);
  assert.strictEqual(client.rendering.forest.get(0), updated);
  assert.strictEqual(client.rendering.forest.get(1), unchanged);
  const resumed = session(database, { ground: 1, tree: 1 });
  await resumed.prepare(map, []);
  assert.equal(resumed.stats.terrain, 0);
  assert.equal(resumed.stats.regions.filter(region => region.cached).length, 400);
  assert.equal(resumed.stats.regions.filter(region => !region.cached).length, 0);
});

test("연속 벌목의 이미지 변환이 역순으로 끝나도 마지막 상태와 다른 구역의 변경이 모두 저장된다", async () => {
  const database = storage(), encodes = [];
  const map = world();
  map.treeCells[11] = 1;
  const client = session(database, { ground: 1, tree: 1, encode: action => encodes.push(action) });
  await client.prepare(map, []);
  client.cut(map, 10);
  client.cut(map, 11);
  client.cut(map, 20);
  assert.equal(encodes.length, 3);
  encodes[2](new Blob(["other region"]));
  encodes[1](new Blob(["latest state"]));
  encodes[0](new Blob(["old state"]));
  await client.flush();
  const cached = [...database.maps.values()].find(map => map.layer === "forest");
  assert.equal(await cached.records.find(record => record.index === 0).image.text(), "latest state");
  assert.equal(await cached.records.find(record => record.index === 1).image.text(), "other region");
  const resumed = session(database, { ground: 1, tree: 1 });
  await resumed.prepare(map, []);
  assert.equal(resumed.stats.regions.filter(region => region.cached).length, 400);
  assert.equal(resumed.stats.regions.filter(region => !region.cached).length, 0);
});

test("플레이 중 경계의 나무를 베면 인접 네 구역을 저장하여 새로고침 후 모두 캐시를 불러온다", async () => {
  const database = storage();
  const map = world();
  map.treeCells.fill(0);
  const index = 15 * 320 + 15;
  map.treeCells[index] = 1;
  const assets = { ground: 1, tree: 1, positions: { [index]: { x: 16, y: 16, height: 1 } } };
  const client = session(database, assets);
  await client.prepare(map, []);
  const images = new Map(client.rendering.forest);
  client.cut(map, index);
  await client.flush();
  for (const [index, image] of images) {
    if ([0, 1, 20, 21].includes(index)) assert.equal(image.closed, true);
    else assert.strictEqual(client.rendering.forest.get(index), image);
  }
  const resumed = session(database, assets);
  await resumed.prepare(map, []);
  assert.equal(resumed.stats.regions.filter(region => region.cached).length, 400);
  assert.equal(resumed.stats.regions.filter(region => !region.cached).length, 0);
});

test("새 페이지에서는 저장된 배치와 경계를 읽고 지형·숲 생성 및 원본 픽셀 읽기를 건너뛴다", async () => {
  const database = storage(), map = world(), assets = { ground: 1, tree: 1, manifest: true };
  map.roomId = "first";
  const first = session(database, assets);
  await first.prepare(map, []);
  first.cut(map, 10);
  await first.flush();
  const resumed = session(database, assets);
  await resumed.prepare(map, []);
  assert.equal(resumed.stats.terrain, 0);
  assert.equal(resumed.stats.trees.length, 0);
  assert.equal(resumed.stats.placements, 0);
  assert.equal(resumed.stats.hazards, 0);
  assert.equal(resumed.stats.grounds, 0);
  assert.equal(resumed.stats.statuses.some(text => text.includes("생성 중")), false);
  assert.equal(resumed.stats.regions.filter(region => region.cached).length, 400);
  assert.equal(resumed.forest.trees.length, 1);
  await resumed.prepare(map, []);
  await resumed.prepare(map, []);
  assert.equal(resumed.forest.trees.length, 1);
  assert.equal(resumed.forest.cells.has("20,0"), true);
});

test("세 개 이상의 방과 자산 캐시를 보관해도 먼저 만든 방을 다시 생성하지 않는다", async () => {
  const database = storage(), assets = { ground: 1, tree: 1, manifest: true };
  for (let index = 0; index < 4; index++) {
    const map = world();
    map.seed = index;
    map.roomId = "room:" + index;
    await session(database, assets).prepare(map, []);
  }
  for (const layer of ["terrain", "forest", "world"]) {
    assert.equal([...database.maps.values()].filter(map => map.layer === layer).length, 4);
  }
  const map = world();
  map.seed = 0;
  map.roomId = "room:0";
  const resumed = session(database, assets);
  await resumed.prepare(map, []);
  assert.equal(resumed.stats.terrain + resumed.stats.placements + resumed.stats.hazards + resumed.stats.grounds, 0);
  assert.equal(resumed.stats.statuses.some(text => text.includes("생성 중")), false);
});

test("이미지 저장보다 최신인 월드 변경은 감지하고 변경된 숲 구역만 복구한다", async () => {
  const database = storage(), map = world(), assets = { ground: 1, tree: 1, manifest: true };
  await session(database, assets).prepare(map, []);
  map.treeCells[10] = 0;
  const resumed = session(database, assets);
  await resumed.prepare(map, []);
  assert.equal(resumed.stats.terrain, 0);
  assert.deepEqual(resumed.stats.regions.filter(region => !region.cached), [{ index: 0, cached: false }]);
  const next = session(database, assets);
  await next.prepare(map, []);
  assert.equal(next.stats.placements + next.stats.hazards + next.stats.grounds, 0);
  assert.equal(next.stats.statuses.some(text => text.includes("생성 중")), false);
});

test("경계 벌목의 이미지가 일부만 저장돼도 이전 나무 이미지가 되살아나지 않는다", async () => {
  const database = storage(), map = world(), assets = { ground: 1, tree: 1, manifest: true };
  map.treeCells.fill(0);
  const index = 15 * 320 + 15;
  map.treeCells[index] = 1;
  assets.positions = { [index]: { x: 16, y: 16, height: 1 } };
  const client = session(database, assets);
  await client.prepare(map, []);
  const encodes = [];
  assets.encode = action => encodes.push(action);
  client.cut(map, index);
  assert.equal(encodes.length, 4);
  encodes[0](new Blob(["first region"]));
  await new Promise(resolve => setImmediate(resolve));
  const interrupted = storage();
  for (const [key, record] of database.maps) interrupted.maps.set(key, structuredClone(record));
  for (const encode of encodes.slice(1)) encode(new Blob(["remaining region"]));
  await client.flush();
  const resumed = session(interrupted, { ...assets, encode: null });
  await resumed.prepare(map, []);
  assert.equal(resumed.stats.placements, 0);
  assert.deepEqual(resumed.stats.regions.filter(region => !region.cached).map(region => region.index).sort((a, b) => a - b), [1, 20, 21]);
});
