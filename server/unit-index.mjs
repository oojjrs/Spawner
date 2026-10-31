export function createUnitIndex(environment) {
  const records = new Map(), cells = new Map(), origins = new Map(), regions = new Map();
  let sequence = 0;
  const regionKey = (x, y) => Math.floor(y / 8) * 40 + Math.floor(x / 8);
  function put(map, key, record) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(record);
  }
  function remove(map, key, record) {
    const bucket = map.get(key);
    if (!bucket) return;
    bucket.delete(record);
    if (!bucket.size) map.delete(key);
  }
  function update(agent, game) {
    let record = records.get(agent);
    if (!record) {
      record = { agent, game: game || null, order: sequence++, cell: null, origin: null, region: null };
      records.set(agent, record);
    }
    const cell = agent.y * 320 + agent.x, region = regionKey(agent.x, agent.y);
    const origin = environment.simSeconds < agent.moveStartedAt + agent.moveDuration ? agent.renderFromY * 320 + agent.renderFromX : null;
    if (record.cell !== cell) {
      remove(cells, record.cell, record); put(cells, cell, record); record.cell = cell;
    }
    if (record.origin !== origin) {
      remove(origins, record.origin, record);
      if (origin !== null) put(origins, origin, record);
      record.origin = origin;
    }
    if (record.region !== region) {
      remove(regions, record.region, record); put(regions, region, record); record.region = region;
    }
  }
  function at(x, y) { return [...(cells.get(y * 320 + x) || [])].sort((first, second) => first.order - second.order); }
  function nearby(x, y, radius) {
    const result = [];
    for (let row = Math.max(0, Math.floor((y - radius) / 8)); row <= Math.min(39, Math.floor((y + radius) / 8)); row++) {
      for (let column = Math.max(0, Math.floor((x - radius) / 8)); column <= Math.min(39, Math.floor((x + radius) / 8)); column++) {
        for (const record of regions.get(row * 40 + column) || []) {
          if (Math.abs(record.agent.x - x) <= radius && Math.abs(record.agent.y - y) <= radius) result.push(record);
        }
      }
    }
    return result.sort((first, second) => first.order - second.order);
  }
  function occupied(x, y, excluded, includeOrigin) {
    const valid = record => record.agent !== excluded && record.agent.health > 0;
    const cell = y * 320 + x;
    for (const record of cells.get(cell) || []) if (valid(record)) return true;
    if (includeOrigin) for (const record of origins.get(cell) || []) {
      if (valid(record) && environment.simSeconds < record.agent.moveStartedAt + record.agent.moveDuration) return true;
    }
    return false;
  }
  function erase(agent) {
    const record = records.get(agent);
    if (!record) return;
    remove(cells, record.cell, record); remove(origins, record.origin, record); remove(regions, record.region, record);
    records.delete(agent);
  }
  for (const game of environment.games.values()) for (const agent of game.agents) update(agent, game);
  for (const agent of environment.creatureSystem?.agents || []) update(agent, null);
  return { update, at, nearby, occupied, remove: erase, entries: () => [...records.values()] };
}
