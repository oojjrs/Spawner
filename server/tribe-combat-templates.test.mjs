import test from "node:test";
import assert from "node:assert/strict";
import { tribeCombatTemplates } from "./tribe-combat-templates.mjs";
import { tribeProductionTemplate } from "./tribe-production.mjs";
import { validateDna } from "./dna-unit.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";

test("4레벨 AI 원정은 종족별 정상 DNA 10종을 모두 생산 후보로 사용한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const designs = tribeCombatTemplates(tribe);
    assert.equal(designs.length, 10);
    const state = { simSeconds: 600, nestLevel: 4, evolutionPoints: 2000, foodIncomeStartedAt: 0, foodIncome: [], templates: [],
      agents: Array.from({ length: 12 }, (_, i) => ({ id: "worker:" + i, productionRole: "worker", health: 100,
        bornAt: 600, lifespan: 420, slots: ["strength"],
        stats: { health: 100, capacity: 6, speed: .7, dna: { harvest: 1, harvestReduction: 80 } } })) };
    state.agents.push(...Array.from({ length: 3 }, (_, i) => ({ id: "guard:" + i, productionRole: "military", health: 100,
      bornAt: 600, lifespan: 420, slots: ["blade"], dna: { version: 6, level: 2, budget: 12,
        pieces: [{ gene: "blade", grade: 2, rotation: 0, q: 0, r: 0 }] } })));
    const seen = new Set();
    for (let i = 0; i < 10; i++) {
      const template = tribeProductionTemplate(state, tribe);
      assert.equal(template.productionRole, "military");
      assert.equal(template.dna.level, 4);
      assert.ok(validateDna(template.dna, 4, template.dna.budget));
      assert.equal(template.dna.budget, ATTRIBUTE_DNA.price(template.dna.pieces));
      const match = designs.find(design => JSON.stringify(design.dna.pieces) === JSON.stringify(template.dna.pieces));
      assert.ok(match);
      seen.add(match.template);
      state.agents.push({ ...template, id: "soldier:" + i, health: 100, bornAt: 600, lifespan: 420 });
    }
    assert.equal(seen.size, 10);
  }
});
