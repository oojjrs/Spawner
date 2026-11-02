import { combatDamage } from "./combat-stats.mjs";
import { unitTravelSpeed } from "./attributes.mjs";

export const RETREAT_RECOVERY_RATIO = .7;
export const RETREAT_SAFE_SECONDS = 5;
export const RETREAT_ESCAPE_CHANCE = .15;

export function survivalState(agent, damage) {
  if (damage > 0 && (damage >= agent.health * .85 || agent.health <= agent.stats.health * .3)) return "critical";
  if (agent.health < agent.stats.health * .6 || damage >= agent.health * .35) return "caution";
  return "stable";
}

export function beginRetreat(agent, time) {
  if (!agent.retreat) agent.retreat = { startedAt: time, recoverHealth: Math.max(agent.health,
    agent.stats.health * RETREAT_RECOVERY_RATIO), safeSince: null, attempts: 0 };
}

export function updateRetreat(agent, time, threatened) {
  if (!agent.retreat) return false;
  if (threatened || agent.health < agent.retreat.recoverHealth) {
    agent.retreat.safeSince = null;
    return false;
  }
  if (agent.retreat.safeSince === null) agent.retreat.safeSince = time;
  if (time - agent.retreat.safeSince < RETREAT_SAFE_SECONDS) return false;
  agent.retreat = null;
  return true;
}

export function combatSurvival(agent, opponents, allies) {
  const incoming = opponents.map(enemy => combatDamage(enemy, agent, 1));
  const target = opponents[0];
  const hits = target && opponents.length === 1 && target.health <= combatDamage(agent, target, 0) ? 1 : 2;
  const strongest = Math.max(0, ...incoming);
  const supporters = allies;
  const damage = strongest * hits + (incoming.reduce((sum, value) => sum + value, 0) - strongest) / Math.max(1, supporters.length);
  const power = (unit, enemy) => Math.sqrt(Math.max(0, unit.health) * combatDamage(unit, enemy));
  const ownPower = target ? supporters.reduce((sum, ally) => sum + power(ally, target), 0) : 0;
  const enemyPower = opponents.reduce((sum, enemy) => sum + power(enemy, agent), 0);
  const state = survivalState(agent, damage);
  return { state, damage, retreat: damage > 0 && (state === "critical" || state === "caution" &&
    (agent.health < agent.stats.health * .5 || enemyPower > ownPower * 1.25)) };
}

export function retreatEscapeChance(agent, opponents) {
  const speed = unit => unit.species ? unit.stats.speed : unitTravelSpeed(unit, unit.carrying);
  const fastest = Math.max(.1, ...opponents.map(speed));
  const suppression = Math.max(0, ...opponents.map(enemy => enemy.stats.escapeSuppression || 0));
  return Math.max(.05, Math.min(.25, RETREAT_ESCAPE_CHANCE + .1 * (speed(agent) / fastest - 1))) *
    (1 - Math.max(0, Math.min(1, suppression)));
}
