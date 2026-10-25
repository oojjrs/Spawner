import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function declaration(name) {
  const match = source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

function canvas() {
  let data;
  const surface = { width: 0, height: 0, draws: [], fills: [] };
  const context = {
    drawImage(...args) { surface.draws.push(args); data = new Uint8ClampedArray(surface.width * surface.height * 4).fill(255); },
    getImageData() { return { data }; },
    putImageData(pixels) { data = pixels.data; },
    clearRect() { surface.draws.length = 0; },
    fillRect(...args) { surface.fills.push(args); },
    save() {}, restore() {}
  };
  surface.getContext = () => context;
  surface.alpha = (x, y) => data[(y * surface.width + x) * 4 + 3];
  return surface;
}

function renderer() {
  const target = canvas(), cached = canvas();
  cached.width = cached.height = 48;
  const context = createContext({
    document: { createElement: canvas },
    hazardGroundSprites: [{ naturalWidth: 1024 }, { naturalWidth: 1024 }],
    hazardGroundTiles: new Map(), hazardCells: [], hazardCanvas: cached,
    WORLD_SIZE: 6, worldMap: { hazards: new Uint8Array(36) },
    ctx: target.getContext("2d"), objectOutlineColor: () => null,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value))
  });
  for (const name of ["hazardGroundTile", "drawHazardSelection", "drawHazard", "updateHazards", "drawHazards"])
    runInContext(declaration(name), context);
  return { context, target, cached };
}

function hazard(neighbors) {
  return { kind: 1, neighbors, tileColumn: 0, tileRow: 0 };
}

test("단독 위험 칸은 외곽만 흐려지고 연결된 칸의 내부 경계에는 빈 틈이 없다", () => {
  const { context } = renderer();
  const isolated = context.hazardGroundTile(hazard(0));
  assert.equal(isolated.alpha(32, 32), 255);
  for (const [x, y] of [[0, 32], [63, 32], [32, 0], [32, 63]]) assert.ok(isolated.alpha(x, y) < 5);
  const left = context.hazardGroundTile(hazard(16));
  const right = context.hazardGroundTile(hazard(8));
  assert.equal(left.alpha(63, 32), 255);
  assert.equal(right.alpha(0, 32), 255);
  const interior = context.hazardGroundTile(hazard(255));
  for (const [x, y] of [[0, 0], [63, 0], [0, 63], [63, 63]]) assert.equal(interior.alpha(x, y), 255);
});

test("오목한 구역 모서리는 부드럽게 비우되 대각선까지 채워진 내부는 유지한다", () => {
  const { context } = renderer();
  assert.ok(context.hazardGroundTile(hazard(2 | 8)).alpha(0, 0) < 5);
  assert.equal(context.hazardGroundTile(hazard(1 | 2 | 8)).alpha(0, 0), 255);
});

test("동일한 지형 조각은 캐시하고 인접한 칸은 연속된 원본 무늬를 읽는다", () => {
  const { context } = renderer();
  const first = { ...hazard(255), tileColumn: 1, tileRow: 2 };
  const tile = context.hazardGroundTile(first);
  assert.equal(context.hazardGroundTile(first), tile);
  assert.deepEqual(tile.draws[0].slice(1), [256, 512, 256, 256, 0, 0, 64, 64]);
  const next = context.hazardGroundTile({ ...first, tileColumn: 2 });
  assert.deepEqual(next.draws[0].slice(1), [512, 512, 256, 256, 0, 0, 64, 64]);
  assert.equal(context.hazardGroundTiles.size, 2);
});

test("연결과 무늬 좌표를 준비하고 위험 구역 자료를 변경하지 않는다", () => {
  const { context, cached } = renderer();
  for (const index of [7, 8, 9]) context.worldMap.hazards[index] = 1;
  context.worldMap.hazards[14] = 2;
  const before = Uint8Array.from(context.worldMap.hazards);
  context.updateHazards(7);
  const first = context.hazardCells[7], second = context.hazardCells[8];
  assert.equal(first.x, 1.5);
  assert.equal(first.y, 1.5);
  assert.ok(first.neighbors & 16);
  assert.ok(second.neighbors & 8);
  assert.equal(second.neighbors & 64, 0);
  assert.equal(second.tileColumn, (first.tileColumn + 1) % 4);
  assert.equal(second.tileRow, first.tileRow);
  assert.deepEqual(context.worldMap.hazards, before);
  assert.equal(cached.draws.length, 4);
  assert.ok(cached.draws.every(args => args[3] === 8 && args[4] === 8));
});

test("위험 표현은 칸 전체에 맞고 선택 시 재질을 중복해서 덧칠하지 않는다", () => {
  const { context, target } = renderer();
  context.drawHazard(context.ctx, hazard(255), 96, 160, 64);
  assert.deepEqual(target.draws[0].slice(1), [64, 128, 64, 64]);
  target.draws.length = 0;
  context.state = { camera: { zoom: 8 }, hover: { kind: "hazard", target: { ...hazard(255), x: 1.5, y: 1.5 } }, selection: null };
  context.viewport = { width: 32, height: 32 };
  context.screenToWorld = (x, y) => ({ x: x / 8, y: y / 8 });
  context.worldToScreen = (x, y) => ({ x: x * 8, y: y * 8 });
  context.clipExploredRegions = () => {};
  context.isSelectedObject = () => false;
  context.objectOutlineColor = () => "#ffffff";
  context.drawHazards();
  assert.equal(target.draws.length, 1);
  assert.deepEqual(target.fills[0], [8, 8, 8, 8]);
});
