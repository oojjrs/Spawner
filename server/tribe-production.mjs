import { birthCost } from "./attributes.mjs";
import { basicGathererDna } from "./dna-unit.mjs";
import { suggestTemplateName } from "./unit-template-names.mjs";
import { NEST_LEVELS } from "./nests.mjs";
import { militaryAgent } from "./conquest-pacing.mjs";
import { TRIBE_INVASION, tribeDesign, sameTribeDesign, tribeDnaTemplate } from "./tribe-designs.mjs";
import { tribeCombatTemplates } from "./tribe-combat-templates.mjs";
import { tribeDefenseDesign } from "./tribe-defense-designs.mjs";
import { nestDefenderDesign } from "./nest-defender.mjs";
import { tribeWorkers, tribeStrongWorkers, tribeInvasionReady, tribeDefenseCount, tribeWorkerTarget } from "./tribe-strategy.mjs";

export function tribeProductionTemplate(state, tribe) {
  const profile = TRIBE_INVASION[tribe];
  if (!profile) return null;
  const living = state.agents.filter(agent => agent.health > 0);
  if (living.length >= NEST_LEVELS[state.nestLevel - 1].unitCapacity) return null;
  const workers = tribeWorkers(state, tribe);
  const soldiers = living.filter(agent => militaryAgent(agent, tribe));
  const recovering = !living.some(agent => !militaryAgent(agent, tribe) &&
    (!agent.dna || agent.dna.pieces.some(piece => piece.gene === "gather")));
  const target = tribeWorkerTarget(state);
  const current = workers.filter(agent => agent.dna?.level === state.nestLevel);
  const productive = living.filter(agent => !militaryAgent(agent, tribe) && agent.dna?.pieces.some(piece => piece.gene === "gather"));
  const defending = productive.length >= 3 && current.length >= 1;
  const defenseTarget = state.nestLevel < 4 ? Math.min(1, tribeDefenseCount(state)) : tribeDefenseCount(state);
  if (defending && soldiers.length < defenseTarget) {
    const dna = state.nestLevel === 2 ? nestDefenderDesign(tribe).design : tribeDefenseDesign(tribe, state.nestLevel, soldiers.length);
    const template = tribeDnaTemplate(dna, "military", state);
    if (state.nestLevel === 2) template.defenseMode = "nest";
    const reserve = birthCost({ dna: basicGathererDna(state.nestLevel) }, tribe);
    return state.evolutionPoints >= birthCost(template, tribe) + reserve ? template : null;
  }
  const strengthening = state.nestLevel === 4 && tribeStrongWorkers(state, tribe).length < 8 && workers.length < 12;
  if (workers.length < target || strengthening || state.nestLevel > 1 && state.nestLevel < 4 && current.length < 3) {
    for (let level = state.nestLevel; level >= 1; level--) {
      const dna = tribeDesign(tribe, level, -1);
      const template = tribeDnaTemplate(dna, "worker", state);
      if (state.evolutionPoints >= birthCost(template, tribe)) return template;
      if (!recovering) return null;
    }
    const basic = tribeDnaTemplate(basicGathererDna(state.nestLevel), "worker", state);
    if (state.evolutionPoints >= birthCost(basic, tribe)) return basic;
    const legacy = { id: null, name: suggestTemplateName([], state.templates), slots: [], attributeLevels: {}, revision: 1, productionRole: "worker" };
    return !workers.length && state.templates.some(template => !template.dna) &&
      state.evolutionPoints >= birthCost(legacy, tribe) ? legacy : null;
  }
  if (!tribeInvasionReady(state, tribe)) return null;
  const templates = tribeCombatTemplates(tribe).map(design => {
    const template = tribeDnaTemplate(design.dna, "military", state);
    return { template, weight: design.weight, count: soldiers.filter(agent => sameTribeDesign(agent, template)).length };
  });
  templates.sort((a, b) => a.count / a.weight - b.count / b.weight || b.weight - a.weight);
  const template = templates[0].template;
  const reserve = birthCost({ dna: tribeDesign(tribe, state.nestLevel, -1) }, tribe);
  return state.evolutionPoints >= birthCost(template, tribe) + reserve ? template : null;
}
