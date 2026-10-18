export function createGame(environment, colony) {
    const worldMap = environment.world;
    const WORLD_SIZE = 320;

    const COLONY_SIZE = 5;

    const COLONY_ORIGIN = { x: colony.x, y: colony.y };

    const COLONY_CENTER = {
      x: COLONY_ORIGIN.x + COLONY_SIZE / 2,
      y: COLONY_ORIGIN.y + COLONY_SIZE / 2
    };

    const colonyEntries = [colony];

    const STARTER_OBJECT_LIFETIME = 60 * 60;

    const AGENT_SPEED = 1;

    const AGENT_CAPACITY = 1;

    const AGENT_VISION = 1;

    const FOOD_REGION_SIZE = 18;

    const FOOD_SCENT_RADIUS = 6;

    const FOOD_SCENT_GUIDANCE_CHANCE = 0.82;

    const SHARED_TRAIL_FOLLOW_CHANCE = 0.86;

    const TERRAIN_TYPES = [
      "deep", "shallow", "coast", "land", "grassland",
      "forest", "lowMountain", "highMountain", "ridge"
    ];

    const ATTRIBUTES = [
      { key: "antenna", name: "감각", symbol: "◉", color: "#b2bffa", effect: "시야 +2칸" },
      { key: "arms", name: "운반", symbol: "◇", color: "#e5c78c", effect: "운반량 +2개" },
      { key: "feet", name: "이동", symbol: "↗", color: "#8cd2bb", effect: "이동 속도 +0.5칸/초" },
      { key: "strength", name: "힘", symbol: "✦", color: "#e6a79c", effect: "공격력 +2" },
      { key: "shell", name: "저항", symbol: "⬡", color: "#a7cbd2", effect: "체력 +4" }
    ];

    const foodSpotCache = environment.foodSpots;
    const foodCellMap = environment.food;

    const state = {
      simSeconds: 0,
      colonyFood: 0,
      evolutionPoints: 30,
      nestLevel: 1,
      templates: [],
      nextTemplateId: 1,
      rivals: [],
      corpses: [],
      nextAgentId: 1,
      agents: [],
      roads: new Map(),
      sharedTrails: new Map(),
      draftProfile: {
        direction: 0.65,
        novelty: 0.7,
        richness: 0.45,
        memoryTrips: 8,
        routeSense: 0.55
      }
    };

    function colonyAt(x, y) {
      return environment.colonies.find((entry) =>
        entry.occupiedCells.has((x - entry.x) + "," + (y - entry.y))
      ) || null;
    }

    function isColonyBoundaryCell(x, y) {
      if (!isWalkable(x, y)) {
        return false;
      }
      return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([cx, cy]) => colony.occupiedCells.has((cx - colony.x) + "," + (cy - colony.y)));
    }

    function colonyBoundaryCells() {
      const cells = [];
      const seen = new Set();
      for (const entry of colonyEntries) {
        for (const key of entry.occupiedCells) {
          const [localX, localY] = key.split(",").map(Number);
          const x = entry.x + localX;
          const y = entry.y + localY;
          for (const cell of walkableNeighbors(x, y)) {
            const boundaryKey = cell.x + "," + cell.y;
            if (!seen.has(boundaryKey)) {
              seen.add(boundaryKey);
              cells.push({ x: cell.x, y: cell.y });
            }
          }
        }
      }
      return cells;
    }

    function nearestColonyBoundaryCell(x, y) {
      let nearest = null;
      let nearestDistance = Infinity;
      for (const cell of colonyBoundaryCells()) {
        const distance = Math.abs(x - cell.x) + Math.abs(y - cell.y);
        if (distance < nearestDistance) {
          nearest = cell;
          nearestDistance = distance;
        }
      }
      return nearest;
    }

    function chooseSpawnPosition() {
      const cells = colonyBoundaryCells();
      const startIndex = (state.nextAgentId - 1) % cells.length;
      for (let offset = 0; offset < cells.length; offset += 1) {
        const cell = cells[(startIndex + offset) % cells.length];
        if (!isAgentCellOccupied(cell.x, cell.y, null)) {
          return { ...cell };
        }
      }
      return null;
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function hashNoise(x, y) {
      let value = Math.imul(x, 374761393) + Math.imul(y, 668265263);
      value = Math.imul(value ^ (value >>> 13), 1274126177);
      return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
    }

    function terrainAt(x, y) {
      if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return "deep";
      return TERRAIN_TYPES[worldMap.terrain[y * WORLD_SIZE + x]];
    }

    function foodSpotForRegion(regionX, regionY) {
      return foodSpotCache.get(regionX + "," + regionY) || { cells: [] };
    }

    function ensureFoodAround(x, y, radius) {
      const startRegionX = Math.floor((x - radius) / FOOD_REGION_SIZE);
      const startRegionY = Math.floor((y - radius) / FOOD_REGION_SIZE);
      const endRegionX = Math.floor((x + radius) / FOOD_REGION_SIZE);
      const endRegionY = Math.floor((y + radius) / FOOD_REGION_SIZE);

      for (let regionY = startRegionY; regionY <= endRegionY; regionY += 1) {
        for (let regionX = startRegionX; regionX <= endRegionX; regionX += 1) {
          foodSpotForRegion(regionX, regionY);
        }
      }
    }

    function foodCellAt(x, y) {
      ensureFoodAround(x, y, 1);
      return foodCellMap.get(x + "," + y) || null;
    }

    function isWalkable(x, y) {
      if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE || colonyAt(x, y)) {
        return false;
      }
      const terrain = terrainAt(x, y);
      return terrain === "coast" ||
        terrain === "land" ||
        terrain === "grassland" ||
        terrain === "forest" ||
        terrain === "lowMountain";
    }

    function visibleFoodFor(agent) {
      const radius = agent.stats.vision;
      ensureFoodAround(agent.x, agent.y, radius);
      let best = null;
      let bestScore = -Infinity;

      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const distance = Math.hypot(offsetX, offsetY);
          if (distance > radius) {
            continue;
          }
          const x = agent.x + offsetX;
          const y = agent.y + offsetY;
          const foodCell = foodCellMap.get(x + "," + y);
          if (!foodCell || foodCell.amount <= 0) {
            continue;
          }
          const richness = foodCell.amount / FOOD_PER_CELL;
          const score =
            -distance * (1 - agent.profile.richness) +
            richness * radius * agent.profile.richness;
          if (score > bestScore) {
            best = foodCell;
            bestScore = score;
          }
        }
      }
      return best;
    }

    function walkableNeighbors(x, y) {
      return [
        { x: x + 1, y, dx: 1, dy: 0 },
        { x: x - 1, y, dx: -1, dy: 0 },
        { x, y: y + 1, dx: 0, dy: 1 },
        { x, y: y - 1, dx: 0, dy: -1 }
      ].filter((cell) => isWalkable(cell.x, cell.y));
    }

    function moveAgent(agent, destination, rememberPath) {
      if (state.simSeconds - agent.moveStartedAt < agent.moveDuration ||
        isAgentCellOccupied(destination.x, destination.y, agent)) {
        return false;
      }
      if (!isWalkable(destination.x, destination.y) ||
        Math.abs(destination.x - agent.x) + Math.abs(destination.y - agent.y) !== 1) {
        return false;
      }
      const nextDirection = {
        dx: destination.x - agent.x,
        dy: destination.y - agent.y
      };
      const keptDirection = agent.lastDirection &&
        agent.lastDirection.dx === nextDirection.dx &&
        agent.lastDirection.dy === nextDirection.dy;
      agent.straightSteps = keptDirection ? agent.straightSteps + 1 : 1;
      agent.lastDirection = nextDirection;
      const rendered = interpolatedAgentPosition(agent);
      agent.renderFromX = rendered.x;
      agent.renderFromY = rendered.y;
      agent.moveStartedAt = state.simSeconds;
      agent.moveDuration = 1 / agentSpeed(agent);
      agent.x = destination.x;
      agent.y = destination.y;
      agent.stepCount += 1;
      agent.visited.add(agent.x + "," + agent.y);
      if (rememberPath) {
        agent.path.push({ x: agent.x, y: agent.y });
      } else {
        agent.returnPath.push({ x: agent.x, y: agent.y });
      }
      return true;
    }

    function foodScentAt(x, y) {
      ensureFoodAround(x, y, FOOD_SCENT_RADIUS);
      let strength = 0;

      for (let offsetY = -FOOD_SCENT_RADIUS; offsetY <= FOOD_SCENT_RADIUS; offsetY += 1) {
        for (let offsetX = -FOOD_SCENT_RADIUS; offsetX <= FOOD_SCENT_RADIUS; offsetX += 1) {
          const distance = Math.hypot(offsetX, offsetY);
          if (distance > FOOD_SCENT_RADIUS) {
            continue;
          }
          const foodCell = foodCellMap.get((x + offsetX) + "," + (y + offsetY));
          if (!foodCell || foodCell.amount <= 0) {
            continue;
          }
          const remainingRatio = foodCell.amount / FOOD_PER_CELL;
          const falloff = 1 - distance / (FOOD_SCENT_RADIUS + 1);
          strength += remainingRatio * falloff * falloff;
        }
      }
      return strength;
    }

    function scentGuidedStep(agent, neighbors) {
      const currentStrength = foodScentAt(agent.x, agent.y);
      let best = null;
      let bestStrength = currentStrength + 0.01;

      for (const neighbor of neighbors) {
        const strength = foodScentAt(neighbor.x, neighbor.y);
        const tieBreak = hashNoise(
          neighbor.x + agent.id * 307,
          neighbor.y + agent.stepCount * 43
        ) * 0.002;
        if (strength + tieBreak > bestStrength) {
          best = neighbor;
          bestStrength = strength + tieBreak;
        }
      }

      if (!best) {
        return null;
      }
      const guidanceRoll = hashNoise(
        agent.id * 719 + agent.stepCount,
        agent.x * 23 + agent.y * 47
      );
      return guidanceRoll < FOOD_SCENT_GUIDANCE_CHANCE ? best : null;
    }

    function registerSharedTrail(route, foodKey, strengthGain) {
      if (!route || route.length < 2 || !foodKey) {
        return;
      }

      for (let index = 0; index < route.length - 1; index += 1) {
        const from = route[index];
        const to = route[index + 1];
        const cellKey = from.x + "," + from.y;
        let entries = state.sharedTrails.get(cellKey);
        if (!entries) {
          entries = [];
          state.sharedTrails.set(cellKey, entries);
        }
        let entry = entries.find(
          (candidate) =>
            candidate.foodKey === foodKey &&
            candidate.nextX === to.x &&
            candidate.nextY === to.y
        );
        if (!entry) {
          entry = {
            fromX: from.x,
            fromY: from.y,
            nextX: to.x,
            nextY: to.y,
            foodKey,
            strength: 0
          };
          entries.push(entry);
        }
        entry.strength += strengthGain;
      }
    }

    function rebuildSharedTrailIndex(road) {
      for (const [cellKey, entries] of state.sharedTrails) {
        const remaining = entries.filter(
          (entry) => entry.foodKey !== road.foodKey
        );
        if (remaining.length > 0) {
          state.sharedTrails.set(cellKey, remaining);
        } else {
          state.sharedTrails.delete(cellKey);
        }
      }
      registerSharedTrail(road.route, road.foodKey, road.usageCount);
    }

    function registerRoadJourney(agent) {
      const route = agent.rememberedRoute;
      const foodKey = agent.rememberedFoodKey;
      if (!route || route.length < 2 || !foodKey) {
        return;
      }

      let road = state.roads.get(foodKey);
      if (!road) {
        road = {
          id: "road-" + foodKey,
          foodKey,
          route: route.map((cell) => ({ ...cell })),
          usageCount: 0,
          optimizationCount: 0,
          knownCells: new Set()
        };
        state.roads.set(foodKey, road);
      }
      road.usageCount += 1;
      for (const cellKey of agent.visited) {
        road.knownCells.add(cellKey);
      }
      for (const cell of route) {
        road.knownCells.add(cell.x + "," + cell.y);
      }
      if (route.length < road.route.length) {
        road.route = route.map((cell) => ({ ...cell }));
      }

      const goal = road.route[road.route.length - 1];
      const collectiveScale = 1 + Math.log2(road.usageCount + 1) * 5;
      const expansionBudget = Math.max(
        road.route.length,
        Math.floor(road.route.length * collectiveScale)
      );
      const optimized = bestKnownColonyRoute(
        { visited: road.knownCells },
        goal,
        expansionBudget,
        road.route
      );
      if (optimized && optimized.length < road.route.length) {
        road.route = optimized;
        road.optimizationCount += 1;
      }
      rebuildSharedTrailIndex(road);
    }

    function sharedTrailStep(agent, neighbors) {
      const entries = state.sharedTrails.get(agent.x + "," + agent.y) || [];
      let best = null;
      let bestScore = -Infinity;

      for (const entry of entries) {
        if (
          agent.sharedTrailFoodKey &&
          entry.foodKey !== agent.sharedTrailFoodKey
        ) {
          continue;
        }
        const foodCell = foodCellMap.get(entry.foodKey);
        if (!foodCell || foodCell.amount <= 0) {
          continue;
        }
        const neighbor = neighbors.find(
          (candidate) =>
            candidate.x === entry.nextX && candidate.y === entry.nextY
        );
        if (!neighbor) {
          continue;
        }
        const score = Math.log1p(entry.strength) + hashNoise(
          entry.nextX + agent.id * 887,
          entry.nextY + agent.stepCount * 59
        ) * 0.04;
        if (score > bestScore) {
          best = { neighbor, entry };
          bestScore = score;
        }
      }

      if (!best) {
        const foodCell = foodCellMap.get(agent.sharedTrailFoodKey);
        if (foodCell && foodCell.amount > 0) {
          return chooseStepToward(agent, foodCell, neighbors);
        }
        agent.sharedTrailFoodKey = null;
        return null;
      }
      if (agent.sharedTrailFoodKey) {
        return best.neighbor;
      }
      const followRoll = hashNoise(
        agent.id * 977 + agent.stepCount,
        agent.x * 41 - agent.y * 19
      );
      if (followRoll >= SHARED_TRAIL_FOLLOW_CHANCE) {
        return null;
      }
      agent.sharedTrailFoodKey = best.entry.foodKey;
      return best.neighbor;
    }

    function chooseExplorationStep(agent, neighbors) {
      if (neighbors.length === 0) {
        return null;
      }

      const trailStep = sharedTrailStep(agent, neighbors);
      if (trailStep) {
        return trailStep;
      }

      const scentedStep = scentGuidedStep(agent, neighbors);
      if (scentedStep) {
        return scentedStep;
      }

      const forward = agent.lastDirection ? neighbors.find(
        (neighbor) =>
          neighbor.dx === agent.lastDirection.dx &&
          neighbor.dy === agent.lastDirection.dy
      ) : null;
      const directionFatigue = clamp(1 - agent.straightSteps / 6, 0.25, 1);
      const directionChance = agent.profile.direction * directionFatigue;
      const directionRoll = hashNoise(
        agent.id * 401 + agent.stepCount,
        agent.x * 17 + agent.y * 29
      );

      if (forward && directionRoll < directionChance) {
        return forward;
      }

      let candidates = forward && neighbors.length > 1 ?
        neighbors.filter((neighbor) => neighbor !== forward) : [...neighbors];
      const unvisited = candidates.filter(
        (neighbor) => !agent.visited.has(neighbor.x + "," + neighbor.y)
      );
      const noveltyRoll = hashNoise(
        agent.id * 613 + agent.stepCount,
        agent.x * 37 - agent.y * 11
      );
      if (unvisited.length > 0 && noveltyRoll < agent.profile.novelty) {
        candidates = unvisited;
      }

      let best = null;
      let bestScore = -Infinity;
      for (const candidate of candidates) {
        const terrain = terrainAt(candidate.x, candidate.y);
        const terrainPenalty = terrain === "lowMountain" ?
          0.28 : terrain === "forest" ? 0.08 : 0;
        const score = hashNoise(
          candidate.x + agent.id * 101,
          candidate.y + agent.stepCount * 53
        ) - terrainPenalty;
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }

      return best;
    }

    function chooseStepToward(agent, target, neighbors) {
      if (neighbors.length === 0) {
        return null;
      }
      const targetKey = agent.mode + ":" + target.x + "," + target.y;
      if (agent.movementTargetKey !== targetKey) {
        agent.movementTargetKey = targetKey;
        agent.movementVisits.clear();
      }
      const currentKey = agent.x + "," + agent.y;
      agent.movementVisits.set(currentKey, (agent.movementVisits.get(currentKey) || 0) + 1);
      let best = null;
      let bestScore = Infinity;

      for (const neighbor of neighbors) {
        const distance =
          Math.abs(target.x - neighbor.x) + Math.abs(target.y - neighbor.y);
        const jitter = hashNoise(
          neighbor.x + agent.id * 211,
          neighbor.y + agent.stepCount * 97
        ) * 0.16;
        if (distance === 0) {
          return neighbor;
        }
        const visits = agent.movementVisits.get(neighbor.x + "," + neighbor.y) || 0;
        const score = distance + visits * 3 + jitter;
        if (score < bestScore) {
          best = neighbor;
          bestScore = score;
        }
      }
      return best;
    }

    function moveAgentAlongRoute(agent, direction, neighbors) {
      const route = agent.rememberedRoute;
      const preferred = route[agent.routeIndex];
      const goal = direction < 0 ? route[0] : route[route.length - 1];
      const destination = neighbors.find(
        (cell) => preferred && cell.x === preferred.x && cell.y === preferred.y
      ) || chooseStepToward(agent, goal, neighbors);
      if (!destination || !moveAgent(agent, destination, direction > 0)) {
        return;
      }
      for (let index = agent.routeIndex; index >= 0 && index < route.length; index += direction) {
        const cell = route[index];
        if (cell.x === agent.x && cell.y === agent.y) {
          agent.routeIndex = index + direction;
          break;
        }
      }
    }

    function knownPath(agent, start, goal, expansionBudget) {
      if (!isWalkable(start.x, start.y) || !isWalkable(goal.x, goal.y)) {
        return null;
      }
      const startKey = start.x + "," + start.y;
      const goalKey = goal.x + "," + goal.y;
      const open = [startKey];
      const openSet = new Set(open);
      const cameFrom = new Map();
      const cost = new Map([[startKey, 0]]);
      const coordinates = new Map([[startKey, { ...start }], [goalKey, { ...goal }]]);
      let expansions = 0;

      while (open.length > 0 && expansions < expansionBudget) {
        let bestIndex = 0;
        let bestEstimate = Infinity;
        for (let index = 0; index < open.length; index += 1) {
          const key = open[index];
          const cell = coordinates.get(key);
          const estimate =
            (cost.get(key) || 0) +
            Math.abs(goal.x - cell.x) +
            Math.abs(goal.y - cell.y);
          if (estimate < bestEstimate) {
            bestEstimate = estimate;
            bestIndex = index;
          }
        }

        const currentKey = open.splice(bestIndex, 1)[0];
        openSet.delete(currentKey);
        const current = coordinates.get(currentKey);
        if (currentKey === goalKey) {
          const path = [{ ...goal }];
          let traceKey = goalKey;
          while (cameFrom.has(traceKey)) {
            traceKey = cameFrom.get(traceKey);
            path.push({ ...coordinates.get(traceKey) });
          }
          path.reverse();
          return path;
        }

        expansions += 1;
        for (const neighbor of walkableNeighbors(current.x, current.y)) {
          const neighborKey = neighbor.x + "," + neighbor.y;
          if (
            neighborKey !== goalKey &&
            neighborKey !== startKey &&
            !agent.visited.has(neighborKey)
          ) {
            continue;
          }

          coordinates.set(neighborKey, { x: neighbor.x, y: neighbor.y });
          const nextCost = (cost.get(currentKey) || 0) + 1;
          if (!cost.has(neighborKey) || nextCost < cost.get(neighborKey)) {
            cameFrom.set(neighborKey, currentKey);
            cost.set(neighborKey, nextCost);
            if (!openSet.has(neighborKey)) {
              open.push(neighborKey);
              openSet.add(neighborKey);
            }
          }
        }
      }

      return null;
    }

    function bestKnownColonyRoute(agent, goal, expansionBudget, fallbackRoute) {
      let bestRoute = fallbackRoute;
      for (const accessCell of colonyBoundaryCells()) {
        const candidate = knownPath(agent, accessCell, goal, expansionBudget);
        if (candidate && (!bestRoute || candidate.length < bestRoute.length)) {
          bestRoute = candidate;
        }
      }
      return bestRoute;
    }

    function optimizeRememberedRoute(agent) {
      const route = agent.rememberedRoute;
      if (!route || route.length < 3 || agent.profile.routeSense <= 0) {
        return route;
      }

      const start = route[0];
      const goal = route[route.length - 1];
      const expansionBudget = Math.max(
        route.length,
        Math.floor(route.length * (1 + agent.profile.routeSense * 8))
      );
      const optimized = knownPath(agent, start, goal, expansionBudget);
      return optimized && optimized.length < route.length ? optimized : route;
    }

    function forgetFoodRoute(agent) {
      agent.targetFoodKey = null;
      agent.rememberedFoodKey = null;
      agent.sharedTrailFoodKey = null;
      agent.rememberedRoute = null;
      agent.memoryTripsRemaining = 0;
      agent.routeIndex = 0;
      agent.mode = "search";
      agent.path = [{ x: agent.x, y: agent.y }];
      agent.returnPath = [];
      agent.movementTargetKey = null;
      agent.movementVisits.clear();
    }

    function harvestAtCurrentCell(agent) {
      const foodCell = foodCellAt(agent.x, agent.y);
      if (!foodCell || foodCell.amount <= 0) {
        forgetFoodRoute(agent);
        return;
      }
      const isRememberedTrip =
        agent.mode === "commute" && agent.rememberedRoute;
      const followedRoad = agent.sharedTrailFoodKey === agent.x + "," + agent.y ?
        state.roads.get(agent.sharedTrailFoodKey) : null;
      const amount = Math.min(agent.stats.capacity, foodCell.amount);
      foodCell.amount -= amount;
      agent.carrying = amount;
      agent.sharedTrailFoodKey = null;
      agent.rememberedFoodKey = agent.x + "," + agent.y;

      if (!isRememberedTrip) {
        if (followedRoad && followedRoad.route.length >= 2) {
          agent.rememberedRoute = followedRoad.route.map((cell) => ({ ...cell }));
        } else {
          let boundaryIndex = 0;
          for (let index = agent.path.length - 1; index >= 0; index -= 1) {
            const cell = agent.path[index];
            if (isColonyBoundaryCell(cell.x, cell.y)) {
              boundaryIndex = index;
              break;
            }
          }
          agent.rememberedRoute = agent.path
            .slice(boundaryIndex)
            .map((cell) => ({ ...cell }));
        }
        agent.memoryTripsRemaining = agent.profile.memoryTrips;
      } else {
        agent.rememberedRoute = agent.path.map((cell) => ({ ...cell }));
      }

      agent.returnPath = [{ x: agent.x, y: agent.y }];
      agent.mode = "return";
      agent.routeIndex = agent.rememberedRoute.length - 2;
    }

    function depositFood(agent) {
      if (agent.returnPath.length > 0) {
        agent.rememberedRoute = agent.returnPath
          .map((cell) => ({ ...cell }))
          .reverse();
        agent.returnPath = [];
      }

      state.colonyFood += agent.carrying;
      state.evolutionPoints = Math.min(pointCapacity(), state.evolutionPoints + agent.carrying);
      agent.carrying = 0;
      registerRoadJourney(agent);

      const rememberedFood = agent.rememberedFoodKey ?
        foodCellMap.get(agent.rememberedFoodKey) : null;
      if (
        rememberedFood &&
        rememberedFood.amount > 0 &&
        agent.rememberedRoute &&
        agent.memoryTripsRemaining > 0
      ) {
        agent.rememberedRoute = optimizeRememberedRoute(agent);
        agent.memoryTripsRemaining -= 1;
        agent.mode = "commute";
        agent.routeIndex = 1;
        agent.path = [{ x: agent.x, y: agent.y }];
        return;
      }
      forgetFoodRoute(agent);
    }

    function stepAgent(agent) {
      const neighbors = walkableNeighbors(agent.x, agent.y)
        .filter((cell) => !isAgentCellOccupied(cell.x, cell.y, agent));
      if (agent.mode === "return") {
        if (isColonyBoundaryCell(agent.x, agent.y)) {
          depositFood(agent);
          return;
        }
        if (agent.rememberedRoute && agent.routeIndex >= 0) {
          moveAgentAlongRoute(agent, -1, neighbors);
          return;
        }
        const homeStep = chooseStepToward(
          agent,
          nearestColonyBoundaryCell(agent.x, agent.y),
          neighbors
        );
        if (homeStep) {
          moveAgent(agent, homeStep, false);
        }
        return;
      }

      if (agent.mode === "commute") {
        if (
          agent.rememberedRoute &&
          agent.routeIndex < agent.rememberedRoute.length
        ) {
          moveAgentAlongRoute(agent, 1, neighbors);
          return;
        }
        harvestAtCurrentCell(agent);
        return;
      }

      if (agent.mode === "approach") {
        const target = agent.targetFoodKey ?
          foodCellMap.get(agent.targetFoodKey) : null;
        if (!target || target.amount <= 0) {
          forgetFoodRoute(agent);
          return;
        }
        if (agent.x === target.x && agent.y === target.y) {
          harvestAtCurrentCell(agent);
          return;
        }
        const targetStep = chooseStepToward(agent, target, neighbors);
        if (targetStep) {
          moveAgent(agent, targetStep, true);
        }
        return;
      }

      const visibleFood = visibleFoodFor(agent);
      if (visibleFood) {
        agent.targetFoodKey = visibleFood.x + "," + visibleFood.y;
        agent.mode = "approach";
        return;
      }

      const explorationStep = chooseExplorationStep(agent, neighbors);
      if (explorationStep) {
        moveAgent(agent, explorationStep, true);
      }
    }

    function interpolatedAgentPosition(agent) {
      if (!agent.moveDuration) {
        return { x: agent.x, y: agent.y, progress: 1 };
      }
      const rawProgress = clamp(
        (state.simSeconds - agent.moveStartedAt) / agent.moveDuration,
        0,
        1
      );
      const smoothProgress = rawProgress * rawProgress * (3 - 2 * rawProgress);
      return {
        x: agent.renderFromX + (agent.x - agent.renderFromX) * smoothProgress,
        y: agent.renderFromY + (agent.y - agent.renderFromY) * smoothProgress,
        progress: rawProgress
      };
    }

    function slotCapacity() {
      return state.nestLevel + 3;
    }

    function pointCapacity() {
      return state.nestLevel * 100;
    }

    function upgradeCost() {
      return state.nestLevel * 40;
    }

    function attributeCounts(slots) {
      const counts = Object.fromEntries(ATTRIBUTES.map((attribute) => [attribute.key, 0]));
      for (const key of slots) counts[key] += 1;
      return counts;
    }

    function unitStats(attributes) {
      return {
        speed: AGENT_SPEED + attributes.feet * 0.5,
        capacity: AGENT_CAPACITY + attributes.arms * 2,
        vision: AGENT_VISION + attributes.antenna * 2,
        attack: 1 + attributes.strength * 2,
        health: 8 + attributes.shell * 4
      };
    }

    function agentSpeed(agent) {
      return agent.stats.speed;
    }

    function birthCost(template) {
      return 3 + template.slots.length * 2;
    }

    function spawnAgent(template, faction) {
      const position = chooseSpawnPosition();
      if (!position) return null;
      const attributes = attributeCounts(template.slots);
      const stats = unitStats(attributes);
      const agent = {
        id: colony.id + ":" + state.nextAgentId,
        ownerId: colony.ownerId,
        name: template.name + " " + state.nextAgentId,
        templateId: template.id,
        templateName: template.name,
        templateRevision: template.revision,
        slots: [...template.slots],
        attributes,
        stats,
        health: stats.health,
        faction,
        cost: birthCost(template),
        x: position.x,
        y: position.y,
        profile: { ...state.draftProfile },
        bornAt: state.simSeconds,
        carrying: 0,
        moveBudget: 0,
        mode: "search",
        targetFoodKey: null,
        rememberedFoodKey: null,
        sharedTrailFoodKey: null,
        rememberedRoute: null,
        memoryTripsRemaining: 0,
        routeIndex: 0,
        path: [{ ...position }],
        returnPath: [],
        movementTargetKey: null,
        movementVisits: new Map(),
        visited: new Set([position.x + "," + position.y]),
        lastDirection: null,
        straightSteps: 0,
        stepCount: 0,
        renderFromX: position.x,
        renderFromY: position.y,
        moveStartedAt: state.simSeconds,
        moveDuration: 0
      };
      state.nextAgentId += 1;
      state.agents.push(agent);
      return agent;
    }

    function isAgentCellOccupied(x, y, excludedAgent) {
      const occupied = (other) => other !== excludedAgent && other.health > 0 && (
        (other.x === x && other.y === y) ||
        (state.simSeconds - other.moveStartedAt < other.moveDuration &&
          other.renderFromX === x && other.renderFromY === y)
      );
      return state.agents.some(occupied) || state.rivals.some(occupied);
    }

    function dropCorpse(agent) {
      ensureFoodAround(agent.x, agent.y, 4);
      for (let radius = 0; radius <= 3; radius += 1) {
        for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
          for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            const x = agent.x + offsetX;
            const y = agent.y + offsetY;
            const key = x + "," + y;
            if (!isWalkable(x, y) || foodCellMap.get(key)?.amount > 0) continue;
            const corpse = { x, y, amount: Math.max(1, Math.floor(agent.cost / 2)) + agent.carrying,
              kind: "corpse", attributes: { ...agent.attributes } };
            foodCellMap.set(key, corpse);
            state.corpses.push(corpse);
            return;
          }
        }
      }
    }

    function removeDeadAgents() {
      for (const agent of state.agents) {
        if (agent.health > 0 && state.simSeconds - agent.bornAt < STARTER_OBJECT_LIFETIME) continue;
        dropCorpse(agent);
        agent.health = 0;
      }
      state.agents = state.agents.filter((agent) => agent.health > 0);

    }

    function stepCombat(agent) {
      const opponents = state.rivals;
      const target = opponents.filter((candidate) => candidate.health > 0)
        .sort((left, right) => Math.abs(agent.x - left.x) + Math.abs(agent.y - left.y) -
          Math.abs(agent.x - right.x) - Math.abs(agent.y - right.y))[0];
      if (!target) {
        if (agent.mode === "defend") forgetFoodRoute(agent);
        return false;
      }
      const distance = Math.abs(agent.x - target.x) + Math.abs(agent.y - target.y);
      if (distance > agent.stats.vision + 2 && agent.faction === "colony") {
        if (agent.mode === "defend") forgetFoodRoute(agent);
        return false;
      }
      if (distance <= 1) {
        target.health -= agent.stats.attack;
        if (agent.carrying === 0) agent.mode = "defend";
        removeDeadAgents();
        return true;
      }
      if (agent.carrying > 0 && agent.faction === "colony") return false;
      if (agent.mode !== "defend") forgetFoodRoute(agent);
      agent.mode = "defend";
      const neighbors = walkableNeighbors(agent.x, agent.y)
        .filter((cell) => !isAgentCellOccupied(cell.x, cell.y, agent));
      const step = chooseStepToward(agent, target, neighbors);
      if (step) moveAgent(agent, step, false);
      return true;
    }

    function updateAgents(elapsed) {
      removeDeadAgents();
      for (const agent of [...state.agents, ...state.rivals]) {
        if (agent.health <= 0) continue;
        agent.moveBudget = Math.min(1, agent.moveBudget + elapsed * agentSpeed(agent));
        if (agent.moveBudget < 1 || state.simSeconds - agent.moveStartedAt < agent.moveDuration) continue;
        agent.moveBudget -= 1;
        if (stepCombat(agent)) continue;
        if (agent.faction === "colony") stepAgent(agent);
      }
      state.corpses = [...foodCellMap.values()].filter((cell) => cell.kind === "corpse" && cell.amount > 0);
    }
    function requireName(value) {
      if (typeof value !== "string" || !value.trim() || value.trim().length > 24) {
        throw new Error("이름은 1~24자로 입력해 주세요.");
      }
      return value.trim();
    }

    function birth(template) {
      if (state.agents.length >= 200) throw new Error("생명체는 최대 200개까지 유지할 수 있습니다.");
      if (state.evolutionPoints < birthCost(template)) throw new Error("진화 포인트가 부족합니다.");
      const agent = spawnAgent(template, "colony");
      if (!agent) throw new Error("둥지 주변이 가득 찼습니다.");
      state.evolutionPoints -= birthCost(template);
      return agent.id;
    }

    function command(action) {
      if (action.type === "design") {
        const name = requireName(action.name);
        if (!Array.isArray(action.slots) || action.slots.length > slotCapacity() ||
          action.slots.some((key) => !ATTRIBUTES.some((attribute) => attribute.key === key))) {
          throw new Error("설계 속성을 다시 확인해 주세요.");
        }
        if (typeof action.birth !== "boolean") throw new Error("탄생 요청이 올바르지 않습니다.");
        const previous = state.templates.find((template) => template.id === action.templateId);
        if (action.templateId !== null && !previous) throw new Error("설계를 찾을 수 없습니다.");
        if (!previous && state.templates.length >= 100) throw new Error("설계는 최대 100개까지 저장할 수 있습니다.");
        if (state.templates.some((template) => template.id !== action.templateId && template.name === name)) {
          throw new Error("같은 이름의 설계가 있습니다.");
        }
        const template = { id: previous ? previous.id : state.nextTemplateId, name,
          slots: [...action.slots], revision: previous ? previous.revision + 1 : 1 };
        const agentId = action.birth ? birth(template) : null;
        if (previous) state.templates[state.templates.indexOf(previous)] = template;
        else {
          state.templates.push(template);
          state.nextTemplateId += 1;
        }
        return { templateId: template.id, agentId };
      }
      if (action.type === "birth") {
        const template = state.templates.find((candidate) => candidate.id === action.templateId);
        if (!template) throw new Error("설계를 찾을 수 없습니다.");
        return { agentId: birth(template) };
      }
      if (action.type === "upgrade") {
        if (state.nestLevel >= 20) throw new Error("최고 둥지 레벨입니다.");
        if (state.evolutionPoints < upgradeCost()) throw new Error("진화 포인트가 부족합니다.");
        state.evolutionPoints -= upgradeCost();
        state.nestLevel += 1;
        return {};
      }
      if (action.type === "rename") {
        const agent = state.agents.find((candidate) => candidate.id === action.agentId);
        if (!agent) throw new Error("생명체를 찾을 수 없습니다.");
        agent.name = requireName(action.name);
        return {};
      }
      throw new Error("지원하지 않는 요청입니다.");
    }

    function snapshot() {
      const visibleAgent = (agent) => {
        const { visited, movementVisits, path, returnPath, rememberedRoute, profile, ...visible } = agent;
        return visible;
      };
      return {
        simSeconds: state.simSeconds, colonyFood: state.colonyFood,
        evolutionPoints: state.evolutionPoints, nestLevel: state.nestLevel,
        templates: state.templates, agents: state.agents.map(visibleAgent),
        rivals: state.rivals.map((agent) => ({ ...visibleAgent(agent), faction: "rival" })),
        corpses: [...foodCellMap.values()].filter((cell) => cell.kind === "corpse" && cell.amount > 0),
        sharedTrails: [...state.sharedTrails], food: [...foodCellMap.values()]
      };
    }

    function save() {
      return JSON.stringify({ state: { ...state, rivals: [], corpses: [] } }, (key, value) =>
        value instanceof Map ? { collection: "Map", entries: [...value] } :
        value instanceof Set ? { collection: "Set", entries: [...value] } : value);
    }

    function restore(saved) {
      const data = JSON.parse(saved, (key, value) =>
        value?.collection === "Map" ? new Map(value.entries) :
        value?.collection === "Set" ? new Set(value.entries) : value);
      Object.assign(state, data.state);

    }

    return {
      command, snapshot, save, restore,
      get agents() { return state.agents; },
      prepare(simSeconds) {
        state.simSeconds = simSeconds;
        state.rivals = [...environment.games.values()].filter((game) => game !== this).flatMap((game) => game.agents);
      },
      tick(elapsed) {
        updateAgents(elapsed);
      }
    };
}
