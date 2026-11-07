import { cloneDna, validateDna, dnaAppearance, dnaUnitStats, dnaCanMove, basicGathererDna } from "./dna-unit.mjs";
import { CONQUEST_PACING, militaryAgent } from "./conquest-pacing.mjs";
import { isTemplateNameEdited, suggestTemplateName } from "./unit-template-names.mjs";
import { suggestAgentName } from "./agent-names.mjs";
import { tribeProductionTemplate } from "./tribe-production.mjs";
import { worldSize } from "./world-size.mjs";
import { ATTRIBUTES, ATTRIBUTE_SYNERGIES_ENABLED, isAttributeUnlocked, attributeCounts, migrateAttributeSlots, migrateAttributeLevels, attributeUpgradeCost, attributeUpgradeIssue, unitStats, unitCarryCapacity, unitTravelSpeed, unitTerrainSpeedMultiplier, birthCost, hasSynergy } from "./attributes.mjs";
import { createPersonality, personalityLabels, createUtilityAI } from "./utility.mjs";
import { NEST_LEVELS, nestUpgradeCost } from "./nests.mjs";
import { TRIBE_STARTING_UNITS, PLAYER_STARTING_POINTS, startingWorkerDna } from "./tribe-start.mjs";
import { colonySupply, recordColonyIncome, restoreColonyIncome } from "./colony-supply.mjs";
import { agentBirthDuration } from "./birth.mjs";
import { unitAppearanceForm } from "./unit-appearance.mjs";
import { CORPSE_LIFETIME, placeCorpse, expireCorpses } from "./corpses.mjs";
import { AGENT_ATTACK_DURATION, AGENT_ATTACK_HIT_TIME } from "./attack.mjs";
import { createRoadOptimizer } from "./roads.mjs";
import { createCombat, combatDisposition, canPursueCombat, colonyDefenseTarget, suspendDefenseWork } from "./combat.mjs";
import { RESOURCE_TYPES, resourceDefinition, resourceTypeForCell, canHarvestResource, migrateResourceType, isColonyFood, isResourceHabitat, populateColonyFood, resourceHarvestSeconds, resourceHarvestMultiplier } from "./resources.mjs";
import { burrowDistance, burrowApproaches } from "./burrows.mjs";
import { commandCheat } from "./cheats.mjs";
import { combatPrimary, combatProfile, migrateCombatStats } from "./combat-stats.mjs";
import { resourceHabitatSuitability } from "./resource-habitats.mjs";
import { tribeHazardKind, tribeTerrainWalkable } from "./tribe-environment.mjs";
import { createResourceStorage } from "./resource-storage.mjs";

