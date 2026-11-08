import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { COMBAT_EVOLUTION_CATALOG, COMBAT_EVOLUTION_ASSETS } from "./combat-evolution-assets.mjs";
import { combatEvolutionKeys, combatEvolutionPose } from "./combat-evolution.mjs";
import { AGENT_ATTACK_HIT_TIME } from "../server/attack.mjs";



test("복합 외형은 장착한 전투 속성을 유지한다", () => {
  assert.deepEqual(combatEvolutionKeys({ blade: 1, piercing: 1, carapace: 1, feet: 2 }),
    ["blade", "piercing", "carapace"]);
  assert.deepEqual(combatEvolutionKeys({ antenna: 2 }), []);
});
