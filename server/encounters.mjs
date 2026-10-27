import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { unitTerrainSpeedMultiplier } from "./attributes.mjs";
import { CORPSE_LIFETIME, placeCorpse } from "./lifespan.mjs";
import { createCombat, canPursueCombat } from "./combat.mjs";
import { unitCombatStats, migrateCombatStats } from "./combat-stats.mjs";

export function createEncounters(environment, saved, residents) {
  const combat = environment.combatSystem || (environment.combatSystem = createCombat(environment));
  const size = 320;
  const types = new Map(ENCOUNTER_TYPES.map(type => [type.key, type]));
  const plans = new Map((environment.world.encounters || []).filter(plan => types.has(plan.key)).map(plan => [plan.key, plan]));
  const memberships = new Map([...plans].map(([key, plan]) => [key, new Set(plan.cells)]));
  const waterDistance = new Uint8Array(size * size).fill(255);
  if ([...plans.values()].some(plan => plan.nearWater)) {
    const queue = new Int32Array(size * size);
    let head = 0, tail = 0;
    for (let index = 0; index < waterDistance.length; index++) if (environment.world.terrain[index] < 2) {
      waterDistance[index] = 0; queue[tail++] = index;
    }
    while (head < tail) {
      const index = queue[head++];
      if (waterDistance[index] >= 6) continue;
      const x = index % size, y = Math.floor(index / size);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const next = ny * size + nx;
        if (waterDistance[next] <= waterDistance[index] + 1) continue;
        waterDistance[next] = waterDistance[index] + 1; queue[tail++] = next;
      }
    }
  }
  const state = saved || { version: 1, agents: [], records: [...plans].map(([key, plan]) => ({ key, x: plan.x, y: plan.y,
    homeId: plan.homeId, spawned: false, dead: false, sequence: 0, missingSince: null, nextSpawnAt: null, warningUntil: null })), kills: {} };
  if (state.version !== 1 || !Array.isArray(state.agents) || !Array.isArray(state.records) || state.records.length !== plans.size ||
      new Set(state.records.map(record => record.key)).size !== plans.size || !state.kills) throw new Error("중립 유닛 저장 형식이 올바르지 않습니다.");
  for (const record of state.records) if (!plans.has(record.key) || !Number.isInteger(record.x) || !Number.isInteger(record.y) ||
      record.x < 0 || record.y < 0 || record.x >= size || record.y >= size || !Number.isSafeInteger(record.sequence) || record.sequence < 0 ||
      [record.nextSpawnAt, record.warningUntil, record.missingSince].some(value => value !== null && (!Number.isFinite(value) || value < 0))) throw new Error("중립 유닛 등장 기록이 올바르지 않습니다.");
  for (const agent of state.agents) if (!plans.has(agent.species) || !Number.isInteger(agent.x) || !Number.isInteger(agent.y) ||
      agent.x < 0 || agent.y < 0 || agent.x >= size || agent.y >= size || !Number.isFinite(agent.health) || agent.health <= 0 ||
      !Number.isFinite(agent.moveStartedAt) || !Number.isFinite(agent.nextActionAt)) throw new Error("중립 유닛 상태가 올바르지 않습니다.");

  for (const agent of state.agents) migrateCombatStats(agent);

  function players() {
    return [...environment.games.values()].flatMap(game => game.agents.filter(agent => agent.health > 0).map(agent => ({ game, agent })));
  }

  function valid(x, y) {
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    const index = y * size + x;
    return environment.world.terrain[index] >= 2 && environment.world.terrain[index] <= 9 && !environment.world.hazards[index] &&
      !environment.colonies.some(colony => Math.hypot(x - colony.x - 2, y - colony.y - 2) < 10) && !environment.creatureSystem?.burrowAt(x, y);
  }

  function occupied(x, y, excluded) {
    return players().some(entry => entry.agent.x === x && entry.agent.y === y) ||
      (environment.creatureSystem?.agents || [...(residents || []), ...state.agents]).some(agent => agent !== excluded && agent.health > 0 && agent.x === x && agent.y === y);
  }

  function spawnHabitat(plan, x, y) {
    const index = y * size + x;
    return valid(x, y) && plan.terrains.includes(environment.world.terrain[index]) && (!plan.nearWater || waterDistance[index] <= 6) &&
      environment.colonies.every(colony => Math.hypot(x - colony.x - 2, y - colony.y - 2) >= plan.safeRadius);
  }

  function visible(x, y) {
    return [...environment.games.values()].some(game => game.isVisible(x, y));
  }

  function relocate(record, plan) {
    if (!record.homeId) return;
    const home = environment.creatureSystem?.burrows.find(burrow => burrow.id === record.homeId);
    if (!home || home.health > 0) return;
    const alternatives = environment.creatureSystem.burrows.filter(burrow => burrow.health > 0 && burrow.type === "large" &&
      spawnHabitat(plan, burrow.entrance.x, burrow.entrance.y));
    const replacement = alternatives.sort((left, right) => Math.hypot(left.x - record.x, left.y - record.y) - Math.hypot(right.x - record.x, right.y - record.y))[0];
    if (replacement) { record.x = replacement.entrance.x; record.y = replacement.entrance.y; record.homeId = replacement.id; updateMembership(record); return; }
    for (const index of plan.cells) if (spawnHabitat(plan, index % size, Math.floor(index / size))) {
      record.x = index % size; record.y = Math.floor(index / size); record.homeId = null; updateMembership(record); return;
    }
  }

  function updateMembership(record) {
    const plan = plans.get(record.key);
    if (plan.spawnPoints) return;
    if (record.x === plan.x && record.y === plan.y) return;
    const first = record.y * size + record.x, cells = new Set([first]), queue = [{ index: first, distance: 0 }];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const cell = queue[cursor];
      if (cell.distance >= plan.radius) continue;
      for (const index of neighbors(cell.index)) {
        if (cells.has(index) || environment.colonies.some(colony => Math.hypot(index % size - colony.x - 2, Math.floor(index / size) - colony.y - 2) < plan.safeRadius)) continue;
        cells.add(index); queue.push({ index, distance: cell.distance + 1 });
      }
    }
    memberships.set(record.key, cells);
  }

  function spawn(record, initial) {
    const plan = plans.get(record.key), type = types.get(record.key), combatStats = unitCombatStats(record.key);
    const candidates = (plan.spawnPoints || [record.y * size + record.x, ...memberships.get(record.key)]).filter(index => spawnHabitat(plan, index % size, Math.floor(index / size)) &&
      !(environment.food.get(index % size + "," + Math.floor(index / size))?.amount > 0) &&
      !occupied(index % size, Math.floor(index / size), null) && (initial || !visible(index % size, Math.floor(index / size))));
    if (!candidates.length) return false;
    if (!plan.spawnPoints) candidates.sort((left, right) => Math.hypot(left % size - record.x, Math.floor(left / size) - record.y) -
      Math.hypot(right % size - record.x, Math.floor(right / size) - record.y) || left - right);
    const index = candidates[0], x = index % size, y = Math.floor(index / size);
    record.sequence++;
    state.agents.push({ id: "encounter:" + record.key + ":" + record.sequence, species: record.key, name: type.name,
      faction: type.hostile ? "hostile" : "neutral", movementType: type.flying ? "flying" : "ground", encounterKey: record.key,
      x, y, homeX: plan.spawnPoints ? x : record.x, homeY: plan.spawnPoints ? y : record.y, health: combatStats.health, stats: { ...combatStats, attack: 1, speed: .5, vision: plan.radius, resistance: 1 },
      attributes: {}, carrying: 0, renderFromX: x, renderFromY: y, moveStartedAt: environment.simSeconds, moveDuration: 0,
      mode: "idle", nextActionAt: environment.simSeconds, animationStartedAt: environment.simSeconds, facing: 1, stepCount: 0,
      hidden: ["soil-mole", "bubble-toad"].includes(record.key), hiddenUntil: 0, routeCursor: 0, routeDirection: 1,
      attackReadyAt: 0, warningUntil: null, hurtStartedAt: -10 });
    record.spawned = true;
    return true;
  }

  function discovered(key) {
    return [...environment.games.values()].some(game => game.discoveredKinds.has("creature:" + key));
  }

  function eligible(record, type) {
    const now = environment.simSeconds;
    if (!type.unique) return now >= type.firstSpawnAt;
    if (now >= type.guaranteedAt) return true;
    if (type.key === "spring-keeper") return discovered("flower-tail-bird") && [...environment.games.values()].reduce((sum, game) => sum + game.colonyFood, 0) >= 10;
    if (type.key === "lantern-keeper") {
      const plan = plans.get(type.key), points = plan.spawnPoints || [record.y * size + record.x];
      if (record.warningUntil === null && players().some(({ agent }) => agent.attributes.antenna > 0 && points.some(index =>
        Math.hypot(agent.x - index % size, agent.y - Math.floor(index / size)) <= plan.radius))) record.warningUntil = now + 30;
      return record.warningUntil !== null && now >= record.warningUntil;
    }
    if (type.key === "old-garden-snail") return now >= 360;
    if (type.key === "walking-forest") return now >= 480 && discovered("vine-turtle");
    if (type.key === "white-paw") return now >= 480 && (state.kills["shadow-weasel"] || 0) > 0;
    return now >= 600 && (environment.creatureSystem?.burrows || []).some(burrow => burrow.type === "large" && burrow.raidSequence > 0);
  }

  function populate() {
    const now = environment.simSeconds;
    for (const record of state.records) {
      const type = types.get(record.key), plan = plans.get(record.key);
      if (record.dead || !eligible(record, type)) continue;
      if (type.unique && !record.spawned) relocate(record, plan);
      const living = state.agents.filter(agent => agent.species === record.key && agent.health > 0).length;
      const populationLimit = plan.populationLimit ?? type.populationLimit;
      if (!record.spawned || record.sequence < populationLimit) {
        for (let count = living; count < populationLimit; count++) if (!spawn(record, true)) break;
      } else if (!type.unique && living < populationLimit) {
        if (record.missingSince === null) { record.missingSince = now; record.nextSpawnAt = now + type.respawnSeconds; }
        if (now >= record.nextSpawnAt && spawn(record, false)) {
          record.nextSpawnAt += type.respawnSeconds;
          if (living + 1 >= populationLimit) { record.missingSince = null; record.nextSpawnAt = null; }
        }
      }
    }
  }

  function neighbors(index) {
    const x = index % size, y = Math.floor(index / size);
    return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([cx, cy]) => valid(cx, cy)).map(([cx, cy]) => cy * size + cx);
  }

  function step(agent, target, reach) {
    const membership = memberships.get(agent.species), start = agent.y * size + agent.x;
    const queue = [start], parent = new Map([[start, -1]]);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      if (index !== start && Math.abs(index % size - target.x) + Math.abs(Math.floor(index / size) - target.y) <= reach) {
        let next = index;
        while (parent.get(next) !== start) next = parent.get(next);
        return next;
      }
      for (const next of neighbors(index)) if (!parent.has(next) && membership.has(next) && (!occupied(next % size, Math.floor(next / size), agent) ||
          reach === 0 && next % size === target.x && Math.floor(next / size) === target.y)) {
        parent.set(next, index); queue.push(next);
      }
    }
    return null;
  }

  function move(agent, index) {
    agent.renderFromX = agent.x; agent.renderFromY = agent.y;
    agent.x = index % size; agent.y = Math.floor(index / size);
    if (agent.x !== agent.renderFromX) agent.facing = agent.x > agent.renderFromX ? 1 : -1;
    agent.moveStartedAt = environment.simSeconds;
    agent.moveDuration = 2 / unitTerrainSpeedMultiplier(agent, environment.world.terrain[index]);
    agent.nextActionAt = environment.simSeconds + agent.moveDuration;
    agent.mode = "walk"; agent.stepCount++;
  }

  function tick() {
    populate();
    const now = environment.simSeconds, nearby = players();
    for (const agent of [...state.agents]) {
      if (agent.health <= 0 || combat.update(agent, now)) continue;
      if (now < agent.nextActionAt) continue;
      const plan = plans.get(agent.species), type = types.get(agent.species), membership = memberships.get(agent.species);
      const targets = nearby.map(entry => ({ ...entry, distance: Math.hypot(agent.x - entry.agent.x, agent.y - entry.agent.y) }))
        .filter(entry => entry.distance <= plan.radius && membership.has(entry.agent.y * size + entry.agent.x)).sort((left, right) => left.distance - right.distance);
      const target = targets[0];
      agent.mode = "idle";
      if (!target) agent.warningUntil = null;
      if (agent.species === "white-paw" && agent.health < agent.stats.health / 2) {
        const next = step(agent, { x: agent.homeX, y: agent.homeY }, 0);
        if (next !== null) move(agent, next); else agent.nextActionAt = now + 2;
        continue;
      }
      if (agent.species === "walking-forest" && agent.stepCount > 0 && agent.stepCount % 4 === 0 && agent.restedStep !== agent.stepCount) {
        agent.restedStep = agent.stepCount;
        agent.nextActionAt = now + 2;
        continue;
      }
      agent.hidden = agent.species === "soil-mole" ? !targets.some(entry => ["gather", "harvest", "prepare"].includes(entry.agent.mode)) :
        agent.species === "bubble-toad" ? !target : agent.species === "dew-rabbit" ? !!target && target.distance <= 2 : false;
      if (agent.hidden) { agent.nextActionAt = now + 1; continue; }
      if (type.hostile && target && canPursueCombat(agent, target.agent, now)) {
        if (agent.species === "soil-boar" && agent.warningUntil === null) { agent.warningUntil = now + 1; agent.nextActionAt = agent.warningUntil; continue; }
        const next = agent.species === "snare-vine" ? null : step(agent, target.agent, 0);
        if (next !== null) { move(agent, next); continue; }
      }
      if (["snare-vine", "soil-mole", "bubble-toad"].includes(agent.species) || ["talon-owl", "rolling-acorn"].includes(agent.species) && !target) {
        const next = agent.species === "talon-owl" && (agent.x !== agent.homeX || agent.y !== agent.homeY) ? step(agent, { x: agent.homeX, y: agent.homeY }, 0) : null;
        if (next !== null) move(agent, next); else agent.nextActionAt = now + 1;
        continue;
      }
      if (plan.route.length) {
        const index = plan.route[agent.routeCursor];
        if (agent.x === index % size && agent.y === Math.floor(index / size)) {
          if (agent.routeCursor + agent.routeDirection >= plan.route.length || agent.routeCursor + agent.routeDirection < 0) agent.routeDirection *= -1;
          agent.routeCursor = Math.max(0, Math.min(plan.route.length - 1, agent.routeCursor + agent.routeDirection));
        }
        const destination = plan.route[agent.routeCursor], next = step(agent, { x: destination % size, y: Math.floor(destination / size) }, 0);
        if (next !== null) move(agent, next); else agent.nextActionAt = now + 1;
        continue;
      }
      const options = neighbors(agent.y * size + agent.x).filter(index => membership.has(index) && !occupied(index % size, Math.floor(index / size), agent));
      if (target && !type.hostile) options.sort((left, right) => Math.hypot(right % size - target.agent.x, Math.floor(right / size) - target.agent.y) -
        Math.hypot(left % size - target.agent.x, Math.floor(left / size) - target.agent.y));
      const index = options.length ? target && !type.hostile ? options[0] : options[(agent.stepCount + agent.homeX + agent.homeY) % options.length] : null;
      if (index !== null) move(agent, index); else agent.nextActionAt = now + 1;
    }
  }

  function receiveDamage(agent, amount) {
    if (!state.agents.includes(agent) || amount <= 0 || !Number.isFinite(amount)) return;
    agent.health = Math.max(0, agent.health - amount);
    agent.hurtStartedAt = environment.simSeconds;
    if (agent.health > 0) return;
    const record = state.records.find(entry => entry.key === agent.species), type = types.get(agent.species);
    state.kills[agent.species] = (state.kills[agent.species] || 0) + 1;
    if (type.unique) record.dead = record.sequence >= (plans.get(agent.species).populationLimit ?? type.populationLimit) &&
      !state.agents.some(entry => entry.species === agent.species && entry.health > 0);
    else if (record.missingSince === null) { record.missingSince = environment.simSeconds; record.nextSpawnAt = environment.simSeconds + type.respawnSeconds; }
    state.agents = state.agents.filter(entry => entry !== agent);
    placeCorpse(environment.food, { x: agent.x, y: agent.y, agentId: agent.id, kind: "corpse", species: agent.species, amount: 4,
      carapaceAmount: ["spiny-back-beetle", "spiny-back-leader"].includes(agent.species) ? 4 : 0, attributes: {}, facing: agent.facing,
      diedAt: environment.simSeconds, decaysAt: environment.simSeconds + CORPSE_LIFETIME, renderX: agent.x, renderY: agent.y });
  }

  for (const record of state.records) updateMembership(record);
  if (!saved) populate();
  return { tick, receiveDamage, save: () => state, get agents() { return state.agents; },
    get signals() {
      const signals = state.records.filter(record => record.warningUntil !== null && !record.spawned && !record.dead)
        .map(record => ({ key: record.key, kind: "light", x: record.x, y: record.y, until: record.warningUntil }));
      for (const record of state.records) {
        if (record.dead) continue;
        const agent = state.agents.find(agent => agent.species === record.key);
        if (record.key === "soil-mole" || record.key === "bubble-toad" || record.key === "shadow-weasel" || record.key === "white-paw") {
          signals.push({ key: record.key, kind: record.key === "soil-mole" ? "mound" : "tracks", x: agent?.x ?? record.x, y: agent?.y ?? record.y });
        }
      }
      return signals;
    } };
}
