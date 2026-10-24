import { isTreeFood } from "./food.mjs";
import { attributeCounts } from "./attributes.mjs";

export const RESOURCE_TYPES = Object.freeze([
  ["honey-mushrooms", "꿀버섯 무리", "food", 1.5, []],
  ["tree-fruit", "나무 열매", "food", 1.5, ["harvest"]],
  ["berry-bush", "열매 덤불", "food", 1.5, ["harvest"]],
  ["seed-pods", "씨앗 꼬투리", "food", 1.5, ["harvest"]],
  ["root-bulbs", "뿌리 구근", "food", 2, ["digging"]],
  ["nutrient-moss", "영양 이끼", "food", 1.5, ["harvest"]],
  ["meat", "고기", "food", 1.5, ["harvest","strength"]],
  ["twigs", "나뭇가지", "material", 1.5, ["harvest"]],
  ["bark", "나무껍질", "material", 2, ["harvest","strength"]],
  ["pebbles", "자갈", "material", 2, ["strength"]],
  ["clay", "점토", "material", 2, ["digging"]],
  ["sand", "모래", "material", 1.5, ["harvest"]],
  ["dry-leaves", "마른 잎", "material", 1.5, ["harvest"]],
  ["grass-fiber", "풀섬유", "material", 2, ["harvest","strength"]],
  ["root-fiber", "뿌리섬유", "material", 2.5, ["digging","strength"]],
  ["spider-silk", "거미줄", "material", 2, ["harvest","harvest"]],
  ["water", "물", "material", 1.5, ["absorption"]],
  ["tree-sap", "수액", "material", 2, ["absorption"]],
  ["leaf-mold", "부엽토", "material", 1.5, ["harvest"]],
  ["resin", "수지", "material", 2.5, ["absorption","strength"]],
  ["beeswax", "밀랍", "material", 2.5, ["harvest","strength"]],
  ["carapace", "갑각", "material", 2.5, ["harvest","strength"]],
  ["iron-ore", "철광석", "material", 3, ["digging","strength","strength"]],
  ["copper-ore", "구리광석", "material", 3, ["digging","strength","strength"]],
  ["quartz", "수정", "material", 3, ["digging","strength","strength"]]
].map(([key, name, category, harvestSeconds, requirements]) => Object.freeze({
  key, name, category, harvestSeconds, requirements: Object.freeze(requirements),
  image: key === "tree-fruit" ? "DesignAssets/Foods/food-berry-bush.png" :
    key === "meat" ? "DesignAssets/Foods/food-meat.png" :
    category === "food" ? "DesignAssets/FoodConcepts/v1/food-" + key + ".png" :
      "DesignAssets/ResourceConcepts/v1/resource-" + key + ".png"
})));

export const FOOD_HABITATS = Object.freeze([
  ["honey-mushrooms", ["forest"], []],
  ["tree-fruit", ["forest"], []],
  ["berry-bush", ["grassland"], ["forest"]],
  ["seed-pods", ["land", "grassland"], []],
  ["root-bulbs", ["grassland"], []],
  ["nutrient-moss", ["forest"], []]
].map(([key, terrains, neighbors]) => Object.freeze({
  key, terrains: Object.freeze(terrains), neighbors: Object.freeze(neighbors)
})));

export const RESOURCE_PLACEMENT = Object.freeze({ nearRadius: 22, nearTypes: 3, nearNodes: 2 });

