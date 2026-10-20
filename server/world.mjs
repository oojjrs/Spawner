export const STARTING_FOOD_RADIUS = 22;
export const STARTING_FOOD_CAP = 10;

export function generateWorld(seed) {
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
        hazards,
        creatureDensity,
        terrain: generated.fields.terrain,
        food: generated.food.filter(([x, y]) => generated.sites.every(site => Math.hypot(x - site[0], y - site[1]) > STARTING_FOOD_RADIUS)).map(([x, y]) => [x, y, 50]),
        origin: { x: generated.sites[0][0], y: generated.sites[0][1] },
        sites: generated.sites
      };
      world.food.push(...generateStartingFood(world, STARTING_FOOD_CAP));
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
      if (world.terrain[y * size + x] < 3 || world.sites.some(site => Math.hypot(x - site[0], y - site[1]) < 3)) continue;
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
        food.push([point.x, point.y, amount]);
        for (const other of neighbors) other.remaining -= amount;
      }
    }
  }
  return food;
}
