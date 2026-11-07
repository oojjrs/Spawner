import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { unitAppearanceMaskFromDna } from "../server/unit-appearance.mjs";
import { UNIT_COMBINATION_FORMS } from "./unit-combination-forms.mjs";

export const COMBAT_LAB_APPEARANCES = Object.freeze([
  Object.freeze(["native", "기본"]), ...UNIT_COMBINATION_FORMS.map(form => Object.freeze([form.key, form.label])),
]);

export function combatLabPlayable(key) {
  return ["bean", "spore", "pebble", "spring"].includes(key);
}

// Use real catalog pieces and normal board rules, never appearance overrides.
// Every selection receives independently owned DNA with its actual mechanics.
export function combatLabCombinationDna(appearance) {
  const form = UNIT_COMBINATION_FORMS.find(form => form.key === appearance);
  if (!form) throw new Error("지원하지 않는 DNA 외형입니다.");
  const genes = Object.keys(form.attributes), level = 4;
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
  if (!pieces) throw new Error(form.label + " DNA를 보드에 배치할 수 없습니다.");
  return { version: 3, level, budget: ATTRIBUTE_DNA.price(pieces), pieces };
}

export function combatLabBladeCarapaceDna() { return combatLabCombinationDna("blade-carapace"); }

export function combatLabAppearance(build) {
  if (!combatLabPlayable(build?.key)) return "native";
  const mask = unitAppearanceMaskFromDna(build?.dna);
  return UNIT_COMBINATION_FORMS.find(form => form.mask === mask)?.key || "native";
}

export function combatLabWithAppearance(build, appearance) {
  const result = { key: build.key, ...(build.name === undefined ? {} : { name: build.name }) };
  if (combatLabPlayable(build.key) && UNIT_COMBINATION_FORMS.some(form => form.key === appearance)) result.dna = combatLabCombinationDna(appearance);
  return result;
}
