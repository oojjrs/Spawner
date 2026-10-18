export const CREATURE_ASSETS = [
  "DesignAssets/spiny-back-beetle-sprite.png",
  "DesignAssets/Animations/spiny-back-beetle-idle-runtime.webp",
  "DesignAssets/Animations/spiny-back-beetle-walk-runtime.webp",
  "DesignAssets/Animations/spiny-back-beetle-attack-runtime.webp"
];

export function createCreatures(environment, saved) {
  const size = 320;
  const species = "spiny-back-beetle";
  const stats = { health: 20, attack: 3, speed: 1 / 1.28, vision: 4, resistance: 1 };
  const state = { version: 3, agents: [] };

  function noise(x, y) {
    let value = Math.imul(x + (environment.seed || environment.world.seed || 0), 374761393) ^ Math.imul(y, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  }

  function walkable(x, y) {
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    const terrain = environment.world.terrain[y * size + x];
    if (terrain < 2 || terrain > 6) return false;
    if (environment.world.sites.some(site => Math.hypot(x - site[0], y - site[1]) < 18)) return false;
    return !environment.colonies.some(colony => colony.occupiedCells.has((x - colony.x) + "," + (y - colony.y)));
  }

  function players() {
    return [...environment.games.values()].flatMap(game => game.agents.filter(agent => agent.health > 0).map(agent => ({ game, agent })));
  }

  function occupied(x, y, excluded) {
    return [...state.agents, ...players().map(entry => entry.agent)].some(agent => agent !== excluded && agent.health > 0 &&
      (agent.x === x && agent.y === y || environment.simSeconds - agent.moveStartedAt < agent.moveDuration && agent.renderFromX === x && agent.renderFromY === y));
  }

  function spawnAt(x, y, id) {
    const agent = { id, species, name: "가시등벌레", faction: "hostile",
      x, y, homeX: x, homeY: y, health: stats.health, cost: 8, carrying: 0, attributes: {},
      stats: { ...stats },
      renderFromX: x, renderFromY: y, moveStartedAt: environment.simSeconds, moveDuration: 0,
      mode: "idle", animationStartedAt: environment.simSeconds, facing: -1, stepCount: 0,
      nextActionAt: environment.simSeconds + 1.5 + noise(x, y) * 2, attackStartedAt: -10,
      attackTargetId: null, attackHit: false, attackReadyAt: 0 };
    state.agents.push(agent);
    return agent;
  }

  function populate() {
    const candidates = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const density = environment.world.creatureDensity[y * size + x] / 255;
      if (density <= 0.2 || noise(x + 17011, y - 9109) >= 0.012 * ((density - 0.2) / 0.8) ** 2) continue;
      if (!walkable(x, y) || environment.world.sites.some(site => Math.hypot(x - site[0], y - site[1]) < 26)) continue;
      candidates.push({ x, y, priority: noise(x - 2311, y + 11317) });
    }
    candidates.sort((left, right) => left.priority - right.priority);
    for (const cell of candidates) {
      const id = "beetle:cell:" + (cell.y * size + cell.x);
      if (occupied(cell.x, cell.y, null) || state.agents.some(agent => agent.id === id || agent.health > 0 &&
        (Math.hypot(cell.x - agent.homeX, cell.y - agent.homeY) < 6 || Math.hypot(cell.x - agent.x, cell.y - agent.y) < 6))) continue;
      spawnAt(cell.x, cell.y, id);
    }
  }

  function relocate(agent) {
    let destination = null, distance = Infinity;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const candidate = (x - agent.homeX) ** 2 + (y - agent.homeY) ** 2;
      if (candidate >= distance || !walkable(x, y) || occupied(x, y, null) ||
        environment.world.sites.some(site => Math.hypot(x - site[0], y - site[1]) < 26)) continue;
      destination = { x, y };
      distance = candidate;
    }
    if (!destination) throw new Error("가시등벌레를 재배치할 빈 공간이 없습니다.");
    return spawnAt(destination.x, destination.y, agent.id);
  }

  if ([1, 2, 3].includes(saved?.version) && Array.isArray(saved.agents)) {
    for (const agent of saved.agents) {
      if (saved.version === 1) {
        agent.health = Math.min(stats.health, agent.health / agent.stats.health * stats.health);
        agent.stats = { ...stats };
        if (agent.health > 0 && (!walkable(agent.x, agent.y) ||
          environment.world.sites.some(site => Math.hypot(agent.homeX - site[0], agent.homeY - site[1]) < 26))) {
          const relocated = relocate(agent);
          relocated.health = agent.health;
          continue;
        }
      }
      state.agents.push(agent);
    }
    if (saved.version < 3 && state.agents.some(agent => agent.health > 0)) populate();
  } else populate();

  function idle(agent, duration) {
    if (agent.mode !== "idle") agent.animationStartedAt = environment.simSeconds;
    agent.mode = "idle";
    agent.nextActionAt = environment.simSeconds + duration;
  }

  function dropCorpse(agent) {
    for (let radius = 0; radius <= 3; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = agent.x + dx, y = agent.y + dy, key = x + "," + y;
          if (!walkable(x, y) || environment.food.get(key)?.amount > 0) continue;
          environment.food.set(key, { x, y, kind: "corpse", species, amount: 4, attributes: {} });
          return;
        }
      }
    }
  }

  function removeDead() {
    for (const agent of state.agents) if (agent.health <= 0) dropCorpse(agent);
    state.agents = state.agents.filter(agent => agent.health > 0);
  }

  function neighbors(x, y) {
    return [{ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }].filter(cell => walkable(cell.x, cell.y));
  }

  function stepToward(agent, goal, reach) {
    const visited = new Set([agent.x + "," + agent.y]);
    const queue = [{ x: agent.x, y: agent.y, first: null }];
    for (let index = 0; index < queue.length && index < 192; index++) {
      const current = queue[index];
      if (current.first && Math.abs(current.x - goal.x) + Math.abs(current.y - goal.y) <= reach) return current.first;
      for (const cell of neighbors(current.x, current.y)) {
        const key = cell.x + "," + cell.y;
        if (visited.has(key) || Math.hypot(cell.x - agent.homeX, cell.y - agent.homeY) > 8 || occupied(cell.x, cell.y, agent)) continue;
        visited.add(key);
        queue.push({ ...cell, first: current.first || cell });
      }
    }
    return null;
  }

  function move(agent, destination) {
    agent.renderFromX = agent.x;
    agent.renderFromY = agent.y;
    if (destination.x !== agent.x) agent.facing = destination.x > agent.x ? 1 : -1;
    agent.x = destination.x;
    agent.y = destination.y;
    agent.moveStartedAt = environment.simSeconds;
    agent.moveDuration = 1.28;
    agent.animationStartedAt = environment.simSeconds;
    agent.mode = "walk";
    agent.stepCount++;
  }

  function tick() {
    removeDead();
    const now = environment.simSeconds;
    const opponents = players();
    for (const agent of state.agents) {
      if (agent.mode === "attack") {
        if (!agent.attackHit && now >= agent.attackStartedAt + 0.52) {
          agent.attackHit = true;
          const target = opponents.find(entry => entry.agent.id === agent.attackTargetId);
          if (target && target.agent.health > 0 && Math.abs(agent.x - target.agent.x) + Math.abs(agent.y - target.agent.y) <= 1) {
            target.game.receiveDamage(target.agent, agent.stats.attack);
          }
        }
        if (now < agent.attackStartedAt + 1.28) continue;
        idle(agent, 0.8);
      }
      if (now < agent.moveStartedAt + agent.moveDuration) continue;
      const target = opponents.filter(entry => entry.agent.health > 0 && walkable(entry.agent.x, entry.agent.y) &&
        Math.hypot(entry.agent.x - agent.homeX, entry.agent.y - agent.homeY) <= 8)
        .map(entry => ({ ...entry, distance: Math.abs(agent.x - entry.agent.x) + Math.abs(agent.y - entry.agent.y) }))
        .filter(entry => entry.distance <= agent.stats.vision)
        .sort((left, right) => left.distance - right.distance)[0];
      if (target) {
        if (target.distance <= 1) {
          if (now < agent.attackReadyAt) { idle(agent, agent.attackReadyAt - now); continue; }
          agent.mode = "attack";
          agent.attackStartedAt = now;
          agent.animationStartedAt = now;
          agent.attackTargetId = target.agent.id;
          agent.attackHit = false;
          agent.attackReadyAt = now + 2.08;
          if (target.agent.x !== agent.x) agent.facing = target.agent.x > agent.x ? 1 : -1;
          continue;
        }
        const destination = stepToward(agent, target.agent, 1);
        if (destination) move(agent, destination);
        else idle(agent, 0.5);
        continue;
      }
      if (agent.mode === "walk") idle(agent, 1.3 + noise(agent.stepCount, agent.homeX) * 2);
      if (now < agent.nextActionAt) continue;
      if (Math.hypot(agent.x - agent.homeX, agent.y - agent.homeY) > 4) {
        const destination = stepToward(agent, { x: agent.homeX, y: agent.homeY }, 0);
        if (destination) move(agent, destination);
        else idle(agent, 1);
        continue;
      }
      const destinations = neighbors(agent.x, agent.y).filter(cell => !occupied(cell.x, cell.y, agent) && Math.hypot(cell.x - agent.homeX, cell.y - agent.homeY) <= 5);
      if (destinations.length) move(agent, destinations[Math.floor(noise(agent.stepCount + 41, agent.homeY) * destinations.length) % destinations.length]);
      else idle(agent, 1);
    }
    removeDead();
  }

  return { tick, save: () => state, get agents() { return state.agents; } };
}
