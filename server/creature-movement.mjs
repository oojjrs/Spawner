import { CREATURE_MOVEMENT_PROFILES } from "./creature-movement-profiles.mjs";
import { unitTerrainSpeedMultiplier } from "./attributes.mjs";

export const CREATURE_MOVEMENT = CREATURE_MOVEMENT_PROFILES;

export function applyCreatureMovement(agent) {
  const movement = CREATURE_MOVEMENT[agent.species];
  agent.stats.speed = movement.speed;
  if (agent.returningHome) agent.nextActionAt = agent.moveStartedAt + agent.moveDuration;
  else if (agent.stepCount > 0 && ["idle", "walk"].includes(agent.mode))
    agent.nextActionAt = Math.max(agent.nextActionAt, agent.moveStartedAt + agent.moveDuration + movement.restSeconds);
}

export function creatureMoveDuration(agent, terrain) {
  return 1 / (agent.stats.speed * unitTerrainSpeedMultiplier(agent, terrain));
}

export function finishCreatureMove(agent, time) {
  const endsAt = agent.moveStartedAt + agent.moveDuration;
  if (agent.mode !== "walk" || time < endsAt) return;
  agent.mode = "idle";
  agent.animationStartedAt = endsAt;
  agent.nextActionAt = agent.returningHome ? endsAt : Math.max(agent.nextActionAt, endsAt + CREATURE_MOVEMENT[agent.species].restSeconds);
}
