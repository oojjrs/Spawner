import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { unitAppearanceMaskFromDna } from "../server/unit-appearance.mjs";

export function combatLabPlayable(key) {
  return ["bean", "spore", "pebble", "spring"].includes(key);
}

// Use real catalog pieces and the normal board rules, not appearance-only
// attributes or count overrides. Each selection receives an independent DNA.
export function combatLabBladeCarapaceDna() {
  const genes = ["blade", "carapace"], level = 4;
  function place(index, pieces) {
    if (index === genes.length) return pieces;
    const gene = ATTRIBUTE_DNA.lookup.get(genes[index]);
    for (let rotation = 0; rotation < 6; rotation++) {
      const next = [...pieces, { gene: gene.id, grade: gene.grade, rotation, shape: [...ATTRIBUTE_DNA.shape(gene, gene.grade)] }];
      const trace = ATTRIBUTE_DNA.trace(next, level);
      if (!trace.valid || trace.closed && index < genes.length - 1) continue;
      const result = place(index + 1, next);
      if (result) return result;
    }
    return null;
  }
  const pieces = place(0, []);
  if (!pieces) throw new Error("칼날+갑각 DNA를 보드에 배치할 수 없습니다.");
  return { version: 3, level, budget: ATTRIBUTE_DNA.price(pieces), pieces };
}

export function combatLabAppearance(build) {
  return combatLabPlayable(build?.key) && unitAppearanceMaskFromDna(build?.dna) === 3 ? "blade-carapace" : "native";
}

export function combatLabWithAppearance(build, appearance) {
  const result = { key: build.key, ...(build.name === undefined ? {} : { name: build.name }) };
  if (combatLabPlayable(build.key) && appearance === "blade-carapace") result.dna = combatLabBladeCarapaceDna();
  return result;
}
