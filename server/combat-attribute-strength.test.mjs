import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTES, COMBAT_ATTRIBUTE_KEYS, attributeCounts, unitStats } from "./attributes.mjs";
import { combatDamage, migrateCombatStats, unitCombatStats } from "./combat-stats.mjs";
import { applyAgentGrowth } from "./growth.mjs";
import { codexAttributeEffect } from "../client/codex-content.mjs";

for (const tribe of ["bean", "spore", "pebble", "spring"]) {
  test(tribe + "의 단일 전투 속성은 기본 개체보다 공격·방어가 모두 높고 교환 피해 비율이 2.5배 이상이다", () => {
    const plain = { health: 100, stats: unitStats(attributeCounts([]), tribe) };
    for (const key of COMBAT_ATTRIBUTE_KEYS) {
      const soldier = { health: 100, stats: unitStats(attributeCounts([key]), tribe) };
      assert.ok(soldier.stats.combatStrength > plain.stats.combatStrength, key);
      assert.ok(combatDamage(soldier, plain, .5) > combatDamage(plain, plain, .5), key);
      assert.ok(combatDamage(plain, soldier, .5) < combatDamage(plain, plain, .5), key);
      assert.ok(combatDamage(soldier, plain, .5) >= 2.5 * combatDamage(plain, soldier, .5), key);
      for (const field of ["health", "speed", "vision", "capacity", "lifespan"]) {
        assert.equal(soldier.stats[field], plain.stats[field], key + ":" + field);
      }
    }
  });
}

test("속성 조합은 순서·중복·옛 강화 단계에 따라 기본 전투력이 달라지지 않는다", () => {
  const slots = ["blade", "piercing", "carapace"];
  const expected = unitStats(attributeCounts(slots), "bean").combatStrength;
  assert.equal(unitStats(attributeCounts([...slots].reverse()), "bean").combatStrength, expected);
  assert.equal(unitStats(attributeCounts([...slots, ...slots]), "bean").combatStrength, expected);
  for (const key of COMBAT_ATTRIBUTE_KEYS) {
    assert.equal(unitStats({ [key]: 4 }, "bean").combatStrength, unitStats({ [key]: 1 }, "bean").combatStrength);
  }
  assert.equal(unitStats(attributeCounts(["antenna", "feet", "strength", "lifespan"]), "bean").combatStrength, unitCombatStats("bean").combatStrength);
});

test("이전 저장 마이그레이션과 성장 재산출이 전투 속성 보너스·부상 체력을 보존한다", () => {
  for (const key of COMBAT_ATTRIBUTE_KEYS) {
    const attributes = attributeCounts([key]), stats = unitStats(attributes, "bean");
    const agent = { tribe: "bean", slots: [key], attributes, attributeLevels: { [key]: 1 },
      health: 43, lifespan: stats.lifespan, growthActivity: 100, stats: { ...stats, combatStrength: 20 } };
    migrateCombatStats(agent);
    assert.equal(agent.stats.combatStrength, stats.combatStrength);
    assert.equal(agent.health, 43);
    migrateCombatStats(agent);
    assert.equal(agent.stats.combatStrength, stats.combatStrength);
    assert.equal(agent.health, 43);
    applyAgentGrowth(agent, 0);
    assert.ok(agent.stats.combatStrength > stats.combatStrength);
    const grown = agent.stats.combatStrength;
    assert.equal(applyAgentGrowth(agent, 1), false);
    assert.equal(agent.stats.combatStrength, grown);
    assert.equal(agent.health, 43);
  }
  const creature = { species: "talon-owl", attributes: { blade: 1 }, health: 43, stats: { health: 100, combatStrength: 0 } };
  migrateCombatStats(creature);
  assert.equal(creature.stats.combatStrength, unitCombatStats("talon-owl").combatStrength);
  assert.equal(creature.health, 43);
});

test("속성 효과 표시는 실제 기본 전투력 보너스를 고유 효과와 함께 제공한다", () => {
  for (const attribute of ATTRIBUTES) {
    const stats = unitStats({ [attribute.key]: 1 }, "bean");
    const bonus = stats.combatStrength - unitCombatStats("bean").combatStrength;
    const effect = codexAttributeEffect(attribute, 1, "bean");
    assert.equal(effect.includes("기본 전투력 +" + bonus), bonus > 0);
  }
});
