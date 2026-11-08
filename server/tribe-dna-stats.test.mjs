import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { dnaUnitStats } from "./dna-unit.mjs";
import { unitTravelSpeed } from "./attributes.mjs";
import { combatDamage } from "./combat-stats.mjs";
import { dnaCombatStats } from "./dna-combat-stats.mjs";
import { dnaDesignStats } from "../client/dna-editor.mjs";
import { deriveSimulationStats } from "../client/combat-simulation.mjs";

const tribes = ["bean", "pebble", "spore", "spring"];
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, actual + " != " + expected);
const pieces = genes => genes.map(gene => ({ gene, grade: ATTRIBUTE_DNA.lookup.get(gene).grade, rotation: 0 }));

test("새싹콩의 기존 기본·증가 수치와 종족 미지정 호출을 보존한다", () => {
  const genes = pieces(["blade", "secretion", "health", "power", "rangedPower", "speed", "rangedSpeed", "carapace"]);
  const stats = ATTRIBUTE_DNA.stats(genes, "bean");
  for (const [key, expected] of Object.entries({ health: 30, meleePower: 10, rangedPower: 4.2, meleeSpeed: .6, rangedSpeed: .6, armor: 20, movement: .5 }))
    close(stats[key], expected);
  assert.deepEqual(ATTRIBUTE_DNA.stats(genes), stats);
  assert.deepEqual(ATTRIBUTE_DNA.stats(genes, "unknown"), stats);
});

test("같은 가격의 DNA에서 몽돌은 생존·방어, 포자는 원거리, 샘방울은 근접에 이득을 얻는다", () => {
  const organs = pieces(["blade", "secretion"]);
  const genes = pieces(["blade", "secretion", "health", "carapace", "power", "speed", "rangedPower", "rangedSpeed", "accuracy", "block", "evasion"]);
  const base = Object.fromEntries(tribes.map(tribe => [tribe, ATTRIBUTE_DNA.stats(organs, tribe)]));
  const stats = Object.fromEntries(tribes.map(tribe => [tribe, ATTRIBUTE_DNA.stats(genes, tribe)]));
  const gain = (tribe, key) => stats[tribe][key] - base[tribe][key];
  for (const key of ["health", "armor", "block"]) assert.ok(gain("pebble", key) > gain("bean", key), key);
  for (const key of ["rangedPower", "rangedSpeed", "accuracy"]) assert.ok(gain("spore", key) > gain("bean", key), key);
  for (const key of ["meleePower", "meleeSpeed", "evasion"]) assert.ok(gain("spring", key) > gain("bean", key), key);
  assert.ok(gain("spore", "health") < gain("bean", "health"));
  assert.ok(gain("pebble", "meleePower") < gain("bean", "meleePower"));
  assert.ok(gain("spring", "rangedPower") < gain("bean", "rangedPower"));
  const agent = (tribe, mode) => ({ tribe, stats: dnaUnitStats({ pieces: genes }, tribe), attack: { attackMode: mode } });
  assert.ok(combatDamage(agent("spring", "melee"), agent("bean", "melee"), .5) > combatDamage(agent("bean", "melee"), agent("bean", "melee"), .5));
  assert.ok(combatDamage(agent("spore", "ranged"), agent("bean", "melee"), .5) > combatDamage(agent("bean", "ranged"), agent("bean", "melee"), .5));
  assert.ok(combatDamage(agent("bean", "melee"), agent("pebble", "melee"), .5) < combatDamage(agent("bean", "melee"), agent("bean", "melee"), .5));
});

test("특화 효율은 공격 기관 조건·정수 타수·확률 및 공속 상한을 넘기지 않는다", () => {
  const weights = Object.fromEntries(["health", "power", "rangedPower", "speed", "rangedSpeed", "block", "evasion", "parry", "accuracy", "critical", "lifesteal", "reduction"].map(key => [key, 10000]));
  for (const tribe of tribes) {
    const empty = dnaCombatStats({}, weights, undefined, tribe);
    assert.equal(empty.meleePower, 1); assert.equal(empty.rangedPower, 0); assert.equal(empty.hits, 1);
    assert.equal(empty.melee, false); assert.equal(empty.ranged, false); assert.equal(empty.meleeSpeed, .5);
    const full = dnaCombatStats({ blade: 1, secretion: 1, combo: 1 }, { ...weights, combo: 3 }, undefined, tribe);
    assert.equal(full.hits, 2);
    assert.ok(full.meleeSpeed <= 4 && full.rangedSpeed <= 4);
    for (const [key, cap] of Object.entries({ block: 90, evasion: 60, parry: 60, accuracy: 60, critical: 90, lifesteal: 40, reduction: 40 })) assert.equal(full[key], cap, tribe + ":" + key);
  }
});

test("설계 수치·실험실·실제 유닛이 같은 종족의 DNA 수치를 사용한다", () => {
  const genes = pieces(["blade", "secretion", "health", "power", "rangedPower", "speed", "rangedSpeed", "carapace"]);
  const dna = ATTRIBUTE_DNA.validate({ version: 1, level: 4, budget: 999, pieces: genes });
  for (const tribe of tribes) {
    const actual = dnaUnitStats(dna, tribe).dna;
    assert.deepEqual(dnaDesignStats(ATTRIBUTE_DNA, dna.pieces, tribe).stats, actual);
    assert.deepEqual(deriveSimulationStats({ key: tribe, dna }).dna, actual);
    const overrides = deriveSimulationStats({ key: tribe, organs: { attack: 1, ranged: 1 },
      counts: { vitality: 1, power: 2, rangedPower: 2, haste: 2, rangedHaste: 2, armor: 2 } }).dna;
    for (const key of ["health", "meleePower", "rangedPower", "meleeSpeed", "rangedSpeed", "armor", "movement"]) close(overrides[key], actual[key]);
  }
});


test("이속 조각은 종족·역할에 관계없이 휴지를 30%씩 줄이고 네 개에서 멈춘다",()=>{
  for(const [tribe,empty,loaded] of [["bean",.5,.4],["spore",.5,.4],["pebble",.35,.3],["spring",.9,.275]]){
    for(const gather of [false,true])for(const count of [0,1,2,3,4,5]){
      const dna={pieces:pieces([...(gather?["gather","capacity"]:[]),...Array(count).fill("movement")])};
      const stats=dnaUnitStats(dna,tribe),agent={tribe,dna,stats},remaining=[1,.7,.4,.1,0,0][count];
      assert.equal(stats.movementRestReduction,Math.min(100,count*30));
      close(1/stats.speed-1,(1/empty-1)*remaining);
      for(const load of gather?[0,.5,1]:[0])for(const terrain of [1,.6,.4]){
        const raw=(empty+(loaded-empty)*load)*terrain;
        close(1/unitTravelSpeed(agent,stats.capacity*load,undefined,terrain)-1,(1/raw-1)*remaining);
      }
      if(gather){
        close(stats.loadedSpeed,unitTravelSpeed(agent,stats.capacity,undefined));
        assert.equal(stats.capacity,tribe==='pebble'?3:2);assert.equal(stats.harvest,1);assert.equal(stats.harvestTime,1);
      }
    }
  }
});
