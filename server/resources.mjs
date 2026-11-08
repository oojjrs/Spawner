import { worldSize } from "./world-size.mjs";
import { isTreeFood } from "./food.mjs";
import { attributeCounts } from "./attributes.mjs";
import { LEGACY_RESOURCE_HABITATS } from "./resource-legacy.mjs";
import { RESOURCE_ECONOMY, RESOURCE_NODE_AMOUNT, isEconomyHabitat, normalizeWorldResourceAmounts } from "./economy.mjs";
import { resourceHabitatSuitability } from "./resource-habitats.mjs";

export const REMOVED_RESOURCE_TYPES = Object.freeze(["honey-mushrooms","twigs","bark","root-fiber","spider-silk","water","tree-sap","leaf-mold","resin","beeswax","dry-leaves","tree-fruit","berry-bush","seed-pods","root-bulbs","nutrient-moss","meat","carapace","nutrients","sand","grass-fiber","iron-ore","copper-ore","quartz"]);

export function migrateResourceType(key) {
  if (key === "wood") return "tree";
  return REMOVED_RESOURCE_TYPES.includes(key) ? null : key;
}

const resourceImages = {
  tree: "DesignAssets/Terrain/standing-tree-smooth-atlas.png",
  dew: "DesignAssets/Resources/dew-grass.png",
  pebbles: "DesignAssets/Resources/pebbles.png",
  clay: "DesignAssets/Resources/clay.png",
};
const resourceCarryImages = {
  tree: "DesignAssets/Resources/wood-carry.png",
  dew: "DesignAssets/Resources/dew-carry.png",
  pebbles: "DesignAssets/Resources/pebbles-carry.png",
  clay: "DesignAssets/Resources/clay-carry.png",
};

export const RESOURCE_TYPES = Object.freeze([
  ["tree", "목재", "material", 6, ["blade"]],
  ["dew", "이슬방울", "material", 2, []],
  ["pebbles", "자갈", "material", 6, ["piercing"]],
  ["clay", "비옥토", "material", 4, []],
].map(([key, name, category, harvestSeconds, requirements]) => Object.freeze({
  key, name, category, harvestSeconds: RESOURCE_ECONOMY.find(entry => entry.key === key)?.harvestSeconds ?? harvestSeconds,
  harvestLocked: key === "honey-mushrooms", requirements: Object.freeze(requirements),
  image: resourceImages[key], carryImage: resourceCarryImages[key] || resourceImages[key]
})));

export const FOOD_HABITATS = Object.freeze([
].map(([key, terrains, neighbors]) => Object.freeze({
  key, terrains: Object.freeze(terrains), neighbors: Object.freeze(neighbors)
})));

export const RESOURCE_PLACEMENT = Object.freeze({ nearRadius: 22, nearTypes: 3, nearNodes: 2 });

export const RESOURCE_HABITATS = Object.freeze([
  ["pebbles", ["coast", "land", "lowMountain"], [], "common", 4, 36, 7],
  ["clay", ["coast", "grassland", "swamp"], ["deep", "shallow", "coast", "swamp"], "uncommon", 24, 20, 8],
].map(([key, terrains, neighbors, rarity, minDistance, nodes, separation]) => Object.freeze({
  key, terrains: Object.freeze(terrains), neighbors: Object.freeze(neighbors), rarity, minDistance, nodes, separation
})));

const definitions = new Map(RESOURCE_TYPES.map(definition => [definition.key, definition]));
const resourceHabitats = new Map(RESOURCE_HABITATS.map(habitat => [habitat.key, habitat]));
const legacyResourceHabitats = new Map(LEGACY_RESOURCE_HABITATS.map(habitat => [habitat.key, habitat]));
const foodHabitats = new Map(FOOD_HABITATS.map(habitat => [habitat.key, habitat]));
const terrainTypes = ["deep", "shallow", "coast", "land", "grassland", "forest", "lowMountain", "highMountain", "ridge", "swamp", "ford"];

export function resourceDefinition(key) {
  return definitions.get(key);
}

export function isTribeFood(resourceType, tribe, version) {
  return RESOURCE_ECONOMY.find(entry => entry.tribe === (tribe || "bean"))?.key === resourceType;
}

export function isColonyFood(resourceType, tribe, version) {
  return isTribeFood(resourceType, tribe, version);
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
  const size = worldSize(world);
  if (resourceType === "tree-fruit" && world.hazards?.[y * size + x]) return false;
  const habitat = foodHabitats.get(resourceType);
  if (world.generationVersion >= 23 && resourceType === "honey-mushrooms" && x >= 0 && y >= 0 && x < size && y < size) {
    return Boolean(world.hydrology?.resourceHabitats && resourceHabitatSuitability(resourceType, y * size + x, world.terrain, world.hydrology));
  }
  if (!habitat || x < 0 || y < 0 || x >= size || y >= size ||
    !habitat.terrains.includes(terrainTypes[world.terrain[y * size + x]])) return false;
  return !habitat.neighbors.length || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < size && ny < size &&
      habitat.neighbors.includes(terrainTypes[world.terrain[ny * size + nx]]);
  });
}

