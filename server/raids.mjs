import { prepareRaidCreature, RAID_CREATURE_STAGES } from "./raid-combat-scale.mjs";
import { CONQUEST_PACING } from "./conquest-pacing.mjs";
import { worldSize } from "./world-size.mjs";
import { COLONY_RAID_PRESSURE, colonyRaidPressure, colonyRaidCadence } from "./raid-pressure.mjs";

export const BEETLE_RAIDS = Object.freeze({ firstAt:CONQUEST_PACING.neutralConflictAt, firstSpread:30, defenders:3 });

export function createBeetleRaids(environment, state, actions, restoring) {
  const size = worldSize(environment.world), sites = new Map((environment.world.burrows || []).map(burrow => [burrow.id, burrow]));
  const routes = new Map(), checks = new Map(), origins = new Map(), sourceIds = new Set(), approaches = new Map();
  const exhausted = new Set();
  if (restoring) {
    if (!Array.isArray(state.raidCooldowns) || new Set(state.raidCooldowns.map(entry => entry?.colonyId)).size !== state.raidCooldowns.length ||
        state.raidCooldowns.some(entry => !Number.isInteger(entry?.colonyId) || !Number.isFinite(entry.nextRaidAt) || entry.nextRaidAt < 0 ||
          entry.opening && (entry.opening.version !== 1 || !Number.isFinite(entry.opening.rate) || entry.opening.rate < 0 ||
            !Number.isFinite(entry.opening.pressure) || entry.opening.pressure < 0 || entry.opening.pressure > 1 ||
            !Number.isInteger(entry.opening.nearby) || entry.opening.nearby < 0 ||
            !Number.isFinite(entry.opening.interval) || entry.opening.interval < COLONY_RAID_PRESSURE.fastInterval || entry.opening.interval > COLONY_RAID_PRESSURE.slowInterval ||
            !Number.isFinite(entry.opening.arrivalAt) || entry.opening.arrivalAt < 120))) throw new Error("습격 저장 형식이 올바르지 않습니다.");
  } else state.raidCooldowns = [];
  for (const record of state.burrows) {
    const site = sites.get(record.id);
    if (!restoring) {
      record.raidSequence = 0;
      record.nextRaidAt = site.type === "large" ? Math.max(BEETLE_RAIDS.firstAt, environment.simSeconds) +
        actions.noise(site.x + 8419, site.y - 6311) * BEETLE_RAIDS.firstSpread : null;
    } else if (!Number.isSafeInteger(record.raidSequence) || record.raidSequence < 0 ||
        (site.type === "large" ? !Number.isFinite(record.nextRaidAt) || record.nextRaidAt < 120 : record.nextRaidAt !== null)) {
      throw new Error("굴 습격 주기 저장 형식이 올바르지 않습니다.");
    }
  }
  for (const agent of state.agents) {
    if (!agent.raid) continue;
    if (!restoring || !Number.isInteger(agent.raid.colonyId) ||
        !["outbound", "active", "returning"].includes(agent.raid.phase) || !Number.isFinite(agent.raid.departedAt) || agent.raid.departedAt < (agent.raid.forced === true ? 0 : 120) ||
        agent.raid.activeUntil != null && (!Number.isFinite(agent.raid.activeUntil) || agent.raid.activeUntil < agent.raid.departedAt)) {
      throw new Error("딱정벌레 습격 저장 형식이 올바르지 않습니다.");
    }
    if (agent.raid.phase === "returning") { agent.raid.phase = "active"; agent.returningHome = true; }
    delete agent.raid.activeUntil;
  }

  function colonyFor(agent) { return environment.colonies.find(colony => colony.id === agent.raid?.colonyId && environment.games.get(colony.ownerId)?.nest?.health !== 0); }
  function home(agent) {
    if (agent.raid?.phase === "outbound") return { x:agent.x, y:agent.y };
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
  function source(colony) {
    const distances = new Int32Array(size * size).fill(-1), queue = new Int32Array(size * size), candidates = [];
    let head = 0, tail = 0;
    for (const cell of boundary(colony)) {
      const index = cell.y * size + cell.x;
      if (distances[index] >= 0) continue;
      distances[index] = 0; queue[tail++] = index;
    }
    while (head < tail) {
      const index = queue[head++], x = index % size, y = Math.floor(index / size);
      for (const [nx, ny] of [[x - 1,y], [x + 1,y], [x,y - 1], [x,y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const next = ny * size + nx;
        if (distances[next] >= 0 || !actions.walkable(nx, ny, true)) continue;
        distances[next] = distances[index] + 1; queue[tail++] = next;
      }
    }
    for (const record of state.burrows) {
      const site = sites.get(record.id);
      if (site.type !== "large" || site.creature?.unique || record.health <= 0) continue;
      const distance = distances[site.entrance.y * size + site.entrance.x];
      if (distance >= 0) candidates.push({ record, distance });
    }
    candidates.sort((left, right) => left.distance - right.distance);
    approaches.set(colony.id, candidates.map(candidate => ({ id:candidate.record.id, seconds:candidate.distance * actions.stepSeconds })));
    const selected = candidates.find(candidate => !sourceIds.has(candidate.record.id)) || candidates[0];
    if (!selected) return null;
    origins.set(colony.id, selected.record);
    sourceIds.add(selected.record.id);
    return selected.record;
  }
  for (const colony of environment.colonies) {
    if (!environment.games.has(colony.ownerId) || environment.games.get(colony.ownerId).nest?.health === 0) continue;
    const record = source(colony);
    if (!state.raidCooldowns.some(entry => entry.colonyId === colony.id)) state.raidCooldowns.push({ colonyId:colony.id,
      nextRaidAt:Math.max(environment.simSeconds, record?.nextRaidAt ?? BEETLE_RAIDS.firstAt) });
    if (record) actions.reinforce(record);
  }
  function dispatch() {
    const now = environment.simSeconds;
    for (const colony of environment.colonies) {
      if (exhausted.has(colony.id)) continue;
      if (!environment.games.has(colony.ownerId) || environment.games.get(colony.ownerId).nest?.health === 0) continue;
      let cooldown = state.raidCooldowns.find(entry => entry.colonyId === colony.id);
      if (!cooldown) {
        cooldown = { colonyId:colony.id, nextRaidAt:Math.max(BEETLE_RAIDS.firstAt, now) };
        state.raidCooldowns.push(cooldown);
      }
      const game = environment.games.get(colony.ownerId);
      if (!cooldown.opening && now >= COLONY_RAID_PRESSURE.openingSeconds && Number.isFinite(game.colonyFood)) {
        const options = approaches.get(colony.id) || [];
        cooldown.opening = colonyRaidPressure(game.colonyFood, Math.max(now, COLONY_RAID_PRESSURE.openingSeconds),
          options.map(option => option.seconds), BEETLE_RAIDS.firstAt, colony.tribe);
        const origin = origins.get(colony.id), approach = options.find(option => option.id === origin?.id);
        if (origin?.raidSequence === 0 && approach && !state.agents.some(agent => agent.raid?.colonyId === colony.id))
          cooldown.nextRaidAt = Math.max(cooldown.nextRaidAt, cooldown.opening.arrivalAt - approach.seconds);
      }
      if (now < BEETLE_RAIDS.firstAt || now + 1e-8 < cooldown.nextRaidAt || now < (checks.get(colony.id) || 0)) continue;
      checks.set(colony.id, now + 5);
      const cadence = colonyRaidCadence(now, cooldown.opening?.pressure);
      if (state.agents.filter(agent => agent.health > 0 && agent.raid?.colonyId === colony.id).length >= cadence.concurrent) continue;
      let record = origins.get(colony.id);
      if (!record || record.health <= 0) record = source(colony);
      if (!record) { exhausted.add(colony.id); continue; }
      const site = sites.get(record.id);
      const guards = state.agents.filter(agent => agent.health > 0 && agent.burrowId === record.id && !agent.raid);
      if (!guards.length) { exhausted.add(colony.id); continue; }
      const agent = guards.filter(agent => agent.mode !== "attack" && !agent.combat && !agent.attack)
        .sort((left, right) => right.health - left.health || Math.hypot(left.x - site.entrance.x, left.y - site.entrance.y) - Math.hypot(right.x - site.entrance.x, right.y - site.entrance.y))[0];
      if (!agent) continue;
      const cells = path(agent, boundary(colony), false);
      if (!cells) continue;
      agent.raid = { colonyId:colony.id, phase:"outbound", departedAt:now };
      const stage = prepareRaidCreature(agent, now);
      agent.attackTargetId = null; agent.attackHit = true;
      if (now >= agent.moveStartedAt + agent.moveDuration) actions.idle(agent, 0);
      routes.set(agent.id, { phase:"outbound", path:cells, cursor:1, retryAt:now });
      record.raidSequence++;
      record.nextRaidAt = Math.max(now + cadence.interval,
        stage < 2 ? RAID_CREATURE_STAGES[stage + 1].at : 0);
      cooldown.nextRaidAt = record.nextRaidAt;
    }
    for (const id of routes.keys()) if (!state.agents.some(agent => agent.id === id && agent.health > 0 && agent.raid)) routes.delete(id);
  }
  function finish(agent) {
    agent.homeX = agent.x; agent.homeY = agent.y;
    delete agent.raid;
    agent.returningHome = false;
    agent.attackHit = true; agent.attackTargetId = null;
    actions.idle(agent, 0);
    routes.delete(agent.id);
  }
  function update(agent) {
    if (!agent.raid || agent.combat) return false;
    const now = environment.simSeconds, colony = colonyFor(agent);
    if (!colony) { finish(agent); return true; }
    if (agent.raid.phase === "active") return false;
    if (now < agent.moveStartedAt + agent.moveDuration) return true;
    const goals = boundary(colony);
    if (goals.some(cell => Math.abs(cell.x - agent.x) + Math.abs(cell.y - agent.y) <= 1)) {
      routes.delete(agent.id);
      agent.raid.phase = "active"; actions.idle(agent, 0);
      return false;
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
        if (!path(agent, goals, false)) finish(agent);
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
    return colony && environment.games.get(colony.ownerId) === game;
  }
  return { dispatch, update, home, targetAllowed, sourceIds };
}
