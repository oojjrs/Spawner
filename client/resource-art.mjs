export const RESOURCE_WORLD_SIZES = Object.freeze({
  tree: .82, dew: .54, pebbles: .68, clay: .78, sand: .74,
  "grass-fiber": .66, "iron-ore": .72, "copper-ore": .72, quartz: .70,
});

const imageBounds = Object.freeze({
  "DesignAssets/Terrain/standing-tree-smooth-atlas.png": { x: 15, y: 16, width: 180, height: 177 },
  "DesignAssets/Resources/wood-carry.png": { x: 26, y: 29, width: 38, height: 33 },
  "DesignAssets/Resources/dew-grass.png": { x: 59, y: 25, width: 92, height: 136 },
  "DesignAssets/Resources/dew-carry.png": { x: 63, y: 60, width: 36, height: 44 },
  "DesignAssets/Resources/pebbles.png": { x: 6, y: 16, width: 165, height: 157 },
  "DesignAssets/Resources/pebbles-carry.png": { x: 44, y: 51, width: 39, height: 40 },
  "DesignAssets/Resources/clay.png": { x: 2, y: 51, width: 171, height: 108 },
  "DesignAssets/Resources/clay-carry.png": { x: 9, y: 22, width: 42, height: 22 },
  "DesignAssets/Resources/sand.png": { x: 3, y: 7, width: 167, height: 160 },
  "DesignAssets/Resources/sand-carry.png": { x: 22, y: 25, width: 39, height: 39 },
  "DesignAssets/ResourceConcepts/v1/resource-grass-fiber.png": { x: 0, y: 3, width: 39, height: 36 },
  "DesignAssets/Resources/iron-ore.png": { x: 47, y: 30, width: 96, height: 143 },
  "DesignAssets/Resources/iron-ore-carry.png": { x: 22, y: 11, width: 23, height: 45 },
  "DesignAssets/Resources/copper-ore.png": { x: 5, y: 88, width: 176, height: 80 },
  "DesignAssets/Resources/copper-ore-carry.png": { x: 7, y: 20, width: 41, height: 20 },
  "DesignAssets/ResourceConcepts/v1/resource-quartz.png": { x: 34, y: 18, width: 117, height: 152 },
  "DesignAssets/Animations/BeetleDeath/dead-v2.png": { x: 22, y: 75, width: 148, height: 91 },
  "DesignAssets/Animations/Resources/HarvestDrawnV2/wood/harvest-sheet.png": { x: 14, y: 8, width: 213, height: 189 },
  "DesignAssets/Animations/Resources/HarvestDrawnV3/dew/harvest-sheet.png": { x: 152, y: 153, width: 229, height: 234 },
  "DesignAssets/Animations/Resources/HarvestDrawnV2/pebbles/harvest-sheet.png": { x: 6, y: 119, width: 190, height: 62 },
  "DesignAssets/Animations/Resources/FertileSoil/harvest-sheet.png": { x: 19, y: 75, width: 191, height: 128 },
  "DesignAssets/Animations/Resources/SandBurst/harvest-sheet.png": { x: 4, y: 86, width: 191, height: 94 },
  "DesignAssets/Animations/Resources/HarvestV1/grass-fiber/sheet.png": { x: 18, y: 54, width: 192, height: 148 }
});

export function resourceImageBounds(source) {
  return imageBounds[source];
}

export function resourceNodePlacement(resourceType, bounds, frameWidth, frameHeight, tileSize) {
  const extent = RESOURCE_WORLD_SIZES[resourceType] || .72;
  const scale = tileSize * extent / Math.max(bounds.width, bounds.height);
  return { x: tileSize * .5 - (bounds.x + bounds.width / 2) * scale,
    y: tileSize * .92 - (bounds.y + bounds.height) * scale,
    width: frameWidth * scale, height: frameHeight * scale, scale };
}

export function resourceCarryScale(bounds) {
  return .28 / Math.max(bounds.width, bounds.height);
}
