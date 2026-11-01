import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { COMBAT_EVOLUTION_CATALOG, COMBAT_EVOLUTION_ASSETS } from "./combat-evolution-assets.mjs";
import { combatEvolutionKeys, combatEvolutionPose } from "./combat-evolution.mjs";
import { AGENT_ATTACK_HIT_TIME } from "../server/attack.mjs";

test("네 종족의 네 전투 외형과 전용 공격을 실제 게임 자산으로 연결한다", () => {
  assert.equal(Object.keys(COMBAT_EVOLUTION_CATALOG).length, 16);
  for (const file of COMBAT_EVOLUTION_ASSETS) assert.ok(existsSync(new URL("../" + file, import.meta.url)), file);
  for (const definition of Object.values(COMBAT_EVOLUTION_CATALOG)) {
    assert.equal(definition.animations.attack.contactMs, AGENT_ATTACK_HIT_TIME * 1000);
    assert.equal(definition.animations.attack.frameCount, 24);
    assert.equal(definition.animations.attack.durationMs, 1000);
    assert.ok(definition.animations.birth && definition.animations.death);
  }
});

test("전용 공격은 기본 공격의 프레임 번호 대신 실제 타격 시각과 배속으로 선택한다", () => {
  for (const definition of Object.values(COMBAT_EVOLUTION_CATALOG)) {
    const base = { health: 100, bornAt: 0, hurtStartedAt: -Infinity, attack: { startedAt: 10, speed: 1 } };
    const hit = combatEvolutionPose(base, 10.3, definition.animations);
    assert.equal(hit.action, "attack"); assert.equal(hit.frame, 10); assert.equal(hit.sampleTime, 300);
    const fast = combatEvolutionPose({ ...base, attack: { startedAt: 10, speed: 2 } }, 10.15, definition.animations);
    assert.equal(fast.frame, 10); assert.equal(fast.sampleTime, 300);
    assert.equal(combatEvolutionPose(base, 11.01, definition.animations).action, "idle");
    assert.equal(combatEvolutionPose({ ...base, hurtStartedAt: 10 }, 10.3, definition.animations).action, "hurt");
  }
});

test("복합 외형은 장착한 모든 속성을 유지하고 재생은 기존 합성에 남긴다", () => {
  assert.deepEqual(combatEvolutionKeys({ blade: 1, piercing: 1, carapace: 1, guard: 1, regeneration: 1, feet: 2 }),
    ["blade", "piercing", "carapace", "guard"]);
  assert.deepEqual(combatEvolutionKeys({ regeneration: 4, antenna: 2 }), []);
});

test("탄생·사망은 각 사건의 시작 시각과 실제 지속 시간으로 재생한다", () => {
  for (const tribe of ["sprout", "spore", "pebble", "spring"]) {
    const animations = COMBAT_EVOLUTION_CATALOG[tribe + "/blade"].animations;
    const base = { health: 100, bornAt: 0, hurtStartedAt: -Infinity };
    assert.equal(combatEvolutionPose({ ...base, birth: { startedAt: 10, readyAt: 14 } }, 10, animations).frame, 0);
    assert.equal(combatEvolutionPose({ ...base, birth: { startedAt: 10, readyAt: 14 } }, 14, animations).frame, animations.birth.frameCount - 1);
    assert.equal(combatEvolutionPose({ ...base, health: 0, diedAt: 10 }, 10, animations).frame, 0);
    assert.equal(combatEvolutionPose({ ...base, health: 0, diedAt: 10 }, 30, animations).frame, animations.death.frameCount - 1);
  }
});


test("폐기한 속성의 자산과 동작을 게임과 기획서에 노출하지 않는다", () => {
  const retired = /secretion|분비/i;
  for (const key of Object.keys(COMBAT_EVOLUTION_CATALOG)) assert.equal(retired.test(key), false);
  for (const file of COMBAT_EVOLUTION_ASSETS) assert.equal(retired.test(file), false);
  for (const file of ["../Design.html", "./design-previews.js", "./local-assets.js"]) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), "utf8"), retired);
  }
});
