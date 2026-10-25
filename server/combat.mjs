import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { AGENT_ATTACK_DURATION, AGENT_ATTACK_HIT_TIME } from "./attack.mjs";
import { BEETLE_ANIMATIONS } from "./beetle-animation.mjs";
import { unitMovementSpeed, unitTerrainSpeedMultiplier } from "./attributes.mjs";

export const COMBAT_DISPOSITIONS = Object.freeze({ peaceful: "평화형", passive: "비선공", aggressive: "선공" });
export const PEACEFUL_ESCAPE_CHANCE = .8;
export const PEACEFUL_ESCAPE_INTERVAL = 1.5;
export const COMBAT_ESCAPE_GRACE = 2;

const species = new Map(ENCOUNTER_TYPES.map(type => [type.key, type]));

export function combatDisposition(agent) {
  const type = species.get(agent.species);
  let disposition = agent.combatDisposition || type?.combatDisposition;
  if (!disposition) disposition = agent.species === "spiny-back-beetle" ? "aggressive" : "passive";
  if (!Object.hasOwn(COMBAT_DISPOSITIONS, disposition)) disposition = "passive";
  return type?.unique && disposition === "peaceful" ? "passive" : disposition;
}

export function combatTeam(agent) {
  return agent.ownerId ? "colony:" + agent.ownerId : agent.species ? "species:" + agent.species : "agent:" + agent.id;
}

export function canPursueCombat(agent, target, time) {
  if (agent === target || combatTeam(agent) === combatTeam(target) || target.health <= 0 || target.hidden ||
      time < (agent.escapeUntil || 0) || time < (target.escapeUntil || 0) || combatDisposition(agent) === "peaceful") return false;
  if (agent.species && target.species) return false;
  if (target.combat) return target.combat.teams[1 - target.combat.side] === combatTeam(agent);
  return combatDisposition(agent) === "aggressive";
}

export function peacefulEscapeChance(suppression) {
  return PEACEFUL_ESCAPE_CHANCE * (1 - Math.max(0, Math.min(1, suppression || 0)));
}

