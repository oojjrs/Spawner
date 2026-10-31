import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTES, ATTRIBUTE_COMBINATIONS, attributeCounts, attributeLevelLimit, migrateAttributeSlots,
  migrateAttributeLevels, attributeUpgradeCost, attributeUpgradeIssue, hasSynergy, unitStats } from "./attributes.mjs";
import { canHarvestResource, resourceDefinition, resourceHarvestMultiplier } from "./resources.mjs";

test("장착 슬롯은 고유하고 강화 단계만 능력 수치와 단계 특성을 높인다", () => {
  const slots = ["arms", "strength", "feet", "feet", "retired"];
  assert.deepEqual(migrateAttributeSlots(slots), ["strength", "feet"]);
  assert.equal(attributeCounts(slots).strength, 1);
  assert.equal(attributeCounts(slots).feet, 1);
  const levels = migrateAttributeLevels(slots, undefined, 3);
  assert.deepEqual(levels, { strength: 2, feet: 2 });
  const attributes = attributeCounts(migrateAttributeSlots(slots), levels);
  assert.equal(unitStats(attributes).capacity, 3);
  assert.equal(hasSynergy(attributes, ["feet", "feet"]), true);
  assert.equal(hasSynergy(attributeCounts(["feet", "feet"]), ["feet", "feet"]), false);
  assert.equal(hasSynergy(attributes, ["retired"]), false);
  assert.ok(ATTRIBUTE_COMBINATIONS.filter(entry => entry.kind === "upgrade")
    .every(entry => entry.requirement && Object.values(entry.attributeLevels).every(level => level === 2)));
});

test("이전 중복은 둥지 단계까지만 복원하고 명시한 강화 단계를 우선한다", () => {
  assert.deepEqual(migrateAttributeLevels(["feet", "feet", "feet"], undefined, 2), { feet: 2 });
  assert.deepEqual(migrateAttributeLevels(["feet", "feet"], { feet: 1, mining: 4 }, 4), { feet: 1 });
  assert.deepEqual(migrateAttributeLevels(["feet"], { feet: 99 }, 4), { feet: 4 });
  assert.deepEqual(migrateAttributeLevels(["feet"], { feet: -1 }, 4), { feet: 1 });
  assert.deepEqual(migrateAttributeLevels(["feet"], { feet: 2.5 }, 4), { feet: 1 });
  assert.deepEqual(migrateAttributeLevels(null, null, 4), {});
  assert.equal(attributeLevelLimit(0), 1);
  assert.equal(attributeLevelLimit(9), 4);
  assert.equal(attributeLevelLimit(undefined), 1);
});

test("모든 강화는 실제 원자원과 포인트를 요구하고 둥지보다 높게 강화할 수 없다", () => {
  for (const attribute of ATTRIBUTES) {
    const template = { slots: [attribute.key], attributeLevels: { [attribute.key]: 1 } };
    for (const level of [2, 3, 4]) {
      template.attributeLevels[attribute.key] = level - 1;
      const cost = attributeUpgradeCost(attribute.key, level);
      assert.equal(cost.evolutionPoints, [0, 0, 20, 30, 40][level]);
      assert.ok(Object.keys(cost.materials).length >= 2);
      for (const [key, amount] of Object.entries(cost.materials)) {
        assert.ok(resourceDefinition(key), key);
        assert.ok(Number.isInteger(amount) && amount > 0, key);
      }
      assert.equal(attributeUpgradeIssue(template, attribute.key, level, cost.evolutionPoints, cost.materials), null);
      assert.match(attributeUpgradeIssue(template, attribute.key, level - 1, 1000, cost.materials), /둥지/);
      assert.match(attributeUpgradeIssue(template, attribute.key, level, 0, cost.materials), /포인트/);
      assert.match(attributeUpgradeIssue(template, attribute.key, level, 1000, {}), /재료/);
    }
    assert.equal(attributeUpgradeCost(attribute.key, 1), null);
    assert.equal(attributeUpgradeCost(attribute.key, 5), null);
    template.attributeLevels[attribute.key] = 4;
    assert.match(attributeUpgradeIssue(template, attribute.key, 4, 1000, {}), /최대/);
  }
  assert.equal(attributeUpgradeCost("retired", 2), null);
  assert.equal(attributeUpgradeCost("__proto__", 2), null);
  assert.equal(attributeUpgradeCost("toString", 2), null);
  assert.match(attributeUpgradeIssue({ slots: [] }, "feet", 4, 1000, {}), /장착/);
});

test("강화 재료는 모든 종족이 신규 채집 속성 1단계로 확보할 수 있다", () => {
  const groups = {
    blade: ["tree", "grass-fiber"], excavation: ["clay", "sand"],
    piercing: ["pebbles", "iron-ore", "copper-ore", "quartz", "carapace"], butchery: ["dew", "meat"]
  };
  const world = { generationVersion: 16 };
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    for (const [key, resources] of Object.entries(groups)) {
      for (const resourceType of resources) {
        assert.equal(canHarvestResource({ resourceType }, world, attributeCounts([key]), tribe), true, tribe + ":" + resourceType);
        assert.equal(canHarvestResource({ resourceType }, world, attributeCounts(["strength"], { strength: 4 }), tribe),
          ({ bean: "clay", spore: "tree", pebble: "pebbles", spring: "dew" })[tribe] === resourceType);
      }
    }
    const attributes = attributeCounts(Object.keys(groups));
    for (const attribute of ATTRIBUTES) for (const level of [2, 3, 4]) {
      for (const resourceType of Object.keys(attributeUpgradeCost(attribute.key, level).materials)) {
        assert.equal(canHarvestResource({ resourceType }, world, attributes, tribe), true, tribe + ":" + resourceType);
      }
    }
  }
});

test("채집 전문 속성은 장착 즉시 시간을 25% 줄이고 4단계까지 강화한다", () => {
  for (const [resourceType, key] of [["tree", "blade"], ["grass-fiber", "blade"], ["clay", "excavation"],
    ["pebbles", "piercing"], ["sand", "excavation"], ["dew", "butchery"], ["iron-ore", "piercing"],
    ["copper-ore", "piercing"], ["quartz", "piercing"], ["meat", "butchery"], ["carapace", "piercing"]]) {
    assert.equal(resourceHarvestMultiplier(resourceType, {}), 1);
    for (const level of [1, 2, 3, 4]) {
      assert.equal(resourceHarvestMultiplier(resourceType, { [key]: level }), [1, .75, .65, .55, .45][level]);
    }
    assert.equal(resourceHarvestMultiplier(resourceType, { strength: 4 }), 1);
  }
  assert.equal(resourceHarvestMultiplier("unknown", { mining: 4 }), 1);
});
