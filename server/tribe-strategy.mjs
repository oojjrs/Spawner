import { AGENT_DEATH_WARNING, agentRemainingLifespan } from "./lifespan.mjs";
import { militaryAgent } from "./conquest-pacing.mjs";
import { dnaUnitStats } from "./dna-unit.mjs";

export function tribeWorkers(state, tribe) {
  return state.agents.filter(agent => agent.health > 0 &&
    agentRemainingLifespan(agent, state.simSeconds) > AGENT_DEATH_WARNING && !militaryAgent(agent, tribe) &&
    (!agent.dna || agent.dna.pieces.some(piece => piece.gene === "gather")));
}

export function tribeStrongWorkers(state, tribe) {
  return tribeWorkers(state, tribe).filter(agent => {
    const stats = agent.stats || (agent.dna && dnaUnitStats(agent.dna, tribe));
    return stats?.capacity >= 6 && stats.dna?.harvestReduction >= 80 && stats.speed >= .6 &&
      stats.health >= 60 && agent.health >= stats.health * .5 &&
      (!agent.birth || agent.birth.readyAt <= state.simSeconds);
  });
}

export function tribeInvasionReady(state, tribe) {
  return state.nestLevel === 4 && tribeStrongWorkers(state, tribe).length >= 8;
}

export function tribeDefenseCount(state) {
  return [0, 2, 3, 3][state.nestLevel - 1];
}
