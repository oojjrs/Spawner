import { createTerrainRainfall, quantizeLandscapeValue, erodeLandscapeHeight } from "./landscape-processes.mjs";
import { initializePlacementMaps, recordPlacementMap, placementNoise } from "./placement-maps.mjs";

import { measureStartingEconomy, startingTravel } from "./start-economy.mjs";
import { createRiverChannels } from "./river-channels.mjs";
import { resourceHabitatSuitability } from "./resource-habitats.mjs";
import { createIslandCoast } from "./island-coast.mjs";
import { createContinentLandscape } from "./continent-landscape.mjs";
import { createContinentalRelief } from "./continental-relief.mjs";
import { generateFormedLandscape } from "./terrain-formation.mjs";

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

function neighbors(index, size, diagonal) {
  const x = index % size, y = Math.floor(index / size), result = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((!dx && !dy) || (!diagonal && dx && dy) || x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;
    result.push((y + dy) * size + x + dx);
  }
  return result;
}

function flood(height, rainfall, size, landscape) {
  const level = new Float64Array(height), parent = new Int32Array(height.length).fill(-1);
  const order = new Int32Array(height.length), seen = new Uint8Array(height.length), heap = [];
  function less(left, right) { return level[left] < level[right] || level[left] === level[right] && left < right; }
  function push(index) {
    let position = heap.length; heap.push(index);
    while (position > 0) {
      const previous = (position - 1) >>> 1;
      if (!less(index, heap[previous])) break;
      heap[position] = heap[previous]; position = previous;
    }
    heap[position] = index;
  }
  function pop() {
    const first = heap[0], last = heap.pop();
    if (heap.length) {
      let position = 0;
      while (position * 2 + 1 < heap.length) {
        let child = position * 2 + 1;
        if (child + 1 < heap.length && less(heap[child + 1], heap[child])) child++;
        if (!less(heap[child], last)) break;
        heap[position] = heap[child]; position = child;
      }
      heap[position] = last;
    }
    return first;
  }
  for (let index = 0; index < height.length; index++) {
    const x = index % size, y = Math.floor(index / size);
    if (x && y && x < size - 1 && y < size - 1) continue;
    seen[index] = 1; push(index);
  }
  let count = 0;
  while (heap.length) {
    const index = pop(); order[count++] = index;
    for (const next of neighbors(index, size, true)) {
      if (seen[next]) continue;
      seen[next] = 1; parent[next] = index;
      level[next] = Math.max(height[next], level[index] + 0.0000001); push(next);
    }
  }
  if (landscape) for (const index of order) {
    const x = index % size, y = Math.floor(index / size);
    if (!x || !y || x === size - 1 || y === size - 1) continue;
    let steepest = 0;
    for (const next of neighbors(index, size, true)) {
      const distance = Math.hypot(x - next % size + landscape.offsetX[index] - landscape.offsetX[next],
        y - Math.floor(next / size) + landscape.offsetY[index] - landscape.offsetY[next]);
      const slope = (level[index] - level[next]) / distance;
      if (slope > steepest) { steepest = slope; parent[index] = next; }
    }
  }
  const flow = new Float64Array(rainfall), sediment = new Float64Array(height.length);
  for (let cursor = order.length - 1; cursor >= 0; cursor--) {
    const index = order[cursor], next = parent[index];
    if (next < 0) continue;
    const slope = Math.max(0, level[index] - level[next]);
    sediment[index] += Math.sqrt(flow[index]) * slope;
    flow[next] += flow[index]; sediment[next] += sediment[index];
  }
  return { level, parent, order, flow, sediment };
}

