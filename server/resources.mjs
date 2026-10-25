import { isTreeFood } from "./food.mjs";
import { attributeCounts } from "./attributes.mjs";
import { LEGACY_RESOURCE_HABITATS } from "./resource-legacy.mjs";
import { RESOURCE_ECONOMY, isEconomyHabitat } from "./economy.mjs";

export const REMOVED_RESOURCE_TYPES = Object.freeze(["twigs","bark","root-fiber","spider-silk","water","tree-sap","leaf-mold","resin","beeswax","dry-leaves","tree-fruit","berry-bush","seed-pods","root-bulbs","nutrient-moss"]);

export function migrateResourceType(key) {
  if (key === "root-fiber") return "grass-fiber";
  if (key === "wood") return "tree";
  return REMOVED_RESOURCE_TYPES.includes(key) ? null : key;
}

const resourceImages = {
  "honey-mushrooms": "DesignAssets/Foods/food-mushroom-pile.png",
  meat: "DesignAssets/Animations/BeetleDeath/dead-v2.png",
  carapace: "DesignAssets/Animations/BeetleDeath/dead-v2.png",
  tree: "DesignAssets/Terrain/standing-tree-smooth-atlas.png",
  dew: "DesignAssets/Resources/dew-grass.png",
  pebbles: "DesignAssets/Resources/pebbles.png",
  clay: "DesignAssets/Resources/clay.png",
  sand: "DesignAssets/Resources/sand.png",
  "grass-fiber": "DesignAssets/ResourceConcepts/v1/resource-grass-fiber.png",
  "iron-ore": "DesignAssets/Resources/iron-ore.png",
  "copper-ore": "DesignAssets/Resources/copper-ore.png",
  quartz: "DesignAssets/ResourceConcepts/v1/resource-quartz.png"
};
const resourceCarryImages = {
  "honey-mushrooms": "DesignAssets/Foods/food-mushroom-single.png",
  meat: "DesignAssets/Foods/food-meat.png",
  carapace: "DesignAssets/ResourceConcepts/v1/resource-carapace.png",
  tree: "DesignAssets/Resources/wood-carry.png",
  dew: "DesignAssets/Resources/dew-carry.png",
  pebbles: "DesignAssets/Resources/pebbles-carry.png",
  clay: "DesignAssets/Resources/clay-carry.png",
  sand: "DesignAssets/Resources/sand-carry.png",
  "iron-ore": "DesignAssets/Resources/iron-ore-carry.png",
  "copper-ore": "DesignAssets/Resources/copper-ore-carry.png"
};

export const RESOURCE_TYPES = Object.freeze([
  ["honey-mushrooms", "버섯", "food", 1.5, []],
  ["meat", "고기", "food", 1.5, ["butchery"]],
  ["carapace", "갑각", "material", 2, ["strength"]],
  ["tree", "목재", "material", 5, []],
  ["dew", "이슬방울", "material", .8, []],
  ["pebbles", "자갈", "material", 2, ["strength"]],
  ["clay", "비옥토", "material", 2, []],
  ["sand", "모래", "material", 1.5, []],
  ["grass-fiber", "풀섬유", "material", 2, ["strength"]],
  ["iron-ore", "철광석", "material", 3, ["strength","strength"]],
  ["copper-ore", "구리광석", "material", 3, ["strength","strength"]],
  ["quartz", "수정", "material", 3, ["strength","strength"]]
].map(([key, name, category, harvestSeconds, requirements]) => Object.freeze({
  key, name, category, harvestSeconds: RESOURCE_ECONOMY.find(entry => entry.key === key)?.harvestSeconds ?? harvestSeconds,
  harvestLocked: key === "honey-mushrooms", requirements: Object.freeze(requirements),
  image: resourceImages[key], carryImage: resourceCarryImages[key] || resourceImages[key]
})));

export const FOOD_HABITATS = Object.freeze([
  ["honey-mushrooms", ["forest"], []]
].map(([key, terrains, neighbors]) => Object.freeze({
  key, terrains: Object.freeze(terrains), neighbors: Object.freeze(neighbors)
})));

export const RESOURCE_PLACEMENT = Object.freeze({ nearRadius: 22, nearTypes: 3, nearNodes: 2 });

