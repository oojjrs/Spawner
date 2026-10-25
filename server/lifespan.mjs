export const AGENT_LIFESPAN = 3 * 60;
export const AGENT_DEATH_WARNING = 30;
export const CORPSE_LIFETIME = 60;

export function expireCorpses(food, simSeconds) {
  for (const [key, cell] of food) {
    if (cell.kind !== "corpse") continue;
    if (!Number.isFinite(cell.diedAt)) cell.diedAt = simSeconds;
    if (!Number.isFinite(cell.decaysAt)) cell.decaysAt = cell.diedAt + CORPSE_LIFETIME;
    if (cell.amount <= 0 || simSeconds >= cell.decaysAt) food.delete(key);
  }
}
