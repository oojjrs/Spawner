import { worldSize } from "./world-size.mjs";
import { buildingDefinition, buildingCost, materialCapacity, constructionApproachCell } from "./buildings.mjs";
import { attributeUpgradeCost, birthCost, unitTravelSpeed } from "./attributes.mjs";
import { resourceDefinition } from "./resources.mjs";
import { colonySupply } from "./colony-supply.mjs";
import { NEST_LEVELS } from "./nests.mjs";

export const TRIBE_CONSTRUCTION_WEIGHTS = Object.freeze({
  bean: Object.freeze({ information:35, production:15, technology:15, expansion:20, storage:15 }),
  spore: Object.freeze({ information:35, production:35, technology:5, expansion:15, storage:10 }),
  pebble: Object.freeze({ information:30, production:5, technology:40, expansion:15, storage:10 }),
  spring: Object.freeze({ information:35, production:5, technology:5, expansion:45, storage:10 })
});

const constructionCache = new WeakMap();
const limit = value => Math.max(0, Math.min(1, value));
const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);

function constructionReservations(state, tribe) {
  const amounts = {};
  for (const builder of state.agents.filter(agent => agent.health > 0 && agent.construction)) {
    const plan = builder.construction;
    for (const [key, amount] of Object.entries(buildingCost(plan.buildingKey, tribe)?.materials || {})) {
      const incoming = state.agents.reduce((sum, agent) => sum + (agent.health > 0 && plan.id &&
        agent.transportCargo?.siteId === plan.id && agent.carryingType === key ? agent.carrying || 0 : 0), 0);
      amounts[key] = (amounts[key] || 0) + Math.max(0, amount - (plan.delivered?.[key] || 0) - incoming);
    }
  }
  return amounts;
}

export function tribeConstructionStock(state, tribe, goal) {
  const native = Object.keys(buildingCost("storage",tribe).materials)[0];
  const held = constructionReservations(state,tribe);
  const targets = goal?.cost?.materials ? {...goal.cost.materials} : Object.keys(held).length ? {} :
    {[native]:state.nestLevel < 2 ? Math.max(...["watchpost","outpost","evolution-lab"].map(key => buildingCost(key,tribe).materials[native] || 0)) : 10};
  for (const [type,amount] of Object.entries(held)) targets[type] = (targets[type] || 0) + amount;
  if (state.buildings.some(building => building.key === "evolution-lab" && building.health > 0)) {
    const reserve = {};
    for (const template of state.templates || []) for (const key of template.slots || []) {
      const level = (template.attributeLevels?.[key] || 1) + 1;
      const cost = level <= state.nestLevel ? attributeUpgradeCost(key,level) : null;
      for (const [type,amount] of Object.entries(cost?.materials || {})) reserve[type] = Math.max(reserve[type] || 0,amount);
    }
    for (const [type,amount] of Object.entries(reserve)) targets[type] = (targets[type] || 0) + amount;
  }
  return targets;
}

export function tribeExpansion(state, tribe, nests) {
  if (state.nestLevel < 2 || !nests.length || state.agents.some(agent => agent.construction?.buildingKey === "outpost")) return null;
  const centers = nests.map(nest => ({ x:nest.x + Math.floor(nest.width / 2), y:nest.y + Math.floor(nest.height / 2) }));
  const distance = cell => Math.min(...centers.map(home => Math.abs(home.x - cell.x) + Math.abs(home.y - cell.y)));
  const native = Object.keys(buildingCost("storage", tribe).materials)[0];
  const foods = [...state.knownFood.values()].filter(food => food.amount > 0 && food.resourceType === native);
  const nearby = foods.filter(food => distance(food) < 18).reduce((sum, food) => sum + food.amount, 0);
  if (nearby >= Math.max(24, state.agents.length * 24)) return null;
  const groups = new Map();
  for (const food of foods.filter(food => distance(food) >= 18)) {
    const key = Math.floor(food.x / 8) + "," + Math.floor(food.y / 8);
    if (!groups.has(key)) groups.set(key, { amount:0, anchor:food });
    const group = groups.get(key);
    group.amount += food.amount;
    if (food.amount > group.anchor.amount) group.anchor = food;
  }
  const remote = [...groups.values()].sort((a,b) => b.amount / distance(b.anchor) - a.amount / distance(a.anchor))[0];
  const frontier = nests.some(nest => nest.key === "outpost") ? null : state.agents.filter(agent => agent.health > 0 && agent.utility?.action === "explore")
    .map(agent => agent.utility.target).filter(target => target && distance(target) >= 24 && distance(target) <= 64)
    .sort((a,b) => distance(b) - distance(a))[0];
  const materials = Object.fromEntries(Object.entries(buildingCost("outpost", tribe).materials)
    .map(([key, amount]) => [key, Math.max(0, amount - (state.resourceInventory[key] || 0))]));
  return { anchor:remote?.anchor || frontier || null, materials,
    gains:remote ? { foodGain:100, materialGain:30, informationGain:10 } : { materialGain:30, informationGain:80 } };
}

