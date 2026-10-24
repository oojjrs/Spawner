export function isTreeFood(food, world) {
  return Boolean(food && (!food.resourceType || food.resourceType === "tree-fruit") &&
    !["corpse", "food", "resource"].includes(food.kind) && food.terrain === "forest" &&
    !world.hazards?.[food.y * 320 + food.x]);
}
