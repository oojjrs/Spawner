export function createPersonality(random) {
  return Object.freeze({ boldness: random(), aggression: random(), curiosity: random() });
}

export function personalityLabels(personality) {
  const label = value => value < 1 / 3 ? "낮음" : value < 2 / 3 ? "보통" : "높음";
  return { boldness: label(personality.boldness), aggression: label(personality.aggression), curiosity: label(personality.curiosity) };
}

export function actionScore(personality, needs, action) {
  return needs.food * action.foodGain + needs.defense * (0.5 + personality.aggression) * action.combatGain +
    needs.information * (0.5 + personality.curiosity) * action.informationGain +
    (1.5 - personality.boldness) * (action.healingGain + action.riskReduction);
}

export function riskValue(agent, damage) {
  const exposure = Math.max(0, damage) / Math.max(0.01, agent.health);
  return 30 * exposure + (30 + 4 * agent.cost + 4 * agent.carrying) * exposure ** 2 / (1 + exposure ** 2);
}

export function createUtilityAI(context) {
  const { state, size, homeCells, walkable, hazardAt, enemies, synergy } = context;
  let frontierSize = -1;
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

  function speed(agent, cell, carrying, straight) {
    let value = agent.stats.speed;
    if (carrying > agent.stats.capacity) value *= 0.8;
    if (synergy(agent, ["strength", "feet"])) value *= 1 + 0.5 * Math.min(1, carrying / agent.stats.capacity);
    if (straight >= 4 && synergy(agent, ["feet", "feet"])) value *= 1.75;
    if (hazardAt(cell.x, cell.y)) {
      value *= 0.5;
      if (synergy(agent, ["feet", "shell"])) value *= 3;
    }
    return value;
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

  function route(agent, target) {
    const start = indexOf(agent), goal = indexOf(target);
    if (!state.explored.has(goal) || !walkable(target.x, target.y)) return null;
    if (start === goal) return [{ x: agent.x, y: agent.y }];
    const open = [], costs = new Map([[start, 0]]), parents = new Map();
    const heuristicSpeed = agent.stats.speed * 3;
    push(open, { index: start, cost: 0, priority: distance(agent, target) / heuristicSpeed });
    let expanded = 0;
    while (open.length && expanded < 2048) {
      const current = pop(open);
      if (current.cost !== costs.get(current.index)) continue;
      if (current.index === goal) {
        const cells = [];
        let index = goal;
        while (index !== undefined) { cells.push(at(index)); index = parents.get(index); }
        return cells.reverse();
      }
      expanded++;
      for (const next of neighbors(at(current.index))) {
        const nextIndex = indexOf(next), seconds = 1 / speed(agent, next, agent.carrying, 0);
        const damage = hazardAt(next.x, next.y) ? 0.3 * seconds * agent.stats.resistance : 0;
        const cost = current.cost + seconds + (1.5 - agent.personality.boldness) * damage * 4 / Math.max(1, agent.health);
        if (cost >= (costs.get(nextIndex) ?? Infinity)) continue;
        costs.set(nextIndex, cost);
        parents.set(nextIndex, current.index);
        push(open, { index: nextIndex, cost, priority: cost + distance(next, target) / heuristicSpeed });
      }
    }
    return null;
  }

  function travelTime(agent, cells, carrying) {
    let seconds = 0, straight = agent.straightSteps || 0, direction = agent.lastDirection;
    for (let index = 1; index < cells.length; index++) {
      const next = { dx: cells[index].x - cells[index - 1].x, dy: cells[index].y - cells[index - 1].y };
      straight = direction && next.dx === direction.dx && next.dy === direction.dy ? straight + 1 : 1;
      direction = next;
      seconds += 1 / speed(agent, cells[index], carrying, straight);
    }
    return seconds;
  }

  function homeRoute(agent, source) {
    const proxy = { ...agent, x: source.x, y: source.y };
    for (const cell of homeCells().toSorted((first, second) => distance(source, first) - distance(source, second)).slice(0, 4)) {
      const cells = route(proxy, cell);
      if (cells) return cells;
    }
    return null;
  }

  function threatDamage(agent, cell, seconds, fighting, visible) {
    let damage = 0;
    for (const enemy of visible) {
      const gap = Math.max(0, distance(cell, enemy) - 1);
      const reach = Math.max(0, seconds - gap / Math.max(0.1, enemy.stats.speed));
      if (!reach) continue;
      if (enemy.species && Math.hypot(cell.x - enemy.homeX, cell.y - enemy.homeY) > 8) continue;
      const supporters = state.agents.filter(ally => ally !== agent && ally.health > 0)
        .reduce((sum, ally) => sum + participation(ally, enemy), 0);
      const supportDamage = state.agents.filter(ally => ally !== agent && ally.health > 0)
        .reduce((sum, ally) => sum + participation(ally, enemy) * ally.stats.attack * ally.stats.speed, 0);
      let exposure = reach;
      if (fighting && distance(cell, enemy) <= 1) exposure = Math.min(exposure,
        enemy.health / Math.max(0.1, agent.stats.attack * agent.stats.speed + supportDamage));
      damage += enemy.stats.attack * (enemy.species ? 1 / 2.08 : enemy.stats.speed) * exposure / (1 + supporters);
    }
    return damage;
  }

  function participation(ally, enemy) {
    const intention = ally.utility?.action;
    if (["flee", "return", "recover"].includes(intention)) return 0;
    if (intention === "fight" && ally.utility.target?.id !== enemy.id) return 0;
    return (intention === "fight" ? 1 : 0.5) *
      limit(1 - Math.max(0, distance(ally, enemy) - 1) / ally.stats.speed / 10);
  }

  function predictedDamage(agent, cells, action, visible, carrying) {
    let remaining = 10, damage = 0, exposure = agent.hazardExposure || 0;
    let previousKind = agent.hazardKind || 0, lastHazard = 0;
    let warning = Math.max(0, (agent.warningUntil || 0) - state.simSeconds);
    let warningReady = (agent.warningReady || 0) <= state.simSeconds;
    let elapsed = 0;
    const visit = (cell, duration, harvesting, moving) => {
      const seconds = Math.min(remaining, duration);
      if (seconds <= 0) return;
      const kind = hazardAt(cell.x, cell.y);
      if (kind && (kind === 1 || harvesting || moving)) {
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
        damage += (kind === 2 && harvesting ? 4 : 0.3) * effective * agent.stats.resistance;
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

  function frontierCells() {
    if (frontierSize === state.explored.size) return frontiers;
    frontierSize = state.explored.size;
    frontiers = [];
    for (const index of state.explored) {
      const cell = at(index);
      if (!walkable(cell.x, cell.y)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const x = cell.x + dx, y = cell.y + dy;
        return x >= 0 && y >= 0 && x < size && y < size && !state.explored.has(y * size + x);
      })) frontiers.push(cell);
    }
    return frontiers;
  }

  function evaluate(agent, retain) {
    const visible = enemies().filter(enemy => enemy.health > 0);
    const capacity = agent.stats.capacity + (synergy(agent, ["strength", "strength"]) ? 4 : 0);
    const routes = new Map(), candidates = [];
    const path = target => {
      const key = indexOf(target);
      if (!routes.has(key)) routes.set(key, route(agent, target));
      return routes.get(key);
    };
    const allies = state.agents.filter(ally => ally !== agent && ally.health > 0);
    const reservation = food => allies.reduce((sum, ally) => sum + (ally.utility?.action === "collect" &&
      ally.utility.target?.key === food.x + "," + food.y ? Math.max(0, ally.utility.plannedCargo - ally.carrying) : 0), 0);
    const availableFood = [...state.knownFood.values()].reduce((sum, food) => sum + Math.max(0, food.amount - reservation(food)), 0);
    const perAgent = availableFood / Math.max(1, state.agents.length);
    const underAttack = visible.some(enemy => allies.concat(agent).some(ally => distance(ally, enemy) <= 1) ||
      homeCells().some(cell => distance(cell, enemy) <= 1));
    const needs = { food: state.evolutionPoints < 5 ? 1.5 : state.evolutionPoints < 20 ? 1 : 0.5,
      information: perAgent < 4 ? 1.5 : perAgent < 8 ? 1 : 0.5, defense: underAttack ? 1.5 : 1 };
    const baseline = riskValue(agent, predictedDamage(agent, [{ x: agent.x, y: agent.y }], "wait", visible, agent.carrying));
    const add = (action, target, cells, gains, extra) => {
      if (!cells) return;
      const risk = riskValue(agent, predictedDamage(agent, cells, action, visible, agent.carrying));
      const candidate = { action, target, route: cells, foodGain: 0, combatGain: 0, informationGain: 0,
        healingGain: 0, riskReduction: baseline - risk, ...gains, ...extra };
      candidate.score = actionScore(agent.personality, needs, candidate);
      const same = agent.utility?.action === action && agent.utility.target?.key === target.key;
      candidate.retention = retain && same ? 3 : 0;
      candidates.push(candidate);
    };
    const home = homeRoute(agent, agent);
    const storage = Math.max(0, state.nestLevel * 100 - state.evolutionPoints);
    const homeTime = home ? travelTime(agent, home, agent.carrying) : Infinity;
    if (agent.carrying > 0 && storage > 0 && home) {
      const unload = agent.mode === "unload" ? Math.max(0.05, agent.unloadReady - state.simSeconds) : 1;
      add("return", { ...home.at(-1), key: "home" }, home,
        { foodGain: 60 * limit(Math.min(agent.carrying, storage) / (homeTime + unload) / 0.25) }, {});
    }
    const missing = agent.stats.health - agent.health;
    if (missing > 0.01 && home) {
      const amount = Math.min(missing, agent.stats.health / 4);
      const time = homeTime + amount / 0.25;
      add("recover", { ...home.at(-1), key: "home" }, home,
        { healingGain: 60 * missing / agent.stats.health * 10 / (10 + time) },
        { recoverHealth: Math.min(agent.stats.health, agent.health + amount) });
    }
    if (agent.carrying < capacity && storage > 0) {
      const foods = [...state.knownFood.values()].filter(food => food.amount > 0)
        .sort((first, second) => distance(agent, first) - distance(agent, second));
      const currentFood = foods.find(food => food.x + "," + food.y === agent.utility?.target?.key);
      const targets = [...new Set([currentFood, ...foods.slice(0, 8)].filter(Boolean))];
      for (const food of targets) {
        const cells = path(food);
        if (!cells) continue;
        const back = homeRoute(agent, food);
        if (!back) continue;
        const available = Math.floor(Math.max(0, food.amount - reservation(food)));
        const maximum = Math.min(capacity - agent.carrying, available);
        const present = agent.x === food.x && agent.y === food.y && agent.mode === "harvest";
        const key = food.x + "," + food.y;
        const precise = synergy(agent, ["strength", "antenna"]) &&
          state.simSeconds - (agent.preciseHarvestTimes.get(key) ?? -Infinity) >= 30 ? 2 : 0;
        let best = null;
        for (let amount = 1; amount <= maximum; amount++) {
          let harvestTime = 1 + Math.max(0, amount - precise) * 1.5;
          if (present) {
            const ready = Math.max(0, agent.harvestReady - state.simSeconds);
            harvestTime = ready + (agent.harvestPrepared ? Math.max(0, amount - 1) * 1.5 : Math.max(0, amount - precise) * 1.5);
          }
          const time = travelTime(agent, cells, agent.carrying) + harvestTime +
            travelTime(agent, back, agent.carrying + amount) + 1;
          const gain = 60 * limit(Math.min(storage, agent.carrying + amount) / Math.max(0.05, time) / 0.25);
          if (!best || gain > best.gain) best = { gain, amount };
        }
        if (best) add("collect", { x: food.x, y: food.y, key }, cells, { foodGain: best.gain },
          { plannedCargo: agent.carrying + best.amount });
      }
    }
    const frontier = frontierCells();
    const prioritized = frontier.toSorted((first, second) => distance(agent, first) - distance(agent, second)).slice(0, 6);
    for (const marker of state.markers.toSorted((first, second) => distance(agent, first) - distance(agent, second)).slice(0, 2)) {
      const nearest = frontier.toSorted((first, second) => distance(marker, first) - distance(marker, second))[0];
      if (nearest) prioritized.push(nearest);
    }
    if (agent.utility?.action === "explore") {
      const current = frontier.find(cell => indexOf(cell) === indexOf(agent.utility.target));
      if (current) prioritized.push(current);
    }
    for (const target of [...new Map(prioritized.map(cell => [indexOf(cell), cell])).values()]) {
      const cells = path(target);
      if (!cells) continue;
      const radius = agent.stats.vision + (synergy(agent, ["feet", "antenna"]) &&
        Math.floor(agent.stepCount / 8) < Math.floor((agent.stepCount + cells.length - 1) / 8) ? 4 : 0);
      const seconds = travelTime(agent, cells, agent.carrying) + 5;
      let uncovered = 0;
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const x = target.x + dx, y = target.y + dy;
        if (x < 0 || y < 0 || x >= size || y >= size || dx * dx + dy * dy > radius * radius || state.explored.has(y * size + x)) continue;
        const assigned = allies.some(ally => ally.utility?.action === "explore" &&
          distance(ally, ally.utility.target) / ally.stats.speed <= seconds &&
          Math.hypot(x - ally.utility.target.x, y - ally.utility.target.y) <= ally.stats.vision);
        if (!assigned) uncovered++;
      }
      const markers = state.markers.filter(marker => Math.hypot(marker.x - target.x, marker.y - target.y) <= radius &&
        !allies.some(ally => ally.utility?.action === "explore" && Math.hypot(marker.x - ally.utility.target.x,
          marker.y - ally.utility.target.y) <= ally.stats.vision)).length;
      if (uncovered || markers) add("explore", { ...target, key: "frontier:" + indexOf(target) }, cells,
        { informationGain: 60 * limit((uncovered + 20 * markers) / (10 * seconds)) }, {});
    }
    for (const enemy of visible.toSorted((first, second) => distance(agent, first) - distance(agent, second)).slice(0, 6)) {
      const approaches = neighbors(enemy).map(cell => path(cell)).filter(Boolean)
        .sort((first, second) => first.length - second.length);
      const cells = approaches[0];
      if (!cells) continue;
      const supportDamage = allies.reduce((sum, ally) => sum + participation(ally, enemy) * ally.stats.attack * ally.stats.speed, 0);
      const time = travelTime(agent, cells, agent.carrying) + enemy.health / Math.max(0.1, agent.stats.attack * agent.stats.speed + supportDamage);
      const power = unit => Math.sqrt(Math.max(0, unit.health + (unit.shieldUntil > state.simSeconds ? unit.shield : 0)) *
        Math.max(0.01, unit.stats.attack * (unit.species ? 1 / 2.08 : unit.stats.speed)));
      const support = allies.reduce((sum, ally) => sum + power(ally) * participation(ally, enemy), 0);
      const opponents = visible.filter(other => other === enemy || distance(other, enemy) <= 5)
        .reduce((sum, other) => sum + power(other) * limit(1 - Math.max(0, distance(other, enemy) - 1) / other.stats.speed / 10), 0);
      const own = power(agent), withMe = (support + own) / (support + own + opponents);
      const withoutMe = support / Math.max(0.01, support + opponents);
      const homeThreat = homeCells().some(cell => distance(cell, enemy) <= 3);
      const foodThreat = [...state.knownFood.values()].some(food => food.amount > 0 && distance(food, enemy) <= 4);
      const value = homeThreat ? 120 : foodThreat ? 80 : 40;
      add("fight", { id: enemy.id, x: enemy.x, y: enemy.y, key: enemy.id }, cells,
        { combatGain: value * (withMe - withoutMe) * 10 / (10 + time) }, {});
    }
    if (baseline > 0.01) {
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
    return candidates.sort((first, second) => second.score + second.retention - first.score - first.retention);
  }

  function nextStep(agent, target) {
    const cells = route(agent, target);
    return cells?.[1] || null;
  }

  return { evaluate, nextStep };
}
