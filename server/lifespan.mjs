export const AGENT_LIFESPAN = 3 * 60;
export const AGENT_DEATH_WARNING = 60;
export const CORPSE_LIFETIME = 5 * 60;

export function placeCorpse(food, corpse) {
  const position = corpse.x + "," + corpse.y;
  corpse.id = "corpse:" + corpse.agentId;
  corpse.key = food.has(position) ? corpse.id : position;
  food.set(corpse.key, corpse);
  return corpse;
}

export function expireCorpses(food, simSeconds) {
  for (const [key, cell] of food) {
    if (cell.kind !== "corpse") continue;
    if (!Number.isFinite(cell.diedAt)) cell.diedAt = simSeconds;
    if (!Number.isFinite(cell.decaysAt) || cell.decaysAt < cell.diedAt + CORPSE_LIFETIME) cell.decaysAt = cell.diedAt + CORPSE_LIFETIME;
    if (cell.amount <= 0 || simSeconds >= cell.decaysAt) food.delete(key);
  }
}
