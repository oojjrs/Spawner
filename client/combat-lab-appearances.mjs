import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { unitAppearanceMaskFromDna } from "../server/unit-appearance.mjs";
import { UNIT_COMBINATION_FORMS } from "./unit-combination-forms.mjs";

const labForms = Object.freeze([
  ...UNIT_COMBINATION_FORMS,
  { key: "carapace", label: "갑각", mask: 2, attributes: { carapace: 1 } },
  { key: "antenna", label: "안테나", mask: 4, attributes: { antenna: 1 } },
]);

export const COMBAT_LAB_APPEARANCES = Object.freeze([
  Object.freeze(["native", "기본"]), ...labForms.map(form => Object.freeze([form.key, form.label])),
]);

export function combatLabPlayable(key) {
  return ["bean", "spore", "pebble", "spring"].includes(key);
}

// Use real catalog pieces and normal board rules, never appearance overrides.
// Every selection receives independently owned DNA with its actual mechanics.
export function combatLabCombinationDna(appearance) {
  const form = labForms.find(form => form.key === appearance);
  if (!form) throw new Error("지원하지 않는 DNA 외형입니다.");
  const genes = Object.keys(form.attributes), level = 4;
  const pieces = ATTRIBUTE_DNA.pack(genes.map(id => {
    const gene = ATTRIBUTE_DNA.lookup.get(id);
    return { gene: gene.id, grade: gene.grade, rotation: 0 };
  }), level);
  if (!pieces) throw new Error(form.label + " DNA를 보드에 배치할 수 없습니다.");
  return { version: 6, level, budget: ATTRIBUTE_DNA.price(pieces), pieces };
}

export function combatLabBladeCarapaceDna() { return combatLabCombinationDna("blade-carapace"); }

export function combatLabAppearance(build) {
  if (!combatLabPlayable(build?.key)) return "native";
  const mask = unitAppearanceMaskFromDna(build?.dna);
  return labForms.find(form => form.mask === mask)?.key || "native";
}

export function combatLabWithAppearance(build, appearance) {
  const result = { key: build.key, ...(build.name === undefined ? {} : { name: build.name }) };
  if (combatLabPlayable(build.key) && labForms.some(form => form.key === appearance)) result.dna = combatLabCombinationDna(appearance);
  return result;
}