export function createGame(environment, colony, savedGame) {
    populateColonyFood(environment);
    const combat = environment.combatSystem || (environment.combatSystem = createCombat(environment));
    const worldMap = environment.world;
    if (worldMap.hazards) for (let index = 0; index < worldMap.hazards.length; index++) if (worldMap.hazards[index] === 1 || worldMap.hazards[index] === 2) worldMap.hazards[index] = 0;
    const WORLD_SIZE = worldSize(worldMap);

    const COLONY_SIZE = 5;

    const COLONY_ORIGIN = { x: colony.x, y: colony.y };

    const COLONY_CENTER = {
      x: COLONY_ORIGIN.x + COLONY_SIZE / 2,
      y: COLONY_ORIGIN.y + COLONY_SIZE / 2
    };

    const colonyEntries = [colony];

    const FOOTPRINT_LIFETIME = 180;

    const AGENT_SPEED = 1;

    const AGENT_CAPACITY = 2;

    const AGENT_VISION = 3;

    const FOOD_PER_CELL = 50;

    const FOOD_REGION_SIZE = 18;

    const FOOD_SCENT_RADIUS = 6;

    const FOOD_SCENT_GUIDANCE_CHANCE = 0.82;

    const SHARED_TRAIL_FOLLOW_CHANCE = 0.86;

    const TERRAIN_TYPES = [
      "deep", "shallow", "coast", "land", "grassland",
      "forest", "lowMountain", "highMountain", "ridge", "swamp", "ford"
    ];

    const foodSpotCache = environment.foodSpots;
    const foodCellMap = environment.food;

    const state = {
      simSeconds: environment.simSeconds || 0,
      colonyFood: 0,
      foodIncome: [],
      foodIncomeStartedAt: environment.simSeconds || 0,
      lastFoodAt: environment.simSeconds || 0,
      ending: null,
      resourceInventory: {},
      evolutionPoints: 0,
      startingPointsGranted: false,
      explored: new Set(),
      knownFood: new Map(),
      discoveries: [],
      discoveredKinds: new Set(),
      discoveryReadCount: 0,
      markers: [],
      rulesVersion: 2,
      nestLevel: 1,
      nestHealth: NEST_LEVELS[0].health,
      templates: [],
      nextTemplateId: 1,
      rivals: [],
      corpses: [],
      productionReadyAt: 0,
      attributeProductionReadyAt: 0,
      nextAgentId: 1,
      agents: [],
      roads: new Map(),
      sharedTrails: new Map(),
      footprints: new Map(),
      draftProfile: {
        direction: 0.65,
        novelty: 0.7,
        richness: 0.45,
        memoryTrips: 8,
        routeSense: 0.55
      }
    };

    let visibleCells = new Set();
    const decisionSchedule = new WeakMap();
    let decisionTargets = null;
    let removedFoodKeys = new Set();
    let decisionTargetRevision = -1;
    let discoveryBaselinePending = false;
    let updatingAgents = false;
    let footprintCleanupAt = 0;
    const resourceStorage = createResourceStorage(state, colony);
    let navigationCache = null;
    const utilityAI = createUtilityAI({ state, tribe: colony.tribe, size: WORLD_SIZE, homeCells: colonyBoundaryCells,
      deliveryCells: colonyDeliveryCells, permanentVisionSources, defenseStructures,
      canMove: (agent, x, y) => dnaCanMove(agent, x, y, colonyEntries),
      terrainAt: (x, y) => worldMap.terrain[y * WORLD_SIZE + x],
      walkable: (x, y) => state.explored.has(y * WORLD_SIZE + x) && isWalkable(x, y),
      hazardAt: (x, y) => state.explored.has(y * WORLD_SIZE + x) ? hazardAt(x, y) : 0,
      enemies: () => state.rivals.filter(enemy => !enemy.hidden && visibleCells.has(enemy.y * WORLD_SIZE + enemy.x)), burrows: visibleBurrows, nests: visibleNests, synergy,
      resourceType: food => resourceTypeForCell(food, worldMap),
      harvestSeconds: (type, agent) => agent?.dna ? agent.stats.dna.harvestTime : resourceHarvestSeconds(type, worldMap) * resourceHarvestMultiplier(type, agent?.attributes, agent?.tribe || colony.tribe) / (agent?.stats?.harvestSpeedMultiplier ?? 1),
      materialSpace: () => resourceSpace(), deliveryCapacity,
      isFood: type => isColonyFood(type, colony.tribe, worldMap.generationVersion),
      foodType: {bean:"clay",spore:"tree",pebble:"pebbles",spring:"dew"}[colony.tribe || "bean"],
      resourceHabitat: (type,x,y) => worldMap.hydrology?.resourceHabitats ?
        resourceHabitatSuitability(type, y * WORLD_SIZE + x, worldMap.terrain, worldMap.hydrology) : Number(isResourceHabitat(type, worldMap, x, y)),
      canHarvest: (food, agent) => (!agent.dna || agent.stats.dna.harvest > 0) && canHarvestResource(food, worldMap, agent.attributes, colony.tribe) });
    const roadOptimizer = createRoadOptimizer({ size: WORLD_SIZE, boundary: colonyDeliveryCells,
      neighbors: walkableNeighbors, explored: index => state.explored.has(index),
      apply(road, route) {
        const previous = road.route;
        road.route = route;
        road.optimizationCount += 1;
        rebuildSharedTrailIndex(road, previous);
      } });

    function synergy(agent, keys) {
      return hasSynergy(agent.attributes, keys);
    }

    function hazardAt(x, y) {
      return tribeHazardKind(colony.tribe || "bean", worldMap.hazards?.[y * WORLD_SIZE + x] || 0);
    }

    function recordDiscovery(key, kind, name, target, observer) {
      if (state.discoveredKinds.has(key)) return;
      state.discoveredKinds.add(key);
      state.discoveries.push({ key, kind, name, x: target.x, y: target.y,
        discoveredAt: state.simSeconds, discoveredBy: observer?.name || "둥지" });
    }

    function discoverResource(food, observer) {
      if (food.kind === "corpse") return;
      const definition = resourceDefinition(resourceTypeForCell(food, worldMap));
      if (!definition) return;
      recordDiscovery(definition.category + ":" + definition.key, definition.category, definition.name, food, observer);
    }

    function discoveryObserver(target) {
      return state.agents.find(agent => {
        if (agent.health <= 0 || agent.birth && state.simSeconds < agent.birth.readyAt) return false;
        const x = Math.max(target.x, Math.min(agent.x, target.x + (target.width || 1) - 1));
        const y = Math.max(target.y, Math.min(agent.y, target.y + (target.height || 1) - 1));
        return Math.hypot(x - agent.x, y - agent.y) <= agent.stats.vision + (agent.waveUntil > state.simSeconds ? 4 : 0);
      });
    }

    function discoverObjects() {
      for (const target of state.rivals) {
        if (target.health <= 0 || target.hidden || !visibleCells.has(target.y * WORLD_SIZE + target.x)) continue;
        recordDiscovery("creature:" + (target.species || "bean"), "creature",
          target.species ? target.name : "다른 군체의 콩", target, discoveryObserver(target));
      }
      for (const burrow of visibleBurrows()) {
        recordDiscovery("burrow:" + burrow.type, "burrow", burrow.type === "small" ? "작은 굴" : "큰 굴",
          burrow, discoveryObserver(burrow));
      }
      for (const entry of environment.colonies) {
        const target = { x: entry.x + 2, y: entry.y + 2 };
        if (entry.id === colony.id || !visibleCells.has(target.y * WORLD_SIZE + target.x)) continue;
        recordDiscovery("colony", "colony", "다른 군체의 둥지", target, discoveryObserver(target));
      }
    }

    function revealAround(x, y, radius, observer) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const cx = x + dx, cy = y + dy;
          if (cx < 0 || cy < 0 || cx >= WORLD_SIZE || cy >= WORLD_SIZE || dx * dx + dy * dy > radius * radius) continue;
          const index = cy * WORLD_SIZE + cx;
          if (visibleCells.has(index)) continue;
          visibleCells.add(index);
          state.explored.add(index);
          const key = cx + "," + cy;
          if (worldMap.treeCells?.[index]) discoverResource({ x: cx, y: cy, resourceType: "tree", kind: "tree" }, observer);
          const food = foodCellMap.get(key);
          if (food?.kind !== "corpse" && food?.amount > 0) {
            state.knownFood.set(key, { ...food });
            discoverResource(food, observer);
          }
          else if (food?.resourceType === "tree") state.knownFood.set(key, { ...food });
          else state.knownFood.delete(key);
        }
      }
    }

    function permanentVisionSources() {
      return state.nestHealth > 0 ? [{ x: COLONY_ORIGIN.x + 2, y: COLONY_ORIGIN.y + 2, radius: 6 }] : [];
    }

    function updatePerception() {
      expireCorpses(foodCellMap, state.simSeconds);
      state.rivals = state.rivals.filter(agent => agent.health > 0 || agent.mode === "death" &&
        state.simSeconds < agent.deathStartedAt + CORPSE_LIFETIME);
      decisionTargets = null;
      visibleCells = new Set();
      for (const source of permanentVisionSources()) revealAround(source.x, source.y, source.radius, null);
      for (const [key, known] of state.knownFood) {
        if (known.kind === "corpse" || key !== known.x + "," + known.y && visibleCells.has(known.y * WORLD_SIZE + known.x) &&
            !(foodCellMap.get(key)?.amount > 0)) state.knownFood.delete(key);
      }
      for (const corpse of foodCellMap.values()) {
        if (corpse.kind !== "corpse" || corpse.colonyId !== colony.id || state.simSeconds >= corpse.decaysAt) continue;
        revealAround(corpse.x, corpse.y, 1, null);
      }
      const markers = new Map();
      for (const agent of state.agents) {
        if (agent.health <= 0 || agent.birth && state.simSeconds < agent.birth.readyAt) continue;
        revealAround(agent.x, agent.y, agent.stats.vision + (agent.waveUntil > state.simSeconds ? 4 : 0), agent);
      }
      for (const agent of state.agents) {
        if (agent.health <= 0 || agent.birth && state.simSeconds < agent.birth.readyAt || !synergy(agent, ["antenna", "antenna"])) continue;
        for (let dy = -18; dy <= 18; dy++) {
          for (let dx = -18; dx <= 18; dx++) {
            const x = agent.x + dx, y = agent.y + dy, index = y * WORLD_SIZE + x;
            if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE || dx * dx + dy * dy > 324 || visibleCells.has(index)) continue;
            const food = foodCellMap.get(x + "," + y);
            const unknownFood = food?.amount > 0 && food.kind !== "corpse" && !state.knownFood.has(x + "," + y);
            const landmark = terrainAt(x, y) === "lowMountain" && hashNoise(x + (worldMap.seed || 0), y) < 0.012;
            if (unknownFood || landmark && !state.explored.has(index)) markers.set(index, { x, y });
          }
        }
        for (const target of [...state.rivals, ...environment.colonies.filter(entry => entry.id !== colony.id).map(entry => ({ x: entry.x + 2, y: entry.y + 2 }))]) {
          const index = target.y * WORLD_SIZE + target.x;
          if (Math.hypot(target.x - agent.x, target.y - agent.y) <= 18 && !visibleCells.has(index)) markers.set(index, { x: target.x, y: target.y });
        }
      }
      for (const [key, food] of foodCellMap) {
        if (key === food.x + "," + food.y || !visibleCells.has(food.y * WORLD_SIZE + food.x)) continue;
        if (food.kind !== "corpse" && food.amount > 0) {
          state.knownFood.set(key, { ...food });
          discoverResource(food, discoveryObserver(food));
        } else state.knownFood.delete(key);
      }
      state.markers = [...markers.values()];
      discoverObjects();
    }

    function agentAppearanceAttributes(agent) {
      return agent.dna ? dnaAppearance(agent.dna) : { ...agent.attributes };
    }

    function initializeAgent(agent) {
      agent.dna = cloneDna(agent.dna);
      if (agent.productionRole === "scout") agent.productionRole = null;
      if (agent.utility?.action === "explore" && !/^(enemy|resource)-search:/.test(agent.utility.target?.key || "")) {
        agent.utility = null;
        agent.mode = "search";
        agent.decisionPending = "restore";
      }
      agent.moveAnimationStartedAt ??= agent.moveStartedAt;
      if (agent.attack?.dnaRanged) { agent.attack = null; agent.attackTargetId = null; }
      agent.dnaActionEvent = null; agent.dnaProjectiles = [];
      agent.attributeLevels = migrateAttributeLevels(agent.slots, agent.attributeLevels, state.nestLevel);
      agent.slots = migrateAttributeSlots(agent.slots);
      agent.combatPrimary = combatPrimary(agent);
      if (agent.health <= 0 || agent.combat && agent.combat.version !== 2 || agent.attack?.exchange) {
        agent.combat = null;
        agent.attack = null;
      }
      delete agent.support;
      if (agent.combat) { delete agent.combat.secretionBonus; delete agent.combat.secretionActive; delete agent.combat.guardProtection; }
      agent.tribe = colony.tribe || "bean";
      agent.cost = Math.round(agent.cost);
      if (["pebble", "spore"].includes(agent.tribe) && agent.birth) agent.birth.readyAt = agent.birth.startedAt + agentBirthDuration(agent.tribe);
      agent.bornAt = Number.isFinite(agent.bornAt) && agent.bornAt >= 0 && agent.bornAt <= state.simSeconds ? agent.bornAt : state.simSeconds;
      const removedWork = !!agent.construction || ["transform", "build"].includes(agent.mode);
      for (const key of ["lifespan", "construction", "constructionIntent", "constructionError", "constructionRetryAt", "transport", "transportCargo", "transportReadyAt"]) delete agent[key];
      if (removedWork || ["build", "supply"].includes(agent.utility?.action)) {
        agent.utility = null;
        agent.mode = "search";
        agent.decisionPending = "restore";
      }
      if (agent.birth) {
        delete agent.birth.buildingId;
        Object.assign(agent.birth, { sourceX:colony.x, sourceY:colony.y, sourceWidth:COLONY_SIZE, sourceHeight:COLONY_SIZE,
          fromX:COLONY_CENTER.x - .5, fromY:COLONY_CENTER.y - .5 });
      }
      const carryingType = migrateResourceType(agent.carryingType);
      if (agent.carryingType != null && carryingType === null) { agent.utility = null; agent.suspendedWork = null; }
      if (carryingType === null) agent.carrying = 0;
      agent.carryingType = carryingType;
      const removedTarget = target => target?.resourceType != null && migrateResourceType(target.resourceType) === null || typeof target?.key === "string" && (target.key.startsWith("corpse:") ||
        removedFoodKeys.has(target.key) || foodCellMap.get(target.key)?.kind === "corpse");
      if (removedTarget(agent.utility?.target) || migrateResourceType(agent.utility?.resourceType) === null) {
        agent.utility = null;
        agent.mode = agent.birth && state.simSeconds < agent.birth.readyAt ? "birth" : "search";
        agent.decisionPending = "targetLost";
      }
      if (removedTarget(agent.suspendedWork?.target) || agent.suspendedWork?.resourceType != null && migrateResourceType(agent.suspendedWork.resourceType) === null) agent.suspendedWork = null;
      if (removedTarget({ key: agent.rememberedFoodKey })) {
        agent.rememberedFoodKey = null;
        agent.rememberedRoute = null;
        agent.returnPath = null;
      }
      if (agent.appearanceAttributes) {
        delete agent.appearanceAttributes.butchery;
        delete agent.appearanceAttributes.condensation;
        delete agent.appearanceAttributes.construction;
        delete agent.appearanceAttributes.lifespan;
        delete agent.appearanceAttributes.guard;
        delete agent.appearanceAttributes.regeneration;
        delete agent.appearanceAttributes.excavation;
      }
      for (const key of ["foodDelivery", "harvestResult"]) {
        if (!agent[key]) continue;
        const type = migrateResourceType(agent[key].resourceType);
        if (type === null || agent[key].kind === "corpse") agent[key] = null;
        else {
          delete agent[key].buildingId;
          if (type) agent[key].resourceType = type;
        }
      }
      agent.carryingType = agent.carrying > 0 ? resourceDefinition(agent.carryingType)?.key || "honey-mushrooms" : null;
      if (agent.foodDelivery && !agent.foodDelivery.resourceType) agent.foodDelivery.resourceType = agent.carryingType || "honey-mushrooms";
      if (!agent.personality || !["boldness", "aggression", "curiosity"].every(key =>
        Number.isFinite(agent.personality[key]) && agent.personality[key] >= 0 && agent.personality[key] <= 1)) {
        const seed = [...String(agent.id)].reduce((value, character) => Math.imul(value, 31) + character.charCodeAt(0), worldMap.seed || 0);
        let axis = 0;
        agent.personality = createPersonality(() => hashNoise(seed + ++axis * 17417, (agent.bornAt || 0) + axis * 7919));
      } else agent.personality = Object.freeze({ ...agent.personality });
      if (!["collect", "return"].includes(agent.suspendedWork?.action) || typeof agent.suspendedWork?.target?.key !== "string" ||
          !Number.isInteger(agent.suspendedWork.target.x) || !Number.isInteger(agent.suspendedWork.target.y)) agent.suspendedWork = null;
      if (!Number.isSafeInteger(agent.defenseRevision) || agent.defenseRevision < 0) agent.defenseRevision = 0;
      agent.knownEnemyIds = agent.knownEnemyIds instanceof Set ? agent.knownEnemyIds : new Set();
      if (agent.decisionPending === undefined) agent.decisionPending = "birth";
      agent.nextDecisionAt = Number.isFinite(agent.nextDecisionAt) ? agent.nextDecisionAt : state.simSeconds;
      for (const key of ["level", "growthActivity", "activeSlots", "perceptionExperienceReady", "experienceContributions", "experienceKillAwarded"]) delete agent[key];
      migrateCombatStats(agent);
      const healthRatio = agent.dna && Number.isFinite(agent.stats?.health) && agent.stats.health > 0 ?
        Math.max(0, Math.min(1, agent.health / agent.stats.health)) : null;
      agent.stats = agent.dna ? dnaUnitStats(agent.dna, agent.tribe) : unitStats(attributeCounts(agent.slots, agent.attributeLevels), agent.tribe);
      agent.attributes = agent.dna ? { ...dnaAppearance(agent.dna), dnaGather: agent.stats.harvest > 0 } : attributeCounts(agent.slots, agent.attributeLevels);
      agent.health = healthRatio === null ? Math.min(agent.health, agent.stats.health) : agent.stats.health * healthRatio;
      agent.appearanceAttributes = agentAppearanceAttributes(agent);
      agent.stats.resistance = 1;
      agent.shield = 0;
      agent.shieldUntil = 0;
      agent.shieldReady = agent.shieldReady || 0;
      agent.warningUntil = 0;
      agent.warningReady = agent.warningReady || 0;
      agent.hazardKind = agent.hazardKind || 0;
      agent.hazardExposure = agent.hazardExposure || 0;
      agent.lastHazardAt = agent.lastHazardAt || 0;
      agent.lastHazardKind = agent.lastHazardKind || agent.hazardKind;
      agent.waveUntil = ATTRIBUTE_SYNERGIES_ENABLED ? agent.waveUntil || 0 : 0;
      agent.preciseHarvestTimes = agent.preciseHarvestTimes instanceof Map ? agent.preciseHarvestTimes : new Map();
      for (const key of agent.preciseHarvestTimes.keys()) if (removedTarget({ key })) agent.preciseHarvestTimes.delete(key);
      agent.harvestReady = agent.harvestReady || 0;
      agent.harvestStarted = agent.harvestStarted || 0;
      if (!Number.isSafeInteger(agent.harvestResult?.sequence) || agent.harvestResult.sequence < 1 ||
        !Number.isFinite(agent.harvestResult.completedAt)) agent.harvestResult = null;
      agent.unloadReady = agent.unloadReady || 0;
      agent.attackReady = agent.attackReady || 0;
      agent.attack = agent.attack || null;
    }

    function damageAgent(agent, amount, environmental) {
      if (environmental && agent.warningUntil > state.simSeconds) return;
      let damage = amount;
      if (environmental) {
        damage *= agent.stats.resistance;
        if (synergy(agent, ["shell", "shell"]) && agent.hazardExposure >= 1) damage *= 0.1;
      }
      if (agent.shieldUntil > state.simSeconds) {
        const absorbed = Math.min(agent.shield, damage);
        agent.shield -= absorbed;
        damage -= absorbed;
      }
      agent.health = Math.max(0, agent.health - damage);
      if (!environmental && damage > 0) {
        agent.hurtStartedAt = state.simSeconds;
        agent.hurtCount = (agent.hurtCount || 0) + 1;
      }
      if (amount > 0 && state.agents.includes(agent)) agent.decisionPending = "damage";
      if (damage > 0 && synergy(agent, ["strength", "shell"]) && state.simSeconds >= agent.shieldReady) {
        agent.shield = 4;
        agent.shieldUntil = state.simSeconds + 4;
        agent.shieldReady = state.simSeconds + 12;
      }
    }

    function updateEnvironment(agent, elapsed) {
      const kind = hazardAt(agent.x, agent.y);
      const active = kind === 1;
      if (active) {
        if (agent.lastHazardKind !== kind || state.simSeconds - agent.lastHazardAt >= 5) agent.hazardExposure = 0;
        if (agent.hazardKind !== kind && synergy(agent, ["antenna", "shell"]) && state.simSeconds >= agent.warningReady) {
          agent.warningUntil = state.simSeconds + 1;
          agent.warningReady = state.simSeconds + 15;
        }
        agent.hazardKind = kind;
        agent.lastHazardKind = kind;
        damageAgent(agent, 0.3 * elapsed, true);
        agent.hazardExposure += elapsed;
        agent.lastHazardAt = state.simSeconds;
      } else {
        if (!kind) agent.hazardKind = 0;
        if (state.simSeconds - agent.lastHazardAt >= 5) agent.hazardExposure = 0;
      }
    }

    function colonyAt(x, y) {
      return environment.colonies.find((entry) =>
        x >= entry.x && y >= entry.y && x < entry.x + COLONY_SIZE && y < entry.y + COLONY_SIZE &&
        entry.occupiedCells.has((x - entry.x) + "," + (y - entry.y)) && environment.games.get(entry.ownerId)?.nest?.health !== 0
      ) || null;
    }

    function navigationState() {
      if (!navigationCache) return null;
      if (navigationCache.revision !== environment.targetRevision ||
          navigationCache.explored !== state.explored.size) {
        navigationCache = { revision: environment.targetRevision, explored: state.explored.size,
          walkable: new Int8Array(WORLD_SIZE * WORLD_SIZE), routes: new Map(), boundary: null };
      }
      return navigationCache;
    }

    function activeNestSites() {
      return state.nestHealth > 0 ? colonyEntries : [];
    }

    function hasActiveNest() {
      return state.nestHealth > 0;
    }

    function isColonyBoundaryCell(x, y) {
      if (!hasActiveNest() || !isWalkable(x, y)) {
        return false;
      }
      return activeNestSites().some(site => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([cx, cy]) => site.occupiedCells.has((cx - site.x) + "," + (cy - site.y))));
    }

    function colonyBoundaryCells() {
      if (!hasActiveNest()) return [];
      const navigation = navigationState();
      if (navigation?.boundary) return navigation.boundary;
      const cells = [];
      const seen = new Set();
      for (const entry of activeNestSites()) {
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
      if (navigation) navigation.boundary = cells;
      return cells;
    }

    function colonyDeliveryCells(agent) {
      const stores = resourceStorage.refresh().filter(store => store.kind !== "remains");
      const material = agent && agent.carrying > 0 && !isColonyFood(agent.carryingType, colony.tribe, worldMap.generationVersion);
      return stores.filter(store => !agent || resourceStorage.space(store) > 1e-8 ||
        !material && state.evolutionPoints < pointCapacity()).flatMap(store => resourceStorage.cells(store)).filter(cell => isWalkable(cell.x, cell.y));
    }

    function isColonyDeliveryCell(x, y) {
      return colonyDeliveryCells().some(cell => cell.x === x && cell.y === y);
    }

    function deliveryDestination(agent) {
      return { targetX: COLONY_CENTER.x, targetY: COLONY_CENTER.y };
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

    function spawnBoundaryCells() {
      return colonyBoundaryCells();
    }

    function availableSpawnCells() {
      const available = spawnBoundaryCells().filter(cell => !isAgentCellOccupied(cell.x, cell.y, null));
      return colony.tribe === "spring" || colony.tribe === "pebble" ? available.filter(cell => cell.y >= colony.y + 1) : available;
    }

    function chooseSpawnPosition(randomized) {
      if (randomized) {
        const available = availableSpawnCells();
        return available.length ? { ...available[Math.floor(Math.random() * available.length)] } : null;
      }
      const cells = spawnBoundaryCells();
      const startingUnits = TRIBE_STARTING_UNITS[colony.tribe] || TRIBE_STARTING_UNITS.bean;
      const startIndex = Math.floor((state.nextAgentId - 1) * cells.length / startingUnits.length) % cells.length;
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

    function foodCellAt(x, y, agent) {
      ensureFoodAround(x, y, 1);
      const target = foodCellMap.get(agent.utility?.target?.key);
      return target?.x === x && target.y === y ? target : foodCellMap.get(x + "," + y) || null;
    }

    function isWalkable(x, y) {
      if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return false;
      const navigation = navigationState(), index = y * WORLD_SIZE + x;
      if (navigation?.walkable[index]) return navigation.walkable[index] > 0;
      const walkable = !colonyAt(x, y) && !environment.creatureSystem?.burrowAt?.(x, y) &&
        tribeTerrainWalkable(colony.tribe, worldMap.terrain[index]);
      if (navigation) navigation.walkable[index] = walkable ? 1 : -1;
      return walkable;
    }

    function walkableNeighbors(x, y) {
      return [
        { x: x + 1, y, dx: 1, dy: 0 },
        { x: x - 1, y, dx: -1, dy: 0 },
        { x, y: y + 1, dx: 0, dy: 1 },
        { x, y: y - 1, dx: 0, dy: -1 }
      ].filter((cell) => isWalkable(cell.x, cell.y));
    }

    function moveAgent(agent, destination, rememberPath, startedAt) {
      if (!dnaCanMove(agent, destination.x, destination.y, colonyEntries)) return false;
      if (state.simSeconds - agent.moveStartedAt < agent.moveDuration) {
        return false;
      }
      if (agent.utility?.action === "explore" && !state.explored.has(destination.y * WORLD_SIZE + destination.x) ||
        !isWalkable(destination.x, destination.y) ||
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
      const previousEnd = agent.moveStartedAt + agent.moveDuration;
      agent.moveAnimationStartedAt = agent.moveDuration > 0 && Math.abs(startedAt - previousEnd) <= 1e-8 ?
        agent.moveAnimationStartedAt ?? agent.moveStartedAt : startedAt;
      agent.moveStartedAt = startedAt;
      agent.x = destination.x;
      agent.y = destination.y;
      agent.moveDuration = Math.min(1, 1 / agentSpeed(agent));
      agent.stepCount += 1;
      const footprintKey = agent.x + "," + agent.y;
      let footprint = state.footprints.get(footprintKey);
      if (!footprint) {
        footprint = { x: agent.x, y: agent.y, visits: 0, marks: [] };
        state.footprints.set(footprintKey, footprint);
      }
      const footprintSeed = [...String(agent.id)].reduce((value, letter) => Math.imul(value, 31) + letter.charCodeAt(0), worldMap.seed || 0);
      footprint.visits += 1;
      footprint.marks.push({ ...nextDirection,
        tribe: agent.tribe || colony.tribe || "bean",
        seed: hashNoise(footprintSeed, agent.stepCount) * 100000,
        startedAt: agent.moveStartedAt,
        grounded: Boolean((agent.appearanceAttributes || agent.attributes).feet || ["spore", "pebble", "spring"].includes(agent.tribe || colony.tribe)),
        at: agent.moveStartedAt + agent.moveDuration });
      if (footprint.marks.length > 6) footprint.marks.shift();
      if (synergy(agent, ["feet", "antenna"]) && agent.stepCount % 8 === 0) agent.waveUntil = state.simSeconds + 1;
      agent.visited.add(agent.x + "," + agent.y);
      if (rememberPath) {
        agent.path.push({ x: agent.x, y: agent.y });
      } else {
        agent.returnPath.push({ x: agent.x, y: agent.y });
      }
      environment.unitIndex?.update(agent);
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
          const foodCell = state.knownFood.get((x + offsetX) + "," + (y + offsetY));
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

    function rebuildSharedTrailIndex(road, previousRoute) {
      for (const cell of previousRoute) {
        const cellKey = cell.x + "," + cell.y;
        const entries = state.sharedTrails.get(cellKey);
        if (!entries) continue;
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
      const previousRoute = road.route;
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

      rebuildSharedTrailIndex(road, previousRoute);
      roadOptimizer.enqueue(road);
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
        const foodCell = state.knownFood.get(entry.foodKey);
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
        const foodCell = state.knownFood.get(agent.sharedTrailFoodKey);
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

      const marker = state.markers.toSorted((first, second) =>
        Math.hypot(first.x - agent.x, first.y - agent.y) - Math.hypot(second.x - agent.x, second.y - agent.y))[0];
      if (marker) return chooseStepToward(agent, marker, neighbors);

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
      if (!destination || !moveAgent(agent, destination, direction > 0, state.simSeconds)) {
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
          if (!state.explored.has(neighbor.y * WORLD_SIZE + neighbor.x)) continue;
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
      const food = foodCellAt(agent.x, agent.y, agent);
      if (!food || food.amount <= 0 || agent.dna && !agent.stats.dna.harvest || !canHarvestResource(food, worldMap, agent.attributes, colony.tribe) ||
        agent.carrying > 0 && (agent.carryingType || "honey-mushrooms") !== resourceTypeForCell(food, worldMap)) {
        agent.decisionPending = "targetLost"; return;
      }
      agent.harvestResourceKey = food.key || agent.x + "," + agent.y;
      agent.harvestWasCommute = agent.mode === "commute";
      agent.mode = "harvest";
      agent.harvestStarted = state.simSeconds;
      agent.harvestReady = state.simSeconds + 1;
      agent.harvestPrepared = false;
      agent.rememberedFoodKey = food.key || agent.x + "," + agent.y;
      agent.straightSteps = 0;
    }

    function updateHarvest(agent) {
      if (state.simSeconds < agent.harvestReady) return;
      const key = agent.x + "," + agent.y;
      const food = foodCellAt(agent.x, agent.y, agent);
      const resourceType = resourceTypeForCell(food, worldMap);
      if (agent.dna && !agent.stats.dna.harvest || !canHarvestResource(food, worldMap, agent.attributes, colony.tribe) || agent.carrying > 0 && (agent.carryingType || "honey-mushrooms") !== resourceType) {
        agent.decisionPending = "targetLost"; return;
      }
      const harvestSeconds = agent.dna ? agent.stats.dna.harvestTime : resourceHarvestSeconds(resourceType, worldMap) * resourceHarvestMultiplier(resourceType, agent.attributes, agent.tribe || colony.tribe) / (agent.stats.harvestSpeedMultiplier ?? 1);
      const capacity = Math.min(agent.utility?.plannedCargo ?? Infinity,
        unitCarryCapacity(agent, resourceType) + (synergy(agent, ["strength", "strength"]) ? 4 : 0));
      const take = (amount, completedAt) => {
        const collected = Math.min(amount, Math.max(0, capacity - agent.carrying), Math.max(0, food?.amount || 0));
        if (collected > 0) {
          food.amount = Math.round((food.amount - collected) * 10) / 10;
          agent.carrying = Math.round((agent.carrying + collected) * 10) / 10;
          agent.carryingType = resourceType;
          agent.harvestResult = {
            sequence: (agent.harvestResult?.sequence || 0) + 1, resourceType, x: food.x, y: food.y,
            amount: collected, remaining: food.amount, initialAmount: food.initialAmount ?? food.amount + collected,
            dropped: !!food.dropped,
            kind: food.kind || (resourceDefinition(resourceType).category === "material" ? "resource" : "food"),
            terrain: food.terrain || terrainAt(food.x, food.y), completedAt
          };
          if (!food.dropped && resourceType === "tree" && food.amount <= 0) {
            if (!worldMap.depletedTrees) worldMap.depletedTrees = new Set();
            worldMap.depletedTrees.add(food.y * WORLD_SIZE + food.x);
            if (worldMap.treeCells) worldMap.treeCells[food.y * WORLD_SIZE + food.x] = 0;
          }
          if (food.dropped && food.amount <= 0) {
            foodCellMap.delete(food.key || key);
            state.knownFood.delete(food.key || key);
          }
        }
      };
      if (!agent.harvestPrepared) {
        agent.harvestPrepared = true;
        if (synergy(agent, ["strength", "antenna"]) && state.simSeconds - (agent.preciseHarvestTimes.get(key) ?? -Infinity) >= 30) {
          take(2, agent.harvestReady);
          agent.preciseHarvestTimes.set(key, state.simSeconds);
        }
        agent.harvestReady += harvestSeconds;
      } else {
        while (state.simSeconds >= agent.harvestReady && agent.carrying < capacity && food?.amount > 0 &&
          resourceTypeForCell(food, worldMap) === resourceType) {
          take(1, agent.harvestReady);
          agent.harvestReady += harvestSeconds;
        }
      }
      if (agent.carrying >= capacity || !food || food.amount <= 0 ||
        resourceTypeForCell(food, worldMap) !== resourceType) agent.decisionPending = "completed";
    }

    function returnToColony(agent) {
      const isRememberedTrip =
        (agent.harvestWasCommute || agent.mode === "commute") && agent.rememberedRoute;
      const followedRoad = agent.sharedTrailFoodKey === agent.x + "," + agent.y ?
        state.roads.get(agent.sharedTrailFoodKey) : null;
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
      agent.harvestWasCommute = false;
      agent.routeIndex = agent.rememberedRoute.length - 2;
    }

    function depositFood(agent) {
      if (!hasActiveNest()) return;
      if (agent.returnPath.length > 0) {
        agent.rememberedRoute = agent.returnPath
          .map((cell) => ({ ...cell }))
          .reverse();
        agent.returnPath = [];
      }

      const resourceType = agent.carryingType || "honey-mushrooms";
      const material = !isColonyFood(resourceType, colony.tribe, worldMap.generationVersion);
      const availablePoints = Math.max(0, pointCapacity() - state.evolutionPoints);
      const store = resourceStorage.at(agent.x, agent.y);
      const availableMaterials = resourceStorage.space(store);
      const deposited = Math.min(agent.carrying, material ? availableMaterials : availablePoints);
      agent.carryingBeforeDeposit = deposited;
      agent.foodDelivery = deposited > 0 ? {
        ...agent.foodDelivery, ...deliveryDestination(agent), colonyId: colony.id, x: agent.x + 0.5, y: agent.y + 0.5,
        startedAt: agent.foodDelivery?.startedAt ?? agent.unloadReady - 1,
        arrivesAt: agent.unloadReady, receivedAt: state.simSeconds, amount: deposited, resourceType
      } : null;
      if (material && deposited > 0) resourceStorage.deposit(store, resourceType, deposited);
      if (!material) {
        state.colonyFood += Math.floor(deposited);
        if (deposited > 0) state.lastFoodAt = state.simSeconds;
        recordColonyIncome(state, Math.floor(Math.min(deposited, availablePoints)));
        state.evolutionPoints += Math.floor(Math.min(deposited, availablePoints));
      }
      agent.carrying = Math.round((agent.carrying - deposited) * 10) / 10;
      if (agent.carrying <= 0) agent.carryingType = null;
      if (deposited > 0) registerRoadJourney(agent);
      agent.mode = "search";
      agent.utility = null;
      agent.decisionPending = "completed";
    }

    function visibleBurrows() {
      return (environment.creatureSystem?.burrows || []).filter(burrow => {
        if (burrow.health <= 0) return false;
        for (let y = burrow.y; y < burrow.y + burrow.height; y++) {
          for (let x = burrow.x; x < burrow.x + burrow.width; x++) if (visibleCells.has(y * WORLD_SIZE + x)) return true;
        }
        return false;
      });
    }

    function visibleNests() {
      return [...environment.games.values()].map(game => game.nest).filter(target => target && target.colonyId !== colony.id &&
        target.health > 0 && Array.from({ length: target.width * target.height }, (_, index) =>
          (target.y + Math.floor(index / target.width)) * WORLD_SIZE + target.x + index % target.width).some(index => visibleCells.has(index)));
    }

    function combatTargets() {
      if (!decisionTargets || decisionTargetRevision !== (environment.targetRevision || 0)) {
        decisionTargets = state.rivals.filter(enemy => !enemy.hidden && visibleCells.has(enemy.y * WORLD_SIZE + enemy.x)).concat(visibleBurrows(), visibleNests());
        decisionTargetRevision = environment.targetRevision || 0;
      }
      return decisionTargets.filter(enemy => enemy.health > 0);
    }

    function defenseStructures() {
      return [{ id: "nest:" + colony.id, health: state.nestHealth }];
    }

    function scheduledDecisionEvent(agent) {
      const targets = combatTargets();
      if (!agent.retreat && !(agent.utility?.action === "fight" && agent.utility.defending &&
          targets.some(target => target.id === agent.utility.target.id && colonyDefenseTarget(agent, target, state.agents, defenseStructures()))) &&
          targets.some(target => colonyDefenseTarget(agent, target, state.agents, defenseStructures()))) return "defense";
      if (agent.decisionPending || agent.retreat || hazardAt(agent.x, agent.y) || targets.some(target => !target.kind || target.kind === "agent") ||
          state.simSeconds >= agent.nextDecisionAt) return decisionEvent(agent);
      const plan = agent.utility, food = plan?.action === "collect" ? state.knownFood.get(plan.target.key) : null;
      const signature = [agent.x, agent.y, agent.health, agent.stats.health, agent.mode, agent.carrying, agent.carryingType,
        state.evolutionPoints, state.nestLevel, colonySupply(state, colony.tribe).urgency,
        agent.carrying > 0 ? deliveryCapacity(agent.carryingType || "honey-mushrooms") : 0,
        food?.amount, food?.resourceType, plan?.action, plan?.plannedCargo, plan?.recoverHealth,
        plan?.target.key, plan?.target.id, plan?.target.x, plan?.target.y,
        plan?.target && state.explored.has(plan.target.y * WORLD_SIZE + plan.target.x), ...targets.map(target => target.id)].join(":");
      const previous = decisionSchedule.get(agent);
      if (previous?.signature === signature && previous.plan === plan && previous.attributes === agent.attributes) return null;
      const reason = decisionEvent(agent);
      if (!reason) decisionSchedule.set(agent, { signature, plan, attributes: agent.attributes });
      return reason;
    }

    function reconsiderAgent(agent, reason) {
      if (agent.health <= 0 || agent.combat || agent.birth && state.simSeconds < agent.birth.readyAt ||
        agent.attack && state.simSeconds < agent.attack.endsAt) return;
      const planner = environment.decisionPlanner;
      if (planner) utilityAI.safety(agent);
      const immediate = planner && (reason === "defense" || agent.suspendedWork) ?
        utilityAI.evaluate(agent, !["completed", "targetLost", "restore"].includes(reason), true) : null;
      const planned = immediate?.length ? immediate : planner ? planner.request(colony.ownerId, agent, reason) :
        utilityAI.evaluate(agent, !["completed", "targetLost", "restore"].includes(reason));
      if (planned === undefined) return;
      const candidates = planned.filter(candidate => ["collect", "return", "recover", "fight", "flee", "explore", "wait"].includes(candidate.action) &&
        candidate.target && dnaCanMove(agent, candidate.target.x, candidate.target.y, colonyEntries));
      const best = candidates[0];
      if (best?.defending && !combatTargets().some(target => target.id === best.target.id &&
          colonyDefenseTarget(agent,target,state.agents,defenseStructures()))) {
        agent.decisionPending = "targetLost";
        return;
      }
      if (best?.defending) suspendDefenseWork(agent);
      else if (agent.suspendedWork && agent.survivalState === "stable" && !agent.retreat) agent.suspendedWork = null;
      agent.decisionCount = (agent.decisionCount || 0) + 1;
      agent.lastDecisionAt = state.simSeconds;
      agent.lastDecisionReason = reason;
      agent.nextDecisionAt = state.simSeconds + 3;
      agent.decisionPending = null;
      agent.knownEnemyIds = new Set(combatTargets().map(enemy => enemy.id));
      if (!best) {
        agent.utility = null;
        agent.mode = "wait";
        return;
      }
      const previous = agent.utility;
      const same = previous?.action === best.action && previous.target?.key === best.target.key;
      agent.utility = { action: best.action, target: best.target, route: best.route, defending: best.defending, resuming: best.resuming,
        plannedCargo: best.plannedCargo, recoverHealth: same && best.action === "recover" && reason !== "completed" && !agent.retreat ? previous.recoverHealth : best.recoverHealth,
        score: best.score, scores: candidates.map(candidate => ({ action: candidate.action, score: candidate.score, key: candidate.target.key })) };
      if (same) return;
      if (agent.foodDelivery?.receivedAt === null) agent.foodDelivery = null;
      agent.straightSteps = 0;
      agent.movementTargetKey = null;
      agent.movementVisits.clear();
      if (best.action === "collect") {
        agent.targetFoodKey = best.target.key;
        agent.mode = "approach";
      } else if (best.action === "return") {
        returnToColony(agent);
      } else if (best.action === "recover") agent.mode = "recover";
      else if (best.action === "fight") agent.mode = "fight";
      else if (best.action === "flee") agent.mode = "flee";
      else agent.mode = "search";
    }

    function decisionEvent(agent) {
      if (agent.combat || agent.birth && state.simSeconds < agent.birth.readyAt ||
        agent.attack && state.simSeconds < agent.attack.endsAt) return null;
      const previousSafety = agent.survivalState;
      const previousRetreat = !!agent.retreat;
      utilityAI.safety(agent);
      if (previousSafety !== agent.survivalState || previousRetreat !== !!agent.retreat) return "survival";
      if (agent.decisionPending) return agent.decisionPending;
      const visible = combatTargets();
      const ids = new Set(visible.map(enemy => enemy.id));
      const discovered = visible.some(enemy => !agent.knownEnemyIds.has(enemy.id));
      agent.knownEnemyIds = ids;
      if (discovered) return "enemyDiscovered";
      const plan = agent.utility;
      if (plan?.target && !dnaCanMove(agent, plan.target.x, plan.target.y, colonyEntries)) return "targetLost";
      if (plan?.action === "collect" && (!(state.knownFood.get(plan.target.key)?.amount > 0) ||
        !canHarvestResource(state.knownFood.get(plan.target.key), worldMap, agent.attributes, colony.tribe))) return "targetLost";
      if (plan?.action === "collect" && agent.carrying > 0 && (agent.carryingType || "honey-mushrooms") !==
        resourceTypeForCell(state.knownFood.get(plan.target.key), worldMap)) return "targetLost";
      if (plan?.action === "collect" && agent.carrying >= plan.plannedCargo) return "completed";
      if (plan?.action === "fight" && !ids.has(plan.target.id)) return "targetLost";
      if (plan?.action === "return" && (agent.carrying <= 0 || deliveryCapacity(agent.carryingType || "honey-mushrooms") <= 0)) return "completed";
      if (plan?.action === "recover" && agent.health >= plan.recoverHealth) return "completed";
      if (plan?.action === "explore" && state.explored.has(plan.target.y * WORLD_SIZE + plan.target.x) &&
        agent.x === plan.target.x && agent.y === plan.target.y) return "completed";
      if (plan?.action === "flee" && agent.x === plan.target.x && agent.y === plan.target.y) return "completed";
      if (state.simSeconds >= agent.nextDecisionAt) return "periodic";
      return null;
    }

    function stepUtilityAgent(agent, elapsed) {
      let plan = agent.utility;
      if (!plan) return false;
      const movingFor = state.simSeconds - agent.moveStartedAt;
      if (movingFor < agent.moveDuration) {
        if (agent.moveDuration - movingFor > 1e-8) return false;
        agent.moveDuration = movingFor;
      }
      const home = isColonyBoundaryCell(agent.x, agent.y);
      if (plan.action === "collect" && agent.x === plan.target.x && agent.y === plan.target.y) {
        if (agent.mode !== "harvest") harvestAtCurrentCell(agent);
        return false;
      }
      if (plan.action === "return" && isColonyDeliveryCell(agent.x, agent.y)) {
        if (agent.mode !== "unload") {
          agent.mode = "unload";
          agent.unloadReady = state.simSeconds + 1;
          agent.foodDelivery = {
            ...deliveryDestination(agent), colonyId: colony.id, x: agent.x + 0.5, y: agent.y + 0.5,
            startedAt: state.simSeconds, arrivesAt: agent.unloadReady, receivedAt: null,
            amount: Math.min(agent.carrying, deliveryCapacity(agent.carryingType || "honey-mushrooms")),
            resourceType: agent.carryingType || "honey-mushrooms"
          };
        }
        return false;
      }
      if (plan.action === "recover" && home) { agent.mode = "rest"; return false; }
      let target = plan.target;
      if (plan.action === "fight") {
        target = combatTargets().find(enemy => enemy.id === plan.target.id);
        if (!target) { agent.decisionPending = "targetLost"; return false; }
        const building = ["burrow", "nest"].includes(target.kind);
        if (!building && !canPursueCombat(agent, target, state.simSeconds,
            colonyDefenseTarget(agent, target, state.agents, defenseStructures())) || combatDisposition(agent) === "peaceful") {
          agent.decisionPending = "targetLost"; return false;
        }
        if (!building && agent.x === target.x && agent.y === target.y) {
          combat.engage(agent, target, state.simSeconds);
          combat.update(agent, state.simSeconds);
          return false;
        }
        if (building && agent.dna && !(agent.stats.dna.melee || agent.stats.dna.ranged)) { agent.decisionPending = "targetLost"; return false; }
        if (building && burrowDistance(agent, target) <= 1) {
          if (state.simSeconds >= agent.attackReady) {
            const profile = combatProfile(agent), hits = agent.dna ? agent.stats.dna.hits : 1;
            const hitAt = state.simSeconds + (agent.dna ? agent.stats.dna.focus : AGENT_ATTACK_HIT_TIME);
            const recovery = Math.max(profile.recovery, AGENT_ATTACK_DURATION - AGENT_ATTACK_HIT_TIME);
            agent.attack = { startedAt: state.simSeconds, speed: 1,
              hitsRemaining: hits, hitIndex: 0, hitAt, recovery, meleeContacts: [hitAt],
              endsAt: hitAt + (hits - 1) * (agent.dna ? agent.stats.dna.comboSpeed : 0) + recovery,
              targetId: target.id, targetKind: ["burrow", "nest"].includes(target.kind) ? target.kind : "agent", targetX: target.x, targetY: target.y,
              directionX: Math.sign(target.x - agent.x) || 1, damage: agent.stats.attack,
              resolved: false, hit: false };
            agent.attackReady = agent.attack.endsAt + profile.attackInterval;
          }
          return false;
        }
        if (building) target = burrowApproaches(target).filter(cell => isWalkable(cell.x, cell.y))
          .sort((first, second) => Math.abs(first.x - agent.x) + Math.abs(first.y - agent.y) -
            Math.abs(second.x - agent.x) - Math.abs(second.y - agent.y))[0];
        if (!target) return false;
      }
      if (agent.moveBudget + 1e-8 < 1) return false;
      const candidates = (plan.action === "explore" ? [
        { x: agent.x + 1, y: agent.y }, { x: agent.x - 1, y: agent.y },
        { x: agent.x, y: agent.y + 1 }, { x: agent.x, y: agent.y - 1 }
      ].filter(cell => cell.x >= 0 && cell.y >= 0 && cell.x < WORLD_SIZE && cell.y < WORLD_SIZE &&
        state.explored.has(cell.y * WORLD_SIZE + cell.x) && isWalkable(cell.x, cell.y)) : walkableNeighbors(agent.x, agent.y))
        .filter(cell => dnaCanMove(agent, cell.x, cell.y, colonyEntries));
      let destination = plan.route.find((cell, index) => index > 0 && plan.route[index - 1].x === agent.x && plan.route[index - 1].y === agent.y);
      if (plan.action === "fight" || !destination || !candidates.some(cell => cell.x === destination.x && cell.y === destination.y)) {
        destination = utilityAI.nextStep(agent, target);
      }
      if (destination && !candidates.some(cell => cell.x === destination.x && cell.y === destination.y)) {
        destination = chooseStepToward(agent, target, candidates);
      }
      if (!destination) {
        agent.nextDecisionAt = Math.min(agent.nextDecisionAt, state.simSeconds + 0.5);
        return false;
      }
      const previousEnd = agent.moveStartedAt + Math.max(agent.moveDuration, 1 / agentSpeed(agent));
      const continuing = agent.moveDuration > 0 && previousEnd >= state.simSeconds - elapsed - 1e-8;
      const moved = moveAgent(agent, destination, !["return", "recover", "flee"].includes(plan.action), continuing ? Math.min(state.simSeconds, previousEnd) : state.simSeconds);
      if (moved) {
        if (continuing) {
          agent.moveBudget = (state.simSeconds - agent.moveStartedAt) * agentSpeed(agent);
        } else agent.moveBudget = Math.max(0, agent.moveBudget - 1);
      }
      return moved;
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
      const appearance = agent.appearanceAttributes || agent.attributes;
      const smoothProgress = appearance.feet ? rawProgress : rawProgress * rawProgress * (3 - 2 * rawProgress);
      return {
        x: agent.renderFromX + (agent.x - agent.renderFromX) * smoothProgress,
        y: agent.renderFromY + (agent.y - agent.renderFromY) * smoothProgress,
        progress: rawProgress
      };
    }

    function slotCapacity() {
      return NEST_LEVELS[state.nestLevel - 1].slotCapacity;
    }

    function spendResources(cost) {
      state.evolutionPoints -= cost.evolutionPoints;
      resourceStorage.spend(cost.materials);
    }

    function pointCapacity() {
      return NEST_LEVELS[state.nestLevel - 1].pointCapacity;
    }

    function resourceSpace() {
      return resourceStorage.refresh().reduce((sum, store) => sum + resourceStorage.space(store), 0);
    }

    function resourceInventoryLimits() {
      const space = resourceSpace();
      return Object.fromEntries(RESOURCE_TYPES.map(({ key }) => [key,
        isColonyFood(key, colony.tribe, worldMap.generationVersion) ? 0 : (state.resourceInventory[key] || 0) + space]));
    }

    function deliveryCapacity(resourceType) {
      return isColonyFood(resourceType, colony.tribe, worldMap.generationVersion) ? Math.max(0, pointCapacity() - state.evolutionPoints) : resourceSpace();
    }

    function upgradeCost() {
      return nestUpgradeCost(state.nestLevel, colony.tribe);
    }

    function agentSpeed(agent) {
      let speed = unitTravelSpeed(agent, agent.carrying);
      const capacity = unitCarryCapacity(agent, agent.carryingType);
      if (agent.carrying > capacity) speed *= 0.8;
      if (synergy(agent, ["strength", "feet"])) speed *= 1 + 0.5 * Math.min(1, agent.carrying / capacity);
      if (synergy(agent, ["feet", "feet"]) && agent.straightSteps > 4) speed *= 1.75;
      if (hazardAt(agent.x, agent.y)) {
        speed *= 0.5;
        if (synergy(agent, ["feet", "shell"])) speed *= 3;
      }
      return speed * unitTerrainSpeedMultiplier(agent, worldMap.terrain[agent.y * WORLD_SIZE + agent.x]);
    }

    function spawnAgent(template, faction, newborn, birthCell) {
      if (state.agents.filter(agent => agent.health > 0).length >= NEST_LEVELS[state.nestLevel - 1].unitCapacity) return null;
      const position = birthCell ? availableSpawnCells().find(cell => cell.x === birthCell.x && cell.y === birthCell.y) :
        chooseSpawnPosition(template.id !== null || newborn);
      if (!position) return null;
      const attributes = template.dna ? { ...dnaAppearance(template.dna), dnaGather: dnaUnitStats(template.dna, colony.tribe).harvest > 0 } : attributeCounts(template.slots, template.attributeLevels);
      const stats = template.dna ? dnaUnitStats(template.dna, colony.tribe) : unitStats(attributes, colony.tribe);
      const agent = {
        dna: cloneDna(template.dna),
        tribe: colony.tribe || "bean",
        id: colony.id + ":" + state.nextAgentId,
        ownerId: colony.ownerId,
        name: suggestAgentName(colony.tribe, state.agents, state.nextAgentId),
        templateId: template.id,
        templateName: template.name,
        templateRevision: template.revision,
        productionRole: template.productionRole || null,
        combatPrimary: combatPrimary(template),
        slots: [...template.slots],
        attributeLevels: migrateAttributeLevels(template.slots, template.attributeLevels, state.nestLevel),
        attributes,
        stats,
        rulesVersion: 2,
        health: stats.health,
        personality: createPersonality(Math.random),
        faction,
        cost: birthCost(template, colony.tribe),
        x: position.x,
        y: position.y,
        profile: { ...state.draftProfile },
        bornAt: state.simSeconds,
        carrying: 0,
        carryingType: null,
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
      initializeAgent(agent);
      if (template.id !== null || newborn) {
        agent.mode = "birth";
        agent.birth = { colonyId: colony.id, startedAt: state.simSeconds,
          readyAt: state.simSeconds + agentBirthDuration(agent.tribe),
          sourceX: colony.x, sourceY: colony.y,
          sourceWidth: COLONY_SIZE, sourceHeight: COLONY_SIZE,
          fromX: COLONY_CENTER.x - .5,
          fromY: COLONY_CENTER.y - .5 };
      }
      state.nextAgentId += 1;
      state.agents.push(agent);
      environment.unitIndex?.update(agent, environment.games.get(colony.ownerId));
      return agent;
    }

    function isAgentCellOccupied(x, y, excludedAgent) {
      if (environment.unitIndex) return environment.unitIndex.occupied(x, y, excludedAgent, true);
      const occupied = (other) => other !== excludedAgent && other.health > 0 && (
        (other.x === x && other.y === y) ||
        (state.simSeconds - other.moveStartedAt < other.moveDuration &&
          other.renderFromX === x && other.renderFromY === y)
      );
      return state.agents.some(occupied) || state.rivals.some(occupied);
    }

    function dropCorpse(agent) {
      ensureFoodAround(agent.x, agent.y, 4);
      const drops = [{ id: "corpse:" + agent.id, agentId: agent.id, colonyId: colony.id, name: agent.name,
        tribe: agent.tribe, bornAt: agent.bornAt, diedAt: state.simSeconds, decaysAt: state.simSeconds + CORPSE_LIFETIME,
        facing: agent.combat?.position ? agent.facing || 1 : agent.combat ? agent.combat.side === 0 ? -1 : 1 : agent.facing || 1,
        hurtStartedAt: agent.hurtStartedAt, hurtCount: agent.hurtCount,
        cost: agent.cost, kind: "corpse",
        stats: { pieceCount: agent.dna?.pieces.length ?? agent.stats?.pieceCount ?? 0 },
        attributes: { ...agent.attributes }, appearanceAttributes: { ...agent.appearanceAttributes } }];
      if (agent.carrying > 0 && resourceDefinition(agent.carryingType)) {
        const resourceType = agent.carryingType || "honey-mushrooms";
        drops.push({ amount: agent.carrying, resourceType,
          kind: resourceDefinition(resourceType).category === "material" ? "resource" : "food" });
      }
      for (const drop of drops) {
        if (drop.kind === "corpse") {
          placeCorpse(foodCellMap, { x: agent.x, y: agent.y, ...drop });
          continue;
        }
        let placed = false;
        for (let radius = 0; radius <= 6 && !placed; radius += 1) {
          for (let offsetY = -radius; offsetY <= radius && !placed; offsetY += 1) {
            for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
              const x = agent.x + offsetX;
              const y = agent.y + offsetY;
              const key = x + "," + y;
              if (!isWalkable(x, y) || foodCellMap.get(key)?.amount > 0 || foodCellMap.get(key)?.kind === "corpse" || hazardAt(x, y)) continue;
              const cell = { x, y, ...drop };
              foodCellMap.set(key, cell);
              placed = true;
              break;
            }
          }
        }
      }
    }

    function removeDeadAgents() {
      for (const agent of state.agents) {
        if (agent.health > 0) continue;
        dropCorpse(agent);
        environment.unitIndex?.remove(agent);
        agent.health = 0;
      }
      state.agents = state.agents.filter((agent) => agent.health > 0);

    }

    function expireFootprints() {
      for (const [key, footprint] of state.footprints) {
        const marks = footprint.marks.filter(mark => state.simSeconds - mark.at < FOOTPRINT_LIFETIME);
        if (!marks.length) state.footprints.delete(key);
        else if (marks.length !== footprint.marks.length) footprint.marks = marks;
      }
      footprintCleanupAt = state.simSeconds + 1;
    }

    function updateAttack(agent) {
      const attack = agent.attack;
      if (!attack) return false;
      if (!["burrow", "nest"].includes(attack.targetKind)) { agent.attack = null; return false; }
      while (!attack.resolved && state.simSeconds + 1e-8 >= attack.hitAt) {
        attack.hitsRemaining = (attack.hitsRemaining || 1) - 1;
        attack.resolved = attack.hitsRemaining <= 0;
        const damage = attack.damage * (agent.dna && attack.hitIndex > 0 ? agent.stats.dna.comboPower / 100 : 1);
        attack.hitIndex = (attack.hitIndex || 0) + 1;
        if (!attack.resolved) {
          attack.hitAt += agent.dna ? agent.stats.dna.comboSpeed : AGENT_ATTACK_DURATION;
          if (attack.meleeContacts) attack.meleeContacts.push(attack.hitAt);
        }
        const owner = [...environment.games.values()].find(game => attack.targetKind === "nest" ? game.nest?.id === attack.targetId : game.agents.some(target => target.id === attack.targetId));
        const target = attack.targetKind === "burrow" ? environment.creatureSystem?.burrows.find(burrow => burrow.id === attack.targetId) :
          attack.targetKind === "nest" ? owner?.nest : owner ? owner.agents.find(target => target.id === attack.targetId) :
            environment.creatureSystem?.agents.find(target => target.id === attack.targetId);
        if (target?.health > 0 && (!["burrow", "nest"].includes(attack.targetKind) || burrowDistance(agent, target) <= 1)) {
          attack.targetX = target.x;
          attack.targetY = target.y;
          attack.hit = true;
          const remaining = attack.targetKind === "burrow" ? environment.creatureSystem.receiveBurrowDamage(target.id, damage) :
            attack.targetKind === "nest" ? owner.receiveNestDamage(damage) : null;
          target.health = remaining ?? target.health;
          if (target.health <= 0) agent.decisionPending = "targetLost";
        }
      }
      if (state.simSeconds + 1e-8 >= attack.endsAt) return false;
      agent.moveBudget = 0;
      return true;
    }

    function updateAgents(elapsed) {
      let backgroundDecisions = 0;
      const background = agent => environment.hostId && colony.ownerId !== environment.hostId &&
        !environment.games.get(environment.hostId)?.isVisible(agent.x, agent.y);
      const reconsider = (agent, reason) => {
        if (!reason || reason === "periodic" && background(agent) && backgroundDecisions++ >= 4) return;
        reconsiderAgent(agent, reason);
      };
      expireCorpses(foodCellMap, state.simSeconds);
      if (state.simSeconds >= footprintCleanupAt) expireFootprints();
      updatingAgents = true;
      removeDeadAgents();
      updatePerception();
      for (const agent of state.agents) {
        if (agent.health <= 0) continue;
        if (agent.birth) {
          if (state.simSeconds < agent.birth.readyAt) continue;
          // Only this verified birth-to-idle seam gets a persistent visual origin.
          if (agent.tribe === "pebble" && agent.dna?.version === 5 && unitAppearanceForm(agent) === "gather")
            agent.birthIdleStartedAt = agent.birth.readyAt;
          agent.birth = null;
          agent.moveBudget = 0;
          agent.decisionPending = "birth";
        }
        updateEnvironment(agent, elapsed);
        if (agent.health <= 0) continue;
        const occupied = combat.update(agent, state.simSeconds);
        if (occupied) continue;
        if (updateAttack(agent)) continue;
        const reason = scheduledDecisionEvent(agent);
        reconsider(agent, reason);
        agent.moveBudget = Math.min(1, agent.moveBudget + elapsed * agentSpeed(agent));
        if (!["rest", "unload", "harvest"].includes(agent.mode) && state.simSeconds + 1e-8 < agent.moveStartedAt + agent.moveDuration) continue;
        if (agent.mode === "rest") {
          agent.straightSteps = 0;
          if (isColonyBoundaryCell(agent.x, agent.y)) {
            agent.health = Math.min(agent.stats.health, agent.utility.recoverHealth, agent.health + elapsed * 0.25);
            if (agent.health >= agent.utility.recoverHealth) agent.decisionPending = "completed";
          } else agent.mode = "recover";
        } else if (agent.mode === "unload") {
          if (!isColonyDeliveryCell(agent.x, agent.y)) {
            agent.mode = "return";
            agent.foodDelivery = null;
            agent.decisionPending = "restore";
          } else if (state.simSeconds >= agent.unloadReady) depositFood(agent);
        } else if (agent.mode === "harvest") updateHarvest(agent);
        else {
          const moved = stepUtilityAgent(agent, elapsed);
          if (!moved && agent.moveBudget >= 1 &&
            state.simSeconds - agent.moveStartedAt >= agent.moveDuration) agent.straightSteps = 0;
        }
        if (agent.decisionPending) reconsiderAgent(agent, agent.decisionPending);
      }
      removeDeadAgents();
      updatePerception();
      for (const agent of state.agents) {
        const reason = scheduledDecisionEvent(agent);
        reconsider(agent, reason);
      }
      updatingAgents = false;
    }

    function requireName(value) {
      if (typeof value !== "string" || !value.trim() || value.trim().length > 24) {
        throw new Error("이름은 1~24자로 입력해 주세요.");
      }
      return value.trim();
    }

    function birth(template, required, birthCell) {
      if (state.agents.filter(agent => agent.health > 0).length >= NEST_LEVELS[state.nestLevel - 1].unitCapacity) {
        if (!required) return null;
        throw new Error("현재 둥지의 개체 수가 한도에 도달했습니다.");
      }
      if (!hasActiveNest()) {
        if (!required) return null;
        throw new Error("파괴된 둥지에서는 개체를 생산할 수 없습니다.");
      }
      if (template.dna && !validateDna(template.dna, state.nestLevel, state.evolutionPoints)) {
        if (!required) return null;
        throw new Error("현재 둥지의 슬롯 수와 사용 가능한 속성에 맞춰 설계를 수정해 주세요.");
      }
      if (!template.dna && (template.slots.length > slotCapacity() || new Set(template.slots).size !== template.slots.length || template.slots.some(key => !ATTRIBUTES.some(attribute => attribute.key === key)))) {
        throw new Error("현재 둥지의 슬롯 수와 사용 가능한 속성에 맞춰 설계를 수정해 주세요.");
      }
      if (!template.dna && template.slots.some(key => !isAttributeUnlocked(key, state.nestLevel, colony.tribe))) {
        if (!required) return null;
        throw new Error("현재 둥지의 슬롯 수와 사용 가능한 속성에 맞춰 설계를 수정해 주세요.");
      }
      if (state.evolutionPoints < birthCost(template, colony.tribe)) {
        if (!required) return null;
        throw new Error("진화 포인트가 부족합니다.");
      }
      const agent = spawnAgent(template, "colony", true, birthCell);
      if (!agent) {
        if (!required) return null;
        throw new Error(colony.tribe === "spring" || colony.tribe === "pebble" ? "둥지 앞쪽과 양옆의 탄생 공간이 가득 찼습니다." : "둥지 주변이 가득 찼습니다.");
      }
      state.evolutionPoints -= birthCost(template, colony.tribe);
      return agent.id;
    }

    function automaticSpawnSites() {
      const positions = availableSpawnCells();
      return state.nestHealth > 0 && positions.length ? [{ positions }] : [];
    }

    function automaticBirth(template, role) {
      const site = automaticSpawnSites()[0];
      if (!site || state.agents.filter(agent => agent.health > 0).length >= NEST_LEVELS[state.nestLevel - 1].unitCapacity || state.evolutionPoints < birthCost(template,colony.tribe) ||
          template.slots.length > slotCapacity() || template.slots.some(key => !isAttributeUnlocked(key,state.nestLevel,colony.tribe))) return null;
      const matches = candidate => combatPrimary(candidate) === combatPrimary(template) && candidate.slots.length === template.slots.length && template.slots.every(key =>
        candidate.slots.includes(key) && (candidate.attributeLevels?.[key] || 1) === (template.attributeLevels?.[key] || 1));
      let stored = state.templates.find(matches), result;
      if (stored) result = command({type:"birth",templateId:stored.id});
      else {
        const source = state.agents.find(agent => agent.health > 0 && matches(agent));
        const previous = state.templates.find(candidate => candidate.automatic === true && candidate.productionRole === role);
        if (source && !previous && state.templates.length < 100) {
          result = command({type:"birth",agentId:source.id});
          stored = state.templates.find(candidate => candidate.id === result.templateId);
        } else {
          if (!previous && state.templates.length >= 100) return null;
          const design = command({type:"design",templateId:previous?.id ?? null,name:previous?.name || template.name,
            slots:[...template.slots],combatPrimary:combatPrimary(template),birth:false});
          stored = state.templates.find(candidate => candidate.id === design.templateId);
          stored.productionRole = role;
          stored.automatic = true;
          result = command({type:"birth",templateId:stored.id});
        }
        stored.productionRole = role;
        stored.automatic = true;
      }
      const agent = state.agents.find(candidate => candidate.id === result.agentId);
      if (agent) { agent.productionRole = role; agent.automatic = true; }
      return result.agentId || null;
    }

    function automaticManagement() {
      if (state.discoveryReadCount < state.discoveries.length) command({type:"read-discoveries",count:state.discoveries.length});
      if (!colony.name?.trim()) command({type:"rename-colony",colonyId:colony.id,name:colony.tribe});
      for (const agent of state.agents) {
        if (agent.health <= 0) continue;
        if (agent.automatic && !agent.name?.trim()) command({type:"rename",agentId:agent.id,name:agent.templateName.slice(0,24)});
      }
      for (const template of [...state.templates]) {
        if (template.automatic !== true || state.agents.some(agent => agent.health > 0 && agent.templateId === template.id)) continue;
        const obsolete = template.slots.length > slotCapacity() || template.slots.some(key => !isAttributeUnlocked(key,state.nestLevel,colony.tribe));
        const duplicate = state.templates.some(candidate => candidate.id !== template.id && combatPrimary(candidate) === combatPrimary(template) && candidate.slots.length === template.slots.length &&
          template.slots.every(key => candidate.slots.includes(key) && (candidate.attributeLevels?.[key] || 1) >= (template.attributeLevels?.[key] || 1)));
        if (obsolete || duplicate || state.templates.length >= 100) command({type:"delete-design",templateId:template.id});
      }
    }

    function produce() {
      if (!environment.hostId || colony.ownerId === environment.hostId || !colony.tribe || state.ending ||
          state.simSeconds < (state.productionReadyAt || 0)) return null;
      state.productionReadyAt = state.simSeconds + CONQUEST_PACING.productionInterval;
      automaticManagement();
      if (!hasActiveNest()) return null;
      const template = tribeProductionTemplate(state,colony.tribe);
      const workers = state.agents.filter(agent => agent.health > 0 &&
        !militaryAgent(agent,colony.tribe));
      const replacing = !workers.length;
      if (replacing && template) {
        const agentId = automaticBirth(template,template.productionRole);
        if (agentId) return agentId;
      }
      if (state.nestLevel < NEST_LEVELS.length && state.evolutionPoints >= upgradeCost()) {
        command({type:"upgrade"});
        return null;
      }
      if (template) {
        const agentId = automaticBirth(template,template.productionRole);
        if (agentId) return agentId;
      }
      if (state.simSeconds >= (state.attributeProductionReadyAt || 0)) {
        state.attributeProductionReadyAt = state.simSeconds + CONQUEST_PACING.productionInterval;
        const stock = state.resourceInventory;
        for (const design of state.templates) for (const key of design.slots) {
          if (isAttributeUnlocked(key,state.nestLevel,colony.tribe) &&
              !attributeUpgradeIssue(design,key,state.nestLevel,state.evolutionPoints,stock)) {
            command({type:"upgrade-attribute",templateId:design.id,attributeKey:key});
            return null;
          }
        }
      }
      return null;
    }

    function recoveryBirthCost() {
      const dna = basicGathererDna(state.nestLevel);
      let cost = dna ? birthCost({ dna }, colony.tribe) : Infinity;
      // Existing legacy templates can still be edited to a plain gatherer.
      // Autonomous tribes also retain their legacy production fallback.
      const legacyRecovery = state.templates.some(template => !template.dna) ||
        environment.hostId && colony.ownerId !== environment.hostId;
      if (legacyRecovery) cost = Math.min(cost, birthCost({ slots: [] }, colony.tribe));
      return cost;
    }

    function checkEnding() {
      if (state.ending || colony.tribe === null || state.agents.some(agent => agent.health > 0) ||
          hasActiveNest() && state.evolutionPoints >= recoveryBirthCost()) return state.ending;
      state.ending = { endedAt: state.simSeconds,
        reason: !hasActiveNest() ? "nest-destroyed" : "extinction",
        bornCount: state.nextAgentId - 1, exploredCells: state.explored.size,
        discoveryCount: state.discoveries.length, colonyFood: state.colonyFood,
        evolutionPoints: state.evolutionPoints, nestLevel: state.nestLevel };
      return state.ending;
    }

    function command(action) {
      if (state.ending && action.type !== "read-discoveries") throw new Error("끝난 군락은 둘러보기만 할 수 있습니다.");
      const cheat = commandCheat(action, state, removeDeadAgents, checkEnding, resourceStorage.restore);
      if (cheat !== null) return cheat;
      if (action.type === "read-discoveries") {
        if (!Number.isInteger(action.count) || action.count < 0 || action.count > state.discoveries.length) {
          throw new Error("확인할 알림 수가 올바르지 않습니다.");
        }
        state.discoveryReadCount = Math.max(state.discoveryReadCount, action.count);
        return {};
      }
      if (action.type === "delete-design") {
        const index = state.templates.findIndex(template => template.id === action.templateId);
        if (index < 0) throw new Error("설계를 찾을 수 없습니다.");
        state.templates.splice(index, 1);
        return {};
      }
      if (action.type === "upgrade-attribute") {
        const template = state.templates.find(candidate => candidate.id === action.templateId);
        if (!template) throw new Error("강화할 설계를 찾을 수 없습니다.");
        if (template.dna) throw new Error("설계 속성을 다시 확인해 주세요.");
        if (!isAttributeUnlocked(action.attributeKey, state.nestLevel, colony.tribe)) throw new Error("둥지를 성장시킨 뒤 속성을 강화해 주세요.");
        const issue = attributeUpgradeIssue(template, action.attributeKey, state.nestLevel, state.evolutionPoints, state.resourceInventory);
        if (issue) throw new Error(issue);
        const level = attributeCounts(template.slots, template.attributeLevels)[action.attributeKey] + 1;
        const cost = attributeUpgradeCost(action.attributeKey, level);
        spendResources(cost);
        template.attributeLevels = { ...template.attributeLevels, [action.attributeKey]: level };
        template.unlockedAttributeLevels = { ...template.unlockedAttributeLevels, [action.attributeKey]: level };
        template.revision += 1;
        return { templateId: template.id, attributeKey: action.attributeKey, level };
      }
      if (action.type === "design") {
        const name = requireName(action.name);
        const dna = action.dna ? validateDna(action.dna, state.nestLevel, 999999999) : null;
        if (action.dna && !dna) throw new Error("설계 속성을 다시 확인해 주세요.");
        if (dna) action = { ...action, slots: Object.keys(dnaAppearance(dna)).filter(key => key !== "dnaGather") };
        if (!dna && (!Array.isArray(action.slots) || action.slots.length > slotCapacity() || new Set(action.slots).size !== action.slots.length ||
          action.slots.some(key => !isAttributeUnlocked(key, state.nestLevel, colony.tribe)))) {
          throw new Error("설계 속성을 다시 확인해 주세요.");
        }
        if (typeof action.birth !== "boolean") throw new Error("탄생 요청이 올바르지 않습니다.");
        const previous = state.templates.find((template) => template.id === action.templateId);
        if (action.templateId !== null && !previous) throw new Error("설계를 찾을 수 없습니다.");
        if (!previous && state.templates.length >= 100) throw new Error("설계는 최대 100개까지 저장할 수 있습니다.");
        if (state.templates.some((template) => template.id !== action.templateId && template.name === name)) {
          throw new Error("같은 이름의 설계가 있습니다.");
        }
        const purchased = { ...previous?.unlockedAttributeLevels, ...previous?.attributeLevels };
        const unlockedAttributeLevels = { ...migrateAttributeLevels(Object.keys(purchased), purchased, state.nestLevel) };
        for (const key of action.slots) if (!unlockedAttributeLevels[key]) unlockedAttributeLevels[key] = 1;
        const primary = combatPrimary({ dna, slots: action.slots, combatPrimary: action.combatPrimary === undefined ? previous?.combatPrimary : action.combatPrimary });
        const template = { id: previous ? previous.id : state.nextTemplateId, name, dna: cloneDna(dna), combatPrimary: primary,
          nameEdited: typeof action.nameEdited === "boolean" ? action.nameEdited :
            isTemplateNameEdited(previous?.name === name ? previous : { name, slots: action.slots }),
          slots: [...action.slots], attributeLevels: Object.fromEntries(action.slots.map(key => [key, unlockedAttributeLevels[key]])),
          unlockedAttributeLevels,
          revision: previous ? previous.revision + 1 : 1 };
        const agentId = action.birth ? birth(template, false) : null;
        if (previous) state.templates[state.templates.indexOf(previous)] = template;
        else {
          state.templates.push(template);
          state.nextTemplateId += 1;
        }
        return { templateId: template.id, agentId };
      }
      if (action.type === "birth") {
        if (action.agentId !== undefined) {
          const agent = state.agents.find(candidate => candidate.id === action.agentId && candidate.health > 0);
          if (!agent) throw new Error("복제할 생명체를 찾을 수 없습니다.");
          const attributeLevels = migrateAttributeLevels(agent.slots, agent.attributeLevels, state.nestLevel);
          const previous = state.templates.find(template => JSON.stringify(template.dna || null) === JSON.stringify(agent.dna || null) && combatPrimary(template) === combatPrimary(agent) && template.slots.length === agent.slots.length &&
            agent.slots.every(key => template.slots.includes(key) && (template.attributeLevels[key] || 1) === attributeLevels[key]));
          if (!previous && state.templates.length >= 100) throw new Error("설계는 최대 100개까지 저장할 수 있습니다.");
          let name = agent.templateName, suffix = 2;
          while (!previous && state.templates.some(template => template.name === name)) {
            const ending = " " + suffix++;
            name = agent.templateName.slice(0, 24 - ending.length) + ending;
          }
          const template = previous || { id: state.nextTemplateId, name, dna: cloneDna(agent.dna), slots: [...agent.slots], attributeLevels, combatPrimary: combatPrimary(agent),
            unlockedAttributeLevels: { ...attributeLevels }, revision: 1, productionRole: agent.productionRole || null };
          const agentId = birth({ ...template, slots: [...agent.slots] }, true);
          if (!previous) {
            state.templates.push(template);
            state.nextTemplateId += 1;
          }
          return { templateId: template.id, agentId };
        }
        const template = state.templates.find((candidate) => candidate.id === action.templateId);
        if (!template) throw new Error("설계를 찾을 수 없습니다.");
        return { agentId: birth(template, true) };
      }
      if (action.type === "upgrade") {
        if (!hasActiveNest()) throw new Error("파괴된 둥지는 성장할 수 없습니다.");
        if (state.nestLevel >= NEST_LEVELS.length) throw new Error("최고 둥지 레벨입니다.");
        if (state.evolutionPoints < upgradeCost()) throw new Error("진화 포인트가 부족합니다.");
        state.evolutionPoints -= upgradeCost();
        const previousHealth = NEST_LEVELS[state.nestLevel - 1].health;
        state.nestLevel += 1;
        if (state.nestHealth > 0) state.nestHealth += NEST_LEVELS[state.nestLevel - 1].health - previousHealth;
        return {};
      }
      if (action.type === "rename-colony") {
        if (action.colonyId !== colony.id) throw new Error("자신의 둥지만 이름을 바꿀 수 있습니다.");
        if (typeof action.name !== "string" || !action.name.trim() || action.name.trim().length > 32) throw new Error("둥지 이름은 1~32자로 입력해 주세요.");
        colony.name = action.name.trim();
        colony.hasCustomName = true;
        return {colonyId:colony.id};
      }
      if (action.type === "rename") {
        const agent = state.agents.find((candidate) => candidate.id === action.agentId);
        if (!agent) throw new Error("생명체를 찾을 수 없습니다.");
        agent.name = requireName(action.name);
        return {};
      }
      throw new Error("지원하지 않는 요청입니다.");
    }

    function agentMovementPlan(agent) {
      const plan = agent.utility;
      if (!plan || agent.health <= 0 || !["search", "approach", "return", "recover", "flee"].includes(agent.mode)) return null;
      const index = plan.route.findIndex(cell => cell.x === agent.x && cell.y === agent.y);
      if (index < 0) return null;
      const route = plan.route.slice(index).map(cell => ({ x: cell.x, y: cell.y }));
      return { destination: { ...route.at(-1) }, route };
    }

    function snapshot() {
      updatePerception();
      if (discoveryBaselinePending) {
        state.discoveryReadCount = state.discoveries.length;
        discoveryBaselinePending = false;
      }
      const targetAgents = new Map([...state.agents, ...state.rivals,
        ...[...environment.games.values()].map(game => game.nest)]
        .filter(target => target && target.health > 0 && !target.hidden &&
          Array.from({ length: (target.width || 1) * (target.height || 1) }, (_, index) =>
            (target.y + Math.floor(index / (target.width || 1))) * WORLD_SIZE + target.x + index % (target.width || 1))
            .some(index => visibleCells.has(index)))
        .map(target => [target.id, target]));
      const visibleAgent = (agent) => {
        const { visited, movementVisits, path, returnPath, rememberedRoute, profile, personality, utility, knownEnemyIds, ...visible } = agent;
        const target = targetAgents.get(agent.attack?.targetId || agent.combat?.targetId || (!agent.combat ? agent.pursuitTargetId : null));
        const combatTarget = target ? { id: target.id, kind: target.kind || "agent", x: target.x, y: target.y,
          width: target.width || 1, height: target.height || 1 } : null;
        return { ...visible, dna: cloneDna(agent.dna), stats: { ...agent.stats, ...(agent.stats.dna ? { dna: { ...agent.stats.dna } } : {}) }, combatTarget, combatDisposition: combatDisposition(agent), action: agent.combat ? "fight" : utility?.action || "wait", personalityLabels: personality ? personalityLabels(personality) : null };
      };
      return {
        simSeconds: state.simSeconds, colonyFood: state.colonyFood, encounterSignals: environment.creatureSystem?.signals || [], burrows: environment.creatureSystem?.burrows || [],
        resourceInventory: { ...state.resourceInventory },
        resourceStores: resourceStorage.refresh().map(store => ({ ...store, inventory: { ...store.inventory } })),
        resourceInventoryLimits: resourceInventoryLimits(),
        resourceCapacity: resourceStorage.refresh().filter(store => store.kind !== "remains").reduce((sum, store) => sum + store.capacity, 0),
        discoveries: state.discoveries.map(entry => ({ ...entry })), discoveryReadCount: state.discoveryReadCount,
        evolutionPoints: state.evolutionPoints, nestLevel: state.nestLevel, unitCapacity: NEST_LEVELS[state.nestLevel - 1].unitCapacity, tribe: colony.tribe,
        ending: state.ending ? { ...state.ending } : null,
        nestHealth: state.nestHealth, nestMaxHealth: NEST_LEVELS[state.nestLevel - 1].health,
        templates: state.templates.map(template => ({ ...template, dna: cloneDna(template.dna), tribe: colony.tribe || "bean" })), agents: state.agents.map(agent => ({ ...visibleAgent(agent), movementPlan: agentMovementPlan(agent) })),
        rivals: state.rivals.filter(agent => !agent.hidden && (agent.health > 0 || agent.species === "spiny-back-beetle" && agent.mode === "death") &&
          visibleCells.has(agent.y * WORLD_SIZE + agent.x)).map((agent) => ({ ...visibleAgent(agent), faction: agent.species ? agent.faction : "rival" })),
        corpses: [...foodCellMap.values()].filter(cell => cell.kind === "corpse" &&
          (cell.colonyId === colony.id || visibleCells.has(cell.y * WORLD_SIZE + cell.x))),
        sharedTrails: [...state.sharedTrails], footprints: [...state.footprints.values()],
        footprintLifetime: FOOTPRINT_LIFETIME, food: [...state.knownFood.values()],
        explored: [...state.explored], visible: [...visibleCells], markers: state.markers
      };
    }

    function grantStartingPoints() {
      if (colony.ownerId !== environment.hostId || state.startingPointsGranted === true) return;
      state.evolutionPoints += PLAYER_STARTING_POINTS;
      state.startingPointsGranted = true;
    }

    function save() {
      return JSON.stringify({ state: { ...state, rivals: [], corpses: [] } }, (key, value) =>
        value instanceof Map ? { collection: "Map", entries: [...value] } :
        value instanceof Set ? { collection: "Set", entries: [...value] } : value);
    }

    function restore(saved) {
      roadOptimizer.clear();
      const data = typeof saved === "string" ? JSON.parse(saved, (key, value) =>
        value?.collection === "Map" ? new Map(value.entries) :
        value?.collection === "Set" ? new Set(value.entries) : value) : saved;
      Object.assign(state, data.state);
      state.startingPointsGranted = data.state.startingPointsGranted === true;
      for (const key of ["buildings", "nextBuildingId", "constructionProductionReadyAt", "constructionHelpResult", "constructionHelpBuildings", "constructionMaterialNeeds", "foragerMemory", "nestExperienceContributions"]) delete state[key];
      state.corpses = [];
      removedFoodKeys = new Set([...foodCellMap].filter(([, cell]) => cell.kind === "corpse" ||
        migrateResourceType(cell.resourceType) === null).map(([key]) => key));
      if (state.knownFood instanceof Map) for (const [key, cell] of state.knownFood) {
        if (cell.kind === "corpse" || migrateResourceType(cell.resourceType) === null) removedFoodKeys.add(key);
      }
      for (const [key, cell] of foodCellMap) if (cell.kind !== "corpse" && migrateResourceType(cell.resourceType) === null) foodCellMap.delete(key);
      for (const spot of foodSpotCache.values()) spot.cells = spot.cells.filter(cell => cell.kind !== "corpse" &&
        migrateResourceType(cell.resourceType) !== null);
      state.evolutionPoints = Math.floor(state.evolutionPoints);
      grantStartingPoints();
      state.colonyFood = Math.floor(state.colonyFood);
      expireCorpses(foodCellMap, state.simSeconds);
      state.productionReadyAt = Number.isFinite(data.state.productionReadyAt) && data.state.productionReadyAt >= 0 ? data.state.productionReadyAt : 0;
      state.attributeProductionReadyAt = Number.isFinite(data.state.attributeProductionReadyAt) ? Math.max(0,data.state.attributeProductionReadyAt) : 0;
      state.militaryGuidanceCompleted = data.state.militaryGuidanceCompleted === true;
      state.resourceStores = Array.isArray(data.state.resourceStores) ? data.state.resourceStores : undefined;
      restoreColonyIncome(state, data.state);
      state.lastFoodAt = Number.isFinite(data.state.lastFoodAt) && data.state.lastFoodAt >= 0 ?
        Math.min(state.simSeconds, data.state.lastFoodAt) : state.simSeconds;
      state.ending = data.state.ending ? { ...data.state.ending,
        evolutionPoints: Math.floor(data.state.ending.evolutionPoints), colonyFood: Math.floor(data.state.ending.colonyFood) } : null;
      for (const template of state.templates) {
        if (template.productionRole === "scout") template.productionRole = null;
        template.dna = cloneDna(template.dna);
        template.attributeLevels = migrateAttributeLevels(template.slots, template.attributeLevels, state.nestLevel);
        template.slots = migrateAttributeSlots(template.slots);
        template.combatPrimary = combatPrimary(template);
        const purchased = { ...template.unlockedAttributeLevels, ...template.attributeLevels };
        template.unlockedAttributeLevels = migrateAttributeLevels(Object.keys(purchased), purchased, state.nestLevel);
      }
      const nestMaxHealth = NEST_LEVELS[state.nestLevel - 1].health;
      state.nestHealth = Number.isFinite(data.state.nestHealth) ? Math.max(0, Math.min(nestMaxHealth, data.state.nestHealth)) : nestMaxHealth;
      discoveryBaselinePending = !Array.isArray(data.state.discoveries);
      state.discoveries = Array.isArray(data.state.discoveries) ? data.state.discoveries : [];
      const discoveries = [];
      const discovered = new Set();
      let readCount = 0;
      state.discoveries.forEach((entry, index) => {
        if (entry.kind === "corpse" || entry.kind === "building" || entry.key.startsWith("corpse:") || entry.key.startsWith("building:") || ["attribute:secretion", "attribute:butchery", "attribute:condensation", "attribute:construction", "attribute:lifespan", "attribute:guard", "attribute:regeneration", "attribute:excavation"].includes(entry.key)) return;
        const key = entry.key.slice(entry.key.indexOf(":") + 1);
        const type = migrateResourceType(key);
        if (type === null) return;
        const next = resourceDefinition(type) ? { ...entry, key: entry.kind + ":" + type, name: resourceDefinition(type).name } : entry;
        if (discovered.has(next.key)) return;
        discovered.add(next.key);
        discoveries.push(next);
        if (index < (data.state.discoveryReadCount || 0)) readCount++;
      });
      state.discoveries = discoveries;
      state.discoveryReadCount = readCount;
      state.discoveredKinds = discovered;
      state.resourceInventory = {};
      for (const [key, amount] of Object.entries(data.state.resourceInventory || {})) {
        const type = migrateResourceType(key);
        if (resourceDefinition(type) && Number.isFinite(amount) && amount >= 0) {
          state.resourceInventory[type] = (state.resourceInventory[type] || 0) + amount;
        }
      }
      resourceStorage.restore();
      state.explored = state.explored instanceof Set ? state.explored : new Set();
      state.knownFood = state.knownFood instanceof Map ? state.knownFood : new Map();
      for (const [key, cell] of state.knownFood) {
        const type = migrateResourceType(cell.resourceType);
        if (cell.kind === "corpse" || type === null) { state.knownFood.delete(key); continue; }
        if (type) cell.resourceType = type;
        const current = foodCellMap.get(key);
        if (current?.resourceType && (!cell.resourceType || cell.resourceType === "honey-mushrooms" && current.resourceType === "clay")) {
          cell.resourceType = current.resourceType;
          cell.kind = current.kind;
        }
      }
      state.footprints = data.state.footprints instanceof Map ? data.state.footprints : new Map();
      if (!(data.state.footprints instanceof Map)) {
        for (const [key, entries] of state.sharedTrails) {
          const entry = entries[0];
          if (!entry) continue;
          state.footprints.set(key, { x: entry.fromX, y: entry.fromY,
            visits: Math.max(1, entry.strength), marks: entries.slice(-6).map(mark => ({
              dx: mark.nextX - mark.fromX, dy: mark.nextY - mark.fromY,
              seed: hashNoise(mark.fromX, mark.fromY) * 100000, at: state.simSeconds
            })) });
        }
      }
      expireFootprints();
      for (const agent of state.agents) {
        if (agent.templateId === null && !agent.slots.length && agent.actionPriorities?.length) {
          agent.slots = [agent.actionPriorities[0] === "explore" ? "antenna" : "strength"];
        }
        delete agent.actionPriorities;
        initializeAgent(agent);
        if (!agent.utility) {
          agent.utility = null;
          agent.mode = agent.birth && state.simSeconds < agent.birth.readyAt ? "birth" : "search";
          agent.decisionPending = "restore";
        }
        for (const key of agent.visited) {
          const [x, y] = key.split(",").map(Number);
          state.explored.add(y * WORLD_SIZE + x);
        }
      }
      if (!Array.isArray(data.state.discoveries)) {
        for (const cell of state.knownFood.values()) discoverResource(cell, null);
        for (const burrow of worldMap.burrows || []) {
          let known = false;
          for (let y = burrow.y; y < burrow.y + burrow.height; y++) {
            for (let x = burrow.x; x < burrow.x + burrow.width; x++) if (state.explored.has(y * WORLD_SIZE + x)) known = true;
          }
          if (known) recordDiscovery("burrow:" + burrow.type, "burrow", burrow.type === "small" ? "작은 굴" : "큰 굴", burrow, null);
        }
        state.discoveryReadCount = state.discoveries.length;
      }
      removedFoodKeys.clear();
      updatePerception();

    }

    if (savedGame !== undefined) restore(savedGame);
    else {
      grantStartingPoints();
      const template = { id: null, name: "기초 채집", slots: [], dna: startingWorkerDna(colony.tribe), revision: 1 };
      if (colony.ownerId === environment.hostId) {
        const { templateId } = command({ type: "design", templateId: null, name: template.name, dna: template.dna, birth: false });
        const stored = state.templates.find(candidate => candidate.id === templateId);
        stored.dna = cloneDna(template.dna);
        Object.assign(template, stored);
      }
      for (const _ of TRIBE_STARTING_UNITS[colony.tribe] || TRIBE_STARTING_UNITS.bean) {
        const agent = spawnAgent({ ...template, id: null }, "colony");
        if (!agent) throw new Error("둥지 주변에 초기 개체를 배치할 공간이 없습니다.");
        agent.templateId = template.id;
        agent.appearanceAttributes = agentAppearanceAttributes(agent);
      }
      updatePerception();
      for (const agent of state.agents) reconsiderAgent(agent, "birth");
    }

    return {
      command, snapshot, save, restore, checkEnding, produce,
      decisionSnapshot() {
        return {state:{...state,rivals:[],corpses:[],footprints:new Map()}};
      },
      updateDecisionState(saved) {
        const explored = state.explored;
        for (const index of saved.state.explored) explored.add(index);
        Object.assign(state,saved.state,{explored});
        for (const key of ["buildings", "nextBuildingId", "constructionProductionReadyAt", "constructionHelpResult", "constructionHelpBuildings", "constructionMaterialNeeds", "foragerMemory", "nestExperienceContributions"]) delete state[key];
        for (const agent of state.agents) {
          for (const key of ["lifespan", "construction", "constructionIntent", "constructionError", "constructionRetryAt", "transport", "transportCargo", "transportReadyAt"]) delete agent[key];
          delete agent.stats.lifespan;
          if (["build", "supply"].includes(agent.utility?.action)) agent.utility = null;
        }
        resourceStorage.restore();
        this.prepare(environment.simSeconds);
        updatePerception();
      },


      nextUpdateAt() {
        let at = state.simSeconds + .5;
        for (const agent of state.agents) {
          if (agent.birth) { at = Math.min(at, agent.birth.readyAt); continue; }
          if (agent.decisionPending) return state.simSeconds;
          at = Math.min(at, agent.nextDecisionAt);
          if (agent.mode === "harvest") at = Math.min(at, agent.harvestReady);
          else if (agent.mode === "unload") at = Math.min(at, agent.unloadReady);
          else if (!["wait", "rest"].includes(agent.mode)) {
            at = Math.min(at, Math.max(agent.moveStartedAt + agent.moveDuration,
              state.simSeconds + Math.max(0, 1 - agent.moveBudget) / agentSpeed(agent)));
          }
        }
        return at;
      },
      get ending() { return state.ending; },
      get agents() { return state.agents; },
      get colonyFood() { return state.colonyFood; },
      get discoveredKinds() { return state.discoveredKinds; },
      isVisible(x, y) { return visibleCells.has(y * WORLD_SIZE + x); },
      get nestLevel() { return state.nestLevel; },
      get nest() { return { id: "nest:" + colony.id, colonyId: colony.id, kind: "nest", x: colony.x, y: colony.y,
        width: COLONY_SIZE, height: COLONY_SIZE, health: state.nestHealth, maxHealth: NEST_LEVELS[state.nestLevel - 1].health }; },
      receiveNestDamage(amount) {
        if (state.nestHealth <= 0 || !Number.isFinite(amount) || amount <= 0) return state.nestHealth;
        state.nestHealth = Math.max(0, state.nestHealth - amount);
        environment.targetRevision = (environment.targetRevision || 0) + 1;
        if (state.nestHealth === 0) {
          roadOptimizer.clear();
          for (const agent of state.agents) {
            if (!["return", "recover"].includes(agent.utility?.action) && !["unload", "rest"].includes(agent.mode)) continue;
            agent.utility = null;
            agent.foodDelivery = null;
            agent.mode = "search";
            agent.decisionPending = "targetLost";
          }
        }
        return state.nestHealth;
      },
      receiveDamage(agent, amount) {
        if (!state.agents.includes(agent) || agent.health <= 0) return;
        damageAgent(agent, amount, false);
        removeDeadAgents();
        if (agent.health > 0 && !updatingAgents) { updatePerception(); reconsiderAgent(agent, "damage"); }
      },
      colonyKnown(entry) { return entry.id === colony.id || state.explored.has((entry.y + 2) * WORLD_SIZE + entry.x + 2); },
      prepare(simSeconds) {
        state.simSeconds = state.ending ? state.ending.endedAt : simSeconds;
        state.rivals = [...environment.games.values()].filter((game) => game !== this).flatMap((game) => game.agents).concat(environment.creatureSystem?.agents || []);
      },
      tick(elapsed) {
        if (state.ending) return;
        navigationCache = {};
        try { updateAgents(elapsed); }
        finally { navigationCache = null; }
      },
      planDecisions(requests) {
        navigationCache = {};
        try {
          return requests.map(request => {
            const agent = state.agents.find(value => value.id === request.id);
            return agent ? utilityAI.evaluate(agent, !["completed", "targetLost", "restore"].includes(request.reason)) : [];
          });
        } finally { navigationCache = null; }
      }
    };
}
