import { HARVEST_ATTRIBUTE_KEYS, birthCost, unitCarryCapacity, unitTravelSpeed } from "./attributes.mjs";
import { AGENT_DEATH_WARNING, tribeLifespan } from "./lifespan.mjs";
import { nestUpgradeCost } from "./nests.mjs";

const snapshots = new WeakMap();

export function recordColonyIncome(state, amount) {
  if (!(amount > 0) || !Number.isFinite(amount)) return;
  const bucket = Math.floor(state.simSeconds / 5) * 5;
  const history = (state.foodIncome || []).filter(entry => entry[0] > state.simSeconds - 60);
  if (history.at(-1)?.[0] === bucket) history.at(-1)[1] += amount;
  else history.push([bucket, amount]);
  state.foodIncome = history;
}

export function restoreColonyIncome(state, saved) {
  state.foodIncomeStartedAt = Number.isFinite(saved.foodIncomeStartedAt) && saved.foodIncomeStartedAt >= 0 &&
    saved.foodIncomeStartedAt <= state.simSeconds ? saved.foodIncomeStartedAt : state.simSeconds;
  state.foodIncome = (Array.isArray(saved.foodIncome) ? saved.foodIncome : []).filter(entry => Array.isArray(entry) &&
    Number.isFinite(entry[0]) && entry[0] >= 0 && entry[0] <= state.simSeconds && entry[0] > state.simSeconds - 60 &&
    Number.isFinite(entry[1]) && entry[1] > 0).sort((first, second) => first[0] - second[0]).slice(-13).map(entry => [entry[0], entry[1]]);
  snapshots.delete(state);
}

export function colonySupply(state, tribe) {
  const previous = snapshots.get(state);
  const signature = state.agents.map(agent => [agent.id, agent.health > 0, agent.bornAt, agent.lifespan, agent.construction?.state].join(",")).join(":");
  if (previous?.time === state.simSeconds && previous.tribe === tribe && previous.points === state.evolutionPoints &&
      previous.delivered === state.colonyFood && previous.agents === state.agents && previous.signature === signature &&
      previous.lastFoodAt === state.lastFoodAt && previous.interrupted === state.supplyInterrupted &&
      previous.income === state.foodIncome && previous.startedAt === state.foodIncomeStartedAt && previous.level === state.nestLevel) return previous.value;
  const living = state.agents.filter(agent => agent.health > 0);
  const cost = agent => birthCost({ slots:agent.slots || [], attributeLevels:agent.attributeLevels }, tribe);
  const expiring = living.filter(agent => Number.isFinite(agent.bornAt) && Number.isFinite(agent.lifespan) &&
    agent.bornAt + agent.lifespan - state.simSeconds <= AGENT_DEATH_WARNING);
  const minimum = birthCost({ slots:["strength"] }, tribe);
  const reserve = Math.max(minimum, expiring.reduce((sum, agent) => sum + cost(agent), 0));
  const deficit = Math.max(0, Math.min(1, 1 - (state.evolutionPoints || 0) / reserve));
  let urgency = living.length === 1 && state.evolutionPoints < minimum ? 1 :
    deficit * Math.max(living.length <= 2 ? 1 : 0, expiring.length / Math.max(1, living.length));
  const replacement = living.reduce((sum, agent) => sum + cost(agent), 0);
  const gap = Number.isFinite(state.lastFoodAt) ? Math.max(0, state.simSeconds - state.lastFoodAt) : 0;
  const recovery = Math.max(minimum, replacement * 3);
  if (state.evolutionPoints >= recovery || !living.length) state.supplyInterrupted = false;
  else if (gap > 30) state.supplyInterrupted = true;
  const interruption = state.supplyInterrupted ? Math.max(.5, Math.min(1, (gap - 30) / 60)) : 0;
  urgency = Math.max(urgency, interruption);
  const observedSeconds = Number.isFinite(state.foodIncomeStartedAt) ? Math.max(0, state.simSeconds - state.foodIncomeStartedAt) : 0;
  const incomeObserved = observedSeconds >= 30;
  const income = (state.foodIncome || []).filter(entry => entry[0] > state.simSeconds - 60 && entry[0] <= state.simSeconds)
    .reduce((sum, entry) => sum + entry[1], 0);
  const incomeRate = income / Math.max(1, Math.min(60, observedSeconds));
  const maintenanceRate = living.filter(agent => !agent.construction).reduce((sum, agent) =>
    sum + cost(agent) / Math.max(1, Number.isFinite(agent.lifespan) && agent.lifespan > 0 ? agent.lifespan : tribeLifespan(tribe)), 0);
  const rateDeficit = incomeObserved ? Math.max(0, maintenanceRate - incomeRate) : 0;
  const forecastBudget = Math.max(reserve, maintenanceRate * 120);
  const forecastBalance = (state.evolutionPoints || 0) + incomeRate * 120 - forecastBudget;
  if (rateDeficit > 0 && forecastBalance < 0) urgency = Math.max(urgency, Math.min(1, -forecastBalance / forecastBudget));
  const timed = living.filter(agent => Number.isFinite(agent.bornAt) && Number.isFinite(agent.lifespan));
  if (!incomeObserved && state.nestLevel === 1 && timed.length && Number.isFinite(state.colonyFood)) {
    const elapsed = state.simSeconds - Math.min(...timed.map(agent => agent.bornAt));
    if (elapsed >= AGENT_DEATH_WARNING) {
      const remaining = Math.max(0, Math.min(...timed.map(agent => agent.bornAt + agent.lifespan - state.simSeconds)));
      const budget = nestUpgradeCost(1, tribe) + birthCost({slots:["antenna", "feet"]}, tribe) + replacement;
      const forecast = state.evolutionPoints + state.colonyFood * remaining / elapsed;
      urgency = Math.max(urgency, Math.max(0, Math.min(1, 1 - forecast / budget)));
    }
  }
  const value = { living:living.length, expiring:expiring.length, reserve, urgency, interruption,
    incomeRate, maintenanceRate, rateDeficit, incomeObserved, forecastBalance };
  snapshots.set(state, { time:state.simSeconds, tribe, points:state.evolutionPoints, delivered:state.colonyFood, agents:state.agents,
    signature, lastFoodAt:state.lastFoodAt, interrupted:state.supplyInterrupted, income:state.foodIncome,
    startedAt:state.foodIncomeStartedAt, level:state.nestLevel, value });
  return value;
}

