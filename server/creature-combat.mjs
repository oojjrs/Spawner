import { combatDisposition } from "./combat.mjs";
import { militaryAgent } from "./conquest-pacing.mjs";
import { burrowDistance } from "./burrows.mjs";
import { BEETLE_ANIMATIONS } from "./beetle-animation.mjs";
import { CREATURE_ATTACK_TIMINGS } from "./creature-attack.mjs";

export function creatureBuildingTargets(environment) {
  return [...environment.games.values()].flatMap(game => [game.nest, ...(game.buildings || [])]
    .filter(target => target?.health > 0).map(agent => ({ game, agent })));
}

export function compareCreatureCombatTargets(left, right) {
  const building = target => ["nest", "building"].includes(target.kind);
  return Number(building(left.agent)) - Number(building(right.agent)) ||
    Number(militaryAgent(right.agent, right.agent.tribe)) - Number(militaryAgent(left.agent, left.agent.tribe)) ||
    left.distance - right.distance ||
    String(left.agent.id).localeCompare(String(right.agent.id));
}

export function updateCreatureBuildingAttack(agent, target, time) {
  const buildingAttack = ["nest", "building"].includes(agent.attack?.targetKind) || agent.mode === "attack" && !agent.combat;
  const eligible = combatDisposition(agent) === "aggressive" && target?.agent.health > 0 &&
    ["nest", "building"].includes(target.agent.kind) && burrowDistance(agent, target.agent) <= 1;
  if (buildingAttack && (!eligible || agent.attackTargetId !== target.agent.id)) {
    agent.attack = null; agent.attackTargetId = null; agent.attackHit = true;
    agent.mode = "idle"; agent.nextActionAt = time;
  }
  if (!eligible) return false;
  const timing = CREATURE_ATTACK_TIMINGS[agent.species] || BEETLE_ANIMATIONS.attack;
  if (!agent.attack) {
    const restoring = agent.mode === "attack" && agent.attackTargetId === target.agent.id;
    if (!restoring && time + 1e-8 < (agent.attackReadyAt || 0)) return true;
    const startedAt = restoring ? agent.attackStartedAt : time;
    const directionX = Math.sign(target.agent.x + target.agent.width / 2 - agent.x - .5) || agent.facing;
    agent.attack = { startedAt, speed: 1, hitAt: startedAt + timing.hitTimeMs / 1000,
      endsAt: startedAt + timing.durationMs / 1000, targetId: target.agent.id, targetKind: target.agent.kind,
      targetX: target.agent.x, targetY: target.agent.y, directionX, damage: agent.stats.attack,
      hit: restoring && agent.attackHit };
    agent.mode = "attack"; agent.attackStartedAt = startedAt; agent.animationStartedAt = startedAt;
    agent.attackTargetId = target.agent.id; agent.attackHit = agent.attack.hit; agent.facing = directionX;
    agent.attackReadyAt = agent.attack.endsAt + .8;
  }
  const attack = agent.attack;
  if (!attack.hit && time + 1e-8 >= attack.hitAt) {
    attack.hit = true; agent.attackHit = true;
    target.agent.health = target.agent.kind === "nest" ? target.game.receiveNestDamage(attack.damage) :
      target.game.receiveBuildingDamage(target.agent.id, attack.damage);
  }
  if (time + 1e-8 >= attack.endsAt) {
    agent.attack = null; agent.attackTargetId = null; agent.mode = "idle";
    agent.animationStartedAt = time; agent.nextActionAt = agent.attackReadyAt;
  }
  return true;
}
