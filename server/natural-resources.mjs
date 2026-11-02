import { quantizeLandscapeValue } from "./landscape-processes.mjs";
import { distributeLandscapeBiomes } from "./landscape-ecology.mjs";
import { recordPlacementMap, placementNoise } from "./placement-maps.mjs";
import { populateFormedResources } from "./terrain-resources.mjs";

import { createResourceHabitats, resourceHabitatSuitability } from "./resource-habitats.mjs";

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

export const TERRAIN_DISTRIBUTION = { swamp: .07, forest: .22, dryLand: .12, poisonSpore: .025 };

function distributeNaturalBiomes(world, fields, version) {
  const { size, seed, terrain, hydrology: h } = world;
  const sources = {
    wetland: placementNoise(h, "biome:wetland-noise", ["swamp"], (x, y) => noise(x, y, 21, seed + 3023)),
    forestBroad: placementNoise(h, "biome:forest-broad", ["forest"], (x, y) => noise(x, y, 37, seed + 3001)),
    forestDetail: placementNoise(h, "biome:forest-detail", ["forest"], (x, y) => noise(x, y, 13, seed + 3011)),
    glades: placementNoise(h, "biome:glades", ["forest"], (x, y) => noise(x, y, 7, seed + 3019)),
    dry: placementNoise(h, "biome:dry-noise", ["forest", "resources"], (x, y) => noise(x, y, 29, seed + 3331))
  };
  const land = terrain.filter(type => type >= 2 && type !== 10).length, lowlands = [];
  for (let index = 0; index < terrain.length; index++) {
    if (terrain[index] < 3 || terrain[index] > 5) continue;
    const x = index % size, y = Math.floor(index / size);
    const flatness = 1 / (1 + h.slope[index] * 100), convergence = Math.min(1, Math.log1p(h.flow[index]) / 8);
    lowlands.push({ index,
      swamp: fields.soilMoisture[index] * .28 + flatness * .28 + h.wetness[index] * .2 + convergence * .12 +
        sources.wetland(x, y) * .12,
      forest: fields.rainfall[index] * .55 + fields.soilDepth[index] * .25 +
        sources.forestBroad(x, y) * .13 + sources.forestDetail(x, y) * .06,
      dry: (1 - fields.soilMoisture[index]) * .65 + fields.sandySoil[index] * .2 + sources.dry(x, y) * .15 });
    terrain[index] = 4;
  }
  if (h.placementMaps) for (const [key, layer] of [["swamp", "swamp"], ["forest", "forest"], ["dry", "forest"]]) {
    const values = new Float32Array(terrain.length).fill(NaN);
    for (const item of lowlands) values[item.index] = item[key];
    recordPlacementMap(h, "biome:" + key + "-score", [layer], values, {});
  }
  const wetlands = lowlands.filter(item => h.slope[item.index] < .025 && fields.soilMoisture[item.index] > .42)
    .sort((left, right) => right.swamp - left.swamp || left.index - right.index).slice(0, Math.round(land * TERRAIN_DISTRIBUTION.swamp));
  for (const { index } of wetlands) terrain[index] = 9;
  const forests = lowlands.filter(item => terrain[item.index] === 4 && sources.glades(item.index % size, Math.floor(item.index / size)) < .3)
    .sort((left, right) => right.forest - left.forest || left.index - right.index).slice(0, Math.round(land * TERRAIN_DISTRIBUTION.forest));
  for (const { index } of forests) terrain[index] = 5;
  const drylands = lowlands.filter(item => terrain[item.index] === 4)
    .sort((left, right) => right.dry - left.dry || left.index - right.index).slice(0, Math.round(land * TERRAIN_DISTRIBUTION.dryLand));
  for (const { index } of drylands) terrain[index] = 3;
  const colonies = wetlands.slice().sort((left, right) => {
    const score = item => noise(item.index % size, Math.floor(item.index / size), 15, seed + 3037) * .7 + item.swamp * .3;
    return score(right) - score(left) || left.index - right.index;
  });
  if (version < 30) for (const { index } of colonies.slice(0, Math.round(land * TERRAIN_DISTRIBUTION.poisonSpore))) world.hazards[index] = 1;

}