export function isResourceHabitat(resourceType, world, x, y) {
  const size = worldSize(world);
  if (world.generationVersion >= 11 && RESOURCE_ECONOMY.some(entry => entry.key === resourceType)) return x >= 0 && y >= 0 && x < size && y < size && isEconomyHabitat(resourceType, world.terrain[y * size + x]);
  const habitat = (world.generationVersion >= 1 && world.generationVersion <= 4 ? legacyResourceHabitats : resourceHabitats).get(resourceType);
  if (!habitat || x < 0 || y < 0 || x >= size || y >= size ||
    !habitat.terrains.includes(terrainTypes[world.terrain[y * size + x]])) return false;
  if (resourceType === "pebbles" && world.generationVersion >= 10) {
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const nx = x + dx, ny = y + dy;
      if (Math.abs(dx) + Math.abs(dy) > 6 || nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const terrain = world.terrain[ny * size + nx];
      if (terrain < 2 || terrain >= 6 && terrain <= 8) return true;
    }
    return false;
  }
  if (!habitat.neighbors.length) return true;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
    if (habitat.neighbors.includes(terrainTypes[world.terrain[ny * size + nx]])) return true;
  }
  return false;
}

export function resourceTypeForCell(cell, world) {
  if (cell?.kind === "corpse") return null;
  if (cell?.resourceType) return migrateResourceType(cell.resourceType);
  if (isTreeFood(cell, world)) return "berry-bush";
  return "honey-mushrooms";
}

export function resourceHarvestSeconds(resourceType, world) {
  return resourceDefinition(resourceType).harvestSeconds;
}

export function resourceHarvestMultiplier(resourceType, attributes, tribe) {
  if (!tribe || !isTribeFood(resourceType, tribe)) return 1;
  const definition = resourceDefinition(resourceType);
  return definition.requirements.some(key => attributes?.[key] > 0) ? .75 : 1;
}

export function resourceHarvestRequirements(cell, world, tribe) {
  if (tribe && !isTribeFood(resourceTypeForCell(cell, world), tribe)) return null;
  if (!cell || cell.kind === "corpse") return null;
  if (cell.dropped && resourceDefinition(cell.resourceType)) return {};
  if (isTribeFood(cell.resourceType, tribe, world.generationVersion)) return {};
  const definition = resourceDefinition(cell.resourceType || resourceTypeForCell(cell, world));
  if (!definition || definition.harvestLocked) return null;
  const slots = [...definition.requirements];
  return attributeCounts(slots);
}

export function canHarvestResource(cell, world, attributes, tribe) {
  // 종족이 지정된 개체는 채집 기관이나 옛 속성에 관계없이 자기 자원만 채집한다.
  if (tribe && !isTribeFood(resourceTypeForCell(cell, world), tribe)) return false;
  if (typeof attributes?.dnaGather === "boolean") return attributes.dnaGather && !!cell && cell.kind !== "corpse" && !resourceDefinition(resourceTypeForCell(cell, world))?.harvestLocked;
  const required = resourceHarvestRequirements(cell, world, tribe);
  return required !== null && Object.entries(required).every(([key, count]) => (attributes?.[key] || 0) >= count);
}

export function dropCarriedResources(room, agent) {
  if (!(agent.carrying > 0) || !resourceDefinition(agent.carryingType)) return;
  const resourceType = agent.carryingType;
  const key = "drop:" + resourceType + ":" + agent.x + "," + agent.y;
  let cell = room.food.get(key);
  if (!cell) {
    cell = { key, x: agent.x, y: agent.y, resourceType, kind: "resource", dropped: true, amount: 0 };
    room.food.set(key, cell);
    const regionKey = Math.floor(agent.x / 18) + "," + Math.floor(agent.y / 18);
    if (!room.foodSpots.has(regionKey)) room.foodSpots.set(regionKey, { cells: [] });
    room.foodSpots.get(regionKey).cells.push(cell);
  }
  cell.amount = Math.round((cell.amount + agent.carrying) * 10) / 10;
  cell.initialAmount = cell.amount;
  agent.carrying = 0;
  agent.carryingType = null;
  for (const key of ["transportCargo", "transport", "transportReadyAt"]) delete agent[key];
}

