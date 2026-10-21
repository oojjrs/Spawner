export function isTreeFood(food, world) {
  return Boolean(food && food.kind !== "corpse" && food.terrain === "forest" &&
    !world.hazards?.[food.y * 320 + food.x]);
}
