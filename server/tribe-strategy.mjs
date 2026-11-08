import { AGENT_DEATH_WARNING, agentRemainingLifespan } from "./lifespan.mjs";
import { militaryAgent } from "./conquest-pacing.mjs";
import { dnaUnitStats } from "./dna-unit.mjs";
import { birthCost } from "./attributes.mjs";
import { nestUpgradeCost } from "./nests.mjs";
import { tribeDesign } from "./tribe-designs.mjs";

export function tribeWorkerTarget(state) {
  return [6, 4, 6, 10][state.nestLevel - 1];
}

export function tribeUpgradeReady(state, tribe) {
  if (state.nestLevel >= 4) return false;
  const workers = tribeWorkers(state, tribe);
  if (workers.length < tribeWorkerTarget(state)) return false;
  if (state.nestLevel > 1 && workers.filter(agent => agent.dna?.level === state.nestLevel).length < 3) return false;
  const reserve = birthCost({ dna: tribeDesign(tribe, state.nestLevel, -1) }, tribe);
  return state.evolutionPoints >= nestUpgradeCost(state.nestLevel, tribe) + reserve;
}

export function tribeWorkers(state, tribe) {
  return state.agents.filter(agent => agent.health > 0 &&
    agentRemainingLifespan(agent, state.simSeconds) > AGENT_DEATH_WARNING && !militaryAgent(agent, tribe) &&
    (!agent.dna || agent.dna.pieces.some(piece => piece.gene === "gather")));
}

export function tribeStrongWorkers(state, tribe) {
  return tribeWorkers(state, tribe).filter(agent => {
    const stats = agent.stats || (agent.dna && dnaUnitStats(agent.dna, tribe));
    return agent.dna?.level === 4 && stats?.capacity >= 10 && stats.dna?.harvestReduction >= 80 && stats.speed >= .7 &&
      agent.health >= stats.health * .5 &&
      (!agent.birth || agent.birth.readyAt <= state.simSeconds);
  });
}

export function tribeInvasionReady(state, tribe) {
  return state.nestLevel === 4 && tribeStrongWorkers(state, tribe).length >= 8;
}

export function tribeDefenseCount(state) {
  return [0, 2, 3, 3][state.nestLevel - 1];
}
