import test from "node:test";
import assert from "node:assert/strict";
import { COMBAT_LAB_UNITS } from "./combat-lab.mjs";
import { UNIT_COMBAT_STATS } from "../server/combat-stats.mjs";

test("23종의 실험실 선택 목록은 실제 종별 기본 수치를 보존한다", () => {
  assert.equal(COMBAT_LAB_UNITS.length, 23);
  assert.equal(new Set(COMBAT_LAB_UNITS.map(unit => unit.key)).size, 23);
  assert.equal(COMBAT_LAB_UNITS.filter(unit => unit.group === "4종족").length, 4);
  for (const unit of COMBAT_LAB_UNITS) {
    assert.ok(unit.name);
    for (const [key, value] of Object.entries(UNIT_COMBAT_STATS[unit.key])) assert.equal(unit[key], value);
    assert.ok(Object.isFrozen(unit));
  }
});