export function generateHydrology(terrain, moisture, heightField, size, seed, baseline, version, capturePlacementMaps) {
  if(version>=33)return generateFormedLandscape(terrain,moisture,heightField,size,seed,capturePlacementMaps);
  const natural = version === undefined || version >= 21;
  const length = terrain.length, height = new Float64Array(length), rainfall = new Float64Array(length);
  const water = new Uint8Array(length), river = new Uint8Array(length), lake = new Uint8Array(length);
  const counts = new Uint32Array(11), oldWater = baseline ? baseline.terrain.reduce((sum, type) => sum + (type < 2 ? 1 : 0), 0) : 0;
  if (baseline) for (const type of baseline.terrain) counts[type]++;
  const angle = hash(0, 0, seed + 1801) * Math.PI * 2;
  const coast = version === 24 ? createIslandCoast(size, seed, oldWater) : null;
  const continent = version >= 26 ? createContinentalRelief(size, seed, version, capturePlacementMaps) : version >= 25 ? createContinentLandscape(size, seed) : null;
  const naturalLandscape = Boolean(continent?.natural);
  const capture = {}; initializePlacementMaps(capture, capturePlacementMaps);
  const climateBroad = placementNoise(version >= 32 ? null : capture, "climate:broad", ["water", "forest", "swamp", "resources"], (x, y) => noise(x, y, 25, seed + 31));
  const climateDetail = placementNoise(version >= 32 ? null : capture, "climate:detail", ["water", "forest", "swamp", "resources"], (x, y) => noise(x, y, 9, seed + 73));
  const uplifts = continent ? continent.ranges : version >= 23 ? Array.from({ length: 3 + Math.floor(hash(0, 0, seed + 2201) * 3) }, (_, order) => ({
    x: size * (.18 + hash(order, 0, seed + 2203) * .64), y: size * (.18 + hash(order, 0, seed + 2207) * .64),
    radius: size * (.1 + hash(order, 0, seed + 2213) * .08), height: .35 + hash(order, 0, seed + 2221) * .4
  })) : [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x;
    if (continent) height[index] = continent.height[index];
    else if (version >= 23) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
      const shore = coast ? coast.distance[index] + noise(x, y, 11, seed + 2437) * 1.1 + noise(x, y, 4, seed + 2441) * .3 :
        Math.max(0, edge + noise(x, y, 31, seed + 2237) * 4);
      const corner = (Math.abs(x / (size - 1) * 2 - 1) * Math.abs(y / (size - 1) * 2 - 1)) ** 8;
      let uplift = 0;
      for (const peak of uplifts) {
        const dx = x - peak.x + noise(x, y, 23, seed + 2243) * 5, dy = y - peak.y + noise(x, y, 23, seed + 2251) * 5;
        uplift = Math.max(uplift, peak.height * Math.exp(-(dx * dx + dy * dy) / (peak.radius * peak.radius)));
      }
      const shoreHeight = shore < 0 ? -1.15 + shore * .05 : .15 - Math.exp(-shore / 7) * 1.3;
      height[index] = edge === 0 ? -2 : shoreHeight - corner * .2 + uplift +
        noise(x, y, 49, seed + 2267) * .06 + noise(x, y, 13, seed + 2273) * .025;
    } else if (natural) {
      const wx = x + noise(x, y, 39, seed + 1823) * 7, wy = y + noise(x, y, 39, seed + 1831) * 7;
      height[index] = noise(wx, wy, 18, seed + 127) * .44 + noise(wx, wy, 7, seed + 151) * .1 +
        noise(wx, wy, 74, seed + 1811) * .22 + noise(wx, wy, 43, seed + 1837) * .12 +
        ((x / size - .5) * Math.cos(angle) + (y / size - .5) * Math.sin(angle)) * .1;
    } else height[index] = noise(x, y, 18, seed + 127) * .46 + noise(x, y, 7, seed + 151) * .14 +
      noise(x, y, 74, seed + 1811) * .28 + ((x / size - .5) * Math.cos(angle) + (y / size - .5) * Math.sin(angle)) * .32;
    moisture[index] = climateBroad(x, y) * .68 + climateDetail(x, y) * .32;
    rainfall[index] = .65 + Math.max(0, moisture[index]) * .5 + Math.max(0, height[index]) * .4;
  }
  if (version >= 32) {
    const atmosphere = createTerrainRainfall(height, size, continent.seaLevel, angle); rainfall.set(atmosphere.rainfall);
    for (let index = 0; index < length; index++) moisture[index] = Math.max(-1, Math.min(1, (rainfall[index] - .75) * 1.5));
  }
  if (version >= 23 && version < 32) for (let index = 0; index < length; index++) {
    const x = index % size, y = Math.floor(index / size);
    const nx = Math.max(0, Math.min(size - 1, Math.round(x - Math.cos(angle) * 8)));
    const ny = Math.max(0, Math.min(size - 1, Math.round(y - Math.sin(angle) * 8)));
    const rise = height[index] - height[ny * size + nx];
    rainfall[index] = Math.max(.2, rainfall[index] + Math.max(0, rise) * 1.5 + Math.min(0, rise) * .9);
  }
  let drainage;
  for (let pass = 0; pass < (continent ? continent.erosionPasses : 3); pass++) {
    if (version >= 32) { height.set(erodeLandscapeHeight(height, rainfall, size, continent)); continue; }
    drainage = flood(height, rainfall, size, continent);
    if (continent) {
      for (const index of drainage.order) {
        const next = drainage.parent[index];
        if (next < 0) continue;
        const raised = height[index] + continent.uplift[index] * .0008;
        if (version >= 29 && raised <= continent.seaLevel) continue;
        if (raised <= height[next]) continue;
        const distance = Math.hypot(index % size - next % size + continent.offsetX[index] - continent.offsetX[next],
          Math.floor(index / size) - Math.floor(next / size) + continent.offsetY[index] - continent.offsetY[next]);
        const incision = .02 * Math.sqrt(drainage.flow[index]) / distance * (version >= 32 ? 1.35 - continent.bedrock[index] * .7 : 1);
        const baseLevel = version >= 29 ? Math.max(continent.seaLevel, height[next]) : height[next];
        height[index] = (raised + incision * baseLevel) / (1 + incision);
        if (version >= 32) height[index] = quantizeLandscapeValue(height[index]);
      }
      continue;
    }
    const change = new Float64Array(length);
    for (const index of drainage.order) {
      const next = drainage.parent[index];
      if (next < 0) continue;
      const slope = Math.max(0, height[index] - height[next]);
      const eroded = Math.min(slope * .22, Math.sqrt(drainage.flow[index]) * slope * .008);
      change[index] -= eroded;
      change[next] += eroded * .45;
    }
    for (let index = 0; index < length; index++) height[index] += change[index];
  }
  if (version >= 32) rainfall.set(createTerrainRainfall(height, size, continent.seaLevel, angle).rainfall);
  drainage = flood(height, rainfall, size, continent);
  const riverData = natural ? createRiverChannels(drainage, size, seed, naturalLandscape ? length : oldWater, version >= 27 ? version : naturalLandscape, continent ? { ...continent, height, placementMaps: capture.placementMaps } : null) : null;
  let threshold = riverData?.threshold ?? 190, riverCount = riverData?.count ?? 0;
  if (riverData) { water.set(riverData.water); river.set(riverData.water); }
  else for (let attempt = 0; attempt < 14; attempt++) {
    water.fill(0); river.fill(0); riverCount = 0;
    for (let index = 0; index < length; index++) {
      if (drainage.flow[index] < threshold || drainage.parent[index] < 0) continue;
      const radius = Math.min(2.5, 1.05 + Math.log2(drainage.flow[index] / threshold) * .35);
      const x = index % size, y = Math.floor(index / size), reach = Math.ceil(radius);
      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
        if (dx * dx + dy * dy > radius * radius || x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;
        const next = (y + dy) * size + x + dx;
        if (!water[next]) { water[next] = 1; river[next] = 1; riverCount++; }
      }
    }
    if (riverCount <= oldWater * .38) break;
    threshold *= 1.45;
  }
  let remaining = naturalLandscape ? Infinity : oldWater - riverCount;
  const seaTarget = naturalLandscape ? 0 : Math.floor(remaining * (version >= 23 ? .8 : .48));
  let seaCount = 0, seaLevel = naturalLandscape ? continent.seaLevel : -Infinity;
  for (const index of drainage.order) {
    if (seaCount >= seaTarget) break;
    if (water[index]) continue;
    water[index] = 3; seaCount++; remaining--; seaLevel = drainage.level[index];
  }
  if (naturalLandscape) for (let index = 0; index < length; index++) if (drainage.level[index] <= seaLevel) water[index] = 3;
  const seen = new Uint8Array(length), basins = [];
  const basinDepth = version >= 29 ? .003 : .012;
  for (let first = 0; first < length; first++) {
    if (seen[first] || water[first] === 3 || drainage.level[first] - height[first] < basinDepth) continue;
    const cells = [first], surface = drainage.level[first]; seen[first] = 1;
    for (let cursor = 0; cursor < cells.length; cursor++) for (const next of neighbors(cells[cursor], size, true)) {
      if (seen[next] || water[next] === 3 || drainage.level[next] - height[next] < basinDepth || Math.abs(drainage.level[next] - surface) > .0002) continue;
      seen[next] = 1; cells.push(next);
    }
    if (cells.length >= 20) basins.push({ cells, volume: cells.reduce((sum, index) => sum + drainage.level[index] - height[index], 0) });
  }
  basins.sort((left, right) => right.volume - left.volume || left.cells[0] - right.cells[0]);
  let lakeCount = 0;
  for (const basin of basins) {
    if (remaining <= 0) break;
    basin.cells.sort((left, right) => height[left] - height[right] || left - right);
    let count = 0;
    for (const index of basin.cells) {
      if (remaining <= 0) break;
      if (!water[index]) remaining--;
      water[index] = 2; lake[index] = 1; count++;
    }
    if (count) lakeCount++;
  }
  if (!naturalLandscape) for (const index of drainage.order) {
    if (remaining <= 0) break;
    if (water[index]) continue;
    water[index] = 3; remaining--; seaLevel = Math.max(seaLevel, drainage.level[index]);
  }
  if (riverData) for (let index = 0; index < length; index++) {
    if (water[index] !== 1 || riverData.surface[index] > seaLevel) continue;
    if (version >= 29 && drainage.level[index] > seaLevel) riverData.surface[index] = seaLevel + .0000001;
    else water[index] = 3;
  }
  if (continent && riverData) for (const channel of riverData.channels.slice().sort((left, right) => left.points.at(-1).surface - right.points.at(-1).surface)) {
    let estuary = false;
    for (const point of channel.points) {
      const index = Math.floor(point.y) * size + Math.floor(point.x);
      if (version >= 29) {
        if (water[index] === 3) { point.surface = seaLevel; riverData.surface[index] = seaLevel; }
        else if (water[index] === 1) point.surface = Math.max(point.surface, seaLevel + .0000001);
        continue;
      }
      if (water[index] === 3) estuary = true;
      if (estuary) { water[index] = 3; lake[index] = 0; riverData.surface[index] = seaLevel; point.surface = seaLevel; }
      else point.surface = Math.max(point.surface, seaLevel);
    }
  }
  if (coast || continent) {
    const connected = new Uint8Array(length), cells = new Int32Array(length);
    let end = 0;
    for (let index = 0; index < length; index++) if (water[index] === 3 &&
        (index < size || index >= length - size || index % size === 0 || index % size === size - 1)) { connected[index] = 1; cells[end++] = index; }
    for (let cursor = 0; cursor < end; cursor++) for (const next of neighbors(cells[cursor], size, false)) {
      if (water[next] !== 3 || connected[next]) continue;
      connected[next] = 1; cells[end++] = next;
    }
    for (let index = 0; index < length; index++) if (water[index] === 3 && !connected[index]) { water[index] = 2; lake[index] = 1; }
    connected.fill(0); lakeCount = 0;
    for (let first = 0; first < length; first++) {
      if (water[first] !== 2 || connected[first]) continue;
      lakeCount++; end = 1; cells[0] = first; connected[first] = 1;
      for (let cursor = 0; cursor < end; cursor++) for (const next of neighbors(cells[cursor], size, false)) {
        if (water[next] !== 2 || connected[next]) continue;
        connected[next] = 1; cells[end++] = next;
      }
    }
  }
  if (version >= 29) for (let index = 0; index < length; index++) { river[index] = water[index] === 1 ? 1 : 0; lake[index] = water[index] === 2 ? 1 : 0; }
  const ground = version >= 32 ? new Float64Array(height) : height;
  const waterSurface = version >= 32 ? new Float64Array(length) : null;
  if (version >= 32) for (let index = 0; index < length; index++) {
    waterSurface[index] = quantizeLandscapeValue(water[index] === 3 ? seaLevel : water[index] === 1 ? riverData.surface[index] : drainage.level[index]);
    if (water[index] === 1) ground[index] = quantizeLandscapeValue(Math.min(ground[index], waterSurface[index] - .003 - Math.min(.012, Math.sqrt(riverData.flow[index]) / 18000)));
  }
  const waterDistance = new Uint8Array(length).fill(255), nearestWater = new Int32Array(length).fill(-1), queue = new Int32Array(length);
  let end = 0;
  for (let index = 0; index < length; index++) if (water[index]) {
    waterDistance[index] = 0; nearestWater[index] = index; queue[end++] = index;
  }
  for (let cursor = 0; cursor < end; cursor++) {
    const index = queue[cursor];
    if (waterDistance[index] >= 30) continue;
    for (const next of neighbors(index, size, false)) if (waterDistance[next] > waterDistance[index] + 1) {
      waterDistance[next] = waterDistance[index] + 1; nearestWater[next] = nearestWater[index]; queue[end++] = next;
    }
  }
  const slope = new Float32Array(length), fertility = new Float32Array(length), gravel = new Float32Array(length);
  const sand = new Float32Array(length), rock = new Float32Array(length), wetness = new Float32Array(length);
  const candidates = [];
  for (let index = 0; index < length; index++) {
    const source = nearestWater[index], distance = waterDistance[index];
    const sourceSurface = source < 0 ? drainage.level[index] : version >= 32 ? waterSurface[source] : riverData && water[source] === 1 ? riverData.surface[source] : drainage.level[source];
    const relief = Math.max(0, (version >= 32 ? ground[index] : drainage.level[index]) - sourceSurface);
    const nearbyFlow = source < 0 ? 0 : riverData && water[source] === 1 ? riverData.flow[source] : drainage.flow[source];
    const nearbySediment = source < 0 ? 0 : riverData && water[source] === 1 ? riverData.sediment[source] : drainage.sediment[source];
    for (const next of neighbors(index, size, true)) slope[index] = Math.max(slope[index], Math.abs((version >= 32 ? ground[index] : drainage.level[index]) - (version >= 32 ? ground[next] : drainage.level[next])));
    const damp = Math.exp(-distance / 8) * Math.exp(-relief * 16);
    const bank = riverData && source >= 0 && water[source] === 1 ?
      Math.sign(riverData.bend[source] * (riverData.directionX[source] * (Math.floor(index / size) + .5 - riverData.centerY[source]) -
        riverData.directionY[source] * (index % size + .5 - riverData.centerX[source]))) : 0;
    const deposit = Math.min(1, Math.log1p(nearbySediment) / 7) / (1 + slope[index] * 24) * (1 + bank * .25);
    wetness[index] = damp;
    fertility[index] = damp * (.35 + deposit) / (1 + slope[index] * 18);
    gravel[index] = distance <= 5 && source >= 0 && water[source] === 1 ?
      Math.exp(-distance / 3) * Math.min(1, .15 + nearbySediment / Math.max(1, nearbyFlow) * 12 + slope[index] * 8) : 0;
    sand[index] = distance <= 2 ? Math.exp(-distance) * (.3 + deposit) / (1 + slope[index] * 30) : 0;
    rock[index] = Math.max(0, drainage.level[index] + .1) * .7 + slope[index] * 3;
    moisture[index] = Math.max(-1, Math.min(1, moisture[index] * .7 + damp * .32 - .12));
    heightField[index] = version >= 32 ? ground[index] : riverData && water[index] === 1 ? riverData.surface[index] : drainage.level[index];
    if (water[index]) {
      const deep = water[index] === 2 ? drainage.level[index] - height[index] > .07 :
        water[index] === 3 ? seaLevel - drainage.level[index] > .06 : nearbyFlow > threshold * 6;
      terrain[index] = deep ? 0 : 1;
    } else {
      terrain[index] = moisture[index] > .1 ? 5 : moisture[index] < -.18 ? 3 : 4;
      candidates.push(index);
    }
  }
  const prominence = index => continent ? continent.uplift[index] * .7 + Math.max(0, height[index] - continent.basement[index]) * .3 + slope[index] * .15 : drainage.level[index];
  if (naturalLandscape) for (const index of candidates) {
    const relief = Math.max(0, height[index] - continent.basement[index]);
    if (relief > .085) terrain[index] = relief > .57 ? 8 : relief > .31 ? 7 : 6;
  } else {
    candidates.sort((left, right) => prominence(right) - prominence(left) || left - right);
    const high = counts[7] + counts[8], total = Math.min(candidates.length, counts[6] + high);
    for (let order = 0; order < total; order++) terrain[candidates[order]] = order < counts[8] ? 8 : order < high ? 7 : 6;
  }
  for (const index of candidates) {
    if (terrain[index] >= 6) continue;
    if (version >= 32) {
      const source = nearestWater[index];
      if (source < 0 || waterDistance[index] > 3 || slope[index] > .04) continue;
      if (water[source] === 3 ? ground[index] - seaLevel > .07 || sand[index] < .075 : gravel[index] < .075 && sand[index] < .14) continue;
    } else if (waterDistance[index] !== 1) continue;
    terrain[index] = 2;
  }
  const fordChoices = [];
  for (let index = 0; index < length; index++) {
    const downstream = drainage.parent[index], discharge = riverData ? riverData.flow[index] : drainage.flow[index];
    if (water[index] !== 1 || downstream < 0 || discharge < (version >= 30 ? 80 : threshold) || discharge > (riverData ? Math.max(4000, threshold * 14) : threshold * 14) ||
        slope[index] > .08 || lake[index] || (drainage.level[index] - height[index]) > .025) continue;
    const dx = riverData ? riverData.directionX[index] : downstream % size - index % size;
    const dy = riverData ? riverData.directionY[index] : Math.floor(downstream / size) - Math.floor(index / size);
    const acrossX = Math.abs(dy) >= Math.abs(dx) ? 1 : 0, acrossY = acrossX ? 0 : 1, cells = [];
    let valid = true;
    for (const direction of [-1, 1]) {
      let reached = false;
      for (let step = 0; step <= 7; step++) {
        const x = index % size + acrossX * direction * step, y = Math.floor(index / size) + acrossY * direction * step;
        if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) break;
        const next = y * size + x;
        if (!water[next]) { reached = terrain[next] <= 6; break; }
        if (water[next] !== 1) break;
        cells.push(next);
      }
      if (!reached) valid = false;
    }
    if (valid) fordChoices.push({ index, cells, acrossX, acrossY, priority: slope[index] * 3 + Math.log1p(drainage.flow[index]) * .02 });
  }
  fordChoices.sort((left, right) => left.priority - right.priority || left.index - right.index);
  const fords = [];
  for (const choice of fordChoices) {
    const x = choice.index % size, y = Math.floor(choice.index / size);
    if (fords.some(other => Math.hypot(x - other.x, y - other.y) < 26)) continue;
    const cells = new Set();
    for (const index of choice.cells) for (let offset = -1; offset <= 1; offset++) {
      const next = index + offset * (choice.acrossX ? size : 1);
      if (water[next] === 1) { terrain[next] = 10; cells.add(next); }
    }
    fords.push({ x, y, cells: [...cells] });
  }
  const riverBasins = new Map();
  const riverMouths = [];
  if (riverData) for (const channel of riverData.channels) {
    if (!riverBasins.has(channel.basin)) riverBasins.set(channel.basin, new Set());
    let previousWater = 0;
    for (const point of channel.points) {
      const index = Math.floor(point.y) * size + Math.floor(point.x);
      if (water[index] === 3 && previousWater === 1) riverMouths.push({ x: point.x, y: point.y, flow: point.flow, surface: point.surface });
      previousWater = water[index];
      if (water[index] === 1) riverBasins.get(channel.basin).add(index);
    }
  }
  const result = { size, seed, ...(version >= 29 ? { generationVersion: version } : {}), height: heightField, surface: drainage.level, downstream: drainage.parent, flow: drainage.flow,
    sediment: drainage.sediment, ...(version >= 32 ? { ground, waterSurface, basement: continent.basement, bedrock: continent.bedrock } : {}), water, river, lake, slope, fertility, gravel, sand, rock, wetness, waterDistance,
    fords, lakeCount, waterBudget: naturalLandscape ? water.filter(Boolean).length : oldWater, riverThreshold: threshold,
    ...(version >= 23 ? { island: !continent, uplifts, rainfall } : {}),
    ...(continent ? { continent: { direction: continent.direction, erosionPasses: continent.erosionPasses, ...(naturalLandscape ? { natural: true } : {}) }, uplift: continent.uplift, seaLevel, riverMouths } : {}),
    ...(coast ? { coastProfiles: coast.profiles } : {}),
    ...(riverData ? { channels: riverData.channels,
      headwaters: riverData.heads.filter(index => water[index] === 1), confluences: riverData.junctions.filter(index => water[index] === 1),
      riverBasins: [...riverBasins].filter(([, cells]) => cells.size >= 16).map(([outlet, cells]) => ({outlet, cells: cells.size})) } : {}) };
  if (capturePlacementMaps) {
    initializePlacementMaps(result, true); result.placementMaps.push(...(continent?.placementMaps || []), ...capture.placementMaps);
    const fordScores = new Float32Array(length).fill(NaN);
    for (const choice of fordChoices) fordScores[choice.index] = choice.priority;
    recordPlacementMap(result, "hydrology:ford-candidates", ["water"], fordScores, { water: "ford" });
    for (const [id, values, layers, details] of [
      ["hydrology:ground", ground, ["mountains", "water", "forest", "swamp"], {}],
      ["hydrology:surface", drainage.level, ["water"], {}],
      ["hydrology:pond-depth", Float32Array.from(height, (value, index) => drainage.level[index] - value), ["water", "swamp"], { minimum: 0 }],
      ["hydrology:sea-depth", Float32Array.from(height, value => seaLevel - value), ["water"], {}],
      ["hydrology:rainfall", rainfall, ["water", "forest", "swamp", "resources"], { minimum: 0 }],
      ["hydrology:flow", drainage.flow, ["water", "resources"], { minimum: 0, logarithmic: true }],
      ["hydrology:sediment", drainage.sediment, ["water", "resources"], { minimum: 0, logarithmic: true }],
      ["hydrology:slope", slope, ["mountains", "water", "forest", "swamp"], { minimum: 0 }],
      ["hydrology:wetness", wetness, ["water", "forest", "swamp", "resources"], { minimum: 0, maximum: 1 }],
      ["hydrology:fertility", fertility, ["resources"], { minimum: 0 }],
      ["hydrology:gravel", gravel, ["water", "resources"], { minimum: 0, resource: "pebbles" }],
      ["hydrology:sand", sand, ["water", "resources"], { minimum: 0, resource: "sand" }],
      ["hydrology:water", water, ["water"], { categorical: true }],
      ["hydrology:river", river, ["water"], { minimum: 0, maximum: 1, water: "river" }],
      ["hydrology:lake", lake, ["water"], { minimum: 0, maximum: 1, water: "lake" }],
      ["hydrology:ford", Uint8Array.from(terrain, type => type === 10 ? 1 : 0), ["water"], { minimum: 0, maximum: 1, water: "ford" }]
    ]) recordPlacementMap(result, id, layers, values, details);
  }
  if (version >= 32 && capturePlacementMaps) {
    recordPlacementMap(result, "hydrology:shore", ["water"], Uint8Array.from(terrain, type => type === 2 ? 1 : 0), { minimum: 0, maximum: 1, stage: "final" });
    recordPlacementMap(result, "terrain:mountains", ["mountains"], Uint8Array.from(terrain, type => type >= 6 && type <= 8 ? type - 5 : 0), { minimum: 0, maximum: 3, stage: "final" });
  }
  return result;
}

