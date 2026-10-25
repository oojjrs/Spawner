export function startingTravel(world, camp) {
  const size = world.size, limit = 72, costs = new Int16Array(size * size).fill(-1), blocked = new Set();
  for (const nest of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) blocked.add((nest.y + dy) * size + nest.x + dx);
  }
  for (const burrow of world.burrows) for (let dx = 0; dx < burrow.width; dx++) blocked.add(burrow.y * size + burrow.x + dx);
  const buckets = Array.from({ length: limit + 1 }, () => []);
  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    const index = (camp.y + dy) * size + camp.x + dx;
    costs[index] = 0; buckets[0].push(index);
  }
  for (let cost = 0; cost <= limit; cost++) for (const index of buckets[cost]) {
    if (costs[index] !== cost) continue;
    const x = index % size, y = Math.floor(index / size);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const next = ny * size + nx;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || world.terrain[next] < 2 || world.hazards[next] || blocked.has(next)) continue;
      const candidate = cost + (world.terrain[next] >= 6 && world.terrain[next] <= 8 ? 5 : 3);
      if (candidate > limit || costs[next] >= 0 && costs[next] <= candidate) continue;
      costs[next] = candidate; buckets[candidate].push(next);
    }
  }
  return costs;
}

export function measureStartingEconomy(world, policies) {
  return world.camps.map((camp, order) => {
    const policy = policies[order], travel = startingTravel(world, camp);
    const points = world.resources.filter(([x, y, amount, key]) => key === policy.key && amount > 0 && travel[y * world.size + x] >= 0);
    const weight = point => Math.exp(-travel[point[1] * world.size + point[0]] / 18);
    const near = points.filter(point => travel[point[1] * world.size + point[0]] <= 36);
    return { tribe: policy.tribe, key: policy.key, nearestSeconds: points.length ? Math.min(...points.map(point => travel[point[1] * world.size + point[0]])) * 2 / 3 : null,
      cells: near.length, amount: near.reduce((sum, point) => sum + point[2], 0),
      weightedAmount: points.reduce((sum, point) => sum + point[2] * weight(point), 0),
      weightedCells: points.reduce((sum, point) => sum + weight(point), 0) };
  });
}

