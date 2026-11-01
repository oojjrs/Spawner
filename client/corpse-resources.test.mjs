import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { resourceTypeForCell } from "../server/resources.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function rendering(corpses, zoom, selection) {
  const labels = [];
  const drawing = { save() {}, restore() {}, beginPath() {}, roundRect() {}, fill() {},
    measureText: label => ({ width: label.length * 8 }),
    fillText: (label, x, y) => labels.push({ label, x, y, font: drawing.font }) };
  const scope = createContext({ ctx: drawing, state: { simSeconds: 10, camera: { zoom }, selection },
    resourceNodeCells: () => corpses, Spawner: { resourceTypeForCell }, worldMap: {},
    worldToScreen: (x, y) => ({ x: x * zoom, y: y * zoom }),
    clamp: (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)) });
  runInContext(source.match(/^    function drawCorpseResourceCounts\([^]*?^    }/m)[0], scope);
  return { scope, labels };
}

function corpse(id, x, y, amount, decaysAt) {
  return { id, kind: "corpse", resourceType: "nutrients", x, y, amount, decaysAt };
}

test("같은 칸에서 겹쳐 죽은 개체들의 남은 양분 합계를 한 번 표시한다", () => {
  const cells = [corpse("a", 4, 5, 1, 20), corpse("b", 4, 5, 4, 20), corpse("c", 4, 5, 7, 20),
    corpse("d", 5, 5, 6, 20), corpse("expired", 4, 5, 9, 10), corpse("empty", 4, 5, 0, 20),
    { kind: "resource", resourceType: "dew", x: 4, y: 5, amount: 50 }];
  const before = JSON.stringify(cells);
  const render = rendering(cells, 144, null);
  render.scope.drawCorpseResourceCounts();
  assert.deepEqual(render.labels.map(entry => entry.label), ["×12", "×6"]);
  assert.equal(JSON.stringify(cells), before);
});

test("채집과 개별 사체 부패를 반영하고 마지막 양분이 없어지면 숫자를 지운다", () => {
  const cells = [corpse("a", 4, 5, 2, 12), corpse("b", 4, 5, 1, 20)];
  const render = rendering(cells, 72, null);
  for (const [time, amount, expected] of [[10, 2, "×3"], [11, 1, "×2"], [12, 1, "×1"], [20, 1, null]]) {
    render.scope.state.simSeconds = time;
    cells[0].amount = amount;
    render.labels.length = 0;
    render.scope.drawCorpseResourceCounts();
    assert.deepEqual(render.labels.map(entry => entry.label), expected ? [expected] : []);
  }
});

test("축소 화면에서는 선택한 칸의 합계만 최소 글자 크기로 표시한다", () => {
  const cells = [corpse("a", 4, 5, 2, 20), corpse("b", 4, 5, 1, 20), corpse("c", 5, 5, 8, 20)];
  const render = rendering(cells, 8, null);
  render.scope.drawCorpseResourceCounts();
  assert.deepEqual(render.labels, []);
  render.scope.state.selection = { kind: "corpse", target: cells[0] };
  render.scope.drawCorpseResourceCounts();
  assert.deepEqual(render.labels.map(entry => entry.label), ["×3"]);
  assert.equal(render.labels[0].font, "600 12px sans-serif");
});
