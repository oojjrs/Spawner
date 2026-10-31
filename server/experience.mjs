import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { unitCombatStats } from "./combat-stats.mjs";

export const AGENT_EXPERIENCE = Object.freeze({ exploration: .1, discovery: 5, harvest: 2, delivery: 3, damage: .1, kill: 5 });

const encounters = new Map(ENCOUNTER_TYPES.map(type => [type.key, type]));

export function addAgentExperience(agent, amount) {
  if (!agent || !Number.isFinite(amount) || amount <= 0) return;
  const previous = Number.isFinite(agent.growthActivity) ? Math.max(0, agent.growthActivity) : 0;
  agent.growthActivity = Math.round((previous + amount) * 1e9) / 1e9;
}

export function combatExperienceMultiplier(target) {
  if (!target.species) return 1;
  if (encounters.get(target.species)?.unique) return 4;
  const strength = unitCombatStats(target.species).combatStrength;
  return strength <= 15 ? .5 : strength >= 36 ? 2 : 1;
}

export function recordCombatExperience(attacker, target, damage, agents) {
  if (!attacker || !Number.isFinite(damage) || damage <= 0 ||
    attacker.ownerId && attacker.ownerId === target.ownerId) return;
  const multiplier = combatExperienceMultiplier(target);
  if (attacker.ownerId && !attacker.species) addAgentExperience(attacker, damage * AGENT_EXPERIENCE.damage * multiplier);
  if (!Array.isArray(target.experienceContributions)) target.experienceContributions = [];
  let contribution = target.experienceContributions.find(entry => entry.agentId === attacker.id);
  if (!contribution) {
    contribution = { agentId: attacker.id, damage: 0 };
    target.experienceContributions.push(contribution);
  }
  contribution.damage += damage;
  if (target.health > 0 || target.experienceKillAwarded) return;
  target.experienceKillAwarded = true;
  const total = target.experienceContributions.reduce((sum, entry) => sum + entry.damage, 0);
  for (const entry of target.experienceContributions) {
    const agent = agents.find(agent => agent.id === entry.agentId && agent.ownerId && !agent.species && agent.health > 0);
    if (agent) addAgentExperience(agent, AGENT_EXPERIENCE.kill * multiplier * entry.damage / total);
  }
}
