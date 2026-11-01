import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

function fixture() {
  let reads = 0;
  const context = createContext({ createTribeAttributeAnimation: () => ({}), document: {
    createElement() {
      return { width: 0, height: 0, getContext() {
        return { drawImage() {}, getImageData(x, y, width, height) {
          reads++;
          const data = new Uint8ClampedArray(width * height * 4);
          data[((height - 2) * width + width - 2) * 4 + 3] = 255;
          return { data };
        } };
      } };
    }
  } });
  const source = readFileSync(new URL("./tribe-art.mjs", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
  runInContext(source, context);
  return { art: context.createTribeArt([], value => value), reads: () => reads };
}

test("같은 정적 이미지와 프레임의 픽셀 범위는 한 번만 읽고 결과를 공유한다", () => {
  const f = fixture(), image = { naturalWidth: 4, naturalHeight: 4, src: "sprite.png" };
  const first = f.art.bounds(image, false);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), { x: 2, y: 2, width: 1, height: 1 });
  for (let count = 0; count < 1000; count++) assert.equal(f.art.bounds(image, false), first);
  assert.equal(f.reads(), 1);
  assert.notEqual(f.art.bounds(image, 2), first);
  assert.equal(f.reads(), 2);
  image.src = "replacement.png";
  assert.notEqual(f.art.bounds(image, false), first);
  assert.equal(f.reads(), 3);
  image.naturalWidth = 8;
  f.art.bounds(image, false);
  assert.equal(f.reads(), 4);
});

test("내용이 바뀔 수 있는 canvas의 픽셀 범위는 다시 계산한다", () => {
  const f = fixture(), canvas = { width: 4, height: 4 };
  f.art.bounds(canvas, false); f.art.bounds(canvas, false);
  assert.equal(f.reads(), 2);
  canvas.width = 8;
  const changed = f.art.bounds(canvas, false);
  assert.equal(changed.x, 6);
  assert.equal(f.reads(), 3);
});