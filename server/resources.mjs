import { isTreeFood } from "./food.mjs";
import { attributeCounts } from "./attributes.mjs";
import { LEGACY_RESOURCE_HABITATS } from "./resource-legacy.mjs";

export const REMOVED_RESOURCE_TYPES = Object.freeze(["twigs","bark","root-fiber","spider-silk","water","tree-sap","leaf-mold","resin","beeswax","carapace","dry-leaves"]);

export function migrateResourceType(key) {
  if (key === "root-fiber") return "grass-fiber";
  return REMOVED_RESOURCE_TYPES.includes(key) ? null : key;
}

export const RESOURCE_TYPES = Object.freeze([
  ["honey-mushrooms", "버섯", "food", 1.5, []],
  ["tree-fruit", "나무 열매", "food", 1.5, ["harvest"]],
  ["berry-bush", "열매 덤불", "food", 1.5, ["harvest"]],
  ["seed-pods", "씨앗 꼬투리", "food", 1.5, ["harvest"]],
  ["root-bulbs", "뿌리 구근", "food", 2, ["digging"]],
  ["nutrient-moss", "영양 이끼", "food", 1.5, ["harvest"]],
  ["meat", "고기", "food", 1.5, ["harvest","strength"]],
  ["tree", "나무", "material", 0, []],
  ["pebbles", "자갈", "material", 2, ["strength"]],
  ["clay", "비옥토", "material", 2, []],
  ["sand", "모래", "material", 1.5, ["harvest"]],
  ["grass-fiber", "풀섬유", "material", 2, ["harvest","strength"]],
  ["iron-ore", "철광석", "material", 3, ["digging","strength","strength"]],
  ["copper-ore", "구리광석", "material", 3, ["digging","strength","strength"]],
  ["quartz", "수정", "material", 3, ["digging","strength","strength"]]
].map(([key, name, category, harvestSeconds, requirements]) => Object.freeze({
  key, name, category, harvestSeconds, harvestLocked: key === "tree" || key === "honey-mushrooms", requirements: Object.freeze(requirements),
  image: key === "honey-mushrooms" ? "DesignAssets/Foods/food-mushroom-pile.png" :
    key === "tree" ? "DesignAssets/Terrain/standing-tree-smooth-atlas.png" :
    key === "clay" ? "DesignAssets/Resources/clay.png" :
    key === "tree-fruit" ? "DesignAssets/Foods/food-berry-bush.png" :
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
  ["pebbles", ["coast", "land", "lowMountain"], [], "common", 4, 36, 7],
  ["clay", ["coast", "grassland"], ["deep", "shallow", "coast"], "uncommon", 24, 20, 8],
  ["sand", ["coast"], [], "common", 4, 28, 7],
  ["grass-fiber", ["grassland"], [], "common", 4, 42, 6],
  ["iron-ore", ["lowMountain"], [], "rare", 48, 10, 9],
  ["copper-ore", ["lowMountain"], [], "rare", 48, 8, 9],
  ["quartz", ["lowMountain"], [], "rare", 56, 5, 10]
].map(([key, terrains, neighbors, rarity, minDistance, nodes, separation]) => Object.freeze({
  key, terrains: Object.freeze(terrains), neighbors: Object.freeze(neighbors), rarity, minDistance, nodes, separation
})));

const definitions = new Map(RESOURCE_TYPES.map(definition => [definition.key, definition]));
const resourceHabitats = new Map(RESOURCE_HABITATS.map(habitat => [habitat.key, habitat]));
const legacyResourceHabitats = new Map(LEGACY_RESOURCE_HABITATS.map(habitat => [habitat.key, habitat]));
const foodHabitats = new Map(FOOD_HABITATS.map(habitat => [habitat.key, habitat]));
const terrainTypes = ["deep", "shallow", "coast", "land", "grassland", "forest", "lowMountain", "highMountain", "ridge"];

export function resourceDefinition(key) {
  return definitions.get(key);
}

export function isTribeFood(resourceType, tribe) {
  if (!tribe || tribe === "bean") return resourceType === "clay";
  return resourceDefinition(resourceType)?.category === "food";
}

export function populateColonyFood(room) {
  for (const colony of room.colonies) {
    if (colony.tribe && colony.tribe !== "bean") continue;
    if (colony.tribe === null) continue;
    for (const cell of room.food.values()) {
      if (cell.kind === "corpse" || cell.resourceType !== "honey-mushrooms" ||
          Math.hypot(cell.x - colony.x - 2, cell.y - colony.y - 2) > RESOURCE_PLACEMENT.nearRadius) continue;
      cell.resourceType = "clay";
      cell.kind = "resource";
    }
  }
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
  const habitat = (world.generationVersion >= 1 && world.generationVersion <= 4 ? legacyResourceHabitats : resourceHabitats).get(resourceType);
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
  if (cell?.resourceType) return migrateResourceType(cell.resourceType);
  if (cell?.kind === "corpse") return "meat";
  if (isTreeFood(cell, world)) return "berry-bush";
  return "honey-mushrooms";
}

export function resourceHarvestRequirements(cell, world) {
  if (!cell) return null;
  const definition = resourceDefinition(cell.resourceType || resourceTypeForCell(cell, world));
  if (!definition || definition.harvestLocked) return null;
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
  for (const [key, cell] of room.food) {
    const type = migrateResourceType(cell.resourceType);
    if (type === null) room.food.delete(key);
    else if (cell.resourceType) cell.resourceType = type;
  }
  room.world.resources = (room.world.resources || []).flatMap(([x, y, amount, key]) => {
    const type = migrateResourceType(key);
    return type === null ? [] : [[x, y, amount, type]];
  });
  if (room.resourceVersion >= 1) return;
  for (const [x, y, amount, resourceType] of room.world.resources || []) {
    const key = x + "," + y;
    if (room.food.has(key)) continue;
    room.food.set(key, { x, y, amount, initialAmount: amount, resourceType, kind: "resource",
      terrain: terrainTypes[room.world.terrain[y * 320 + x]] });
  }
  room.resourceVersion = 1;
}


export function populateForestResources(room) {
  const cells = new Uint8Array(320 * 320);
  for (let index = 0; index < cells.length; index++) {
    if (room.world.terrain[index] === 5 && !room.world.hazards?.[index]) cells[index] = 1;
  }
  for (const burrow of room.world.burrows || []) {
    for (let y = burrow.y; y < burrow.y + burrow.height; y++) for (let x = burrow.x; x < burrow.x + burrow.width; x++) {
      if (x >= 0 && y >= 0 && x < 320 && y < 320) cells[y * 320 + x] = 0;
    }
  }
  for (const cell of room.food.values()) {
    if (cell.kind !== "corpse" && !isTreeFood(cell, room.world)) cells[cell.y * 320 + cell.x] = 0;
  }
  room.world.treeCells = cells;
}
