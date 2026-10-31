import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const renderer = source.match(/^    function updateForest\([^]*?^    }/m)[0];

function trees(version) {
  const worldMap = { generationVersion: version, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), treeCells: new Uint8Array(320 * 320), burrows: [] };
  worldMap.terrain[10] = 5; worldMap.terrain[20] = 6; worldMap.terrain[30] = 7; worldMap.terrain[40] = 5;
  worldMap.treeCells[10] = worldMap.treeCells[20] = worldMap.treeCells[30] = 1;
  const forest = { trees: [], cells: new Map(), bounds: Array.from({ length: 3 }, () => ({ left: .1, right: .9, top: .1, bottom: .9 })) };
  const context = { forest, worldMap, WORLD_SIZE: 320, hashNoise: () => .5, resetForestRendering() {},
    terrainAt: (x, y) => worldMap.terrain[y * 320 + x] === 5 ? "forest" : "lowMountain" };
  runInNewContext(renderer + "\nupdateForest(1, []);", context);
  return forest.trees.map(tree => tree.row * 320 + tree.column);
}

test("공통 지형의 숲은 산지에서도 목재 마스크와 일치한다", () => {
  assert.deepEqual(trees(32), [10, 20, 30]);
});

test("이전 생성 버전의 숲 표현은 유지한다", () => {
  assert.deepEqual(trees(31), [10]);
});
