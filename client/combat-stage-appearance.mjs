import { createUnitActionArt } from "./unit-action-art.mjs";

export function createCombatStageAppearance(image) {
  const surface = (width, height) => {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; return canvas;
  };
  const load = async path => {
    const cached = image(path);
    if (cached) return cached;
    const asset = globalThis.SpawnerAssets?.image?.() || new Image();
    asset.src = globalThis.SpawnerAssets?.source(path) || path; await asset.decode(); return asset;
  };
  const art = createUnitActionArt(path => globalThis.SpawnerAssets?.source(path) || path, surface, load);
  function draw(context, agent, time, deathAge, fallback, cell, mirror) {
    if (agent.species) return false;
    const local = agent.health <= 0 ? { ...agent, diedAt: time - deathAge } : agent;
    return art.draw(context, local, time, 0, 0, cell, mirror, null);
  }
  return { draw };
}
