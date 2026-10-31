import { createContinentalFoundation, quantizeLandscapeValue } from "./landscape-processes.mjs";
import { initializePlacementMaps, recordPlacementMap, placementNoise } from "./placement-maps.mjs";

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

function ridge(points, width, height, type) { return { points, width, height, type }; }

function distanceToRidge(point, feature) {
  let nearest = Infinity;
  for (let index = 1; index < feature.points.length; index++) {
    const a = feature.points[index - 1], b = feature.points[index], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    nearest = Math.min(nearest, Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t));
  }
  return nearest;
}

function mountainSystems(size, seed, direction, capture, foundation) {
  const systems = [], features = [], count = 3 + Math.floor(hash(0, 0, seed + 3109) * 2);
  const onLand = point => foundation ? point.x >= 8 && point.y >= 8 && point.x < size - 8 && point.y < size - 8 &&
    foundation.basement[Math.floor(point.y) * size + Math.floor(point.x)] > foundation.seaLevel + .025 : .2 + ((point.x / size - .5) * Math.cos(direction) + (point.y / size - .5) * Math.sin(direction)) * .45 +
    noise(point.x, point.y, 113, seed + 2939) * .08 + noise(point.x, point.y, 39, seed + 2953) * .025 > .15;
  if (!foundation) recordPlacementMap(capture, "relief:range-eligibility", ["mountains"], null,
    { sample: (x, y) => onLand({ x, y }) ? 1 : 0, minimum: 0, maximum: 1 });
  for (let order = 0; order < count; order++) {
    const width = order === 0 ? 6 + hash(order, 0, seed + 3119) * 5 : 3.5 + hash(order, 0, seed + 3121) * 4;
    const amplitude = order === 0 ? .65 + hash(order, 0, seed + 3137) * .3 : .36 + hash(order, 0, seed + 3163) * .32;
    const desired = size * (order === 0 ? .43 + hash(order, 0, seed + 3167) * .2 : .2 + hash(order, 0, seed + 3169) * .2);
    let chosen = null, best = -Infinity;
    for (let attempt = 0; attempt < 96; attempt++) {
      const center = { x: size * (.1 + hash(order, attempt, seed + 3181) * .8), y: size * (.1 + hash(order, attempt, seed + 3187) * .8) };
      if (!onLand(center)) continue;
      const angle = direction + (hash(order, attempt, seed + 3191) - .5) * 2.8, span = desired * (1 - attempt * .003);
      const points = [];
      for (let step = 0; step <= 8; step++) {
        const along = (step / 8 - .5) * span, bend = noise(step * 19, order * 67 + attempt * 13, 35, seed + 3203) * size * .075;
        points.push({ x: center.x + Math.cos(angle) * along - Math.sin(angle) * bend,
          y: center.y + Math.sin(angle) * along + Math.cos(angle) * bend });
      }
      let separation = Infinity;
      for (const other of systems) for (const point of points) separation = Math.min(separation, distanceToRidge(point, other) - width - other.width - 15);
      if (separation > best) { chosen = ridge(points, width, amplitude, "range"); chosen.system = order; best = separation; }
      if (separation >= 0) break;
    }
    if (chosen) { systems.push(chosen); features.push(chosen); }
  }
  for (const [order, system] of systems.entries()) {
    const a = system.points[2], b = system.points[6], angle = Math.atan2(b.y - a.y, b.x - a.x);
    const count = 2 + Math.floor(hash(order, 0, seed + 3209) * 2);
    for (let branch = 0; branch < count; branch++) {
      const origin = system.points[2 + Math.floor(hash(order, branch, seed + 3217) * 4)], side = branch % 2 ? -1 : 1;
      const bearing = angle + side * (.65 + hash(order, branch, seed + 3221) * .7);
      const width = system.width * (.3 + hash(order, branch, seed + 3229) * .25);
      let reach = 15 + hash(order, branch, seed + 3251) * 35;
      for (let attempt = 0; attempt < 5; attempt++) {
        const points = [origin];
        for (let step = 1; step <= 3; step++) points.push({ x: origin.x + Math.cos(bearing + step * .13 * side) * reach * step / 3,
          y: origin.y + Math.sin(bearing + step * .13 * side) * reach * step / 3 });
        const clear = systems.every(other => other === system || points.every(point => distanceToRidge(point, other) > width + other.width + 12));
        if (clear) {
          const feature = ridge(points, width, system.height * (.32 + hash(order, branch, seed + 3253) * .25), "branch");
          feature.system = system.system; features.push(feature); break;
        }
        reach *= .6;
      }
    }
  }
  for (let order = 0; order < 5; order++) for (let attempt = 0; attempt < 48; attempt++) {
    const center = { x: size * (.08 + hash(order, attempt, seed + 3257) * .84), y: size * (.08 + hash(order, attempt, seed + 3259) * .84) };
    if (!onLand(center) || features.some(other => distanceToRidge(center, other) < other.width + 22)) continue;
    const angle = hash(order, attempt, seed + 3271) * Math.PI * 2, span = 18 + hash(order, attempt, seed + 3299) * 30;
    const points = [{x: center.x - Math.cos(angle) * span / 2, y: center.y - Math.sin(angle) * span / 2}, center,
      {x: center.x + Math.cos(angle + .4) * span / 2, y: center.y + Math.sin(angle + .4) * span / 2}];
    features.push(ridge(points, 3 + hash(order, attempt, seed + 3301) * 3, .21 + hash(order, attempt, seed + 3307) * .18, "massif")); break;
  }
  return features;
}

