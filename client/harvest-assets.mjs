export const RESOURCE_HARVEST_ANIMATIONS = Object.freeze([
  ["honey-mushrooms", 8],
  ["berry-bush", 8],
  ["tree-fruit", 8],
  ["seed-pods", 8],
  ["root-bulbs", 8],
  ["nutrient-moss", 8],
  ["meat", 8],
  ["pebbles", 4],
  ["clay", 4],
  ["sand", 4],
  ["grass-fiber", 7],
  ["iron-ore", 5],
  ["copper-ore", 5],
  ["quartz", 5]
].map(([resourceType, contactFrame]) => Object.freeze({
  resourceType,
  image: resourceType === "clay" ? "DesignAssets/Animations/Resources/FertileSoil/harvest-sheet.png" :
    "DesignAssets/Animations/Resources/HarvestV1/" + (resourceType === "tree-fruit" ? "berry-bush" : resourceType) + "/sheet.png",
  frameSize: 256,
  columns: resourceType === "clay" ? 4 : 6,
  frameCount: resourceType === "clay" ? 13 : 21,
  contactFrame: resourceType === "clay" ? 3 : contactFrame,
  settleFrame: resourceType === "clay" ? 12 : ["berry-bush", "tree-fruit", "seed-pods", "root-bulbs", "nutrient-moss", "meat"].includes(resourceType) ? 19 : 20,
  preFrameCount: resourceType === "clay" ? 3 : null,
  postFrameDurationsMs: resourceType === "clay" ? Object.freeze([20, 100, 80, 40, 30, 25, 15, 20, 20]) : null,
  postSeconds: resourceType === "clay" ? 0.35 : 0.6,
  pivotX: 128,
  pivotY: 224,
  viewSize: 208
})));

