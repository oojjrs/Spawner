import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NEUTRAL_UNIT_STATS } from "./neutral-unit-stats.mjs";
import { unitCombatStats, combatProfile, migrateCombatStats, combatAbilityStats } from "./combat-stats.mjs";
import { CREATURE_MOVEMENT } from "./creature-movement.mjs";
import { deriveSimulationStats } from "../client/combat-simulation.mjs";
import { creatureAttackRole } from "./creature-attack-role.mjs";

const design = readFileSync(new URL("../DesignAssets/codex-unit-tiers.html", import.meta.url), "utf8");
const fields = JSON.parse(design.match(/const fields = (\[[^\r\n]+\]);/)[1]).slice(3);
const rows = JSON.parse(design.match(/const projectedStats = new Map\((\[[^\r\n]+\])\);/)[1]);

test("기획서의 중립 19종 전체 수치는 공용 원본과 일치한다", () => {
  assert.equal(rows.length, 19);
  assert.equal(fields.length, 33);
  for (const [key, values] of rows) assert.deepEqual(NEUTRAL_UNIT_STATS[key], Object.fromEntries(fields.map((field, index) => [field, values[index]])), key);
});

test("중립 생성 프로필과 실험실은 같은 체력·공격·방어·공속·이동·시야를 사용한다", () => {
  for (const [key, expected] of Object.entries(NEUTRAL_UNIT_STATS)) {
    const runtime = unitCombatStats(key), laboratory = deriveSimulationStats({ key });
    for (const actual of [runtime, laboratory]) {
      assert.equal(actual.health, expected.health, key);
      assert.equal(actual.attackPower, expected.power, key);
      assert.equal(actual.defense, expected.armor, key);
      assert.equal(actual.attackSpeed, expected.speed, key);
      assert.equal(actual.speed, expected.movement, key);
      assert.equal(actual.vision, expected.vision, key);
    }
    assert.equal(CREATURE_MOVEMENT[key].speed, expected.movement);
    assert.equal(combatProfile({ species: key, stats: {} }).attackPower, expected.power);
  }
});

test("중립 특수 능력은 DNA 정체성을 부여하지 않고 같은 전투 단위를 사용한다", () => {
  for (const [key, expected] of Object.entries(NEUTRAL_UNIT_STATS)) {
    const stats = unitCombatStats(key), agent = { species: key, stats }, abilities = combatAbilityStats(agent), role = creatureAttackRole(key);
    assert.equal(stats.dna, undefined);
    assert.equal(abilities.hits, 1 + expected.combo);
    assert.equal(abilities.melee, role.melee);
    assert.equal(abilities.ranged, role.ranged);
    for (const field of fields) assert.equal(abilities[field], field === "blockPower" ? 50 : expected[field], key + ":" + field);
    const profile = combatProfile(agent);
    assert.equal(profile.attackInterval, 1 / expected.speed);
    assert.equal(profile.criticalChance, expected.critical / 100);
    assert.equal(profile.criticalMultiplier, expected.criticalPower / 100);
    assert.equal(profile.blockReduction, .5);
  }
});

test("기존 중립 저장은 손상 비율과 행동 시각을 보존하며 반복 복원으로 회복하지 않는다", () => {
  for (const [key, expected] of Object.entries(NEUTRAL_UNIT_STATS)) {
    const agent = { species: key, health: 37, stats: { health: 100, speed: 99, vision: 99 }, attackReady: 12, nextActionAt: 23, moveStartedAt: 7 };
    migrateCombatStats(agent);
    assert.equal(agent.health, expected.health * .37);
    assert.equal(agent.stats.speed, expected.movement);
    assert.equal(agent.stats.vision, expected.vision);
    const health = agent.health;
    migrateCombatStats(agent);
    assert.ok(Math.abs(agent.health - health) < 1e-10);
    assert.deepEqual([agent.attackReady, agent.nextActionAt, agent.moveStartedAt], [12, 23, 7]);
    agent.health = 0; migrateCombatStats(agent); assert.equal(agent.health, 0);
  }
});
