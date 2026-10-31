import { attributeCounts, unitStats } from "./attributes.mjs";
import { AGENT_LIFESPAN } from "./lifespan.mjs";

export const AGENT_GROWTH_BONUSES = Object.freeze({ movement: .02, harvest: .03, combatStrength: .5 });

export const AGENT_GROWTH_THRESHOLDS = Object.freeze([0, 15, 33, 54, 78, 105, 135, 168, 204, 243]);

export function agentGrowth(agent, simSeconds) {
  const experience = Math.max(0, Number.isFinite(agent.growthActivity) ? agent.growthActivity : 0);
  let level = 1;
  while (experience >= growthThreshold(level + 1)) level++;
  return { level, experience, activeSlots: [...agent.slots] };
}

export function growthThreshold(level) {
  return 1.5 * (level - 1) * (level + 8);
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
  const ranks = growth.level - 1;
  agent.stats.movementMultiplier = (agent.stats.movementMultiplier ?? 1) * (1 + ranks * AGENT_GROWTH_BONUSES.movement);
  agent.stats.harvestSpeedMultiplier = 1 + ranks * AGENT_GROWTH_BONUSES.harvest;
  agent.stats.combatStrength += ranks * AGENT_GROWTH_BONUSES.combatStrength;
  agent.lifespan = (Number.isFinite(agent.lifespan) ? agent.lifespan : previousLifespan) + agent.stats.lifespan - previousLifespan;
  agent.health = Math.min(agent.stats.health, agent.health + Math.max(0, agent.stats.health - previousHealth));
  return true;
}
