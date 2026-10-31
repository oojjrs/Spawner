export function creatureSpawnPose(agent, time) {
  const spawn = agent.spawn;
  if (!spawn || !["burrow", "water"].includes(spawn.kind) || agent.health <= 0 || agent.hidden ||
      !Number.isFinite(spawn.startedAt) || !Number.isFinite(spawn.readyAt) ||
      time < spawn.startedAt || time >= spawn.readyAt) return null;
  const progress = Math.max(0, Math.min(1, (time - spawn.startedAt) / (spawn.readyAt - spawn.startedAt)));
  return { kind: spawn.kind, progress,
    x: spawn.fromX + (agent.x - spawn.fromX) * progress, y: spawn.fromY + (agent.y - spawn.fromY) * progress };
}
