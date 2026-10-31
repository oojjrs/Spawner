import { buildingCost, buildingDefinition, constructionSeconds } from "./buildings.mjs";
import { HARVEST_ATTRIBUTE_KEYS, unitCarryCapacity, unitTravelSpeed, unitTerrainSpeedMultiplier, birthCost } from "./attributes.mjs";
import { allocateWorkers } from "./worker-allocation.mjs";

const limit = value => Math.max(0, Math.min(1, value));
const distance = (first, second) => Math.abs(first.x - second.x) + Math.abs(first.y - second.y);

export function createConstructionSupply(context) {
  const { state, colony, storage, route, walkable } = context;
  let foragerReservation = null;

  function sites() {
    return state.agents.filter(agent => agent.health > 0 && agent.construction && buildingDefinition(agent.construction.buildingKey));
  }

  function initialize(builder) {
    const plan = builder.construction;
    if (!plan || plan.supplyVersion === 1) return;
    plan.supplyVersion = 1;
    plan.id = "construction:" + builder.id + ":" + plan.orderedAt;
    plan.required = { ...buildingCost(plan.buildingKey, colony.tribe).materials };
    plan.delivered = {};
    plan.consumed = {};
    plan.progress = 0;
    plan.stage = 1;
  }

  function refresh() {
    storage.refresh();
    for (const builder of sites()) initialize(builder);
  }

  function incoming(siteId, type, excluded) {
    return state.agents.reduce((sum, agent) => sum + (agent !== excluded && agent.health > 0 &&
      agent.transportCargo?.siteId === siteId && agent.carryingType === type ? agent.carrying : 0), 0);
  }

  function reserved() {
    const amounts = {};
    for (const builder of sites()) {
      initialize(builder);
      const plan = builder.construction;
      for (const [type, amount] of Object.entries(plan.required)) {
        amounts[type] = (amounts[type] || 0) + Math.max(0, amount - (plan.delivered[type] || 0) - incoming(plan.id, type, null));
      }
    }
    return amounts;
  }

  function available() {
    refresh();
    const held = reserved();
    return Object.fromEntries(Object.entries(state.resourceInventory).map(([type, amount]) => [type, Math.max(0, amount - (held[type] || 0))]));
  }

  function workers() {
    return state.agents.filter(agent => agent.health >= agent.stats.health * .6 && !agent.construction && !agent.retreat &&
      !agent.combat && !(agent.birth?.readyAt > state.simSeconds) && agent.bornAt + agent.lifespan - state.simSeconds > 8);
  }

  function allocation(proposal) {
    const candidates = workers().filter(agent => !agent.attributes?.construction);
    const members = JSON.stringify(candidates.map(agent => agent.id));
    if (foragerReservation && state.simSeconds >= foragerReservation.time && state.simSeconds - foragerReservation.time < 1 && foragerReservation.members === members &&
      foragerReservation.points === state.evolutionPoints && !proposal && foragerReservation.value) return foragerReservation.value;
    const base = foragerReservation && state.simSeconds >= foragerReservation.time && state.simSeconds - foragerReservation.time < 1 &&
      foragerReservation.members === members && foragerReservation.points === state.evolutionPoints ? foragerReservation.base :
      allocateWorkers(context,candidates,foragerReservation?.base.ids || new Set());
    const value = {...base,ids:new Set(base.ids),weights:new Map(base.weights)};
    const active = sites().concat(proposal ? [proposal] : []).filter(builder => Object.entries(builder.construction.required).some(([type, amount]) =>
      amount > (builder.construction.delivered[type] || 0) + incoming(builder.construction.id, type, null)));
    if (active.length) {
      const deadline = Math.min(...active.map(builder => builder.bornAt + builder.lifespan - state.simSeconds));
      const runway = Math.max(0, (state.evolutionPoints || 0) - birthCost({slots:[]}, colony.tribe));
      if (runway >= value.maintenanceRate * Math.min(30, Math.max(0, deadline - 15))) {
        const jobs = active.flatMap(builder => Object.entries(builder.construction.required).map(([type, amount]) =>
          ({builder,type,amount:Math.max(0,amount - (builder.construction.delivered[type] || 0) - incoming(builder.construction.id,type,null))}))).filter(job => job.amount > 0);
        const units = jobs.reduce((sum,job) => sum + job.amount,0), window = Math.max(10,Math.min(120,deadline - 20));
        const haulers = candidates.filter(agent => !agent.carrying && agent.bornAt + agent.lifespan - state.simSeconds > 30).map(agent => {
          let seconds = 0;
          for (const job of jobs) {
            const sources = state.resourceStores.filter(store => store.kind !== "remains" && store.inventory[job.type] > 0);
            const gap = sources.reduce((best,store) => Math.min(best,Math.abs(store.x + store.width / 2 - job.builder.construction.x - 1) +
              Math.abs(store.y + store.height / 2 - job.builder.construction.y - 1)),Infinity);
            const capacity = unitCarryCapacity(agent,job.type);
            seconds += job.amount * (2 + gap / Math.max(.01,unitTravelSpeed(agent,capacity,job.type)) +
              gap / Math.max(.01,unitTravelSpeed(agent,0,job.type))) / Math.max(1,capacity);
          }
          const rate = units / Math.max(1,seconds);
          return {agent,rate,score:rate / (.01 + (value.rates.get(agent.id) || 0))};
        }).sort((a,b) => b.score - a.score);
        let rate = haulers.filter(row => !value.ids.has(row.agent.id)).reduce((sum,row) => sum + row.rate,0);
        for (const row of haulers) {
          if (rate >= units / window) break;
          if (!value.ids.has(row.agent.id)) continue;
          if (value.ids.size <= 1) break;
          value.ids.delete(row.agent.id);value.weights.set(row.agent.id,.05);rate += row.rate;
        }
      }
    }
    if (!proposal || !foragerReservation || foragerReservation.base !== base) foragerReservation = {
      time:state.simSeconds, members, points:state.evolutionPoints, base, value:proposal ? null : value };
    return value;
  }

  function protectedForagers() {
    return allocation().ids;
  }

  function siteCells(plan) {
    const definition = buildingDefinition(plan.buildingKey);
    return storage.cells({ ...plan, width: definition.width, height: definition.height, kind: "site" }).filter(cell => walkable(cell.x, cell.y));
  }

  function nearestRoute(agent, cells) {
    for (const cell of [...cells].sort((a, b) => distance(agent, a) - distance(agent, b)).slice(0, 12)) {
      const cells = route(agent, cell);
      if (cells) return { target: cell, route: cells };
    }
    return null;
  }

  function forecast(builder, candidate, partial) {
    const stock = available(), cost = buildingCost(candidate.buildingKey,colony.tribe);
    if (!cost || !Object.entries(cost.materials).every(([type,amount]) => (stock[type] || 0) + 1e-8 >= amount)) return null;
    const proposal = {...builder,construction:{...candidate,id:"forecast:" + builder.id,required:cost.materials,delivered:{}}};
    const protectedIds = allocation(proposal).ids;
    const couriers = workers().filter(agent => agent !== builder && !protectedIds.has(agent.id) && !agent.attributes?.construction);
    const requiredUnits = Object.values(cost.materials).reduce((sum,amount) => sum + amount,0);
    if (!couriers.length) return partial ? {ready:false,deliveredUnits:0,requiredUnits,deliverySeconds:Infinity} : null;
    const approaches = siteCells(candidate);
    if (!approaches.length) return null;
    const duration = constructionSeconds(candidate.buildingKey,builder.attributes.construction);
    const horizon = builder.bornAt + builder.lifespan - state.simSeconds - duration - 10;
    const times = (agent,cells,carrying,type) => cells.slice(1).reduce((sum,cell) => sum +
      1 / Math.max(.01,unitTravelSpeed(agent,carrying,type) * (context.terrainAt ? unitTerrainSpeedMultiplier(agent,context.terrainAt(cell.x,cell.y)) : 1)),0);
    const routes = new Map();
    const path = (agent,target) => {
      const key = [agent.x,agent.y,target.x,target.y].join(":");
      if (!routes.has(key)) routes.set(key,context.forecastRoute ? context.forecastRoute(agent,target,candidate) : route(agent,target));
      return routes.get(key);
    };
    let deliverySeconds = 0, deliveredUnits = 0;
    const timelines = new Map(couriers.map(agent => [agent.id,{ready:0,position:{x:agent.x,y:agent.y}}]));
    for (const [type,amount] of Object.entries(cost.materials)) {
      const sources = state.resourceStores.filter(store => store.kind !== "remains" && store.inventory[type] > 0);
      const options = couriers.flatMap(agent => {
        let best = null;
        for (const store of sources) {
          for (const pickup of storage.cells(store).filter(cell => walkable(cell.x,cell.y))
            .sort((a,b) => distance(agent,a) - distance(agent,b)).slice(0,3)) {
            const timeline = timelines.get(agent.id);
            const approach = path({...agent,...timeline.position},pickup);
            if (!approach) continue;
            for (const target of [...approaches].sort((a,b) => distance(pickup,a) - distance(pickup,b)).slice(0,3)) {
              const outward = path({...agent,...pickup},target),back = path({...agent,...target},pickup);
              if (!outward || !back) continue;
              const capacity = unitCarryCapacity(agent,type);
              const first = timeline.ready + times(agent,approach,0,type) + times(agent,outward,capacity,type) + 2;
              const cycle = times(agent,outward,capacity,type) + times(agent,back,0,type) + 2;
              const window = Math.min(horizon,agent.bornAt + agent.lifespan - state.simSeconds - 5);
              const trips = first < window ? 1 + Math.floor((window - first) / Math.max(.01,cycle)) : 0;
              if (trips <= 0) continue;
              const next = {rate:capacity / cycle,capacity,first,cycle,trips,storeId:store.id,agentId:agent.id,pickup,returnSeconds:times(agent,back,0,type)};
              if (!best || next.rate > best.rate) best = next;
            }
          }
        }
        return best ? [best] : [];
      });
      const remaining = new Map(sources.map(store => [store.id,store.inventory[type]]));
      const arrivals = options.flatMap(option => Array.from({length:Math.min(option.trips,Math.ceil(amount / option.capacity))},(_,index) =>
        ({time:option.first + index * option.cycle,amount:option.capacity,storeId:option.storeId,agentId:option.agentId,pickup:option.pickup,returnSeconds:option.returnSeconds}))).sort((a,b) => a.time - b.time);
      let delivered = 0, completion = 0;
      for (const arrival of arrivals) {
        const quantity = Math.min(amount - delivered,arrival.amount,remaining.get(arrival.storeId) || 0);
        if (!(quantity > 0)) continue;
        remaining.set(arrival.storeId,remaining.get(arrival.storeId) - quantity);
        delivered += quantity;completion = arrival.time;
        const timeline = timelines.get(arrival.agentId);
        timeline.ready = arrival.time + arrival.returnSeconds;timeline.position = arrival.pickup;
        if (delivered + 1e-8 >= amount) break;
      }
      if (delivered + 1e-8 < amount && !partial) return null;
      deliveredUnits += delivered;
      deliverySeconds = Math.max(deliverySeconds,completion);
    }
    const units = Object.values(cost.materials).reduce((sum,amount) => sum + amount,0);
    const committed = sites().reduce((sum,agent) => sum + Object.entries(agent.construction.required).reduce((total,[type,amount]) =>
      total + Math.max(0,amount - (agent.construction.delivered[type] || 0)),0),0);
    deliverySeconds *= 1 + committed / Math.max(1,units);
    const ready = deliveredUnits + 1e-8 >= requiredUnits && deliverySeconds < horizon;
    if (!ready && !partial) return null;
    return {ready,deliveredUnits,requiredUnits,deliverySeconds,couriers:couriers.length,buildSeconds:duration + deliverySeconds};
  }

  function prepare(builder) {
    initialize(builder);
    return builder.construction;
  }

  function advance(builder, elapsed) {
    initialize(builder);
    const plan = builder.construction;
    const ceiling = Math.min(1, ...Object.entries(plan.required).map(([type, amount]) => (plan.delivered[type] || 0) / amount));
    plan.progress = Math.min(ceiling, plan.progress + elapsed / constructionSeconds(plan.buildingKey, builder.attributes.construction));
    if (plan.progress >= 1 - 1e-8) plan.progress = 1;
    plan.stage = Math.min(3, 1 + Math.floor(plan.progress * 3));
    plan.supplyWaiting = ceiling <= plan.progress + 1e-8 && plan.progress < 1;
    if (plan.supplyWaiting && !Number.isFinite(plan.supplyWaitingSince)) plan.supplyWaitingSince = state.simSeconds;
    if (!plan.supplyWaiting) plan.supplyWaitingSince = null;
    for (const [type, amount] of Object.entries(plan.required)) plan.consumed[type] = amount * plan.progress;
    return plan.progress >= 1;
  }

  function stop(builder) {
    const plan = builder.construction;
    if (plan?.supplyVersion === 1) storage.abandon(plan, Object.fromEntries(Object.entries(plan.required).map(([type]) =>
      [type, Math.max(0, (plan.delivered[type] || 0) - (plan.consumed[type] || 0))])));
  }

  function outstanding(plan, type, excluded) {
    const assigned = state.agents.reduce((sum, agent) => sum + (agent !== excluded && agent.health > 0 && !agent.transportCargo &&
      agent.transport?.siteId === plan.id && agent.transport.type === type ? agent.transport.amount : 0), 0);
    return Math.max(0, plan.required[type] - (plan.delivered[type] || 0) - incoming(plan.id, type, excluded) - assigned);
  }

  function finishTarget(agent, job) {
    const builder = sites().find(builder => builder.construction.id === job.siteId);
    if (builder) {
      const plan = builder.construction;
      const missing = Math.max(0, plan.required[job.type] - (plan.delivered[job.type] || 0));
      if (missing > 1e-8) {
        const next = nearestRoute(agent, siteCells(plan));
        if (next) return { ...job, ...next, phase: "deliver", amount: Math.min(agent.carrying, missing),
          target: { ...next.target, key: plan.id + ":deliver", targetX: plan.x + 1.5, targetY: plan.y + 1.5 }, gain: 100 };
      }
    }
    const destinations = storage.refresh().filter(store => storage.space(store) > 1e-8);
    for (const store of destinations.sort((a, b) => distance(agent, a) - distance(agent, b))) {
      const next = nearestRoute(agent, storage.cells(store).filter(cell => walkable(cell.x, cell.y)));
      if (next) return { ...job, ...next, storeId: store.id, siteId: null, phase: "return", amount: agent.carrying,
        target: { ...next.target, key: store.id + ":return", targetX: store.x + store.width / 2, targetY: store.y + store.height / 2 }, gain: 80 };
    }
    return null;
  }

  function plans(agent) {
    refresh();
    if (agent.transportCargo && agent.carrying > 0) {
      const next = finishTarget(agent, { ...agent.transportCargo, type: agent.carryingType });
      return next ? [next] : [];
    }
    if (agent.carrying > 0 || !workers().includes(agent) || agent.attributes?.construction || protectedForagers().has(agent.id)) return [];
    const candidates = [];
    const active = sites().sort((a, b) => Number(!!b.construction.supplyWaiting) - Number(!!a.construction.supplyWaiting) ||
      a.bornAt + a.lifespan - b.bornAt - b.lifespan).slice(0, 4);
    for (const builder of active) {
      const plan = builder.construction;
      for (const [type] of Object.entries(plan.required)) {
        const missing = outstanding(plan, type, agent);
        if (missing <= 1e-8) continue;
        for (const store of state.resourceStores.filter(store => store.inventory[type] > 1e-8)
          .sort((a, b) => distance(agent, a) - distance(agent, b)).slice(0, 2)) {
          const pickupReserved = state.agents.reduce((sum, other) => sum + (other !== agent && other.health > 0 && !other.transportCargo &&
            other.transport?.storeId === store.id && other.transport.type === type ? other.transport.amount : 0), 0);
          const amount = Math.min(unitCarryCapacity(agent,type), missing, store.inventory[type] - pickupReserved);
          if (amount <= 1e-8) continue;
          const next = nearestRoute(agent, storage.cells(store).filter(cell => walkable(cell.x, cell.y)));
          if (!next) continue;
          const delivery = nearestRoute({ ...agent, ...next.target }, siteCells(plan));
          if (!delivery) continue;
          const seconds = (next.route.length - 1) / Math.max(.01, unitTravelSpeed(agent, 0)) +
            (delivery.route.length - 1) / Math.max(.01, unitTravelSpeed(agent, amount)) + 2;
          const remaining = builder.bornAt + builder.lifespan - state.simSeconds;
          if (seconds + 5 >= Math.min(remaining, agent.bornAt + agent.lifespan - state.simSeconds)) continue;
          const fraction = (plan.delivered[type] || 0) / plan.required[type];
          const coverage = (plan.required[type] - missing) / plan.required[type];
          const bottleneck = Math.min(...Object.entries(plan.required).map(([resource, quantity]) => (plan.delivered[resource] || 0) / quantity));
          const urgency = Number(plan.supplyWaiting) + limit(1 - remaining / Math.max(30, seconds * 4));
          const specialist = Number(agent.attributes?.antenna > 0) + Number(HARVEST_ATTRIBUTE_KEYS.some(key => agent.attributes?.[key] > 0));
          const waiting = plan.supplyWaiting ? Math.min(2, Math.max(0, state.simSeconds -
            (plan.supplyWaitingSince ?? plan.startedAt ?? plan.orderedAt ?? state.simSeconds)) / 30) : 0;
          const gain = (40 + urgency * 15 + waiting * 15 + (fraction <= bottleneck + 1e-8 ? 15 : 0)) *
            Math.min(2, amount) / (1 + seconds / 30) / (1 + specialist * .3);
          candidates.push({ siteId: plan.id, storeId: store.id, type, amount, phase: "pickup", gain, coverage, priority: true,
            target: { ...next.target, key: plan.id + ":" + store.id + ":" + type }, route: next.route });
        }
      }
    }
    const continuing = candidates.find(candidate => candidate.siteId === agent.transport?.siteId &&
      candidate.storeId === agent.transport.storeId && candidate.type === agent.transport.type);
    if (continuing) return [continuing];
    const balanced = candidates.filter(candidate => !candidates.some(other => other.siteId === candidate.siteId && other.coverage + 1e-8 < candidate.coverage));
    if (balanced.length) return balanced.sort((a, b) => b.gain - a.gain).slice(0, 3);
    for (const store of state.resourceStores.filter(store => store.kind === "remains")) {
      for (const [type, amount] of Object.entries(store.inventory)) {
        if (amount <= 1e-8 || !state.resourceStores.some(target => storage.space(target) > 0)) continue;
        const next = nearestRoute(agent, storage.cells(store).filter(cell => walkable(cell.x, cell.y)));
        if (next) candidates.push({ siteId: null, storeId: store.id, type, amount: Math.min(unitCarryCapacity(agent,type), amount),
          phase: "pickup", gain: 12 / (1 + next.route.length / 10), target: { ...next.target, key: store.id + ":" + type }, route: next.route });
      }
    }
    return candidates.sort((a, b) => b.gain - a.gain).slice(0, 3);
  }

  function assign(agent, job) {
    agent.transport = { siteId: job.siteId, storeId: job.storeId, type: job.type, amount: job.amount, phase: job.phase };
    agent.transportReadyAt = null;
  }

  function interact(agent) {
    const job = agent.transport;
    if (!job) return 0;
    if (agent.transportReadyAt === null || agent.transportReadyAt === undefined) {
      agent.transportReadyAt = state.simSeconds + 1;
      agent.mode = "unload";
      if (job.phase !== "pickup") agent.foodDelivery = { colonyId: colony.id, buildingId: job.siteId || job.storeId,
        x: agent.x + .5, y: agent.y + .5, targetX: agent.utility.target.targetX, targetY: agent.utility.target.targetY,
        resourceType: agent.carryingType, amount: agent.carrying, startedAt: state.simSeconds,
        arrivesAt: agent.transportReadyAt, receivedAt: null };
      return 0;
    }
    if (state.simSeconds < agent.transportReadyAt) return 0;
    refresh();
    let delivered = 0;
    if (job.phase === "pickup") {
      const store = state.resourceStores.find(store => store.id === job.storeId);
      const builder = sites().find(builder => builder.construction.id === job.siteId);
      const needed = builder ? outstanding(builder.construction, job.type, agent) : job.siteId ? 0 : job.amount;
      const amount = storage.withdraw(store, job.type, Math.min(job.amount, needed, unitCarryCapacity(agent,job.type)));
      if (amount > 0) {
        agent.carrying = amount;
        agent.carryingType = job.type;
        agent.transportCargo = { siteId: job.siteId, storeId: job.storeId };
      }
    } else if (job.phase === "deliver") {
      const builder = sites().find(builder => builder.construction.id === job.siteId);
      if (builder) {
        const plan = builder.construction;
        delivered = Math.min(agent.carrying, Math.max(0, plan.required[job.type] - (plan.delivered[job.type] || 0)));
        plan.delivered[job.type] = (plan.delivered[job.type] || 0) + delivered;
        agent.carrying -= delivered;
      }
    } else {
      const store = state.resourceStores.find(store => store.id === job.storeId);
      delivered = storage.deposit(store, job.type, agent.carrying);
      agent.carrying -= delivered;
    }
    if (agent.carrying <= 1e-8) { agent.carrying = 0; agent.carryingType = null; agent.transportCargo = null; }
    if (agent.foodDelivery) agent.foodDelivery.receivedAt = state.simSeconds;
    agent.transport = null;
    agent.transportReadyAt = null;
    agent.utility = null;
    agent.mode = "search";
    agent.decisionPending = "completed";
    return delivered;
  }

  function release(agent) {
    agent.transport = null;
    agent.transportReadyAt = null;
  }

  function lose(agent) {
    if (agent.transportCargo && agent.carrying > 0) {
      storage.abandon(agent, { [agent.carryingType]: agent.carrying });
      agent.carrying = 0;
      agent.carryingType = null;
      agent.transportCargo = null;
    }
    stop(agent);
    release(agent);
  }

  function shortages() {
    refresh();
    const held = reserved();
    return Object.fromEntries(Object.entries(held).map(([type, amount]) => [type, Math.max(0, amount - (state.resourceInventory[type] || 0))]));
  }

  function restore() {
    foragerReservation = null;
    refresh();
  }

  return { refresh, restore, available, reserved, forecast, prepare, advance, stop, plans, assign, interact, release, lose, shortages,
    foragers: protectedForagers, allocation };
}
