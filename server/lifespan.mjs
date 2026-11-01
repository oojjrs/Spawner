import { TRIBE_UNIT_STATS } from "./unit-stats.mjs";

export const AGENT_LIFESPAN = TRIBE_UNIT_STATS.bean.lifespan;
export const AGENT_DEATH_WARNING = 60;
export const CORPSE_LIFETIME = 300;

export function tribeLifespan(tribe) {
  return (TRIBE_UNIT_STATS[tribe] || TRIBE_UNIT_STATS.bean).lifespan;
}

export function corpseRecoveryAmount(cost, tribe) {
  return Math.floor(Math.max(0, cost) * (["pebble", "spring"].includes(tribe) ? 8 : 5) / 10);
}

export function placeCorpse(food, corpse) {
  corpse.resourceType = "nutrients";
  delete corpse.carapaceAmount;
  corpse.amount = Math.floor(Math.max(0, corpse.amount));
  if (corpse.amount <= 0) return null;
  const position = corpse.x + "," + corpse.y;
  corpse.id = "corpse:" + corpse.agentId;
  if (!Number.isFinite(corpse.initialAmount)) corpse.initialAmount = Math.max(0, corpse.amount);
  corpse.initialAmount = Math.floor(corpse.initialAmount);
  corpse.key = food.has(position) ? corpse.id : position;
  food.set(corpse.key, corpse);
  return corpse;
}

export function expireCorpses(food, simSeconds) {
  for (const [key, cell] of food) {
    if (cell.kind !== "corpse") continue;
    if (cell.resourceType === "carapace") { food.delete(key); continue; }
    if (!cell.resourceType || cell.resourceType === "meat") cell.resourceType = "nutrients";
    delete cell.carapaceAmount;
    cell.amount = Math.floor(Math.max(0, cell.amount));
    if (!Number.isFinite(cell.diedAt)) cell.diedAt = simSeconds;
    if (!Number.isFinite(cell.decaysAt) || cell.decaysAt < cell.diedAt + CORPSE_LIFETIME) cell.decaysAt = cell.diedAt + CORPSE_LIFETIME;
    if (!Number.isFinite(cell.initialAmount)) cell.initialAmount = Math.max(0, cell.amount);
    cell.initialAmount = Math.floor(cell.initialAmount);
    if (cell.amount <= 0 || simSeconds >= cell.decaysAt) food.delete(key);
  }
}
