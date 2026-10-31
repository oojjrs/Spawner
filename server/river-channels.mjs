import { recordPlacementMap } from "./placement-maps.mjs";

function spline(before, start, end, after, t) {
  const t2 = t * t, t3 = t2 * t;
  const coordinate = key => .5 * (2 * start[key] + (-before[key] + end[key]) * t +
    (2 * before[key] - 5 * start[key] + 4 * end[key] - after[key]) * t2 +
    (-before[key] + 3 * start[key] - 3 * end[key] + after[key]) * t3);
  return { x: coordinate("x"), y: coordinate("y") };
}

function curve(path, drainage, basin, size, seed) {
  const controls = [], last = path.length - 1, distance = new Float32Array(path.length);
  for (let step = 1; step < path.length; step++) distance[step] = distance[step - 1] +
    Math.hypot(path[step] % size - path[step - 1] % size, Math.floor(path[step] / size) - Math.floor(path[step - 1] / size));
  const phase = (Math.imul(path[0] ^ seed, 2654435761) >>> 0) / 4294967296 * Math.PI * 2;
  for (let step = 0; step <= last; step = Math.min(last, step + 5)) {
    const index = path[step], previous = path[Math.max(0, step - 3)], next = path[Math.min(last, step + 3)];
    const dx = next % size - previous % size, dy = Math.floor(next / size) - Math.floor(previous / size), reach = Math.hypot(dx, dy) || 1;
    const slope = Math.max(0, drainage.level[previous] - drainage.level[next]) / reach;
    const wavelength = 18 + Math.log1p(drainage.flow[index]) * 1.4;
    const amplitude = Math.min(5, 1.6 + Math.log1p(drainage.flow[index] / 80)) / (1 + slope * 65);
    const taper = Math.min(1, distance[step] / 8, (distance[last] - distance[step]) / 8);
    const sway = (Math.sin(distance[step] * Math.PI * 2 / wavelength + phase) * .7 +
      Math.sin(distance[step] * Math.PI * 2 / (wavelength * 1.83) + phase * 1.37) * .3) * amplitude * taper;
    const origin = { x: index % size + .5, y: Math.floor(index / size) + .5 };
    let offset = sway, point;
    for (let attempt = 0; attempt < 7; attempt++) {
      point = { x: origin.x - dy / reach * offset, y: origin.y + dx / reach * offset, step };
      const cell = Math.floor(point.y) * size + Math.floor(point.x);
      if (point.x >= .5 && point.y >= .5 && point.x <= size - .5 && point.y <= size - .5 &&
          basin[cell] === basin[index] && drainage.level[cell] <= drainage.level[index] + .035) break;
      offset *= .5;
    }
    controls.push(point);
    if (step === last) break;
  }
  const points = [];
  for (let segment = 0; segment < controls.length - 1; segment++) {
    const before = controls[Math.max(0, segment - 1)], start = controls[segment], end = controls[segment + 1];
    let downstream = drainage.parent[path[last]];
    for (let step = 0; step < 2 && downstream >= 0 && drainage.parent[downstream] >= 0; step++) downstream = drainage.parent[downstream];
    const tail = downstream >= 0 ? {x: downstream % size + .5, y: Math.floor(downstream / size) + .5} : end;
    const after = segment + 2 < controls.length ? controls[segment + 2] : tail;
    const samples = Math.max(2, Math.ceil(Math.max(Math.hypot(end.x - start.x, end.y - start.y), distance[end.step] - distance[start.step]) * 4));
    for (let sample = segment ? 1 : 0; sample <= samples; sample++) {
      const t = sample / samples, step = start.step + (end.step - start.step) * t, first = Math.floor(step), fraction = step - first;
      const a = path[first], b = path[Math.min(last, first + 1)];
      const origin = { x: (a % size) * (1 - fraction) + (b % size) * fraction + .5,
        y: Math.floor(a / size) * (1 - fraction) + Math.floor(b / size) * fraction + .5 };
      const surface = drainage.level[a] * (1 - fraction) + drainage.level[b] * fraction;
      let point = spline(before, start, end, after, t), blend = 1;
      for (let attempt = 0; attempt < 8; attempt++) {
        const index = Math.floor(point.y) * size + Math.floor(point.x);
        if (point.x >= .5 && point.y >= .5 && point.x <= size - .5 && point.y <= size - .5 &&
            basin[index] === basin[a] && drainage.level[index] <= surface + .04) break;
        blend *= .5;
        const proposed = spline(before, start, end, after, t);
        point = { x: origin.x + (proposed.x - origin.x) * blend, y: origin.y + (proposed.y - origin.y) * blend };
      }
      const current = { x: point.x, y: point.y, surface,
        flow: drainage.flow[a] * (1 - fraction) + drainage.flow[b] * fraction,
        sediment: drainage.sediment[a] * (1 - fraction) + drainage.sediment[b] * fraction, radius: 0 };
      const previous = points.at(-1);
      const intervals = previous ? Math.max(1, Math.ceil(Math.hypot(current.x - previous.x, current.y - previous.y) / .3)) : 1;
      for (let interval = 1; interval <= intervals; interval++) {
        const blend = interval / intervals;
        points.push(previous ? {x: previous.x + (current.x - previous.x) * blend, y: previous.y + (current.y - previous.y) * blend,
          surface: previous.surface + (current.surface - previous.surface) * blend, flow: previous.flow + (current.flow - previous.flow) * blend,
          sediment: previous.sediment + (current.sediment - previous.sediment) * blend, radius: 0} : current);
      }
    }
  }
  return points;
}

