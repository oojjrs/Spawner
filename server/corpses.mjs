export const CORPSE_LIFETIME = 3;

export function placeCorpse(food, corpse) {
  for (const key of ["resourceType", "amount", "initialAmount", "carapaceAmount"]) delete corpse[key];
  for (const key of ["attributes", "appearanceAttributes"]) {
    if (!corpse[key]) continue;
    delete corpse[key].butchery;
    delete corpse[key].condensation;
    delete corpse[key].construction;
    delete corpse[key].lifespan;
    delete corpse[key].excavation;
    delete corpse[key].guard;
    delete corpse[key].regeneration;
  }
  corpse.id = "corpse:" + corpse.agentId;
  corpse.key = corpse.id;
  corpse.decaysAt = corpse.diedAt + CORPSE_LIFETIME;
  food.set(corpse.key, corpse);
  return corpse;
}

export function expireCorpses(food, simSeconds) {
  for (const [key, cell] of food) {
    if (cell.kind !== "corpse") continue;
    if (!Number.isFinite(cell.diedAt)) { food.delete(key); continue; }
    cell.decaysAt = cell.diedAt + CORPSE_LIFETIME;
    if (simSeconds >= cell.decaysAt) { food.delete(key); continue; }
    if (key !== "corpse:" + cell.agentId) food.delete(key);
    placeCorpse(food, cell);
  }
}
