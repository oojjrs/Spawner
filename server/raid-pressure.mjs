import { resourceEvolutionPoints } from "./resource-points.mjs";
import { nestUpgradeCost } from "./nests.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { PLAYER_STARTING_POINTS } from "./tribe-start.mjs";
import { CONQUEST_PACING, militaryAgent } from "./conquest-pacing.mjs";

export const COLONY_RAID_CADENCE = Object.freeze([
  Object.freeze({ elapsed:0, fastInterval:120, slowInterval:150, concurrent:1 }),
  Object.freeze({ elapsed:180, fastInterval:90, slowInterval:120, concurrent:2 }),
  Object.freeze({ elapsed:420, fastInterval:60, slowInterval:90, concurrent:3 })
]);

export function colonyRaidCadence(seconds, pressure, readiness) {
  const elapsed = seconds - CONQUEST_PACING.neutralConflictAt;
  const phase = COLONY_RAID_CADENCE.findLast(entry => elapsed >= entry.elapsed) || COLONY_RAID_CADENCE[0];
  const value = Number.isFinite(pressure) ? Math.max(0, Math.min(1, pressure)) : .5;
  const interval = 5 * Math.round((phase.slowInterval - value * (phase.slowInterval - phase.fastInterval)) / 5);
  return { interval:readiness?.recovering ? Math.max(180, interval) : interval,
    concurrent:readiness ? Math.min(phase.concurrent, readiness.concurrent) : phase.concurrent };
}

export function colonyRaidReadiness(game, colony, seconds, lastFoodAt) {
  if (!Number.isInteger(game.nestLevel)) return null;
  const living = game.agents.filter(agent => agent.health > 0 && !(agent.birth?.readyAt > seconds));
  const workers = living.filter(agent => agent.stats?.capacity > 0 && (!agent.dna || agent.stats?.dna?.harvest > 0));
  const defense = living.filter(agent => militaryAgent(agent, colony.tribe) &&
    Math.hypot(agent.x - colony.x - 2, agent.y - colony.y - 2) <= 12)
    .reduce((sum, agent) => sum + Math.max(0, agent.cost || 0) * Math.min(1, agent.health / Math.max(1, agent.stats?.health || agent.health)), 0);
  const nest = game.nest;
  const recovering = workers.length < 3 || nest?.health < nest?.maxHealth * .6 ||
    Number.isFinite(game.colonyFood) && seconds - lastFoodAt >= 90;
  let stage = 0;
  if (!recovering && seconds >= 720 && game.nestLevel >= 3 && workers.length >= 6 && defense >= 240) stage = 1;
  if (!recovering && seconds >= 1800 && game.nestLevel === 4 && workers.length >= 8 && defense >= 450) stage = 2;
  return { recovering, stage, concurrent:!recovering && game.nestLevel === 4 && defense >= 450 ? 2 : 1 };
}

export const COLONY_RAID_PRESSURE = Object.freeze({ openingSeconds:120, nearbySeconds:60, exposedBurrows:2,
  fastInterval:60, slowInterval:120, arrivalGrace:0, slowArrivalGrace:30, fundingGrace:20, maximumArrivalAt:300 });

export function colonyRaidPressure(delivered, seconds, approaches, firstAt, tribe) {
  const cost = ids => ATTRIBUTE_DNA.cost(ids.map(gene => ({ gene, grade:ATTRIBUTE_DNA.lookup.get(gene).grade })));
  const investment = Math.max(1, nestUpgradeCost(1, tribe) + cost(["gather", "capacity", "capacity", "health"]) +
    2 * cost(["blade", "power", "health", "health", "movement"]) - PLAYER_STARTING_POINTS);
  const rate = resourceEvolutionPoints(delivered) * 60 / Math.max(1, seconds);
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
