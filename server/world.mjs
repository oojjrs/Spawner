import { generateBurrows } from "./burrows.mjs";
import { generateTribes } from "./tribes.mjs";
import { RESOURCE_TYPES, FOOD_HABITATS, isFoodHabitat, RESOURCE_HABITATS, RESOURCE_PLACEMENT, isResourceHabitat } from "./resources.mjs";

export const STARTING_FOOD_RADIUS = 22;
export const STARTING_FOOD_CAP = 10;

export const WORLD_GENERATION_VERSION = 4;

export function generateWorld(seed, version) {
      if (version !== undefined && ![1, 2, 3, WORLD_GENERATION_VERSION].includes(version)) {
        throw new Error("지원하지 않는 월드 생성 버전입니다.");
      }
      function seededRandom(seed) {
        let state = seed >>> 0;
        return function () {
          state = (state + 0x6D2B79F5) >>> 0;
          let t = Math.imul(state ^ (state >>> 15), 1 | state);
          t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      function createSites(seed) {
        const random = seededRandom((seed ^ 0x91E10DA5) >>> 0);
        let sites = [];
        for (let restart = 0; restart < 12 && sites.length < 12; restart++) {
          sites = [];
          for (let attempt = 0; attempt < 4000 && sites.length < 12; attempt++) {
            const point = [24 + Math.floor(random() * 272), 24 + Math.floor(random() * 272)];
            if (sites.every(p => Math.hypot(p[0] - point[0], p[1] - point[1]) >= 58)) sites.push(point);
          }
        }
        if (sites.length < 12) {
          sites = [];
          for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) sites.push([40 + col * 80 + Math.floor(random() * 19) - 9, 50 + row * 110 + Math.floor(random() * 19) - 9]);
        }
        const closeRandom = seededRandom((seed ^ 0xA24BAED4) >>> 0);
        let closePair = null;
        if (closeRandom() < 0.25) {
          for (let attempt = 0; attempt < 800; attempt++) {
            const anchor = Math.floor(closeRandom() * 11);
            const angle = closeRandom() * Math.PI * 2;
            const distance = 27 + closeRandom() * 10;
            const point = [Math.round(sites[anchor][0] + Math.cos(angle) * distance), Math.round(sites[anchor][1] + Math.sin(angle) * distance)];
            if (point.some(v => v < 24 || v > 295)) continue;
            if (sites.slice(0, 11).some((p, i) => i !== anchor && Math.hypot(p[0] - point[0], p[1] - point[1]) < 58)) continue;
            sites[11] = point;
            closePair = [anchor + 1, 12];
            break;
          }
        }
        let minDistance = Infinity;
        for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) minDistance = Math.min(minDistance, Math.hypot(sites[i][0] - sites[j][0], sites[i][1] - sites[j][1]));
        return {sites, closePair, minDistance};
      }
      function terrainHash(x, y, seed) {
        let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
      }
      function terrainNoise(x, y, scale, seed) {
        const fx = x / scale, fy = y / scale;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        let tx = fx - ix, ty = fy - iy;
        tx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
        ty = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
        const a = terrainHash(ix, iy, seed) * (1 - tx) + terrainHash(ix + 1, iy, seed) * tx;
        const b = terrainHash(ix, iy + 1, seed) * (1 - tx) + terrainHash(ix + 1, iy + 1, seed) * tx;
        return (a * (1 - ty) + b * ty) * 2 - 1;
      }
      function terrainFbm(x, y, scale, seed) {
        return terrainNoise(x, y, scale, seed) * 0.57 + terrainNoise(x, y, scale / 2.3, seed + 31) * 0.29 + terrainNoise(x, y, scale / 5.7, seed + 79) * 0.14;
      }
      function terrainSmooth(a, b, value) {
        const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
        return t * t * (3 - 2 * t);
      }
      function terrainByte(value) { return Math.round(Math.max(0, Math.min(1, value)) * 255); }
      function generateMap(seed) {
        const size = 320, radius = 22, count = size * size;
        const placement = createSites(seed);
        const fields = {terrain:new Uint8Array(count), risk:new Uint8Array(count), reward:new Uint8Array(count), noise:new Uint8Array(count)};
        const water = new Uint8Array(count);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const index = y * size + x;
          let rawDistance = Infinity, distance = Infinity, weightSum = 0, noiseSum = 0;
          for (let i = 0; i < placement.sites.length; i++) {
            const site = placement.sites[i];
            const d = Math.hypot(x - site[0], y - site[1]);
            const local = terrainFbm(x + site[0] * 0.41, y - site[1] * 0.36, 52, seed + i * 137);
            const q = d / radius * (1 + 0.30 * local);
            const weight = 1 / Math.pow(Math.max(q, 0.0001), 4);
            rawDistance = Math.min(rawDistance, d); distance = Math.min(distance, q);
            weightSum += weight; noiseSum += weight * local;
          }
          const localBlend = noiseSum / weightSum;
          const gate = terrainSmooth(0.65, 2.4, distance);
          const structural = terrainFbm(x + 397, y - 219, 105, seed + 901);
          const moisture = terrainFbm(x - 741, y + 522, 57, seed + 403);
          const hazard = terrainFbm(x - 379, y + 816, 39, seed + 719);
          const resource = terrainFbm(x + 927, y - 312, 27, seed + 1163);
          const risk = Math.max(0, Math.min(1, Math.max(0, distance - 0.85) * 0.46 + gate * hazard * 0.13));
          const reward = 0.18 + Math.max(0, distance - 0.30) * 0.24 + gate * (0.12 * resource + 0.07 * localBlend);
          const land = terrainFbm(x + 168, y + 93, 102, seed + 1709) + (1 - terrainSmooth(8, 30, rawDistance)) * 0.5;
          const height = 0.14 + risk * 0.48 + gate * (structural * 0.42 + Math.abs(hazard) * 0.14);
          let terrain = moisture > -0.26 ? 4 : 3;
          if (moisture + localBlend * 0.25 > 0.07 && rawDistance > 9) terrain = 5;
          if (height > 0.48) terrain = 6;
          if (height > 0.63) terrain = 7;
          if (height > 0.77) terrain = 8;
          if (land < -0.17 && rawDistance > 12) { terrain = land > -0.32 ? 1 : 0; water[index] = 1; }
          fields.terrain[index] = terrain; fields.risk[index] = terrainByte(risk);
          fields.reward[index] = terrainByte(reward); fields.noise[index] = terrainByte(localBlend * 0.5 + 0.5);
        }
        const directions = [[1,0],[0,1],[-1,0],[0,-1]];
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const index = y * size + x;
          if (water[index]) continue;
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            const nx = x + ox, ny = y + oy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size && water[ny * size + nx]) fields.terrain[index] = 2;
          }
        }
        const foodIndices = new Set();
        for (let by = 0; by < size; by += 12) for (let bx = 0; bx < size; bx += 12) {
          const cx = Math.min(size - 2, bx + 2 + Math.floor(terrainHash(bx, by, seed + 2201) * 8));
          const cy = Math.min(size - 2, by + 2 + Math.floor(terrainHash(bx, by, seed + 2203) * 8));
          const index = cy * size + cx, potential = fields.reward[index] / 255;
          if (fields.terrain[index] < 3 || fields.terrain[index] > 6 || terrainHash(bx, by, seed + 2237) > 0.18 + potential * 0.48) continue;
          const target = 2 + Math.floor(potential * 11), patch = [[cx, cy]], visited = new Set([index]);
          for (let cursor = 0; cursor < patch.length && patch.length < target; cursor++) {
            const [px, py] = patch[cursor];
            const first = Math.floor(terrainHash(px, py, seed + 2311) * 4);
            for (let step = 0; step < 4 && patch.length < target; step++) {
              const [ox, oy] = directions[(first + step) % 4], nx = px + ox, ny = py + oy, key = ny * size + nx;
              if (nx < 0 || ny < 0 || nx >= size || ny >= size || visited.has(key)) continue;
              visited.add(key);
              if (fields.terrain[key] >= 3 && fields.terrain[key] <= 6) patch.push([nx, ny]);
            }
          }
          for (const [x, y] of patch) foodIndices.add(y * size + x);
        }
        return {size,radius,seed,sites:placement.sites,closePair:placement.closePair,minDistance:placement.minDistance,fields,foodIndices,food:Array.from(foodIndices, index => [index % size, Math.floor(index / size)])};
      }
      const generated = generateMap(seed);
      const hazards = new Uint8Array(320 * 320);
      const creatureDensity = new Uint8Array(320 * 320);
      for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) {
        const index = y * 320 + x, terrain = generated.fields.terrain[index];
        if (terrain < 2 || terrain > 6) continue;
        const distance = Math.min(...generated.sites.map(site => Math.hypot(x - site[0], y - site[1])));
        if (distance >= 26) creatureDensity[index] = terrainByte(terrainFbm(x + 613, y - 487, 32, seed + 8101) * 0.5 + 0.5);
        if (distance <= 14) continue;
        const noise = terrainNoise(x, y, 14, seed + 7109);
        if (generated.fields.risk[index] > 45 && noise > 0.12) hazards[index] = 1;
        else if (generated.fields.risk[index] > 35 && noise < -0.16) hazards[index] = 2;
      }
      const world = {
        seed,
        generationVersion: version ?? WORLD_GENERATION_VERSION,
        hazards,
        creatureDensity,
        terrain: generated.fields.terrain,
        food: generated.food.filter(([x, y]) => generated.sites.every(site => Math.hypot(x - site[0], y - site[1]) > STARTING_FOOD_RADIUS)).map(([x, y]) => [x, y, 50]),
        origin: { x: generated.sites[0][0], y: generated.sites[0][1] },
        sites: generated.sites
      };
      if (world.generationVersion >= 2) populateStartingForests(world);
      world.food.push(...generateStartingFood(world, STARTING_FOOD_CAP));
      world.food = world.food.map(([x, y, amount, resourceType]) => [x, y, amount, resourceType || foodType(world, x, y)])
        .filter(([, , , resourceType]) => resourceType !== null);
      world.burrows = generateBurrows(world);
      world.resources = generateResources(world);
      world.tribes = generateTribes(world);
      return world;
    }

