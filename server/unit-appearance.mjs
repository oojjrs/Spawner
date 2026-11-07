export const UNIT_APPEARANCE_BITS = Object.freeze({ blade: 1, carapace: 2, antenna: 4, feet: 8, secretion: 16 });
export const UNIT_APPEARANCE_LEGACY_VISUAL_KEYS = Object.freeze(["strength", "arms", "piercing", "guard"]);
export const UNIT_APPEARANCE_TRIBES = Object.freeze(["bean", "spore", "pebble", "spring"]);
export const UNIT_APPEARANCE_ORGANS = Object.freeze(["blade", "secretion", "carapace", "antenna"]);
export const UNIT_APPEARANCE_FORMS = Object.freeze(["base", "gather", ...Array.from({ length: 15 }, (_, index) =>
  UNIT_APPEARANCE_ORGANS.filter((key, bit) => (index + 1) & (1 << bit)).join("-"))]);

export function unitAppearanceForm(agent) {
  if (!agent || agent.species) return null;
  const attributes = agent.appearanceAttributes || agent.attributes;
  const pieces = agent.dna?.pieces || [];
  const organs = UNIT_APPEARANCE_ORGANS.filter(key => attributes ? attributes[key] > 0 : pieces.some(piece => piece.gene === key));
  if (organs.length) return organs.join("-");
  if (attributes ? attributes.feet > 0 || attributes.legs > 0 : pieces.some(piece => piece.gene === "legs")) return "feet";
  if (attributes?.gather > 0 || attributes?.strength > 0 || attributes?.arms > 0 || pieces.some(piece => piece.gene === "gather")) return "gather";
  return attributes?.piercing > 0 ? "secretion" : "base";
}

export function unitAppearanceKey(tribe, mask) {
  return UNIT_APPEARANCE_TRIBES.includes(tribe) && Number.isInteger(mask) && mask >= 0 && mask < 32 ?
    tribe + "/" + mask.toString(16).padStart(2, "0") : null;
}

export function unitAppearanceMaskFromAttributes(attributes) {
  if (UNIT_APPEARANCE_LEGACY_VISUAL_KEYS.some(key => attributes?.[key] > 0)) return null;
  let mask = 0;
  for (const [key, bit] of Object.entries(UNIT_APPEARANCE_BITS)) if (attributes?.[key] > 0) mask |= bit;
  return mask;
}

export function unitAppearanceMaskFromDna(dna) {
  if (!Array.isArray(dna?.pieces)) return null;
  let mask = 0;
  for (const piece of dna.pieces) mask |= UNIT_APPEARANCE_BITS[piece.gene === "legs" ? "feet" : piece.gene] || 0;
  return mask;
}
