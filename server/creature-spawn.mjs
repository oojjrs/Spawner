export const CREATURE_SPAWN_DURATIONS = Object.freeze({
  burrow: 1.2, water: .9
});

export function beginCreatureSpawn(agent, time, kind, origin) {
  const duration = CREATURE_SPAWN_DURATIONS[kind];
  if (!(duration > 0)) return;
  agent.spawn = { kind, startedAt: time, readyAt: time + duration, fromX: origin.x, fromY: origin.y };
  agent.mode = "spawn";
  agent.animationStartedAt = time;
  agent.nextActionAt = Math.max(agent.nextActionAt || 0, agent.spawn.readyAt);
}

export function creatureSpawning(agent, time) {
  return !!agent.spawn && Number.isFinite(agent.spawn.startedAt) && Number.isFinite(agent.spawn.readyAt) &&
    time >= agent.spawn.startedAt && time < agent.spawn.readyAt;
}