function foodHash(x, y, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function foodNoise(x, y, scale, seed) {
  const px = x / scale, py = y / scale;
  const ix = Math.floor(px), iy = Math.floor(py);
  let tx = px - ix, ty = py - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  return ((foodHash(ix, iy, seed) * (1 - tx) + foodHash(ix + 1, iy, seed) * tx) * (1 - ty) +
    (foodHash(ix, iy + 1, seed) * (1 - tx) + foodHash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;
}

function populateStartingForests(world) {
  for (const [cx, cy] of world.sites) {
    const angle = foodHash(cx, cy, world.seed + 13001) * Math.PI * 2;
    const centerX = cx + Math.round(Math.cos(angle) * 7);
    const centerY = cy + Math.round(Math.sin(angle) * 7);
    for (let y = centerY - 7; y <= centerY + 7; y++) for (let x = centerX - 7; x <= centerX + 7; x++) {
      if (x < 0 || y < 0 || x >= 320 || y >= 320) continue;
      const index = y * 320 + x;
      const radius = 6 + foodNoise(x + 193, y - 317, 5, world.seed + 13003);
      if (Math.hypot(x - centerX, y - centerY) > radius || world.hazards[index] ||
        world.terrain[index] < 3 || world.terrain[index] > 5 ||
        world.sites.some(([sx, sy]) => Math.hypot(x - sx, y - sy) < 4)) continue;
      world.terrain[index] = 5;
    }
  }
}

export function generateStartingFood(world, cap) {
  const size = 320, radius = STARTING_FOOD_RADIUS, seed = world.seed;
  const contexts = world.sites.map(([cx, cy]) => {
    const distances = new Int16Array(size * size).fill(-1);
    const queue = [[cx, cy]];
    distances[cy * size + cx] = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const [x, y] = queue[cursor];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, index = ny * size + nx;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size || Math.hypot(nx - cx, ny - cy) > radius) continue;
        if (distances[index] >= 0 || world.terrain[index] < 2 || world.terrain[index] > 6 || world.hazards[index]) continue;
        distances[index] = distances[y * size + x] + 1;
        queue.push([nx, ny]);
      }
    }
    const candidates = [];
    for (const [x, y] of queue) {
      if (world.terrain[y * size + x] < 3 || world.sites.some(site => Math.hypot(x - site[0], y - site[1]) < 3) ||
        world.generationVersion !== 1 && !isFoodHabitat("honey-mushrooms", world, x, y)) continue;
      const density = Math.max(0.02, 0.5 + foodNoise(x + 317, y - 193, 13, seed + 9721) * 0.34 + foodNoise(x - 51, y + 93, 5, seed + 9743) * 0.16);
      const priority = -Math.log(Math.max(0.000001, foodHash(x + 1379, y - 411, seed + 9973))) / (0.025 + density ** 3);
      candidates.push({ x, y, distance: Math.hypot(x - cx, y - cy), path: distances[y * size + x], priority });
    }
    candidates.sort((a, b) => a.priority - b.priority);
    const first = candidates.find(point => point.distance <= 6 && point.path <= 10);
    return { cx, cy, distances, candidates: first ? [first, ...candidates.filter(point => point !== first)] : candidates,
      remaining: Math.round(300 + foodNoise(cx + 791, cy - 431, 37, seed + 9901) * 90) };
  });
  const food = [];
  for (const context of contexts) {
    for (const separation of [3.4, 2.2, 1]) {
      for (const point of context.candidates) {
        if (context.remaining <= 0) break;
        if (food.some(([x, y]) => Math.hypot(point.x - x, point.y - y) < separation)) continue;
        const neighbors = contexts.filter(other => Math.hypot(point.x - other.cx, point.y - other.cy) <= radius);
        if (neighbors.some(other => other.distances[point.y * size + point.x] < 0 || other.remaining <= 0)) continue;
        const low = Math.ceil(cap * 0.75);
        const amount = Math.min(low + Math.floor(foodHash(point.x + 41, point.y - 67, seed + 9989) * (cap - low + 1)), ...neighbors.map(other => other.remaining));
        food.push([point.x, point.y, amount, "honey-mushrooms"]);
        for (const other of neighbors) other.remaining -= amount;
      }
    }
  }
  return food;
}

