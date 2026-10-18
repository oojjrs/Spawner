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
        placement.sites.forEach(([sx, sy], i) => {
          const angle = terrainHash(i, 17, seed + 5003) * Math.PI * 2;
          const cx = sx + Math.round(Math.cos(angle) * 8), cy = sy + Math.round(Math.sin(angle) * 8);
          for (const [ox, oy] of [[0,0],[1,0],[0,1]]) { const index = (cy + oy) * size + cx + ox; fields.terrain[index] = 4; foodIndices.add(index); }
        });
        return {size,radius,seed,sites:placement.sites,closePair:placement.closePair,minDistance:placement.minDistance,fields,foodIndices,food:Array.from(foodIndices, index => [index % size, Math.floor(index / size)])};
      }
      const generated = generateMap(seed);
      return {
        terrain: generated.fields.terrain,
        food: generated.food,
        origin: { x: generated.sites[0][0], y: generated.sites[0][1] },
        sites: generated.sites
      };
    }
