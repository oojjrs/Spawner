import { unitCarryCapacity, unitTravelSpeed, unitTerrainSpeedMultiplier } from "./attributes.mjs";

export function constructionHarvestNeeds(context, goal, stock, foragers) {
  const { state, route, storage } = context;
  const homes = storage.refresh().filter(store => store.kind !== "remains" && storage.space(store) > 0)
    .flatMap(store => storage.cells(store)).filter(cell => context.walkable(cell.x,cell.y));
  const workers = state.agents.filter(agent => agent.health >= agent.stats.health * .6 && !agent.construction &&
    !agent.attributes?.construction && !agent.retreat && !agent.combat);
  const paths = new Map();
  const path = (agent, target) => {
    const key = [agent.x,agent.y,target.x,target.y].join(":");
    if (!paths.has(key)) paths.set(key,route(agent,target));
    return paths.get(key);
  };
  const time = (agent, cells, load, type) => cells.slice(1).reduce((sum,cell) => sum + 1 / Math.max(.01,
    unitTravelSpeed(agent,load,type) * unitTerrainSpeedMultiplier(agent,context.terrainAt(cell.x,cell.y))),0);
  const gaps = [];
  for (const [type,amount] of Object.entries(goal.cost.materials)) {
    const missing = Math.max(0,amount - (stock[type] || 0));
    if (!missing) continue;
    const foods = [...state.knownFood.values()].filter(food => food.amount > 0 && context.resourceType(food) === type);
    if (!foods.length) continue;
    let capacity = 0, reachable = false;
    for (const worker of workers) {
      if (!context.isFood(type) && foragers.has(worker.id)) continue;
      if (!foods.some(food => context.canHarvest(food,worker))) continue;
      const life = worker.bornAt + worker.lifespan - state.simSeconds - 10;
      let best = 0;
      for (const food of foods.filter(food => context.canHarvest(food,worker))
        .sort((a,b) => Math.abs(worker.x-a.x)+Math.abs(worker.y-a.y)-Math.abs(worker.x-b.x)-Math.abs(worker.y-b.y)).slice(0,3)) {
        const outward = path(worker,food);
        if (!outward) continue;
        for (const home of [...homes].sort((a,b) => Math.abs(food.x-a.x)+Math.abs(food.y-a.y)-Math.abs(food.x-b.x)-Math.abs(food.y-b.y)).slice(0,3)) {
          const back = path({...worker,...food},home),repeat = path({...worker,...home},food);
          if (!back || !repeat) continue;
          reachable = true;
          const load = Math.min(food.amount,unitCarryCapacity(worker,type));
          const harvest = Math.ceil(load) * context.harvestSeconds(type,worker) + 2;
          const first = Math.max(0,(worker.birth?.readyAt || 0)-state.simSeconds) + time(worker,outward,worker.carrying,type) + harvest + time(worker,back,load,type);
          const cycle = time(worker,repeat,0,type) + harvest + time(worker,back,load,type);
          const possible = first < life ? Math.min(food.amount,load * (1 + Math.floor((life-first)/cycle))) : 0;
          best = Math.max(best,possible);
        }
      }
      capacity += best;
    }
    if (capacity > 0 || reachable) gaps.push({type,share:capacity > 0 ? missing/capacity : Infinity});
  }
  return gaps.reduce((sum,gap) => sum+gap.share,0) > 1 + 1e-8 ? gaps.map(gap=>gap.type) : [];
}