export function correctStartingEconomy(world, policies, points, available, habitat, minimumSites, minimumTravel) {
  const size = world.size, targets = [120, 260, 120, 95], referenceCoverage = [.035, .2, .045, .17];
  const before = measureStartingEconomy({ ...world, resources: [...points.values()] }, policies);
  const corrections = [];
  for (const [order, camp] of world.camps.entries()) {
    const policy = policies[order], travel = startingTravel(world, camp), cluster = policy.coverage !== null;
    const coverage = [...points.values()].filter(point => point[3] === policy.key).length / (size * size);
    const target = targets[order] * Math.max(.95, Math.min(1.05, (referenceCoverage[order] / coverage) ** .25));
    const weight = index => travel[index] < 0 ? 0 : Math.exp(-travel[index] / 18);
    let moved = 0, changed = 0;
    const remote = index => world.camps.every(nest => Math.hypot(index % size - nest.x, Math.floor(index / size) - nest.y) > 32);
    function exchange(first, second) {
      const left = points.get(first), right = points.get(second);
      points.delete(first); points.delete(second);
      if (left) points.set(second, [second % size, Math.floor(second / size), left[2], left[3]]);
      if (right) points.set(first, [first % size, Math.floor(first / size), right[2], right[3]]);
      moved++;
    }
    function relocate(index) {
      const point = points.get(index);
      if (!point) return false;
      const first = (Math.imul(world.seed ^ index, 2654435761) >>> 0) % (size * size);
      for (let offset = 0; offset < size * size; offset++) {
        const next = (first + offset) % (size * size), other = points.get(next);
        if (!available(next) || !remote(next) || !habitat(point[3], world.terrain[next]) ||
            other && (other[3] === point[3] || !habitat(other[3], world.terrain[index]))) continue;
        exchange(index, next); return true;
      }
      return false;
    }
    function claim(index) {
      if (points.get(index)?.[3] === policy.key) return true;
      const other = points.get(index);
      for (const [source, point] of points) {
        if (point[3] !== policy.key || !remote(source) || other && !habitat(other[3], world.terrain[source])) continue;
        exchange(source, index); return true;
      }
      return false;
    }
    if (cluster) {
      const quadrants = Array.from({ length: 4 }, () => []), chosen = new Set();
      for (let index = 0; index < travel.length; index++) {
        if (travel[index] < minimumTravel || travel[index] > 18 || !available(index) || !habitat(policy.key, world.terrain[index])) continue;
        const x = index % size, y = Math.floor(index / size), quadrant = (y >= camp.y ? 2 : 0) + (x >= camp.x ? 1 : 0);
        quadrants[quadrant].push(index);
      }
      for (const quadrant of quadrants) {
        quadrant.sort((left, right) => travel[left] - travel[right] || left - right);
        for (const index of quadrant.slice(0, 2)) if (claim(index)) chosen.add(index);
      }
      for (const [index, point] of [...points]) if (point[3] === policy.key && travel[index] >= 0 && travel[index] <= 18 && !chosen.has(index)) relocate(index);
      if (minimumSites > 0) {
        let count = [...points].filter(([index, point]) => point[3] === policy.key && travel[index] >= 0 && travel[index] <= 36).length;
        const approaches = Array.from({ length: 4 }, () => []);
        for (let index = 0; index < travel.length; index++) {
          if (travel[index] <= 18 || travel[index] > 36 || !available(index) || !habitat(policy.key, world.terrain[index]) || points.get(index)?.[3] === policy.key) continue;
          const quadrant = (Math.floor(index / size) >= camp.y ? 2 : 0) + (index % size >= camp.x ? 1 : 0);
          approaches[quadrant].push(index);
        }
        for (const approach of approaches) approach.sort((left, right) => travel[left] - travel[right] || left - right);
        for (let round = 0; count < minimumSites; round++) {
          let found = false;
          for (const approach of approaches) {
            const index = approach[round];
            if (index === undefined) continue;
            found = true;
            if (claim(index)) count++;
            if (count >= minimumSites) break;
          }
          if (!found) break;
        }
      }
    }
    const local = [...points.entries()].filter(([index, point]) => point[3] === policy.key && travel[index] >= 0 && travel[index] <= 36);
    const outer = [...points.entries()].filter(([index, point]) => point[3] === policy.key && travel[index] > 36)
      .reduce((sum, [index, point]) => sum + point[2] * weight(index), 0);
    const inner = local.reduce((sum, [index, point]) => sum + point[2] * weight(index), 0);
    const ratio = (inner + outer) / target;
    if (cluster && inner > 0) {
      const factor = Math.max(.3, Math.min(3, (target - outer) / inner));
      for (const [index, point] of local) {
        const expected = Math.max(1, Math.min(30, point[2] * factor));
        const fraction = ((Math.imul(index ^ world.seed, 1103515245) >>> 0) % 1000) / 1000;
        const amount = Math.floor(expected) + (fraction < expected % 1 ? 1 : 0);
        changed += Math.abs(amount - point[2]); point[2] = amount;
      }
    } else if (!cluster && ratio < (policy.key === "tree" ? .6 : .8)) {
      let remaining = target * .9 - inner - outer;
      local.sort((left, right) => travel[left[0]] - travel[right[0]] || left[0] - right[0]);
      for (const [index, point] of local) {
        if (remaining <= 0) break;
        if (point[2] >= policy.amount * 2) continue;
        point[2]++; changed++; remaining -= weight(index);
      }
    } else if (!cluster && ratio > (policy.key === "tree" ? 1.6 : 1.2)) {
      let excess = inner + outer - target * 1.1;
      local.sort((left, right) => travel[left[0]] - travel[right[0]] || left[0] - right[0]);
      for (const [index, point] of local) {
        if (excess <= 0) break;
        if (travel[index] <= 12) continue;
        if (relocate(index)) excess -= point[2] * weight(index);
      }
    }
    corrections.push({ tribe: policy.tribe, targetWeightedAmount: target, movedCells: moved, adjustedAmount: changed });
  }
  const after = measureStartingEconomy({ ...world, resources: [...points.values()] }, policies);
  return after.map((metric, order) => ({ ...metric, before: before[order], ...corrections[order] }));
}
