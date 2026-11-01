import { attributeCounts, unitStats } from "./attributes.mjs";
import { AGENT_LIFESPAN } from "./lifespan.mjs";

export const AGENT_GROWTH_BONUSES = Object.freeze([
  { movementMultiplier: 1, harvestSpeedMultiplier: 1, combatStrengthBonus: 0 },
  { movementMultiplier: 1.02, harvestSpeedMultiplier: 1.05, combatStrengthBonus: .5 },
  { movementMultiplier: 1.04, harvestSpeedMultiplier: 1.1, combatStrengthBonus: 1 },
  { movementMultiplier: 1.06, harvestSpeedMultiplier: 1.15, combatStrengthBonus: 1.5 },
  { movementMultiplier: 1.08, harvestSpeedMultiplier: 1.2, combatStrengthBonus: 2 },
  { movementMultiplier: 1.1, harvestSpeedMultiplier: 1.25, combatStrengthBonus: 2.5 },
  { movementMultiplier: 1.12, harvestSpeedMultiplier: 1.3, combatStrengthBonus: 3 },
  { movementMultiplier: 1.14, harvestSpeedMultiplier: 1.35, combatStrengthBonus: 3.5 },
  { movementMultiplier: 1.16, harvestSpeedMultiplier: 1.4, combatStrengthBonus: 4 },
  { movementMultiplier: 1.18, harvestSpeedMultiplier: 1.45, combatStrengthBonus: 4.5 }
].map(bonus => Object.freeze(bonus)));

export const AGENT_GROWTH_THRESHOLDS = Object.freeze([0, 15, 33, 54, 78, 105, 135, 168, 204, 243, 285]);

export function agentGrowth(agent, simSeconds) {
  const experience = Math.max(0, Number.isFinite(agent.growthActivity) ? agent.growthActivity : 0);
  let level = 1;
  while (level < AGENT_GROWTH_BONUSES.length && experience >= growthThreshold(level + 1)) level++;
  return { level, experience, activeSlots: [...agent.slots] };
}

export function growthThreshold(level) {
  return AGENT_GROWTH_THRESHOLDS[level - 1] ?? Infinity;
}

export function applyAgentGrowth(agent, simSeconds) {
  const growth = agentGrowth(agent, simSeconds);
  if (agent.level === growth.level && agent.activeSlots?.join(",") === growth.activeSlots.join(",")) return false;
  const previousHealth = agent.stats.health;
  const previousLifespan = agent.stats.lifespan || AGENT_LIFESPAN;
  agent.level = growth.level;
  agent.activeSlots = growth.activeSlots;
  agent.attributes = attributeCounts(agent.activeSlots, agent.attributeLevels);
  agent.stats = unitStats(agent.attributes, agent.tribe);
  const bonus = AGENT_GROWTH_BONUSES[growth.level - 1];
  agent.stats.movementMultiplier *= bonus.movementMultiplier;
  agent.stats.harvestSpeedMultiplier = bonus.harvestSpeedMultiplier;
  agent.stats.combatStrength += bonus.combatStrengthBonus;
  agent.lifespan = (Number.isFinite(agent.lifespan) ? agent.lifespan : previousLifespan) + agent.stats.lifespan - previousLifespan;
  agent.health = Math.min(agent.stats.health, agent.health + Math.max(0, agent.stats.health - previousHealth));
  return true;
}
