import { CONQUEST_PACING } from "./conquest-pacing.mjs";

export const NEST_LEVELS = [
  { health: 100, slotCapacity: 1, pointCapacity: 100, upgradeCost: CONQUEST_PACING.nestCosts[0] },
  { health: 200, slotCapacity: 2, pointCapacity: 500, upgradeCost: CONQUEST_PACING.nestCosts[1] },
  { health: 400, slotCapacity: 3, pointCapacity: 2500, upgradeCost: CONQUEST_PACING.nestCosts[2] },
  { health: 800, slotCapacity: 4, pointCapacity: 12500, upgradeCost: null }
];

export function nestUpgradeCost(level, tribe) {
  const cost = NEST_LEVELS[level - 1].upgradeCost;
  return cost !== null && tribe === "pebble" ? cost * .75 : cost;
}
