import { UNIT_ACTION_ART_ASSETS } from "./unit-action-art-assets.mjs";
import { UNIT_BIRTH_ART_ASSETS } from "./unit-birth-art-assets.mjs";
import { createUnitActionArt, unitActionArtDefinition } from "./unit-action-art.mjs";

export const TRIBE_ATTRIBUTE_ASSETS = Object.freeze([...UNIT_ACTION_ART_ASSETS, ...UNIT_BIRTH_ART_ASSETS]);

export function hasTribeAttributes(attributes) { return ["antenna", "strength", "arms"].some(key => attributes?.[key] > 0); }

export function createTribeAttributeAnimation(assetSource, createSurface, loadImage) {
  const art = createUnitActionArt(assetSource, createSurface, loadImage);
  async function prepare(tribe) {
    await Promise.all(["base", "strength", "antenna"].map(form => art.prepare({ tribe, attributes: form === "base" ? {} : { [form]: 1 } })));
  }
  function frame(tribe, attributes, source, animation, index, action, time, motion, replacement, layer, sourceAgent) {
    return art.frame(sourceAgent || { tribe, attributes, health: 1, mode: "idle", bornAt: 0 }, time);
  }
  function portrait(tribe, attributes, width, height, box, layer) {
    const surface = createSurface(width, height);
    if (layer && !["full", "body", "combat-body"].includes(layer)) return surface;
    const agent = { tribe, attributes, health: 1, mode: "idle", bornAt: 0 }, definition = unitActionArtDefinition(agent);
    if (!definition || !art.ready(agent)) return null;
    art.draw(surface.getContext("2d"), agent, 0, box.x + box.width / 2, box.y + box.height,
      Math.min(box.width, box.height) / .4, false, null);
    return surface;
  }
  function bodySize(tribe, attributes) {
    const definition = unitActionArtDefinition({ tribe, attributes }), bounds = definition && art.referenceBounds(definition.reference);
    return definition ? { width: (bounds?.width || definition.reference.frameSize * .4) * 144 / definition.reference.frameSize,
      height: (bounds?.height || definition.reference.frameSize * .4) * 144 / definition.reference.frameSize } : null;
  }
  return { prepare, frame, portrait, attackPortrait: portrait, pose: (agent, current) => current, bodySize,
    cacheStats: () => ({ pixels: 0, entries: 0 }) };
}
