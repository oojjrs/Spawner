import { UNIT_COMBINATION_FORMS, UNIT_COMBINATION_MASKS } from "./unit-combination-forms.mjs";
import { UNIT_APPEARANCE_BITS, UNIT_APPEARANCE_TRIBES, UNIT_APPEARANCE_LEGACY_VISUAL_KEYS, unitAppearanceMaskFromDna, unitAppearanceMaskFromAttributes } from "../server/unit-appearance.mjs";

// Rendering only. Never assign this projection to a simulation agent, DNA,
// snapshot, stats, or save. Lower-priority abilities remain fully effective.
export const UNIT_DISPLAY_PRIORITY = Object.freeze(["blade", "secretion", "carapace", "antenna", "feet"]);
export const UNIT_DISPLAY_MASKS = Object.freeze([0, ...UNIT_DISPLAY_PRIORITY.map(key => UNIT_APPEARANCE_BITS[key]), ...UNIT_COMBINATION_MASKS]);
export const UNIT_DISPLAY_FORM_COUNT = UNIT_APPEARANCE_TRIBES.length * UNIT_DISPLAY_MASKS.length;

export function unitDominantAppearanceMask(mask) {
  if (!Number.isInteger(mask) || mask < 0 || mask >= 32) return null;
  if (UNIT_COMBINATION_MASKS.includes(mask)) return mask;
  return UNIT_DISPLAY_PRIORITY.map(key => UNIT_APPEARANCE_BITS[key]).find(bit => mask & bit) || 0;
}

export function unitDisplayAttributesFrom(attributes = {}) {
  attributes ||= {};
  // Old saves using retired organs retain their authored compatibility rigs,
  // without applying the current priority policy. Current DNA cannot produce
  // these keys and uses the canonical silhouettes plus the authored combinations.
  if (UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => attributes[key] > 0)) return attributes;
  const dominant = UNIT_DISPLAY_PRIORITY.find(key => attributes[key] > 0 || key === "feet" && attributes.legs > 0);
  const result = { ...attributes };
  for (const key of [...UNIT_DISPLAY_PRIORITY, "legs"]) delete result[key];
  const mask = unitAppearanceMaskFromAttributes({ ...attributes, feet: Math.max(attributes.feet || 0, attributes.legs || 0) });
  const combination = UNIT_COMBINATION_FORMS.find(form => form.mask === mask);
  if (combination) Object.assign(result, combination.attributes);
  else if (dominant) result[dominant] = 1;
  return result;
}

export function unitDisplayAttributes(agent) {
  const attributes = agent?.appearanceAttributes || agent?.attributes;
  if (agent?.species) return attributes || {};
  const mask = attributes ? null : unitAppearanceMaskFromDna(agent?.dna);
  const display = attributes ? unitDisplayAttributesFrom(attributes) : mask === null ? {} : unitDisplayAttributesFrom(Object.fromEntries(
    Object.entries(UNIT_APPEARANCE_BITS).filter(([, bit]) => mask & bit).map(([key]) => [key, 1])));
  return agent?.dna?.pieces?.some(piece => piece.gene === "gather") && !UNIT_DISPLAY_PRIORITY.some(key => display[key] > 0) ?
    { ...display, strength: display.strength || display.arms || 1 } : display;
}

// Select only exact authored combinations. Extra visible traits keep their
// previous dominant art. An explicit snapshot also overrides DNA fallback.
export function unitCombinationAppearance(agent) {
  if (!agent || agent.species) return null;
  const attributes = agent.appearanceAttributes || agent.attributes;
  const mask = attributes ? unitAppearanceMaskFromAttributes({ ...attributes,
    feet: Math.max(attributes.feet || 0, attributes.legs || 0) }) : unitAppearanceMaskFromDna(agent.dna);
  return UNIT_COMBINATION_FORMS.find(form => form.mask === mask)?.key || null;
}

export function unitBladeCarapaceAppearance(agent) {
  return unitCombinationAppearance(agent) === "blade-carapace";
}

// A shared blade silhouette can also shoot. Production readiness must include
// every action needed by builds that map to that silhouette, not just its name.
export function unitDisplayAbilityMask(mask) {
  if (!UNIT_DISPLAY_MASKS.includes(mask)) return null;
  let abilities = 0;
  for (let actual = 0; actual < 32; actual++) if (unitDominantAppearanceMask(actual) === mask) abilities |= actual;
  return abilities;
}
