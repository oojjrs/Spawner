import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTES, COMBAT_ATTRIBUTE_KEYS, attributeCounts, unitStats } from "./attributes.mjs";
import { combatDamage, combatProfile, migrateCombatStats, unitCombatStats } from "./combat-stats.mjs";
import { codexAttributeEffect } from "../client/codex-content.mjs";

for (const tribe of ["bean", "spore", "pebble", "spring"]) {
  test(tribe + "의 전투 속성은 공격력·관통·방어 역할을 각각 적용한다", () => {
    const plain = { tribe, health: 100, attributes: attributeCounts([]), stats: unitStats(attributeCounts([]), tribe) };
    const base = combatProfile(plain);
    for (const key of COMBAT_ATTRIBUTE_KEYS) {
      const attributes = attributeCounts([key]);
      const soldier = { tribe, health: 100, attributes, stats: unitStats(attributes, tribe) };
      const profile = combatProfile(soldier);
      assert.equal(profile.attackPower, base.attackPower + (key === "blade" ? 12 : 0), key);
      assert.equal(profile.armorPenetration, key === "piercing" ? .5 : 0, key);
      assert.ok(Math.abs(profile.defense - base.defense - (key === "carapace" ? 100 * .45 / .55 : 0)) < 1e-10, key);
      if (key === "carapace") {
        assert.equal(combatDamage(soldier, plain, .5), combatDamage(plain, plain, .5));
        assert.ok(combatDamage(plain, soldier, .5) < combatDamage(plain, plain, .5));
      } else {
        assert.ok(combatDamage(soldier, plain, .5) > combatDamage(plain, plain, .5), key);
        assert.equal(combatDamage(plain, soldier, .5), combatDamage(plain, plain, .5));
      }
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

test("이전 저장 마이그레이션이 전투 속성 보너스·부상 체력을 보존한다", () => {
  for (const key of COMBAT_ATTRIBUTE_KEYS) {
    const attributes = attributeCounts([key]), stats = unitStats(attributes, "bean");
    const agent = { tribe: "bean", slots: [key], attributes, attributeLevels: { [key]: 1 },
      health: 43, lifespan: stats.lifespan, stats: { ...stats, combatStrength: 20 } };
    migrateCombatStats(agent);
    assert.equal(agent.stats.combatStrength, stats.combatStrength);
    assert.equal(agent.health, 43);
    migrateCombatStats(agent);
    assert.equal(agent.stats.combatStrength, stats.combatStrength);
    assert.equal(agent.health, 43);
    assert.equal(agent.health, 43);
  }
  const creature = { species: "talon-owl", attributes: { blade: 1 }, health: 43, stats: { health: 100, combatStrength: 0 } };
  migrateCombatStats(creature);
  assert.equal(creature.stats.combatStrength, unitCombatStats("talon-owl").combatStrength);
  assert.equal(creature.health, unitCombatStats("talon-owl").health * .43);
});

test("속성 효과 표시는 현재 DNA 기관 효과를 제공하고 옛 종합 전투력 보너스를 표시하지 않는다", () => {
  const effects = { blade: /근접 공격력/, carapace: /방어력/, antenna: /시야/ };
  for (const attribute of ATTRIBUTES) {
    const effect = codexAttributeEffect(attribute, 1, "bean");
    assert.ok(effect.length > 0, attribute.key);
    assert.equal(effect.includes("기본 전투력 +"), false);
    if (effects[attribute.key]) assert.match(effect, effects[attribute.key]);
  }
});
