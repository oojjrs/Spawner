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
    await Promise.all([{ blade: 1 }, { carapace: 1 }, { secretion: 1 }, { blade: 1, carapace: 1 }]
      .map(attributes => art.prepare({ tribe: key, attributes })));
    prepared.add(key);
  }
  function frame(agent, time) { return art.frame(agent, time); }
  function portrait(agent) {
    return art.frame({ ...agent, health: 1, birth: null, attack: null, support: null, hurtStartedAt: -Infinity,
      moveDuration: 0, mode: "idle", bornAt: 0, animationStartedAt: 0 }, 0);
  }
  function bodySize(agent) {
    const definition = unitActionArtDefinition(agent), bounds = definition && art.referenceBounds(definition.reference);
    return bounds ? { width: bounds.width, height: bounds.height } : null;
  }
  return { prepare, frame, portrait, bodySize, ready: tribe => prepared.has(tribe || "bean"), clearDeaths() {} };
}
