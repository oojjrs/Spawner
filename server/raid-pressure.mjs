import { nestUpgradeCost } from "./nests.mjs";
import { birthCost } from "./attributes.mjs";
import { CONQUEST_PACING } from "./conquest-pacing.mjs";

export const COLONY_RAID_CADENCE = Object.freeze([
  Object.freeze({ elapsed:0, fastInterval:120, slowInterval:150, concurrent:2 }),
  Object.freeze({ elapsed:180, fastInterval:90, slowInterval:120, concurrent:3 }),
  Object.freeze({ elapsed:420, fastInterval:60, slowInterval:90, concurrent:4 })
]);

export function colonyRaidCadence(seconds, pressure) {
  const elapsed = seconds - CONQUEST_PACING.neutralConflictAt;
  const phase = COLONY_RAID_CADENCE.findLast(entry => elapsed >= entry.elapsed) || COLONY_RAID_CADENCE[0];
  const value = Number.isFinite(pressure) ? Math.max(0, Math.min(1, pressure)) : .5;
  return { interval:5 * Math.round((phase.slowInterval - value * (phase.slowInterval - phase.fastInterval)) / 5),
    concurrent:phase.concurrent };
}

export const COLONY_RAID_PRESSURE = Object.freeze({ openingSeconds:120, nearbySeconds:60, exposedBurrows:2,
  fastInterval:60, slowInterval:120, arrivalGrace:35, slowArrivalGrace:105, fundingGrace:20, maximumArrivalAt:300 });

export function colonyRaidPressure(delivered, seconds, approaches, firstAt, tribe) {
  const investment = nestUpgradeCost(1, tribe) + birthCost({slots:["antenna", "feet"]}, tribe) + birthCost({slots:["strength"]}, tribe);
  const rate = delivered * 60 / Math.max(1, seconds);
  const low = investment * 60 / (COLONY_RAID_PRESSURE.openingSeconds * 1.5), high = investment * 60 / COLONY_RAID_PRESSURE.openingSeconds;
  const production = Math.max(0, Math.min(1, (rate - low) / (high - low)));
  const nearby = approaches.filter(seconds => seconds <= COLONY_RAID_PRESSURE.nearbySeconds).length;
  const exposure = Math.min(1, nearby / COLONY_RAID_PRESSURE.exposedBurrows);
  const pressure = production * (.6 + .4 * exposure);
  const interval = 5 * Math.round((COLONY_RAID_PRESSURE.slowInterval -
    pressure * (COLONY_RAID_PRESSURE.slowInterval - COLONY_RAID_PRESSURE.fastInterval)) / 5);
  const fundingAt = rate > 0 ? investment * 60 / rate + COLONY_RAID_PRESSURE.fundingGrace : COLONY_RAID_PRESSURE.maximumArrivalAt;
  const arrivalAt = Math.max(firstAt + COLONY_RAID_PRESSURE.slowArrivalGrace -
    pressure * (COLONY_RAID_PRESSURE.slowArrivalGrace - COLONY_RAID_PRESSURE.arrivalGrace),
    Math.min(COLONY_RAID_PRESSURE.maximumArrivalAt, fundingAt));
  return { version:1, rate, pressure, nearby, interval, arrivalAt };
}
