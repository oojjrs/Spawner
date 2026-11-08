import { conquestEncounterPlan } from "./conquest-pacing.mjs";
import { WORLD_SIZE } from "./world-size.mjs";
import { recordPlacementMap } from "./placement-maps.mjs";
import { campResourceTravel } from "./resource-camps.mjs";
import { generateHydrology } from "./hydrology.mjs";
import { createResourceHabitats, resourceHabitatSuitability } from "./resource-habitats.mjs";
import { placeResourceCamps } from "./resource-camps.mjs";
import { generateWildlife, generateResourceAreas } from "./ecology.mjs";
import { RESOURCE_ECONOMY, normalizeWorldResourceAmounts } from "./economy.mjs";
import { measureStartingEconomy } from "./start-economy.mjs";
import { populateNaturalResources } from "./natural-resources.mjs";
import { identifyFrontierSites } from "./frontier-sites.mjs";

function hash(x, y, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y, scale, seed) {
  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = (fx - ix) ** 2 * (3 - 2 * (fx - ix)), ty = (fy - iy) ** 2 * (3 - 2 * (fy - iy));
  return ((hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx) * (1 - ty) +
    (hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;
}

function allocate(points, budget) {
  if (!points.length || points.length > budget) throw new Error("자연 서식지의 자원 총량을 배분할 수 없습니다.");
  const sum = points.reduce((value, point) => value + point[2], 0), fractions = [];
  let total = 0;
  for (const point of points) {
    const value = 1 + (budget - points.length) * point[2] / sum;
    point[2] = Math.floor(value); total += point[2]; fractions.push({ point, fraction: value % 1 });
  }
  fractions.sort((left, right) => right.fraction - left.fraction || left.point[1] - right.point[1] || left.point[0] - right.point[0]);
  for (let order = 0; total < budget; order++, total++) fractions[order].point[2]++;
}

export function populateLandscapeResources(world, baseline) {
  const { size, terrain, hydrology: h } = world, budgets = new Map(), occupied = new Uint8Array(terrain.length);
  for (const [, , amount, key] of [...baseline.food, ...baseline.resources]) budgets.set(key, (budgets.get(key) || 0) + amount);
  const forest = [], fields = createResourceHabitats(world);
  for (let index = 0; index < terrain.length; index++) {
    if (terrain[index] < 3 || terrain[index] > 5) continue;
    const x = index % size, y = Math.floor(index / size);
    terrain[index] = fields.rainfall[index] < .35 ? 3 : 4;
    if (noise(x, y, 7, world.seed + 2309) > .28) continue;
    forest.push({ index, score: fields.rainfall[index] * .7 + fields.soilDepth[index] * .2 +
      noise(x, y, 27, world.seed + 2311) * .16 + noise(x, y, 9, world.seed + 2317) * .07 - h.slope[index] * .8 });
  }
  forest.sort((left, right) => right.score - left.score || left.index - right.index);
  const treeCount = Math.min(forest.length, Math.floor(budgets.get("tree") / 30));
  for (const { index } of forest.slice(0, treeCount)) terrain[index] = 5;
  h.resourceHabitats = createResourceHabitats(world);
  for (let index = 0; index < terrain.length; index++) {
    const x = index % size, y = Math.floor(index / size);
    if (terrain[index] === 4 && h.wetness[index] > .65 && h.slope[index] < .012 && noise(x, y, 17, world.seed + 2333) > .1) {
      terrain[index] = 9;
      if (h.wetness[index] > .7 && noise(x, y, 11, world.seed + 2339) > .1) world.hazards[index] = 1;
    }
  }
  const trees = [];
  for (let index = 0; index < terrain.length; index++) if (terrain[index] === 5) {
    trees.push([index % size, Math.floor(index / size), .75 + h.resourceHabitats.soilMoisture[index] * .5, "tree"]); occupied[index] = 1;
  }
  allocate(trees, budgets.get("tree"));
  world.resources = trees; world.food = [];
  const nodeAmounts = { dew: 6, clay: 24, pebbles: 24, "honey-mushrooms": 30 };
  let order = 0;
  for (const [key, budget] of budgets) {
    if (["nutrients", "grass-fiber", "sand", "iron-ore", "copper-ore", "quartz"].includes(key)) continue;
    if (key === "tree") continue;
    const sectors = new Map();
    let weight = 0, candidates = 0;
    for (let index = 0; index < terrain.length; index++) {
      if (occupied[index] || world.hazards[index]) continue;
      const suitability = resourceHabitatSuitability(key, index, terrain, h);
      if (!suitability) continue;
      const x = index % size, y = Math.floor(index / size), sector = Math.floor(y / 16) * Math.ceil(size / 16) + Math.floor(x / 16);
      const abundance = suitability * (.6 + Math.max(0, noise(x, y, 21, world.seed + 2351 + order * 31)) * .8);
      if (!sectors.has(sector)) sectors.set(sector, { candidates: [], weight: 0, quota: 0, fraction: 0 });
      const group = sectors.get(sector);
      group.candidates.push({ index, abundance, priority: -Math.log(Math.max(.000001, hash(x, y, world.seed + 2371 + order * 37))) / abundance });
      group.weight += abundance; weight += abundance; candidates++;
    }
    const target = Math.min(candidates, budget, Math.ceil(budget / nodeAmounts[key])), groups = [...sectors.values()];
    let remaining = target;
    for (const group of groups) {
      const expected = target * group.weight / weight;
      group.quota = Math.min(group.candidates.length, Math.floor(expected)); group.fraction = expected - group.quota; remaining -= group.quota;
    }
    groups.sort((left, right) => right.fraction - left.fraction);
    while (remaining > 0) for (const group of groups) {
      if (!remaining) break;
      if (group.quota >= group.candidates.length) continue;
      group.quota++; remaining--;
    }
    const selected = [];
    for (const group of groups) {
      group.candidates.sort((left, right) => left.priority - right.priority || left.index - right.index);
      for (const candidate of group.candidates.slice(0, group.quota)) {
        const index = candidate.index;
        selected.push([index % size, Math.floor(index / size), .7 + Math.min(1, candidate.abundance), key]); occupied[index] = 1;
      }
    }
    allocate(selected, budget);
    if (key === "honey-mushrooms") world.food = selected;
    else world.resources.push(...selected);
    order++;
  }
}

function populateBurrows(world, occupied) {
  const { size, terrain, camps } = world, candidates = [];
  for (let y = 3; y < size - 3; y++) for (let x = 3; x < size - 5; x++) {
    if (camps.some(camp => Math.hypot(x - camp.x, y - camp.y) < 14)) continue;
    if (world.frontierSites?.some(site => Math.hypot(x - site.x, y - site.y) < 5)) continue;
    candidates.push({ x, y, score: hash(x, y, world.seed + 2381) });
  }
  candidates.sort((left, right) => left.score - right.score);
  for (const [type, width, target, separation] of [["large", 3, 24, 22], ["small", 1, 64, 12]]) {
    let count = 0;
    for (const { x, y } of candidates) {
      if (count >= target) break;
      if (world.burrows.some(other => Math.hypot(x - other.x, y - other.y) < Math.max(separation, other.type === "large" ? 22 : 12))) continue;
      let valid = true;
      for (let dy = -1; dy <= 1 && valid; dy++) for (let dx = -1; dx <= width; dx++) {
        const index = (y + dy) * size + x + dx;
        if (terrain[index] < 3 || terrain[index] > 5 || world.hazards[index] || occupied.has(index)) { valid = false; break; }
      }
      if (!valid) continue;
      world.burrows.push({ id: "burrow:" + type + ":" + (y * size + x), type, x, y, width, height: 1,
        entrance: { x: x + Math.floor(width / 2), y: y + 1 },
        creature: { key: "spiny-back-beetle", name: "가시등 딱정벌레", group: "영역", unique: false } });
      count++;
    }
  }
}


function clearCampFootprints(world, version) {
  const { size, terrain, hydrology: h } = world, plots = new Uint8Array(terrain.length);
  const clearedTrees = new Uint8Array(terrain.length);
  for (const camp of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const index = (camp.y + dy) * size + camp.x + dx;
    plots[index] = 1; h.forestMask[index] = 0;
    if (terrain[index] === 5) terrain[index] = 4;
  }
  if (version >= 39) for (const camp of world.camps.filter(camp => camp.tribe === "spore")) {
    const radius = version >= 41 ? 3 : 4;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const index = (camp.y + dy) * size + camp.x + dx;
      clearedTrees[index] = 1; h.forestMask[index] = 0;
      if (terrain[index] === 5) terrain[index] = 4;
    }
  }
  world.resources = world.resources.filter(([x, y, , key]) => !plots[y * size + x] && (key !== "tree" || !clearedTrees[y * size + x]));
  world.food = world.food.filter(([x, y, , key]) => !plots[y * size + x] && (key !== "tree" || !clearedTrees[y * size + x]));
  if (h.placementMaps) for (const field of h.placementMaps) if (field.id.startsWith("resource:") && field.id.endsWith(":amount")) {
    for (let index = 0; index < terrain.length; index++) if (plots[index] || field.id === "resource:tree:amount" && clearedTrees[index]) field.values[index] = 0;
  }
  recordPlacementMap(h, "camp:footprint-mask", ["camps", "forest", "resources"], plots, { minimum: 0, maximum: 1, stage: "final" });
}

export function generateLandscapeWorld(seed, baseline, onProgress, tribes, encounterPlans, version, capturePlacementMaps) {
  const generationVersion = version === undefined ? 41 : version;
  const size = generationVersion >= 35 ? WORLD_SIZE : 320;
  const terrain = new Uint8Array(size * size), moisture = new Float32Array(terrain.length), height = new Float32Array(terrain.length);
  const hydrology = generateHydrology(terrain, moisture, height, size, seed, baseline, generationVersion, capturePlacementMaps);
  const world = { seed, size, terrain, hydrology, hazards: new Uint8Array(terrain.length), camps: [], burrows: [], encounters: [], food: [], resources: [], foraging: [] };
  onProgress?.(.3);
  if (hydrology.continent?.natural) populateNaturalResources(world, generationVersion);
  else populateLandscapeResources(world, baseline);
  if (generationVersion >= 30) world.frontierSites = identifyFrontierSites(world);
  onProgress?.(.5);
  world.camps = placeResourceCamps(world, tribes, generationVersion);
  if (generationVersion >= 32) clearCampFootprints(world, generationVersion);
  if (generationVersion >= 41) normalizeWorldResourceAmounts(world);
  const occupied = new Set([...world.food, ...world.resources].map(([x, y]) => y * size + x));
  populateBurrows(world, occupied);
  if (generationVersion >= 31) for (const site of world.frontierSites) site.contenders = [];
  if (generationVersion >= 31) for (const camp of world.camps) {
    const travel = campResourceTravel(world, camp, 420);
    for (const site of world.frontierSites) {
      let cost = Infinity;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const distance = travel[(site.y + dy) * size + site.x + dx];
        if (distance >= 0) cost = Math.min(cost, distance);
      }
      if (cost <= 420) site.contenders.push({ tribe: camp.tribe === "sprout" ? "bean" : camp.tribe, cost });
    }
  }
  const blocked = new Uint8Array(terrain.length), nestDistance = new Float32Array(terrain.length), reachable = new Int16Array(terrain.length).fill(0);
  for (const camp of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) blocked[(camp.y + dy) * size + camp.x + dx] = 1;
  for (const burrow of world.burrows) for (let dx = 0; dx < burrow.width; dx++) blocked[burrow.y * size + burrow.x + dx] = 1;
  for (let index = 0; index < terrain.length; index++) {
    const x = index % size, y = Math.floor(index / size);
    nestDistance[index] = Math.min(...world.camps.map(camp => Math.hypot(x - camp.x, y - camp.y)));
  }
  world.encounters = generateWildlife({ seed, terrain, hazards: world.hazards, blocked, reachable, nestDistance,
    waterDistance: hydrology.waterDistance, resourceCells: occupied, generationVersion: generationVersion >= 34 ? generationVersion : 23, hydrology }, generationVersion >= 38 ? encounterPlans.map(conquestEncounterPlan) : encounterPlans);
  if (hydrology.placementMaps) {
    const habitat = new Uint8Array(terrain.length), appearances = new Uint8Array(terrain.length), nests = new Uint8Array(terrain.length);
    for (const [order, encounter] of world.encounters.entries()) {
      for (const index of encounter.cells) habitat[index] = 1;
      for (const index of encounter.spawnPoints) appearances[index] = order + 1;
    }
    for (const camp of world.camps) nests[camp.y * size + camp.x] = camp.id;
    recordPlacementMap(hydrology, "unit:habitat", ["units"], habitat, { minimum: 0, maximum: 1, scope: "all" });
    recordPlacementMap(hydrology, "unit:spawn", ["units"], appearances, { categorical: true, excluded: 0, scope: "all" });
    recordPlacementMap(hydrology, "camp:starts", ["camps"], nests, { categorical: true, excluded: 0 });
    for (const type of ["small", "large"]) {
      const values = new Uint8Array(terrain.length);
      for (const burrow of world.burrows) if (burrow.type === type) for (let dx = 0; dx < burrow.width; dx++) values[burrow.y * size + burrow.x + dx] = 1;
      recordPlacementMap(hydrology, "burrow:" + type, ["units"], values, { unit: "burrow-" + type, minimum: 0, maximum: 1 });
      recordPlacementMap(hydrology, "burrow:" + type + ":priority", ["units"], null,
        { unit: "burrow-" + type, minimum: 0, maximum: 1, sample: (x, y) => hash(x, y, seed + 2381) });
    }
  }
  world.economy = { seconds: 300, workers: 2, resources: RESOURCE_ECONOMY.map(policy => {
    const points = world.resources.filter(point => point[3] === policy.key);
    return { ...policy, cells: points.length, amount: points.reduce((sum, point) => sum + point[2], 0),
      coverage: points.length / terrain.length, sectors: new Set(points.map(([x, y]) => Math.floor(x / 32) + "," + Math.floor(y / 32))).size };
  }) };
  world.economy.starts = measureStartingEconomy(world, RESOURCE_ECONOMY);
  world.resourceAreas = generateResourceAreas(world);
  world.tribeStarts = tribes.map(tribe => ({ ...tribe, terrainRule: true, resourceRule: true }));
  if (hydrology.placementMaps) for (const camp of world.camps) recordPlacementMap(hydrology, "camp-travel:" + camp.id, ["camps"], null,
    { camp: camp.id, minimum: 0, maximum: 420, createValues: () => campResourceTravel(world, camp, 420), excluded: -1 });
  onProgress?.(1);
  return world;
}
