import { attributeCounts, unitStats } from "./attributes.mjs";
import { AGENT_LIFESPAN } from "./lifespan.mjs";

export const AGENT_GROWTH_THRESHOLDS = Object.freeze([0, 15, 35, 60, 90, 120, 155, 195, 240, 290, 345, 405]);

export function agentGrowth(agent, simSeconds) {
  const age = Math.max(0, simSeconds - agent.bornAt);
  const activity = Math.max(0, Number.isFinite(agent.growthActivity) ? agent.growthActivity : 0);
  const experience = age + Math.min(age * 0.4, activity);
  let level = 1;
  while (experience >= growthThreshold(level + 1)) level++;
  return { level, experience, activeSlots: [...agent.slots] };
}

export function growthThreshold(level) {
  if (level <= AGENT_GROWTH_THRESHOLDS.length) return AGENT_GROWTH_THRESHOLDS[level - 1];
  const extra = level - AGENT_GROWTH_THRESHOLDS.length;
  return 405 + extra * 60 + extra * (extra + 1) * 2.5;
}

export function applyAgentGrowth(agent, simSeconds) {
  const growth = agentGrowth(agent, simSeconds);
  if (agent.level === growth.level && agent.activeSlots?.join(",") === growth.activeSlots.join(",")) return false;
  const previousHealth = agent.stats.health;
  const previousLifespan = agent.stats.lifespan || AGENT_LIFESPAN;
  agent.level = growth.level;
  agent.activeSlots = growth.activeSlots;
  agent.attributes = attributeCounts(agent.activeSlots);
  agent.stats = unitStats(agent.attributes, agent.tribe);
  agent.lifespan = (Number.isFinite(agent.lifespan) ? agent.lifespan : previousLifespan) + agent.stats.lifespan - previousLifespan;
  agent.health = Math.min(agent.stats.health, agent.health + Math.max(0, agent.stats.health - previousHealth));
  return true;
}
