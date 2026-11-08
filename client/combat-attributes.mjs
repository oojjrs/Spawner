import { unitDisplayAttributesFrom } from "./unit-display-appearance.mjs";
import { createCombatEvolutionArt, combatEvolutionKeys } from "./combat-evolution.mjs";
import { COMBAT_ATTRIBUTE_KEYS } from "../server/attributes.mjs";

export function combatAttributeKeys(attributes) {
  attributes = unitDisplayAttributesFrom(attributes);
  return COMBAT_ATTRIBUTE_KEYS.filter(key => attributes?.[key] > 0);
}

export function hasCombatEvolution(attributes) { return combatEvolutionKeys(attributes).length > 0; }

export function createCombatAttributeArt(assetSource, createSurface, loadImage) {
  const evolution = createCombatEvolutionArt(assetSource, createSurface, loadImage);
  function frame(agent, time, scale, drawBody, drawAttributes) {
    return evolution.frame(agent, time, drawAttributes, drawBody);
  }
  function portrait(agent, drawAttributes) {
    return evolution.portrait(agent, drawAttributes);
  }
  return {
    prepare: tribe => Promise.all([evolution.prepare(tribe)]),
    prepareAgent: (agent, time, retry) => evolution.prepareAgent(agent, time, retry),
    readyAgent: agent => evolution.readyAgent(agent),
    ready: tribe => evolution.ready(tribe), frame, portrait,
    bodySize: (agent, replacement) => evolution.bodySize(agent, replacement) || replacement
  };
}
