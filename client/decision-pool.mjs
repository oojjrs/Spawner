import { createUnitIndex } from "../server/unit-index.mjs";

function decisionSignature(agent) {
  return JSON.stringify([agent.x, agent.y, agent.carrying, agent.carryingType, agent.level, agent.attributes,
    agent.utility?.action, agent.utility?.target?.key, agent.utility?.defending, agent.defenseRevision || 0,
    agent.survivalState, Boolean(agent.retreat), agent.retreat?.recoverHealth, agent.suspendedWork?.target?.key, agent.birth?.readyAt]);
}

export function createDecisionPool(room) {
  if (typeof Worker === "function" && typeof globalThis.SpawnerDecisionWorkerSource === "string") return createDecisionWorkers(room);
  const pending = new Map(), completed = new Map();
  let disposed = false, ownerCursor = 0;
  const planner = {
    room,
    dispose() {
      disposed = true;
      pending.clear(); completed.clear();
      if (room.decisionPlanner === planner) room.decisionPlanner = null;
    },
    request(owner, agent, reason) {
      const key = owner + "/" + agent.id, result = completed.get(key);
      if (result) {
        completed.delete(key);
        if (result.reason === reason && result.signature === decisionSignature(agent) && room.simSeconds - result.time <= 1) return result.candidates;
      }
      if (!disposed && !pending.has(key)) pending.set(key, { owner, id: agent.id, reason });
      return undefined;
    },
    flush() {
      if (disposed) return;
      for (const [key, result] of completed) if (room.simSeconds - result.time > 1) completed.delete(key);
      if (!pending.size) return;
      const previousIndex = room.unitIndex;
      room.unitIndex ||= createUnitIndex(room);
      try {
        const owners = [...room.games], startedAt = performance.now();
        for (let count = 0; count < owners.length; count++) {
          const [owner, game] = owners[ownerCursor++ % owners.length];
          const requests = [], agents = new Map(game.agents.map(agent => [agent.id, agent]));
          for (const [key, request] of pending) {
            if (request.owner !== owner) continue;
            pending.delete(key);
            const agent = agents.get(request.id);
            if (!agent || agent.health <= 0 || agent.birth || agent.combat) continue;
            requests.push({ ...request, key, signature: decisionSignature(agent) });
            if (requests.length >= 4) break;
          }
          if (!requests.length) continue;
          const candidates = game.planDecisions(requests);
          for (let index = 0; index < requests.length; index++) {
            const request = requests[index];
            completed.set(request.key, { signature: request.signature, reason:request.reason, time: room.simSeconds, candidates: candidates[index] });
          }
          if (performance.now() - startedAt >= 40) break;
        }
      } finally { room.unitIndex = previousIndex; }
    }
  };
  room.decisionPlanner = planner;
  return planner;
}

