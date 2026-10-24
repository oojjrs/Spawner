export const BURROW_TYPES = Object.freeze({
  small: Object.freeze({ width: 1, height: 1, initialCount: 1, spawnInterval: 120, populationLimit: 3, health: 20 }),
  large: Object.freeze({ width: 3, height: 1, initialCount: 3, spawnInterval: 60, populationLimit: 6, health: 60 })
});

export function burrowDistance(cell, burrow) {
  return Math.max(burrow.x - cell.x, 0, cell.x - burrow.x - burrow.width + 1) +
    Math.max(burrow.y - cell.y, 0, cell.y - burrow.y - burrow.height + 1);
}

export function burrowApproaches(burrow) {
  const cells = [];
  for (let x = burrow.x; x < burrow.x + burrow.width; x++) cells.push({ x, y: burrow.y - 1 }, { x, y: burrow.y + burrow.height });
  for (let y = burrow.y; y < burrow.y + burrow.height; y++) cells.push({ x: burrow.x - 1, y }, { x: burrow.x + burrow.width, y });
  return cells;
}

export const BURROW_PLACEMENT = Object.freeze({
  safeRadius: 32,
  contactRadius: 9,
  smallTarget: 2,
  largeTarget: 1,
  smallMinSeconds: 60,
  smallMaxSeconds: 120,
  largeMinSeconds: 120,
  largeMaxSeconds: 240,
  smallSeparation: 12,
  largeSeparation: 22
});

const SIZE = 320;
const UNREACHABLE = 65535;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function burrowHash(x, y, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function contactTimes(times) {
  const contacts = new Uint16Array(times.length).fill(UNREACHABLE);
  const radii = new Map();
  const radius = BURROW_PLACEMENT.contactRadius;
  for (let dy = -radius; dy <= radius; dy++) {
    const span = Math.floor(Math.sqrt(radius * radius - dy * dy));
    if (!radii.has(span)) radii.set(span, []);
    radii.get(span).push(dy);
  }
  const horizontal = new Uint16Array(times.length);
  const queue = new Int16Array(SIZE);
  for (const [span, offsets] of radii) {
    for (let y = 0; y < SIZE; y++) {
      const row = y * SIZE;
      let head = 0, tail = 0, next = 0;
      for (let x = 0; x < SIZE; x++) {
        while (next < SIZE && next <= x + span) {
          while (tail > head && times[row + queue[tail - 1]] >= times[row + next]) tail--;
          queue[tail++] = next++;
        }
        while (head < tail && queue[head] < x - span) head++;
        horizontal[row + x] = times[row + queue[head]];
      }
    }
    for (const dy of offsets) {
      for (let y = Math.max(0, -dy); y < Math.min(SIZE, SIZE - dy); y++) {
        const source = y * SIZE, destination = (y + dy) * SIZE;
        for (let x = 0; x < SIZE; x++) {
          if (horizontal[source + x] < contacts[destination + x]) contacts[destination + x] = horizontal[source + x];
        }
      }
    }
  }
  return contacts;
}

function siteTravel(world, blocked, site) {
  const limit = BURROW_PLACEMENT.largeMaxSeconds + BURROW_PLACEMENT.contactRadius * 4;
  const times = new Uint16Array(SIZE * SIZE).fill(UNREACHABLE);
  const buckets = Array.from({ length: limit + 1 }, () => []);
  const [cx, cy] = site;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
    for (const [ox, oy] of DIRECTIONS) {
      const x = cx + dx + ox, y = cy + dy + oy, index = y * SIZE + x;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || blocked[index] || times[index] === 0) continue;
      times[index] = 0;
      buckets[0].push(index);
    }
  }
  for (let seconds = 0; seconds <= limit; seconds++) {
    for (const index of buckets[seconds]) {
      if (times[index] !== seconds) continue;
      const x = index % SIZE, y = Math.floor(index / SIZE);
      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx, ny = y + dy, next = ny * SIZE + nx;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || blocked[next]) continue;
        const arrival = seconds + (world.hazards[next] ? 4 : 2);
        if (arrival > limit || arrival >= times[next]) continue;
        times[next] = arrival;
        buckets[arrival].push(next);
      }
    }
  }
  return { times, contacts: contactTimes(times) };
}

