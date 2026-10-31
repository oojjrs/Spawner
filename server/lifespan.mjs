export const AGENT_LIFESPAN = 3 * 60;
export const AGENT_DEATH_WARNING = 60;
export const CORPSE_LIFETIME = 5 * 60;

export function tribeLifespan(tribe) {
  return tribe === "pebble" ? 5 * 60 : AGENT_LIFESPAN;
}

export function corpseRecoveryAmount(cost, tribe) {
  return Math.max(0, cost) * (["pebble", "spring"].includes(tribe) ? 7 : 2) / 10;
}

export function placeCorpse(food, corpse) {
  const position = corpse.x + "," + corpse.y;
  corpse.id = "corpse:" + corpse.agentId;
  if (!Number.isFinite(corpse.initialAmount)) corpse.initialAmount = Math.max(0, corpse.amount);
  corpse.key = food.has(position) ? corpse.id : position;
  food.set(corpse.key, corpse);
  return corpse;
}

export function expireCorpses(food, simSeconds) {
  for (const [key, cell] of food) {
    if (cell.kind !== "corpse") continue;
    if (!Number.isFinite(cell.diedAt)) cell.diedAt = simSeconds;
    if (!Number.isFinite(cell.decaysAt) || cell.decaysAt < cell.diedAt + CORPSE_LIFETIME) cell.decaysAt = cell.diedAt + CORPSE_LIFETIME;
    if (!Number.isFinite(cell.initialAmount)) cell.initialAmount = Math.max(0, cell.amount);
    if (cell.amount <= 0 || simSeconds >= cell.decaysAt) food.delete(key);
  }
}
