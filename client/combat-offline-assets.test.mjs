import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("로컬 파일의 세 전투 배경은 오프라인 자산으로 원본 바이트를 불러온다", async () => {
  const root = new URL("../", import.meta.url);
  const scope = { location: { protocol: "file:" } };
  scope.document = {
    createElement() { return { remove() {} }; },
    head: { append(script) {
      try {
        runInNewContext(readFileSync(new URL(script.src, root), "utf8"), scope);
        script.onload();
      } catch { script.onerror(); }
    } }
  };
  runInNewContext(readFileSync(new URL("./local-assets.js", import.meta.url), "utf8"), scope);
  runInNewContext(readFileSync(new URL("./assets.js", import.meta.url), "utf8"), scope);
  for (const background of ["grassland", "forest", "riverbank"]) {
    const path = "DesignAssets/Combat/" + background + ".webp";
    const loaded = await scope.SpawnerAssets.load(path);
    assert.ok(loaded.startsWith("data:image/webp;base64,"), background);
    assert.deepEqual(Buffer.from(loaded.slice(loaded.indexOf(",") + 1), "base64"), readFileSync(new URL(path, root)), background);
  }
});
