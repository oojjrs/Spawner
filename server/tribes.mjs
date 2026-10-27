export const TRIBE_PLACEMENT = Object.freeze({
  target: 3,
  nearMinDistance: 200,
  nearMaxDistance: 240,
  farMinDistance: 260,
  farMaxDistance: 320,
  separation: 120,
  directionDegrees: 45,
  activityRadius: 25,
  contactRadius: 3,
  minContactSeconds: 300
});

const SIZE = 320;
const UNREACHABLE = 4294967295;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NEST = [];
for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
  if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) NEST.push([dx, dy]);
}

function tribeHash(x, y, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function generateTribes(world) {
  if (!world.sites.length) return [];
  const origin = world.sites[0], blocked = new Uint8Array(SIZE * SIZE);
  const valid = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  for (let index = 0; index < blocked.length; index++) {
    if (world.terrain[index] < 2 || world.terrain[index] > 6) blocked[index] = 1;
  }
  for (const burrow of world.burrows || []) for (let dy = 0; dy < burrow.height; dy++) for (let dx = 0; dx < burrow.width; dx++) {
    const x = burrow.x + dx, y = burrow.y + dy;
    if (valid(x, y)) blocked[y * SIZE + x] = 1;
  }
  const clearNest = ([x, y]) => NEST.every(([dx, dy]) => valid(x + dx, y + dy) &&
    !blocked[(y + dy) * SIZE + x + dx] && !world.hazards?.[(y + dy) * SIZE + x + dx]);
  if (!clearNest(origin)) return [];

  function distances(site, limit) {
    const values = new Uint32Array(blocked.length).fill(UNREACHABLE), queue = new Int32Array(blocked.length);
    const start = site[1] * SIZE + site[0];
    values[start] = 0; queue[0] = start; let head = 0, tail = 1;
    while (head < tail) {
      const index = queue[head++], x = index % SIZE, y = Math.floor(index / SIZE);
      if (values[index] >= limit) continue;
      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx, ny = y + dy, next = ny * SIZE + nx;
        if (!valid(nx, ny) || blocked[next] || values[next] !== UNREACHABLE) continue;
        values[next] = values[index] + 1; queue[tail++] = next;
      }
    }
    return { values, cells: queue.subarray(0, tail) };
  }

  function scoutTimes() {
    const limit = TRIBE_PLACEMENT.farMaxDistance * 4, times = new Uint32Array(blocked.length).fill(UNREACHABLE);
    const buckets = Array.from({ length: limit + 1 }, () => []), home = new Set(NEST.map(([dx, dy]) => (origin[1] + dy) * SIZE + origin[0] + dx));
    for (const index of home) for (const [dx, dy] of DIRECTIONS) {
      const x = index % SIZE + dx, y = Math.floor(index / SIZE) + dy, next = y * SIZE + x;
      if (!valid(x, y) || home.has(next) || blocked[next] || times[next] === 0) continue;
      times[next] = 0; buckets[0].push(next);
    }
    for (let seconds = 0; seconds <= limit; seconds++) for (const index of buckets[seconds]) {
      if (times[index] !== seconds) continue;
      const x = index % SIZE, y = Math.floor(index / SIZE);
      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx, ny = y + dy, next = ny * SIZE + nx;
        if (!valid(nx, ny) || blocked[next] || home.has(next)) continue;
        const arrival = seconds + (world.hazards?.[next] ? 4 : 2);
        if (arrival > limit || arrival >= times[next]) continue;
        times[next] = arrival; buckets[arrival].push(next);
      }
    }
    return times;
  }

  const home = distances(origin, TRIBE_PLACEMENT.farMaxDistance), fromHome = home.values, times = scoutTimes();
  const sight = [];
  for (let dy = -TRIBE_PLACEMENT.contactRadius; dy <= TRIBE_PLACEMENT.contactRadius; dy++) {
    for (let dx = -TRIBE_PLACEMENT.contactRadius; dx <= TRIBE_PLACEMENT.contactRadius; dx++) {
      if (dx * dx + dy * dy <= TRIBE_PLACEMENT.contactRadius ** 2) sight.push([dx, dy]);
    }
  }
  function contactSeconds(site) {
    let earliest = UNREACHABLE;
    for (const index of distances(site, TRIBE_PLACEMENT.activityRadius).cells) {
      const x = index % SIZE, y = Math.floor(index / SIZE);
      for (const [dx, dy] of sight) if (valid(x + dx, y + dy)) earliest = Math.min(earliest, times[(y + dy) * SIZE + x + dx]);
    }
    return earliest;
  }

  const candidates = [];
  for (let siteIndex = 1; siteIndex < world.sites.length; siteIndex++) {
    const site = world.sites[siteIndex], [x, y] = site, pathDistance = fromHome[y * SIZE + x];
    const near = pathDistance >= TRIBE_PLACEMENT.nearMinDistance && pathDistance <= TRIBE_PLACEMENT.nearMaxDistance;
    const far = pathDistance >= TRIBE_PLACEMENT.farMinDistance && pathDistance <= TRIBE_PLACEMENT.farMaxDistance;
    if ((!near && !far) || !clearNest(site)) continue;
    const contact = contactSeconds(site);
    if (contact === UNREACHABLE || contact < TRIBE_PLACEMENT.minContactSeconds) continue;
    const midpoint = near ? (TRIBE_PLACEMENT.nearMinDistance + TRIBE_PLACEMENT.nearMaxDistance) / 2 :
      (TRIBE_PLACEMENT.farMinDistance + TRIBE_PLACEMENT.farMaxDistance) / 2;
    candidates.push({ id: "tribe:" + siteIndex, siteIndex, x, y, distanceBand: near ? "near" : "far", pathDistance,
      contactSeconds: contact, activityRadius: TRIBE_PLACEMENT.activityRadius,
      priority: Math.abs(pathDistance - midpoint) / 40 + tribeHash(x, y, world.seed) });
  }

  const fields = new Map(), cosine = Math.cos(TRIBE_PLACEMENT.directionDegrees * Math.PI / 180);
  function compatible(first, second) {
    const ax = first.x - origin[0], ay = first.y - origin[1], bx = second.x - origin[0], by = second.y - origin[1];
    if ((ax * bx + ay * by) / Math.hypot(ax, ay) / Math.hypot(bx, by) > cosine + 1e-10) return false;
    if (!fields.has(first.id)) fields.set(first.id, distances([first.x, first.y], blocked.length).values);
    const distance = fields.get(first.id)[second.y * SIZE + second.x];
    return distance !== UNREACHABLE && distance >= TRIBE_PLACEMENT.separation;
  }
  let selected = [], score = Infinity;
  function choose(slot, group, priority) {
    if (slot === TRIBE_PLACEMENT.target) {
      const hasNear = group.some(candidate => candidate.distanceBand === "near");
      const selectedNear = selected.some(candidate => candidate.distanceBand === "near");
      if (group.length > selected.length || group.length === selected.length &&
          (hasNear && !selectedNear || hasNear === selectedNear && priority < score)) {
        selected = [...group]; score = priority;
      }
      return;
    }
    for (const candidate of candidates) {
      if (candidate.distanceBand !== (slot === 0 ? "near" : "far") || group.includes(candidate) ||
          !group.every(other => compatible(other, candidate))) continue;
      choose(slot + 1, [...group, candidate], priority + candidate.priority);
    }
    choose(slot + 1, group, priority);
  }
  choose(0, [], 0);
  function fill(positions) {
    while (selected.length < TRIBE_PLACEMENT.target) {
      const occupied = [{ x: origin[0], y: origin[1] }, ...selected];
      const separation = selected.map(tribe => {
        if (!fields.has(tribe.id)) fields.set(tribe.id, distances([tribe.x, tribe.y], blocked.length).values);
        return fields.get(tribe.id);
      });
      let best = null, bestScore = -Infinity;
      for (const index of positions) {
        const x = index % SIZE, y = Math.floor(index / SIZE), pathDistance = fromHome[index];
        if (pathDistance === UNREACHABLE || pathDistance === 0 ||
            occupied.some(other => Math.max(Math.abs(x - other.x), Math.abs(y - other.y)) < 5) || !clearNest([x, y])) continue;
        const gap = Math.min(pathDistance, ...separation.map(field => field[index]));
        const priority = gap + tribeHash(x, y, world.seed) * 0.25;
        if (priority > bestScore) { best = { x, y, pathDistance }; bestScore = priority; }
      }
      if (!best) return;
      const { x, y, pathDistance } = best;
      const siteIndex = world.sites.findIndex(site => site[0] === x && site[1] === y);
      selected.push({ id: siteIndex > 0 ? "tribe:" + siteIndex : "tribe:cell:" + (y * SIZE + x),
        siteIndex: siteIndex > 0 ? siteIndex : null, x, y,
        distanceBand: pathDistance <= TRIBE_PLACEMENT.nearMaxDistance ? "near" : "far", pathDistance,
        contactSeconds: contactSeconds([x, y]), activityRadius: TRIBE_PLACEMENT.activityRadius });
    }
  }
  if (selected.length < TRIBE_PLACEMENT.target && !(world.generationVersion >= 1 && world.generationVersion <= 5)) {
    fill(world.sites.slice(1).map(([x, y]) => y * SIZE + x));
    if (selected.length < TRIBE_PLACEMENT.target) fill(home.cells);
  }
  return selected.map(({ priority, ...tribe }) => tribe);
}
