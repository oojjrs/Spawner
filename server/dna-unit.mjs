import { ATTRIBUTE_DNA } from "./dna.mjs";

export function cloneDna(dna) {
  if (!dna) return null;
  const value = dna.version === 3 ? dna : ATTRIBUTE_DNA.validate(dna);
  if (!value) return null;
  return { version: value.version, pieces: value.pieces.map(ATTRIBUTE_DNA.clonePiece), budget: value.budget, level: value.level };
}

export function validateDna(dna, nestLevel, budget) {
  if (!dna || dna.version !== 3 || !Array.isArray(dna.pieces)) return null;
  for (const piece of dna.pieces) {
    const gene = ATTRIBUTE_DNA.lookup.get(piece?.gene);
    if (!gene || piece.grade !== gene.grade || !Array.isArray(piece.shape) ||
        JSON.stringify(piece.shape) !== JSON.stringify(ATTRIBUTE_DNA.shape(gene, gene.grade))) return null;
  }
  const result = ATTRIBUTE_DNA.validate({ ...dna, level: nestLevel, budget });
  if (!result || !ATTRIBUTE_DNA.trace(result.pieces, nestLevel).valid || ATTRIBUTE_DNA.price(result.pieces) > budget) return null;
  return result;
}

export function dnaAppearance(dna) {
  const counts = ATTRIBUTE_DNA.counts(dna.pieces), attributes = {};
  for (const [gene, key] of [["blade", "blade"], ["carapace", "carapace"], ["antenna", "antenna"], ["legs", "feet"]]) {
    if (counts[gene]) attributes[key] = counts[gene];
  }
  return attributes;
}

export function dnaUnitStats(dna) {
  const stats = ATTRIBUTE_DNA.stats(dna.pieces);
  return { ...stats, dna: stats, health: stats.health, speed: stats.movement, loadedSpeed: stats.movement * stats.loadSpeed / 100,
    capacity: stats.capacity, vision: stats.vision, attack: stats.power, attackPower: stats.power, attackSpeed: stats.speed,
    defense: stats.armor, attackBonus: 0, armorPenetration: stats.penetration, damageReduction: 0,
    combatStrength: 0, resistance: 1, movementMultiplier: 1, harvestSpeedMultiplier: 1 };
}

export function dnaCanMove(agent, x, y, colonies) {
  if (!agent.dna || agent.stats.dna.roaming) return true;
  return colonies.some(colony => {
    const dx = Math.max(colony.x - x, 0, x - (colony.x + 4));
    const dy = Math.max(colony.y - y, 0, y - (colony.y + 4));
    return Math.hypot(dx, dy) <= 3;
  });
}
