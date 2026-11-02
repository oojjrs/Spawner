import { CONQUEST_PACING } from "./conquest-pacing.mjs";

export const NEST_LEVELS = [
  { health: 100, unitCapacity: 10, slotCapacity: 1, pointCapacity: 100, upgradeCost: CONQUEST_PACING.nestCosts[0] },
  { health: 200, unitCapacity: 20, slotCapacity: 2, pointCapacity: 500, upgradeCost: CONQUEST_PACING.nestCosts[1] },
  { health: 400, unitCapacity: 30, slotCapacity: 3, pointCapacity: 2500, upgradeCost: CONQUEST_PACING.nestCosts[2] },
  { health: 800, unitCapacity: 40, slotCapacity: 4, pointCapacity: 12500, upgradeCost: null }
];

export function nestUpgradeCost(level, tribe) {
  const cost = NEST_LEVELS[level - 1].upgradeCost;
  return cost !== null && tribe === "pebble" ? cost * .75 : cost;
}

export function materialCapacity(nestLevel) {
  return [30, 40, 50, 60][Math.max(0, Math.min(3, (nestLevel || 1) - 1))];
}
