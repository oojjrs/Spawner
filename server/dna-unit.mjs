import { ATTRIBUTE_DNA } from "./dna.mjs";

export function cloneDna(dna) {
  if (!dna) return null;
  const value = dna.version === 6 ? dna : ATTRIBUTE_DNA.validate(dna);
  if (!value) return null;
  return { version: value.version, pieces: value.pieces.map(ATTRIBUTE_DNA.clonePiece), budget: value.budget, level: value.level };
}

export function validateDna(dna, nestLevel, budget) {
  if (!dna || dna.version !== 6 || !Array.isArray(dna.pieces)) return null;
  const organs = new Set();
  for (const piece of dna.pieces) {
    const gene = ATTRIBUTE_DNA.lookup.get(piece?.gene);
    if (!gene || gene.retired) return null;
    if (piece.grade !== gene.grade) return null;
    if (!Number.isInteger(piece.q) || !Number.isInteger(piece.r) || piece.shape !== undefined || piece.cells !== undefined) return null;
    if (gene.category === "organ") {
      if (organs.has(gene.id)) return null;
      organs.add(gene.id);
    }
  }
  const result = ATTRIBUTE_DNA.validate({ ...dna, level: nestLevel, budget: Math.min(999999999, budget) });
  if (!result || !ATTRIBUTE_DNA.trace(result.pieces, nestLevel).valid || ATTRIBUTE_DNA.price(result.pieces) > budget) return null;
  return result;
}

export function dnaAppearance(dna) {
  const counts = ATTRIBUTE_DNA.counts(dna.pieces), attributes = {};
  for (const [gene, key] of [["blade", "blade"], ["carapace", "carapace"], ["antenna", "antenna"], ["legs", "feet"], ["secretion", "secretion"]]) {
    if (counts[gene]) attributes[key] = counts[gene];
  }
  return attributes;
}

export function dnaUnitStats(dna, tribe) {
  const stats = ATTRIBUTE_DNA.stats(dna.pieces, tribe);
  return { ...stats, dna: stats, health: stats.health, speed: stats.movement, loadedSpeed: stats.movement * stats.loadSpeed / 100,
    capacity: stats.capacity, vision: stats.vision, attack: stats.power, attackPower: stats.power, attackSpeed: stats.speed,
    defense: stats.armor, attackBonus: 0, armorPenetration: stats.penetration, damageReduction: 0,
    combatStrength: 0, resistance: 1, movementMultiplier: 1, harvestSpeedMultiplier: 1 };
}

export function dnaCanMove(agent, x, y, colonies) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0;
}

export function dnaCanHunt(agent) {
  return !agent.dna && !agent.stats?.dna || !!agent.stats?.dna?.hunting;
}

// The cheapest productive DNA design, not an empty non-gathering body.
// Keep recovery checks tied to the current catalog and validation rules.
export function basicGathererDna(nestLevel = 1) {
  const gene = ATTRIBUTE_DNA.lookup.get("gather");
  const design = { version: 6, level: nestLevel, budget: 999999999,
    pieces: [{ gene: gene.id, grade: gene.grade, rotation: 0, q: 0, r: 0 }] };
  return validateDna(design, nestLevel, design.budget);
}