export function createRiverChannels(drainage, size, seed, waterBudget, terrainDriven, landscape) {
  const mature = terrainDriven >= 27;
  const sparse = terrainDriven >= 28;
  const mountainFed = terrainDriven >= 29;
  const coastalBasins = terrainDriven >= 30;
  const length = drainage.level.length, basin = new Int32Array(length), distance = new Float32Array(length), childFlow = new Float64Array(length);
  const sources = new Int32Array(length).fill(-1), sourceScore = new Float32Array(length).fill(-Infinity);
  if (mountainFed) for (let cursor = drainage.order.length - 1; cursor >= 0; cursor--) {
    const index = drainage.order[cursor], next = drainage.parent[index];
    const relief = Math.max(0, landscape.height[index] - landscape.basement[index]);
    if (drainage.flow[index] >= (terrainDriven >= 31 ? 8 : 24) && drainage.flow[index] <= 300 && relief >= .065 && drainage.level[index] > landscape.seaLevel + .04 &&
        drainage.level[index] - landscape.height[index] < .002) {
      const score = drainage.level[index] * .7 + Math.min(.4, relief) * .3;
      if (score > sourceScore[index]) { sources[index] = index; sourceScore[index] = score; }
    }
    if (next >= 0 && sourceScore[index] > sourceScore[next]) { sources[next] = sources[index]; sourceScore[next] = sourceScore[index]; }
  }
  for (const index of drainage.order) {
    const next = drainage.parent[index];
    if (coastalBasins && drainage.level[index] <= landscape.seaLevel) basin[index] = -1;
    else if (next < 0 || coastalBasins && drainage.level[next] <= landscape.seaLevel) basin[index] = index;
    else {
      basin[index] = basin[next];
      distance[index] = distance[next] + Math.hypot(index % size - next % size, Math.floor(index / size) - Math.floor(next / size));
    }
    if (next >= 0) childFlow[next] = Math.max(childFlow[next], drainage.flow[index]);
  }
  let roots = [...drainage.order].filter(index => (coastalBasins ? basin[index] === index && sources[index] >= 0 && distance[sources[index]] >= (terrainDriven >= 31 ? 18 : 28) : drainage.parent[index] < 0) && drainage.flow[index] >= (terrainDriven >= 31 ? 100 : coastalBasins ? 350 : sparse ? 3000 : mature ? 1800 : terrainDriven ? 500 : 180))
    .sort((left, right) => drainage.flow[right] - drainage.flow[left] || left - right)
    .slice(0, terrainDriven >= 31 ? length : terrainDriven ? 16 : Math.min(8, Math.max(2, Math.floor(waterBudget / 900))));
  if (coastalBasins) {
    const selected = [];
    for (const root of roots) {
      if (selected.some(other => Math.hypot(root % size - other % size, Math.floor(root / size) - Math.floor(other / size)) < (terrainDriven >= 31 ? 16 : 22))) continue;
      selected.push(root);
      if (selected.length >= 4) break;
    }
    roots = selected;
  }
  recordPlacementMap(landscape, "river:basins", ["water"], basin, { categorical: true, excluded: -1, water: "river",
    roots: roots.map(index => ({ index, source: sources[index], flow: drainage.flow[index], distance: distance[sources[index]] })) });
  recordPlacementMap(landscape, "river:source-score", ["water"], sourceScore, { water: "river" });
  const groups = new Map(roots.map(index => [index, []]));
  const threshold = sparse ? 900 : mature ? 450 : terrainDriven ? 110 : 45;
  const initiation = coastalBasins ? 160 : mountainFed ? 300 : threshold;
  for (const index of drainage.order) {
    if (!groups.has(basin[index]) || drainage.flow[index] < initiation || childFlow[index] >= initiation || distance[index] < (coastalBasins ? 0 : 28)) continue;
    const head = mountainFed ? sources[index] : index;
    if (head >= 0 && !groups.get(basin[index]).includes(head)) groups.get(basin[index]).push(head);
  }
  if (coastalBasins) for (const root of roots) if (!groups.get(root).includes(sources[root])) groups.get(root).unshift(sources[root]);
  const weights = roots.filter(index => !mountainFed || groups.get(index).length).reduce((sum, index) => sum + Math.sqrt(drainage.flow[index]), 0);
  let targetHeads = terrainDriven ? Math.min(mountainFed ? 8 : sparse ? 16 : mature ? 32 : 96, [...groups.values()].reduce((sum, entries) => sum + entries.length, 0)) :
    Math.min(36, Math.max(6, Math.floor(waterBudget / 480))), channels = [], heads = [], junctions = [];
  const water = new Uint8Array(length), flow = new Float32Array(length), sediment = new Float32Array(length), surface = new Float64Array(length);
  const directionX = new Float32Array(length), directionY = new Float32Array(length), centerX = new Float32Array(length), centerY = new Float32Array(length), bend = new Float32Array(length);
  let count = 0;
  for (let network = 0; network < 5; network++) {
    const marked = new Uint8Array(length), upstream = new Uint8Array(length);
    heads = [];
    for (let round = 0; round < (coastalBasins ? 2 : 1); round++) for (const root of roots) {
      const candidates = groups.get(root).slice(), share = Math.max(1, Math.round(targetHeads * Math.sqrt(drainage.flow[root]) / weights));
      const quota = coastalBasins ? round === 0 ? 1 : Math.max(0, share - 1) : share;
      for (let choice = 0; choice < quota && candidates.length;) {
        if (mountainFed && heads.length >= targetHeads) break;
        let best = -1, score = -Infinity;
        for (let order = 0; order < candidates.length; order++) {
          const index = candidates[order], x = index % size, y = Math.floor(index / size);
          const separation = heads.length ? Math.min(...heads.map(other => Math.hypot(x - other % size, y - Math.floor(other / size)))) : 50;
          if (coastalBasins ? heads.some(other => Math.hypot(x - other % size, y - Math.floor(other / size)) < (basin[other] === root ? 14 : 3)) : separation < (sparse ? 36 : mature ? 24 : terrainDriven ? 8 : 18)) continue;
          const priority = Math.min(70, separation) * (.5 + Math.max(0, drainage.level[index] - drainage.level[root])) * Math.log1p(distance[index]);
          if (priority > score) { score = priority; best = order; }
        }
        if (best < 0) break;
        const head = candidates.splice(best, 1)[0], path = [];
        for (let index = head; index >= 0 && !marked[index] && (!coastalBasins || basin[index] === root); index = drainage.parent[index]) path.push(index);
        if (coastalBasins && path.at(-1) === root && drainage.parent[root] >= 0) path.push(drainage.parent[root]);
        if (path.length < (terrainDriven >= 31 && round === 0 ? 12 : coastalBasins ? 18 : sparse ? 36 : mature ? 24 : 12)) continue;
        for (const index of path) marked[index] = 1;
        heads.push(head); choice++;
      }
    }
    for (let index = 0; index < length; index++) if (marked[index] && drainage.parent[index] >= 0) upstream[drainage.parent[index]]++;
    channels = []; junctions = [];
    for (let index = 0; index < length; index++) {
      if (!marked[index]) continue;
      if (upstream[index] > 1) junctions.push(index);
      if (upstream[index] === 1 || drainage.parent[index] < 0) continue;
      const path = [index];
      for (let next = drainage.parent[index]; next >= 0 && marked[next]; next = drainage.parent[next]) {
        path.push(next);
        if (upstream[next] !== 1) break;
      }
      if (path.length > 1) channels.push({ basin: basin[index], start: index, end: path.at(-1), points: curve(path, drainage, basin, size, seed) });
    }
    let scale = 1;
    for (let attempt = 0; attempt < 7; attempt++) {
      water.fill(0); flow.fill(0); sediment.fill(0); count = 0;
      for (const channel of channels) {
        const share = Math.max(.65, Math.min(1.25, Math.sqrt(drainage.flow[roots[0]] / drainage.flow[channel.basin]) * .7));
        for (let order = 0; order < channel.points.length; order++) {
          const point = channel.points[order], previous = channel.points[Math.max(0, order - 1)], next = channel.points[Math.min(channel.points.length - 1, order + 1)];
          const dx = next.x - previous.x, dy = next.y - previous.y, reach = Math.hypot(dx, dy) || 1;
          const turn = (point.x - previous.x) * (next.y - point.y) - (point.y - previous.y) * (next.x - point.x);
          point.radius = terrainDriven ? Math.max(.72, Math.min(3.4, .45 + Math.sqrt(point.flow / 800) * .45)) :
            Math.max(.74, Math.min(2.4, .6 + Math.log1p(point.flow / 150) * .42) * share * scale);
          const radius = Math.ceil(point.radius + 1);
          for (let y = Math.max(0, Math.floor(point.y) - radius); y <= Math.min(size - 1, Math.floor(point.y) + radius); y++) {
            for (let x = Math.max(0, Math.floor(point.x) - radius); x <= Math.min(size - 1, Math.floor(point.x) + radius); x++) {
              const index = y * size + x, offset = Math.hypot(x + .5 - point.x, y + .5 - point.y);
              if (offset > point.radius || offset > .75 && drainage.level[index] > point.surface + .045) continue;
              if (!water[index]) { water[index] = 1; count++; }
              if (point.flow < flow[index]) continue;
              flow[index] = point.flow; sediment[index] = point.sediment; surface[index] = point.surface;
              directionX[index] = dx / reach; directionY[index] = dy / reach;
              centerX[index] = point.x; centerY[index] = point.y; bend[index] = turn;
            }
          }
        }
      }
      if (terrainDriven || count <= waterBudget * .55) break;
      scale *= .8;
    }
    if (terrainDriven || count <= waterBudget * .7 || targetHeads <= roots.length) break;
    targetHeads = Math.max(roots.length, Math.floor(targetHeads * .75));
  }
  if (count > waterBudget) throw new Error("물 면적 안에 강줄기를 확보하지 못했습니다.");
  return { water, flow, sediment, surface, directionX, directionY, centerX, centerY, bend, channels, heads, junctions, count, threshold };
}
