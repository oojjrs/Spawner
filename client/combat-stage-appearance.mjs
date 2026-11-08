import { createUnitActionArt, unitActionArtPose } from "./unit-action-art.mjs";

export function createCombatStageAppearance(loadImage) {
  const surface = (width, height) => {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; return canvas;
  };
  const art = createUnitActionArt(path => globalThis.SpawnerAssets?.source(path) || path, surface, loadImage);
  async function prepare(agent, time) {
    await art.prepareActions(agent, ["idle", "walk", "attack", "ranged", "hurt", "death"], true);
    await art.prepare(agent, time, true);
    const pose = unitActionArtPose(agent, time);
    if (pose) art.referenceBounds(pose.reference);
  }
  function draw(context, agent, time, deathAge, fallback, cell, mirror) {
    if (agent.species) return false;
    const local = agent.health <= 0 ? { ...agent, diedAt: time - deathAge } : agent;
    return art.draw(context, local, time, 0, 0, cell, mirror, null);
  }
  return { prepare, draw };
}
