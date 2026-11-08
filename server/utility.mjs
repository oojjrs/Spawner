import { isNestDefender } from "./nest-defender.mjs";
import { CONQUEST_PACING } from "./conquest-pacing.mjs";
import { dnaCanHunt, dnaCanSearch } from "./dna-unit.mjs";
import { NEST_LEVELS, nestUpgradeCost } from "./nests.mjs";
import { unitCarryCapacity, unitTravelSpeed, unitMovementInterval, unitTerrainSpeedMultiplier } from "./attributes.mjs";
import { resourceDefinition, resourceTypeForCell } from "./resources.mjs";
import { burrowApproaches } from "./burrows.mjs";
import { combatDisposition, canPursueCombat, colonyDefenseTarget } from "./combat.mjs";
import { combatDamage } from "./combat-stats.mjs";
import { beginRetreat, updateRetreat, canRetreat, survivalState, combatSurvival } from "./survival.mjs";
import { AGENT_ATTACK_DURATION, AGENT_HURT_DURATION } from "./attack.mjs";
import { encounterTerritory, withinEncounterTerritory } from "./encounter-territory.mjs";
import { colonySupply, colonyForagers } from "./colony-supply.mjs";

export function createPersonality(random) {
  return Object.freeze({ boldness: random(), aggression: random(), curiosity: random() });
}

export function personalityLabels(personality) {
  const label = value => value < 1 / 3 ? "낮음" : value < 2 / 3 ? "보통" : "높음";
  return { boldness: label(personality.boldness), aggression: label(personality.aggression), curiosity: label(personality.curiosity) };
}

export function actionScore(personality, needs, action) {
  return needs.food * action.foodGain +
    needs.defense * (.8 + .4 * personality.aggression) * action.combatGain +
    needs.information * (.8 + .4 * personality.curiosity) * action.informationGain +
    (1.2 - .4 * personality.boldness) * (action.healingGain + action.riskReduction);
}

export function riskValue(agent, damage) {
  const exposure = Math.max(0, damage) / Math.max(0.01, agent.health);
  return 30 * exposure + (30 + 4 * agent.cost + 4 * agent.carrying) * exposure ** 2 / (1 + exposure ** 2);
}