export function hydrologyResourceSuitability(key, index, terrain, fields) {
  const type = terrain[index], x = index % fields.size, y = Math.floor(index / fields.size);
  const h = fields.hydrology || fields;
  if (h.resourceHabitats) return resourceHabitatSuitability(key, index, terrain, h);
  if (type < 2 || type === 10) return 0;
  if (key === "honey-mushrooms") return type === 5 ? 1 : 0;
  if (key === "tree") return type === 5 ? .15 + h.wetness[index] : 0;
  if (key === "dew") return type === 4 && (h.wetness[index] > .12 || h.fertility[index] > .08) ? .1 + h.wetness[index] : 0;
  if (key === "clay") return [3, 4, 5, 9].includes(type) && h.fertility[index] > .08 ? h.fertility[index] : 0;
  if (key === "pebbles") return [2, 3, 4, 6].includes(type) ? h.gravel[index] + (type === 6 ? h.rock[index] * .5 : 0) : 0;
  if (key === "sand") return type === 2 ? h.sand[index] : 0;
  if (key === "grass-fiber") return [4, 5].includes(type) ? .05 + h.wetness[index] * .7 : 0;
  if (["iron-ore", "copper-ore", "quartz"].includes(key)) {
    if (type !== 6) return 0;
    const vein = noise(x, y, key === "quartz" ? 11 : 19, fields.seed + (key === "iron-ore" ? 1901 : key === "copper-ore" ? 1907 : 1913));
    return vein > -.15 ? h.rock[index] * (vein + .2) : 0;
  }
  return 0;
}

