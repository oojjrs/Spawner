import { CONQUEST_PACING } from "./conquest-pacing.mjs";
import { worldSize } from "./world-size.mjs";
import { beginCreatureSpawn, creatureSpawning } from "./creature-spawn.mjs";
import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { CREATURE_MOVEMENT, applyCreatureMovement, creatureMoveDuration, finishCreatureMove } from "./creature-movement.mjs";
import { CORPSE_LIFETIME, placeCorpse } from "./corpses.mjs";
import { createCombat, canPursueCombat, combatDisposition } from "./combat.mjs";
import { unitCombatStats, migrateCombatStats } from "./combat-stats.mjs";
import { burrowDistance, burrowApproaches } from "./burrows.mjs";
import { creatureNestTargets, compareCreatureCombatTargets, updateCreatureNestAttack } from "./creature-combat.mjs";
import { encounterTerritory, withinEncounterTerritory } from "./encounter-territory.mjs";

export function createEncounters(environment, saved, residents) {
  const combat = environment.combatSystem || (environment.combatSystem = createCombat(environment));
  const size = worldSize(environment.world);
  let initializing = true;
  const types = new Map(ENCOUNTER_TYPES.map(type => [type.key, type]));
  const plans = new Map((environment.world.encounters || []).filter(plan => types.has(plan.key)).map(plan => [plan.key, plan]));
  const memberships = new Map([...plans].map(([key, plan]) => [key, new Set(plan.cells)]));
  const regionPlans = new Map([...plans].map(([key, plan]) => [key,
    createRegions(plan, plan.populationLimit ?? types.get(key).populationLimit, types.get(key).unique)]));
  const waterDistance = new Uint8Array(size * size).fill(255);
  if ([...plans.values()].some(plan => plan.nearWater)) {
    const queue = new Int32Array(size * size);
    let head = 0, tail = 0;
    for (let index = 0; index < waterDistance.length; index++) if (environment.world.terrain[index] < 2 || environment.world.terrain[index] === 10) {
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
  const saveVersion = saved?.version ?? 3;
  const state = saved || { version: 3, agents: [], records: [...plans].map(([key, plan]) => ({ key, x: plan.x, y: plan.y,
    homeId: plan.homeId, spawned: false, dead: false, sequence: 0, missingSince: null, nextSpawnAt: null, warningUntil: null })), kills: {} };
  if (![1, 2, 3].includes(state.version) || !Array.isArray(state.agents) || !Array.isArray(state.records) || state.records.length !== plans.size ||
      new Set(state.records.map(record => record.key)).size !== plans.size || !state.kills) throw new Error("중립 유닛 저장 형식이 올바르지 않습니다.");
  for (const record of state.records) if (!plans.has(record.key) || !Number.isInteger(record.x) || !Number.isInteger(record.y) ||
      record.x < 0 || record.y < 0 || record.x >= size || record.y >= size || !Number.isSafeInteger(record.sequence) || record.sequence < 0 ||
      [record.nextSpawnAt, record.warningUntil, record.missingSince].some(value => value !== null && (!Number.isFinite(value) || value < 0))) throw new Error("중립 유닛 등장 기록이 올바르지 않습니다.");
  for (const agent of state.agents) if (!plans.has(agent.species) || !Number.isInteger(agent.x) || !Number.isInteger(agent.y) ||
      agent.x < 0 || agent.y < 0 || agent.x >= size || agent.y >= size || !Number.isFinite(agent.health) || agent.health <= 0 ||
      !Number.isFinite(agent.moveStartedAt) || !Number.isFinite(agent.nextActionAt)) throw new Error("중립 유닛 상태가 올바르지 않습니다.");

  for (const record of state.records) {
    const definitions = regionPlans.get(record.key), type = types.get(record.key),
      regionalSave = !!saved && (saveVersion >= 3 || saveVersion === 2 && !type.unique);
    if (type.unique && !plans.get(record.key).spawnPoints) { definitions[0].x = record.x; definitions[0].y = record.y; }
    if (!regionalSave) record.regions = definitions.map(region => ({ id: region.id, spawned: record.spawned,
      missingSince: null, nextSpawnAt: null }));
    if (!Array.isArray(record.regions) || record.regions.length !== definitions.length ||
        new Set(record.regions.map(region => region?.id)).size !== definitions.length || record.regions.some(region =>
          !definitions.some(definition => definition.id === region?.id) || typeof region.spawned !== "boolean" ||
          [region.missingSince, region.nextSpawnAt].some(value => value !== null && (!Number.isFinite(value) || value < 0)) ||
          (region.missingSince === null) !== (region.nextSpawnAt === null) ||
          region.nextSpawnAt !== null && region.nextSpawnAt < region.missingSince)) throw new Error("중립 유닛 지역 저장 형식이 올바르지 않습니다.");
    const counts = new Map(definitions.map(region => [region.id, 0]));
    for (const agent of state.agents.filter(agent => agent.species === record.key)) {
      if (!regionalSave) {
        const available = definitions.filter(region => counts.get(region.id) < region.populationLimit);
        const region = (available.length ? available : definitions).toSorted((left, right) =>
          Math.hypot(left.x - (agent.homeX ?? agent.x), left.y - (agent.homeY ?? agent.y)) -
          Math.hypot(right.x - (agent.homeX ?? agent.x), right.y - (agent.homeY ?? agent.y)))[0];
        agent.regionId = region?.id;
      }
      if (!counts.has(agent.regionId)) throw new Error("중립 유닛 소속 지역이 올바르지 않습니다.");
      counts.set(agent.regionId, counts.get(agent.regionId) + 1);
    }
    if (!regionalSave) {
      for (const region of record.regions) if (region.spawned && counts.get(region.id) <
          definitions.find(definition => definition.id === region.id).populationLimit) {
        region.missingSince = record.missingSince ?? environment.simSeconds;
        region.nextSpawnAt = record.nextSpawnAt === null ? environment.simSeconds + type.respawnSeconds :
          Math.max(region.missingSince, record.nextSpawnAt);
      }
      record.missingSince = null; record.nextSpawnAt = null;
    }
  }
  state.version = 3;

  for (const agent of state.agents) {
    if (["soil-mole", "snare-vine"].includes(agent.spawn?.kind)) {
      if (agent.mode === "spawn") { agent.mode = "idle"; agent.nextActionAt = environment.simSeconds; }
      delete agent.spawn;
    }
    migrateCombatStats(agent);
    applyCreatureMovement(agent);
    const territory = encounterTerritory(agent);
    if (territory) agent.stats.vision = territory.detectionRadius;
  }

  function players() {
    return [...environment.games.values()].flatMap(game => game.agents.filter(agent => agent.health > 0).map(agent => ({ game, agent })));
  }

  function createRegions(plan, populationLimit, unique) {
    const idAt = (x, y) => Math.floor(y / 16) * 20 + Math.floor(x / 16);
    if (unique) {
      if (!plan.spawnPoints) return [{ id: plan.y * size + plan.x, x: plan.x, y: plan.y,
        spawnPoints: null, cells: plan.cells, populationLimit: Math.min(1, populationLimit) }];
      return plan.spawnPoints.slice(0, populationLimit).map(index => {
        const x = index % size, y = Math.floor(index / size);
        return { id: index, x, y, spawnPoints: [index], populationLimit: 1,
          cells: plan.cells.filter(cell => idAt(cell % size, Math.floor(cell / size)) === idAt(x, y))
            .toSorted((left, right) => Math.hypot(left % size - x, Math.floor(left / size) - y) -
              Math.hypot(right % size - x, Math.floor(right / size) - y)) };
      });
    }
    if (!plan.spawnPoints) return [{ id: idAt(plan.x, plan.y), x: plan.x, y: plan.y,
      spawnPoints: null, cells: plan.cells, populationLimit }];
    const regions = new Map(), points = plan.spawnPoints;
    for (let cursor = 0; cursor < points.length; cursor++) {
      const amount = Math.floor(populationLimit / points.length) + (cursor < populationLimit % points.length ? 1 : 0);
      if (!amount) continue;
      const index = points[cursor], x = index % size, y = Math.floor(index / size), id = idAt(x, y);
      if (!regions.has(id)) regions.set(id, { id, x, y, spawnPoints: [], cells: [], populationLimit: 0 });
      const region = regions.get(id);
      region.spawnPoints.push(index); region.populationLimit += amount;
    }
    for (const index of plan.cells) regions.get(idAt(index % size, Math.floor(index / size)))?.cells.push(index);
    return [...regions.values()];
  }

  function valid(x, y, pursuing) {
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    const index = y * size + x;
    return environment.world.terrain[index] >= 2 && environment.world.terrain[index] <= 10 && !environment.world.hazards[index] &&
      !environment.colonies.some(colony => pursuing ? environment.games.get(colony.ownerId)?.nest?.health !== 0 &&
        colony.occupiedCells.has((x - colony.x) + "," + (y - colony.y)) : Math.hypot(x - colony.x - 2, y - colony.y - 2) < 10) && !environment.creatureSystem?.burrowAt(x, y);
  }

  function occupied(x, y, excluded) {
    if (environment.unitIndex) return environment.unitIndex.occupied(x, y, excluded, false);
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

  function spawn(record, initial, region) {
    const plan = plans.get(record.key), type = types.get(record.key), combatStats = unitCombatStats(record.key),
      territory = encounterTerritory({ species: record.key });
    const locations = region?.spawnPoints ? [...region.spawnPoints, ...region.cells] :
      plan.spawnPoints || [record.y * size + record.x, ...memberships.get(record.key)];
    const candidates = locations.filter(index => spawnHabitat(plan, index % size, Math.floor(index / size)) &&
      (!(environment.food.get(index % size + "," + Math.floor(index / size))?.amount > 0) ||
        environment.world.generationVersion >= 23 && environment.food.get(index % size + "," + Math.floor(index / size))?.resourceType === "tree") &&
      !occupied(index % size, Math.floor(index / size), null) && (initial && (initializing || type.unique) || !visible(index % size, Math.floor(index / size))));
    if (!candidates.length) return false;
    if (!plan.spawnPoints) candidates.sort((left, right) => Math.hypot(left % size - record.x, Math.floor(left / size) - record.y) -
      Math.hypot(right % size - record.x, Math.floor(right / size) - record.y) || left - right);
    const index = candidates[0], x = index % size, y = Math.floor(index / size);
    record.sequence++;
    const agent = { id: "encounter:" + record.key + ":" + record.sequence, species: record.key, name: type.name,
      faction: type.hostile ? "hostile" : "neutral", movementType: type.flying ? "flying" : "ground", encounterKey: record.key,
      x, y, homeX: type.unique ? region.x : plan.spawnPoints ? x : record.x,
      homeY: type.unique ? region.y : plan.spawnPoints ? y : record.y, health: combatStats.health,
      stats: { ...combatStats, attack: 1, speed: CREATURE_MOVEMENT[record.key].speed, vision: territory ? territory.detectionRadius : plan.radius, resistance: 1 },
      attributes: {}, carrying: 0, renderFromX: x, renderFromY: y, moveStartedAt: environment.simSeconds, moveDuration: 0,
      mode: "idle", nextActionAt: environment.simSeconds, animationStartedAt: environment.simSeconds, facing: 1, stepCount: 0,
      hidden: ["soil-mole", "bubble-toad"].includes(record.key), hiddenUntil: 0, routeCursor: 0, routeDirection: 1,
      attackReadyAt: 0, warningUntil: null, hurtStartedAt: -10 };
    if (!initializing && record.key === "spiny-back-leader") {
      const burrow = environment.world.burrows?.find(burrow => burrow.id === record.homeId);
      if (burrow && Math.hypot(x - burrow.entrance.x, y - burrow.entrance.y) <= 3) {
        beginCreatureSpawn(agent, environment.simSeconds, "burrow", { x: burrow.entrance.x, y: burrow.entrance.y - .95 });
        agent.spawn.burrowId = burrow.id;
      }
    }
    if (region) agent.regionId = region.id;
    state.agents.push(agent);
    environment.unitIndex?.update(agent, null);
    record.spawned = true; record.dead = false;
    return true;
  }

  function discovered(key) {
    return [...environment.games.values()].some(game => game.discoveredKinds.has("creature:" + key));
  }

  function eligible(record, type) {
    const now = environment.simSeconds;
    if (type.unique && now < CONQUEST_PACING.quietUntil) return false;
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
      if (type.unique && (record.spawned || record.dead)) continue;
      if (!record.spawned && !eligible(record, type)) continue;
      if (type.unique && !record.spawned) {
        relocate(record, plan);
        if (!plan.spawnPoints) { regionPlans.get(record.key)[0].x = record.x; regionPlans.get(record.key)[0].y = record.y; }
      }
      const counts = new Map(record.regions.map(region => [region.id, 0]));
      for (const agent of state.agents) if (agent.species === record.key && agent.health > 0)
        counts.set(agent.regionId, counts.get(agent.regionId) + 1);
      for (const region of record.regions) {
        const definition = regionPlans.get(record.key).find(definition => definition.id === region.id);
        let living = counts.get(region.id);
        if (!region.spawned) {
          while (living < definition.populationLimit && spawn(record, true, definition)) living++;
          region.spawned = living >= definition.populationLimit;
        } else if (living < definition.populationLimit) {
          if (region.missingSince === null) { region.missingSince = now; region.nextSpawnAt = now + type.respawnSeconds; }
          if (now >= region.nextSpawnAt && spawn(record, false, definition)) {
            living++; region.nextSpawnAt = now + type.respawnSeconds;
          }
        }
        if (living >= definition.populationLimit) { region.missingSince = null; region.nextSpawnAt = null; }
        if (type.unique && living > 0) break;
      }
    }
  }

  function neighbors(index, pursuing) {
    const x = index % size, y = Math.floor(index / size);
    return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([cx, cy]) => valid(cx, cy, pursuing)).map(([cx, cy]) => cy * size + cx);
  }

  function step(agent, target, reach, pursuing) {
    const membership = memberships.get(agent.species), start = agent.y * size + agent.x;
    const queue = [start], parent = new Map([[start, -1]]);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      if (index !== start && Math.abs(index % size - target.x) + Math.abs(Math.floor(index / size) - target.y) <= reach) {
        let next = index;
        while (parent.get(next) !== start) next = parent.get(next);
        return next;
      }
      for (const next of neighbors(index, pursuing)) if (!parent.has(next) && membership.has(next) &&
          (agent.returningHome || withinEncounterTerritory(agent, { x: next % size, y: Math.floor(next / size) }, true)) &&
          (!occupied(next % size, Math.floor(next / size), agent) ||
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
    agent.moveDuration = creatureMoveDuration(agent, environment.world.terrain[index]);
    agent.nextActionAt = environment.simSeconds + agent.moveDuration + (agent.returningHome ? 0 : CREATURE_MOVEMENT[agent.species].restSeconds);
    agent.mode = "walk"; agent.stepCount++;
    environment.unitIndex?.update(agent);
  }

  function returnHome(agent) {
    agent.pursuitTargetId = null;
    agent.nextActionAt = agent.moveStartedAt + agent.moveDuration;
    agent.returningHome = Math.hypot(agent.x - agent.homeX, agent.y - agent.homeY) > 1;
    if (!agent.returningHome) {
      delete agent.returnRetryAt;
      agent.nextActionAt = Math.max(agent.nextActionAt, environment.simSeconds + CREATURE_MOVEMENT[agent.species].restSeconds);
      return false;
    }
    if (environment.simSeconds < (agent.returnRetryAt || 0)) return true;
    const next = step(agent, { x: agent.homeX, y: agent.homeY }, 1, true);
    if (next !== null) { delete agent.returnRetryAt; move(agent, next); }
    else agent.returnRetryAt = environment.simSeconds + 1;
    return true;
  }

  function tick() {
    populate();
    const now = environment.simSeconds, nearby = players(), buildings = creatureNestTargets(environment);
    for (const agent of [...state.agents]) {
      if (agent.health <= 0 || creatureSpawning(agent, now)) continue;
      if (!agent.combat && !agent.attack && !agent.raid && !agent.returningHome && withinEncounterTerritory(agent, agent, false) && agent.support === null && now < agent.nextActionAt &&
          !(agent.mode === "walk" && now >= agent.moveStartedAt + agent.moveDuration) && environment.unitIndex &&
          !environment.games.get(environment.hostId)?.isVisible(agent.x, agent.y) &&
          !environment.unitIndex.nearby(agent.x, agent.y, Math.max(plans.get(agent.species).radius, encounterTerritory(agent)?.detectionRadius || 0)).some(entry => entry.game)) continue;
      if (agent.mode === "spawn") { agent.mode = "idle"; agent.animationStartedAt = agent.spawn.readyAt; }
      finishCreatureMove(agent, now);
      if (combat.update(agent, now)) { agent.pursuitTargetId = null; continue; }
      if (now < agent.moveStartedAt + agent.moveDuration) continue;
      const plan = plans.get(agent.species), type = types.get(agent.species), membership = memberships.get(agent.species),
        territory = encounterTerritory(agent);
      const candidates = environment.unitIndex ? environment.unitIndex.nearby(agent.x, agent.y, territory ? territory.detectionRadius : plan.radius)
        .filter(entry => entry.game && entry.agent.health > 0) : nearby;
      const radius = territory ? territory.detectionRadius : plan.radius;
      const targets = candidates.map(entry => ({ ...entry, distance: Math.hypot(agent.x - entry.agent.x, agent.y - entry.agent.y) }))
        .filter(entry => entry.distance <= radius && membership.has(entry.agent.y * size + entry.agent.x) &&
          withinEncounterTerritory(agent, entry.agent, true) && (!type.hostile || canPursueCombat(agent, entry.agent, now) &&
          !(entry.agent.birth && now < entry.agent.birth.readyAt))).sort(compareCreatureCombatTargets);
      let target = targets[0], pursuit = null;
      if (type.hostile) {
        const structures = combatDisposition(agent) === "aggressive" ? buildings.map(entry => ({ ...entry, distance: burrowDistance(agent, entry.agent) }))
          .filter(entry => entry.agent.health > 0 && entry.distance <= radius) : [];
        target = null;
        for (const candidate of [...targets, ...structures].sort(compareCreatureCombatTargets)) {
          if (candidate.agent.kind === "nest") {
            const approaches = burrowApproaches(candidate.agent).filter(cell => valid(cell.x, cell.y, true) &&
              membership.has(cell.y * size + cell.x) && withinEncounterTerritory(agent, cell, true))
              .sort((left, right) => Math.abs(agent.x - left.x) + Math.abs(agent.y - left.y) - Math.abs(agent.x - right.x) - Math.abs(agent.y - right.y));
            if (candidate.distance <= 1 && approaches.some(cell => cell.x === agent.x && cell.y === agent.y)) { target = candidate; break; }
            for (const approach of approaches) {
              if (occupied(approach.x, approach.y, agent)) continue;
              pursuit = step(agent, approach, 0, true);
              if (pursuit !== null) break;
            }
          } else pursuit = step(agent, candidate.agent, 0, true);
          if (pursuit !== null || candidate.distance === 0) { target = candidate; break; }
        }
      }
      if (!agent.attack) agent.mode = "idle";
      agent.pursuitTargetId = null;
      if (!target) agent.warningUntil = null;
      if (territory && (agent.returningHome || !withinEncounterTerritory(agent, agent, true) ||
          !target && !withinEncounterTerritory(agent, agent, false))) {
        updateCreatureNestAttack(agent, null, now);
        if (returnHome(agent)) continue;
      }
      if (agent.species === "white-paw" && agent.health < agent.stats.health / 2) {
        updateCreatureNestAttack(agent, null, now);
        if (!returnHome(agent)) agent.nextActionAt = now + 2;
        continue;
      }
      const wasHidden = agent.hidden;
      agent.hidden = agent.species === "soil-mole" ? !targets.some(entry => ["gather", "harvest", "prepare"].includes(entry.agent.mode)) :
        agent.species === "bubble-toad" ? !target : agent.species === "dew-rabbit" ? !!target && target.distance <= 2 : false;
      if (agent.hidden) {
        updateCreatureNestAttack(agent, null, now);
        agent.nextActionAt = Math.max(agent.nextActionAt, now + 1);
        continue;
      }
      if (wasHidden && agent.species === "bubble-toad") {
        beginCreatureSpawn(agent, now, "water", agent);
        continue;
      }
      agent.pursuitTargetId = type.hostile ? target?.agent.id || null : null;
      if (type.hostile && target && agent.species === "soil-boar" && agent.warningUntil === null) {
        updateCreatureNestAttack(agent, null, now);
        agent.warningUntil = now + 1;
        continue;
      }
      if (now < agent.warningUntil) continue;
      if (updateCreatureNestAttack(agent, target, now)) continue;
      if (type.hostile && target && pursuit !== null) { move(agent, pursuit); continue; }
      if (territory && !withinEncounterTerritory(agent, agent, false) && returnHome(agent)) continue;
      if (agent.species === "talon-owl" && !target && returnHome(agent)) continue;
      if (now < agent.nextActionAt) continue;
      if (agent.species === "talon-owl" && !target) {
        const next = agent.species === "talon-owl" && (agent.x !== agent.homeX || agent.y !== agent.homeY) ? step(agent, { x: agent.homeX, y: agent.homeY }, 0, true) : null;
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
      const options = neighbors(agent.y * size + agent.x).filter(index => membership.has(index) &&
        withinEncounterTerritory(agent, { x: index % size, y: Math.floor(index / size) }, false) &&
        !occupied(index % size, Math.floor(index / size), agent));
      if (target && !type.hostile) options.sort((left, right) => Math.hypot(right % size - target.agent.x, Math.floor(right / size) - target.agent.y) -
        Math.hypot(left % size - target.agent.x, Math.floor(left / size) - target.agent.y));
      const index = options.length ? target && !type.hostile ? options[0] : options[(agent.stepCount + agent.homeX + agent.homeY) % options.length] : null;
      if (index !== null) move(agent, index); else agent.nextActionAt = now + 1;
    }
    for (const agent of state.agents) {
      if (agent.species !== "spring-keeper") continue;
      const moving = agent.mode === "walk" && now < agent.moveStartedAt + agent.moveDuration;
      if (moving) {
        if (!Number.isFinite(agent.flightStartedAt) || Number.isFinite(agent.flightStoppedAt)) agent.flightStartedAt = agent.moveStartedAt;
        agent.flightStoppedAt = null;
      } else if (Number.isFinite(agent.flightStartedAt) && !Number.isFinite(agent.flightStoppedAt)) {
        agent.flightStoppedAt = Math.min(now, agent.moveStartedAt + agent.moveDuration);
      }
    }
  }

  function receiveDamage(agent, amount) {
    if (!state.agents.includes(agent) || amount <= 0 || !Number.isFinite(amount)) return;
    agent.health = Math.max(0, agent.health - amount);
    agent.hurtStartedAt = environment.simSeconds;
    if (agent.health > 0) return;
    const record = state.records.find(entry => entry.key === agent.species), type = types.get(agent.species);
    state.kills[agent.species] = (state.kills[agent.species] || 0) + 1;
    record.dead = type.unique && !state.agents.some(entry => entry.species === agent.species && entry.health > 0);
    const region = record.regions.find(region => region.id === agent.regionId);
    region.spawned = true;
    if (!type.unique && region.missingSince === null) { region.missingSince = environment.simSeconds; region.nextSpawnAt = environment.simSeconds + type.respawnSeconds; }
    state.agents = state.agents.filter(entry => entry !== agent);
    environment.unitIndex?.remove(agent);
    placeCorpse(environment.food, { x: agent.x, y: agent.y, agentId: agent.id, kind: "corpse", species: agent.species,
      attributes: {}, facing: agent.facing,
      diedAt: environment.simSeconds, decaysAt: environment.simSeconds + CORPSE_LIFETIME, renderX: agent.x, renderY: agent.y });
  }

  for (const record of state.records) updateMembership(record);
  if (!saved) populate();
  initializing = false;
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
