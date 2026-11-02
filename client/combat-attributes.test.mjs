import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { combatAttributeKeys } from "./combat-attributes.mjs";
import { COMBAT_ATTRIBUTE_ASSETS } from "./combat-attribute-assets.mjs";
import { auditImages } from "./image-audit.mjs";

test("일반 속성과 전투 속성을 함께 장착해도 전투 파츠만 골라 합성한다", () => {
  assert.deepEqual(combatAttributeKeys({ feet: 1, antenna: 2, blade: 1, piercing: 2 }), ["blade", "piercing"]);
  assert.deepEqual(combatAttributeKeys({ construction: 1 }), []);
});

test("네 종족 리그와 DNA 이미지가 게임 자산에 포함되고 원본 크기 정책을 지킨다", () => {
  for (const file of COMBAT_ATTRIBUTE_ASSETS) assert.ok(existsSync(new URL("../" + file, import.meta.url)), file);
  assert.equal(COMBAT_ATTRIBUTE_ASSETS.filter(name => name.includes("CombatDnaV1/")).length, 3);
  assert.ok(auditImages(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"), COMBAT_ATTRIBUTE_ASSETS) > 50);
});
