export function initializePlacementMaps(owner, enabled) {
  if (enabled) Object.defineProperty(owner, "placementMaps", { value: [] });
}

export function recordPlacementMap(owner, id, layers, values, details) {
  if (!owner?.placementMaps) return;
  const stage = details?.stage || (/noise|roughness|:draw$|:priority$|sector-priority/.test(id) ? "original" :
    /-mask$|:amount$|^camp:starts$|:spawn$|^burrow:(small|large)$|^terrain:mountains$|^hydrology:(shore|water|river|lake|ford)$/.test(id) ? "final" : "intermediate");
  const field = { id, layers, values, stage, ...details };
  const index = owner.placementMaps.findIndex(item => item.id === id);
  if (index < 0) owner.placementMaps.push(field);
  else owner.placementMaps[index] = field;
}

export function placementNoise(owner, id, layers, sample, details) {
  recordPlacementMap(owner, id, layers, null, { sample, minimum: -1, maximum: 1, ...details });
  return sample;
}
