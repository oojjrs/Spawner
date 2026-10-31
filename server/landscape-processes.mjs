import { initializePlacementMaps, recordPlacementMap, placementNoise } from "./placement-maps.mjs";

export function quantizeLandscapeValue(value) { return Math.round(value * 1000000) / 1000000; }

export function landscapeHash(x, y, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function latticeNoise(x, y, scale, seed) {
  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = (fx - ix) ** 2 * (3 - 2 * (fx - ix)), ty = (fy - iy) ** 2 * (3 - 2 * (fy - iy));
  return ((landscapeHash(ix, iy, seed) * (1 - tx) + landscapeHash(ix + 1, iy, seed) * tx) * (1 - ty) +
    (landscapeHash(ix, iy + 1, seed) * (1 - tx) + landscapeHash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;
}

export function landscapeNoise(x, y, scale, seed) {
  return latticeNoise(x, y, scale, seed) * .5 + latticeNoise(x, y, scale * .43, seed + 997) * .27 +
    latticeNoise(x, y, scale * .18, seed + 1999) * .16 + latticeNoise(x, y, scale * .075, seed + 2999) * .07;
}

export function createContinentalFoundation(size, seed, enabled) {
  const result = { basement: new Float32Array(size * size), bedrock: new Float32Array(size * size) }; initializePlacementMaps(result, enabled);
  const roughness = placementNoise(result, "terrain:roughness", ["mountains", "water", "forest", "swamp", "resources"],
    (x, y) => landscapeNoise(x, y, size * .4, seed + 4001), { stage: "original" });
  const geology = placementNoise(result, "geology:bedrock-noise", ["mountains", "water", "forest", "swamp", "resources"],
    (x, y) => landscapeNoise(x, y, 95, seed + 17011), { stage: "original" });
  const direction = landscapeHash(0, 0, seed + 2707) * Math.PI * 2, cosine = Math.cos(direction), sine = Math.sin(direction);
  const center = { x: size * (.46 + landscapeHash(0, 0, seed + 4013) * .08), y: size * (.46 + landscapeHash(0, 0, seed + 4019) * .08) };
  const blocks = [{ x: center.x, y: center.y, along: size * .37, across: size * .30, angle: direction, height: .55 }];
  for (let order = 0; order < 3; order++) {
    const along = (order - 1) * size * (.17 + landscapeHash(order, 0, seed + 4021) * .05);
    const across = (landscapeHash(order, 0, seed + 4027) - .5) * size * .3;
    blocks.push({ x: center.x + cosine * along - sine * across, y: center.y + sine * along + cosine * across,
      along: size * (.18 + landscapeHash(order, 0, seed + 4049) * .12), across: size * (.16 + landscapeHash(order, 0, seed + 4051) * .12),
      angle: direction + (landscapeHash(order, 0, seed + 4057) - .5) * 1.8, height: .29 + landscapeHash(order, 0, seed + 4073) * .08 });
  }
  const depressions = Array.from({ length: 3 }, (_, order) => ({ x: size * (.2 + landscapeHash(order, 0, seed + 4079) * .6),
    y: size * (.2 + landscapeHash(order, 0, seed + 4091) * .6), radius: 12 + landscapeHash(order, 0, seed + 4093) * 20,
    depth: .045 + landscapeHash(order, 0, seed + 4099) * .075 }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let base = 0, secondary = 0;
    for (const [order, block] of blocks.entries()) {
      const dx = x - block.x, dy = y - block.y, a = dx * Math.cos(block.angle) + dy * Math.sin(block.angle), b = -dx * Math.sin(block.angle) + dy * Math.cos(block.angle);
      const elevation = block.height * Math.exp(-(a * a / (block.along * block.along) + b * b / (block.across * block.across)) * .9);
      if (!order) base = elevation; else secondary = Math.max(secondary, elevation);
    }
    let depression = 0;
    for (const basin of depressions) depression += basin.depth * Math.exp(-((x - basin.x) ** 2 + (y - basin.y) ** 2) / (basin.radius * basin.radius));
    const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
    result.bedrock[y * size + x] = .5 + geology(x, y) * .5;
    result.basement[y * size + x] = quantizeLandscapeValue(-.20 + base + secondary * .8 + roughness(x, y) * .09 - depression - 1.4 * Math.exp(-edge / 8));
  }
  result.roughness = roughness; result.direction = direction; result.seaLevel = .07;
  recordPlacementMap(result, "terrain:basement", ["mountains", "water"], result.basement, { stage: "intermediate" });
  return result;
}

export function createTerrainRainfall(height, size, seaLevel, angle) {
  const rainfall = new Float64Array(height.length), humidity = new Float32Array(height.length);
  const sx = Math.cos(angle) >= 0 ? 1 : -1, sy = Math.sin(angle) >= 0 ? 1 : -1;
  const weightX = Math.abs(Math.cos(angle)) / (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)));
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    const x = sx > 0 ? column : size - 1 - column, y = sy > 0 ? row : size - 1 - row, index = y * size + x;
    if (height[index] <= seaLevel) { humidity[index] = 1; rainfall[index] = .7; continue; }
    const previousX = column ? index - sx : -1, previousY = row ? index - sy * size : -1;
    const incoming = (previousX >= 0 ? humidity[previousX] : 1) * weightX + (previousY >= 0 ? humidity[previousY] : 1) * (1 - weightX);
    const previousHeight = (previousX >= 0 ? height[previousX] : seaLevel) * weightX + (previousY >= 0 ? height[previousY] : seaLevel) * (1 - weightX);
    const rise = height[index] - previousHeight;
    rainfall[index] = quantizeLandscapeValue(Math.max(.2, Math.min(1.7, .4 + incoming * .48 + Math.max(0, rise) * 5 + Math.min(0, rise) * 1.1)));
    humidity[index] = quantizeLandscapeValue(Math.max(.08, incoming - Math.max(0, rise) * .7 - .0015));
  }
  return { rainfall, humidity };
}

export function createHillslopeFlow(height, rainfall, size, seaLevel, water) {
  const flow = new Float64Array(rainfall);
  const order = Array.from({ length: flow.length }, (_, index) => index).sort((left, right) => height[right] - height[left] || left - right);
  const receivers = new Int32Array(8), weights = new Float64Array(8);
  for (const index of order) {
    if (height[index] <= seaLevel || water?.[index]) continue;
    const x = index % size, y = Math.floor(index / size);
    let count = 0, total = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;
      const next = (y + dy) * size + x + dx, drop = height[index] - height[next];
      if (drop <= 0) continue;
      const weight = Math.pow(drop / Math.hypot(dx, dy), 1.1);
      receivers[count] = next; weights[count++] = weight; total += weight;
    }
    for (let receiver = 0; receiver < count; receiver++) flow[receivers[receiver]] += flow[index] * weights[receiver] / total;
  }
  return flow;
}

export function erodeLandscapeHeight(height, rainfall, size, foundation) {
  const flow = createHillslopeFlow(height, rainfall, size, foundation.seaLevel, undefined), result = new Float64Array(height);
  for (let index = 0; index < height.length; index++) {
    if (height[index] <= foundation.seaLevel) continue;
    const x = index % size, y = Math.floor(index / size), raised = height[index] + foundation.uplift[index] * .0008;
    let total = 0, base = 0, distanceSum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;
      const next = (y + dy) * size + x + dx, drop = height[index] - height[next];
      if (drop <= 0) continue;
      const distance = Math.hypot(dx, dy), weight = Math.pow(drop / distance, 1.1);
      total += weight; base += Math.max(foundation.seaLevel, height[next]) * weight; distanceSum += distance * weight;
    }
    const incision = total ? .02 * Math.sqrt(flow[index]) / (distanceSum / total) * (1.35 - foundation.bedrock[index] * .7) : 0;
    result[index] = quantizeLandscapeValue((raised + incision * (total ? base / total : raised)) / (1 + incision));
  }
  return result;
}
