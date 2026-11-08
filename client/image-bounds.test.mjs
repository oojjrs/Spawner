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

test("같은 이미지의 비동기 범위 측정은 이미 디코딩된 픽셀을 한 번만 Worker로 보낸다", async () => {
  let bitmaps = 0, messages = 0, transferred;
  const context = createContext({ createTribeAttributeAnimation: () => ({}), Blob, setTimeout, clearTimeout,
    OffscreenCanvas: class {}, URL: { createObjectURL: () => "worker", revokeObjectURL() {} },
    createImageBitmap: async (sprite, x, y, width, height) => {
      bitmaps++;
      assert.equal(sprite.src, "sprite.png");
      assert.deepEqual([x, y, width, height], [0, 0, 4, 4]);
      return { close() {} };
    },
    Worker: class {
      postMessage(message, transfers) {
        messages++;
        assert.equal(transfers[0], message.bitmap);
        assert.equal(message.source, undefined);
        transferred = message.bitmap;
        queueMicrotask(() => this.onmessage({ data: { id: message.id, result: { x: 1, y: 2, width: 2, height: 1 } } }));
      }
    }
  });
  const source = readFileSync(new URL("./tribe-art.mjs", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
  runInContext(source, context);
  const art = context.createTribeArt([], value => value);
  const image = { src: "sprite.png", naturalWidth: 4, naturalHeight: 4 };
  const [first, second] = await Promise.all([art.prepareBounds(image, 4), art.prepareBounds(image, 4)]);
  assert.equal(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), { x: 1, y: 2, width: 2, height: 1 });
  assert.ok(transferred);
  assert.equal(await art.prepareBounds({ ...image }, 4), first);
  assert.equal(bitmaps, 1);
  assert.equal(messages, 1);
  image.naturalWidth = 8;
  assert.notEqual(await art.prepareBounds(image, 4), first);
  assert.equal(bitmaps, 2);
  assert.equal(messages, 2);
});
