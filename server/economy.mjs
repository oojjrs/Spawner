import { correctStartingEconomy, measureStartingEconomy } from "./start-economy.mjs";

export const RESOURCE_ECONOMY = Object.freeze([
  { tribe: "bean", key: "clay", coverage: .035, amount: 12, harvestSeconds: 2 },
  { tribe: "spore", key: "tree", coverage: null, amount: 2, harvestSeconds: 8.5 },
  { tribe: "pebble", key: "pebbles", coverage: .045, amount: 12, harvestSeconds: 2.5 },
  { tribe: "spring", key: "dew", coverage: null, amount: 1, harvestSeconds: .8 }
].map(entry => Object.freeze(entry)));

export function populateWorldEconomy(world, fields) {
  const size = world.size, primary = new Set(RESOURCE_ECONOMY.map(entry => entry.key));
  world.food = world.food.filter(point => !primary.has(point[3]));
  world.resources = world.resources.filter(point => !primary.has(point[3]));
  const blocked = new Set([...world.food, ...world.resources].map(([x, y]) => y * size + x));
  for (const camp of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) blocked.add((camp.y + dy) * size + camp.x + dx);
  for (const burrow of world.burrows) for (let dy = -1; dy <= burrow.height; dy++) for (let dx = -1; dx <= burrow.width; dx++) blocked.add((burrow.y + dy) * size + burrow.x + dx);
  for (const plan of world.encounters) for (const index of plan.spawnPoints || []) blocked.add(index);
  const available = index => !blocked.has(index) && !world.hazards[index];
  const added = new Map();
  function place(index, policy) {
    if (!available(index) || added.has(index)) return;
    const amount = policy.amount;
    added.set(index, [index % size, Math.floor(index / size), amount, policy.key]);
  }
  for (const policy of RESOURCE_ECONOMY.filter(entry => entry.coverage !== null)) {
    const sectors = new Map();
    let candidates = 0;
    for (let index = 0; index < world.terrain.length; index++) {
      const terrain = world.terrain[index];
      if (!available(index) || added.has(index) || !isEconomyHabitat(policy.key, terrain)) continue;
      const x = index % size, y = Math.floor(index / size), sector = Math.floor(y / 32) * 10 + Math.floor(x / 32);
      const water = fields.waterDistance[index] <= 6, mountain = fields.mountainDistance[index] <= 6;
      const weight = policy.key === "clay" ? 1 + Math.max(0, fields.moisture[index]) * 3 + (water || terrain === 9 ? 2 : 0) :
        1 + (water ? 2 : 0) + (mountain ? 2 : 0) + (water && mountain ? 3 : 0);
      const patch = economyHash(Math.floor(x / 4), Math.floor(y / 4), world.seed + 701) * .8 + economyHash(x, y, world.seed + 709) * .2;
      if (!sectors.has(sector)) sectors.set(sector, []);
      sectors.get(sector).push({ index, priority: patch / weight }); candidates++;
    }
    const target = Math.min(candidates, Math.round(size * size * policy.coverage));
    let allocated = 0, cumulative = 0;
    for (const points of sectors.values()) {
      cumulative += points.length;
      const quota = Math.round(target * cumulative / candidates) - allocated;
      allocated += quota;
      points.sort((left, right) => left.priority - right.priority || left.index - right.index);
      for (const point of points.slice(0, quota)) place(point.index, policy);
    }
  }
  for (const policy of RESOURCE_ECONOMY.filter(entry => entry.coverage === null)) {
    const terrain = policy.key === "tree" ? 5 : 4;
    for (let index = 0; index < world.terrain.length; index++) if (world.terrain[index] === terrain) place(index, policy);
  }
  for (const [order, camp] of world.camps.entries()) {
    const policy = RESOURCE_ECONOMY[order], candidates = [];
    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
      const index = (camp.y + dy) * size + camp.x + dx, terrain = world.terrain[index];
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 4 || !available(index) ||
          !(policy.key === "clay" ? [3, 4, 5, 9].includes(terrain) : policy.key === "pebbles" ? [2, 3, 4, 6].includes(terrain) : terrain === (policy.key === "tree" ? 5 : 4))) continue;
      candidates.push({ index, distance: fields.paths[order][index] });
    }
    candidates.sort((left, right) => left.distance - right.distance || left.index - right.index);
    for (const point of candidates.filter(point => point.distance >= 0).slice(0, 4)) {
      added.delete(point.index); place(point.index, policy);
    }
  }
  const starts = fields.correctStarts ? correctStartingEconomy(world, RESOURCE_ECONOMY, added, available, isEconomyHabitat, fields.minimumSites, fields.minimumTravel) : null;
  if (fields.sparseDew) thinStartingDew(world, added);
  world.resources.push(...added.values());
  world.foraging = [];
  world.economy = { seconds: 300, workers: 2, resources: RESOURCE_ECONOMY.map(policy => {
    const points = [...added.values()].filter(point => point[3] === policy.key);
    return { ...policy, harvestSeconds: policy.key === "pebbles" && !fields.currentHarvest ? 3.5 : policy.harvestSeconds,
      cells: points.length, coverage: points.length / (size * size),
      amount: points.reduce((sum, point) => sum + point[2], 0), sectors: new Set(points.map(([x, y]) => Math.floor(y / 32) * 10 + Math.floor(x / 32))).size };
  }), starts: starts || measureStartingEconomy(world, RESOURCE_ECONOMY) };
}

function thinStartingDew(world, points) {
  for (const camp of world.camps) {
    if (camp.tribe === "spring") continue;
    const local = [...points.entries()].filter(([, point]) => point[3] === "dew" && Math.hypot(point[0] - camp.x, point[1] - camp.y) < 32);
    const priority = point => economyHash(point[0], point[1], world.seed + 733);
    local.sort((left, right) => priority(left[1]) - priority(right[1]) || left[0] - right[0]);
    let retained = false;
    for (const [index, point] of local) {
      const distance = Math.hypot(point[0] - camp.x, point[1] - camp.y);
      if (distance <= 22 && !retained) { retained = true; continue; }
      const density = .2 + .8 * Math.max(0, (distance - 22) / 10);
      if (priority(point) >= density) points.delete(index);
    }
  }
}

function economyHash(x, y, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function isEconomyHabitat(key, terrain) {
  if (key === "clay") return [3, 4, 5, 9].includes(terrain);
  if (key === "pebbles") return [2, 3, 4, 6].includes(terrain);
  return terrain === (key === "tree" ? 5 : 4);
}
