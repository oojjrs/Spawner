import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTES, ATTRIBUTE_COMBINATIONS, attributeCounts, attributeLevelLimit, migrateAttributeSlots,
  migrateAttributeLevels, attributeUpgradeCost, attributeUpgradeIssue, hasSynergy, unitStats } from "./attributes.mjs";
import { canHarvestResource, resourceHarvestMultiplier } from "./resources.mjs";

test("장착 슬롯은 고유하며 이전 중복 장착도 효과를 중첩하지 않는다", () => {
  const slots = ["arms", "strength", "feet", "feet", "retired"];
  assert.deepEqual(migrateAttributeSlots(slots), ["strength", "feet"]);
  const levels = migrateAttributeLevels(slots, undefined, 3);
  assert.deepEqual(levels, { strength: 1, feet: 1 });
  const attributes = attributeCounts(migrateAttributeSlots(slots), levels);
  assert.equal(unitStats(attributes).capacity, 2);
  assert.equal(hasSynergy(attributes, ["feet", "feet"]), false);
  assert.equal(hasSynergy(attributes, ["retired"]), false);
  assert.deepEqual(ATTRIBUTE_COMBINATIONS, []);
});

test("이전 강화 수치와 중복 장착은 둥지 단계와 관계없이 1단계로 복원한다", () => {
  for (const nestLevel of [0, 1, 2, 3, 4, 9, undefined]) {
    assert.equal(attributeLevelLimit(nestLevel), 1);
    assert.deepEqual(migrateAttributeLevels(["feet", "feet", "feet"], undefined, nestLevel), { feet: 1 });
    for (const level of [-1, 1, 2, 2.5, 4, 99]) {
      assert.deepEqual(migrateAttributeLevels(["feet"], { feet: level }, nestLevel), { feet: 1 });
    }
  }
  assert.deepEqual(migrateAttributeLevels(["feet", "feet"], { feet: 1, mining: 4 }, 4), { feet: 1 });
  assert.deepEqual(migrateAttributeLevels(null, null, 4), {});
});

test("모든 속성의 강화 비용과 강화 요청을 허용하지 않는다", () => {
  for (const attribute of ATTRIBUTES) {
    const template = { slots: [attribute.key], attributeLevels: { [attribute.key]: 1 } };
    for (const level of [1, 2, 3, 4, 5]) assert.equal(attributeUpgradeCost(attribute.key, level), null);
    for (const nestLevel of [1, 2, 3, 4]) {
      assert.match(attributeUpgradeIssue(template, attribute.key, nestLevel, 100000, { tree: 1000, dew: 1000 }), /최대/);
    }
  }
  for (const key of ["retired", "__proto__", "toString"]) assert.equal(attributeUpgradeCost(key, 2), null);
  assert.match(attributeUpgradeIssue({ slots: [] }, "feet", 4, 1000, {}), /장착/);
});

test("네 종족 모두 기본 채집 속성으로 대응 자원을 채집한다", () => {
  const groups = { blade: ["tree", "grass-fiber"], excavation: ["clay", "sand"],
    piercing: ["pebbles", "iron-ore", "copper-ore", "quartz"], butchery: ["dew", "nutrients"] };
  const world = { generationVersion: 16 };
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    for (const [key, resources] of Object.entries(groups)) {
      for (const resourceType of resources) {
        assert.equal(canHarvestResource({ resourceType }, world, attributeCounts([key]), tribe), true, tribe + ":" + resourceType);
        assert.equal(canHarvestResource({ resourceType }, world, attributeCounts(["strength"]), tribe),
          ({ bean: "clay", spore: "tree", pebble: "pebbles", spring: "dew" })[tribe] === resourceType);
      }
    }
  }
});

test("종족 기본 자원의 전문 채집 효과는 이전 강화 수치로 증가하지 않는다", () => {
  const native = { clay: ["bean", "excavation"], tree: ["spore", "blade"], pebbles: ["pebble", "piercing"], dew: ["spring", "butchery"] };
  for (const [resourceType, [tribe, key]] of Object.entries(native)) {
    for (const legacyLevel of [1, 2, 3, 4]) {
      assert.equal(resourceHarvestMultiplier(resourceType, { [key]: legacyLevel }, tribe), .75);
      for (const other of Object.values(native).map(entry => entry[0]).filter(other => other !== tribe)) {
        assert.equal(resourceHarvestMultiplier(resourceType, { [key]: legacyLevel }, other), 1);
      }
    }
    assert.equal(resourceHarvestMultiplier(resourceType, { strength: 1 }, tribe), 1);
  }
  for (const resourceType of ["sand", "grass-fiber", "iron-ore", "copper-ore", "quartz", "nutrients"]) {
    for (const [tribe] of Object.values(native)) {
      assert.equal(resourceHarvestMultiplier(resourceType, { excavation: 1, blade: 1, piercing: 1, butchery: 1 }, tribe), 1);
    }
  }
  assert.equal(resourceHarvestMultiplier("unknown", { mining: 4 }, "bean"), 1);
});
