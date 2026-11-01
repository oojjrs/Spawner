export const WORLD_SIZE = 160;

export function worldSize(world) {
  return world?.size || Math.sqrt(world?.terrain?.length || world?.hazards?.length || 320 * 320);
}
