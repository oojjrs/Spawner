export function tribeHazardKind(tribe, hazard) {
  if (hazard === 1 || hazard === 2) return 0;
  return hazard || 0;
}

export function tribeTerrainWalkable(tribe, terrain) {
  return terrain >= 2 && terrain <= 10 && !(tribe === "pebble" && terrain === 9);
}

export function tribeTerrainSpeedMultiplier(tribe, terrain) {
  if (terrain === 9) return tribe === "pebble" ? 0 : tribe === "spring" ? .8 : tribe === "spore" ? .6 : .2;
  if (tribe === "spring" && (terrain === 2 || terrain === 10)) return 1;
  if (tribe === "pebble") {
    if (terrain === 6) return .8;
    if (terrain === 7) return .6;
    if (terrain === 8) return 1;
  }
  return terrain === 2 ? .8 : terrain === 6 ? .6 : terrain === 7 ? .4 : terrain === 8 ? .9 : terrain === 10 ? .5 : 1;
}

export function tribeSafeTerrain(tribe, terrain, hazard) {
  return tribeTerrainWalkable(tribe, terrain) && !tribeHazardKind(tribe, hazard);
}