function foodType(world, x, y) {
  if (world.generationVersion !== 1) {
    const choices = FOOD_HABITATS.filter(habitat => (world.generationVersion >= 4 || habitat.key !== "tree-fruit") &&
      isFoodHabitat(habitat.key, world, x, y));
    if (!choices.length) return null;
    return choices[Math.floor(foodHash(x, y, world.seed + 10531) * choices.length)].key;
  }
  const terrain = world.terrain[y * 320 + x];
  const value = foodHash(x, y, world.seed + 10531);
  if (terrain === 5) return value < 0.45 ? "honey-mushrooms" : value < 0.75 ? "berry-bush" : "nutrient-moss";
  if (terrain === 4) return value < 0.3 ? "honey-mushrooms" : value < 0.55 ? "root-bulbs" : value < 0.8 ? "berry-bush" : "nutrient-moss";
  return value < 0.7 ? "seed-pods" : "root-bulbs";
}

export function generateResources(world) {
  if (world.generationVersion === 1 || world.generationVersion === 2) return generateLegacyResources(world);
  const size = 320, blocked = new Uint8Array(size * size), occupied = new Uint8Array(size * size);
  const distances = new Int32Array(size * size).fill(-1);
  for (let index = 0; index < blocked.length; index++) {
    if (world.terrain[index] < 2 || world.terrain[index] > 6 || world.hazards[index]) blocked[index] = 1;
  }
  for (const burrow of world.burrows || []) {
    for (let y = burrow.y - 1; y <= burrow.y + burrow.height; y++) {
      for (let x = burrow.x - 1; x <= burrow.x + burrow.width; x++) {
        if (x >= 0 && y >= 0 && x < size && y < size) blocked[y * size + x] = 1;
      }
    }
  }
  const queue = [];
  for (const [x, y] of world.sites) {
    const index = y * size + x;
    if (!blocked[index] && distances[index] < 0) { distances[index] = 0; queue.push(index); }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor], x = index % size, y = Math.floor(index / size);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, next = ny * size + nx;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || blocked[next] || distances[next] >= 0) continue;
      distances[next] = distances[index] + 1;
      queue.push(next);
    }
  }
  for (const [x, y] of world.food) occupied[y * size + x] = 1;
  const points = [];
  for (const index of queue) {
    if (occupied[index]) continue;
    const x = index % size, y = Math.floor(index / size), nearSites = [];
    let distance = Infinity;
    world.sites.forEach(([cx, cy], siteIndex) => {
      const gap = Math.hypot(x - cx, y - cy);
      distance = Math.min(distance, gap);
      if (gap <= RESOURCE_PLACEMENT.nearRadius) nearSites.push(siteIndex);
    });
    if (distance >= 4) points.push({ x, y, index, distance, nearSites });
  }
  const candidates = new Map(RESOURCE_HABITATS.map((habitat, typeIndex) => [habitat.key,
    points.filter(point => point.distance >= habitat.minDistance && distances[point.index] >= habitat.minDistance &&
      isResourceHabitat(habitat.key, world, point.x, point.y)).map(point => ({ ...point,
      priority: foodNoise(point.x + 617, point.y - 349, 36, world.seed + 14009 + typeIndex * 137) * 0.8 +
        foodNoise(point.x - 193, point.y + 431, 13, world.seed + 14011 + typeIndex * 139) * 0.2 +
        foodHash(point.x, point.y, world.seed + 14029 + typeIndex * 149) * 0.08
    })).sort((left, right) => right.priority - left.priority || left.index - right.index)]));
  const nearTypes = world.sites.map(([cx, cy], siteIndex) => new Set(RESOURCE_HABITATS
    .filter(habitat => habitat.rarity === "common" && candidates.get(habitat.key).some(point => point.nearSites.includes(siteIndex)))
    .map(habitat => ({ key: habitat.key, priority: foodHash(cx + RESOURCE_HABITATS.indexOf(habitat) * 31, cy, world.seed + 15013) }))
    .sort((left, right) => left.priority - right.priority).slice(0, RESOURCE_PLACEMENT.nearTypes).map(entry => entry.key)));
  const nearCounts = world.sites.map(() => new Map());
  const resources = [];
  RESOURCE_HABITATS.forEach((habitat, typeIndex) => {
    const entries = candidates.get(habitat.key), placed = [];
    const available = point => !occupied[point.index] &&
      point.nearSites.every(siteIndex => nearTypes[siteIndex].has(habitat.key) &&
        (nearCounts[siteIndex].get(habitat.key) || 0) < RESOURCE_PLACEMENT.nearNodes) &&
      placed.every(other => Math.hypot(point.x - other.x, point.y - other.y) >= habitat.separation);
    const add = point => {
      if (!point || !available(point)) return;
      occupied[point.index] = 1;
      placed.push(point);
      for (const siteIndex of point.nearSites) nearCounts[siteIndex].set(habitat.key,
        (nearCounts[siteIndex].get(habitat.key) || 0) + 1);
      const local = point.nearSites.length > 0;
      const amount = (local ? 8 : habitat.rarity === "rare" ? 6 : 12) +
        Math.floor(foodHash(point.x, point.y, world.seed + 16001 + typeIndex * 139) * (local ? 7 : habitat.rarity === "rare" ? 9 : 17));
      resources.push([point.x, point.y, amount, habitat.key]);
    };
    world.sites.forEach((site, siteIndex) => {
      if (nearTypes[siteIndex].has(habitat.key)) add(entries.find(point => point.nearSites.includes(siteIndex) && available(point)));
    });
    for (const point of entries) {
      if (placed.length >= habitat.nodes) break;
      add(point);
    }
  });
  return resources;
}

