import { ATTRIBUTES, attributeCounts, migrateAttributeSlots, migrateAttributeLevels, attributeUpgradeCost, attributeUpgradeIssue, unitStats, unitCarryCapacity, unitTravelSpeed, unitTerrainSpeedMultiplier, birthCost, hasSynergy } from "./attributes.mjs";
import { buildingDefinition, buildingCost, materialCapacity, buildingAt, buildingContains, constructionApproachCell, constructionSeconds } from "./buildings.mjs";
import { tribeConstructionGoals, tribeConstructionStock } from "./tribe-construction.mjs";
import { createPersonality, personalityLabels, createUtilityAI } from "./utility.mjs";
import { NEST_LEVELS, nestUpgradeCost } from "./nests.mjs";
import { TRIBE_STARTING_UNITS } from "./tribe-start.mjs";
import { colonySupply, recordColonyIncome, restoreColonyIncome } from "./colony-supply.mjs";
import { agentBirthDuration } from "./birth.mjs";
import { AGENT_LIFESPAN, CORPSE_LIFETIME, corpseRecoveryAmount, placeCorpse, expireCorpses } from "./lifespan.mjs";
import { applyAgentGrowth } from "./growth.mjs";
import { AGENT_EXPERIENCE, addAgentExperience, recordCombatExperience } from "./experience.mjs";
import { AGENT_ATTACK_DURATION, AGENT_ATTACK_HIT_TIME } from "./attack.mjs";
import { createRoadOptimizer } from "./roads.mjs";
import { createCombat, combatDisposition, canPursueCombat } from "./combat.mjs";
import { resourceDefinition, resourceTypeForCell, canHarvestResource, migrateResourceType, isTribeFood, isColonyFood, isResourceHabitat, populateColonyFood, resourceHarvestSeconds, resourceHarvestMultiplier } from "./resources.mjs";
import { burrowDistance, burrowApproaches } from "./burrows.mjs";
import { commandCheat } from "./cheats.mjs";
import { migrateCombatStats } from "./combat-stats.mjs";
import { resourceHabitatSuitability } from "./resource-habitats.mjs";
import { tribeHazardKind, tribeTerrainWalkable } from "./tribe-environment.mjs";
import { createResourceStorage } from "./resource-storage.mjs";
import { createConstructionSupply } from "./construction-supply.mjs";
import { constructionHelp, constructionHelpTemplate } from "./beginner-help.mjs";
import { constructionHarvestNeeds } from "./construction-harvest.mjs";

