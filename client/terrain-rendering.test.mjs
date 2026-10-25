import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const types = ["deep", "shallow", "coast", "land", "grassland", "forest", "lowMountain", "highMountain", "ridge", "swamp"];

function declaration(name) {
  const match = source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

function renderer() {
  const terrainRendering = {
    types: new Uint8Array(320 * 320), edges: new Uint8Array(320 * 320), slots: new Int32Array(320 * 320),
    grounds: new Map(), atlases: [], overview: null, forest: new Map(), medium: new Map()
  };
  const images = Object.fromEntries(types.map((type, index) => [type, { complete: true, naturalWidth: 1024, value: index }]));
  const context = createContext({
    WORLD_SIZE: 320, TERRAIN_TYPES: types, worldMap: { terrain: new Uint8Array(320 * 320).fill(4) },
    terrainRendering, grassGround: images.grassland, terrainGrounds: images,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    document: { createElement: () => {
      let image;
      return { getContext: () => ({ drawImage(value) { image = value; }, getImageData: () => ({ data: Uint8Array.of(image.value) }) }) };
    } },
    ImageData: class {
      constructor(width, height) { this.data = new Uint8ClampedArray(width * height * 4); }
    }
  });
  for (const name of ["updateTerrainRendering", "terrainGroundPixels", "createTerrainSamples", "createTerrainPatch"])
    runInContext(declaration(name), context);
  return context;
}

test("숲과 늪을 고유 지형으로 유지하고 초원과의 경계를 생성한다", () => {
  const render = renderer();
  const forest = 160 * 320 + 160, swamp = forest + 1;
  render.worldMap.terrain[forest] = 5;
  render.worldMap.terrain[swamp] = 9;
  render.updateTerrainRendering(7);
  assert.equal(render.terrainRendering.types[forest], 5);
  assert.equal(render.terrainRendering.types[swamp], 9);
  for (const index of [forest - 1, forest, swamp, swamp + 1]) assert.equal(render.terrainRendering.edges[index], 1);
  assert.equal(render.terrainRendering.edges[0], 0);
});

test("숲과 늪의 바닥은 각각의 이미지에서 읽고 캐시한다", () => {
  const render = renderer();
  assert.equal(render.terrainGroundPixels(4)[0], 4);
  assert.equal(render.terrainGroundPixels(5)[0], 5);
  assert.equal(render.terrainGroundPixels(9)[0], 9);
  assert.equal(render.terrainGroundPixels(5), render.terrainGroundPixels(5));
});

test("모든 지형 45조합의 가로·세로 경계에서 색상과 텍스처가 충분한 폭으로 섞인다", () => {
  const render = renderer();
  const black = new Uint8ClampedArray(384 * 384 * 4), white = new Uint8ClampedArray(384 * 384 * 4).fill(255);
  for (let offset = 3; offset < black.length; offset += 4) black[offset] = 255;
  const samples = new Map();
  for (let first = 0; first < types.length; first++) for (let second = first + 1; second < types.length; second++) {
    for (const vertical of [false, true]) {
      const terrain = new Uint8Array(320 * 320);
      for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) terrain[y * 320 + x] = (vertical ? y : x) < 160 ? first : second;
      const rendering = { types: terrain, phase: 0.091, samples,
        colors: types.map((type, index) => index === first ? [0, 0, 0] : [255, 255, 255]),
        grounds: types.map((type, index) => index === first ? black : white) };
      const patch = render.createTerrainPatch(rendering, vertical ? 160 : 159, vertical ? 159 : 160, vertical ? 1 : 2, vertical ? 2 : 1, 64, true);
      assert.deepEqual(patch.texture.data, patch.colors.data);
      const line = Array.from({ length: 128 }, (value, index) => patch.colors.data[(vertical ? index * 64 + 32 : 32 * 128 + index) * 4]);
      assert.equal(line[0], 0);
      assert.equal(line.at(-1), 255);
      assert.ok(line.filter(value => value > 0 && value < 255).length >= 22, types[first] + "/" + types[second]);
    }
  }
});

test("분할한 경계 패치와 연속 패치의 픽셀이 같고 맵 가장자리에도 빈 픽셀이 없다", () => {
  const render = renderer();
  const terrain = new Uint8Array(320 * 320);
  for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) terrain[y * 320 + x] = (x + y) % 10;
  const rendering = { types: terrain, phase: 1.3, samples: new Map(), grounds: [],
    colors: types.map((type, index) => [index * 23, 255 - index * 19, index * 11]) };
  const combined = render.createTerrainPatch(rendering, 159, 160, 2, 1, 32, false).colors.data;
  for (let part = 0; part < 2; part++) {
    const separate = render.createTerrainPatch(rendering, 159 + part, 160, 1, 1, 32, false).colors.data;
    for (let row = 0; row < 32; row++) assert.deepEqual(separate.slice(row * 128, (row + 1) * 128), combined.slice(row * 256 + part * 128, row * 256 + (part + 1) * 128));
  }
  for (const coordinate of [0, 319]) {
    const pixels = render.createTerrainPatch(rendering, coordinate, coordinate, 1, 1, 32, false).colors.data;
    for (let offset = 3; offset < pixels.length; offset += 4) assert.equal(pixels[offset], 255);
  }
});