export function createCombat(environment) {
  function entries() {
    return [...environment.games.values()].flatMap(game => game.agents.map(agent => ({ agent, game })))
      .concat((environment.creatureSystem?.agents || []).map(agent => ({ agent, game: null })));
  }

  function settled(agent, time) {
    return agent.health > 0 && !agent.hidden && !(agent.birth && time < agent.birth.readyAt) &&
      time + 1e-8 >= (agent.moveStartedAt || 0) + (agent.moveDuration || 0) && time >= (agent.escapeUntil || 0);
  }

  function members(combat) {
    return entries().filter(entry => entry.agent.health > 0 && entry.agent.combat?.id === combat.id &&
      entry.agent.x === combat.x && entry.agent.y === combat.y);
  }

  function attach(agent, combat, side, time) {
    const count = members(combat).filter(entry => entry.agent.combat.side === side).length;
    agent.combat = { id: combat.id, x: combat.x, y: combat.y, teams: [...combat.teams], side, joinedAt: time,
      nextEscapeAt: time + PEACEFUL_ESCAPE_INTERVAL };
    agent.renderFromX = agent.x; agent.renderFromY = agent.y;
    agent.moveDuration = 0; agent.moveBudget = 0;
    agent.attack = null; agent.attackTargetId = null;
    agent.attackReady = time + side * .15 + count * .12;
    agent.utility = null; agent.decisionPending = null;
    if (agent.foodDelivery?.receivedAt === null) agent.foodDelivery = null;
    agent.mode = "fight";
    agent.facing = side === 0 ? 1 : -1;
  }

  function release(agent, time) {
    agent.combat = null;
    agent.attack = null; agent.attackTargetId = null; agent.attackHit = true;
    if (agent.health <= 0) return;
    agent.utility = null; agent.decisionPending = "combatEnded";
    agent.mode = agent.species ? "idle" : "search";
    agent.nextActionAt = time; agent.nextDecisionAt = time;
    agent.animationStartedAt = time;
  }

  function finish(combat, time) {
    for (const { agent } of entries()) if (agent.combat?.id === combat.id) release(agent, time);
  }

  function engage(agent, target, time) {
    if (!settled(agent, time) || !settled(target, time) || agent.x !== target.x || agent.y !== target.y ||
        agent.combat || !canPursueCombat(agent, target, time)) return false;
    let combat = target.combat;
    if (combat) {
      const side = combat.teams.indexOf(combatTeam(agent));
      if (side < 0 || side === combat.side) return false;
      attach(agent, combat, side, time);
    } else {
      combat = { id: "combat:" + agent.id + ":" + time, x: agent.x, y: agent.y,
        teams: [combatTeam(agent), combatTeam(target)] };
      attach(agent, combat, 0, time);
      attach(target, combat, 1, time);
    }
    for (const { agent: ally } of entries()) {
      if (ally.combat || ally.x !== combat.x || ally.y !== combat.y || !settled(ally, time) || combatDisposition(ally) === "peaceful") continue;
      const side = combat.teams.indexOf(combatTeam(ally));
      if (side >= 0) attach(ally, combat, side, time);
    }
    return true;
  }

  function contact(agent, time) {
    if (!settled(agent, time)) return;
    const nearby = entries().map(entry => entry.agent).filter(other => other !== agent && other.x === agent.x && other.y === agent.y);
    for (const other of nearby) {
      if (other.combat && !agent.combat && combatDisposition(agent) !== "peaceful") {
        const side = other.combat.teams.indexOf(combatTeam(agent));
        if (side >= 0) { attach(agent, other.combat, side, time); return; }
      }
      if (engage(agent, other, time) || engage(other, agent, time)) return;
    }
  }

  function escape(agent, opponents, time) {
    const combat = agent.combat;
    combat.nextEscapeAt = time + PEACEFUL_ESCAPE_INTERVAL;
    const suppression = Math.max(0, ...opponents.map(entry => entry.agent.stats.escapeSuppression || 0));
    if ((environment.combatRandom || Math.random)() >= peacefulEscapeChance(suppression)) return false;
    const occupied = entries().filter(entry => entry.agent.health > 0 && entry.agent !== agent);
    const cells = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dy]) => ({ x: agent.x + dx, y: agent.y + dy }))
      .filter(cell => cell.x >= 0 && cell.y >= 0 && cell.x < 320 && cell.y < 320 &&
        environment.world.terrain[cell.y * 320 + cell.x] >= 2 && environment.world.terrain[cell.y * 320 + cell.x] <= 9 &&
        !environment.creatureSystem?.burrowAt?.(cell.x, cell.y) &&
        !environment.colonies.some(colony => environment.games.get(colony.ownerId)?.nest?.health !== 0 &&
          colony.occupiedCells.has((cell.x - colony.x) + "," + (cell.y - colony.y))) &&
        !occupied.some(entry => entry.agent.x === cell.x && entry.agent.y === cell.y ||
          time < entry.agent.moveStartedAt + entry.agent.moveDuration && entry.agent.renderFromX === cell.x && entry.agent.renderFromY === cell.y))
      .sort((a, b) => (environment.world.hazards?.[a.y * 320 + a.x] || 0) - (environment.world.hazards?.[b.y * 320 + b.x] || 0));
    if (!cells.length) return false;
    const destination = cells[0], from = { x: agent.x, y: agent.y };
    release(agent, time);
    agent.renderFromX = from.x; agent.renderFromY = from.y;
    agent.x = destination.x; agent.y = destination.y;
    agent.moveStartedAt = time;
    const speed = agent.species ? agent.stats.speed : unitMovementSpeed(agent.stats);
    agent.moveDuration = 1 / Math.max(.1, speed * unitTerrainSpeedMultiplier(agent, environment.world.terrain[agent.y * 320 + agent.x]));
    agent.escapeUntil = time + agent.moveDuration + COMBAT_ESCAPE_GRACE;
    agent.nextActionAt = time + agent.moveDuration;
    agent.nextDecisionAt = time + agent.moveDuration;
    agent.decisionPending = null;
    agent.mode = agent.species ? "walk" : "flee";
    agent.animationStartedAt = time;
    agent.stepCount = (agent.stepCount || 0) + 1;
    agent.lastDirection = { dx: destination.x - from.x, dy: destination.y - from.y };
    if (destination.x !== from.x) agent.facing = Math.sign(destination.x - from.x);
    if (!members(combat).some(entry => entry.agent.combat.side === combat.side)) finish(combat, time);
    return true;
  }

  function update(agent, time) {
    if (!agent.combat) contact(agent, time);
    const combat = agent.combat;
    if (!combat || agent.health <= 0) return false;
    if (agent.x !== combat.x || agent.y !== combat.y) { release(agent, time); return false; }
    let opponents = members(combat).filter(entry => entry.agent.combat.side !== combat.side);
    if (!opponents.length) { finish(combat, time); return false; }
    agent.moveBudget = 0;
    if (combatDisposition(agent) === "peaceful") {
      if (time + 1e-8 >= combat.nextEscapeAt && escape(agent, opponents, time)) return true;
      agent.mode = "fight";
      return true;
    }
    const attack = agent.attack;
    if (attack?.combatId === combat.id) {
      if (!attack.resolved && time + 1e-8 >= attack.hitAt) {
        attack.resolved = true;
        agent.attackHit = true;
        const target = opponents.find(entry => entry.agent.id === attack.targetId);
        if (target) {
          attack.hit = true;
          if (target.game) target.game.receiveDamage(target.agent, attack.damage);
          else environment.creatureSystem.receiveDamage(target.agent, attack.damage);
        }
      }
      opponents = members(combat).filter(entry => entry.agent.combat.side !== combat.side);
      if (!opponents.length) { finish(combat, time); return true; }
      if (time + 1e-8 < attack.endsAt) return true;
      agent.attack = null;
    }
    agent.mode = agent.species === "spiny-back-beetle" ? "idle" : "fight";
    if (time + 1e-8 < agent.attackReady) return true;
    const target = opponents.toSorted((a, b) => a.agent.combat.joinedAt - b.agent.combat.joinedAt || String(a.agent.id).localeCompare(String(b.agent.id)))[0].agent;
    const beetle = agent.species === "spiny-back-beetle", speed = Math.max(.1, agent.stats.speed);
    const duration = beetle ? BEETLE_ANIMATIONS.attack.durationMs / 1000 : AGENT_ATTACK_DURATION / speed;
    const hitTime = beetle ? BEETLE_ANIMATIONS.attack.hitTimeMs / 1000 : AGENT_ATTACK_HIT_TIME / speed;
    agent.attack = { combatId: combat.id, startedAt: time, speed: beetle ? 1 : speed, hitAt: time + hitTime,
      endsAt: time + duration, targetId: target.id, targetKind: "agent", targetX: combat.x, targetY: combat.y,
      directionX: combat.side === 0 ? 1 : -1, damage: agent.stats.attack, resolved: false, hit: false };
    agent.attackReady = time + duration + (beetle ? .8 : 0);
    agent.attackStartedAt = time; agent.animationStartedAt = time;
    agent.attackTargetId = target.id; agent.attackHit = false;
    if (beetle) agent.mode = "attack";
    return true;
  }

  return { update, engage };
}
