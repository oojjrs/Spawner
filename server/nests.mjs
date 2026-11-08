import { CONQUEST_PACING } from "./conquest-pacing.mjs";

export const NEST_RECOVERY = Object.freeze({ delay: 15, rate: .005 });

export const NEST_LEVELS = [
  { health: 100, unitCapacity: 10, slotCapacity: 1, pointCapacity: 200, upgradeCost: CONQUEST_PACING.nestCosts[0] },
  { health: 200, unitCapacity: 20, slotCapacity: 2, pointCapacity: 500, upgradeCost: CONQUEST_PACING.nestCosts[1] },
  { health: 400, unitCapacity: 30, slotCapacity: 3, pointCapacity: 1000, upgradeCost: CONQUEST_PACING.nestCosts[2] },
  { health: 800, unitCapacity: 40, slotCapacity: 4, pointCapacity: 2000, upgradeCost: null }
];

export function nestUpgradeCost(level, tribe) {
  const cost = NEST_LEVELS[level - 1].upgradeCost;
  return cost !== null && tribe === "pebble" ? cost * .75 : cost;
}
