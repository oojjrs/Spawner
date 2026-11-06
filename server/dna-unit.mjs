import { ATTRIBUTE_DNA } from "./dna.mjs";

export function cloneDna(dna) {
  if (!dna) return null;
  const value = dna.version === 3 ? dna : ATTRIBUTE_DNA.validate(dna);
  if (!value) return null;
  return { version: value.version, pieces: value.pieces.map(ATTRIBUTE_DNA.clonePiece), budget: value.budget, level: value.level };
}

export function validateDna(dna, nestLevel, budget) {
  if (!dna || dna.version !== 3 || !Array.isArray(dna.pieces)) return null;
  const organs = new Set();
  for (const piece of dna.pieces) {
    const gene = ATTRIBUTE_DNA.lookup.get(piece?.gene);
    if (!gene || gene.retired) return null;
    if (piece.grade !== gene.grade || !Array.isArray(piece.shape) ||
        JSON.stringify(piece.shape) !== JSON.stringify(ATTRIBUTE_DNA.shape(gene, gene.grade))) return null;
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

export function dnaUnitStats(dna) {
  const stats = ATTRIBUTE_DNA.stats(dna.pieces);
  return { ...stats, dna: stats, health: stats.health, speed: stats.movement, loadedSpeed: stats.movement * stats.loadSpeed / 100,
    capacity: stats.capacity, vision: stats.vision, attack: stats.power, attackPower: stats.power, attackSpeed: stats.speed,
    defense: stats.armor, attackBonus: 0, armorPenetration: stats.penetration, damageReduction: 0,
    combatStrength: 0, resistance: 1, movementMultiplier: 1, harvestSpeedMultiplier: 1 };
}

// The antenna rule applies to starting/legacy units as well as DNA designs.
// Wild creatures have no nest and retain their own territorial movement rules.
export function dnaCanMove(agent, x, y, colonies) {
  if (agent.species && !agent.ownerId) return true;
  const roaming = agent.dna ? agent.stats?.dna?.roaming : agent.attributes?.antenna > 0;
  if (roaming) return true;
  const homes = colonies.filter(colony => !agent.ownerId || colony.ownerId === agent.ownerId);
  const distanceFromHome = (px, py) => Math.min(...homes.map(colony => {
    const dx = Math.max(colony.x - px, 0, px - (colony.x + 4));
    const dy = Math.max(colony.y - py, 0, py - (colony.y + 4));
    return Math.hypot(dx, dy);
  }));
  const nextDistance = distanceFromHome(x, y);
  if (nextDistance <= 3) return true;
  // Old saves may already contain an unrestricted unit outside its home range.
  // Let it approach home, but never move laterally or farther out there.
  return Number.isFinite(agent.x) && Number.isFinite(agent.y) &&
    nextDistance < distanceFromHome(agent.x, agent.y);
}

// The cheapest productive DNA design, not an empty non-gathering body.
// Keep recovery checks tied to the current catalog and validation rules.
export function basicGathererDna(nestLevel = 1) {
  const gene = ATTRIBUTE_DNA.lookup.get("gather");
  const design = { version: 3, level: nestLevel, budget: 999999999,
    pieces: [{ gene: gene.id, grade: gene.grade, rotation: 0, shape: [...gene.steps] }] };
  return validateDna(design, nestLevel, design.budget);
}
