import { worldSize } from "./world-size.mjs";
export function isTreeFood(food, world) {
  return Boolean(food && (!food.resourceType || food.resourceType === "tree-fruit") &&
    !["corpse", "food", "resource"].includes(food.kind) && food.terrain === "forest" &&
    !world.hazards?.[food.y * worldSize(world) + food.x]);
}
