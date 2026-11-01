import { worldSize } from "./world-size.mjs";
import { beginCreatureSpawn, creatureSpawning } from "./creature-spawn.mjs";
import { createEncounters } from "./encounters.mjs";
import { ENCOUNTER_ASSETS } from "./encounter-types.mjs";
import { BEETLE_ANIMATIONS, BEETLE_ANIMATION_ASSET, BEETLE_ATTACK_ASSET, BEETLE_NEUTRAL_ASSET } from "./beetle-animation.mjs";
import { CREATURE_MOVEMENT, applyCreatureMovement, creatureMoveDuration, finishCreatureMove } from "./creature-movement.mjs";
import { BURROW_TYPES, burrowDistance, burrowApproaches } from "./burrows.mjs";
import { BEETLE_RAIDS, createBeetleRaids } from "./raids.mjs";
import { CORPSE_LIFETIME, placeCorpse, expireCorpses } from "./lifespan.mjs";
import { createCombat, canPursueCombat, combatDisposition } from "./combat.mjs";
import { unitCombatStats, migrateCombatStats } from "./combat-stats.mjs";
import { buildingAt } from "./buildings.mjs";
import { creatureBuildingTargets, compareCreatureCombatTargets, updateCreatureBuildingAttack } from "./creature-combat.mjs";

export const CREATURE_ASSETS = [
  ...ENCOUNTER_ASSETS, "DesignAssets/Units/spiny-back-beetle.png", BEETLE_ANIMATION_ASSET, BEETLE_ATTACK_ASSET, BEETLE_NEUTRAL_ASSET
];

