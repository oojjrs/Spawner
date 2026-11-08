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

export function dnaCanAttack(agent) {
  return !!(agent.stats?.dna?.melee || agent.stats?.dna?.ranged || agent.stats?.dna?.hunting ||
    agent.dna?.pieces?.some(piece => piece.gene === "carapace"));
}

export function dnaCanExplore(agent) {
  return !agent.dna && !agent.stats?.dna || agent.stats?.dna?.antennaCount > 0;
}

export function dnaCanPatrol(agent, target, explored, size, time) {
  const radius = (agent.stats?.vision || 0) + (agent.waveUntil > time ? 4 : 0);
  const extent = Math.floor(radius);
  for (let dy = -extent; dy <= extent; dy++) for (let dx = -extent; dx <= extent; dx++) {
    const x = target.x + dx, y = target.y + dy;
    if (x < 0 || y < 0 || x >= size || y >= size || dx * dx + dy * dy > radius * radius) continue;
    if (!explored.has(y * size + x)) return false;
  }
  return explored.has(target.y * size + target.x);
}

export function dnaCanHunt(agent) {
  return !agent.dna && !agent.stats?.dna || !!agent.stats?.dna?.hunting;
}

export function dnaCanSearch(agent, target, time) {
  if (dnaCanHunt(agent)) return true;
  const x = Math.max(target.x, Math.min(agent.x, target.x + (target.width || 1) - 1));
  const y = Math.max(target.y, Math.min(agent.y, target.y + (target.height || 1) - 1));
  return Math.hypot(x - agent.x, y - agent.y) <= (agent.stats?.vision || 0) + (agent.waveUntil > time ? 4 : 0);
}

// The cheapest productive DNA design, not an empty non-gathering body.
// Keep recovery checks tied to the current catalog and validation rules.
export function basicGathererDna(nestLevel = 1) {
  const gene = ATTRIBUTE_DNA.lookup.get("gather");
  const design = { version: 6, level: nestLevel, budget: 999999999,
    pieces: [{ gene: gene.id, grade: gene.grade, rotation: 0, q: 0, r: 0 }] };
  return validateDna(design, nestLevel, design.budget);
}
