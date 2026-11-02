import { quantizeLandscapeValue } from "./landscape-processes.mjs";
import { createLandscapeHabitats, landscapeResourceSuitability } from "./landscape-ecology.mjs";
import { recordPlacementMap, placementNoise } from "./placement-maps.mjs";
import { createFormedHabitats, formedResourceSuitability } from "./terrain-resources.mjs";

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

function bounded(value) { return Math.max(0, Math.min(1, value)); }

export function createResourceHabitats(world) {
  if(world.hydrology?.generationVersion>=33)return world.hydrology.resourceHabitats||createFormedHabitats(world);
  if (world.hydrology?.generationVersion >= 32) return createLandscapeHabitats(world);
  const { size, terrain, hydrology: h } = world, length = terrain.length, seed = h.seed;
  const rainfall = new Float32Array(length), soilMoisture = new Float32Array(length), soilDepth = new Float32Array(length);
  const soilFertility = new Float32Array(length), forestCover = new Float32Array(length), exposure = new Float32Array(length);
  const parentRock = new Float32Array(length), sandySoil = new Float32Array(length), shelter = new Float32Array(length);
  const sources = {
    bedrock: placementNoise(h, "soil:bedrock-noise", ["resources"], (x, y) => noise(x, y, 47, seed + 2003)),
    detail: placementNoise(h, "soil:bedrock-detail", ["resources"], (x, y) => noise(x, y, 17, seed + 2011)),
    sand: placementNoise(h, "soil:sand-noise", ["resources"], (x, y) => noise(x, y, 31, seed + 2017))
  };
  const mountainDistance = new Uint8Array(length).fill(255), queue = new Int32Array(length);
  let end = 0;
  for (let index = 0; index < length; index++) if (terrain[index] >= 6 && terrain[index] <= 8) {
    mountainDistance[index] = 0; queue[end++] = index;
  }
  for (let cursor = 0; cursor < end; cursor++) {
    const index = queue[cursor], x = index % size, y = Math.floor(index / size);
    if (mountainDistance[index] >= 12) continue;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const next = ny * size + nx;
      if (mountainDistance[next] <= mountainDistance[index] + 1) continue;
      mountainDistance[next] = mountainDistance[index] + 1; queue[end++] = next;
    }
  }
  for (let index = 0; index < length; index++) {
    const x = index % size, y = Math.floor(index / size);
    let trees = 0, samples = 0, surroundingHeight = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;
      const next = (y + dy) * size + x + dx;
      trees += terrain[next] === 5 ? 1 : 0; samples++;
    }
    for (const [dx, dy] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) {
      surroundingHeight += h.height[Math.max(0, Math.min(size - 1, y + dy)) * size + Math.max(0, Math.min(size - 1, x + dx))];
    }
    const climate = noise(x, y, 25, seed + 31) * .68 + noise(x, y, 9, seed + 73) * .32;
    const slope = bounded(h.slope[index] * 14), mountain = terrain[index] >= 6 && terrain[index] <= 8 ? 1 : 0;
    forestCover[index] = trees / samples;
    rainfall[index] = h.island || h.continent ? bounded((h.rainfall[index] - .25) / 1.3) : bounded(.5 + climate * .65);
    shelter[index] = bounded(.5 + (surroundingHeight / 4 - h.height[index]) * 5 - slope * .2);
    exposure[index] = bounded(.2 + slope * .5 + mountain * .3 - shelter[index] * .15);
    soilMoisture[index] = bounded(.12 + rainfall[index] * .62 + shelter[index] * .16 + h.wetness[index] * .18 - exposure[index] * .1);
    soilDepth[index] = bounded(.15 + rainfall[index] * .35 + shelter[index] * .35 + (1 - exposure[index]) * .2 - mountain * .35);
    parentRock[index] = bounded(.5 + sources.bedrock(x, y) * .4 + sources.detail(x, y) * .15);
    sandySoil[index] = bounded(.55 - parentRock[index] * .45 + sources.sand(x, y) * .3);
    soilFertility[index] = bounded(soilDepth[index] * (.25 + parentRock[index] * .4 + forestCover[index] * .35) + h.fertility[index] * .28);
  }
  for (const [key, values] of Object.entries({ rainfall, soilMoisture, soilDepth, soilFertility, forestCover, exposure, parentRock, sandySoil, shelter })) {
    recordPlacementMap(h, "habitat:" + key, ["forest", "swamp", "resources"], values, { minimum: 0, maximum: 1 });
  }
  recordPlacementMap(h, "habitat:mountain-distance", ["mountains", "resources"], mountainDistance, { minimum: 0, maximum: 12, excluded: 255 });
  const result = { rainfall, soilMoisture, soilDepth, soilFertility, forestCover, exposure, parentRock, sandySoil, shelter, mountainDistance };
  return result;
}

export function resourceHabitatSuitability(key, index, terrain, h) {
  if(h.generationVersion>=33)return quantizeLandscapeValue(formedResourceSuitability(key,index,terrain,h));
  if (h.generationVersion >= 32) return quantizeLandscapeValue(landscapeResourceSuitability(key, index, terrain, h));
  const type = terrain[index], fields = h.resourceHabitats;
  if (type < 2 || type === 10) return 0;
  const moisture = fields.soilMoisture[index], depth = fields.soilDepth[index], canopy = fields.forestCover[index];
  if (key === "tree") return type === 5 ? depth * (.35 + moisture * .65) : 0;
  if (key === "honey-mushrooms") return (h.island || h.continent ? type === 4 && canopy > 0 : type === 5) ? depth * canopy * (.2 + moisture * .8) : 0;
  if (key === "dew") return type === 4 || h.generationVersion >= 30 && type === 9 ? (.2 + moisture * .6 + fields.shelter[index] * .2) * (.6 + canopy * .4) : 0;
  if (key === "clay") return [3, 4, 5, 9].includes(type) ? fields.soilFertility[index] * (.5 + depth * .5) : 0;
  if (key === "pebbles" && h.generationVersion >= 29) {
    if (![2, 3, 4, 6].includes(type)) return 0;
    const distance = fields.mountainDistance[index];
    const talus = distance <= 3 ? Math.exp(-distance / 2) * fields.exposure[index] * fields.parentRock[index] * .25 : 0;
    const fan = distance <= 10 && h.flow[index] > 35 && h.slope[index] < .03 ? Math.min(1, Math.log1p(h.flow[index]) / 6) * .1 : 0;
    return h.gravel[index] * 18 + talus + fan;
  }
  if (key === "pebbles") return [2, 3, 4, 6].includes(type) ? h.gravel[index] * .5 +
    Math.exp(-fields.mountainDistance[index] / 4) * (.3 + fields.exposure[index]) + fields.exposure[index] * fields.parentRock[index] * .2 : 0;
  return 0;
}
