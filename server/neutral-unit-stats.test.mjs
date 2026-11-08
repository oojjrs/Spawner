import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NEUTRAL_UNIT_STATS, NEUTRAL_UNIT_TIERS, NEUTRAL_STAT_FIELDS, neutralTierStat } from "./neutral-unit-stats.mjs";
import { unitCombatStats, combatProfile, migrateCombatStats, combatAbilityStats } from "./combat-stats.mjs";
import { CREATURE_MOVEMENT } from "./creature-movement.mjs";
import { deriveSimulationStats } from "../client/combat-simulation.mjs";
import { creatureAttackRole } from "./creature-attack-role.mjs";

import { NEUTRAL_STAT_LIMITS } from "./neutral-stat-limits.mjs";
import { CODEX_NEUTRAL_DESIGNS } from "../client/codex-neutral-data.mjs";

const design = readFileSync(new URL("../DesignAssets/codex-unit-tiers.html", import.meta.url), "utf8");
const fields = JSON.parse(design.match(/const fields = (\[[^\r\n]+\]);/)[1]).slice(3);

test("기획서의 19종 33개 스탯 티어가 공용 능력치 배정에 보존된다", () => {
  const extra = JSON.parse(design.match(/const extraTiers = (\[[\s\S]+?\n  \]);/)[1]);
  assert.equal(CODEX_NEUTRAL_DESIGNS.length, 19);
  assert.deepEqual(NEUTRAL_STAT_FIELDS, fields);
  for (const [index, unit] of CODEX_NEUTRAL_DESIGNS.entries()) {
    const expected = [...unit.tiers.slice(1), ...extra[index]];
    assert.equal(NEUTRAL_UNIT_TIERS[unit.key].tier, unit.tiers[0]);
    for (const [i, field] of fields.entries()) assert.equal(NEUTRAL_UNIT_TIERS[unit.key][field], expected[i], unit.key + ":" + field);
  }
});

test("모든 중립 스탯은 네 종족 기본값과 합법 DNA 최대 배치 사이에 있다", () => {
  for (const field of fields) {
    const limits = NEUTRAL_STAT_LIMITS[field], low = field === "movement" ? .225 : Math.min(limits.min, limits.max), high = Math.max(limits.min, limits.max);
    for (const [species, stats] of Object.entries(NEUTRAL_UNIT_STATS))
      assert.ok(stats[field] >= low && stats[field] <= high, species + ":" + field);
    const values = Array.from({ length:19 }, (_, index) => neutralTierStat(field, index + 1));
    const direction = limits.max < limits.min ? -1 : 1;
    for (let i = 1; i < values.length; i++) assert.ok(direction * (values[i] - values[i - 1]) > 0, field + ":" + (i + 1));
  }
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
    for (const field of fields) assert.equal(abilities[field], expected[field], key + ":" + field);
    const profile = combatProfile(agent);
    assert.equal(profile.attackInterval, 1 / expected.speed);
    assert.equal(profile.criticalChance, expected.critical / 100);
    assert.equal(profile.criticalMultiplier, expected.criticalPower / 100);
    assert.equal(profile.blockReduction, expected.blockPower / 100);
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


test("중립 기본 수치는 원래 기획의 6가지 스탯 순위를 뒤집지 않는다", () => {
  const ranks = [["flower-tail-bird",1,3,1,16,14,17],["dew-rabbit",2,2,2,13,16,13],["soil-mole",6,6,7,8,6,1],["bundle-snail",10,5,15,4,4,3],["cotton-sheep",7,1,5,6,7,10],["rolling-acorn",3,4,12,10,10,2],["bubble-toad",8,7,6,11,9,8],["snare-vine",11,10,11,5,1,12],["spiny-back-beetle",9,8,14,9,8,4],["soil-boar",14,14,13,7,11,6],["vine-turtle",16,9,16,3,5,5],["shadow-weasel",5,15,4,19,18,14],["talon-owl",4,16,3,15,13,19],["spring-keeper",12,12,8,17,15,18],["lantern-keeper",13,11,9,14,17,15],["old-garden-snail",18,13,18,2,2,7],["walking-forest",19,18,19,1,3,11],["white-paw",15,19,10,18,19,16],["spiny-back-leader",17,17,17,12,12,9]];
  for (const [index, field] of ["health", "power", "armor", "speed", "movement", "vision"].entries()) {
    const ordered = [...ranks].sort((a, b) => a[index + 1] - b[index + 1]);
    for (let i = 1; i < ordered.length; i++)
      assert.ok(NEUTRAL_UNIT_STATS[ordered[i][0]][field] > NEUTRAL_UNIT_STATS[ordered[i - 1][0]][field], field + ":" + ordered[i][0]);
  }
});

test("연타속도와 집중은 기획 티어가 높을수록 타격·준비 시간이 짧다", () => {
  for (const field of ["comboSpeed", "focus"]) {
    const ordered = Object.keys(NEUTRAL_UNIT_STATS).sort((a, b) => NEUTRAL_UNIT_TIERS[a][field] - NEUTRAL_UNIT_TIERS[b][field]);
    for (let i = 1; i < ordered.length; i++) assert.ok(NEUTRAL_UNIT_STATS[ordered[i]][field] < NEUTRAL_UNIT_STATS[ordered[i - 1]][field], field + ":" + ordered[i]);
  }
});