export const RESOURCE_HABITATS = Object.freeze([
  ["pebbles", ["coast", "land", "lowMountain"], [], "common", 4, 36, 7],
  ["clay", ["coast", "grassland", "swamp"], ["deep", "shallow", "coast", "swamp"], "uncommon", 24, 20, 8],
  ["sand", ["coast"], [], "common", 4, 28, 7],
  ["grass-fiber", ["grassland", "forest"], [], "common", 4, 42, 6],
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
const terrainTypes = ["deep", "shallow", "coast", "land", "grassland", "forest", "lowMountain", "highMountain", "ridge", "swamp"];

export function resourceDefinition(key) {
  return definitions.get(key);
}

export function isTribeFood(resourceType, tribe, version) {
  return RESOURCE_ECONOMY.find(entry => entry.tribe === (tribe || "bean"))?.key === resourceType;
}

export function populateColonyFood(room) {
  if (room.world?.generationVersion >= 10) return;
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
  if (world.generationVersion >= 11 && RESOURCE_ECONOMY.some(entry => entry.key === resourceType)) return x >= 0 && y >= 0 && x < 320 && y < 320 && isEconomyHabitat(resourceType, world.terrain[y * 320 + x]);
  const habitat = (world.generationVersion >= 1 && world.generationVersion <= 4 ? legacyResourceHabitats : resourceHabitats).get(resourceType);
  if (!habitat || x < 0 || y < 0 || x >= 320 || y >= 320 ||
    !habitat.terrains.includes(terrainTypes[world.terrain[y * 320 + x]])) return false;
  if (resourceType === "pebbles" && world.generationVersion >= 10) {
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const nx = x + dx, ny = y + dy;
      if (Math.abs(dx) + Math.abs(dy) > 6 || nx < 0 || ny < 0 || nx >= 320 || ny >= 320) continue;
      const terrain = world.terrain[ny * 320 + nx];
      if (terrain < 2 || terrain >= 6 && terrain <= 8) return true;
    }
    return false;
  }
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

export function resourceHarvestSeconds(resourceType, world) {
  if (!(world.generationVersion >= 11) && ["clay", "pebbles"].includes(resourceType)) return 2;
  if (resourceType === "pebbles" && world.generationVersion < 15) return 3.5;
  return resourceDefinition(resourceType).harvestSeconds;
}

export function resourceHarvestRequirements(cell, world, tribe) {
  if (!cell) return null;
  if (RESOURCE_ECONOMY.some(entry => entry.key === cell.resourceType)) {
    return isTribeFood(cell.resourceType, tribe, world.generationVersion) ? {} : null;
  }
  const definition = resourceDefinition(cell.resourceType || resourceTypeForCell(cell, world));
  if (!definition || definition.harvestLocked) return null;
  const slots = [...definition.requirements];
  return attributeCounts(slots);
}

export function canHarvestResource(cell, world, attributes, tribe) {
  const required = resourceHarvestRequirements(cell, world, tribe);
  return required !== null && Object.entries(required).every(([key, count]) => (attributes?.[key] || 0) >= count);
}

export function clearResourceHazards(room) {
  if (room.world.generationVersion >= 6) return;
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
    if (cell.kind === "corpse" && cell.carapaceAmount === undefined &&
      ["spiny-back-beetle", "spiny-back-leader"].includes(cell.species)) cell.carapaceAmount = 4;
    const type = migrateResourceType(cell.resourceType);
    if (type === null) room.food.delete(key);
    else if (cell.resourceType) cell.resourceType = type;
  }
  room.world.resources = (room.world.resources || []).flatMap(([x, y, amount, key]) => {
    const type = migrateResourceType(key);
    return type === null ? [] : [[x, y, amount, type]];
  });
  if (room.resourceVersion < 1 || room.resourceVersion === undefined) for (const [x, y, amount, resourceType] of room.world.resources || []) {
    const key = x + "," + y;
    if (room.food.has(key)) continue;
    room.food.set(key, { x, y, amount, initialAmount: amount, resourceType, kind: "resource",
      terrain: terrainTypes[room.world.terrain[y * 320 + x]] });
  }
  if (!(room.resourceVersion >= 2) && room.world.generationVersion < 11) {
    const blocked = new Set();
    for (const colony of room.colonies || []) for (let y = colony.y; y < colony.y + 5; y++) {
      for (let x = colony.x; x < colony.x + 5; x++) blocked.add(y * 320 + x);
    }
    for (const burrow of room.world.burrows || []) for (let y = burrow.y; y < burrow.y + burrow.height; y++) {
      for (let x = burrow.x; x < burrow.x + burrow.width; x++) blocked.add(y * 320 + x);
    }
    for (let index = 0; index < room.world.terrain.length; index++) {
      const terrain = room.world.terrain[index];
      if (![4, 5].includes(terrain) || blocked.has(index) || room.world.hazards?.[index] ||
        room.world.depletedTrees?.has(index)) continue;
      const x = index % 320, y = Math.floor(index / 320), key = x + "," + y;
      if (room.food.has(key)) continue;
      const resourceType = terrain === 5 ? "tree" : "dew";
      const amount = RESOURCE_ECONOMY.find(entry => entry.key === resourceType).amount;
      room.food.set(key, { x, y, amount, initialAmount: amount, resourceType, kind: "resource", terrain: terrainTypes[terrain] });
    }
  }
  room.resourceVersion = 2;
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
    if ((!cell.key || cell.key === cell.x + "," + cell.y) && cell.kind !== "corpse" &&
      !isTreeFood(cell, room.world) && !(cell.resourceType === "tree" && cell.amount > 0)) cells[cell.y * 320 + cell.x] = 0;
  }
  room.world.treeCells = cells;
  if (!room.world.depletedTrees) room.world.depletedTrees = new Set();
  for (const cell of room.food.values()) if (cell.resourceType === "tree" && cell.amount <= 0) room.world.depletedTrees.add(cell.y * 320 + cell.x);
  for (const index of room.world.depletedTrees) cells[index] = 0;
}
