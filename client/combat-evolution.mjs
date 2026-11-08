import { UNIT_COMBINATION_FORMS } from "./unit-combination-forms.mjs";
import { createUnitActionArt, unitActionArtDefinition, unitActionArtPose } from "./unit-action-art.mjs";
import { unitDisplayAttributesFrom } from "./unit-display-appearance.mjs";

export const COMBAT_EVOLUTION_KEYS = Object.freeze(["blade", "piercing", "carapace"]);

export function combatEvolutionKeys(attributes) {
  const display = unitDisplayAttributesFrom(attributes);
  return COMBAT_EVOLUTION_KEYS.filter(key => display?.[key] > 0);
}

export function combatEvolutionPose(agent, time, animations) { return unitActionArtPose(agent, time); }

export function createCombatEvolutionArt(assetSource, createSurface, loadImage) {
  const art = createUnitActionArt(assetSource, createSurface, loadImage), prepared = new Set();
  async function prepare(tribe) {
    const key = tribe || "bean";
    await Promise.all([{ blade: 1 }, { carapace: 1 }, { secretion: 1 }, ...UNIT_COMBINATION_FORMS.map(form => form.attributes)]
      .map(attributes => art.prepare({ tribe: key, attributes })));
    prepared.add(key);
  }
  function portraitAgent(agent) {
    return { ...agent, health: 1, birth: null, attack: null, support: null, combat: null, hurtStartedAt: -Infinity,
      moveDuration: 0, mode: "idle", bornAt: 0, animationStartedAt: 0 };
  }
  async function prepareAgent(agent, time, retry) {
    await Promise.all([art.prepare(agent, time, retry), art.prepare(portraitAgent(agent), 0, retry)]);
  }
  function readyAgent(agent) {
    return art.readyFrame(portraitAgent(agent), 0);
  }
  function frame(agent, time) { return art.frame(agent, time); }
  function portrait(agent) {
    return art.frame(portraitAgent(agent), 0);
  }
  function bodySize(agent) {
    const definition = unitActionArtDefinition(agent), bounds = definition && art.referenceBounds(definition.reference);
    return bounds ? { width: bounds.width, height: bounds.height } : null;
  }
  return { prepare, prepareAgent, readyAgent, frame, portrait, bodySize, ready: tribe => prepared.has(tribe || "bean"), clearDeaths() {} };
}
