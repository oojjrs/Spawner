export const BUILDING_TYPES = Object.freeze([
  { key: "storage", name: "창고", minNestLevel: 1, width: 2, height: 2, health: 120, storageCapacity: 300, visionRadius: 2, description: "군락의 자원 보관량을 300개 늘립니다." },
  { key: "evolution-lab", name: "진화실", minNestLevel: 2, width: 2, height: 2, health: 100, storageCapacity: 0, visionRadius: 2, description: "주변 2칸의 시야를 확보합니다." },
  { key: "outpost", name: "전초둥지", minNestLevel: 2, width: 3, height: 3, health: 200, storageCapacity: 0, visionRadius: 6, description: "개체를 탄생시키고 자원을 납품하는 새 둥지입니다. 본둥지가 파괴되어도 군락을 유지합니다." },
  { key: "watchpost", name: "감시봉", minNestLevel: 2, width: 1, height: 1, health: 80, storageCapacity: 0, visionRadius: 10, description: "주변 10칸의 시야를 확보합니다." }
].map(type => Object.freeze({ ...type, buildSeconds: 3,
  image: "DesignAssets/Animations/Construction/v9/bean/" + type.key + "-complete.png" })));

const nestMaterialCapacities = Object.freeze([30, 40, 50, 60]);

const nativeMaterials = { bean: "clay", spore: "tree", pebble: "pebbles", spring: "dew" };
const constructionMaterials = {
  storage: { native: 10 },
  "evolution-lab": { native: 16, tree: 4, pebbles: 4 },
  outpost: { native: 24, tree: 12, pebbles: 12 },
  watchpost: { native: 8, tree: 6, "grass-fiber": 4 }
};

export function buildingDefinition(key) {
  return BUILDING_TYPES.find(type => type.key === key);
}

export function constructionSeconds(key, level) {
  const definition = buildingDefinition(key);
  return definition ? definition.buildSeconds : null;
}

export function buildingImage(key, tribe) {
  const definition = buildingDefinition(key);
  if (!definition) return null;
  return ["spore", "pebble", "spring"].includes(tribe) ?
    "DesignAssets/Animations/Construction/v5/" + tribe + "/" + key + "-complete.png" : definition.image;
}

export function constructionApproachCell(plan) {
  const definition = buildingDefinition(plan.buildingKey);
  return definition ? { x: plan.x + Math.floor((definition.width - 1) / 2),
    y: plan.y + Math.floor((definition.height - 1) / 2) } : null;
}

export function constructionSiteCenter(plan) {
  const definition = buildingDefinition(plan.buildingKey);
  return definition ? { x: plan.x + definition.width / 2, y: plan.y + definition.height / 2 } : null;
}

export function buildingCost(key, tribe) {
  if (!constructionMaterials[key]) return null;
  const materials = {};
  for (const [resource, amount] of Object.entries(constructionMaterials[key])) {
    const type = resource === "native" ? nativeMaterials[tribe || "bean"] || "clay" : resource;
    materials[type] = (materials[type] || 0) + amount;
  }
  return { evolutionPoints: 0, materials };
}

export function materialCapacity(nestLevel, buildings) {
  return nestMaterialCapacities[Math.max(0, Math.min(3, (nestLevel || 1) - 1))] +
    (buildings || []).filter(building => building.health > 0).reduce((sum, building) => sum + (buildingDefinition(building.key)?.storageCapacity || 0), 0);
}

export function buildingContains(building, x, y) {
  return building.health > 0 && x >= building.x && y >= building.y && x < building.x + building.width && y < building.y + building.height;
}

export function buildingAt(environment, x, y) {
  for (const game of environment.games.values()) {
    const building = game.buildings?.find(entry => buildingContains(entry, x, y));
    if (building) return building;
  }
  return null;
}