export function clearResourceHazards(room) {
  const size = worldSize(room.world);
  if (room.world.generationVersion >= 6) return;
  const hazards = room.world.hazards;
  if (!hazards) return;
  for (const cell of room.food.values()) {
    const index = cell.y * size + cell.x;
    if (cell.kind === "corpse" || !hazards[index]) continue;
    if (!cell.resourceType) cell.resourceType = resourceTypeForCell(cell, room.world);
    hazards[index] = 0;
  }
}

export function populateResourceNodes(room) {
  const size = worldSize(room.world);
  for (const [key, cell] of room.food) {
    if (cell.kind === "corpse") continue;
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
      terrain: terrainTypes[room.world.terrain[y * size + x]] });
  }
  if (!(room.resourceVersion >= 2) && room.world.generationVersion < 11) {
    const blocked = new Set();
    for (const colony of room.colonies || []) for (let y = colony.y; y < colony.y + 5; y++) {
      for (let x = colony.x; x < colony.x + 5; x++) blocked.add(y * size + x);
    }
    for (const burrow of room.world.burrows || []) for (let y = burrow.y; y < burrow.y + burrow.height; y++) {
      for (let x = burrow.x; x < burrow.x + burrow.width; x++) blocked.add(y * size + x);
    }
    for (let index = 0; index < room.world.terrain.length; index++) {
      const terrain = room.world.terrain[index];
      if (![4, 5].includes(terrain) || blocked.has(index) || room.world.hazards?.[index] ||
        room.world.depletedTrees?.has(index)) continue;
      const x = index % size, y = Math.floor(index / size), key = x + "," + y;
      if (room.food.has(key)) continue;
      const resourceType = terrain === 5 ? "tree" : "dew";
      const amount = RESOURCE_ECONOMY.find(entry => entry.key === resourceType).amount;
      room.food.set(key, { x, y, amount, initialAmount: amount, resourceType, kind: "resource", terrain: terrainTypes[terrain] });
    }
  }
  if (!(room.resourceVersion >= 3) && !(room.world.generationVersion >= 20)) {
    const amount = RESOURCE_ECONOMY.find(entry => entry.key === "tree").amount;
    for (const point of room.world.resources) {
      if (point[3] === "tree" && point[2] > 0) point[2] = Math.max(amount, point[2]);
    }
    for (const cell of room.food.values()) {
      if (cell.dropped || cell.resourceType !== "tree" || cell.kind !== "resource" || cell.amount <= 0 ||
          !Number.isFinite(cell.initialAmount)) continue;
      const initialAmount = cell.initialAmount;
      cell.initialAmount = Math.max(amount, initialAmount);
      cell.amount += cell.initialAmount - initialAmount;
    }
  }
  if (!(room.resourceVersion >= 4)) {
    normalizeWorldResourceAmounts(room.world);
    for (const cell of room.food.values()) {
      if (cell.dropped || cell.kind === "corpse" || !resourceDefinition(cell.resourceType)) continue;
      cell.initialAmount = RESOURCE_NODE_AMOUNT;
      if (cell.amount > 0) cell.amount = RESOURCE_NODE_AMOUNT;
    }
  }
  room.resourceVersion = 4;
}


export function populateForestResources(room) {
  const size = worldSize(room.world);
  const cells = new Uint8Array(size * size);
  for (let index = 0; index < cells.length; index++) {
    if (!(room.world.generationVersion >= 20) && room.world.terrain[index] === 5 && !room.world.hazards?.[index]) cells[index] = 1;
  }
  for (const burrow of room.world.burrows || []) {
    for (let y = burrow.y; y < burrow.y + burrow.height; y++) for (let x = burrow.x; x < burrow.x + burrow.width; x++) {
      if (x >= 0 && y >= 0 && x < size && y < size) cells[y * size + x] = 0;
    }
  }
  for (const cell of room.food.values()) {
    if ((!cell.key || cell.key === cell.x + "," + cell.y) && cell.kind !== "corpse" &&
      !isTreeFood(cell, room.world) && !(cell.resourceType === "tree" && cell.amount > 0)) cells[cell.y * size + cell.x] = 0;
  }
  if (room.world.generationVersion >= 20) for (const cell of room.food.values()) {
    if (!cell.dropped && cell.resourceType === "tree" && cell.amount > 0) cells[cell.y * size + cell.x] = 1;
  }
  room.world.treeCells = cells;
  if (!room.world.depletedTrees) room.world.depletedTrees = new Set();
  for (const cell of room.food.values()) if (!cell.dropped && cell.resourceType === "tree" && cell.amount <= 0) room.world.depletedTrees.add(cell.y * size + cell.x);
  for (const index of room.world.depletedTrees) cells[index] = 0;
}
