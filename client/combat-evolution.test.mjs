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

test("네 종족의 모든 전투 외형은 채집 중 공격을 반복하고 피격·실제 공격을 우선한다", () => {
  for (const definition of Object.values(COMBAT_EVOLUTION_CATALOG)) {
    const animations = definition.animations;
    const base = { health: 100, bornAt: 0, hurtStartedAt: -Infinity, mode: "harvest", harvestStarted: 10,
      moveStartedAt: 10, moveDuration: 10 };
    const frames = new Set();
    for (const age of [0, .1, .3, .5, .8, .99, 1.1, 1.3, 2.3, 4.3]) {
      const pose = combatEvolutionPose(base, 10 + age, animations);
      assert.equal(pose.action, "attack");
      frames.add(pose.frame);
    }
    assert.ok(frames.size > 4);
    const hit = combatEvolutionPose(base, 10.3, animations);
    for (const time of [11.3, 12.3, 14.3]) assert.equal(combatEvolutionPose(base, time, animations).frame, hit.frame);
    assert.equal(combatEvolutionPose({ ...base, hurtStartedAt: 11 }, 11.3, animations).action, "hurt");
    assert.equal(combatEvolutionPose({ ...base, attack: { startedAt: 11, speed: 2 } }, 11.15, animations).frame, hit.frame);
    for (const mode of ["idle", "return", "unload"]) {
      assert.equal(combatEvolutionPose({ ...base, mode, moveDuration: 0 }, 14.3, animations).action, "idle");
    }
    const harvest = { ...animations.attack, action: "harvest" };
    assert.equal(combatEvolutionPose(base, 11.3, { ...animations, harvest }).action, "harvest");
  }
});


test("전투 속성은 다리 없는 새싹콩의 기본 점프를 보행으로 바꾸지 않는다", () => {
  for (const [key, definition] of Object.entries(COMBAT_EVOLUTION_CATALOG)) {
    const tribe = key.split("/")[0] === "sprout" ? "bean" : key.split("/")[0];
    for (const feet of [0, 1]) {
      const agent = { tribe, attributes: { [key.split("/")[1]]: 1, feet }, health: 10,
        bornAt: 0, moveStartedAt: 10, moveDuration: 2, stepCount: 1 };
      const actions = new Set();
      for (const time of [10, 10.2, 10.8, 11.2, 11.8]) actions.add(combatEvolutionPose(agent, time, definition.animations).action);
      assert.deepEqual([...actions], [tribe === "bean" && !feet ? "idle" : "walk"], key + feet);
      assert.equal(combatEvolutionPose({ ...agent, attack: { startedAt: 10, speed: 1 } }, 10.3, definition.animations).action, "attack");
      assert.equal(combatEvolutionPose({ ...agent, hurtStartedAt: 10 }, 10.3, definition.animations).action, "hurt");
      if (tribe === "bean") assert.equal(combatEvolutionPose({ ...agent, appearanceAttributes: { feet: 1 } }, 10.3, definition.animations).action, "walk");
    }
  }
});