export function generateBurrows(world) {
  const blocked = new Uint8Array(SIZE * SIZE);
  const safe = new Uint8Array(SIZE * SIZE);
  const food = new Uint8Array(SIZE * SIZE);
  for (let index = 0; index < blocked.length; index++) {
    const terrain = world.terrain[index];
    if (terrain < 2 || terrain > 6) blocked[index] = 1;
  }
  for (const [x, y] of world.food) food[y * SIZE + x] = 1;
  const radius = BURROW_PLACEMENT.safeRadius;
  for (const [cx, cy] of world.sites) {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      if (dx * dx + dy * dy < radius * radius) safe[y * SIZE + x] = 1;
      if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2 && !(Math.abs(dx) === 2 && Math.abs(dy) === 2)) blocked[y * SIZE + x] = 1;
    }
  }
  const contexts = world.sites.map(site => siteTravel(world, blocked, site));
  const placements = [];
  for (const type of ["large", "small"]) {
    const definition = BURROW_TYPES[type];
    const minimum = BURROW_PLACEMENT[type + "MinSeconds"];
    const maximum = BURROW_PLACEMENT[type + "MaxSeconds"];
    const target = BURROW_PLACEMENT[type + "Target"];
    const candidates = [];
    for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - definition.width; x++) {
      let valid = true, density = 0;
      for (let dy = -1; dy <= 1 && valid; dy++) for (let dx = -1; dx <= definition.width; dx++) {
        const index = (y + dy) * SIZE + x + dx;
        if (blocked[index] || world.hazards[index] || food[index]) { valid = false; break; }
        if (dy === 0 && dx >= 0 && dx < definition.width) {
          if (world.terrain[index] < 3 || safe[index]) { valid = false; break; }
          density += world.creatureDensity[index] / 255 / definition.width;
        }
      }
      if (!valid || density <= 0.2) continue;
      const entrance = { x: x + Math.floor(definition.width / 2), y: y + 1 };
      const entry = entrance.y * SIZE + entrance.x;
      if (safe[entry] || contexts.some(context => context.contacts[entry] < minimum)) continue;
      const sites = [];
      for (let index = 0; index < contexts.length; index++) {
        const context = contexts[index];
        if (context.times[entry] !== UNREACHABLE && context.contacts[entry] <= maximum) sites.push(index);
      }
      if (!sites.length) continue;
      const random = burrowHash(x, y, world.seed ^ (type === "small" ? 0x3C6EF372 : 0xA54FF53A));
      const priority = -Math.log(Math.max(0.000001, random)) / (density ** 3 * sites.length);
      candidates.push({ x, y, type, width: definition.width, height: definition.height, entrance, sites, priority });
    }
    candidates.sort((left, right) => left.priority - right.priority || left.y - right.y || left.x - right.x);
    const counts = new Uint8Array(contexts.length);
    const perSite = contexts.map((context, index) => ({ index, candidates: candidates.filter(candidate => candidate.sites.includes(index)) }));
    perSite.sort((left, right) => left.candidates.length - right.candidates.length || left.index - right.index);
    for (let pass = 0; pass < target; pass++) {
      for (const site of perSite) {
        if (counts[site.index] > pass) continue;
        const candidate = site.candidates.find(point => {
          if (point.sites.some(index => counts[index] >= target)) return false;
          return placements.every(other => {
            const separation = Math.max(BURROW_PLACEMENT[type + "Separation"], BURROW_PLACEMENT[other.type + "Separation"]);
            const dx = Math.max(point.x - (other.x + other.width - 1), other.x - (point.x + point.width - 1), 0);
            const dy = Math.abs(point.y - other.y);
            return dx * dx + dy * dy >= separation * separation;
          });
        });
        if (!candidate) continue;
        placements.push(candidate);
        for (const index of candidate.sites) counts[index]++;
      }
    }
  }
  return placements.map(({ x, y, type, width, height, entrance }) => ({
    id: "burrow:" + type + ":" + (y * SIZE + x), type, x, y, width, height, entrance
  }));
}
