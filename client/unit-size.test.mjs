import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { UNIT_DISPLAY_SIZES, unitDisplaySize } from "./unit-size.mjs";

test("실제 DNA와 동일 조각 수 스탯은 모든 체급에서 같은 성장을 적용한다", () => {
  for (const [species, size] of Object.entries(UNIT_DISPLAY_SIZES)) for (const count of [0, 5, 20]) {
    assert.equal(unitDisplaySize({ species, dna: { pieces: Array(count).fill({}) } }), size * (1 + .01 * count));
    assert.equal(unitDisplaySize({ species, stats: { pieceCount: count } }), size * (1 + .01 * count));
  }
  assert.equal(unitDisplaySize({ tribe: "bean", dna: { pieces: [] }, stats: { pieceCount: 20 } }), .4);
  for (const pieceCount of [-5, NaN, Infinity, undefined]) assert.equal(unitDisplaySize({ tribe: "bean", stats: { pieceCount } }), .4);
});

test("필드와 전투는 속성 보정 캐시에 DNA 성장을 중복하거나 고정하지 않는다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const scope = createContext({ Spawner: { UNIT_DISPLAY_SIZES, unitDisplaySize },
    unitDisplayScales: new Map([["bean", 2]]), unitAttributeScales: new Map(),
    ATTRIBUTES: [{ key: "feet" }], combatAttributeArt: { ready: () => true },
    measureUnitDisplayScale: () => 3 });
  for (const name of ["unitDisplayScale", "combatUnitScale"])
    runInContext(source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0], scope);
  for (const count of [0, 20, 5, 0]) {
    const unit = { tribe: "bean", attributes: { feet: 1 }, dna: { pieces: Array(count).fill({}) } };
    assert.equal(scope.unitDisplayScale(unit), 3 * (1 + .01 * count));
    assert.equal(scope.combatUnitScale(unit), scope.unitDisplayScale(unit));
  }
  assert.equal(scope.unitAttributeScales.size, 1);
});
