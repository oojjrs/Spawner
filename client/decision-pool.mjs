import { createUnitIndex } from "../server/unit-index.mjs";

function decisionSignature(agent) {
  return JSON.stringify([agent.x, agent.y, agent.carrying, agent.carryingType, agent.level, agent.attributes,
    agent.utility?.action, agent.utility?.target?.key, agent.utility?.defending, agent.defenseRevision || 0, agent.construction?.id, agent.birth?.readyAt]);
}

export function createDecisionPool(room) {
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
        if (result.signature === decisionSignature(agent) && room.simSeconds - result.time <= 1) return result.candidates;
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
            if (!agent || agent.health <= 0 || agent.birth || agent.construction || agent.combat) continue;
            requests.push({ ...request, key, signature: decisionSignature(agent) });
            if (requests.length >= 4) break;
          }
          if (!requests.length) continue;
          const candidates = game.planDecisions(requests);
          for (let index = 0; index < requests.length; index++) {
            const request = requests[index];
            completed.set(request.key, { signature: request.signature, time: room.simSeconds, candidates: candidates[index] });
          }
          if (performance.now() - startedAt >= 40) break;
        }
      } finally { room.unitIndex = previousIndex; }
    }
  };
  room.decisionPlanner = planner;
  return planner;
}
