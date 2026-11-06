import { militaryAgent } from "./conquest-pacing.mjs";
import { HARVEST_ATTRIBUTE_KEYS, birthCost, unitCarryCapacity, unitTravelSpeed } from "./attributes.mjs";

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
}

export function colonySupply(state, tribe) {
  const living = state.agents.filter(agent => agent.health > 0);
  const reserve = birthCost({ slots:["strength"] }, tribe);
  const gap = Number.isFinite(state.lastFoodAt) ? Math.max(0, state.simSeconds - state.lastFoodAt) : 0;
  if (state.evolutionPoints >= reserve * 3 || !living.length) state.supplyInterrupted = false;
  else if (gap > 30) state.supplyInterrupted = true;
  const interruption = state.supplyInterrupted ? Math.max(.5, Math.min(1, (gap - 30) / 60)) : 0;
  const urgency = Math.max(interruption, living.length <= 2 ? Math.max(0, 1 - state.evolutionPoints / reserve) : 0);
  const observedSeconds = Number.isFinite(state.foodIncomeStartedAt) ? Math.max(0, state.simSeconds - state.foodIncomeStartedAt) : 0;
  const income = (state.foodIncome || []).filter(entry => entry[0] > state.simSeconds - 60 && entry[0] <= state.simSeconds)
    .reduce((sum, entry) => sum + entry[1], 0);
  const incomeRate = income / Math.max(1, Math.min(60, observedSeconds));
  return { living:living.length, reserve, urgency, interruption, incomeRate, maintenanceRate:0, rateDeficit:0,
    incomeObserved:observedSeconds >= 30, forecastBalance:state.evolutionPoints + incomeRate * 120 - reserve };
}

export function colonyForagers(state, foods, homes) {
  let workers = state.agents.filter(agent => !militaryAgent(agent,agent.tribe) && agent.health >= agent.stats.health * .6 && !agent.retreat && !agent.combat &&
    !(agent.birth?.readyAt > state.simSeconds));
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
    return { agent, feasible:Number.isFinite(travel), reachable:Number.isFinite(outward / speed), efficiency };
  }).sort((a,b) => a.efficiency - b.efficiency || String(a.agent.id).localeCompare(String(b.agent.id)));
  const feasible = ranked.filter(entry=>entry.feasible), assigned = feasible.length ? feasible : ranked.filter(entry=>entry.reachable);
  return new Set(assigned.slice(0, Math.max(1, Math.ceil(workers.length / 2))).map(entry => entry.agent.id));
}