export function createCreatures(environment, saved) {
  const combat = environment.combatSystem || (environment.combatSystem = createCombat(environment));
  const size = worldSize(environment.world);
  let encounters = null;
  let initializing = true;
  const species = "spiny-back-beetle";
  const stats = { ...unitCombatStats(species), attack: 3, speed: CREATURE_MOVEMENT[species].speed, vision: 4, resistance: 1 };
  const burrows = environment.world.burrows || [];
  const distribution = environment.world.encounters?.find(plan => plan.key === species && plan.spawnPoints);
  const burrowSites = new Map(burrows.map(burrow => [burrow.id, burrow]));
  const state = { version: 5, agents: [], burrows: burrows.map(burrow => ({ id: burrow.id,
    health: BURROW_TYPES[burrow.type].health, nextSpawnAt: environment.simSeconds + BURROW_TYPES[burrow.type].spawnInterval, spawnCount: 0 })) };
  const burrowRecords = new Map(state.burrows.map(record => [record.id, record])), burrowCells = new Map();
  for (const burrow of burrows) for (let y = burrow.y; y < burrow.y + burrow.height; y++) {
    for (let x = burrow.x; x < burrow.x + burrow.width; x++) burrowCells.set(y * size + x, burrow.id);
  }

  function burrowAt(x, y) {
    const id = burrowCells.get(y * size + x);
    return burrowRecords.get(id)?.health > 0 ? burrowSites.get(id) : null;
  }

  function receiveBurrowDamage(id, amount) {
    const record = burrowRecords.get(id);
    if (!record || record.health <= 0 || !Number.isFinite(amount) || amount <= 0) return record?.health;
    record.health = Math.max(0, record.health - amount);
    environment.targetRevision = (environment.targetRevision || 0) + 1;
    return record.health;
  }

  function noise(x, y) {
    let value = Math.imul(x + (environment.seed || environment.world.seed || 0), 374761393) ^ Math.imul(y, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  }

  function walkable(x, y, raiding) {
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    const terrain = environment.world.terrain[y * size + x];
    if (terrain < 2 || terrain > 10) return false;
    if (burrowAt(x, y) || buildingAt(environment, x, y)) return false;
    if (!raiding && environment.world.sites.some(site => Math.hypot(x - site[0], y - site[1]) < (environment.world.generationVersion >= 6 ? 10 : 18))) return false;
    return !environment.colonies.some(colony => environment.games.get(colony.ownerId)?.nest?.health !== 0 && colony.occupiedCells.has((x - colony.x) + "," + (y - colony.y)));
  }

  function players() {
    return [...environment.games.values()].flatMap(game => game.agents.filter(agent => agent.health > 0).map(agent => ({ game, agent })));
  }

  function occupied(x, y, excluded) {
    if (environment.unitIndex) return environment.unitIndex.occupied(x, y, excluded, true);
    return [...state.agents, ...(encounters?.agents || []), ...players().map(entry => entry.agent)].some(agent => agent !== excluded && agent.health > 0 &&
      (agent.x === x && agent.y === y || environment.simSeconds - agent.moveStartedAt < agent.moveDuration && agent.renderFromX === x && agent.renderFromY === y));
  }

  function spawnAt(x, y, id, burrow) {
    const agent = { id, species, name: "가시등벌레", faction: "hostile",
      x, y, burrowId: burrow?.id || null, homeX: burrow ? burrow.entrance.x : x, homeY: burrow ? burrow.entrance.y : y,
      health: stats.health, cost: 8, carrying: 0, attributes: {},
      stats: { ...stats },
      renderFromX: x, renderFromY: y, moveStartedAt: environment.simSeconds, moveDuration: 0,
      mode: "idle", animationStartedAt: environment.simSeconds, facing: -1, stepCount: 0,
      nextActionAt: environment.simSeconds + 1.5 + noise(x, y) * 2, attackStartedAt: -10,
      hurtStartedAt: -10, deathStartedAt: null,
      attackTargetId: null, attackHit: false, attackReadyAt: 0 };
    state.agents.push(agent);
    environment.unitIndex?.update(agent, null);
    return agent;
  }

  function spawnFromBurrow(record) {
    const burrow = burrowSites.get(record.id), entrance = burrow.entrance;
    if (burrow.creature?.unique) return null;
    const queue = [entrance], visited = new Set([entrance.x + "," + entrance.y]);
    for (let index = 0; index < queue.length; index++) {
      const cell = queue[index];
      if (!walkable(cell.x, cell.y) || environment.world.hazards?.[cell.y * size + cell.x]) continue;
      if (!occupied(cell.x, cell.y, null) && !(environment.food.get(cell.x + "," + cell.y)?.amount > 0)) {
        let id;
        do { record.spawnCount++; id = "beetle:" + record.id + ":" + record.spawnCount; }
        while (state.agents.some(agent => agent.id === id));
        const agent = spawnAt(cell.x, cell.y, id, burrow);
        if (!initializing) beginCreatureSpawn(agent, environment.simSeconds, "burrow", { x: entrance.x, y: entrance.y - .95 });
        return agent;
      }
      for (const next of neighbors(cell.x, cell.y)) {
        const key = next.x + "," + next.y;
        if (visited.has(key) || Math.abs(next.x - entrance.x) + Math.abs(next.y - entrance.y) > 3) continue;
        visited.add(key); queue.push(next);
      }
    }
    return null;
  }

  function growBurrows() {
    const living = new Map(), residents = new Map();
    let ambient = 0;
    for (const agent of state.agents) if (agent.health > 0) {
      living.set(agent.burrowId, (living.get(agent.burrowId) || 0) + 1);
      if (!agent.raid) residents.set(agent.burrowId, (residents.get(agent.burrowId) || 0) + 1);
      if (!raids.sourceIds.has(agent.burrowId)) ambient++;
    }
    for (const record of state.burrows) {
      if (record.health <= 0 || environment.simSeconds + 1e-8 < record.nextSpawnAt) continue;
      const type = BURROW_TYPES[burrowSites.get(record.id).type];
      const periods = Math.floor((environment.simSeconds + 1e-8 - record.nextSpawnAt) / type.spawnInterval) + 1;
      record.nextSpawnAt += periods * type.spawnInterval;
      const reserve = distribution && raids.sourceIds.has(record.id);
      const count = (reserve ? residents : living).get(record.id) || 0, births = Math.min(periods,
        (reserve ? BEETLE_RAIDS.defenders + 1 : type.populationLimit) - count,
        distribution && !reserve ? Math.max(0, distribution.populationLimit - ambient) : Infinity);
      for (let index = 0; index < births; index++) {
        if (!spawnFromBurrow(record)) break;
        if (!reserve) ambient++;
      }
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
    return spawnAt(destination.x, destination.y, agent.id, null);
  }

  if ([1, 2, 3, 4, 5].includes(saved?.version) && Array.isArray(saved.agents)) {
    if (saved.version >= 4) {
      if (!Array.isArray(saved.burrows) || saved.burrows.length !== burrows.length ||
          new Set(saved.burrows.map(record => record?.id)).size !== burrows.length) throw new Error("굴 저장 형식이 올바르지 않습니다.");
      for (const record of saved.burrows) {
        const burrow = burrowSites.get(record?.id), type = burrow && BURROW_TYPES[burrow.type];
        if (!type || !Number.isFinite(record.health) || record.health < 0 || record.health > type.health ||
            !Number.isFinite(record.nextSpawnAt) || record.nextSpawnAt < 0 ||
            !Number.isSafeInteger(record.spawnCount) || record.spawnCount < 0) throw new Error("굴 저장 형식이 올바르지 않습니다.");
      }
      state.burrows = saved.burrows;
      burrowRecords.clear();
      for (const record of state.burrows) burrowRecords.set(record.id, record);
      if (saved.version === 5) state.raidCooldowns = saved.raidCooldowns;
    }
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
    if (saved.version < 4) {
      for (const agent of state.agents) {
        const nearest = burrowSites.get(agent.burrowId) || burrows.reduce((nearest, burrow) => !nearest ||
          Math.hypot(agent.homeX - burrow.entrance.x, agent.homeY - burrow.entrance.y) <
          Math.hypot(agent.homeX - nearest.entrance.x, agent.homeY - nearest.entrance.y) ? burrow : nearest, null);
        agent.burrowId = nearest?.id || null;
        if (!nearest) continue;
        const prefix = "beetle:" + nearest.id + ":", number = agent.id.startsWith(prefix) ? Number(agent.id.slice(prefix.length)) : 0;
        const record = state.burrows.find(record => record.id === nearest.id);
        if (Number.isSafeInteger(number)) record.spawnCount = Math.max(record.spawnCount, number);
      }
    }
  } else if (distribution) {
    for (const index of distribution.spawnPoints) {
      const x = index % size, y = Math.floor(index / size);
      const home = burrows.reduce((nearest, burrow) => !nearest ||
        Math.hypot(x - burrow.entrance.x, y - burrow.entrance.y) < Math.hypot(x - nearest.entrance.x, y - nearest.entrance.y) ? burrow : nearest, null);
      if (!home) continue;
      const record = burrowRecords.get(home.id);
      record.spawnCount++;
      const agent = spawnAt(x, y, "beetle:" + home.id + ":" + record.spawnCount, home);
      agent.homeX = x; agent.homeY = y;
    }
  } else {
    for (const record of state.burrows) {
      const type = BURROW_TYPES[burrowSites.get(record.id).type];
      for (let index = 0; index < type.initialCount; index++) if (!spawnFromBurrow(record)) break;
    }
  }

  for (const agent of state.agents) {
    migrateCombatStats(agent);
    applyCreatureMovement(agent);
  }

  function reinforce(record) {
    if (!distribution || saved) return;
    const count = state.agents.filter(agent => agent.health > 0 && agent.burrowId === record.id && !agent.raid).length;
    for (let index = count; index < BEETLE_RAIDS.defenders + 1; index++) if (!spawnFromBurrow(record)) break;
  }
  const raids = createBeetleRaids(environment, state, { walkable, occupied, noise, move, idle, reinforce,
    stepSeconds:1 / stats.speed, restSeconds:CREATURE_MOVEMENT[species].restSeconds, release: combat.release }, saved?.version === 5);

  function idle(agent, duration) {
    if (agent.mode !== "idle") agent.animationStartedAt = environment.simSeconds;
    agent.mode = "idle";
    agent.nextActionAt = environment.simSeconds + duration;
  }

  function beginDeath(agent) {
    const progress = agent.moveDuration ? Math.max(0, Math.min(1,
      (environment.simSeconds - agent.moveStartedAt) / agent.moveDuration)) : 1;
    agent.deathRenderX = agent.renderFromX + (agent.x - agent.renderFromX) * progress;
    agent.deathRenderY = agent.renderFromY + (agent.y - agent.renderFromY) * progress;
    agent.deathStartedAt = environment.simSeconds;
    agent.animationStartedAt = environment.simSeconds;
    agent.mode = "death";
    agent.attackHit = true;
    agent.attackTargetId = null;
  }

  encounters = createEncounters(environment, saved?.encounters, state.agents);

  function receiveDamage(agent, amount) {
    if (!state.agents.includes(agent)) { encounters.receiveDamage(agent, amount); return; }
    if (!state.agents.includes(agent) || agent.health <= 0 || amount <= 0) return;
    agent.health = Math.max(0, agent.health - amount);
    agent.hurtStartedAt = environment.simSeconds;
    agent.hurtCount = (agent.hurtCount || 0) + 1;
    if (agent.health <= 0) beginDeath(agent);
  }

  function dropCorpse(agent) {
    placeCorpse(environment.food, { x: agent.x, y: agent.y, kind: "corpse", species, amount: 4, attributes: {}, facing: agent.facing,
      agentId: agent.id, hurtStartedAt: agent.hurtStartedAt, hurtCount: agent.hurtCount,
      diedAt: agent.deathStartedAt, decaysAt: agent.deathStartedAt + CORPSE_LIFETIME,
      renderX: agent.deathRenderX, renderY: agent.deathRenderY });
  }

  function removeDead() {
    for (const agent of state.agents) {
      if (agent.health > 0) continue;
      if (!Number.isFinite(agent.deathStartedAt)) beginDeath(agent);
      if ((environment.simSeconds - agent.deathStartedAt) * 1000 + 1e-6 >= BEETLE_ANIMATIONS.death.durationMs) dropCorpse(agent);
    }
    state.agents = state.agents.filter(agent => {
      const keep = agent.health > 0 || (environment.simSeconds - agent.deathStartedAt) * 1000 + 1e-6 < BEETLE_ANIMATIONS.death.durationMs;
      if (!keep) environment.unitIndex?.remove(agent);
      return keep;
    });
  }

  function neighbors(x, y, raiding) {
    return [{ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }].filter(cell => walkable(cell.x, cell.y, raiding));
  }

  function stepToward(agent, goal, reach) {
    const home = raids.home(agent);
    const visited = new Set([agent.x + "," + agent.y]);
    const queue = [{ x: agent.x, y: agent.y, first: null }];
    for (let index = 0; index < queue.length && index < 192; index++) {
      const current = queue[index];
      if (current.first && Math.abs(current.x - goal.x) + Math.abs(current.y - goal.y) <= reach) return current.first;
      for (const cell of neighbors(current.x, current.y, Boolean(agent.raid))) {
        const key = cell.x + "," + cell.y;
        if (visited.has(key) || occupied(cell.x, cell.y, agent) && !(reach === 0 && cell.x === goal.x && cell.y === goal.y) ||
            Math.hypot(cell.x - home.x, cell.y - home.y) > 8) continue;
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
    agent.moveDuration = creatureMoveDuration(agent, environment.world.terrain[agent.y * size + agent.x]);
    agent.nextActionAt = environment.simSeconds + agent.moveDuration + CREATURE_MOVEMENT[species].restSeconds;
    agent.animationStartedAt = environment.simSeconds;
    agent.mode = "walk";
    agent.stepCount++;
    environment.unitIndex?.update(agent);
  }

  function tick() {
    expireCorpses(environment.food, environment.simSeconds);
    removeDead();
    growBurrows();
    raids.dispatch();
    encounters.tick();
    const now = environment.simSeconds;
    const opponents = players(), buildings = creatureBuildingTargets(environment);
    for (const agent of state.agents) {
      if (agent.health <= 0 || creatureSpawning(agent, now)) continue;
      if (agent.mode === "spawn") { agent.mode = "idle"; agent.animationStartedAt = agent.spawn.readyAt; }
      finishCreatureMove(agent, now);
      if (raids.update(agent)) { agent.attack = null; continue; }
      if (combat.update(agent, now)) continue;
      if (now < agent.moveStartedAt + agent.moveDuration) continue;
      const home = raids.home(agent);
      const candidates = (environment.unitIndex ? environment.unitIndex.nearby(agent.x, agent.y, agent.stats.vision)
        .filter(entry => entry.game) : opponents).concat(buildings);
      const targets = candidates.filter(entry => entry.agent.health > 0 && raids.targetAllowed(agent, entry.game) &&
        (["nest", "building"].includes(entry.agent.kind) ? combatDisposition(agent) === "aggressive" && burrowDistance(home, entry.agent) <= 8 :
          canPursueCombat(agent, entry.agent, now) && !(entry.agent.birth && now < entry.agent.birth.readyAt) &&
          walkable(entry.agent.x, entry.agent.y, Boolean(agent.raid)) && Math.hypot(entry.agent.x - home.x, entry.agent.y - home.y) <= 8))
        .map(entry => ({ ...entry, distance: ["nest", "building"].includes(entry.agent.kind) ? burrowDistance(agent, entry.agent) :
          Math.abs(agent.x - entry.agent.x) + Math.abs(agent.y - entry.agent.y) }))
        .filter(entry => entry.distance <= agent.stats.vision).sort(compareCreatureCombatTargets);
      let target = null, destination = null;
      for (const candidate of targets) {
        if (["nest", "building"].includes(candidate.agent.kind)) {
          if (candidate.distance <= 1) { target = candidate; break; }
          const approaches = burrowApproaches(candidate.agent).filter(cell => walkable(cell.x, cell.y, Boolean(agent.raid)) &&
            !occupied(cell.x, cell.y, agent) && Math.hypot(cell.x - home.x, cell.y - home.y) <= 8)
            .sort((left, right) => Math.abs(agent.x - left.x) + Math.abs(agent.y - left.y) - Math.abs(agent.x - right.x) - Math.abs(agent.y - right.y));
          for (const approach of approaches) {
            destination = stepToward(agent, approach, 0);
            if (destination) break;
          }
        } else destination = stepToward(agent, candidate.agent, 0);
        if (destination || candidate.distance === 0) { target = candidate; break; }
      }
      if (updateCreatureBuildingAttack(agent, target, now)) continue;
      if (target) {
        if (destination) move(agent, destination);
        else idle(agent, .5);
        continue;
      }
      if (now < agent.nextActionAt) continue;
      if (Math.hypot(agent.x - home.x, agent.y - home.y) > 4) {
        const destination = stepToward(agent, home, agent.raid ? 3 : 0);
        if (destination) move(agent, destination);
        else idle(agent, 1);
        continue;
      }
      const destinations = neighbors(agent.x, agent.y, Boolean(agent.raid)).filter(cell => !occupied(cell.x, cell.y, agent) && Math.hypot(cell.x - home.x, cell.y - home.y) <= 5);
      if (destinations.length) move(agent, destinations[Math.floor(noise(agent.stepCount + 41, agent.homeY) * destinations.length) % destinations.length]);
      else idle(agent, 1);
    }
    removeDead();
  }

  initializing = false;
  return { tick, receiveDamage, receiveBurrowDamage, burrowAt, save: () => ({ ...state, encounters: encounters.save() }),
    get agents() { return [...state.agents, ...encounters.agents]; },
    get signals() { return encounters.signals; },
    get burrows() { return state.burrows.map(record => ({ ...burrowSites.get(record.id), kind: "burrow", health: record.health,
      experienceContributions: (record.experienceContributions ||= []),
      maxHealth: BURROW_TYPES[burrowSites.get(record.id).type].health })); } };
}
