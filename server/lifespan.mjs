export const AGENT_LIFESPAN = 300;
export const AGENT_LIFESPAN_BONUS = 120;
export const AGENT_DEATH_WARNING = 60;

export function agentRemainingLifespan(agent, time) {
  if (!Number.isFinite(agent.lifespan) || agent.lifespan <= 0) return Infinity;
  return Math.max(0, agent.lifespan - Math.max(0, time - (agent.lifespanStartedAt ?? agent.bornAt)));
}