export function createContinentalRelief(size, seed, version, capturePlacementMaps) {
  if (version >= 32) return createSharedRelief(size, seed, capturePlacementMaps);
  const capture = {}; initializePlacementMaps(capture, capturePlacementMaps);
  const sources = {
    warpX: placementNoise(capture, "relief:warpX", ["mountains", "water"], (x, y) => noise(x, y, 27, seed + 2909)),
    warpY: placementNoise(capture, "relief:warpY", ["mountains", "water"], (x, y) => noise(x, y, 27, seed + 2917)),
    width: placementNoise(capture, "relief:width", ["mountains", "water"], (x, y) => noise(x, y, 18, seed + 2927)),
    broad: placementNoise(capture, "relief:broad", ["mountains", "water"], (x, y) => noise(x, y, 113, seed + 2939)),
    detail: placementNoise(capture, "relief:detail", ["mountains", "water"], (x, y) => noise(x, y, 39, seed + 2953)),
    regional: placementNoise(capture, "relief:regional", ["mountains", "water"], (x, y) => noise(x, y, 67, seed + 3343)),
    coastBroad: placementNoise(capture, "relief:coastBroad", ["mountains", "water"], (x, y) => noise(x, y, 61, seed + 3323)),
    coastDetail: placementNoise(capture, "relief:coastDetail", ["mountains", "water"], (x, y) => noise(x, y, 23, seed + 3329)),
    surface: placementNoise(capture, "relief:surface", ["mountains", "water"], (x, y) => noise(x, y, 7, seed + 2957)),
  };
  const length = size * size, height = new Float64Array(length), basement = new Float32Array(length);
  const coastShelf = capturePlacementMaps ? new Float32Array(length) : null;
  const uplift = new Float32Array(length), offsetX = new Float32Array(length), offsetY = new Float32Array(length);
  const direction = hash(0, 0, seed + 2707) * Math.PI * 2, ranges = version >= 27 ? mountainSystems(size, seed, direction, capture) : [];
  const mainCount = 2 + Math.floor(hash(0, 0, seed + 2711) * 2);
  if (!(version >= 27)) for (let order = 0; order < mainCount; order++) {
    const angle = direction + (hash(order, 0, seed + 2713) - .5) * 2;
    const centerX = size * (.16 + hash(order, 0, seed + 2719) * .68), centerY = size * (.16 + hash(order, 0, seed + 2729) * .68);
    const span = size * (.45 + hash(order, 0, seed + 2731) * .5), points = [];
    const width = 5 + hash(order, 0, seed + 2741) * 11, amplitude = .45 + hash(order, 0, seed + 2749) * .5;
    for (let step = 0; step <= 8; step++) {
      const along = (step / 8 - .5) * span, bend = noise(step * 19, order * 67, 35, seed + 2753) * size * .12;
      points.push({ x: centerX + Math.cos(angle) * along - Math.sin(angle) * bend,
        y: centerY + Math.sin(angle) * along + Math.cos(angle) * bend });
    }
    ranges.push(ridge(points, width, amplitude, "range"));
    const branches = 2 + Math.floor(hash(order, 0, seed + 2767) * 4);
    for (let branch = 0; branch < branches; branch++) {
      const origin = points[1 + Math.floor(hash(order, branch, seed + 2777) * 6)], side = branch % 2 ? -1 : 1;
      const bearing = angle + side * (.55 + hash(order, branch, seed + 2789) * .7), reach = 20 + hash(order, branch, seed + 2791) * 70;
      const branchPoints = [origin];
      for (let step = 1; step <= 3; step++) branchPoints.push({ x: origin.x + Math.cos(bearing + step * .12 * side) * reach * step / 3,
        y: origin.y + Math.sin(bearing + step * .12 * side) * reach * step / 3 });
      ranges.push(ridge(branchPoints, width * (.25 + hash(order, branch, seed + 2797) * .45), amplitude * (.3 + hash(order, branch, seed + 2801) * .35), "branch"));
    }
  }
  const hillCount = (version >= 27 ? 18 : 12) + Math.floor(hash(0, 0, seed + 2803) * 17);
  for (let order = 0; order < hillCount; order++) {
    const x = hash(order, 0, seed + 2819) * size, y = hash(order, 0, seed + 2833) * size;
    const angle = hash(order, 0, seed + 2837) * Math.PI * 2, reach = 3 + hash(order, 0, seed + 2843) * 15;
    ranges.push(ridge([{ x, y }, { x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach }],
      2 + hash(order, 0, seed + 2851) * 6, (version >= 27 ? .11 : .07) + hash(order, 0, seed + 2857) * .17, "hill"));
  }
  const basins = Array.from({ length: 2 + Math.floor(hash(0, 0, seed + 2861) * 3) }, (_, order) => ({
    x: size * (.1 + hash(order, 0, seed + 2879) * .8), y: size * (.1 + hash(order, 0, seed + 2887) * .8),
    radius: 11 + hash(order, 0, seed + 2897) * 22, depth: .04 + hash(order, 0, seed + 2903) * .09 }));
  const segments = [];
  for (const range of ranges) for (let order = 1; order < range.points.length; order++) {
    const a = range.points[order - 1], b = range.points[order], dx = b.x - a.x, dy = b.y - a.y;
    segments.push({ a, dx, dy, lengthSquared: dx * dx + dy * dy, width: range.width, height: range.height,
      taperStart: (order - 1) / (range.points.length - 1), taperEnd: order / (range.points.length - 1) });
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x, wx = x + sources.warpX(x, y) * 4, wy = y + sources.warpY(x, y) * 4;
    let relief = 0, depression = 0;
    for (const segment of segments) {
      const t = Math.max(0, Math.min(1, ((wx - segment.a.x) * segment.dx + (wy - segment.a.y) * segment.dy) / segment.lengthSquared));
      const distance = Math.hypot(wx - segment.a.x - segment.dx * t, wy - segment.a.y - segment.dy * t);
      if (distance > segment.width * 3) continue;
      const along = segment.taperStart + (segment.taperEnd - segment.taperStart) * t;
      const taper = .25 + .75 * Math.sin(along * Math.PI) ** .6;
      const width = segment.width * (.7 + sources.width(wx, wy) * .3);
      const feature = segment.height * taper * Math.exp(-(distance * distance) / (width * width));
      relief = Math.max(relief, feature) + Math.min(relief, feature) * .08;
    }
    for (const basin of basins) depression += basin.depth * Math.exp(-((x - basin.x) ** 2 + (y - basin.y) ** 2) / (basin.radius * basin.radius));
    basement[index] = .2 + ((x / size - .5) * Math.cos(direction) + (y / size - .5) * Math.sin(direction)) * (version >= 30 ? .26 : .45) +
      sources.broad(x, y) * .08 + sources.detail(x, y) * .025 + (version >= 30 ? sources.regional(x, y) * .04 : 0) - depression;
    if (version >= 28) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
      const cx = size * (.48 + hash(0, 0, seed + 3313) * .04), cy = size * (.48 + hash(0, 0, seed + 3319) * .04);
      const radius = Math.hypot((x - cx) / (size * .53), (y - cy) / (size * .53));
      const coast = (1 + sources.coastBroad(x, y) * .14 + sources.coastDetail(x, y) * .045 - radius) * size * .5;
      const inland = Math.max(0, Math.min(1, coast / 24, (edge - 2) / 12));
      const shelf = inland * inland * (3 - 2 * inland);
      if (coastShelf) coastShelf[index] = shelf;
      basement[index] = -.2 + (basement[index] + .2) * shelf;
      relief *= shelf;
    }
    uplift[index] = relief;
    height[index] = basement[index] + relief + sources.surface(x, y) * .009;
    offsetX[index] = hash(x, y, seed + 2963) * .4 - .2;
    offsetY[index] = hash(x, y, seed + 2969) * .4 - .2;
  }
  const result = { height, basement, uplift, offsetX, offsetY, ranges, direction, erosionPasses: 18,
    natural: true, seaLevel: .065 + hash(0, 0, seed + 2971) * .025 };
  if (capture.placementMaps) {
    initializePlacementMaps(result, true); result.placementMaps.push(...capture.placementMaps);
    recordPlacementMap(result, "relief:coast-shelf", ["mountains", "water"], coastShelf, { minimum: 0, maximum: 1 });
    recordPlacementMap(result, "relief:basement", ["mountains", "water"], basement, {});
    recordPlacementMap(result, "relief:uplift", ["mountains", "water"], uplift, { minimum: 0 });
    recordPlacementMap(result, "relief:height", ["mountains", "water", "forest", "swamp"], height, {});
  }
  return result;
}

