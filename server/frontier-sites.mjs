function integral(values, size) {
  const stride = size + 1, table = new Float64Array(stride * stride);
  for (let y = 0; y < size; y++) {
    let row = 0;
    for (let x = 0; x < size; x++) {
      row += values[y * size + x];
      table[(y + 1) * stride + x + 1] = table[y * stride + x + 1] + row;
    }
  }
  return table;
}

function area(table, x, y, radius, size) {
  const stride = size + 1, left = Math.max(0, x - radius), right = Math.min(size, x + radius + 1);
  const top = Math.max(0, y - radius), bottom = Math.min(size, y + radius + 1);
  return table[bottom * stride + right] - table[top * stride + right] - table[bottom * stride + left] + table[top * stride + left];
}

export function identifyFrontierSites(world) {
  const { size, terrain, hazards } = world, occupied = new Uint8Array(terrain.length), fields = {};
  for (const key of ["clay", "tree", "pebbles", "dew"]) fields[key] = new Float64Array(terrain.length);
  for (const [x, y, amount, key] of [...world.food, ...world.resources]) {
    occupied[y * size + x] = 1;
    if (fields[key]) fields[key][y * size + x] = amount;
  }
  fields.swamp = Float64Array.from(terrain, type => type === 9 ? 1 : 0);
  const tables = Object.fromEntries(Object.entries(fields).map(([key, values]) => [key, integral(values, size)]));
  const candidates = { wetland: [], forest: [], crossing: [] };
  for (let y = 8; y < size - 8; y += 4) for (let x = 8; x < size - 8; x += 4) {
    let clear = true;
    for (let dy = -1; dy <= 1 && clear; dy++) for (let dx = -1; dx <= 1; dx++) {
      const index = (y + dy) * size + x + dx;
      if (terrain[index] < 2 || terrain[index] > 4 || hazards[index] || occupied[index]) { clear = false; break; }
    }
    if (!clear) continue;
    const resources = Object.fromEntries(["clay", "tree", "pebbles", "dew"].map(key => [key, area(tables[key], x, y, 16, size)]));
    const swamp = area(tables.swamp, x, y, 16, size);
    if (swamp >= 30 && resources.dew >= 100 && resources.clay >= 80) candidates.wetland.push({ x, y, resources,
      score: Math.sqrt(resources.dew * resources.clay) + swamp * .25 });
    if (resources.tree >= 1800) candidates.forest.push({ x, y, resources,
      score: Math.sqrt(resources.tree) + resources.clay * .02 + resources.dew * .05 });
    if (world.hydrology.fords.some(ford => Math.hypot(x - ford.x, y - ford.y) <= 12)) candidates.crossing.push({ x, y, resources,
      score: Math.sqrt(resources.pebbles) * 3 + Math.sqrt(resources.tree) + Math.sqrt(resources.clay + resources.dew) });
  }
  const selected = [];
  for (const [kind, entries] of Object.entries(candidates)) {
    entries.sort((left, right) => right.score - left.score || left.y - right.y || left.x - right.x);
    let count = 0;
    for (const entry of entries) {
      if (selected.some(site => Math.hypot(entry.x - site.x, entry.y - site.y) < 32)) continue;
      selected.push({ ...entry, kind, id: entry.y * size + entry.x });
      if (++count >= 2) break;
    }
  }
  return selected;
}