function generateLegacyResources(world) {
  const size = 320;
  const blocked = new Uint8Array(size * size);
  const occupied = new Uint8Array(size * size);
  const reachable = new Uint8Array(size * size);
  const terrains = new Map([
    ["twigs", [5, 4]], ["bark", [5]], ["pebbles", [6, 2, 3]],
    ["clay", [2, 4]], ["sand", [2, 3]], ["dry-leaves", [5, 4]],
    ["grass-fiber", [4, 3]], ["root-fiber", [5, 2, 4]], ["spider-silk", [5, 6]],
    ["water", [2, 4]], ["tree-sap", [5]], ["leaf-mold", [5, 4]],
    ["resin", [5]], ["beeswax", [5]], ["carapace", [4, 5, 6]],
    ["iron-ore", [6, 3]], ["copper-ore", [6, 3]], ["quartz", [6, 2]]
  ]);
  for (let index = 0; index < blocked.length; index++) {
    if (world.terrain[index] < 2 || world.terrain[index] > 6 || world.hazards[index]) blocked[index] = 1;
  }
  for (const burrow of world.burrows || []) {
    for (let y = burrow.y - 1; y <= burrow.y + burrow.height; y++) {
      for (let x = burrow.x - 1; x <= burrow.x + burrow.width; x++) {
        if (x >= 0 && y >= 0 && x < size && y < size) blocked[y * size + x] = 1;
      }
    }
  }
  const queue = [];
  for (const [x, y] of world.sites) {
    const index = y * size + x;
    if (!blocked[index] && !reachable[index]) { reachable[index] = 1; queue.push(index); }
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      if (dx * dx + dy * dy >= 16 || x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;
      occupied[(y + dy) * size + x + dx] = 1;
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor], x = index % size, y = Math.floor(index / size);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, next = ny * size + nx;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || blocked[next] || reachable[next]) continue;
      reachable[next] = 1;
      queue.push(next);
    }
  }
  for (const [x, y] of world.food) occupied[y * size + x] = 1;
  const candidates = Array.from({ length: 7 }, () => []);
  for (const index of queue) {
    if (!occupied[index]) candidates[world.terrain[index]].push(index);
  }
  const resources = [];
  let typeIndex = 0;
  for (const definition of RESOURCE_TYPES.filter(entry => entry.category === "material")) {
    const terrainOrder = terrains.get(definition.key);
    const entries = terrainOrder.flatMap((terrain, rank) => candidates[terrain].map(index => {
      const x = index % size, y = Math.floor(index / size);
      return { x, y, index, priority: rank + foodHash(x, y, world.seed + 11003 + typeIndex * 137) };
    }));
    entries.sort((left, right) => left.priority - right.priority || left.index - right.index);
    const placed = [];
    const add = point => {
      if (!point || occupied[point.index]) return false;
      occupied[point.index] = 1;
      placed.push(point);
      const amount = 16 + Math.floor(foodHash(point.x, point.y, world.seed + 12007 + typeIndex * 139) * 25);
      resources.push([point.x, point.y, amount, definition.key]);
      return true;
    };
    for (const [cx, cy] of world.sites) {
      add(entries.find(point => !occupied[point.index] && Math.hypot(point.x - cx, point.y - cy) <= 28 &&
        placed.every(other => Math.hypot(point.x - other.x, point.y - other.y) >= 5)));
    }
    for (const point of entries) {
      if (placed.length >= Math.max(24, world.sites.length * 2)) break;
      if (placed.some(other => Math.hypot(point.x - other.x, point.y - other.y) < 9)) continue;
      add(point);
    }
    if (!placed.length) add(entries.find(point => !occupied[point.index]));
    typeIndex++;
  }
  return resources;
}