export function createUtilityAI(context) {
  const { state, size, homeCells, deliveryCells, walkable, hazardAt, enemies, synergy, canHarvest } = context;
  const terrainAt = context.terrainAt || (() => 4);
  const resourceType = context.resourceType || (food => resourceTypeForCell(food, {}));
  const isFood = context.isFood || (type => resourceDefinition(type)?.category === "food");
  let frontierExplored = null, frontierIterator = null, frontierProcessed = 0;
  const frontierByIndex = new Map();
  const patrolByIndex = new Map();
  let frontiers = [];
  const limit = value => Math.max(0, Math.min(1, value));
  const indexOf = cell => cell.y * size + cell.x;
  const distance = (first, second) => Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
  const at = index => ({ x: index % size, y: Math.floor(index / size) });

  function neighbors(cell) {
    return [{ x: cell.x + 1, y: cell.y }, { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 }, { x: cell.x, y: cell.y - 1 }]
      .filter(next => next.x >= 0 && next.y >= 0 && next.x < size && next.y < size &&
        state.explored.has(indexOf(next)) && walkable(next.x, next.y));
  }

  function speed(agent, cell, carrying, straight, type) {
    const capacity = unitCarryCapacity(agent, type);
    let value = unitTravelSpeed(agent, carrying, type);
    if (carrying > capacity) value *= 0.8;
    if (synergy(agent, ["strength", "feet"])) value *= 1 + 0.5 * Math.min(1, carrying / capacity);
    if (straight >= 4 && synergy(agent, ["feet", "feet"])) value *= 1.75;
    if (hazardAt(cell.x, cell.y)) {
      value *= 0.5;
      if (synergy(agent, ["feet", "shell"])) value *= 3;
    }
    return 1 / unitMovementInterval(value * unitTerrainSpeedMultiplier(agent, terrainAt(cell.x, cell.y)));
  }

  function push(queue, entry) {
    queue.push(entry);
    let index = queue.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (queue[parent].priority <= entry.priority) break;
      queue[index] = queue[parent];
      index = parent;
    }
    queue[index] = entry;
  }

  function pop(queue) {
    const first = queue[0], last = queue.pop();
    if (queue.length) {
      let index = 0;
      while (index * 2 + 1 < queue.length) {
        let child = index * 2 + 1;
        if (child + 1 < queue.length && queue[child + 1].priority < queue[child].priority) child++;
        if (last.priority <= queue[child].priority) break;
        queue[index] = queue[child];
        index = child;
      }
      queue[index] = last;
    }
    return first;
  }

  function route(agent, target, supply) {
    if (context.canMove && !context.canMove(agent, target.x, target.y)) return null;
    const start = indexOf(agent), goal = indexOf(target);
    if (!state.explored.has(goal) || !walkable(target.x, target.y)) return null;
    if (start === goal) return [{ x: agent.x, y: agent.y }];
    const open = [], costs = new Map([[start, 0]]), parents = new Map();
    const heuristicSpeed = unitTravelSpeed(agent, agent.carrying) * 3;
    push(open, { index: start, cost: 0, priority: distance(agent, target) / heuristicSpeed });
    let expanded = 0;
    const delivery = deliveryCells().some(cell => cell.x === target.x && cell.y === target.y);
    const interrupted = (supply || colonySupply(state, context.tribe)).interruption > 0;
    let foodSearch = false;
    if (interrupted) for (const food of state.knownFood.values()) {
      if (food.amount > 0 && isFood(resourceType(food)) && distance(food, target) <= agent.stats.vision + 8) { foodSearch = true; break; }
    }
    const budget = interrupted && (target.amount > 0 || delivery || foodSearch) ? 8192 : 2048;
    const speeds = new Map();
    while (open.length && expanded < budget) {
      const current = pop(open);
      if (current.cost !== costs.get(current.index)) continue;
      if (current.index === goal) {
        const cells = [];
        let index = goal;
        while (index !== undefined) { cells.push(at(index)); index = parents.get(index); }
        return cells.reverse();
      }
      expanded++;
      const currentCell = at(current.index);
      const currentAgent = context.canMove ? { ...agent, ...currentCell } : agent;
      for (const next of neighbors(currentCell)) {
        if (context.canMove && !context.canMove(currentAgent, next.x, next.y)) continue;
        const nextIndex = indexOf(next), hazard = hazardAt(next.x, next.y), key = terrainAt(next.x, next.y) * 2 + Number(!!hazard);
        if (!speeds.has(key)) speeds.set(key, speed(agent, next, agent.carrying, 0));
        const seconds = 1 / speeds.get(key);
        const damage = hazard ? 0.3 * seconds * agent.stats.resistance : 0;
        const cost = current.cost + seconds + (1.5 - agent.personality.boldness) * damage * 4 / Math.max(1, agent.health);
        if (cost >= (costs.get(nextIndex) ?? Infinity)) continue;
        costs.set(nextIndex, cost);
        parents.set(nextIndex, current.index);
        push(open, { index: nextIndex, cost, priority: cost + distance(next, target) / heuristicSpeed });
      }
    }
    return null;
  }

  function travelTime(agent, cells, carrying, type) {
    let seconds = 0, straight = agent.straightSteps || 0, direction = agent.lastDirection;
    for (let index = 1; index < cells.length; index++) {
      const next = { dx: cells[index].x - cells[index - 1].x, dy: cells[index].y - cells[index - 1].y };
      straight = direction && next.dx === direction.dx && next.dy === direction.dy ? straight + 1 : 1;
      direction = next;
      seconds += 1 / speed(agent, cells[index], carrying, straight, type);
    }
    return seconds;
  }

  function homeRoute(agent, source, targets, supply) {
    const proxy = { ...agent, x: source.x, y: source.y };
    for (const cell of targets.toSorted((first, second) => distance(source, first) - distance(source, second)).slice(0, 4)) {
      const cells = route(proxy, cell, supply);
      if (cells) return cells;
    }
    return null;
  }

  function threatDamage(agent, cell, seconds, fighting, visible) {
    let damage = 0;
    for (const enemy of visible) {
      if (enemy.retreat && !enemy.combat) continue;
      if (combatDisposition(enemy) !== "aggressive" && !(fighting && combatDisposition(enemy) === "passive") &&
          !(enemy.combat && enemy.combat.teams[1 - enemy.combat.side] === ("colony:" + agent.ownerId))) continue;
      const gap = Math.max(0, distance(cell, enemy) - 1);
      const reach = Math.max(0, seconds - gap / Math.max(0.1, enemy.species ? enemy.stats.speed : 1 / unitMovementInterval(unitTravelSpeed(enemy, enemy.carrying))));
      if (!reach) continue;
      if (enemy.species && !enemy.raid && (encounterTerritory(enemy) ? !withinEncounterTerritory(enemy, cell, true) :
          Math.hypot(cell.x - enemy.homeX, cell.y - enemy.homeY) > 8)) continue;
      const supporters = state.agents.filter(ally => ally !== agent && ally.health > 0)
        .reduce((sum, ally) => sum + participation(ally, enemy), 0);
      const supportDamage = state.agents.filter(ally => ally !== agent && ally.health > 0)
        .reduce((sum, ally) => sum + participation(ally, enemy) * combatDamage(ally, enemy), 0);
      let exposure = reach;
      if (fighting && distance(cell, enemy) <= 1) exposure = Math.min(exposure,
        enemy.health / Math.max(0.1, combatDamage(agent, enemy) + supportDamage));
      damage += combatDamage(enemy, agent) * exposure / (2 * (AGENT_ATTACK_DURATION + AGENT_HURT_DURATION + .2)) / (1 + supporters);
    }
    return damage;
  }

  function participation(ally, enemy) {
    if (!canPursueCombat(ally, enemy, state.simSeconds,
      colonyDefenseTarget(ally, enemy, state.agents, context.defenseStructures?.()))) return 0;
    const intention = ally.utility?.action;
    if (["flee", "return", "recover"].includes(intention)) return 0;
    if (intention === "fight" && ally.utility.target?.id !== enemy.id) return 0;
    return (intention === "fight" ? 1 : 0.5) *
      limit(1 - Math.max(0, distance(ally, enemy) - 1) * unitMovementInterval(unitTravelSpeed(ally, ally.carrying)) / 10);
  }

  function predictedDamage(agent, cells, action, visible, carrying, horizon) {
    let remaining = horizon, damage = 0, exposure = agent.hazardExposure || 0;
    let previousKind = agent.hazardKind || 0, lastHazard = 0;
    let warning = Math.max(0, (agent.warningUntil || 0) - state.simSeconds);
    let warningReady = (agent.warningReady || 0) <= state.simSeconds;
    let elapsed = 0;
    const visit = (cell, duration, harvesting, moving) => {
      const seconds = Math.min(remaining, duration);
      if (seconds <= 0) return;
      const kind = hazardAt(cell.x, cell.y);
      if (kind === 1) {
        if (previousKind !== kind || elapsed - lastHazard >= 5) exposure = 0;
        if (kind !== previousKind && warningReady && synergy(agent, ["antenna", "shell"])) {
          warning = 1;
          warningReady = false;
        }
        const unprotected = Math.max(0, seconds - warning);
        let effective = unprotected;
        if (synergy(agent, ["shell", "shell"])) {
          const beforeAdaptation = Math.min(unprotected, Math.max(0, 1 - exposure - Math.min(warning, seconds)));
          effective = beforeAdaptation + (unprotected - beforeAdaptation) * 0.1;
        }
        damage += 0.3 * effective * agent.stats.resistance;
        exposure += seconds;
        lastHazard = elapsed + seconds;
      }
      damage += threatDamage(agent, cell, seconds, action === "fight", visible);
      warning = Math.max(0, warning - seconds);
      previousKind = kind;
      elapsed += seconds;
      remaining -= seconds;
    };
    for (let index = 1; index < cells.length && remaining > 0; index++) {
      visit(cells[index], 1 / speed(agent, cells[index], carrying, 0), false, true);
    }
    if (remaining > 0) visit(cells[cells.length - 1], remaining, action === "collect", false);
    if (agent.shieldUntil > state.simSeconds) damage = Math.max(0, damage - agent.shield);
    if (damage > 0 && synergy(agent, ["strength", "shell"]) && state.simSeconds >= agent.shieldReady) damage = Math.max(0, damage - 4);
    return damage;
  }

  function updateFrontier(index) {
    const cell = at(index);
    if ((cell.x + cell.y) % 4 === 0 && walkable(cell.x, cell.y)) patrolByIndex.set(index, cell);
    const boundary = walkable(cell.x, cell.y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const x = cell.x + dx, y = cell.y + dy;
      return x >= 0 && y >= 0 && x < size && y < size && !state.explored.has(y * size + x);
    });
    if (!boundary) return frontierByIndex.delete(index);
    if (frontierByIndex.has(index)) return false;
    frontierByIndex.set(index, cell);
    return true;
  }

  function frontierCells() {
    if (frontierExplored !== state.explored || state.explored.size < frontierProcessed) {
      frontierExplored = state.explored;
      frontierIterator = state.explored.values();
      frontierProcessed = 0;
      frontierByIndex.clear();
      patrolByIndex.clear();
      frontiers = [];
    }
    let changed = false;
    while (frontierProcessed < state.explored.size) {
      const index = frontierIterator.next().value;
      frontierProcessed++;
      changed = updateFrontier(index) || changed;
      const x = index % size, y = Math.floor(index / size);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, neighbor = ny * size + nx;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size || !frontierByIndex.has(neighbor)) continue;
        changed = updateFrontier(neighbor) || changed;
      }
    }
    if (changed) frontiers = [...frontierByIndex.values()];
    return frontiers;
  }

  function evaluate(agent, retain, immediate) {
    const supply = colonySupply(state, context.tribe);
    const guard = isNestDefender(agent);
    const gathers = !agent.dna || agent.stats.dna.harvest > 0;
    const attacks = combatDisposition(agent) === "aggressive";
    const warrior = !canRetreat(agent);
    const defenseOnly = context.defenseOnly?.(agent) === true;
    const hunts = attacks && !defenseOnly;
    const invasion = hunts && !gathers ? context.invasionTarget?.(agent) : null;
    const scouts = !attacks && !gathers && agent.stats?.dna?.antennaCount > 0;
    const visible = enemies().filter(enemy => enemy.health > 0 &&
      (dnaCanSearch(agent, enemy, state.simSeconds) || guard &&
        colonyDefenseTarget(agent, enemy, state.agents, context.defenseStructures?.())));
    const safety = assess(agent, visible);
    const defenseTargets = visible.filter(enemy => context.defenseTarget ? context.defenseTarget(agent, enemy) :
      colonyDefenseTarget(agent, enemy, state.agents, context.defenseStructures?.()));
    const suspendedWork = agent.suspendedWork || (retain && agent.utility?.resuming ? agent.utility : null);
    const suspendedFoodKey = suspendedWork?.action === "collect" ? suspendedWork.target.key : null;
    const capacity = unitCarryCapacity(agent, agent.carryingType) + (synergy(agent, ["strength", "strength"]) ? 4 : 0);
    const routes = new Map(), candidates = [];
    const path = target => {
      const key = indexOf(target);
      if (!routes.has(key)) routes.set(key, route(agent, target, supply));
      return routes.get(key);
    };
    const allies = state.agents.filter(ally => ally !== agent && ally.health > 0);
    const carryingType = agent.carryingType || "honey-mushrooms";
    const reservation = food => allies.reduce((sum, ally) => sum + (ally.utility?.action === "collect" &&
      ally.utility.target?.key === (food.key || food.x + "," + food.y) ? Math.max(0, ally.utility.plannedCargo - ally.carrying) : 0), 0);
    const foodWithinRange = (immediate ? [state.knownFood.get(suspendedFoodKey)].filter(Boolean) : [...state.knownFood.values()])
      .filter(food => !context.canMove || context.canMove(agent, food.x, food.y));
    const availableFood = immediate ? 0 : foodWithinRange.filter(food => canHarvest(food, agent) && isFood(resourceType(food)))
      .reduce((sum, food) => sum + Math.max(0, food.amount - reservation(food)), 0);
    const perAgent = availableFood / Math.max(1, state.agents.length);
    const underAttack = visible.some(enemy => (combatDisposition(enemy) === "aggressive" || enemy.combat) &&
      (allies.concat(agent).some(ally => distance(ally, enemy) <= 1) || homeCells().some(cell => distance(cell, enemy) <= 1)));
    const pointTarget = Math.max(nestUpgradeCost(1, context.tribe), nestUpgradeCost(state.nestLevel, context.tribe) || 0);
    const needs = { food: .5 + limit(1 - state.evolutionPoints / pointTarget),
      information: perAgent < 4 ? 1.5 : perAgent < 8 ? 1 : 0.5, defense: underAttack ? 1.5 : 1 };
    if (attacks && !gathers) { needs.food *= .2; needs.information *= 1.6; needs.defense *= 1.2; }
    const baseline = riskValue(agent, predictedDamage(agent, [{ x: agent.x, y: agent.y }], "wait", visible, agent.carrying, 10));
    const add = (action, target, cells, gains, extra) => {
      if (!cells) return;
      const damage = predictedDamage(agent, cells, action, visible, agent.carrying, 10);
      let decisionDamage = predictedDamage(agent, cells, action, visible, agent.carrying, 3);
      if (action === "fight" && !target.kind) {
        const enemy = visible.find(enemy => enemy.id === target.id);
        const support = allies.filter(ally => distance(ally, enemy) <= 1 && participation(ally, enemy) > 0);
        decisionDamage = Math.max(decisionDamage, combatSurvival(agent, [enemy], [agent, ...support]).damage);
      }
      const risk = riskValue(agent, damage);
      const candidate = { action, target, route: cells, damage, decisionDamage, foodGain: 0, combatGain: 0, informationGain: 0,
        healingGain: 0, riskReduction: baseline - risk, ...gains, ...extra };
      candidate.score = actionScore(agent.personality, needs, candidate);
      if (action === "explore" && candidate.score <= 0 && !candidate.invading) return;
      const same = agent.utility?.action === action && agent.utility.target?.key === target.key;
      candidate.retention = retain && same && safety.state === "stable" && !agent.retreat ? 3 : 0;
      candidates.push(candidate);
    };
    const searchHabitats = context.resourceHabitat && supply.interruption > 0 && context.foodType ? [context.foodType] : [];
    const home = homeRoute(agent, agent, homeCells(), supply);
    const storage = context.deliveryCapacity ? context.deliveryCapacity() :
      Math.max(0, NEST_LEVELS[state.nestLevel - 1].pointCapacity - state.evolutionPoints);
    const homeTime = home ? travelTime(agent, home, agent.carrying) : Infinity;
    const delivery = agent.carrying > 0 && storage > 0 ? homeRoute(agent, agent, deliveryCells(agent), supply) : null;
    if (delivery) {
      const unload = agent.mode === "unload" ? Math.max(0.05, agent.unloadReady - state.simSeconds) : 1;
      const deliveryTime = travelTime(agent, delivery, agent.carrying);
      add("return", { ...delivery.at(-1), key: "home" }, delivery,
        { foodGain: 60 * limit(Math.min(agent.carrying, storage) / (deliveryTime + unload) / 0.25) }, { deliverySeconds:deliveryTime + unload });
    }
    const missing = agent.stats.health - agent.health;
    if (!warrior && missing > 0.01 && home) {
      const amount = agent.retreat ? Math.max(0, agent.retreat.recoverHealth - agent.health) : Math.min(missing, agent.stats.health / 4);
      const time = homeTime + amount / 0.25;
      add("recover", { ...home.at(-1), key: "home" }, home,
        { healingGain: 60 * missing / agent.stats.health * 10 / (10 + time) },
        { recoverHealth: Math.min(agent.stats.health, agent.health + amount) });
    }
    if (agent.carrying < capacity) {
      const foods = foodWithinRange.filter(food => food.amount > 0 &&
        canHarvest(food, agent) &&
        (!agent.carrying || carryingType === resourceType(food)) &&
        storage > 0)
        .sort((first, second) => distance(agent, first) - distance(agent, second));
      const currentFood = foods.find(food => (food.key || food.x + "," + food.y) === agent.utility?.target?.key);
      const suspendedFood = foods.find(food => (food.key || food.x + "," + food.y) === suspendedFoodKey);
      const targets = [...new Set([currentFood, suspendedFood,
        ...foods.filter(food => isFood(resourceType(food))).slice(0, 6),
        ...foods.filter(food => !isFood(resourceType(food))).slice(0, 6)].filter(Boolean))];
      for (const food of targets) {
        const type = resourceType(food);
        const definition = resourceDefinition(type);
        const cells = path(food);
        if (!cells) continue;
        const back = homeRoute(agent, food, deliveryCells(), supply);
        if (!back) continue;
        const available = Math.max(0, food.amount - reservation(food));
        const capacity = unitCarryCapacity(agent, type) + (synergy(agent, ["strength", "strength"]) ? 4 : 0);
        const maximum = Math.min(capacity - agent.carrying, available,
          (food.key || food.x + "," + food.y) === suspendedFoodKey && Number.isFinite(suspendedWork.plannedCargo) ?
            Math.max(0, suspendedWork.plannedCargo - agent.carrying) : Infinity);
        const present = agent.x === food.x && agent.y === food.y && agent.mode === "harvest";
        const key = food.key || food.x + "," + food.y;
        const precise = synergy(agent, ["strength", "antenna"]) &&
          state.simSeconds - (agent.preciseHarvestTimes.get(key) ?? -Infinity) >= 30 ? 2 : 0;
        let best = null;
        const firstCargoCount = agent.dna ? Math.max(1, Math.ceil(maximum)) : 1;
        for (let count = firstCargoCount; count <= Math.ceil(maximum); count++) {
          const amount = Math.min(count, maximum);
          const harvestCycles = Math.ceil(amount);
          let harvestTime = 1 + Math.max(0, harvestCycles - precise) * (context.harvestSeconds ? context.harvestSeconds(type, agent) : definition.harvestSeconds);
          if (present) {
            const ready = Math.max(0, agent.harvestReady - state.simSeconds);
            harvestTime = ready + (agent.harvestPrepared ? Math.max(0, harvestCycles - 1) : Math.max(0, harvestCycles - precise)) * (context.harvestSeconds ? context.harvestSeconds(type, agent) : definition.harvestSeconds);
          }
          const time = travelTime(agent, cells, agent.carrying) + harvestTime +
            travelTime(agent, back, agent.carrying + amount, type) + 1;
          const gain = 60 * limit(Math.min(storage, agent.carrying + amount) / Math.max(0.05, time) / 0.25);
          const rate = Math.min(storage, agent.carrying + amount) / Math.max(.05, time);
          if (!best || gain > best.gain || gain === best.gain && rate > best.rate) best = { gain, amount, time, rate };
        }
        if (best) add("collect", { x: food.x, y: food.y, key }, cells, { foodGain: best.gain },
          { plannedCargo: agent.carrying + best.amount, deliverySeconds:best.time });
      }
    }
    const frontier = immediate ? [] : frontierCells().filter(cell => !context.canMove || context.canMove(agent, cell.x, cell.y));
    const knownFoods = immediate ? [] : foodWithinRange.filter(food => food.amount > 0 && isFood(resourceType(food)) && canHarvest(food, agent));
    const assignedForagers = supply.urgency > 0 ? colonyForagers(state, knownFoods, deliveryCells()) : new Set();
    const collecting = candidates.some(candidate => candidate.action === "collect" && candidate.damage < agent.health * .25);
    const searchKind = guard ? null : hunts ? "enemy" : gathers ? "resource" : scouts ? "scout" : null;
    if (!immediate && !invasion && searchKind && !agent.carrying && (hunts || !collecting)) {
      const cells = hunts ? dnaCanHunt(agent) ?
        [...new Map([...frontier, ...patrolByIndex.values()].map(cell => [indexOf(cell), cell])).values()] : neighbors(agent) :
        scouts && !frontier.length ? [...patrolByIndex.values()] : frontier;
      const recent = new Set((agent.path || []).slice(-24).map(cell => cell.x + "," + cell.y));
      const heading = [...String(agent.id)].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 4;
      const direction = agent.lastDirection || [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }][heading];
      const origins = foodWithinRange.filter(food => searchHabitats.includes(resourceType(food)) && food.amount > 0);
      const ranked = cells.filter(cell => distance(agent, cell) > 0 && (!context.canMove || context.canMove(agent, cell.x, cell.y)))
        .map(cell => {
          const gap = distance(agent, cell), key = cell.x + "," + cell.y;
          const forward = Math.max(0, ((cell.x - agent.x) * direction.dx + (cell.y - agent.y) * direction.dy) / gap);
          const freshness = (agent.visited.has(key) ? 1 : 2) * (recent.has(key) ? .2 : 1);
          const habitat = hunts ? 1 : 1 + 3 * origins.reduce((best, food) => Math.max(best, Math.max(0, 1 - distance(cell, food) / 24)), 0);
          return { cell, weight: freshness * (1 + forward) * habitat * Math.min(1, gap / 4) / (5 + gap) };
        }).sort((first, second) => second.weight - first.weight).slice(0, CONQUEST_PACING.frontierSamples);
      let count = 0;
      for (const { cell, weight } of ranked) {
        const cells = path(cell);
        if (!cells) continue;
        const seconds = travelTime(agent, cells, agent.carrying);
        const gain = 60 * limit(weight * 8 / (1 + seconds / 20));
        add("explore", { ...cell, key: searchKind + "-search:" + indexOf(cell) }, cells,
          hunts ? { combatGain: gain } : { informationGain: gain }, {});
        if (++count >= 12) break;
      }
    }
    // The beginner defender stays home instead of wandering after neutral wildlife.
    if (guard && !immediate && !agent.retreat && !agent.combat && home && home.length > 1) {
      add("explore", { ...home.at(-1), key: "guard-home" }, home, { informationGain: 1 }, {});
    }
    if (!immediate && invasion) {
      const approaches = burrowApproaches(invasion);
      const gap = cell => Math.min(...approaches.map(target => distance(cell, target)));
      const destinations = [...approaches, ...frontier].filter(cell => distance(agent, cell) > 0 &&
        dnaCanSearch(agent, cell, state.simSeconds)).sort((a, b) => gap(a) - gap(b) || distance(agent, a) - distance(agent, b));
      for (const cell of destinations.slice(0, CONQUEST_PACING.frontierSamples)) {
        const cells = path(cell);
        if (!cells) continue;
        add("explore", { ...cell, key: "enemy-search:" + indexOf(cell) }, cells, { combatGain: 60 }, { invading: true });
        break;
      }
    }
    for (const enemy of new Set([...defenseTargets, ...visible.toSorted((first, second) => distance(agent, first) - distance(agent, second)).slice(0, 6)])) {
      const defending = defenseTargets.includes(enemy);
      if (defenseOnly && !defending) continue;
      if (!canPursueCombat(agent, enemy, state.simSeconds, defending)) continue;
      const cells = path(enemy);
      if (!cells) continue;
      const supportDamage = allies.reduce((sum, ally) => sum + participation(ally, enemy) * combatDamage(ally, enemy), 0);
      const time = travelTime(agent, cells, agent.carrying) + enemy.health / Math.max(0.1, combatDamage(agent, enemy) + supportDamage);
      const power = (unit, target) => Math.sqrt(Math.max(0, unit.health + (unit.shieldUntil > state.simSeconds ? unit.shield : 0)) *
        Math.max(0.01, combatDamage(unit, target)));
      const support = allies.reduce((sum, ally) => sum + power(ally, enemy) * participation(ally, enemy), 0);
      const opponents = visible.filter(other => other === enemy || distance(other, enemy) <= 5)
        .reduce((sum, other) => sum + power(other, agent) * limit(1 - Math.max(0, distance(other, enemy) - 1) / (other.species ? other.stats.speed : 1 / unitMovementInterval(unitTravelSpeed(other, other.carrying))) / 10), 0);
      const own = power(agent, enemy), withMe = (support + own) / (support + own + opponents);
      const withoutMe = support / Math.max(0.01, support + opponents);
      const homeThreat = homeCells().some(cell => distance(cell, enemy) <= 3);
      const foodThreat = [...state.knownFood.values()].some(food => food.amount > 0 && canHarvest(food, agent) && distance(food, enemy) <= 4);
      const value = homeThreat ? 120 : foodThreat ? 80 : 40;
      add("fight", { id: enemy.id, x: enemy.x, y: enemy.y, key: enemy.id }, cells,
        { combatGain: value * (withMe - withoutMe) * 10 / (10 + time) }, { defending });
    }
    for (const building of !immediate && !defenseOnly && !agent.retreat && (!agent.dna || agent.stats.dna.power > 0) && combatDisposition(agent) === "aggressive" ? [...(context.burrows ? context.burrows() : []), ...(context.nests ? context.nests() : [])] : []) {
      const cells = burrowApproaches(building).map(cell => path(cell)).filter(Boolean).sort((first, second) => first.length - second.length)[0];
      if (!cells || !dnaCanSearch(agent, building, state.simSeconds)) continue;
      const time = travelTime(agent, cells, agent.carrying) + building.health / Math.max(0.1, agent.stats.attack);
      add("fight", { id: building.id, kind: building.kind || "burrow", x: building.x, y: building.y, key: building.id }, cells,
        { combatGain: 40 * 10 / (10 + time) }, {});
    }
    if (!warrior && baseline > 0.01) {
      const safe = new Map();
      for (const cell of [agent, ...neighbors(agent), ...frontier.toSorted((first, second) => distance(agent, first) - distance(agent, second)).slice(0, 4),
        ...(home ? [home.at(-1)] : [])]) safe.set(indexOf(cell), cell);
      const nearby = [{ x: agent.x, y: agent.y }], visited = new Set([indexOf(agent)]);
      for (let index = 0; index < nearby.length && index < 160; index++) for (const next of neighbors(nearby[index])) {
        const key = indexOf(next);
        if (visited.has(key)) continue;
        visited.add(key);
        nearby.push(next);
        if (distance(agent, next) >= 3 && !hazardAt(next.x, next.y)) safe.set(key, next);
      }
      const targets = [...safe.values()].map(cell => ({ cell, risk: threatDamage(agent, cell, 10, false, visible) +
        (hazardAt(cell.x, cell.y) === 1 ? 3 * agent.stats.resistance : 0), distance: distance(agent, cell) }))
        .sort((first, second) => first.risk - second.risk || first.distance - second.distance).slice(0, 8);
      for (const { cell } of targets) {
        if (cell.x === agent.x && cell.y === agent.y) continue;
        add("flee", { ...cell, key: "safe:" + indexOf(cell) }, path(cell), {}, {});
      }
    }
    if (warrior) {
      const battles = candidates.filter(candidate => candidate.action === "fight");
      const defense = battles.filter(candidate => candidate.defending);
      if (battles.length) return (defense.length ? defense : battles).sort((first, second) => second.score - first.score);
      const march = candidates.filter(candidate => candidate.invading);
      if (march.length) return march;
    }
    let foragePlans = !attacks ? candidates.filter(candidate => ["collect", "return"].includes(candidate.action) &&
      candidate.damage < agent.health * .25) : null;
    if (!foragePlans?.length) foragePlans = null;
    if (supply.urgency > 0 && safety.state === "stable" && !agent.retreat && !agent.combat) {
      const productive = candidates.filter(candidate => ["collect", "return"].includes(candidate.action) &&
        candidate.foodGain > 0 && candidate.score > 0 && candidate.damage < agent.health * .25);
      if (productive.length) {
        for (const candidate of productive) candidate.score *= 1 + 3 * supply.urgency;
        for (const candidate of candidates) if (candidate.action === "explore") {
          if (candidate.score > 0) candidate.score *= 1 - .9 * supply.urgency;
          candidate.retention *= 1 - .9 * supply.urgency;
        }
        if (supply.interruption > 0) {
          if (assignedForagers.has(agent.id) || agent.carrying > 0 && isFood(carryingType)) {
            const feasible = productive;
            if (feasible.length && !foragePlans) foragePlans = feasible;
          }
        }
      }
    }
    if (attacks && safety.state === "stable" && !agent.retreat && !agent.combat) {
      const battles = candidates.filter(candidate => candidate.action === "fight" && candidate.damage < agent.health*.5);
      if (battles.length) foragePlans = battles;
    }
    const viable = candidates.filter(candidate => candidate.decisionDamage < agent.health * .85);
    let allowed = viable.length ? viable : candidates;
    const defense = !agent.retreat && safety.state !== "critical" ? viable.filter(candidate => candidate.defending) : [];
    if (defense.length) return defense.sort((first, second) => second.score - first.score);
    const resumed = suspendedWork && safety.state === "stable" && !agent.retreat ? viable.filter(candidate =>
      candidate.action === suspendedWork.action && candidate.target.key === suspendedWork.target.key && candidate.damage < agent.health * .25) : [];
    if (resumed.length) return resumed.sort((first, second) => second.score - first.score).map(candidate => ({ ...candidate, resuming: true }));
    if (agent.retreat || safety.state === "critical") {
      const safest = Math.min(...allowed.map(candidate => candidate.damage));
      const survival = allowed.filter(candidate => ["flee", "recover", "return"].includes(candidate.action) &&
        candidate.damage <= safest + Math.max(1, agent.health * .1));
      if (survival.length) allowed = survival;
      else allowed = allowed.filter(candidate => candidate.damage <= safest + 1);
      if (agent.retreat && safety.damage < .01) {
        const recovery = allowed.filter(candidate => candidate.action === "recover");
        if (agent.health >= agent.retreat.recoverHealth) allowed = [];
        else if (recovery.length) allowed = recovery;
      }
    } else if (safety.state === "caution") {
      const safe = allowed.filter(candidate => candidate.damage < agent.health * .35 && candidate.action !== "fight");
      if (safe.length) allowed = safe;
      const recovery = allowed.filter(candidate => candidate.action === "recover");
      if (agent.health < agent.stats.health * .6 && recovery.length && safety.damage < .01) allowed = recovery;
    }
    const continuing = retain && safety.state === "stable" && !agent.retreat &&
      ["collect", "return"].includes(agent.utility?.action) ? allowed.filter(candidate =>
        candidate.action === agent.utility.action && candidate.target.key === agent.utility.target.key &&
        candidate.damage < agent.health * .25) : [];
    if (continuing.length) allowed = continuing;
    else if (foragePlans && safety.state === "stable" && !agent.retreat) allowed = allowed.filter(candidate => foragePlans.includes(candidate));
    return allowed.sort((first, second) => second.score + second.retention - first.score - first.retention);
  }

  function assess(agent, visible) {
    const damage = predictedDamage(agent, [{ x: agent.x, y: agent.y }], "wait", visible, agent.carrying, 3);
    const state = survivalState(agent, damage);
    agent.survivalState = state;
    updateRetreat(agent, context.state.simSeconds, damage > .01);
    if (state === "critical") beginRetreat(agent, context.state.simSeconds);
    return { state, damage };
  }

  function safety(agent) {
    return assess(agent, enemies().filter(enemy => enemy.health > 0 && dnaCanSearch(agent, enemy, state.simSeconds)));
  }

  function nextStep(agent, target) {
    const cells = route(agent, target);
    return cells?.[1] || null;
  }

  return { evaluate, nextStep, safety };
}