function createDecisionWorkers(room) {
  const pending = new Map(), active = new Set(), completed = new Map(), workers = [];
  const limit = Math.max(1, Math.min(2, room.games.size, (navigator.hardwareConcurrency || 4) - 2));
  const url = URL.createObjectURL(new Blob([globalThis.SpawnerDecisionWorkerSource], { type: "text/javascript" }));
  let ownerCursor = 0, disposed = false;
  function recover(slot, worker) {
    if (disposed || slot.worker !== worker) return;
    slot.worker?.terminate();
    slot.worker = null;
    for (const request of slot.requests) {
      active.delete(request.key);
      if (!pending.has(request.key)) pending.set(request.key, request);
    }
    slot.requests = []; slot.busy = false;
    slot.failures++;
    slot.retryAt = performance.now() + Math.min(30000, 1000 * 2 ** Math.min(slot.failures - 1, 5));
  }
  function start(slot) {
    if (disposed || slot.worker || performance.now() < slot.retryAt) return;
    let worker = null;
    try {
      worker = new Worker(url); slot.worker = worker;
      worker.onmessage = event => {
        if (disposed || slot.worker !== worker) return;
        if (event.data?.error || !Array.isArray(event.data?.results) || event.data.results.length !== slot.requests.length) {
          recover(slot, worker); return;
        }
        const keys = new Set(slot.requests.map(request => request.key));
        if (event.data.results.some(result => !result || !Array.isArray(result.candidates) || !keys.delete(result.key))) { recover(slot, worker); return; }
        for (const request of slot.requests) active.delete(request.key);
        slot.busy = false; slot.failures = 0;
        for (const result of event.data.results) completed.set(result.key, result);
        slot.requests = [];
      };
      worker.onerror = () => recover(slot, worker);
      worker.onmessageerror = () => recover(slot, worker);
      worker.postMessage({ type: "world", world: room.world });
    } catch { recover(slot, worker); }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const slot of workers) { slot.worker?.terminate(); slot.worker = null; }
    URL.revokeObjectURL(url);
    pending.clear(); active.clear(); completed.clear();
    if (room.decisionPlanner === planner) room.decisionPlanner = null;
  }
  const planner = {
    room, dispose,
    request(owner, agent, reason) {
      const key = owner + "/" + agent.id, result = completed.get(key);
      if (result) {
        completed.delete(key);
        if (result.reason === reason && result.signature === decisionSignature(agent) && room.simSeconds - result.time <= 1) {
          return result.candidates;
        }
      }
      if (!disposed && !active.has(key) && !pending.has(key)) pending.set(key, { owner, id: agent.id, reason });
      else if (pending.has(key)) pending.get(key).reason = reason;
      return undefined;
    },
    flush() {
      if (disposed) return;
      const now = performance.now();
      for (const slot of workers) {
        if (slot.busy && now - slot.startedAt >= 10000) recover(slot, slot.worker);
        start(slot);
      }
      for (const [key, result] of completed) if (room.simSeconds - result.time > 1) completed.delete(key);
      const owners = [...room.games.keys()];
      for (const slot of workers) {
        if (!slot.worker || slot.busy || !pending.size) continue;
        let owner;
        for (let count = 0; count < owners.length; count++) {
          const candidate = owners[ownerCursor++ % owners.length];
          if ([...pending.values()].some(request => request.owner === candidate)) { owner = candidate; break; }
        }
        if (owner === undefined) continue;
        const game = room.games.get(owner), requests = [];
        for (const [key, request] of pending) {
          if (request.owner !== owner) continue;
          const agent = game.agents.find(value => value.id === request.id);
          pending.delete(key);
          if (!agent || agent.health <= 0 || agent.birth || agent.combat) continue;
          requests.push({ ...request, key, signature: decisionSignature(agent) }); active.add(key);
          if (requests.length >= 4) break;
        }
        if (!requests.length) continue;
        slot.busy = true; slot.requests = requests; slot.startedAt = now;
        const unit = ({ visited, movementVisits, path, returnPath, rememberedRoute, utility, ...agent }) => agent;
        const packet = { type: "plan", owner, requests, saved: game.decisionSnapshot(), simSeconds: room.simSeconds,
          hostId: room.hostId, food: [...room.food], targetRevision: room.targetRevision,
          colonies: room.colonies, treeCells: room.world.treeCells, hazards: room.world.hazards, games: [...room.games].map(([id, value]) => [id,
            { agents: id === owner ? [] : value.agents.map(unit), nest: value.nest }]),
          creatures: { agents: (room.creatureSystem?.agents || []).map(unit), burrows: room.creatureSystem?.burrows || [] } };
        try { slot.worker.postMessage(packet); }
        catch { recover(slot, slot.worker); }
      }
    }
  };
  for (let index = 0; index < limit; index++) {
    const slot = { worker: null, busy: false, requests: [], failures: 0, retryAt: 0, startedAt: 0 };
    workers.push(slot); start(slot);
  }
  room.decisionPlanner = planner;
  return planner;
}
