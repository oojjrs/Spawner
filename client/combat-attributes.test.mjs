import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { combatAttributeKeys, combatAttributePose } from "./combat-attributes.mjs";
import { COMBAT_ATTRIBUTE_ASSETS } from "./combat-attribute-assets.mjs";
import { auditImages } from "./image-audit.mjs";

const rig = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/CombatAttributesRuntimeV1/sprout/rig.json", import.meta.url)));

test("일반 속성과 전투 속성을 함께 장착해도 전투 파츠만 골라 합성한다", () => {
  assert.deepEqual(combatAttributeKeys({ feet: 1, antenna: 2, blade: 1, guard: 2 }), ["blade", "guard"]);
  assert.deepEqual(combatAttributeKeys({ construction: 1 }), []);
});

test("타격·피격·치유·분비 동작은 실제 시각에 맞는 전투 리그를 선택한다", () => {
  const base = { tribe: "bean", health: 100, bornAt: 0, attributes: { regeneration: 1 }, animationStartedAt: 0 };
  assert.equal(combatAttributePose({ ...base, attack: { startedAt: 1 } }, 1.2, rig).action, "attack");
  assert.equal(combatAttributePose({ ...base, hurtStartedAt: 1 }, 1.2, rig).action, "hurt");
  for (const kind of ["heal", "secretion"]) {
    const agent = { ...base, support: { kind, startedAt: 1, endsAt: 2.2 } };
    const pose = combatAttributePose(agent, 1.6, rig);
    assert.equal(pose.action, kind);
    assert.ok(pose.track.visible);
    assert.ok(Math.abs(pose.elapsed - 600) < 1e-6);
    assert.equal(combatAttributePose(agent, 2.3, rig).action, "idle");
  }
});

test("네 종족 리그와 DNA 이미지가 게임 자산에 포함되고 원본 크기 정책을 지킨다", () => {
  for (const file of COMBAT_ATTRIBUTE_ASSETS) assert.ok(existsSync(new URL("../" + file, import.meta.url)), file);
  assert.equal(COMBAT_ATTRIBUTE_ASSETS.filter(name => name.includes("CombatAttributesRuntimeV1/") && name.endsWith("/rig.json")).length, 4);
  assert.equal(COMBAT_ATTRIBUTE_ASSETS.filter(name => name.includes("CombatDnaV1/")).length, 6);
  assert.ok(auditImages(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"), COMBAT_ATTRIBUTE_ASSETS) > 50);
});
