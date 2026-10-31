import { HARVEST_ATTRIBUTE_KEYS, unitCarryCapacity, unitTerrainSpeedMultiplier, unitTravelSpeed } from "./attributes.mjs";
import { colonySupply } from "./colony-supply.mjs";
import { resourceDefinition } from "./resources.mjs";

const distance = (first, second) => Math.abs(first.x - second.x) + Math.abs(first.y - second.y);

export function allocateWorkers(context, workers, previous) {
  const { state, colony, route } = context;
  const horizon = 60, supply = colonySupply(state, colony.tribe);
  const foods = [...state.knownFood.values()].map(food => ({ ...food,
    resourceType: context.resourceType ? context.resourceType(food) : food.resourceType }))
    .filter(food => food.amount > 0 && context.isFood(food.resourceType));
  const homes = context.deliveryCells(), options = new Map(), claims = new Map(), weights = new Map(), routes = new Map();
  const ids = new Set(), rates = new Map(), foodYields = new Map();
  const remainingLife = agent => Number.isFinite(agent.bornAt) && Number.isFinite(agent.lifespan) ?
    agent.bornAt + agent.lifespan - state.simSeconds - 5 : Infinity;
  const travelTime = (agent, cells, carrying, type) => cells.slice(1).reduce((seconds, cell) => seconds +
    1 / Math.max(.01, unitTravelSpeed(agent, carrying, type) *
      (context.terrainAt ? unitTerrainSpeedMultiplier(agent, context.terrainAt(cell.x, cell.y)) : 1)), 0);
  function path(agent, target) {
    const key = [agent.id, agent.x, agent.y, target.x, target.y].join(":");
    if (!routes.has(key)) routes.set(key, route(agent, target));
    return routes.get(key);
  }
  function homeRoute(agent, origin, carrying, type) {
    for (const home of [...homes].sort((a, b) => distance(origin, a) - distance(origin, b)).slice(0, 12)) {
      const cells = path({ ...agent, ...origin }, home);
      if (!cells) continue;
      const seconds = travelTime(agent, cells, carrying, type);
      return { cells, seconds };
    }
    return null;
  }
  let incomingFood = 0;
  for (const agent of workers) {
    if (!(agent.carrying > 0) || agent.transportCargo || !context.isFood(agent.carryingType)) continue;
    const home = homeRoute(agent, agent, agent.carrying, agent.carryingType);
    const room = context.deliveryCapacity ? context.deliveryCapacity(agent.carryingType) : Infinity;
    if (home && home.seconds + 1 < Math.min(horizon, remainingLife(agent))) incomingFood += Math.min(agent.carrying, Math.max(0, room - incomingFood));
  }
  const reserve = Math.max(supply.reserve, supply.maintenanceRate * horizon);
  const requiredRate = Math.max(0, supply.maintenanceRate * 1.2 + (reserve - (state.evolutionPoints || 0) - incomingFood) / horizon);
  for (const agent of workers) {
    const choices = [];
    if (agent.transportCargo) { options.set(agent.id, choices); continue; }
    const currentType = agent.carryingType, loaded = agent.carrying > 0;
    const returning = loaded ? homeRoute(agent, agent, agent.carrying, currentType) : null;
    if (loaded && !returning) { options.set(agent.id, choices); continue; }
    const origin = returning ? returning.cells.at(-1) : agent;
    const pending = returning ? returning.seconds + 1 : 0;
    for (const food of [...foods].filter(food => !context.canHarvest || context.canHarvest(food, agent))
      .sort((a, b) => distance(origin, a) - distance(origin, b)).slice(0, 6)) {
      const type = food.resourceType, capacity = Math.min(food.amount, unitCarryCapacity(agent, type));
      if (!(capacity > 0)) continue;
      const outward = path({ ...agent, ...origin }, food);
      if (!outward) continue;
      const back = homeRoute(agent, food, capacity, type);
      if (!back) continue;
      const definition = resourceDefinition(type);
      const harvest = Math.ceil(capacity) * (context.harvestSeconds ? context.harvestSeconds(type, agent) : definition.harvestSeconds);
      const home = back.cells.at(-1), repeat = path({ ...agent, ...home }, food);
      if (!repeat) continue;
      const first = pending + travelTime(agent, outward, 0, type) + harvest + 2 + back.seconds;
      const cycle = travelTime(agent, repeat, 0, type) + harvest + 2 + back.seconds;
      const life = remainingLife(agent), window = Math.min(horizon, life);
      const room = context.deliveryCapacity ? context.deliveryCapacity(type) : Infinity;
      const potential = first < life ? Math.min(food.amount, capacity * (1 + Math.floor((life - first) / Math.max(.01, cycle))),
        Math.max(0, room - incomingFood)) : 0;
      foodYields.set(agent.id,Math.max(foodYields.get(agent.id) || 0,potential));
      if (first >= window) continue;
      const trips = 1 + Math.floor((window - first) / Math.max(.01, cycle));
      const amount = Math.min(food.amount, capacity * trips, Math.max(0, room - incomingFood));
      if (amount > 0) choices.push({ key: food.key || food.x + "," + food.y, amount, room });
    }
    options.set(agent.id, choices);
  }
  let productionRate = 0;
  while (productionRate + 1e-8 < requiredRate) {
    let best = null;
    for (const agent of workers) {
      if (ids.has(agent.id)) continue;
      for (const option of options.get(agent.id)) {
        const food = state.knownFood.get(option.key) || foods.find(food => (food.key || food.x + "," + food.y) === option.key);
        const amount = Math.min(option.amount, Math.max(0, food.amount - (claims.get(option.key) || 0)),
          Math.max(0, option.room - incomingFood - productionRate * horizon));
        const rate = amount / horizon;
        const score = Math.min(rate, requiredRate - productionRate) * (previous.has(agent.id) ? 1.12 : 1) / (agent.transport?.siteId ? 1.25 : 1);
        if (rate > 0 && (!best || score > best.score)) best = { agent, option, amount, rate, score };
      }
    }
    if (!best) break;
    ids.add(best.agent.id);
    rates.set(best.agent.id, best.rate);
    claims.set(best.option.key, (claims.get(best.option.key) || 0) + best.amount);
    productionRate += best.rate;
  }
  const forecastBalance = (state.evolutionPoints || 0) + incomingFood + productionRate * horizon -
    reserve - supply.maintenanceRate * 1.2 * horizon;
  if (productionRate + 1e-8 < requiredRate && forecastBalance < 0) {
    for (const agent of workers) if (!agent.transportCargo) ids.add(agent.id);
  } else if (!ids.size && foods.length) {
    const scout = workers.find(agent => !agent.transportCargo && !HARVEST_ATTRIBUTE_KEYS.some(key => agent.attributes?.[key] > 0)) ||
      workers.find(agent => !agent.transportCargo);
    if (scout) ids.add(scout.id);
  }
  for (const agent of workers) {
    const rate = rates.get(agent.id) || 0;
    const shortfall = Math.max(0, requiredRate - (productionRate - rate));
    weights.set(agent.id, ids.has(agent.id) ? 1 + 2 * Math.min(1, shortfall / Math.max(.001, rate)) : .05);
  }
  return { ids, rates, weights, foodYields, requiredRate, productionRate, incomingFood, reserve, forecastBalance, maintenanceRate: supply.maintenanceRate };
}
