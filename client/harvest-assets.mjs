const drawnDurations = Object.freeze([500, 63, 62, 63, 62, 63, 62, 63, 62]);
const drawnAnimations = Object.freeze(Object.fromEntries([
  ["tree", "HarvestDrawnV2/wood", 256, 419, 400],
  ["pebbles", "HarvestDrawnV2/pebbles", 256, 445, 462],
  ["dew", "HarvestDrawnV3/dew", 256, 375, 192]
].map(([key, path, pivotX, pivotY, viewSize]) => [key, {
  image: "DesignAssets/Animations/Resources/" + path + "/harvest-sheet.png",
  frameSize: 512, columns: 3, frameCount: 9, loopDurationsMs: drawnDurations,
  contactFrame: 4, settleFrame: 0, pivotX, pivotY, viewSize
}])));

export const RESOURCE_HARVEST_ANIMATIONS = Object.freeze([
  ["honey-mushrooms", 8],
  ["tree", 4],
  ["dew", 4],
  ["pebbles", 4],
  ["clay", 4],
  ["sand", 30],
  ["grass-fiber", 7]
].map(([resourceType, contactFrame]) => Object.freeze({
  resourceType,
  image: resourceType === "clay" ? "DesignAssets/Animations/Resources/FertileSoil/harvest-sheet.png" :
    "DesignAssets/Animations/Resources/HarvestV1/" + (resourceType === "tree-fruit" ? "berry-bush" : resourceType) + "/sheet.png",
  frameSize: 256,
  columns: resourceType === "clay" ? 4 : 6,
  frameCount: resourceType === "clay" ? 13 : 21,
  contactFrame: resourceType === "clay" ? 3 : contactFrame,
  settleFrame: resourceType === "clay" ? 12 : ["berry-bush", "tree-fruit", "seed-pods", "root-bulbs", "nutrient-moss"].includes(resourceType) ? 19 : 20,
  preFrameCount: resourceType === "clay" ? 3 : null,
  postFrameDurationsMs: resourceType === "clay" ? Object.freeze([20, 100, 80, 40, 30, 25, 15, 20, 20]) : null,
  postSeconds: resourceType === "clay" ? 0.35 : 0.6,
  pivotX: 128,
  pivotY: 224,
  viewSize: 208,
  ...(resourceType === "sand" ? {
    image: "DesignAssets/Animations/Resources/SandBurst/harvest-sheet.png",
    frameCount: 43,
    settleFrame: 42,
    preFrameCount: 30,
    viewSize: 238
  } : {}),
  ...(drawnAnimations[resourceType] || {})
})));

