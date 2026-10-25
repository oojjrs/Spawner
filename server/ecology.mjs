const SIZE = 320;

const HABITATS = {
  "flower-tail-bird": [[4, 5], 768, false],
  "dew-rabbit": [[5], 768, false],
  "soil-mole": [[3, 4], 1024, false],
  "bundle-snail": [[5, 9], 1024, false],
  "cotton-sheep": [[4], 768, false],
  "rolling-acorn": [[5], 768, false],
  "soil-boar": [[4, 5], 1536, false],
  "bubble-toad": [[2, 4, 9], 1024, true],
  "vine-turtle": [[4, 5, 9], 1536, false],
  "shadow-weasel": [[5], 1536, false],
  "snare-vine": [[5], 1536, false],
  "talon-owl": [[5, 6], 1536, false],
  "spiny-back-beetle": [[3, 4, 5, 6], 768, false],
  "spring-keeper": [[4, 5], 4096, false],
  "lantern-keeper": [[5], 4096, false],
  "old-garden-snail": [[5, 9], 4096, false],
  "walking-forest": [[5], 4096, false],
  "white-paw": [[5], 4096, false],
  "spiny-back-leader": [[3, 4, 5, 6], 4096, false]
};

export function generateWildlife(world, plans) {
  const occupied = new Set();
  return plans.map((plan, order) => {
    const [terrains, tilesPerUnit, nearWater] = HABITATS[plan.key];
    const cells = [], sectors = new Map();
    for (let index = 0; index < world.terrain.length; index++) {
      if (!terrains.includes(world.terrain[index]) || world.hazards[index] || world.blocked[index] ||
          world.reachable[index] < 0 || world.nestDistance[index] < plan.safeRadius ||
          nearWater && world.waterDistance[index] > 6) continue;
      cells.push(index);
      if (world.resourceCells.has(index) || occupied.has(index)) continue;
      const x = index % SIZE, y = Math.floor(index / SIZE), sector = Math.floor(y / 16) * 20 + Math.floor(x / 16);
      const priority = wildlifeHash(index, world.seed + order * 7919);
      if (!sectors.has(sector) || priority < sectors.get(sector).priority) sectors.set(sector, { index, priority });
    }
    const candidates = [...sectors.values()].sort((left, right) =>
      wildlifeHash(left.index, world.seed + order * 3571 + 17) - wildlifeHash(right.index, world.seed + order * 3571 + 17));
    const target = Math.floor(cells.length / tilesPerUnit), spawnPoints = [];
    for (const candidate of candidates) {
      if (spawnPoints.length >= target) break;
      const index = candidate.index;
      if (spawnPoints.some(other => Math.hypot(index % SIZE - other % SIZE, Math.floor(index / SIZE) - Math.floor(other / SIZE)) < Math.sqrt(tilesPerUnit) / 3)) continue;
      spawnPoints.push(index); occupied.add(index);
    }
    const origin = spawnPoints[0] ?? cells[0] ?? 0;
    return { ...plan, terrains, nearWater, x: origin % SIZE, y: Math.floor(origin / SIZE), cells,
      boundary: [], route: [], homeId: null, spawnPoints, tilesPerUnit, populationLimit: spawnPoints.length,
      density: cells.length ? spawnPoints.length / cells.length : 0 };
  });
}

function wildlifeHash(index, seed) {
  let value = Math.imul(index ^ seed, 374761393);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
}

export function generateResourceAreas(world) {
  if (world.economy) {
    const areas = { wood: [], dew: [], clay: [], pebbles: [] };
    for (const [x, y, amount, key] of world.resources) if (amount > 0 && Object.hasOwn(areas, key === "tree" ? "wood" : key)) areas[key === "tree" ? "wood" : key].push(y * world.size + x);
    return areas;
  }
  const wood = [], dew = [], blocked = new Set();
  for (const camp of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) blocked.add((camp.y + dy) * SIZE + camp.x + dx);
  for (const burrow of world.burrows) for (let dx = 0; dx < burrow.width; dx++) blocked.add(burrow.y * SIZE + burrow.x + dx);
  for (const [x, y] of [...world.food, ...world.resources]) blocked.add(y * SIZE + x);
  for (let index = 0; index < world.terrain.length; index++) {
    if (world.hazards[index] || blocked.has(index)) continue;
    if (world.terrain[index] === 5) wood.push(index);
    if (world.terrain[index] === 4) dew.push(index);
  }
  return { wood, dew };
}
