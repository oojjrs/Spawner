import { UNIT_COMBINATION_FORMS, UNIT_COMBINATION_MASKS } from "./unit-combination-forms.mjs";
import { UNIT_APPEARANCE_BITS, UNIT_APPEARANCE_TRIBES, UNIT_APPEARANCE_LEGACY_VISUAL_KEYS, unitAppearanceMaskFromDna, unitAppearanceMaskFromAttributes, unitAppearanceForm } from "../server/unit-appearance.mjs";

// Rendering only. Never assign this projection to a simulation agent, DNA,
// snapshot, stats, or save. Lower-priority abilities remain fully effective.
export const UNIT_DISPLAY_PRIORITY = Object.freeze(["blade", "secretion", "carapace", "antenna", "feet"]);
export const UNIT_DISPLAY_MASKS = Object.freeze([0, ...UNIT_DISPLAY_PRIORITY.map(key => UNIT_APPEARANCE_BITS[key]), ...UNIT_COMBINATION_MASKS]);
export const UNIT_DISPLAY_FORM_COUNT = UNIT_APPEARANCE_TRIBES.length * UNIT_DISPLAY_MASKS.length;

export function unitDominantAppearanceMask(mask) {
  if (!Number.isInteger(mask) || mask < 0 || mask >= 32) return null;
  const organs = mask & ~UNIT_APPEARANCE_BITS.feet;
  if (UNIT_COMBINATION_MASKS.includes(organs)) return organs;
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
  const combination = UNIT_COMBINATION_FORMS.find(form => form.mask === (mask & ~UNIT_APPEARANCE_BITS.feet));
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

// Match the same four-organ selector used by the actual sprite catalogue.
// Retired feet and stat-only organs never replace a registered combination.
export function unitCombinationAppearance(agent) {
  const selected = unitAppearanceForm(agent);
  return UNIT_COMBINATION_FORMS.some(form => form.key === selected) ? selected : null;
}

export function unitBladeCarapaceAppearance(agent) {
  return unitCombinationAppearance(agent) === "blade-carapace";
}

// Readiness includes all abilities of historical builds that share this body.
// Separate organ combinations retain their own authored silhouette.
export function unitDisplayAbilityMask(mask) {
  if (!UNIT_DISPLAY_MASKS.includes(mask)) return null;
  let abilities = 0;
  for (let actual = 0; actual < 32; actual++) if (unitDominantAppearanceMask(actual) === mask) abilities |= actual;
  return abilities;
}