export function createGame(environment, colony, savedGame) {
    populateColonyFood(environment);
    const combat = environment.combatSystem || (environment.combatSystem = createCombat(environment));
    const worldMap = environment.world;
    if (worldMap.hazards) for (let index = 0; index < worldMap.hazards.length; index++) if (worldMap.hazards[index] === 1 || worldMap.hazards[index] === 2) worldMap.hazards[index] = 0;
    const WORLD_SIZE = 320;

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
      constructionHelpResult: null,
      constructionHelpBuildings: [],
      resourceInventory: {},
      buildings: [],
      nextBuildingId: 1,
      evolutionPoints: 0,
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
    let decisionTargetRevision = -1;
    let discoveryBaselinePending = false;
    let updatingAgents = false;
    let footprintCleanupAt = 0;
    const resourceStorage = createResourceStorage(state, colony);
    let constructionHelpPreview = null;
    let constructionRouteMemo = null;
    const constructionSupplyContext = { state, colony, storage: resourceStorage, route: (agent, target) => constructionRoute(agent, target, constructionFootprints()),
      walkable: (x, y) => x >= 0 && y >= 0 && x < WORLD_SIZE && y < WORLD_SIZE &&
        state.explored.has(y * WORLD_SIZE + x) && isWalkable(x, y) && !hazardAt(x, y),
      isFood: type => isColonyFood(type, colony.tribe, worldMap.generationVersion), deliveryCells: colonyDeliveryCells,
      canHarvest: (food, agent) => canHarvestResource(food, worldMap, agent.attributes, colony.tribe),
      resourceType: food => resourceTypeForCell(food, worldMap),
      harvestSeconds: (type, agent) => resourceHarvestSeconds(type, worldMap) * resourceHarvestMultiplier(type, agent.attributes) / (agent.stats.harvestSpeedMultiplier ?? 1),
      terrainAt: (x, y) => worldMap.terrain[y * WORLD_SIZE + x], deliveryCapacity,
      forecastRoute: (agent,target,plan) => {
        const excluded = constructionFootprints(),definition = buildingDefinition(plan.buildingKey);
        for (let y=plan.y;y<plan.y+definition.height;y++) for (let x=plan.x;x<plan.x+definition.width;x++) excluded.add(y * WORLD_SIZE + x);
        return constructionRoute(agent,target,excluded);
      } };
    const constructionSupply = createConstructionSupply(constructionSupplyContext);
    const utilityAI = createUtilityAI({ state, tribe: colony.tribe, size: WORLD_SIZE, homeCells: colonyBoundaryCells,
      deliveryCells: colonyDeliveryCells, permanentVisionSources,
      terrainAt: (x, y) => worldMap.terrain[y * WORLD_SIZE + x],
      walkable: (x, y) => state.explored.has(y * WORLD_SIZE + x) && isWalkable(x, y),
      hazardAt: (x, y) => state.explored.has(y * WORLD_SIZE + x) ? hazardAt(x, y) : 0,
      enemies: () => state.rivals.filter(enemy => !enemy.hidden && visibleCells.has(enemy.y * WORLD_SIZE + enemy.x)), burrows: visibleBurrows, nests: visibleNests, synergy,
      resourceType: food => resourceTypeForCell(food, worldMap),
      harvestSeconds: (type, agent) => resourceHarvestSeconds(type, worldMap) * resourceHarvestMultiplier(type, agent?.attributes) / (agent?.stats?.harvestSpeedMultiplier ?? 1),
      materialSpace: () => resourceSpace(), deliveryCapacity,
      constructionPlans,
      constructionTransport: constructionSupply.plans,
      constructionForagers: constructionSupply.foragers,
      constructionAllocation: constructionSupply.allocation,
      constructionMaterials: () => {
        const targets = constructionMaterialTargets(true);
        const needs = Object.fromEntries(Object.entries(targets).map(([type,amount]) =>
          [type,Math.max(0,amount - (state.resourceInventory[type] || 0))]));
        for (const [type, amount] of Object.entries(constructionSupply.shortages())) needs[type] = Math.max(needs[type] || 0, amount);
        state.constructionMaterialNeeds = needs;
        return needs;
      },
      isFood: type => isColonyFood(type, colony.tribe, worldMap.generationVersion),
      foodType: Object.keys(buildingCost("storage", colony.tribe).materials)[0],
      resourceHabitat: (type,x,y) => worldMap.hydrology?.resourceHabitats ?
        resourceHabitatSuitability(type, y * WORLD_SIZE + x, worldMap.terrain, worldMap.hydrology) : Number(isResourceHabitat(type, worldMap, x, y)),
      canHarvest: (food, agent) => canHarvestResource(food, worldMap, agent.attributes, colony.tribe) });
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
      if (observer?.perceptionExperienceReady) addAgentExperience(observer, AGENT_EXPERIENCE.discovery);
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
          if (!state.explored.has(index) && observer?.perceptionExperienceReady) addAgentExperience(observer, AGENT_EXPERIENCE.exploration);
          state.explored.add(index);
          const key = cx + "," + cy;
          if (worldMap.treeCells?.[index]) discoverResource({ x: cx, y: cy, resourceType: "tree", kind: "tree" }, observer);
          const food = foodCellMap.get(key);
          if (food?.amount > 0) {
            state.knownFood.set(key, { ...food });
            discoverResource(food, observer);
          }
          else if (food?.resourceType === "tree" || food?.kind === "corpse") state.knownFood.set(key, { ...food });
          else state.knownFood.delete(key);
        }
      }
    }

    function permanentVisionSources() {
      const sources = [];
      if (state.nestHealth > 0) sources.push({ x: COLONY_ORIGIN.x + 2, y: COLONY_ORIGIN.y + 2, radius: 6 });
      for (const building of state.buildings) {
        if (building.health <= 0) continue;
        sources.push({ x: building.x + Math.floor(building.width / 2), y: building.y + Math.floor(building.height / 2),
          radius: buildingDefinition(building.key)?.visionRadius || 1 });
      }
      return sources;
    }

    function updatePerception() {
      decisionTargets = null;
      visibleCells = new Set();
      for (const source of permanentVisionSources()) revealAround(source.x, source.y, source.radius, null);
      for (const [key, known] of state.knownFood) {
        if (key !== known.x + "," + known.y && visibleCells.has(known.y * WORLD_SIZE + known.x) &&
          !(foodCellMap.get(key)?.amount > 0 || foodCellMap.get(key)?.kind === "corpse")) state.knownFood.delete(key);
      }
      for (const corpse of foodCellMap.values()) {
        if (corpse.kind !== "corpse" || corpse.colonyId !== colony.id || corpse.amount <= 0 ||
          state.simSeconds >= corpse.decaysAt) continue;
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
        if (food.amount > 0 || food.kind === "corpse") {
          state.knownFood.set(key, { ...food });
          discoverResource(food, discoveryObserver(food));
        } else state.knownFood.delete(key);
      }
      state.markers = [...markers.values()];
      discoverObjects();
      for (const agent of state.agents) {
        if (agent.health > 0 && !(agent.birth && state.simSeconds < agent.birth.readyAt)) agent.perceptionExperienceReady = true;
      }
    }

    function agentAppearanceAttributes(agent) {
      return { ...agent.attributes };
    }

    function initializeAgent(agent) {
      agent.attributeLevels = migrateAttributeLevels(agent.slots, agent.attributeLevels, state.nestLevel);
      agent.slots = migrateAttributeSlots(agent.slots);
      agent.tribe = colony.tribe || "bean";
      if (["pebble", "spore"].includes(agent.tribe) && agent.birth) agent.birth.readyAt = agent.birth.startedAt + agentBirthDuration(agent.tribe);
      agent.bornAt = Number.isFinite(agent.bornAt) && agent.bornAt >= 0 && agent.bornAt <= state.simSeconds ? agent.bornAt : state.simSeconds;
      agent.lifespan = Number.isFinite(agent.lifespan) && agent.lifespan > 0 ? agent.lifespan : AGENT_LIFESPAN;
      const carryingType = migrateResourceType(agent.carryingType);
      if (carryingType === null) agent.carrying = 0;
      agent.carryingType = carryingType;
      for (const key of ["foodDelivery", "harvestResult"]) {
        if (!agent[key]) continue;
        const type = migrateResourceType(agent[key].resourceType);
        if (type === null) agent[key] = null;
        else if (type) agent[key].resourceType = type;
      }
      agent.carryingType = agent.carrying > 0 ? resourceDefinition(agent.carryingType)?.key || "honey-mushrooms" : null;
      if (agent.foodDelivery && !agent.foodDelivery.resourceType) agent.foodDelivery.resourceType = agent.carryingType || "honey-mushrooms";
      if (!agent.personality || !["boldness", "aggression", "curiosity"].every(key =>
        Number.isFinite(agent.personality[key]) && agent.personality[key] >= 0 && agent.personality[key] <= 1)) {
        const seed = [...String(agent.id)].reduce((value, character) => Math.imul(value, 31) + character.charCodeAt(0), worldMap.seed || 0);
        let axis = 0;
        agent.personality = createPersonality(() => hashNoise(seed + ++axis * 17417, (agent.bornAt || 0) + axis * 7919));
      } else agent.personality = Object.freeze({ ...agent.personality });
      agent.knownEnemyIds = agent.knownEnemyIds instanceof Set ? agent.knownEnemyIds : new Set();
      if (agent.decisionPending === undefined) agent.decisionPending = "birth";
      agent.nextDecisionAt = Number.isFinite(agent.nextDecisionAt) ? agent.nextDecisionAt : state.simSeconds;
      agent.growthActivity = Number.isFinite(agent.growthActivity) && agent.growthActivity >= 0 ? agent.growthActivity : 0;
      agent.perceptionExperienceReady = false;
      migrateCombatStats(agent);
      agent.level = 0;
      applyAgentGrowth(agent, state.simSeconds);
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
      agent.waveUntil = agent.waveUntil || 0;
      agent.preciseHarvestTimes = agent.preciseHarvestTimes instanceof Map ? agent.preciseHarvestTimes : new Map();
      agent.harvestReady = agent.harvestReady || 0;
      agent.harvestStarted = agent.harvestStarted || 0;
      if (!Number.isSafeInteger(agent.harvestResult?.sequence) || agent.harvestResult.sequence < 1 ||
        !Number.isFinite(agent.harvestResult.completedAt)) agent.harvestResult = null;
      agent.unloadReady = agent.unloadReady || 0;
      agent.attackReady = agent.attackReady || 0;
      agent.attack = agent.attack || null;
      if (agent.construction && (!agent.attributes.construction || !buildingDefinition(agent.construction.buildingKey) ||
        !Number.isInteger(agent.construction.x) || !Number.isInteger(agent.construction.y) ||
        !Array.isArray(agent.construction.route) || !Number.isInteger(agent.construction.routeIndex) ||
        agent.construction.routeIndex < 0 || agent.construction.routeIndex >= agent.construction.route.length ||
        agent.construction.route.some(cell => !Number.isInteger(cell.x) || !Number.isInteger(cell.y)) ||
        !["moving", "transforming"].includes(agent.construction.state))) {
        cancelConstruction(agent, "저장된 건설 경로를 다시 지정해 주세요.");
      }
      if (agent.construction?.state === "transforming") {
        const plan = agent.construction, duration = plan.readyAt - plan.startedAt;
        if (!Number.isFinite(duration) || duration < 10) {
          const progress = Number.isFinite(duration) && duration > 0 ? Math.max(0, Math.min(1, (state.simSeconds - plan.startedAt) / duration)) : 0;
          const seconds = constructionSeconds(plan.buildingKey, agent.attributes.construction);
          plan.startedAt = state.simSeconds - progress * seconds; plan.readyAt = plan.startedAt + seconds;
        }
      }
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
        environment.games.get(entry.ownerId)?.nest?.health !== 0 && entry.occupiedCells.has((x - entry.x) + "," + (y - entry.y))
      ) || null;
    }

    function activeNestSites() {
      return (state.nestHealth > 0 ? colonyEntries : []).concat(state.buildings.filter(building => building.key === "outpost" && building.health > 0)
        .map(building => ({ ...building, occupiedCells: new Set(Array.from({ length: building.width * building.height }, (_, index) =>
          index % building.width + "," + Math.floor(index / building.width))) })));
    }

    function hasActiveNest() {
      return state.nestHealth > 0 || state.buildings.some(building => building.key === "outpost" && building.health > 0);
    }

    function isColonyBoundaryCell(x, y) {
      if (!hasActiveNest() || !isWalkable(x, y)) {
        return false;
      }
      return activeNestSites().some(site => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([cx, cy]) => site.occupiedCells.has((cx - site.x) + "," + (cy - site.y))));
    }

    function colonyBoundaryCells() {
      if (!hasActiveNest()) return [];
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
      return cells;
    }

    function colonyDeliveryCells(agent) {
      const stores = resourceStorage.refresh().filter(store => store.kind !== "remains");
      const material = agent && agent.carrying > 0 && (agent.transportCargo ||
        (state.constructionMaterialNeeds?.[agent.carryingType] || 0) > 0 ||
        !isColonyFood(agent.carryingType, colony.tribe, worldMap.generationVersion));
      const cells = stores.filter(store => !agent || resourceStorage.space(store) > 1e-8 ||
        !material && state.evolutionPoints < pointCapacity()).flatMap(store => resourceStorage.cells(store));
      if (!material) for (const building of state.buildings.filter(building => building.key === "outpost" && building.health > 0)) {
        for (const [dx, dy] of [[0, -1], [building.width - 1, -1], [0, building.height], [building.width - 1, building.height]]) {
          cells.push({ x: building.x + dx, y: building.y + dy });
        }
      }
      return [...new Map(cells.filter(cell => isWalkable(cell.x, cell.y)).map(cell => [cell.x + "," + cell.y, cell])).values()];
    }

    function isColonyDeliveryCell(x, y) {
      return colonyDeliveryCells().some(cell => cell.x === x && cell.y === y);
    }

    function deliveryDestination(agent) {
      const store = resourceStorage.at(agent.x, agent.y);
      if (store) return { buildingId: store.kind === "nest" ? null : store.id,
        targetX: store.x + store.width / 2, targetY: store.y + store.height / 2 };
      const site = state.buildings.find(building => building.key === "outpost" && building.health > 0 &&
        (agent.y === building.y - 1 || agent.y === building.y + building.height) &&
        (agent.x === building.x || agent.x === building.x + building.width - 1));
      return { buildingId: site?.id || null, targetX: site ? site.x + site.width / 2 : COLONY_CENTER.x,
        targetY: site ? site.y + site.height / 2 : COLONY_CENTER.y };
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

    function spawnBoundaryCells(birthBuilding) {
      let cells = colonyBoundaryCells();
      if (birthBuilding) cells = cells.filter(cell => cell.x >= birthBuilding.x - 1 && cell.x <= birthBuilding.x + birthBuilding.width &&
        cell.y >= birthBuilding.y - 1 && cell.y <= birthBuilding.y + birthBuilding.height);
      else if (state.nestHealth > 0) cells = cells.filter(cell => cell.x >= colony.x - 1 && cell.x <= colony.x + COLONY_SIZE &&
        cell.y >= colony.y - 1 && cell.y <= colony.y + COLONY_SIZE);
      return cells;
    }

    function availableSpawnCells(birthBuilding) {
      const available = spawnBoundaryCells(birthBuilding).filter(cell => !isAgentCellOccupied(cell.x, cell.y, null));
      if (colony.tribe === "spring" || colony.tribe === "pebble") return available.filter(cell =>
        cell.y >= (birthBuilding?.y ?? (state.nestHealth > 0 ? colony.y :
          state.buildings.find(building => building.key === "outpost" && building.health > 0 && cell.x >= building.x - 1 && cell.x <= building.x + building.width)?.y ?? cell.y - 1)) + 1);
      return available;
    }

    function chooseSpawnPosition(randomized, birthBuilding) {
      if (randomized) {
        const available = availableSpawnCells(birthBuilding);
        return available.length ? { ...available[Math.floor(Math.random() * available.length)] } : null;
      }
      const cells = spawnBoundaryCells(birthBuilding);
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
      if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE || colonyAt(x, y) || buildingAt(environment, x, y) || environment.creatureSystem?.burrowAt?.(x, y)) {
        return false;
      }
      return tribeTerrainWalkable(colony.tribe, worldMap.terrain[y * WORLD_SIZE + x]);
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
      agent.moveStartedAt = startedAt;
      agent.x = destination.x;
      agent.y = destination.y;
      agent.moveDuration = 1 / agentSpeed(agent);
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
      if (!food || food.amount <= 0 || !canHarvestResource(food, worldMap, agent.attributes, colony.tribe) ||
        agent.carrying > 0 && (agent.carryingType || "honey-mushrooms") !== resourceTypeForCell(food, worldMap)) {
        agent.decisionPending = "targetLost"; return;
      }
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
      if (!canHarvestResource(food, worldMap, agent.attributes, colony.tribe) || agent.carrying > 0 && (agent.carryingType || "honey-mushrooms") !== resourceType) {
        agent.decisionPending = "targetLost"; return;
      }
      const harvestSeconds = resourceHarvestSeconds(resourceType, worldMap) * resourceHarvestMultiplier(resourceType, agent.attributes) / (agent.stats.harvestSpeedMultiplier ?? 1);
      const capacity = Math.min(agent.utility?.plannedCargo ?? Infinity, unitCarryCapacity(agent, resourceType) + (synergy(agent, ["strength", "strength"]) ? 4 : 0));
      const take = (amount, completedAt) => {
        const collected = Math.min(amount, Math.max(0, capacity - agent.carrying), Math.max(0, food?.amount || 0));
        if (collected > 0) {
          food.amount = Math.round((food.amount - collected) * 10) / 10;
          addAgentExperience(agent, collected * AGENT_EXPERIENCE.harvest);
          agent.carrying = Math.round((agent.carrying + collected) * 10) / 10;
          agent.carryingType = resourceType;
          agent.harvestResult = {
            sequence: (agent.harvestResult?.sequence || 0) + 1, resourceType, x: food.x, y: food.y,
            amount: collected, remaining: food.amount, initialAmount: food.initialAmount ?? food.amount + collected,
            kind: food.kind || (resourceDefinition(resourceType).category === "material" ? "resource" : "food"),
            terrain: food.terrain || terrainAt(food.x, food.y), completedAt
          };
          if (resourceType === "tree" && food.amount <= 0) {
            if (!worldMap.depletedTrees) worldMap.depletedTrees = new Set();
            worldMap.depletedTrees.add(food.y * WORLD_SIZE + food.x);
            if (worldMap.treeCells) worldMap.treeCells[food.y * WORLD_SIZE + food.x] = 0;
          }
          if (resourceType === "meat" && food.amount <= 0 && food.carapaceAmount > 0) {
            food.resourceType = "carapace";
            food.amount = food.initialAmount = food.carapaceAmount;
            food.carapaceAmount = 0;
          }
          if (food.kind === "corpse" && food.amount <= 0) {
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
      if (agent.transportCargo) {
        agent.carrying -= resourceStorage.deposit(store, resourceType, agent.carrying);
        if (agent.carrying <= 1e-8) { agent.carrying = 0; agent.carryingType = null; agent.transportCargo = null; }
        agent.mode = "search"; agent.utility = null; agent.decisionPending = "completed";
        return;
      }
      const target = material ? Infinity : constructionMaterialTargets()[resourceType] || 0;
      const needed = material ? Infinity : Math.max(0,target - (state.resourceInventory[resourceType] || 0));
      const deposited = Math.min(agent.carrying, material ? availableMaterials : Math.max(availablePoints, Math.min(availableMaterials,needed)));
      agent.carryingBeforeDeposit = deposited;
      agent.foodDelivery = deposited > 0 ? {
        ...agent.foodDelivery, ...deliveryDestination(agent), colonyId: colony.id, x: agent.x + 0.5, y: agent.y + 0.5,
        startedAt: agent.foodDelivery?.startedAt ?? agent.unloadReady - 1,
        arrivesAt: agent.unloadReady, receivedAt: state.simSeconds, amount: deposited, resourceType
      } : null;
      const reservedSpace = material ? 0 : Object.entries(state.constructionMaterialNeeds || {}).reduce((sum,[type,amount]) =>
        sum + (!isColonyFood(type,colony.tribe,worldMap.generationVersion) ? Math.max(0,amount) : 0),0);
      const stored = Math.min(deposited,availableMaterials,needed,material ? Infinity : Math.max(0,resourceSpace() - reservedSpace));
      if (stored > 0) resourceStorage.deposit(store, resourceType, stored);
      if (!material) {
        state.colonyFood = Math.round((state.colonyFood + deposited) * 10) / 10;
        if (deposited > 0) state.lastFoodAt = state.simSeconds;
        recordColonyIncome(state, Math.min(deposited, availablePoints));
        state.evolutionPoints = Math.round((state.evolutionPoints + Math.min(deposited, availablePoints)) * 10) / 10;
      }
      addAgentExperience(agent, deposited * AGENT_EXPERIENCE.delivery);
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

    function scheduledDecisionEvent(agent) {
      const targets = combatTargets();
      if (agent.decisionPending || agent.retreat || hazardAt(agent.x, agent.y) || targets.some(target => !target.kind || target.kind === "agent") ||
          state.simSeconds >= agent.nextDecisionAt) return decisionEvent(agent);
      const plan = agent.utility, food = plan?.action === "collect" ? state.knownFood.get(plan.target.key) : null;
      const signature = [agent.x, agent.y, agent.health, agent.stats.health, agent.level, agent.mode, agent.carrying, agent.carryingType,
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
      if (agent.health <= 0 || agent.construction || agent.combat || agent.birth && state.simSeconds < agent.birth.readyAt ||
        agent.attack && state.simSeconds < agent.attack.endsAt) return;
      const candidates = utilityAI.evaluate(agent, !["completed", "targetLost", "restore"].includes(reason));
      const best = candidates[0];
      agent.decisionCount = (agent.decisionCount || 0) + 1;
      agent.lastDecisionAt = state.simSeconds;
      agent.lastDecisionReason = reason;
      agent.nextDecisionAt = state.simSeconds + 3;
      agent.decisionPending = null;
      agent.knownEnemyIds = new Set(combatTargets().map(enemy => enemy.id));
      if (!best) {
        if (agent.transport) constructionSupply.release(agent);
        agent.utility = null;
        agent.mode = "wait";
        return;
      }
      if (best.action === "build") {
        beginConstruction({ agentId: agent.id, buildingKey: best.target.buildingKey, x: best.target.x, y: best.target.y });
        return;
      }
      const previous = agent.utility;
      if (best.action === "supply") {
        if (previous?.action !== "supply" || previous.target.key !== best.target.key) constructionSupply.assign(agent, best.transport);
      } else if (agent.transport) constructionSupply.release(agent);
      const same = previous?.action === best.action && previous.target?.key === best.target.key;
      agent.utility = { action: best.action, target: best.target, route: best.route,
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
      } else if (best.action === "supply") agent.mode = "return";
      else if (best.action === "recover") agent.mode = "recover";
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
      if (plan?.action === "collect" && (!(state.knownFood.get(plan.target.key)?.amount > 0) ||
        !isTribeFood(resourceTypeForCell(state.knownFood.get(plan.target.key), worldMap), colony.tribe, worldMap.generationVersion) &&
          !["meat", "carapace"].includes(resourceTypeForCell(state.knownFood.get(plan.target.key), worldMap)) ||
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
      const plan = agent.utility;
      if (!plan) return false;
      const movingFor = state.simSeconds - agent.moveStartedAt;
      if (movingFor < agent.moveDuration) {
        if (agent.moveDuration - movingFor > 1e-8) return false;
        agent.moveDuration = movingFor;
      }
      if (plan.action === "supply" && agent.x === plan.target.x && agent.y === plan.target.y) {
        const delivered = constructionSupply.interact(agent);
        if (delivered > 0) addAgentExperience(agent, delivered * AGENT_EXPERIENCE.delivery);
        return false;
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
        if (!building && !canPursueCombat(agent, target, state.simSeconds) || combatDisposition(agent) === "peaceful") {
          agent.decisionPending = "targetLost"; return false;
        }
        if (!building && agent.x === target.x && agent.y === target.y) {
          combat.engage(agent, target, state.simSeconds);
          combat.update(agent, state.simSeconds);
          return false;
        }
        if (building && burrowDistance(agent, target) <= 1) {
          if (state.simSeconds >= agent.attackReady) {
            agent.attack = { startedAt: state.simSeconds, speed: 1,
              hitAt: state.simSeconds + AGENT_ATTACK_HIT_TIME,
              endsAt: state.simSeconds + AGENT_ATTACK_DURATION,
              targetId: target.id, targetKind: ["burrow", "nest"].includes(target.kind) ? target.kind : "agent", targetX: target.x, targetY: target.y,
              directionX: Math.sign(target.x - agent.x) || 1, damage: agent.stats.attack,
              resolved: false, hit: false };
            agent.attackReady = agent.attack.endsAt;
          }
          return false;
        }
        if (building) target = burrowApproaches(target).filter(cell => isWalkable(cell.x, cell.y))
          .sort((first, second) => Math.abs(first.x - agent.x) + Math.abs(first.y - agent.y) -
            Math.abs(second.x - agent.x) - Math.abs(second.y - agent.y))[0];
        if (!target) return false;
      }
      if (agent.moveBudget + 1e-8 < 1) return false;
      const candidates = plan.action === "explore" ? [
        { x: agent.x + 1, y: agent.y }, { x: agent.x - 1, y: agent.y },
        { x: agent.x, y: agent.y + 1 }, { x: agent.x, y: agent.y - 1 }
      ].filter(cell => cell.x >= 0 && cell.y >= 0 && cell.x < WORLD_SIZE && cell.y < WORLD_SIZE &&
        state.explored.has(cell.y * WORLD_SIZE + cell.x) && isWalkable(cell.x, cell.y)) : walkableNeighbors(agent.x, agent.y);
      if (plan.action === "supply") {
        const blocked = constructionFootprints();
        for (let index = candidates.length - 1; index >= 0; index--) if (blocked.has(candidates[index].y * WORLD_SIZE + candidates[index].x)) candidates.splice(index, 1);
      }
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
      const previousEnd = agent.moveStartedAt + agent.moveDuration;
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

    function canSpendResources(cost) {
      const available = constructionSupply.available();
      return cost && state.evolutionPoints >= cost.evolutionPoints && Object.entries(cost.materials).every(([key, amount]) =>
        (available[key] || 0) + 1e-8 >= amount);
    }

    function spendResources(cost) {
      state.evolutionPoints = Math.round((state.evolutionPoints - cost.evolutionPoints) * 10) / 10;
      resourceStorage.spend(cost.materials);
    }

    function constructionFootprints() {
      const cells = new Set();
      for (const agent of state.agents) {
        const plan = agent.construction, definition = plan && buildingDefinition(plan.buildingKey);
        if (!definition || agent.health <= 0) continue;
        for (let y = plan.y; y < plan.y + definition.height; y++) for (let x = plan.x; x < plan.x + definition.width; x++) cells.add(y * WORLD_SIZE + x);
      }
      return cells;
    }

    function constructionRoute(agent, target, excluded) {
      const key = constructionRouteMemo ? JSON.stringify([agent.x,agent.y,target.x,target.y,
        excluded ? [...excluded].sort((a,b) => a-b) : []]) : null;
      if (constructionRouteMemo?.has(key)) return constructionRouteMemo.get(key)?.map(cell => ({...cell})) || null;
      const start = agent.y * WORLD_SIZE + agent.x, goal = target.y * WORLD_SIZE + target.x;
      const parents = new Map([[start, null]]), queue = [start];
      for (let cursor = 0; cursor < queue.length && cursor < 12000; cursor++) {
        const index = queue[cursor], x = index % WORLD_SIZE, y = Math.floor(index / WORLD_SIZE);
        if (index === goal) {
          const route = [];
          for (let next = index; next !== null; next = parents.get(next)) route.push({ x: next % WORLD_SIZE, y: Math.floor(next / WORLD_SIZE) });
          route.reverse();
          if (constructionRouteMemo) constructionRouteMemo.set(key,route.map(cell => ({...cell})));
          return route;
        }
        for (const cell of walkableNeighbors(x, y)) {
          const next = cell.y * WORLD_SIZE + cell.x;
          if (parents.has(next) || !state.explored.has(next) || excluded?.has(next) || hazardAt(cell.x, cell.y)) continue;
          parents.set(next, index); queue.push(next);
        }
      }
      if (constructionRouteMemo) constructionRouteMemo.set(key,null);
      return null;
    }

    function constructionSiteOccupied(plan, agent) {
      const definition = buildingDefinition(plan.buildingKey);
      const contains = (x,y) => x >= plan.x && y >= plan.y && x < plan.x + definition.width && y < plan.y + definition.height;
      return [...environment.games.values()].flatMap(game => game.agents).concat(environment.creatureSystem?.agents || []).some(candidate =>
        candidate !== agent && candidate.health > 0 && (contains(candidate.x,candidate.y) ||
          state.simSeconds < candidate.moveStartedAt + candidate.moveDuration && contains(candidate.renderFromX,candidate.renderFromY)));
    }

    function constructionSiteIssue(buildingKey, x, y, agent) {
      const definition = buildingDefinition(buildingKey);
      if (!definition || !Number.isInteger(x) || !Number.isInteger(y)) return "건물과 위치를 다시 확인해 주세요.";
      const site = { x, y, width: definition.width, height: definition.height, health: 1 };
      const boundary = colonyBoundaryCells();
      for (let dy = 0; dy < site.height; dy++) for (let dx = 0; dx < site.width; dx++) {
        const cx = x + dx, cy = y + dy, index = cy * WORLD_SIZE + cx;
        if (!isWalkable(cx, cy) || worldMap.terrain[index] === 9 || worldMap.terrain[index] === 10 || !state.explored.has(index) || hazardAt(cx, cy)) return "탐색한 안전한 빈 땅에 건설해 주세요.";
        if (boundary.some(cell => cell.x === cx && cell.y === cy)) return "둥지 출입구에서 한 칸 띄워 건설해 주세요.";
        if (foodCellMap.get(cx + "," + cy)?.amount > 0 || worldMap.treeCells?.[index]) return "자원이 있는 칸에는 건설할 수 없습니다.";

      }
      if (constructionSiteOccupied({buildingKey,x,y},agent)) return "다른 개체가 있는 칸에는 건설할 수 없습니다.";
      if (state.agents.some(candidate => candidate !== agent && candidate.construction &&
        buildingDefinition(candidate.construction.buildingKey) &&
        candidate.construction.x < x + site.width && candidate.construction.y < y + site.height &&
        candidate.construction.x + buildingDefinition(candidate.construction.buildingKey).width > x &&
        candidate.construction.y + buildingDefinition(candidate.construction.buildingKey).height > y)) return "이미 건설이 진행 중인 자리입니다.";
      const delivery = colonyDeliveryCells();
      const queue = (delivery.length || buildingKey !== "outpost" ? delivery : burrowApproaches(site)
        .filter(cell => state.explored.has(cell.y * WORLD_SIZE + cell.x) && isWalkable(cell.x, cell.y)))
        .filter(cell => !buildingContains(site, cell.x, cell.y));
      const reachable = new Set(queue.map(cell => cell.y * WORLD_SIZE + cell.x));
      for (let cursor = 0; cursor < queue.length; cursor++) {
        for (const cell of walkableNeighbors(queue[cursor].x, queue[cursor].y)) {
          const index = cell.y * WORLD_SIZE + cell.x;
          if (reachable.has(index) || !state.explored.has(index) || buildingContains(site, cell.x, cell.y)) continue;
          reachable.add(index); queue.push(cell);
        }
      }
      if (state.agents.some(candidate => candidate !== agent && candidate.health > 0 && !reachable.has(candidate.y * WORLD_SIZE + candidate.x))) {
        return "개체가 둥지로 돌아오는 통로를 남겨 주세요.";
      }
      return null;
    }

    function reconsiderConstruction() {
      for (const agent of state.agents) if (agent.health > 0 && agent.attributes?.construction && !agent.construction) {
        agent.decisionPending = "targetLost";
        agent.nextDecisionAt = state.simSeconds;
      }
    }

    function constructionSites(agent, planningState, needs) {
      let best = null;
      const threats = combatTargets().filter(enemy => combatDisposition(enemy) === "aggressive" || enemy.combat);
      for (const need of needs) {
        const definition = buildingDefinition(need.buildingKey);
        let anchor = need.anchor;
        if (need.buildingKey === "outpost") {
          const route = constructionRoute(agent, anchor);
          if (!route) continue;
          const budget = Math.max(0, (agent.bornAt + agent.lifespan - state.simSeconds - definition.buildSeconds - 15) * .8);
          let seconds = 0;
          for (const cell of route.slice(1)) {
            seconds += 1 / (unitTravelSpeed(agent, 0) * unitTerrainSpeedMultiplier(agent, worldMap.terrain[cell.y * WORLD_SIZE + cell.x]));
            if (seconds > budget) break;
            anchor = cell;
          }
          if (Math.hypot(anchor.x - agent.x, anchor.y - agent.y) < 12 && route.length > 18) continue;
        }
        const anchors = [anchor], logistics = need.buildingKey === "storage" && !need.benefits.storage;
        const homeDistance = cell => Math.min(...activeNestSites().map(home => Math.hypot(cell.x - home.x - (home.width || 5) / 2,
          cell.y - home.y - (home.height || 5) / 2)));
        if (logistics) {
          const route = constructionRoute(agent,anchor);
          if (route?.length > 18) for (let index = 6; index < route.length; index += 6) anchors.push(route[index]);
          for (const home of activeNestSites()) {
            const center = {x:home.x + Math.floor((home.width || COLONY_SIZE) / 2),y:home.y + Math.floor((home.height || COLONY_SIZE) / 2)};
            for (const offset of [[8,0],[-8,0],[0,8],[0,-8]]) anchors.push({x:center.x + offset[0],y:center.y + offset[1]});
          }
        }
        const candidates = new Map(), plans = [];
        for (const center of anchors) for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
          const x = center.x + dx, y = center.y + dy;
          if (!planningState.explored.has(y * WORLD_SIZE + x) || !isWalkable(x,y) || hazardAt(x,y) || logistics && homeDistance({x,y}) < 8) continue;
          const distance = logistics ? Math.hypot(agent.x - x,agent.y - y) + .25 * Math.hypot(anchor.x - x,anchor.y - y) :
            dx * dx + dy * dy + .1 * (Math.abs(agent.x - x) + Math.abs(agent.y - y));
          const previous = candidates.get(x + "," + y);
          if (!previous || previous.distance > distance) candidates.set(x + "," + y,{x,y,distance});
        }
        const sites = [...candidates.values()];
        for (const site of sites.sort((a,b) => a.distance - b.distance)) {
          if (threats.some(enemy => Math.hypot(enemy.x - site.x - definition.width / 2, enemy.y - site.y - definition.height / 2) < 6)) continue;
          if (constructionSiteIssue(need.buildingKey, site.x, site.y, agent)) continue;
          const route = constructionRoute(agent, constructionApproachCell({...site, buildingKey:need.buildingKey}));
          const approach = constructionRoute(agent, site);
          if (!route || !approach) continue;
          const travelSeconds = Math.max(...[route, approach].map(cells => cells.slice(1).reduce((sum, cell) => sum +
            1 / (unitTravelSpeed(agent, 0) * unitTerrainSpeedMultiplier(agent, worldMap.terrain[cell.y * WORLD_SIZE + cell.x])), 0)));
          plans.push({buildingKey:need.buildingKey, x:site.x, y:site.y, gains:need.gains, travelSeconds,
            buildSeconds:constructionSeconds(need.buildingKey, agent.attributes.construction)});
          if (plans.length >= (needs.length > 1 ? 1 : 12)) break;
        }
        if (plans.length) {
          const travel = Math.min(...plans.map(plan => plan.travelSeconds));
          const score = need.score / (1 + travel / (definition.buildSeconds * 2));
          if (!best || score > best.score) best = {need,plans,score};
        }
      }
      return best;
    }

    function constructionPreview(template, position) {
      const attributes = attributeCounts(template.slots, template.attributeLevels), stats = unitStats(attributes, colony.tribe);
      return {...position, id:colony.id + ":preview", tribe:colony.tribe, slots:template.slots, attributes, stats,
        health:stats.health, bornAt:state.simSeconds, lifespan:stats.lifespan, carrying:0, birth:null};
    }

    function constructionMaterialTargets(refresh) {
      const active = state.agents.some(agent => agent.health > 0 && agent.construction);
      const idle = state.agents.some(agent => agent.health >= agent.stats.health * .6 && agent.attributes?.construction &&
        !agent.construction && agent.bornAt + agent.lifespan - state.simSeconds > 60);
      const objective = !active || idle ? refresh ? constructionObjective(false) : constructionHelpPreview?.objective : null;
      return tribeConstructionStock(state,colony.tribe,objective?.need);
    }

    function constructionObjective(refresh) {
      if (colony.tribe === null || !hasActiveNest()) return null;
      const builder = state.agents.find(agent => agent.health >= agent.stats.health * .6 && agent.attributes?.construction && !agent.construction &&
        agent.bornAt + agent.lifespan - state.simSeconds > 60);
      const position = availableSpawnCells(null)[0] || colonyBoundaryCells()[0];
      if (!position && !builder) return null;
      const template = constructionHelpTemplate({...state, tribe:colony.tribe});
      const proxy = builder ? {...builder, carrying:0, birth:null} : constructionPreview(template, position);
      const signature = JSON.stringify([Math.floor(state.simSeconds / 2), state.nestLevel, state.nestHealth, state.evolutionPoints,
        state.explored.size, state.knownFood.size, environment.targetRevision, state.resourceInventory,
        state.templates.map(value => [value.id,value.revision,value.slots,value.attributeLevels]),
        state.buildings.map(value => [value.id,value.health]),
        state.agents.map(value => [value.id,value.health,value.carrying,value.construction?.buildingKey,value.construction?.id])]);
      if (!refresh && constructionHelpPreview?.signature === signature) return constructionHelpPreview.objective;
      const planningState = state.nestLevel < 2 ? {...state,nestLevel:2} : state;
      const needs = tribeConstructionGoals(planningState, colony.tribe, activeNestSites().map(site => ({...site,
        width:site.width || COLONY_SIZE, height:site.height || COLONY_SIZE})),
        combatTargets().filter(enemy => combatDisposition(enemy) === "aggressive" || enemy.combat), worldMap.frontierSites, worldMap, colonyBoundaryCells());
      let objective = constructionSites(proxy,state,needs);
      if (objective && objective.need.buildingKey !== "storage") {
        const capacity = (state.resourceStores || []).filter(store => store.kind !== "remains").reduce((sum,store) => sum + store.capacity,0);
        const stored = Object.values(state.resourceInventory).reduce((sum,amount) => sum + amount,0);
        const missing = Object.entries(objective.need.cost.materials).reduce((sum,[type,amount]) => sum + Math.max(0,amount - (state.resourceInventory[type] || 0)),0);
        if (stored + missing > capacity + 1e-8) {
          const home = activeNestSites()[0],score = objective.need.score + 1;
          const prerequisite = {...needs.find(need => need.buildingKey === "storage"),buildingKey:"storage",
            anchor:{x:home.x + Math.floor((home.width || COLONY_SIZE) / 2),y:home.y + Math.floor((home.height || COLONY_SIZE) / 2)},
            benefits:{storage:1},score,urgent:true,prerequisiteFor:objective.need.buildingKey,cost:buildingCost("storage",colony.tribe),gains:{materialGain:score}};
          objective = constructionSites(proxy,state,[prerequisite]) || objective;
        }
      }
      constructionHelpPreview = {signature, objective};
      return objective;
    }

    function constructionPlansFor(agent, planningState, supply, candidateSites) {
      if (!agent.attributes.construction || agent.carrying || agent.birth || agent.combat || agent.construction ||
          state.simSeconds < (agent.constructionRetryAt || 0)) return [];
      const objective = constructionObjective(false);
      if (!objective || buildingDefinition(objective.need.buildingKey).minNestLevel > planningState.nestLevel) return [];
      const candidates = candidateSites === undefined ? constructionSites(agent, planningState, [objective.need]) : candidateSites;
      if (!candidates) return [];
      const plans = candidates.plans.flatMap(plan => {
        const forecast = supply.forecast(agent, plan);
        const buildSeconds = forecast ? constructionSeconds(plan.buildingKey,agent.attributes.construction) +
          Math.max(0,forecast.deliverySeconds - plan.travelSeconds) : Infinity;
        return forecast && plan.travelSeconds + buildSeconds + 5 < agent.bornAt + agent.lifespan - state.simSeconds ?
          [{...plan,buildSeconds,deliverySeconds:forecast.deliverySeconds}] : [];
      }).sort((a,b) => a.buildSeconds + a.travelSeconds - b.buildSeconds - b.travelSeconds);
      return plans.slice(0,1);
    }

    function constructionPlans(agent) {
      return constructionPlansFor(agent, state, constructionSupply);
    }

    function beginConstruction(action) {
      const agent = state.agents.find(candidate => candidate.id === action.agentId && candidate.health > 0);
      const definition = buildingDefinition(action.buildingKey);
      if (!agent || !agent.attributes.construction) throw new Error("건설 속성이 있는 개체를 선택해 주세요.");
      if (agent.birth || agent.combat || agent.attack && state.simSeconds < agent.attack.endsAt || agent.construction) throw new Error("개체가 현재 행동을 마친 뒤 건설해 주세요.");
      if (agent.carrying > 0) throw new Error("운반 중인 자원을 먼저 내려놓아 주세요.");
      if (!definition || definition.minNestLevel > state.nestLevel) throw new Error("둥지를 성장시킨 뒤 건설해 주세요.");
      if (state.buildings.filter(building => building.health > 0).length + state.agents.filter(candidate => candidate.construction).length >= 64) throw new Error("건물은 최대 64개까지 세울 수 있습니다.");
      const issue = constructionSiteIssue(action.buildingKey, action.x, action.y, agent);
      if (issue) throw new Error(issue);
      if (!canSpendResources(buildingCost(action.buildingKey, colony.tribe))) throw new Error("건설에 필요한 자원 재료가 부족합니다.");
      const route = constructionRoute(agent, constructionApproachCell(action));
      if (!route) throw new Error("건설 장소까지 이동할 수 있는 탐색 경로가 없습니다.");
      agent.construction = { buildingKey: action.buildingKey, x: action.x, y: action.y, route, routeIndex: 0,
        state: "moving", startedAt: null, readyAt: null, orderedAt: state.simSeconds };
      constructionSupply.prepare(agent);
      agent.constructionError = null;
      agent.utility = null; agent.decisionPending = null; agent.attack = null; agent.foodDelivery = null;
      agent.mode = "build"; agent.moveBudget = 0;
      return { agentId: agent.id, buildingKey: definition.key };
    }

    function cancelConstruction(agent, message) {
      constructionSupply.stop(agent);
      agent.construction = null; agent.constructionError = message;
      agent.utility = null; agent.mode = "search"; agent.moveBudget = 0;
      agent.decisionPending = "completed";
      agent.constructionRetryAt = state.simSeconds + 5;
    }

    function updateConstruction(agent, elapsed) {
      const plan = agent.construction, definition = buildingDefinition(plan.buildingKey);
      if (!definition || !agent.attributes.construction || agent.combat && plan.state !== "transforming") { cancelConstruction(agent, "건설 행동이 중단되었습니다."); return; }
      const destination = constructionApproachCell(plan);
      if (plan.state === "moving" && (plan.route.at(-1).x !== destination.x || plan.route.at(-1).y !== destination.y)) {
        const route = constructionRoute(agent, destination);
        if (!route) { cancelConstruction(agent, "건설 경로가 막혀 명령을 취소했습니다."); return; }
        plan.route = route; plan.routeIndex = 0;
      }
      if (plan.state === "transforming") agent.mode = "transform";
      agent.moveBudget = Math.min(1, agent.moveBudget + elapsed * agentSpeed(agent));
      if (state.simSeconds < agent.moveStartedAt + agent.moveDuration) return;
      if (plan.state !== "transforming" && (agent.x !== destination.x || agent.y !== destination.y)) {
        if (agent.moveBudget < 1) return;
        const next = plan.route[plan.routeIndex + 1];
        if (!next || !isWalkable(next.x, next.y) || !moveAgent(agent, next, false, state.simSeconds)) {
          cancelConstruction(agent, "건설 경로가 막혀 명령을 취소했습니다."); return;
        }
        plan.routeIndex += 1; agent.moveBudget = 0;
        return;
      }
      if (constructionSiteOccupied(plan,agent)) return;
      if (plan.state !== "transforming") {
        const issue = constructionSiteIssue(plan.buildingKey, plan.x, plan.y, agent);
        if (issue) { cancelConstruction(agent, issue); return; }
        plan.state = "transforming"; plan.startedAt = state.simSeconds;
        plan.readyAt = state.simSeconds + constructionSeconds(plan.buildingKey, agent.attributes.construction);
        agent.mode = "transform"; agent.moveBudget = 0;
      }
      if (!constructionSupply.advance(agent, elapsed)) return;
      const issue = constructionSiteIssue(plan.buildingKey, plan.x, plan.y, agent);
      if (issue) { cancelConstruction(agent, issue); return; }

      state.buildings.push({ id: "building:" + colony.id + ":" + state.nextBuildingId++, key: definition.key, kind: "building",
        colonyId: colony.id, ownerId: colony.ownerId, name: definition.name, x: plan.x, y: plan.y,
        width: definition.width, height: definition.height, health: definition.health, maxHealth: definition.health,
        completedAt: state.simSeconds });
      if (!state.constructionHelpBuildings.includes(definition.key)) state.constructionHelpBuildings.push(definition.key);
      state.agents = state.agents.filter(candidate => candidate !== agent);
      environment.unitIndex?.remove(agent);
      reconsiderConstruction();
    }

    function pointCapacity() {
      return NEST_LEVELS[state.nestLevel - 1].pointCapacity;
    }

    function resourceSpace() {
      return resourceStorage.refresh().reduce((sum, store) => sum + resourceStorage.space(store), 0);
    }

    function deliveryCapacity(resourceType) {
      const materials = resourceSpace();
      const native = isColonyFood(resourceType,colony.tribe,worldMap.generationVersion);
      const needed = native ? Math.max(0,(constructionMaterialTargets()[resourceType] || 0) - (state.resourceInventory[resourceType] || 0)) : materials;
      return native ? Math.max(Math.max(0,pointCapacity() - state.evolutionPoints),Math.min(materials,needed)) : materials;
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

    function spawnAgent(template, faction, newborn, birthBuilding, birthCell) {
      const position = birthCell ? availableSpawnCells(birthBuilding).find(cell => cell.x === birthCell.x && cell.y === birthCell.y) :
        chooseSpawnPosition(template.id !== null || newborn, birthBuilding);
      if (!position) return null;
      const attributes = attributeCounts(template.slots, template.attributeLevels);
      const stats = unitStats(attributes, colony.tribe);
      const agent = {
        tribe: colony.tribe || "bean",
        id: colony.id + ":" + state.nextAgentId,
        ownerId: colony.ownerId,
        name: template.name + " " + state.nextAgentId,
        templateId: template.id,
        templateName: template.name,
        templateRevision: template.revision,
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
        lifespan: stats.lifespan,
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
        const source = birthBuilding || (state.nestHealth <= 0 ? state.buildings.find(building => building.key === "outpost" && building.health > 0 &&
          position.x >= building.x - 1 && position.x <= building.x + building.width && position.y >= building.y - 1 && position.y <= building.y + building.height) : null);
        agent.mode = "birth";
        agent.birth = { colonyId: colony.id, startedAt: state.simSeconds,
          readyAt: state.simSeconds + agentBirthDuration(agent.tribe),
          buildingId: source?.id || null, sourceX: source?.x ?? colony.x, sourceY: source?.y ?? colony.y,
          sourceWidth: source?.width || COLONY_SIZE, sourceHeight: source?.height || COLONY_SIZE,
          fromX: source ? source.x + (source.width - 1) / 2 : COLONY_CENTER.x - .5,
          fromY: source ? source.y + (source.height - 1) / 2 : COLONY_CENTER.y - .5 };
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
        level: agent.level, tribe: agent.tribe, bornAt: agent.bornAt, diedAt: state.simSeconds, decaysAt: state.simSeconds + CORPSE_LIFETIME,
        hurtStartedAt: agent.hurtStartedAt, hurtCount: agent.hurtCount,
        cost: agent.cost, amount: corpseRecoveryAmount(agent.cost, agent.tribe), kind: "corpse", resourceType: "meat",
        attributes: { ...agent.attributes }, appearanceAttributes: { ...agent.appearanceAttributes } }];
      if (agent.carrying > 0) {
        const resourceType = agent.carryingType || "honey-mushrooms";
        drops.push({ amount: agent.carrying, resourceType,
          kind: resourceDefinition(resourceType).category === "material" ? "resource" : "food" });
      }
      for (const drop of drops) {
        if (drop.kind === "corpse") {
          const cell = placeCorpse(foodCellMap, { x: agent.x, y: agent.y, ...drop });
          state.corpses.push(cell);
          state.knownFood.set(cell.key, { ...cell });
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
        if (state.simSeconds - agent.bornAt >= agent.lifespan) agent.health = 0;
        if (agent.health > 0) continue;
        constructionSupply.lose(agent);
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
      if (!attack.resolved && state.simSeconds + 1e-8 >= attack.hitAt) {
        attack.resolved = true;
        const owner = [...environment.games.values()].find(game => attack.targetKind === "nest" ? game.nest?.id === attack.targetId : game.agents.some(target => target.id === attack.targetId));
        const target = attack.targetKind === "burrow" ? environment.creatureSystem?.burrows.find(burrow => burrow.id === attack.targetId) :
          attack.targetKind === "nest" ? owner?.nest : owner ? owner.agents.find(target => target.id === attack.targetId) :
            environment.creatureSystem?.agents.find(target => target.id === attack.targetId);
        if (target?.health > 0 && (!["burrow", "nest"].includes(attack.targetKind) || burrowDistance(agent, target) <= 1)) {
          attack.targetX = target.x;
          attack.targetY = target.y;
          attack.hit = true;
          const remaining = attack.targetKind === "burrow" ? environment.creatureSystem.receiveBurrowDamage(target.id, attack.damage) :
            attack.targetKind === "nest" ? owner.receiveNestDamage(attack.damage) : null;
          const previousHealth = target.health;
          target.health = remaining ?? target.health;
          recordCombatExperience(agent, target, Math.max(0, previousHealth - target.health),
            target.health <= 0 ? [...environment.games.values()].flatMap(game => game.agents) : []);
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
      for (const [key, known] of state.knownFood) {
        if (known.kind !== "corpse") continue;
        const current = foodCellMap.get(key);
        if (known.colonyId === colony.id) {
          if (current?.id === known.id) state.knownFood.set(key, { ...current });
          else state.knownFood.delete(key);
        } else if (state.simSeconds >= known.decaysAt) state.knownFood.delete(key);
      }
      if (state.simSeconds >= footprintCleanupAt) expireFootprints();
      constructionSupply.refresh();
      updatingAgents = true;
      removeDeadAgents();
      updatePerception();
      for (const agent of state.agents) {
        if (agent.health <= 0) continue;
        if (agent.birth) {
          if (state.simSeconds < agent.birth.readyAt) continue;
          agent.birth = null;
          agent.moveBudget = 0;
          agent.decisionPending = "birth";
        }
        if (applyAgentGrowth(agent, state.simSeconds)) {
          agent.appearanceAttributes = agentAppearanceAttributes(agent);
          agent.decisionPending = "growth";
        }
        if (!agent.combat && agent.stats.regeneration > 0) {
          agent.health = Math.min(agent.stats.health, agent.health + agent.stats.regeneration * elapsed);
        }
        updateEnvironment(agent, elapsed);
        if (agent.health <= 0) continue;
        if (agent.construction?.state === "transforming") {
          combat.update(agent, state.simSeconds);
          if (agent.health > 0) updateConstruction(agent, elapsed);
          continue;
        }
        if (agent.construction?.state === "moving") {
          const safety = utilityAI.safety(agent);
          if (agent.combat || agent.retreat || safety.state !== "stable") cancelConstruction(agent, "위험을 피해 변태 이동을 중단했습니다.");
        }
        if (combat.update(agent, state.simSeconds)) continue;
        if (updateAttack(agent)) continue;
        if (agent.construction) { updateConstruction(agent, elapsed); continue; }
        const reason = scheduledDecisionEvent(agent);
        reconsider(agent, reason);
        if (agent.construction) { updateConstruction(agent, elapsed); continue; }
        agent.moveBudget = Math.min(1, agent.moveBudget + elapsed * agentSpeed(agent));
        if (!["rest", "unload", "harvest"].includes(agent.mode) && state.simSeconds + 1e-8 < agent.moveStartedAt + agent.moveDuration) continue;
        if (agent.mode === "rest") {
          agent.straightSteps = 0;
          if (isColonyBoundaryCell(agent.x, agent.y)) {
            agent.health = Math.min(agent.stats.health, agent.utility.recoverHealth, agent.health + elapsed * 0.25);
            if (agent.health >= agent.utility.recoverHealth) agent.decisionPending = "completed";
          } else agent.mode = "recover";
        } else if (agent.mode === "unload" && agent.utility?.action === "supply") {
          const delivered = constructionSupply.interact(agent);
          if (delivered > 0) addAgentExperience(agent, delivered * AGENT_EXPERIENCE.delivery);
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
      state.corpses = [...foodCellMap.values()].filter(cell => cell.kind === "corpse");
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

    function birth(template, required, buildingId, birthCell) {
      const birthBuilding = buildingId === undefined || buildingId === null ? null :
        state.buildings.find(building => building.id === buildingId && building.key === "outpost" && building.health > 0);
      if (buildingId !== undefined && buildingId !== null && !birthBuilding) throw new Error("탄생할 전초둥지를 찾을 수 없습니다.");
      if (!hasActiveNest()) {
        if (!required) return null;
        throw new Error("파괴된 둥지에서는 개체를 생산할 수 없습니다.");
      }
      if (template.slots.length > slotCapacity() || new Set(template.slots).size !== template.slots.length || template.slots.some(key => !ATTRIBUTES.some(attribute => attribute.key === key))) {
        throw new Error("현재 둥지의 슬롯 수와 사용 가능한 속성에 맞춰 설계를 수정해 주세요.");
      }
      if (state.agents.length >= 200) {
        if (!required) return null;
        throw new Error("생명체는 최대 200개까지 유지할 수 있습니다.");
      }
      if (state.evolutionPoints < birthCost(template, colony.tribe)) {
        if (!required) return null;
        throw new Error("진화 포인트가 부족합니다.");
      }
      const agent = spawnAgent(template, "colony", true, birthBuilding, birthCell);
      if (!agent) {
        if (!required) return null;
        throw new Error(colony.tribe === "spring" || colony.tribe === "pebble" ? "둥지 앞쪽과 양옆의 탄생 공간이 가득 찼습니다." : "둥지 주변이 가득 찼습니다.");
      }
      state.evolutionPoints = Math.round((state.evolutionPoints - birthCost(template, colony.tribe)) * 10) / 10;
      return agent.id;
    }

    function constructionHelpOffer(refresh) {
      const previous = constructionRouteMemo;
      constructionRouteMemo = new Map();
      try { return constructionHelpReadiness(refresh); }
      finally { constructionRouteMemo = previous; }
    }

    function constructionHelpReadiness(refresh) {
      const enabled = environment.beginnerHelpEnabled === true && colony.ownerId === environment.hostId;
      if (!enabled || state.ending) return null;
      const active = state.agents.find(agent => agent.health > 0 && agent.construction);
      const objective = active ? {need:{buildingKey:active.construction.buildingKey,
        cost:{materials:constructionSupply.shortages()}}} : constructionObjective(refresh);
      if (!objective) return null;
      const stock = active ? {} : constructionSupply.available();
      const foragers = constructionSupply.foragers();
      const harvestNeeds = constructionHarvestNeeds(constructionSupplyContext,objective.need,stock,foragers);
      let offer = constructionHelp(state, colony.tribe, enabled, objective.need, stock, worldMap,false,foragers,harvestNeeds);
      const positions = availableSpawnCells(null);
      if (!positions.length) return null;
      const locked = buildingDefinition(objective.need.buildingKey).minNestLevel > state.nestLevel;
      if (locked) {
        if (offer?.kind === "construction" || colony.tribe === "pebble" && offer?.kind === "harvest") offer = null;
        const pending = state.agents.some(agent => agent.health > 0 && agent.birth);
        const allocation = constructionSupply.allocation();
        const workers = state.agents.filter(agent => agent.health > 0 && !agent.attributes?.construction);
        const horizon = Math.max(30,Math.min(120,...workers.map(agent => agent.bornAt + agent.lifespan - state.simSeconds)));
        const replacement = workers.filter(agent => agent.bornAt + agent.lifespan - state.simSeconds <= horizon)
          .reduce((sum,agent) => sum + birthCost(agent,colony.tribe),0);
        if (!pending && state.evolutionPoints + allocation.incomingFood + allocation.productionRate * horizon <
            nestUpgradeCost(state.nestLevel,colony.tribe) + replacement) {
          const support = constructionHelp(state,colony.tribe,enabled,objective.need,stock,worldMap,true,foragers);
          const template = constructionHelpTemplate({...state,tribe:colony.tribe},support.slots,[],"transport");
          const worker = constructionPreview(template,positions[0]);worker.id += ":growth";
          const projected = {...state,evolutionPoints:Math.max(0,state.evolutionPoints - support.cost),agents:state.agents.concat(worker)};
          const forecast = createConstructionSupply({...constructionSupplyContext,state:projected}).allocation();
          if ((forecast.productionRate - allocation.productionRate) * worker.lifespan > support.cost) offer = support;
        }
      }
      if (active && !offer) {
        const plan = active.construction;
        const elapsed = state.simSeconds - plan.orderedAt;
        const delivered = Object.values(plan.delivered || {}).reduce((sum,amount) => sum + amount,0);
        const incoming = state.agents.reduce((sum,agent) => sum + (agent.health > 0 && agent.transportCargo?.siteId === plan.id ? agent.carrying || 0 :
          agent.health > 0 && agent.transport?.siteId === plan.id && agent.transport.phase === "pickup" ? agent.transport.amount || 0 : 0),0);
        const remaining = Math.max(0,Object.values(plan.required || {}).reduce((sum,amount) => sum + amount,0) - delivered - incoming);
        const estimated = delivered + incoming > 0 ? remaining * elapsed / (delivered + incoming) + 30 : Infinity;
        const pendingWorker = state.agents.some(agent => agent.health > 0 && agent.birth && !agent.attributes?.construction);
        if (remaining > 0 && elapsed > 25 && estimated > Math.max(30,(active.bornAt + active.lifespan - state.simSeconds) / 2) && !pendingWorker) {
          offer = constructionHelp(state,colony.tribe,enabled,objective.need,stock,worldMap,true,foragers);
        }
      }
      if (!active && !state.agents.some(agent => agent.health >= agent.stats.health * .6 && !agent.attributes?.construction &&
          agent.bornAt + agent.lifespan - state.simSeconds > 30)) {
        offer = constructionHelp(state,colony.tribe,enabled,objective.need,stock,worldMap,true,foragers);
      }
      if (!offer && !active) {
        const workers = state.agents.filter(agent => agent.health > 0 && !agent.attributes?.construction &&
          agent.bornAt + agent.lifespan - state.simSeconds > 60);
        const builder = state.agents.find(agent => agent.health >= agent.stats.health * .6 && agent.attributes?.construction && !agent.construction &&
        agent.bornAt + agent.lifespan - state.simSeconds > 60);
        const ready = Object.entries(objective.need.cost.materials).every(([type,amount]) => (stock[type] || 0) >= amount);
        if (!workers.length || builder && !constructionPlansFor({...builder,carrying:0,birth:null},state,constructionSupply).length &&
            (ready || constructionSupply.allocation().forecastBalance < 0)) {
          offer = constructionHelp(state,colony.tribe,enabled,objective.need,stock,worldMap,true,foragers);
        }
      }
      if (!offer) return null;
      const pending = state.agents.some(agent => agent.health > 0 && agent.birth && agent.slots.includes("strength"));
      const allocation = constructionSupply.allocation();
      const foodSpecialists = offer.kind === "harvest" && state.agents.some(agent => agent.health >= agent.stats.health * .6 &&
        !agent.construction && foragers.has(agent.id) && offer.resources.some(type =>
          resourceDefinition(type).requirements.every(key => agent.attributes?.[key] > 0)));
      if (foodSpecialists && !pending) offer = constructionHelp(state,colony.tribe,enabled,objective.need,stock,worldMap,true,foragers);
      if (offer.kind === "harvest" && !pending && allocation.forecastBalance < 0 && allocation.productionRate < allocation.requiredRate) {
        offer = constructionHelp(state, colony.tribe, enabled, objective.need, stock, worldMap,true,foragers);
      }
      if (offer.kind === "construction") {
        if (active) return null;
        const template = constructionHelpTemplate({...state, tribe:colony.tribe}, offer.slots, offer.resources, offer.kind);
        const preview = constructionPreview(template, positions[0]);
        const projected = {...state, evolutionPoints:Math.max(0,state.evolutionPoints - offer.cost), agents:state.agents.concat(preview)};
        const supply = createConstructionSupply({...constructionSupplyContext,state:projected});
        const candidateSites = constructionSites(preview,projected,[objective.need]);
        if (!constructionPlansFor(preview,projected,supply,candidateSites).length) {
          if (pending) return null;
          const supportOffer = constructionHelp(state,colony.tribe,enabled,objective.need,stock,worldMap,true,foragers);
          const supportTemplate = constructionHelpTemplate({...state,tribe:colony.tribe},supportOffer.slots,[],"transport");
          const worker = constructionPreview(supportTemplate,positions[0]);worker.id += ":courier";
          const supported = {...projected,evolutionPoints:Math.max(0,projected.evolutionPoints - supportOffer.cost),
            agents:projected.agents.concat(worker)};
          const forecast = createConstructionSupply({...constructionSupplyContext,state:supported});
          const base = supply.allocation(),provision = forecast.allocation();
          const useful = provision.forecastBalance > base.forecastBalance + 1e-8 ||
            (provision.foodYields.get(worker.id) || 0) + 1e-8 >= supportOffer.cost || candidateSites?.plans.some(plan => {
            const before = supply.forecast(preview,plan,true),after = forecast.forecast(preview,plan,true);
            return after && (after.deliveredUnits > (before?.deliveredUnits || 0) + 1e-8 ||
              after.deliveredUnits === before?.deliveredUnits && after.deliverySeconds + 1e-8 < before.deliverySeconds);
          });
          if (!useful) return null;
          offer = constructionHelp(state, colony.tribe, enabled, objective.need, stock, worldMap,true,foragers);
        }
      }
      if (offer.kind === "transport" && pending) return null;
      return offer;
    }

    function checkEnding() {
      if (state.ending || colony.tribe === null || state.agents.some(agent => agent.health > 0) ||
          hasActiveNest() && state.evolutionPoints >= birthCost({ slots: [] }, colony.tribe)) return state.ending;
      const combatants = [...environment.games.values()].flatMap(game => game.agents).concat(environment.creatureSystem?.agents || []);
      if (combatants.some(agent => agent.combat?.teams.includes("colony:" + colony.ownerId) &&
          (agent.attack?.exchange || agent.combat.pendingCounter?.exchange)?.counterApplied === false)) return state.ending;
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
        if (!state.buildings.some(building => building.key === "evolution-lab" && building.health > 0)) throw new Error("진화실을 먼저 세워 주세요.");
        const issue = attributeUpgradeIssue(template, action.attributeKey, state.nestLevel, state.evolutionPoints, constructionSupply.available());
        if (issue) throw new Error(issue);
        const level = attributeCounts(template.slots, template.attributeLevels)[action.attributeKey] + 1;
        const cost = attributeUpgradeCost(action.attributeKey, level);
        spendResources(cost);
        template.attributeLevels = { ...template.attributeLevels, [action.attributeKey]: level };
        template.unlockedAttributeLevels = { ...template.unlockedAttributeLevels, [action.attributeKey]: level };
        template.revision += 1;
        return { templateId: template.id, attributeKey: action.attributeKey, level };
      }
      if (action.type === "discard-resource") {
        if (!resourceDefinition(action.resourceType) || !Number.isSafeInteger(action.amount * 10) || action.amount <= 0 ||
          (constructionSupply.available()[action.resourceType] || 0) < action.amount) throw new Error("버릴 자원의 종류와 개수를 다시 확인해 주세요.");
        resourceStorage.remove(action.resourceType, action.amount);
        return { resourceType: action.resourceType, discarded: action.amount };
      }
      if (action.type === "cancel-build") {
        const agent = state.agents.find(candidate => candidate.id === action.agentId && candidate.health > 0);
        if (!agent?.construction) throw new Error("취소할 건설 명령을 찾을 수 없습니다.");
        cancelConstruction(agent, null);
        return { cancelled: true };
      }
      if (action.type === "beginner-construction") {
        if (environment.beginnerHelpEnabled !== true || colony.ownerId !== environment.hostId) throw new Error("지원하지 않는 요청입니다.");
        const previousResult = state.constructionHelpResult;
        if (action.expectedStep && previousResult?.step === action.expectedStep &&
            state.agents.some(agent => agent.id === previousResult.agentId && agent.health > 0)) return {...previousResult};
        const offer = constructionHelpOffer(true);
        if (!offer || action.expectedBuildingKey !== undefined && action.expectedBuildingKey !== offer.buildingKey ||
            action.expectedStep !== undefined && action.expectedStep !== offer.step) return {};
        if (!offer.canProduce) throw new Error(offer.issue);
        const template = constructionHelpTemplate({...state,tribe:colony.tribe}, offer.slots, offer.resources, offer.kind);
        const previous = state.templates.includes(template);
        const agentId = birth(template, true, null, availableSpawnCells(null)[0]);
        if (!previous) { state.templates.push(template); state.nextTemplateId += 1; }
        state.constructionHelpResult = {templateId:template.id, agentId, step:offer.step, kind:offer.kind, producedAt:state.simSeconds};
        constructionHelpPreview = null;
        return {...state.constructionHelpResult};
      }
      if (action.type === "design") {
        const name = requireName(action.name);
        if (!Array.isArray(action.slots) || action.slots.length > slotCapacity() || new Set(action.slots).size !== action.slots.length ||
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
        const purchased = { ...previous?.unlockedAttributeLevels, ...previous?.attributeLevels };
        const unlockedAttributeLevels = { ...migrateAttributeLevels(Object.keys(purchased), purchased, state.nestLevel) };
        for (const key of action.slots) if (!unlockedAttributeLevels[key]) unlockedAttributeLevels[key] = 1;
        const template = { id: previous ? previous.id : state.nextTemplateId, name,
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
          return { agentId: birth({ id: agent.templateId, name: agent.templateName,
            slots: [...agent.slots], attributeLevels: { ...agent.attributeLevels }, revision: agent.templateRevision }, true, action.buildingId) };
        }
        const template = state.templates.find((candidate) => candidate.id === action.templateId);
        if (!template) throw new Error("설계를 찾을 수 없습니다.");
        return { agentId: birth(template, true, action.buildingId) };
      }
      if (action.type === "upgrade") {
        if (!hasActiveNest()) throw new Error("파괴된 둥지는 성장할 수 없습니다.");
        if (state.nestLevel >= NEST_LEVELS.length) throw new Error("최고 둥지 레벨입니다.");
        if (state.evolutionPoints < upgradeCost()) throw new Error("진화 포인트가 부족합니다.");
        state.evolutionPoints = Math.round((state.evolutionPoints - upgradeCost()) * 10) / 10;
        const previousHealth = NEST_LEVELS[state.nestLevel - 1].health;
        state.nestLevel += 1;
        if (state.nestHealth > 0) state.nestHealth += NEST_LEVELS[state.nestLevel - 1].health - previousHealth;
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

    function agentMovementPlan(agent) {
      if (agent.construction) {
        const route = agent.construction.route.slice(agent.construction.routeIndex).map(cell => ({ ...cell }));
        return { destination: { x: agent.construction.x, y: agent.construction.y }, route };
      }
      const plan = agent.utility;
      if (!plan || agent.health <= 0 || !["search", "approach", "return", "recover", "flee"].includes(agent.mode)) return null;
      const index = plan.route.findIndex(cell => cell.x === agent.x && cell.y === agent.y);
      if (index < 0) return null;
      const route = plan.route.slice(index).map(cell => ({ x: cell.x, y: cell.y }));
      return { destination: { ...route.at(-1) }, route };
    }

    function snapshot() {
      constructionSupply.refresh();
      updatePerception();
      if (discoveryBaselinePending) {
        state.discoveryReadCount = state.discoveries.length;
        discoveryBaselinePending = false;
      }
      const visibleAgent = (agent) => {
        const { visited, movementVisits, path, returnPath, rememberedRoute, profile, personality, utility, knownEnemyIds, ...visible } = agent;
        return { ...visible, combatDisposition: combatDisposition(agent), action: agent.combat ? "fight" : agent.construction ? "build" : utility?.action === "supply" ? "return" : utility?.action || "wait", personalityLabels: personality ? personalityLabels(personality) : null };
      };
      return {
        simSeconds: state.simSeconds, colonyFood: state.colonyFood, encounterSignals: environment.creatureSystem?.signals || [], burrows: environment.creatureSystem?.burrows || [],
        resourceInventory: { ...state.resourceInventory },
        resourceStores: resourceStorage.refresh().map(store => ({ ...store, inventory: { ...store.inventory } })),
        resourceReserved: constructionSupply.reserved(),
        resourceCapacity: resourceStorage.refresh().filter(store => store.kind !== "remains").reduce((sum, store) => sum + store.capacity, 0),
        buildings: state.buildings.map(building => ({ ...building })),
        discoveries: state.discoveries.map(entry => ({ ...entry })), discoveryReadCount: state.discoveryReadCount,
        evolutionPoints: state.evolutionPoints, nestLevel: state.nestLevel, tribe: colony.tribe,
        constructionHelp: constructionHelpOffer(),
        ending: state.ending ? { ...state.ending } : null,
        nestHealth: state.nestHealth, nestMaxHealth: NEST_LEVELS[state.nestLevel - 1].health,
        templates: state.templates.map(template => ({ ...template, tribe: colony.tribe || "bean" })), agents: state.agents.map(agent => ({ ...visibleAgent(agent), movementPlan: agentMovementPlan(agent) })),
        rivals: state.rivals.filter(agent => !agent.hidden && (agent.health > 0 || agent.species === "spiny-back-beetle" && agent.mode === "death") &&
          visibleCells.has(agent.y * WORLD_SIZE + agent.x)).map((agent) => ({ ...visibleAgent(agent), faction: agent.species ? agent.faction : "rival" })),
        corpses: [...state.knownFood.values()].filter(cell => cell.kind === "corpse"),
        sharedTrails: [...state.sharedTrails], footprints: [...state.footprints.values()],
        footprintLifetime: FOOTPRINT_LIFETIME, food: [...state.knownFood.values()],
        explored: [...state.explored], visible: [...visibleCells], markers: state.markers
      };
    }

    function save() {
      constructionSupply.refresh();
      return JSON.stringify({ state: { ...state, rivals: [], corpses: [] } }, (key, value) =>
        value instanceof Map ? { collection: "Map", entries: [...value] } :
        value instanceof Set ? { collection: "Set", entries: [...value] } : value);
    }

    function restore(saved) {
      roadOptimizer.clear();
      constructionHelpPreview = null;
      const data = JSON.parse(saved, (key, value) =>
        value?.collection === "Map" ? new Map(value.entries) :
        value?.collection === "Set" ? new Set(value.entries) : value);
      Object.assign(state, data.state);
      state.constructionHelpResult = data.state.constructionHelpResult ? { ...data.state.constructionHelpResult } : null;
      state.resourceStores = Array.isArray(data.state.resourceStores) ? data.state.resourceStores : undefined;
      restoreColonyIncome(state, data.state);
      state.lastFoodAt = Number.isFinite(data.state.lastFoodAt) && data.state.lastFoodAt >= 0 ?
        Math.min(state.simSeconds, data.state.lastFoodAt) : state.simSeconds;
      state.ending = data.state.ending ? { ...data.state.ending } : null;
      state.buildings = (Array.isArray(data.state.buildings) ? data.state.buildings : []).filter(building => buildingDefinition(building.key) &&
        Number.isInteger(building.x) && Number.isInteger(building.y) && building.x >= 0 && building.y >= 0 &&
        building.x + buildingDefinition(building.key).width <= WORLD_SIZE && building.y + buildingDefinition(building.key).height <= WORLD_SIZE &&
        Number.isFinite(building.health) && building.health > 0).map(building => ({ ...building,
          width: buildingDefinition(building.key).width, height: buildingDefinition(building.key).height,
          maxHealth: buildingDefinition(building.key).health, health: Math.min(building.health, buildingDefinition(building.key).health) }));
      state.constructionHelpBuildings = [...new Set([...(Array.isArray(data.state.constructionHelpBuildings) ?
        data.state.constructionHelpBuildings.filter(key => buildingDefinition(key)) : []), ...state.buildings.map(building => building.key)])];
      state.nextBuildingId = Math.max(Number.isSafeInteger(data.state.nextBuildingId) ? data.state.nextBuildingId : 1, state.buildings.length + 1);
      for (const template of state.templates) {
        template.attributeLevels = migrateAttributeLevels(template.slots, template.attributeLevels, state.nestLevel);
        template.slots = migrateAttributeSlots(template.slots);
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
        if (entry.kind === "corpse" || entry.key.startsWith("corpse:")) return;
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
      constructionSupply.restore();
      state.explored = state.explored instanceof Set ? state.explored : new Set();
      state.knownFood = state.knownFood instanceof Map ? state.knownFood : new Map();
      for (const [key, cell] of state.knownFood) {
        const type = migrateResourceType(cell.resourceType);
        if (type === null) { state.knownFood.delete(key); continue; }
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
      updatePerception();

    }

    if (savedGame !== undefined) restore(savedGame);
    else {
      for (const slots of TRIBE_STARTING_UNITS[colony.tribe] || TRIBE_STARTING_UNITS.bean) {
        const agent = spawnAgent({ id: null, name: "개체", slots: [...slots], revision: 1 }, "colony");
        if (!agent) throw new Error("둥지 주변에 초기 개체를 배치할 공간이 없습니다.");
        agent.appearanceAttributes = agentAppearanceAttributes(agent);
      }
      updatePerception();
      for (const agent of state.agents) reconsiderAgent(agent, "birth");
    }

    return {
      command, snapshot, save, restore, checkEnding,
      get ending() { return state.ending; },
      get agents() { return state.agents; },
      get buildings() { return state.buildings; },
      receiveBuildingDamage(id, amount) {
        const building = state.buildings.find(candidate => candidate.id === id);
        if (!building || !Number.isFinite(amount) || amount <= 0) return building?.health;
        const alive = building.health > 0;
        building.health = Math.max(0, building.health - amount);
        if (alive && building.health <= 0) reconsiderConstruction();
        environment.targetRevision = (environment.targetRevision || 0) + 1;
        return building.health;
      },
      get colonyFood() { return state.colonyFood; },
      get discoveredKinds() { return state.discoveredKinds; },
      isVisible(x, y) { return visibleCells.has(y * WORLD_SIZE + x); },
      get nestLevel() { return state.nestLevel; },
      get nest() { return { id: "nest:" + colony.id, colonyId: colony.id, kind: "nest", x: colony.x, y: colony.y,
        width: COLONY_SIZE, height: COLONY_SIZE, health: state.nestHealth, maxHealth: NEST_LEVELS[state.nestLevel - 1].health,
        experienceContributions: (state.nestExperienceContributions ||= []) }; },
      receiveNestDamage(amount) {
        if (state.nestHealth <= 0 || !Number.isFinite(amount) || amount <= 0) return state.nestHealth;
        state.nestHealth = Math.max(0, state.nestHealth - amount);
        environment.targetRevision = (environment.targetRevision || 0) + 1;
        if (state.nestHealth === 0) {
          reconsiderConstruction();
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
        updateAgents(elapsed);
      }
    };
}