export const RESOURCE_HABITATS = Object.freeze([
  ["twigs", ["forest"], [], "common", 4, 48, 6],
  ["bark", ["forest"], [], "uncommon", 24, 20, 8],
  ["pebbles", ["coast", "land", "lowMountain"], [], "common", 4, 36, 7],
  ["clay", ["coast", "grassland"], ["deep", "shallow", "coast"], "uncommon", 24, 20, 8],
  ["sand", ["coast"], [], "common", 4, 28, 7],
  ["dry-leaves", ["forest"], [], "common", 4, 42, 6],
  ["grass-fiber", ["grassland"], [], "common", 4, 42, 6],
  ["root-fiber", ["forest", "grassland"], ["forest"], "uncommon", 24, 18, 9],
  ["spider-silk", ["forest", "lowMountain"], [], "uncommon", 30, 12, 10],
  ["water", ["coast"], ["deep", "shallow"], "common", 4, 24, 8],
  ["tree-sap", ["forest"], [], "uncommon", 28, 16, 10],
  ["leaf-mold", ["forest"], [], "uncommon", 24, 20, 8],
  ["resin", ["forest"], [], "rare", 42, 10, 8],
  ["beeswax", ["forest"], [], "rare", 42, 6, 10],
  ["carapace", ["grassland", "forest", "lowMountain"], [], "uncommon", 30, 12, 11],
  ["iron-ore", ["lowMountain"], [], "rare", 48, 10, 9],
  ["copper-ore", ["lowMountain"], [], "rare", 48, 8, 9],
  ["quartz", ["lowMountain"], [], "rare", 56, 5, 10]
].map(([key, terrains, neighbors, rarity, minDistance, nodes, separation]) => Object.freeze({
  key, terrains: Object.freeze(terrains), neighbors: Object.freeze(neighbors), rarity, minDistance, nodes, separation
})));

const definitions = new Map(RESOURCE_TYPES.map(definition => [definition.key, definition]));
const resourceHabitats = new Map(RESOURCE_HABITATS.map(habitat => [habitat.key, habitat]));
const foodHabitats = new Map(FOOD_HABITATS.map(habitat => [habitat.key, habitat]));
const terrainTypes = ["deep", "shallow", "coast", "land", "grassland", "forest", "lowMountain", "highMountain", "ridge"];

export function resourceDefinition(key) {
  return definitions.get(key);
}

export function isFoodHabitat(resourceType, world, x, y) {
  if (resourceType === "tree-fruit" && world.hazards?.[y * 320 + x]) return false;
  const habitat = foodHabitats.get(resourceType);
  if (!habitat || x < 0 || y < 0 || x >= 320 || y >= 320 ||
    !habitat.terrains.includes(terrainTypes[world.terrain[y * 320 + x]])) return false;
  return !habitat.neighbors.length || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < 320 && ny < 320 &&
      habitat.neighbors.includes(terrainTypes[world.terrain[ny * 320 + nx]]);
  });
}

export function isResourceHabitat(resourceType, world, x, y) {
  const habitat = resourceHabitats.get(resourceType);
  if (!habitat || x < 0 || y < 0 || x >= 320 || y >= 320 ||
    !habitat.terrains.includes(terrainTypes[world.terrain[y * 320 + x]])) return false;
  if (!habitat.neighbors.length) return true;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= 320 || ny >= 320) continue;
    if (habitat.neighbors.includes(terrainTypes[world.terrain[ny * 320 + nx]])) return true;
  }
  return false;
}

export function resourceTypeForCell(cell, world) {
  if (definitions.has(cell?.resourceType)) return cell.resourceType;
  if (cell?.kind === "corpse") return "meat";
  if (isTreeFood(cell, world)) return "berry-bush";
  return "honey-mushrooms";
}

export function resourceHarvestRequirements(cell, world) {
  if (!cell) return null;
  const definition = resourceDefinition(cell.resourceType || resourceTypeForCell(cell, world));
  if (!definition) return null;
  const slots = [...definition.requirements];
  if (isTreeFood(cell, world)) slots.push("climbing");
  return attributeCounts(slots);
}

export function canHarvestResource(cell, world, attributes) {
  const required = resourceHarvestRequirements(cell, world);
  return required !== null && Object.entries(required).every(([key, count]) => (attributes?.[key] || 0) >= count);
}

export function clearResourceHazards(room) {
  const hazards = room.world.hazards;
  if (!hazards) return;
  for (const cell of room.food.values()) {
    const index = cell.y * 320 + cell.x;
    if (cell.kind === "corpse" || !hazards[index]) continue;
    if (!cell.resourceType) cell.resourceType = resourceTypeForCell(cell, room.world);
    hazards[index] = 0;
  }
}

export function populateResourceNodes(room) {
  if (room.resourceVersion >= 1) return;
  for (const [x, y, amount, resourceType] of room.world.resources || []) {
    const key = x + "," + y;
    if (room.food.has(key)) continue;
    room.food.set(key, { x, y, amount, initialAmount: amount, resourceType, kind: "resource",
      terrain: terrainTypes[room.world.terrain[y * 320 + x]] });
  }
  room.resourceVersion = 1;
}