function constructionDemand(state, tribe, nests, threats, frontierSites, world, birthCells) {
  const size = worldSize(world);
  const agents = state.agents.filter(agent => agent.health > 0);
  const pending = agents.filter(agent => agent.construction).map(agent => agent.construction);
  const buildings = state.buildings.filter(building => building.health > 0);
  if (!agents.length && !nests.length || buildings.length + pending.length >= 64) return [];
  const signature = [Math.floor((state.simSeconds || 0) / 2), state.nestLevel, state.evolutionPoints,
    state.explored?.size, state.knownFood.size, state.lastFoodAt, state.foodIncome, state.foodIncomeStartedAt,
    ...(state.resourceStores || []).flatMap(store => [store.id, store.kind, store.capacity]),
    ...Object.entries(state.resourceInventory).flat(),
    ...agents.flatMap(agent => [agent.id, agent.carrying, agent.carryingType, agent.transportCargo?.siteId,
      agent.construction?.buildingKey, agent.construction?.x, agent.construction?.y,
      ...Object.entries(agent.construction?.delivered || {}).flat()]),
    ...buildings.flatMap(building => [building.key, building.x, building.y, building.width, building.height]),
    ...nests.flatMap(nest => [nest.x, nest.y]), ...(threats || []).flatMap(enemy => [enemy.id, enemy.x, enemy.y]),
    ...(birthCells || []).flatMap(cell => [cell.x, cell.y])].join(":");
  const cached = constructionCache.get(state);
  if (cached?.signature === signature && cached.tribe === tribe && cached.world === world) return cached.needs;
  const weights = TRIBE_CONSTRUCTION_WEIGHTS[tribe] || TRIBE_CONSTRUCTION_WEIGHTS.bean;
  const inventory = { ...state.resourceInventory };
  for (const [key, amount] of Object.entries(constructionReservations(state, tribe))) inventory[key] = (inventory[key] || 0) - amount;
  const native = Object.keys(buildingCost("storage", tribe).materials)[0];
  const foods = [...state.knownFood.values()].filter(food => food.amount > 0 && food.resourceType === native);
  const centers = nests.map(nest => ({ x:nest.x + Math.floor(nest.width / 2), y:nest.y + Math.floor(nest.height / 2), radius:6 }));
  const sources = centers.concat(buildings.filter(building => building.key !== "outpost").map(building => ({
    x:building.x + Math.floor((building.width || buildingDefinition(building.key).width) / 2), y:building.y + Math.floor((building.height || buildingDefinition(building.key).height) / 2), radius:buildingDefinition(building.key).visionRadius
  })), pending.map(plan => ({ ...constructionApproachCell(plan), radius:buildingDefinition(plan.buildingKey).visionRadius })));
  const nearestNest = cell => centers.length ? Math.min(...centers.map(center => distance(center, cell))) : Infinity;
  const anchor = centers[0] || agents[0];
  const supply = colonySupply(state, tribe);
  const needs = [];
  const points = Math.max(0,state.evolutionPoints - (agents.some(agent => agent.attributes?.construction) ? 0 : birthCost({slots:["construction"]},tribe)));
  const upgrades = (state.templates || []).flatMap(template => (template.slots || []).flatMap(key => {
    const level = (template.attributeLevels?.[key] || 1) + 1;
    const cost = level <= state.nestLevel ? attributeUpgradeCost(key, level) : null;
    return cost ? [cost] : [];
  })).sort((first, second) => first.evolutionPoints - second.evolutionPoints);
  const upgrade = upgrades.find(cost => points >= cost.evolutionPoints &&
    Object.entries(cost.materials).every(([key, amount]) => (inventory[key] || 0) >= amount));
  const workers = agents.filter(agent => !agent.construction && !agent.attributes?.construction && !agent.birth && !agent.retreat && !agent.combat);
  const frontierRisk = cell => (threats || []).filter(enemy => enemy.health > 0).reduce((risk, enemy) =>
    Math.max(risk, limit(1 - Math.max(0, distance(cell, enemy) - 4) / 12)), 0);
  const coverage = (cell, radius) => {
    let total = 0, fresh = 0, unknown = 0;
    for (let dy = -radius; dy <= radius; dy += 2) for (let dx = -radius; dx <= radius; dx += 2) {
      const point = { x:cell.x + dx, y:cell.y + dy };
      if (point.x < 0 || point.y < 0 || point.x >= size || point.y >= size || dx * dx + dy * dy > radius * radius) continue;
      total++;
      if (sources.some(source => distance(source, point) <= source.radius)) continue;
      fresh++;
      if (!state.explored?.has(point.y * size + point.x)) unknown++;
    }
    return total ? limit((fresh * .8 + unknown * .2) / total) : 0;
  };
  const critical = centers.flatMap(home => Array.from({length:16},(_,index) => ({
    x:home.x + Math.cos(index * Math.PI / 8) * 14,y:home.y + Math.sin(index * Math.PI / 8) * 14
  }))).concat(workers,foods.filter(food => nearestNest(food) <= 32).sort((a,b) => b.amount - a.amount).slice(0,8))
    .filter(cell => cell.x >= 0 && cell.y >= 0 && cell.x < size && cell.y < size);
  const blind = critical.filter(cell => !sources.some(source => distance(source,cell) <= source.radius));
  const offer = (buildingKey, cell, benefits, urgent) => {
    const definition = buildingDefinition(buildingKey);
    if (state.nestLevel < definition.minNestLevel || buildingKey === "evolution-lab" &&
      (buildings.some(building => building.key === buildingKey) || pending.some(plan => plan.buildingKey === buildingKey))) return;
    if (frontierRisk(cell) >= .9 || state.nestLevel < 2 && buildingKey === "storage" && !urgent) return;
    const cost = buildingCost(buildingKey, tribe);
    const materials = Object.entries(cost.materials);
    const affordable = materials.every(([key, amount]) => (inventory[key] || 0) >= amount);
    const replacement = materials.reduce((sum, [key, amount]) => {
      const harvesters = agents.filter(agent => !agent.construction && (key === native ||
        resourceDefinition(key).requirements.every(attribute => (agent.attributes?.[attribute] || 0) > 0)));
      const seconds = amount * resourceDefinition(key).harvestSeconds / Math.max(1, harvesters.length);
      return sum + seconds * amount / Math.max(amount, inventory[key] || 0);
    }, 0);
    const materialPenalty = 15 * replacement / (replacement + 180);
    const reservePenalty = tribe === "pebble" && buildingKey !== "evolution-lab" && upgrade ?
      16 * limit(materials.reduce((sum, [key, amount]) => sum + Math.max(0, (upgrade.materials[key] || 0) - (inventory[key] || 0) + amount), 0) /
        Math.max(1, Object.values(upgrade.materials).reduce((sum, amount) => sum + amount, 0))) : 0;
    const laborPenalty = 4 * birthCost({ slots:["construction"] }, tribe) / Math.max(1, state.evolutionPoints || 1);
    const informationPressure = buildingKey === "watchpost" ? weights.information * (benefits.information || 0) *
      limit(4 * blind.filter(point => distance(point,cell) <= definition.visionRadius).length / Math.max(1,critical.length)) : 0;
    const technologyPriority = tribe === "pebble" && buildingKey === "evolution-lab" && upgrades.length ? weights.technology * .75 : 0;
    const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + weight * limit(benefits[key] || 0), 0) +
      informationPressure + technologyPriority -
      materialPenalty - reservePenalty - Math.min(10, laborPenalty) - 20 * frontierRisk(cell) + (urgent ? 150 : 0);
    if (score <= 0) return;
    needs.push({ buildingKey, anchor:cell, benefits, score, urgent:!!urgent, affordable, cost,
      gains:{ materialGain:score } });
  };
  const currentCapacity = Array.isArray(state.resourceStores) ? state.resourceStores.filter(store => store.kind !== "remains")
    .reduce((sum, store) => sum + store.capacity, 0) : materialCapacity(state.nestLevel, buildings);
  const capacity = currentCapacity + pending.reduce((sum, plan) => sum + buildingDefinition(plan.buildingKey).storageCapacity, 0);
  const stored = Object.values(inventory).reduce((sum, amount) => sum + Math.max(0, amount), 0);
  const incoming = agents.reduce((sum, agent) => {
    if (agent.transportCargo?.siteId) return sum;
    const target = agent.utility?.target || agent;
    const storing = !Array.isArray(state.resourceStores) || state.resourceStores.some(store => store.kind !== "remains" &&
      distance(target, {x:store.x + store.width / 2, y:store.y + store.height / 2}) <= Math.max(store.width, store.height) + 2);
    return sum + (storing ? Math.max(0, agent.carrying || 0) : 0);
  }, 0);
  const nativeIncoming = agents.reduce((sum,agent) => sum + (!agent.transportCargo && agent.carryingType === native ? Math.max(0,agent.carrying || 0) : 0),0);
  const nativeSpace = Math.max(0,(tribeConstructionStock(state,tribe,null)[native] || 0) - Math.max(0,inventory[native] || 0));
  const expected = Math.max(0,incoming - nativeIncoming) + Math.min(nativeIncoming,nativeSpace);
  const fullness = (stored + expected) / Math.max(1, capacity);
  const storage = limit((fullness - .8) / .2);
  if (storage > 0) offer("storage", anchor, { storage, production:storage * .2 }, fullness >= 1);
  if (upgrades.length) {
    const cost = buildingCost("evolution-lab", tribe);
    const ready = upgrades.some(next => points >= next.evolutionPoints &&
      Object.entries(next.materials).every(([key, amount]) => (inventory[key] || 0) - (cost.materials[key] || 0) >= amount));
    offer("evolution-lab", anchor, { technology:ready ? 1 : .6 }, false);
  }
  const outposts = buildings.filter(building => building.key === "outpost").concat(pending.filter(plan => plan.buildingKey === "outpost")
    .map(plan => ({ ...plan, key:plan.buildingKey })));
  const refugeNeeded = state.nestHealth > 0 && state.nestHealth <= NEST_LEVELS[state.nestLevel - 1].health / 2 && !outposts.length;
  const sites = new Map();
  for (const food of foods) {
    const key = Math.floor(food.x / 8) + "," + Math.floor(food.y / 8);
    if (!sites.has(key) || food.amount > sites.get(key).amount) sites.set(key, food);
  }
  for (const site of frontierSites || []) if (state.explored?.has(site.y * size + site.x) && foods.some(food => distance(food, site) <= 18)) {
    sites.set(site.x + "," + site.y, site);
  }
  if (!centers.length) sites.set("recovery", anchor);
  const occupiedBirths = (birthCells || []).filter(cell => agents.some(agent => agent.x === cell.x && agent.y === cell.y)).length;
  const productionPressure = birthCells?.length ? occupiedBirths / birthCells.length : 0;
  const candidates = [...sites.values()].filter(site => (!centers.length || nearestNest(site) >= 12) &&
    !outposts.some(outpost => distance(site, { x:outpost.x + 1, y:outpost.y + 1 }) < 18))
    .map(site => ({ site, amount:foods.filter(food => distance(food, site) <= 18).reduce((sum, food) => sum + food.amount, 0) }))
    .sort((first, second) => second.amount / Math.max(12, nearestNest(second.site)) - first.amount / Math.max(12, nearestNest(first.site))).slice(0, 6);
  for (const { site, amount } of candidates) {
    if (!amount && centers.length) continue;
    const gap = nearestNest(site);
    const harvest = resourceDefinition(native).harvestSeconds;
    let before = 0, after = 0;
    for (const worker of workers) {
      const unit = { ...worker, tribe, stats:worker.stats || { speed:1, capacity:1 } };
      const cargo = Math.max(1, unit.stats.capacity || 1);
      const travel = 1 / Math.max(.01, unitTravelSpeed(unit, 0)) + 1 / Math.max(.01, unitTravelSpeed(unit, cargo));
      before += cargo / (Math.max(3, gap - 2) * travel + harvest * cargo + 1);
      after += cargo / (3 * travel + harvest * cargo + 1);
    }
    const gain = centers.length ? limit((after - before) / Math.max(.01, after)) * limit(amount / Math.max(24, agents.length * 12)) : 1;
    const production = limit(Math.max(productionPressure / (1 + pending.filter(plan => plan.buildingKey === "outpost").length), gain * Math.min(1, agents.length / 8)));
    const localFood = foods.filter(food => nearestNest(food) < 18).reduce((sum,food) => sum + food.amount,0);
    const remoteSupply = localFood < Math.max(12,agents.length * 2);
    const urgent = !centers.length || refugeNeeded || remoteSupply && supply.incomeObserved &&
      (supply.interruption > 0 || supply.rateDeficit > 0 && supply.forecastBalance < 0) && gain >= .25;
    offer("outpost", site, { expansion:gain, production, information:coverage(site, 6) * .4 }, urgent);
  }
  if (Array.isArray(state.resourceStores)) {
    const stores = state.resourceStores.filter(store => store.kind !== "remains").map(store => ({
      x:store.x + store.width / 2, y:store.y + store.height / 2
    })).concat(pending.filter(plan => plan.buildingKey === "storage").map(plan => ({x:plan.x + 1, y:plan.y + 1})));
    const materials = new Set([native, ...upgrades.flatMap(cost => Object.keys(cost.materials))]);
    const resources = [...state.knownFood.values()].filter(resource => resource.amount > 0 && materials.has(resource.resourceType) &&
      state.explored?.has(resource.y * size + resource.x));
    const logistics = resources.map(resource => ({ resource, gap:stores.length ? Math.min(...stores.map(store => distance(store, resource))) : 32 }))
      .filter(candidate => candidate.gap >= 18).sort((first, second) =>
        second.resource.amount / second.gap - first.resource.amount / first.gap).slice(0, 4);
    for (const { resource, gap } of logistics) {
      const gain = limit(1 - 4 / gap) * limit(resource.amount / Math.max(24, agents.length * 8));
      offer("storage", resource, { production:gain * .5,
        technology:resource.resourceType !== native && upgrade ? gain * .25 : 0 }, false);
    }
  }
  if (refugeNeeded) {
    const escapes = [...(state.explored || [])].map(index => ({x:index % size,y:Math.floor(index / size)}))
      .filter(cell => nearestNest(cell) >= 12 && nearestNest(cell) <= 32 && frontierRisk(cell) < .9)
      .sort((a,b) => frontierRisk(a) - frontierRisk(b) || nearestNest(a) - nearestNest(b)).slice(0,4);
    for (const cell of escapes) offer("outpost",cell,{expansion:.5,production:.2,information:coverage(cell,6) * .4},true);
  }
  const expansion = tribeExpansion(state, tribe, nests);
  if (!candidates.length && expansion?.anchor && (refugeNeeded || !foods.length && supply.interruption > 0)) {
    offer("outpost", expansion.anchor, { expansion:.5, production:.3, information:.8 }, true);
  }
  const watchSites = new Map();
  const addWatch = cell => {
    const point = { x:Math.round(cell.x), y:Math.round(cell.y) };
    if (state.explored?.has(point.y * size + point.x) && point.x >= 1 && point.y >= 1 && point.x < (size - 1) && point.y < (size - 1)) {
      watchSites.set(point.x + "," + point.y, point);
    }
  };
  for (const source of sources) for (const radius of [Math.max(4, source.radius - 1), source.radius + 4, source.radius + 8]) {
    for (let direction = 0; direction < 16; direction++) {
      const angle = direction * Math.PI / 8;
      addWatch({ x:source.x + Math.cos(angle) * radius, y:source.y + Math.sin(angle) * radius });
    }
  }
  for (const agent of agents) if (agent.utility?.action === "explore" && agent.utility.target) addWatch(agent.utility.target);
  const watches = [...watchSites.values()].filter(cell => !sources.some(source => source.radius >= 6 && distance(source, cell) < 7) && frontierRisk(cell) < .9)
    .map(cell => ({ cell, information:coverage(cell, 10) })).filter(candidate => candidate.information >= .25)
    .sort((first, second) => second.information - first.information).slice(0, 8);
  for (const { cell, information } of watches) offer("watchpost", cell, { information }, false);
  needs.sort((first, second) => second.score - first.score);
  constructionCache.set(state, { signature, tribe, world, needs });
  return needs;
}

export function tribeConstructionGoals(state, tribe, nests, threats, frontierSites, world, birthCells) {
  return constructionDemand(state, tribe, nests, threats, frontierSites, world, birthCells);
}

export function tribeConstructionNeeds(state, tribe, nests, threats, frontierSites, world, birthCells) {
  return constructionDemand(state, tribe, nests, threats, frontierSites, world, birthCells).filter(need => need.affordable);
}

export function tribeConstructionMaterials(state, tribe, nests, threats, frontierSites, world, birthCells) {
  const need = constructionDemand(state, tribe, nests, threats, frontierSites, world, birthCells)[0];
  if (!need) return {};
  const reserved = constructionReservations(state, tribe);
  return Object.fromEntries(Object.entries(need.cost.materials).map(([key, amount]) =>
    [key, Math.max(0, amount + (reserved[key] || 0) - (state.resourceInventory[key] || 0))]));
}
