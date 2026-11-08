import { dnaAppearance } from "./dna-unit.mjs";
import { suggestTemplateName } from "./unit-template-names.mjs";

export function sameTribeDesign(first, second) {
  if (!first.dna || !second.dna) return false;
  return JSON.stringify(first.dna.pieces) === JSON.stringify(second.dna.pieces);
}

export function tribeDnaTemplate(dna, role, state) {
  const previous = state.templates.find(template => sameTribeDesign(template, { dna }));
  if (previous) return { ...previous, productionRole: role };
  const slots = Object.keys(dnaAppearance(dna));
  return { id: null, name: suggestTemplateName(slots, state.templates), dna, slots,
    attributeLevels: Object.fromEntries(slots.map(key => [key, 1])), revision: 1, productionRole: role };
}