function createSharedRelief(size, seed, enabled) {
  const foundation = createContinentalFoundation(size, seed, enabled), { basement, direction, seaLevel, roughness } = foundation;
  const ranges = mountainSystems(size, seed, direction, foundation, foundation);
  const count = 18 + Math.floor(hash(0, 0, seed + 2803) * 17);
  for (let order = 0; order < count; order++) {
    const x = hash(order, 0, seed + 2819) * size, y = hash(order, 0, seed + 2833) * size;
    if (basement[Math.floor(y) * size + Math.floor(x)] < seaLevel - .08) continue;
    const angle = hash(order, 0, seed + 2837) * Math.PI * 2, reach = 3 + hash(order, 0, seed + 2843) * 15;
    ranges.push(ridge([{ x, y }, { x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach }],
      2 + hash(order, 0, seed + 2851) * 6, .11 + hash(order, 0, seed + 2857) * .17, "hill"));
  }
  const segments = [];
  for (const range of ranges) for (let order = 1; order < range.points.length; order++) {
    const a = range.points[order - 1], b = range.points[order], dx = b.x - a.x, dy = b.y - a.y;
    segments.push({ a, dx, dy, lengthSquared: dx * dx + dy * dy, width: range.width, height: range.height,
      start: (order - 1) / (range.points.length - 1), end: order / (range.points.length - 1) });
  }
  const height = new Float64Array(size * size), uplift = new Float32Array(height.length), offsetX = new Float32Array(height.length), offsetY = new Float32Array(height.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x, wx = x + roughness(x + 23, y - 17) * 3, wy = y + roughness(x - 11, y + 37) * 3;
    let relief = 0;
    for (const segment of segments) {
      const t = Math.max(0, Math.min(1, ((wx - segment.a.x) * segment.dx + (wy - segment.a.y) * segment.dy) / segment.lengthSquared));
      const distance = Math.hypot(wx - segment.a.x - segment.dx * t, wy - segment.a.y - segment.dy * t);
      if (distance > segment.width * 3) continue;
      const along = segment.start + (segment.end - segment.start) * t, width = segment.width * (.85 + roughness(x, y) * .2);
      const value = segment.height * (.25 + .75 * Math.sin(along * Math.PI) ** .6) * Math.exp(-distance * distance / (width * width));
      relief = Math.max(relief, value) + Math.min(relief, value) * .08;
    }
    uplift[index] = quantizeLandscapeValue(relief); height[index] = quantizeLandscapeValue(basement[index] + uplift[index]);
    offsetX[index] = hash(x, y, seed + 2963) * .4 - .2; offsetY[index] = hash(x, y, seed + 2969) * .4 - .2;
  }
  const result = { height, basement, bedrock: foundation.bedrock, uplift, offsetX, offsetY, ranges, direction, seaLevel, erosionPasses: 18, natural: true };
  if (enabled) {
    initializePlacementMaps(result, true); result.placementMaps.push(...foundation.placementMaps);
    recordPlacementMap(result, "relief:uplift", ["mountains", "water"], uplift, { minimum: 0, stage: "intermediate" });
    recordPlacementMap(result, "relief:height", ["mountains", "water", "forest", "swamp"], height, { stage: "intermediate" });
  }
  return result;
}