export function colonyForagers(state, foods, homes, scouts) {
  let workers = state.agents.filter(agent => agent.health >= agent.stats.health * .6 && !agent.retreat && !agent.combat && !agent.construction &&
    !(agent.birth?.readyAt > state.simSeconds) && !agent.attributes?.construction);
  const ordinary = workers.filter(agent => !HARVEST_ATTRIBUTE_KEYS.some(key => agent.attributes?.[key] > 0));
  if (ordinary.length >= 2) workers = ordinary;
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const ranked = workers.map(agent => {
    const outward = foods.reduce((best, food) => Math.min(best, distance(agent, food)), Infinity);
    const speed = unitTravelSpeed(agent, agent.carrying);
    let efficiency = Infinity;
    const travel = foods.reduce((best, food) => {
      const capacity = unitCarryCapacity(agent, food.resourceType);
      const returnSpeed = unitTravelSpeed(agent, capacity, food.resourceType);
      const seconds = distance(agent, food) / speed + homes.reduce((home, cell) => Math.min(home, distance(food, cell) / returnSpeed), Infinity);
      efficiency = Math.min(efficiency, seconds / Math.max(.01, capacity));
      return Math.min(best, seconds);
    }, Infinity);
    const remaining = Number.isFinite(agent.bornAt) && Number.isFinite(agent.lifespan) ? agent.bornAt + agent.lifespan - state.simSeconds : Infinity;
    return { agent, feasible:travel + 5 < remaining, reachable:outward / speed + 5 < remaining,
      efficiency };
  }).sort((a,b) => a.efficiency - b.efficiency || String(a.agent.id).localeCompare(String(b.agent.id)));
  const feasible = ranked.filter(entry=>entry.feasible), assigned = feasible.length ? feasible : ranked.filter(entry=>entry.reachable);
  const unreserved = assigned.filter(entry => !scouts?.has(entry.agent.id));
  const selected = unreserved.length ? unreserved : assigned;
  return new Set(selected.slice(0, Math.max(1, Math.ceil(workers.length / 2))).map(entry => entry.agent.id));
}