export function populateNaturalResources(world, version) {
  if(version>=33)return populateFormedResources(world);
  const { size, seed, terrain, hydrology: h } = world, occupied = new Uint8Array(terrain.length);
  const fields = createResourceHabitats(world);
  if (version >= 32) distributeLandscapeBiomes(world, fields);
  else if (version >= 28) distributeNaturalBiomes(world, fields, version);
  else for (let index = 0; index < terrain.length; index++) {
    if (terrain[index] < 3 || terrain[index] > 5) continue;
    const x = index % size, y = Math.floor(index / size);
    const forest = fields.rainfall[index] * .55 + fields.soilDepth[index] * .25 +
      noise(x, y, 37, seed + 3001) * .13 + noise(x, y, 13, seed + 3011) * .06;
    terrain[index] = forest > .43 && noise(x, y, 7, seed + 3019) < .3 ? 5 : fields.rainfall[index] < .34 ? 3 : 4;
  }
  h.resourceHabitats = createResourceHabitats(world);
  const habitat = h.resourceHabitats;
  world.resources = []; world.food = [];
  for (let index = 0; index < terrain.length; index++) {
    const x = index % size, y = Math.floor(index / size);
    if (!(version >= 28) && terrain[index] === 4 && h.wetness[index] > .65 && h.slope[index] < .012 && noise(x, y, 17, seed + 3023) > .1) {
      terrain[index] = 9;
      if (h.wetness[index] > .7 && noise(x, y, 11, seed + 3037) > .15) world.hazards[index] = 1;
    }
    if (h.forestMask ? !h.forestMask[index] : terrain[index] !== 5) continue;
    const amount = Math.round(20 + habitat.soilDepth[index] * 35 + habitat.soilMoisture[index] * 25);
    world.resources.push([x, y, amount, "tree"]); occupied[index] = 1;
  }
  const definitions = [
    ["clay", .025, .065, 12, 28], ["pebbles", ...(version >= 29 ? [0, .4, 12, 42] : [.02, .085, 10, 30])], ["dew", .025, .06, 3, 10],
    ["honey-mushrooms", .04, .15, 10, 35]
  ];
  for (const [order, [key, minimum, density, baseAmount, richness]] of definitions.entries()) {
    if (version >= 30 && key === "honey-mushrooms") continue;
    const patchNoise = placementNoise(version >= 32 ? null : h, "resource:" + key + ":patch", ["resources"],
      (x, y) => noise(x, y, 23, seed + 3067 + order * 37), { resource: key });
    const draw = (x, y) => hash(x, y, seed + 3083 + order * 41);
    const probability = h.placementMaps ? new Float32Array(terrain.length) : null;
    recordPlacementMap(h, "resource:" + key + ":suitability", ["resources"], null,
      { sample: (x, y) => resourceHabitatSuitability(key, y * size + x, terrain, h), resource: key, minimum: 0 });
    recordPlacementMap(h, "resource:" + key + ":draw", ["resources"], null,
      { sample: draw, resource: key, minimum: 0, maximum: 1 });
    for (let index = 0; index < terrain.length; index++) {
      if (occupied[index] || world.hazards[index]) continue;
      const suitability = resourceHabitatSuitability(key, index, terrain, h);
      if (!suitability) continue;
      const x = index % size, y = Math.floor(index / size);
      const patch = version >= 32 ? 1 : .7 + Math.max(0, patchNoise(x, y)) * .7;
      const abundance = suitability / (1 + suitability);
      const chance = version >= 32 ? quantizeLandscapeValue((minimum + density * abundance) * patch) : (minimum + density * abundance) * patch;
      if (probability) probability[index] = chance;
      if (draw(x, y) > chance) continue;
      let amount = Math.max(1, Math.round(baseAmount + richness * abundance * (.5 + hash(x, y, seed + 3089 + order * 43))));
      if (version >= 30 && terrain[index] === 9) {
        if (key === "dew") amount = Math.round(24 + 36 * habitat.soilMoisture[index] + 20 * hash(x, y, seed + 3359));
        if (key === "clay") amount = Math.round(amount * 2);
      }
      const point = [x, y, amount, key]; occupied[index] = 1;
      if (key === "honey-mushrooms") world.food.push(point);
      else world.resources.push(point);
    }
    recordPlacementMap(h, "resource:" + key + ":probability", ["resources"], probability, { resource: key, minimum: 0 });
  }
  if (h.placementMaps) {
    recordPlacementMap(h, "resource:tree:suitability", ["resources"], null,
      { resource: "tree", minimum: 0, sample: (x, y) => resourceHabitatSuitability("tree", y * size + x, terrain, h) });
    const total = new Float32Array(terrain.length);
    for (const [x, y, amount] of world.resources) total[y * size + x] = amount;
    recordPlacementMap(h, "resource:amount", ["resources"], total, { minimum: 0, scope: "all" });
    for (const key of ["tree", ...definitions.map(item => item[0]).filter(key => key !== "honey-mushrooms")]) {
      const amounts = new Float32Array(terrain.length);
      for (const [x, y, amount, type] of world.resources) if (type === key) amounts[y * size + x] = amount;
      recordPlacementMap(h, "resource:" + key + ":amount", ["resources"], amounts, { resource: key, minimum: 0 });
    }
    for (const [id, layer, values] of [["forest", "forest", h.forestMask || Uint8Array.from(terrain, type => type === 5 ? 1 : 0)],
      ["swamp", "swamp", Uint8Array.from(terrain, type => type === 9 ? 1 : 0)]])
      recordPlacementMap(h, "biome:" + id + "-mask", [layer], values, { minimum: 0, maximum: 1 });
  }
}
