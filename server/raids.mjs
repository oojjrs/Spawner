export const BEETLE_RAIDS = Object.freeze({ firstAt:180, firstSpread:30, interval:120, intervalSpread:60, activityDuration:30, defenders:3 });

export function createBeetleRaids(environment, state, actions, restoring) {
  const size = 320, sites = new Map((environment.world.burrows || []).map(burrow => [burrow.id, burrow]));
  const routes = new Map(), checks = new Map();
  if (restoring) {
    if (!Array.isArray(state.raidCooldowns) || new Set(state.raidCooldowns.map(entry => entry?.colonyId)).size !== state.raidCooldowns.length ||
        state.raidCooldowns.some(entry => !Number.isInteger(entry?.colonyId) || !Number.isFinite(entry.nextRaidAt) || entry.nextRaidAt < 0)) throw new Error("습격 저장 형식이 올바르지 않습니다.");
  } else state.raidCooldowns = [];
  for (const record of state.burrows) {
    const site = sites.get(record.id);
    if (!restoring) {
      record.raidSequence = 0;
      record.nextRaidAt = site.type === "large" ? Math.max(BEETLE_RAIDS.firstAt, environment.simSeconds) +
        actions.noise(site.x + 8419, site.y - 6311) * BEETLE_RAIDS.firstSpread : null;
    } else if (!Number.isSafeInteger(record.raidSequence) || record.raidSequence < 0 ||
        (site.type === "large" ? !Number.isFinite(record.nextRaidAt) || record.nextRaidAt < BEETLE_RAIDS.firstAt : record.nextRaidAt !== null)) {
      throw new Error("굴 습격 주기 저장 형식이 올바르지 않습니다.");
    }
  }
  for (const agent of state.agents) if (agent.raid && (!restoring || !Number.isInteger(agent.raid.colonyId) ||
      !["outbound", "active", "returning"].includes(agent.raid.phase) || !Number.isFinite(agent.raid.departedAt) || agent.raid.departedAt < BEETLE_RAIDS.firstAt ||
      (agent.raid.phase === "active" ? !Number.isFinite(agent.raid.activeUntil) || agent.raid.activeUntil < agent.raid.departedAt : agent.raid.activeUntil !== null))) {
    throw new Error("딱정벌레 습격 저장 형식이 올바르지 않습니다.");
  }

  function colonyFor(agent) { return environment.colonies.find(colony => colony.id === agent.raid?.colonyId && environment.games.get(colony.ownerId)?.nest?.health !== 0); }
  function home(agent) {
    const colony = agent.raid?.phase === "active" && colonyFor(agent);
    return colony ? { x:colony.x + 2, y:colony.y + 2 } : { x:agent.homeX, y:agent.homeY };
  }
  function boundary(colony) {
    const cells = new Map();
    for (const key of colony.occupiedCells) {
      const [dx, dy] = key.split(",").map(Number);
      for (const [x, y] of [[colony.x + dx - 1, colony.y + dy], [colony.x + dx + 1, colony.y + dy],
        [colony.x + dx, colony.y + dy - 1], [colony.x + dx, colony.y + dy + 1]]) {
        if (actions.walkable(x, y, true)) cells.set(y * size + x, { x, y });
      }
    }
    return [...cells.values()];
  }
  function path(agent, goals, occupied) {
    const targets = new Set(goals.filter(cell => actions.walkable(cell.x, cell.y, true)).map(cell => cell.y * size + cell.x));
    if (!targets.size) return null;
    const start = agent.y * size + agent.x, parents = new Int32Array(size * size).fill(-1), queue = new Int32Array(size * size);
    parents[start] = start; queue[0] = start; let head = 0, tail = 1;
    while (head < tail) {
      const index = queue[head++], x = index % size, y = Math.floor(index / size);
      if (targets.has(index)) {
        const result = [index]; let previous = index;
        while (previous !== start) { previous = parents[previous]; result.push(previous); }
        return result.reverse();
      }
      for (const [nx, ny] of [[x - 1,y], [x + 1,y], [x,y - 1], [x,y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const next = ny * size + nx;
        if (parents[next] >= 0 || !actions.walkable(nx, ny, true) || occupied && actions.occupied(nx, ny, agent)) continue;
        parents[next] = index; queue[tail++] = next;
      }
    }
    return null;
  }
  function dispatch() {
    const now = environment.simSeconds;
    for (const record of state.burrows) {
      const site = sites.get(record.id);
      if (site.type !== "large" || record.health <= 0 || now + 1e-8 < record.nextRaidAt || now < (checks.get(record.id) || 0)) continue;
      checks.set(record.id, now + 5);
      const guards = state.agents.filter(agent => agent.health > 0 && agent.burrowId === record.id && !agent.raid);
      if (guards.length <= BEETLE_RAIDS.defenders) continue;
      const agent = guards.filter(agent => agent.mode !== "attack")
        .sort((left, right) => right.health - left.health || Math.hypot(left.x - site.entrance.x, left.y - site.entrance.y) - Math.hypot(right.x - site.entrance.x, right.y - site.entrance.y))[0];
      if (!agent) continue;
      const colonies = environment.colonies.filter(colony => environment.games.has(colony.ownerId) && environment.games.get(colony.ownerId).nest?.health !== 0 &&
        !state.agents.some(other => other.health > 0 && other.raid?.colonyId === colony.id) &&
        !state.raidCooldowns.some(entry => entry.colonyId === colony.id && now < entry.nextRaidAt))
        .sort((left, right) => Math.hypot(site.x - left.x, site.y - left.y) - Math.hypot(site.x - right.x, site.y - right.y));
      for (const colony of colonies) {
        const cells = path(agent, boundary(colony), false);
        if (!cells) continue;
        agent.raid = { colonyId:colony.id, phase:"outbound", departedAt:now, activeUntil:null };
        agent.attackTargetId = null; agent.attackHit = true;
        if (now >= agent.moveStartedAt + agent.moveDuration) actions.idle(agent, 0);
        routes.set(agent.id, { phase:"outbound", path:cells, cursor:1, retryAt:now });
        record.raidSequence++;
        const interval = BEETLE_RAIDS.interval + actions.noise(site.x + record.raidSequence * 421, site.y - record.raidSequence * 733) * BEETLE_RAIDS.intervalSpread;
        record.nextRaidAt = now + interval;
        const cooldown = state.raidCooldowns.find(entry => entry.colonyId === colony.id);
        if (cooldown) cooldown.nextRaidAt = record.nextRaidAt;
        else state.raidCooldowns.push({ colonyId:colony.id, nextRaidAt:record.nextRaidAt });
        break;
      }
    }
    for (const id of routes.keys()) if (!state.agents.some(agent => agent.id === id && agent.health > 0 && agent.raid)) routes.delete(id);
  }
  function returning(agent) {
    agent.raid.phase = "returning"; agent.raid.activeUntil = null;
    agent.attackHit = true; agent.attackTargetId = null;
    if (agent.mode === "attack") actions.idle(agent, 0);
    routes.delete(agent.id);
  }
  function update(agent) {
    if (!agent.raid) return false;
    const now = environment.simSeconds, colony = colonyFor(agent);
    if (agent.raid.phase !== "returning" && (!colony || agent.raid.phase === "active" && now >= agent.raid.activeUntil)) returning(agent);
    if (agent.raid.phase === "active") return false;
    if (now < agent.moveStartedAt + agent.moveDuration) return true;
    const site = sites.get(agent.burrowId), entrance = site?.entrance || { x:agent.homeX, y:agent.homeY };
    const goals = agent.raid.phase === "outbound" ? boundary(colony) : [entrance,
      { x:entrance.x - 1,y:entrance.y }, { x:entrance.x + 1,y:entrance.y }, { x:entrance.x,y:entrance.y - 1 }, { x:entrance.x,y:entrance.y + 1 }];
    if (goals.some(cell => Math.abs(cell.x - agent.x) + Math.abs(cell.y - agent.y) <= (agent.raid.phase === "outbound" ? 1 : 0))) {
      routes.delete(agent.id);
      if (agent.raid.phase === "outbound") {
        agent.raid.phase = "active"; agent.raid.activeUntil = now + BEETLE_RAIDS.activityDuration; actions.idle(agent, 0);
        return false;
      }
      agent.homeX = entrance.x; agent.homeY = entrance.y; delete agent.raid; actions.idle(agent, 1);
      return true;
    }
    let route = routes.get(agent.id);
    if (route && now < route.retryAt) return true;
    if (!route || route.phase !== agent.raid.phase || route.path[route.cursor - 1] !== agent.y * size + agent.x) {
      const cells = path(agent, goals, false);
      route = { phase:agent.raid.phase, path:cells || [], cursor:1, retryAt:now };
      routes.set(agent.id, route);
    }
    let next = route.path[route.cursor];
    if (next === undefined || actions.occupied(next % size, Math.floor(next / size), agent) || !actions.walkable(next % size, Math.floor(next / size), true)) {
      const cells = path(agent, goals, true);
      if (!cells) {
        if (agent.raid.phase === "outbound" && !path(agent, goals, false)) returning(agent);
        else route.retryAt = now + 1;
        actions.idle(agent, 1); return true;
      }
      route.path = cells; route.cursor = 1; next = cells[1];
    }
    if (next !== undefined) { actions.move(agent, { x:next % size, y:Math.floor(next / size) }); route.cursor++; }
    return true;
  }
  function targetAllowed(agent, game) {
    if (!agent.raid) return true;
    const colony = colonyFor(agent);
    return agent.raid.phase === "active" && colony && environment.games.get(colony.ownerId) === game;
  }
  return { dispatch, update, home, targetAllowed };
}
