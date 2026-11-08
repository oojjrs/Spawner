import { NEST_LEVELS } from "./nests.mjs";

export function commandRoomCheat(action, room) {
  if (action.type === "cheat-victory") {
    const host = room.games.get(room.hostId);
    const tribe = room.colonies.find(entry => entry.ownerId === room.hostId).tribe;
    if (host.checkEnding()) return {};
    for (const colony of room.colonies) {
      if (!colony.tribe || colony.tribe === tribe) continue;
      const game = room.games.get(colony.ownerId);
      if (!game || game.ending) continue;
      game.receiveNestDamage(game.nest.health);
      game.command({ type: "cheat-extinction" });
    }
    host.checkEnding();
    return {};
  }
  if (action.type !== "cheat-switch-tribe") return null;
  const colony = room.colonies.find(entry => entry.tribe === action.tribe);
  if (!colony || !room.games.has(colony.ownerId)) throw new Error("전환할 종족을 선택해 주세요.");
  room.games.get(colony.ownerId).checkEnding();
  room.hostId = colony.ownerId;
  return { colonyId: colony.id };
}

export function commandCheat(action, state, removeDeadAgents, checkEnding, spawnRaid) {
  if (action.type === "cheat-raid") return spawnRaid();
  if (!["cheat-evolution-points", "cheat-upgrade", "cheat-heal", "cheat-extinction"].includes(action.type)) return null;
  if (action.type === "cheat-evolution-points") {
    state.evolutionPoints += 10000;
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
