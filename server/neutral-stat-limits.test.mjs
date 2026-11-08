import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { validateDna } from "./dna-unit.mjs";
import { NEUTRAL_STAT_LIMITS } from "./neutral-stat-limits.mjs";
import { createSimulationTrial } from "../client/combat-simulation.mjs";

const evidence = JSON.parse(readFileSync(new URL("./test-data/neutral-stat-bounds.json", import.meta.url), "utf8"));
const tribes = ["bean", "pebble", "spore", "spring"];
const epsilon = 1e-9;
function value(field, stats, gene) {
  if (field === "combo") return stats.hits - 1;
  if (field === "harvestSpeed") return stats.harvestReduction;
  if (field === "power" && gene === "rangedPower") return stats.rangedPower;
  if (field === "speed" && gene === "rangedSpeed") return stats.rangedSpeed;
  return stats[field];
}

test("반경6 상한 증거는 현재 고정등급·기관·회전·충돌 규칙으로 배치할 수 있다", () => {
  assert.equal(ATTRIBUTE_DNA.boardRadius(4), 6);
  assert.equal(ATTRIBUTE_DNA.boardCells(4).length, 127);
  for (const [gene, witness] of Object.entries(evidence.witnesses)) {
    const dna = { version:6, level:4, budget:999999999, pieces:witness.pieces };
    assert.ok(validateDna(dna, 4, dna.budget), gene);
    assert.equal(dna.pieces.filter(piece => piece.gene === (witness.targetGene || gene)).length, witness.count, gene);
    for (const required of witness.prefix) assert.ok(dna.pieces.some(piece => piece.gene === required), gene + ":" + required);
  }
});

test("33개 허용 범위는 네 종족 무속성 기본값과 실제 배치의 능력치에서 나온다", () => {
  assert.equal(Object.keys(NEUTRAL_STAT_LIMITS).length, 33);
  for (const [field, limit] of Object.entries(NEUTRAL_STAT_LIMITS)) {
    const record = evidence.limits[field], baselines = [], maxima = [];
    for (const tribe of tribes) {
      const entry = record.perTribe[tribe], witness = evidence.witnesses[entry.witness];
      const baselinePieces = entry.minWitness ? evidence.witnesses[entry.minWitness].pieces : [];
      const baseline = value(field, ATTRIBUTE_DNA.stats(baselinePieces, tribe), field);
      const maximum = value(field, ATTRIBUTE_DNA.stats(witness.pieces, tribe), entry.witness);
      assert.ok(Math.abs(entry.min - baseline) < epsilon, tribe + ":" + field + ":min");
      assert.ok(Math.abs(entry.max - maximum) < epsilon, tribe + ":" + field + ":max");
      baselines.push(baseline); maxima.push(maximum);
    }
    assert.ok(Math.abs(limit.min - (record.descending ? Math.max(...baselines) : Math.min(...baselines))) < epsilon, field);
    assert.ok(Math.abs(limit.max - (record.descending ? Math.min(...maxima) : Math.max(...maxima))) < epsilon, field);
    assert.ok(record.exact, field + ": maximum is not proven");
  }
});

test("갑각과 방어 강화만 한 기본 새싹콩은 정규 딱정벌레를 혼자 잡지 못한다", () => {
  for (const support of ["block", "blockPower", "reduction"]) {
    const genes = ["carapace", support];
    if (support === "blockPower") genes.push("block");
    const pieces = ATTRIBUTE_DNA.pack(genes.map(gene => ({ gene, grade:ATTRIBUTE_DNA.lookup.get(gene).grade, rotation:0 })), 4);
    assert.ok(pieces);
    const dna = { version:6, level:4, budget:999999999, pieces };
    assert.ok(validateDna(dna, 4, dna.budget));
    for (const seed of [1, 7, 19]) {
      const trial = createSimulationTrial({ left:{key:"bean",dna}, right:{key:"spiny-back-beetle"}, seed, random:true });
      trial.finish();
      assert.equal(trial.result().winner, "right", support + ":" + seed);
    }
  }
});
