import { NEST_LEVELS } from "./nests.mjs";
import { RESOURCE_TYPES } from "./resources.mjs";

export function commandRoomCheat(action, room) {
  if (action.type !== "cheat-switch-tribe") return null;
  const colony = room.colonies.find(entry => entry.tribe === action.tribe);
  if (!colony || !room.games.has(colony.ownerId)) throw new Error("전환할 종족을 선택해 주세요.");
  room.games.get(colony.ownerId).checkEnding();
  room.hostId = colony.ownerId;
  return { colonyId: colony.id };
}

export function commandCheat(action, state, removeDeadAgents, checkEnding, restoreResources) {
  if (!["cheat-evolution-points", "cheat-resources", "cheat-upgrade", "cheat-heal", "cheat-extinction"].includes(action.type)) return null;
  if (action.type === "cheat-evolution-points") {
    state.evolutionPoints += 10000;
  } else if (action.type === "cheat-resources") {
    for (const resource of RESOURCE_TYPES) {
      if (resource.category === "material") state.resourceInventory[resource.key] = (state.resourceInventory[resource.key] || 0) + 100;
    }
    restoreResources();
  } else if (action.type === "cheat-upgrade") {
    if (state.nestLevel < NEST_LEVELS.length) {
      const previousHealth = NEST_LEVELS[state.nestLevel - 1].health;
      state.nestLevel += 1;
      state.nestHealth += NEST_LEVELS[state.nestLevel - 1].health - previousHealth;
    }
  } else if (action.type === "cheat-heal") {
    state.nestHealth = NEST_LEVELS[state.nestLevel - 1].health;
    for (const agent of state.agents) {
      if (agent.health > 0) agent.health = agent.stats.health;
    }
  } else {
    for (const agent of state.agents) agent.health = 0;
    removeDeadAgents();
    state.evolutionPoints = 0;
    checkEnding();
  }
  return {};
}