function allocateAmounts(points, budget) {
  if (!points.length && budget) throw new Error("자원 총량을 보존할 서식지가 부족합니다.");
  if (points.length > budget) throw new Error("자원량보다 자원 지점이 많습니다.");
  const weight = points.reduce((sum, point) => sum + point[2], 0);
  let total = 0;
  const fractions = [];
  for (const point of points) {
    const expected = weight ? budget * point[2] / weight : 0;
    point[2] = Math.max(1, Math.floor(expected)); total += point[2];
    fractions.push({ point, fraction: expected % 1 });
  }
  fractions.sort((left, right) => right.fraction - left.fraction || left.point[1] - right.point[1] || left.point[0] - right.point[0]);
  for (let cursor = 0; total < budget; cursor++, total++) fractions[cursor % fractions.length].point[2]++;
  for (let cursor = fractions.length - 1; total > budget; cursor = cursor ? cursor - 1 : fractions.length - 1) {
    if (fractions[cursor].point[2] <= 1) continue;
    fractions[cursor].point[2]--; total--;
  }
}

export function populateWatershedResources(world, baseline, paths) {
  const size = world.size, h = world.hydrology, budgets = new Map(), blocked = new Set(), occupied = new Set();
  for (const point of [...baseline.food, ...baseline.resources]) budgets.set(point[3], (budgets.get(point[3]) || 0) + point[2]);
  for (const camp of world.camps) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) blocked.add((camp.y + dy) * size + camp.x + dx);
  for (const burrow of world.burrows) for (let dy = -1; dy <= burrow.height; dy++) for (let dx = -1; dx <= burrow.width; dx++) blocked.add((burrow.y + dy) * size + burrow.x + dx);
  for (const encounter of world.encounters) for (const index of encounter.spawnPoints || []) blocked.add(index);
  const primary = ["clay", "tree", "pebbles", "dew"], travel = world.camps.map(camp => startingTravel(world, camp));
  const points = new Map(), retained = new Set();
  for (const [order, camp] of world.camps.entries()) {
    const key = primary[order], local = world.resources.filter(point => point[3] === key && travel[order][point[1] * size + point[0]] >= 0 &&
      !blocked.has(point[1] * size + point[0]) && !occupied.has(point[1] * size + point[0]) && !world.hazards[point[1] * size + point[0]] &&
      travel[order][point[1] * size + point[0]] <= 36 && hydrologyResourceSuitability(key, point[1] * size + point[0], world.terrain, world) > 0);
    if (h.resourceHabitats) {
      local.sort((left, right) => travel[order][left[1] * size + left[0]] - travel[order][right[1] * size + right[0]] || left[1] - right[1] || left[0] - right[0]);
      local.splice(16);
    }
    const near = [];
    for (let index = 0; index < world.terrain.length; index++) {
      if (travel[order][index] < 0 || travel[order][index] > 36 || blocked.has(index) || occupied.has(index) || world.hazards[index] ||
          !hydrologyResourceSuitability(key, index, world.terrain, world)) continue;
      near.push(index);
    }
    near.sort((left, right) => travel[order][left] - travel[order][right] || left - right);
    const existing = new Set(local.map(point => point[1] * size + point[0]));
    for (const index of near) {
      if (local.length >= 16) break;
      if (existing.has(index)) continue;
      local.push([index % size, Math.floor(index / size), key === "tree" ? 30 : key === "dew" ? 1 : 12, key]); existing.add(index);
    }
    for (const point of local) {
      const index = point[1] * size + point[0];
      if (blocked.has(index) || occupied.has(index) || world.hazards[index]) continue;
      if (!points.has(key)) points.set(key, []);
      points.get(key).push(point); occupied.add(index); retained.add(point);
    }
  }
  const hotspots = [];
  if (!h.resourceHabitats) for (let index = 0; index < world.terrain.length; index++) {
    if (h.water[index] || h.waterDistance[index] > 9 || h.slope[index] > .035 || h.fertility[index] < .1) continue;
    const x = index % size, y = Math.floor(index / size);
    if (world.camps.some(camp => Math.hypot(x - camp.x, y - camp.y) < 28)) continue;
    const approaches = paths.map(path => path[index]).filter(distance => distance >= 0).sort((left, right) => left - right);
    if (approaches.length < 2) continue;
    const shared = Math.exp(-approaches[1] / 180) * (.25 + .75 * approaches[0] / Math.max(1, approaches[1]));
    hotspots.push({ x, y, index, priority: h.fertility[index] * (1 + Math.log1p(h.flow[index]) * .1) * shared });
  }
  hotspots.sort((left, right) => right.priority - left.priority || left.index - right.index);
  const sites = [];
  for (const point of hotspots) {
    if (sites.some(other => Math.hypot(point.x - other.x, point.y - other.y) < 48)) continue;
    sites.push(point);
    if (sites.length >= 7) break;
  }
  const cluster = index => {
    const x = index % size, y = Math.floor(index / size);
    let value = .025;
    for (const site of sites) value = Math.max(value, Math.exp(-((x - site.x) ** 2 + (y - site.y) ** 2) / 290));
    return value;
  };
  const nodeAmounts = { tree: 120, dew: 12, clay: 60, pebbles: 55, sand: 150, "grass-fiber": 150, "iron-ore": 150, "copper-ore": 150, quartz: 150, "honey-mushrooms": 15 };
  for (const [key, budget] of budgets) {
    const selected = points.get(key) || [], candidates = [];
    const patchSeed = world.seed + 2111 + [...budgets.keys()].indexOf(key) * 37;
    const initialCount = selected.length;
    for (let index = 0; index < world.terrain.length; index++) {
      if (blocked.has(index) || occupied.has(index) || world.hazards[index]) continue;
      const suitability = hydrologyResourceSuitability(key, index, world.terrain, world);
      if (!suitability) continue;
      const x = index % size, y = Math.floor(index / size);
      if (["iron-ore", "copper-ore", "quartz"].includes(key) && world.camps.some(camp => Math.hypot(x - camp.x, y - camp.y) < (key === "quartz" ? 56 : 48))) continue;
      const patch = h.resourceHabitats ? .2 + Math.max(0, noise(x, y, 14, patchSeed)) ** 2 * 3 :
        .15 + Math.max(0, noise(x, y, 12, world.seed + 1931));
      const attraction = h.resourceHabitats || ["iron-ore", "copper-ore", "quartz"].includes(key) ? 1 : cluster(index);
      candidates.push({ index, priority: suitability * patch * attraction });
    }
    candidates.sort((left, right) => right.priority - left.priority || left.index - right.index);
    const count = Math.min(budget, Math.max(initialCount, Math.ceil(budget / (nodeAmounts[key] || 100))));
    for (const candidate of candidates) {
      if (selected.length >= count) break;
      const index = candidate.index;
      selected.push([index % size, Math.floor(index / size), nodeAmounts[key] || 100, key]); occupied.add(index);
    }
    const protectedAmount = selected.filter(point => retained.has(point)).reduce((sum, point) => sum + point[2], 0);
    const outer = selected.filter(point => !retained.has(point));
    if (protectedAmount + outer.length <= budget && outer.length) allocateAmounts(outer, budget - protectedAmount);
    else allocateAmounts(selected, budget);
    points.set(key, selected);
  }
  for (const [order, key] of primary.entries()) {
    const entries = points.get(key) || [], near = [], remote = [];
    const weight = point => Math.exp(-travel[order][point[1] * size + point[0]] / 18);
    for (const point of entries) (travel[order][point[1] * size + point[0]] >= 0 ? near : remote).push(point);
    const target = baseline.economy.starts[order].weightedAmount;
    let current = near.reduce((sum, point) => sum + point[2] * weight(point), 0);
    let cursor = 0, remoteCursor = 0, idle = 0;
    while (near.length && remote.length && Math.abs(current - target) > 1 && idle < near.length) {
      const point = near[cursor++ % near.length], amount = weight(point);
      if (current < target) {
        let donor = null;
        for (let attempt = 0; attempt < remote.length; attempt++) {
          const candidate = remote[remoteCursor++ % remote.length];
          if (candidate[2] > 1) { donor = candidate; break; }
        }
        if (!donor) break;
        donor[2]--; point[2]++; current += amount; idle = 0;
      } else if (point[2] > 1) {
        point[2]--; remote[remoteCursor++ % remote.length][2]++; current -= amount; idle = 0;
      } else idle++;
    }
  }
  world.food = points.get("honey-mushrooms") || [];
  world.resources = [...points].filter(([key]) => key !== "honey-mushrooms").flatMap(([, entries]) => entries);
  world.resourceHotspots = sites.map(({ x, y }) => ({ x, y }));
  world.economy.starts = measureStartingEconomy(world, ["clay", "tree", "pebbles", "dew"].map((key, index) => ({ key, tribe: world.camps[index].tribe === "sprout" ? "bean" : world.camps[index].tribe })));
  for (const policy of world.economy.resources) {
    const entries = points.get(policy.key) || [];
    policy.cells = entries.length; policy.coverage = entries.length / world.terrain.length;
    policy.amount = entries.reduce((sum, point) => sum + point[2], 0);
    policy.sectors = new Set(entries.map(point => Math.floor(point[0] / 32) + "," + Math.floor(point[1] / 32))).size;
  }
}
