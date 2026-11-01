import { worldSize } from "./world-size.mjs";
import { creatureSpawning } from "./creature-spawn.mjs";
import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { AGENT_ATTACK_DURATION, AGENT_ATTACK_HIT_TIME, AGENT_HURT_DURATION } from "./attack.mjs";
import { BEETLE_ANIMATIONS } from "./beetle-animation.mjs";
import { CREATURE_ATTACK_TIMINGS } from "./creature-attack.mjs";
import { unitTravelSpeed, unitTerrainSpeedMultiplier } from "./attributes.mjs";
import { combatDamage, combatStrength } from "./combat-stats.mjs";
import { recordCombatExperience } from "./experience.mjs";
import { buildingAt } from "./buildings.mjs";
import { beginRetreat, combatSurvival, retreatEscapeChance } from "./survival.mjs";

export const COMBAT_DISPOSITIONS = Object.freeze({ peaceful: "평화형", passive: "비선공", aggressive: "선공" });
export const PEACEFUL_ESCAPE_CHANCE = .8;
export const PEACEFUL_ESCAPE_INTERVAL = 1.5;
export const COMBAT_ESCAPE_GRACE = 2;
export const COMBAT_RETREAT_EXCHANGES = 2;
export const COMBAT_EXCHANGE_PAUSE = .2;
export const COMBAT_TURN_ORDER_VERSION = 1;
export const COMBAT_EXCHANGE_DAMAGE_VERSION = 5;
export const REGENERATION_DURATION = 1.2;

const species = new Map(ENCOUNTER_TYPES.map(type => [type.key, type]));

export function combatDisposition(agent) {
  const type = species.get(agent.species);
  let disposition = agent.combatDisposition || type?.combatDisposition;
  if (!disposition) disposition = agent.species === "spiny-back-beetle" ? "aggressive" : "passive";
  if (!Object.hasOwn(COMBAT_DISPOSITIONS, disposition)) disposition = "passive";
  return type?.unique && disposition === "peaceful" ? "passive" : disposition;
}

function peacefulCreature(agent) {
  return !agent.ownerId && species.get(agent.species)?.combatDisposition === "peaceful" && combatDisposition(agent) === "peaceful";
}

export function combatTeam(agent) {
  return agent.ownerId ? "colony:" + agent.ownerId : agent.species ? "species:" + agent.species : "agent:" + agent.id;
}

export function canPursueCombat(agent, target, time) {
  if (agent === target || combatTeam(agent) === combatTeam(target) || target.health <= 0 || target.hidden ||
      creatureSpawning(agent, time) || creatureSpawning(target, time) ||
      time < (agent.escapeUntil || 0) || time < (target.escapeUntil || 0) || agent.retreat || agent.construction?.state === "transforming" || combatDisposition(agent) === "peaceful") return false;
  if (agent.species && target.species) return false;
  if (target.combat) return target.combat.teams[1 - target.combat.side] === combatTeam(agent);
  return combatDisposition(agent) === "aggressive";
}

export function peacefulEscapeChance(suppression) {
  return PEACEFUL_ESCAPE_CHANCE * (1 - Math.max(0, Math.min(1, suppression || 0)));
}

export function createCombat(environment) {
  const size = worldSize(environment.world);
  function entries() {
    if (environment.unitIndex) return environment.unitIndex.entries();
    return [...environment.games.values()].flatMap(game => game.agents.map(agent => ({ agent, game })))
      .concat((environment.creatureSystem?.agents || []).map(agent => ({ agent, game: null })));
  }

  function entriesAt(x, y) {
    return environment.unitIndex ? environment.unitIndex.at(x, y) : entries().filter(entry => entry.agent.x === x && entry.agent.y === y);
  }

  function settled(agent, time) {
    return agent.health > 0 && !agent.hidden && !creatureSpawning(agent, time) && !(agent.birth && time < agent.birth.readyAt) &&
      time + 1e-8 >= (agent.moveStartedAt || 0) + (agent.moveDuration || 0) && time >= (agent.escapeUntil || 0);
  }

  function members(combat) {
    return entriesAt(combat.x, combat.y).filter(entry => entry.agent.health > 0 && entry.agent.combat?.id === combat.id &&
      entry.agent.x === combat.x && entry.agent.y === combat.y);
  }

  function attach(agent, combat, side, time) {
    agent.combat = { id: combat.id, x: combat.x, y: combat.y, teams: [...combat.teams], side, joinedAt: time,
      turnOrderVersion: COMBAT_TURN_ORDER_VERSION,
      turn: combat.turn || 0, nextAttackTurn: (combat.turn || 0) + 1,
      nextEscapeAt: time + PEACEFUL_ESCAPE_INTERVAL, completedExchanges: 0 };
    agent.renderFromX = agent.x; agent.renderFromY = agent.y;
    agent.moveDuration = 0; agent.moveBudget = 0;
    agent.attack = null; agent.attackTargetId = null;
    agent.support = null;
    agent.attackReady = time;
    agent.utility = null; agent.decisionPending = null;
    if (agent.foodDelivery?.receivedAt === null) agent.foodDelivery = null;
    agent.mode = agent.construction?.state === "transforming" ? "transform" : "fight";
    agent.facing = side === 0 ? -1 : 1;
    environment.unitIndex?.update(agent);
  }

  function release(agent, time) {
    agent.combat = null;
    agent.support = null;
    agent.attack = null; agent.attackTargetId = null; agent.attackHit = true;
    if (agent.health <= 0) return;
    agent.utility = null; agent.decisionPending = "combatEnded";
    agent.mode = agent.species ? "idle" : "search";
    agent.nextActionAt = time; agent.nextDecisionAt = time;
    agent.animationStartedAt = time;
  }

  function finish(combat, time) {
    for (const { agent } of entriesAt(combat.x, combat.y)) if (agent.combat?.id === combat.id) release(agent, time);
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
    for (const { agent: ally } of entriesAt(combat.x, combat.y)) {
      if (ally.combat || ally.x !== combat.x || ally.y !== combat.y || !settled(ally, time) || ally.retreat || combatDisposition(ally) === "peaceful") continue;
      const side = combat.teams.indexOf(combatTeam(ally));
      if (side >= 0) attach(ally, combat, side, time);
    }
    return true;
  }

  function contact(agent, time) {
    if (!settled(agent, time)) return;
    const nearby = entriesAt(agent.x, agent.y).map(entry => entry.agent).filter(other => other !== agent);
    for (const other of nearby) {
      if (other.combat && !agent.combat && !agent.retreat && combatDisposition(agent) !== "peaceful") {
        const side = other.combat.teams.indexOf(combatTeam(agent));
        if (side >= 0) { attach(agent, other.combat, side, time); return; }
      }
      if (engage(agent, other, time) || engage(other, agent, time)) return;
    }
  }

  function escapeCells(agent, time, retreating) {
    const threats = entries().map(entry => entry.agent).filter(enemy => enemy.health > 0 && !enemy.hidden &&
      combatTeam(enemy) !== combatTeam(agent) && Math.abs(enemy.x - agent.x) + Math.abs(enemy.y - agent.y) <= agent.stats.vision &&
      (enemy.combat?.id === agent.combat.id || !enemy.retreat && combatDisposition(enemy) === "aggressive"));
    const danger = cell => (environment.world.hazards?.[cell.y * size + cell.x] ? .9 : 0) + threats.reduce((sum, enemy) => {
      const speed = enemy.species ? enemy.stats.speed : unitTravelSpeed(enemy, enemy.carrying);
      const distance = Math.abs(cell.x - enemy.x) + Math.abs(cell.y - enemy.y);
      return sum + combatDamage(enemy, agent, 1) * Math.max(0, 1 - distance / Math.max(1, speed * 3));
    }, 0);
    const staying = combatSurvival(agent, threats, [agent]).damage;
    const occupied = environment.unitIndex ? null : entries().filter(entry => entry.agent.health > 0 && entry.agent !== agent);
    return [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dy]) => ({ x: agent.x + dx, y: agent.y + dy }))
      .filter(cell => cell.x >= 0 && cell.y >= 0 && cell.x < size && cell.y < size &&
        environment.world.terrain[cell.y * size + cell.x] >= 2 && environment.world.terrain[cell.y * size + cell.x] <= 10 &&
        !environment.creatureSystem?.burrowAt?.(cell.x, cell.y) &&
        !buildingAt(environment, cell.x, cell.y) &&
        !environment.colonies.some(colony => environment.games.get(colony.ownerId)?.nest?.health !== 0 &&
          colony.occupiedCells.has((cell.x - colony.x) + "," + (cell.y - colony.y))) &&
        !(environment.unitIndex ? environment.unitIndex.occupied(cell.x, cell.y, agent, true) : occupied.some(entry => entry.agent.x === cell.x && entry.agent.y === cell.y ||
          time < entry.agent.moveStartedAt + entry.agent.moveDuration && entry.agent.renderFromX === cell.x && entry.agent.renderFromY === cell.y)))
      .filter(cell => !retreating || danger(cell) <= staying)
      .sort((a, b) => danger(a) - danger(b));
  }

  function escape(agent, opponents, time, retreating) {
    const combat = agent.combat;
    combat.nextEscapeAt = time + PEACEFUL_ESCAPE_INTERVAL;
    const cells = escapeCells(agent, time, retreating);
    if (!cells.length) return false;
    const suppression = Math.max(0, ...opponents.map(entry => entry.agent.stats.escapeSuppression || 0));
    const chance = retreating ? retreatEscapeChance(agent, opponents.map(entry => entry.agent)) : peacefulEscapeChance(suppression);
    if (retreating) agent.retreat.attempts++;
    if ((environment.combatRandom || Math.random)() >= chance) return false;
    if (agent.ownerId) beginRetreat(agent, time);
    const destination = cells[0], from = { x: agent.x, y: agent.y };
    release(agent, time);
    agent.renderFromX = from.x; agent.renderFromY = from.y;
    agent.x = destination.x; agent.y = destination.y;
    agent.moveStartedAt = time;
    const speed = agent.species ? agent.stats.speed : unitTravelSpeed(agent, agent.carrying);
    agent.moveDuration = 1 / Math.max(.1, speed * unitTerrainSpeedMultiplier(agent, environment.world.terrain[agent.y * size + agent.x]));
    agent.escapeUntil = time + agent.moveDuration + COMBAT_ESCAPE_GRACE;
    environment.unitIndex?.update(agent);
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

  function hurtDuration(agent) {
    return agent.species === "spiny-back-beetle" ? BEETLE_ANIMATIONS.hurt.durationMs / 1000 : AGENT_HURT_DURATION;
  }

  function attackTiming(agent) {
    return CREATURE_ATTACK_TIMINGS[agent.species] || (agent.species === "spiny-back-beetle" ? BEETLE_ANIMATIONS.attack :
      { durationMs: AGENT_ATTACK_DURATION * 1000, hitTimeMs: AGENT_ATTACK_HIT_TIME * 1000 });
  }

  function createExchange(attacker, target, previous) {
    const old = previous?.exchange, random = environment.damageRandom || Math.random;
    const attackApplied = !!old?.attackApplied || !!previous?.counter || !!previous?.resolved;
    const counterApplied = target.construction?.state === "transforming" || !!old?.counterApplied || !!previous?.counterResolved || !!previous?.counter && !!previous?.resolved;
    const attackDamage = old?.attackDamage ?? previous?.damage;
    const counterDamage = old?.counterDamage ?? (previous?.counter ? previous.damage : 0);
    const beforeAttacker = { ...attacker, health: Math.min(attacker.stats.health,
      attacker.health + (counterApplied && Number.isFinite(counterDamage) ? counterDamage : 0)) };
    const beforeTarget = { ...target, health: Math.min(target.stats.health,
      target.health + (attackApplied && Number.isFinite(attackDamage) ? attackDamage : 0)) };
    const timing = attackTiming(target);
    return { damageVersion: COMBAT_EXCHANGE_DAMAGE_VERSION, attackerId: attacker.id, targetId: target.id,
      targetSpecies: target.species || null,
      attackerHealth: beforeAttacker.health, targetHealth: beforeTarget.health,
      attackerStrength: combatStrength(beforeAttacker), targetStrength: combatStrength(beforeTarget),
      attackDamage: attackApplied || old?.damageVersion === 2 ? attackDamage : combatDamage(beforeAttacker, beforeTarget, random()),
      counterDamage: target.construction?.state === "transforming" ? 0 : counterApplied || old?.damageVersion === 2 ? counterDamage : combatDamage(beforeTarget, beforeAttacker, random()),
      counterHitTime: timing.hitTimeMs / 1000,
      counterDuration: timing.durationMs / 1000,
      attackApplied, counterApplied, resolved: attackApplied && counterApplied };
  }

  function completeExchange(combat, exchange) {
    for (const { agent } of members(combat)) {
      if (agent.id === exchange.attackerId || agent.id === exchange.targetId)
        agent.combat.completedExchanges = (agent.combat.completedExchanges || 0) + 1;
    }
  }

  function receiveDamage(entry, damage, attacker) {
    const previousHealth = entry.agent.health;
    if (entry.game) entry.game.receiveDamage(entry.agent, damage);
    else environment.creatureSystem.receiveDamage(entry.agent, damage);
    recordCombatExperience(attacker, entry.agent, Math.max(0, previousHealth - entry.agent.health),
      entry.agent.health <= 0 ? entries().map(entry => entry.agent) : []);
  }

  function resolveHit(attack, target, attacker) {
    const exchange = attack.exchange, applied = attack.counter ? "counterApplied" : "attackApplied";
    if (exchange[applied]) return;
    attack.damage = exchange[attack.counter ? "counterDamage" : "attackDamage"];
    exchange[applied] = true;
    receiveDamage(target, attack.damage, attacker);
    exchange.resolved = exchange.attackApplied && exchange.counterApplied;
  }

  function beginAttack(attacker, target, time, exchange, counter) {
    const beetle = attacker.species === "spiny-back-beetle";
    const timing = attackTiming(attacker), duration = timing.durationMs / 1000, hitTime = timing.hitTimeMs / 1000;
    attacker.attack = { combatId: attacker.combat.id, startedAt: time, speed: 1, hitAt: time + hitTime,
      endsAt: time + duration, exchangeEndsAt: time + Math.max(duration, hitTime + hurtDuration(target)) + COMBAT_EXCHANGE_PAUSE,
      targetId: target.id, targetKind: "agent", targetX: attacker.combat.x, targetY: attacker.combat.y,
      directionX: attacker.combat.side === 0 ? -1 : 1,
      damage: counter ? exchange.counterDamage : exchange.attackDamage, exchange, counter, resolved: false, hit: false };
    attacker.attackReady = attacker.attack.exchangeEndsAt;
    attacker.attackStartedAt = time; attacker.animationStartedAt = time;
    attacker.attackTargetId = target.id; attacker.attackHit = false;
    attacker.mode = beetle ? "attack" : "fight";
  }

  function refreshSupport(participants) {
    for (const side of [0, 1]) {
      const allies = participants.filter(entry => entry.agent.combat.side === side);
      const guard = Math.max(0, ...allies.map(entry => entry.agent.construction?.state === "transforming" ? 0 : entry.agent.stats.guardProtection || 0));
      for (const { agent } of allies) {
        agent.combat.guardProtection = guard;
      }
    }
  }

  function updateRegeneration(agent, time) {
    if (!(agent.stats.healing > 0) || !settled(agent, time) || agent.construction || agent.retreat ||
        agent.attack && time < agent.attack.endsAt) {
      agent.support = null;
      return false;
    }
    const allies = entriesAt(agent.x, agent.y).map(entry => entry.agent).filter(target => target !== agent &&
      combatTeam(target) === combatTeam(agent) && !target.combat && !target.construction && settled(target, time));
    if (agent.support?.kind === "heal") {
      const support = agent.support, target = allies.find(target => target.id === support.targetId);
      if (!target) { agent.support = null; return false; }
      if (!support.applied && time + 1e-8 >= support.hitAt) {
        support.applied = true;
        target.health = Math.min(target.stats.health, target.health + agent.stats.healing);
      }
      if (time + 1e-8 < support.endsAt) return true;
      agent.support = null;
    }
    const target = allies.filter(target => target.health < target.stats.health)
      .sort((a, b) => a.health / a.stats.health - b.health / b.stats.health || String(a.id).localeCompare(String(b.id)))[0];
    if (!target) return false;
    agent.support = { kind: "heal", targetId: target.id, startedAt: time,
      hitAt: time + .45, endsAt: time + REGENERATION_DURATION, applied: false };
    agent.moveBudget = 0;
    agent.mode = "rest";
    agent.animationStartedAt = time;
    return true;
  }

  function update(agent, time) {
    if (!agent.combat) contact(agent, time);
    const combat = agent.combat;
    if (agent.health <= 0) return false;
    if (!combat) return updateRegeneration(agent, time);
    if (agent.x !== combat.x || agent.y !== combat.y) { release(agent, time); return false; }
    const currentMembers = members(combat);
    refreshSupport(currentMembers);
    for (const { agent: member } of currentMembers) member.support = null;
    const pendingOwner = entriesAt(combat.x, combat.y).find(entry => entry.agent.combat?.id === combat.id && entry.agent.combat.pendingCounter);
    if (pendingOwner) {
      const pending = pendingOwner.agent.combat.pendingCounter;
      const team = pendingOwner.agent.combat.teams[1 - pendingOwner.agent.combat.side];
      const targetSpecies = pending.exchange.targetSpecies || (team.startsWith("species:") ? team.slice(8) : null);
      const timing = CREATURE_ATTACK_TIMINGS[targetSpecies];
      if (timing) {
        pending.startedAt ??= pending.hitAt - pending.exchange.counterHitTime;
        pending.exchange.targetSpecies = targetSpecies;
        pending.exchange.counterHitTime = timing.hitTimeMs / 1000;
        pending.exchange.counterDuration = timing.durationMs / 1000;
        pending.hitAt = pending.startedAt + pending.exchange.counterHitTime;
        pending.endsAt = pending.startedAt + Math.max(pending.exchange.counterDuration,
          pending.exchange.counterHitTime + hurtDuration(pendingOwner.agent)) + COMBAT_EXCHANGE_PAUSE;
      }
      if (!pending.resolved && time + 1e-8 >= pending.hitAt) {
        pending.resolved = true;
        if (!pending.exchange.counterApplied) {
          pending.exchange.counterApplied = true;
          pending.exchange.resolved = true;
          const source = entries().find(entry => entry.agent.id === pending.exchange.targetId)?.agent || { id: pending.exchange.targetId };
          receiveDamage(pendingOwner, pending.exchange.counterDamage, source);
        }
      }
      if (time + 1e-8 < pending.endsAt) return true;
      completeExchange(combat, pending.exchange);
      if (pendingOwner.agent.combat) delete pendingOwner.agent.combat.pendingCounter;
      if (agent.health <= 0) return true;
    }
    let participants = members(combat);
    let opponents = participants.filter(entry => entry.agent.combat.side !== combat.side);
    agent.moveBudget = 0;
    agent.facing = combat.side === 0 ? -1 : 1;
    agent.mode = agent.construction?.state === "transforming" ? "transform" : agent.species === "spiny-back-beetle" ? agent.attack ? "attack" : "idle" : "fight";
    const attacks = participants.filter(entry => entry.agent.attack?.combatId === combat.id)
      .sort((a, b) => a.agent.attack.startedAt - b.agent.attack.startedAt ||
        a.agent.combat.side - b.agent.combat.side || String(a.agent.id).localeCompare(String(b.agent.id)));
    for (const { agent: member } of attacks.slice(1)) {
      if (member.attack.resolved && member.attack.targetId === attacks[0].agent.id &&
          attacks[0].agent.attack.targetId === member.id) attacks[0].agent.attack.counterResolved = true;
      member.attack = null;
      member.attackTargetId = null;
      member.mode = member.species === "spiny-back-beetle" ? "idle" : "fight";
    }
    if (participants.some(entry => entry.agent.combat.turnOrderVersion !== COMBAT_TURN_ORDER_VERSION ||
        !Number.isFinite(entry.agent.combat.nextAttackTurn))) {
      const turn = Math.max(0, ...participants.map(entry => Number.isFinite(entry.agent.combat.turn) ? entry.agent.combat.turn : 0));
      for (const { agent: member } of participants) {
        member.combat.turnOrderVersion = COMBAT_TURN_ORDER_VERSION;
        member.combat.turn = turn;
        member.combat.nextAttackTurn = turn + (member === attacks[0]?.agent ? 2 : 1);
      }
    }
    if (attacks.length) {
      const attacker = attacks[0], attack = attacker.agent.attack;
      const target = participants.find(entry => entry.agent.id === attack.targetId &&
        entry.agent.combat.side !== attacker.agent.combat.side);
      if (target && attack.exchange?.damageVersion !== COMBAT_EXCHANGE_DAMAGE_VERSION) {
        attack.exchange = attack.counter ? createExchange(target.agent, attacker.agent, attack) :
          createExchange(attacker.agent, target.agent, attack);
        attack.damage = attack.counter ? attack.exchange.counterDamage : attack.exchange.attackDamage;
      }
      const timing = CREATURE_ATTACK_TIMINGS[attacker.agent.species];
      if (timing) {
        const hitAt = attack.startedAt + timing.hitTimeMs / 1000, endsAt = attack.startedAt + timing.durationMs / 1000;
        if (attack.hitAt !== hitAt || attack.endsAt !== endsAt) {
          attack.hitAt = hitAt;
          attack.endsAt = endsAt;
          attack.exchangeEndsAt = Math.max(endsAt, hitAt + hurtDuration(target?.agent || {}),
            attack.resolved && Number.isFinite(target?.agent.hurtStartedAt) ?
              target.agent.hurtStartedAt + hurtDuration(target.agent) : -Infinity) + COMBAT_EXCHANGE_PAUSE;
          attacker.agent.attackReady = attack.exchangeEndsAt;
        }
      }
      if (attack.exchange) {
        const team = attacker.agent.combat.teams[1 - attacker.agent.combat.side];
        attack.exchange.targetSpecies ??= attack.counter ? attacker.agent.species || null :
          target?.agent.species || (team.startsWith("species:") ? team.slice(8) : null);
        const counterTiming = CREATURE_ATTACK_TIMINGS[attack.exchange.targetSpecies];
        if (counterTiming) {
          attack.exchange.counterHitTime = counterTiming.hitTimeMs / 1000;
          attack.exchange.counterDuration = counterTiming.durationMs / 1000;
        }
      }
      attack.exchangeEndsAt ??= Math.max(attack.endsAt, attack.hitAt + hurtDuration(target?.agent || {})) + COMBAT_EXCHANGE_PAUSE;
      if (!attack.resolved && time + 1e-8 >= attack.hitAt) {
        attack.resolved = true;
        attacker.agent.attackHit = true;
        if (target) {
          attack.hit = true;
          resolveHit(attack, target, attacker.agent);
          attack.exchangeEndsAt = Math.max(attack.exchangeEndsAt, time + hurtDuration(target.agent) + COMBAT_EXCHANGE_PAUSE);
        }
      }
      if (time + 1e-8 < attack.exchangeEndsAt) return true;
      attacker.agent.attack = null;
      attacker.agent.attackTargetId = null;
      attacker.agent.mode = attacker.agent.species === "spiny-back-beetle" ? "idle" : "fight";
      attacker.agent.animationStartedAt = attack.endsAt;
      participants = members(combat);
      const counter = participants.find(entry => entry.agent.id === attack.exchange?.targetId);
      const original = participants.find(entry => entry.agent.id === attack.exchange?.attackerId);
      if (!attack.counter && attack.hit && counter && original && counter.agent.construction?.state !== "transforming") {
        beginAttack(counter.agent, original.agent, time, attack.exchange, true);
        return true;
      }
      if (!attack.counter && attack.hit && original && !attack.exchange.counterApplied &&
          Number.isFinite(attack.exchange.counterDamage)) {
        original.agent.combat.pendingCounter = { exchange: attack.exchange,
          startedAt: time,
          hitAt: time + attack.exchange.counterHitTime,
          endsAt: time + Math.max(attack.exchange.counterDuration,
            attack.exchange.counterHitTime + hurtDuration(original.agent)) + COMBAT_EXCHANGE_PAUSE,
          resolved: false };
        return true;
      }
      if (attack.exchange?.resolved) completeExchange(combat, attack.exchange);
    }
    participants = members(combat);
    for (const entry of participants) {
      if (!entry.agent.combat || !peacefulCreature(entry.agent) || time + 1e-8 < entry.agent.combat.nextEscapeAt) continue;
      const enemies = members(combat).filter(other => other.agent.combat.side !== entry.agent.combat.side);
      if (enemies.length) escape(entry.agent, enemies, time, false);
    }
    if (!agent.combat) return true;
    participants = members(combat);
    opponents = participants.filter(entry => entry.agent.combat.side !== combat.side);
    if (!opponents.length) { finish(combat, time); return true; }
    const hurtEndsAt = Math.max(...participants.map(entry =>
      Number.isFinite(entry.agent.hurtStartedAt) ? entry.agent.hurtStartedAt + hurtDuration(entry.agent) : -Infinity));
    if (time + 1e-8 < hurtEndsAt + COMBAT_EXCHANGE_PAUSE) return true;
    if (time + 1e-8 < Math.max(...participants.map(entry => entry.agent.attackReady || 0))) return true;
    const contenders = participants.filter(entry => entry.agent.construction?.state !== "transforming" && !peacefulCreature(entry.agent)).sort((a, b) => {
      const difference = a.agent.combat.nextAttackTurn - b.agent.combat.nextAttackTurn;
      return Math.abs(difference) > 1e-8 ? difference : a.agent.combat.side - b.agent.combat.side ||
        a.agent.combat.joinedAt - b.agent.combat.joinedAt || String(a.agent.id).localeCompare(String(b.agent.id));
    });
    if (!contenders.length) return true;
    const attacker = contenders[0].agent;
    const enemies = participants.filter(entry => entry.agent.combat.side !== attacker.combat.side);
    if (attacker.ownerId) {
      const allies = participants.filter(entry => entry.agent.combat.side === attacker.combat.side);
      const assessment = combatSurvival(attacker, enemies.map(entry => entry.agent), allies.map(entry => entry.agent));
      attacker.survivalState = assessment.state;
      if (assessment.retreat) beginRetreat(attacker, time);
      if (attacker.retreat && (attacker.combat.completedExchanges || 0) >= COMBAT_RETREAT_EXCHANGES &&
          escapeCells(attacker, time, true).length) {
        const turn = attacker.combat.nextAttackTurn;
        for (const { agent: member } of participants) member.combat.turn = turn;
        attacker.combat.nextAttackTurn += 1;
        if (!escape(attacker, enemies, time, true)) {
          for (const { agent: member } of participants) member.attackReady = time + COMBAT_EXCHANGE_PAUSE;
        }
        return true;
      }
    }
    const target = opponents.length && participants.filter(entry => entry.agent.combat.side !== attacker.combat.side)
      .sort((a, b) => a.agent.combat.joinedAt - b.agent.combat.joinedAt || String(a.agent.id).localeCompare(String(b.agent.id)))[0].agent;
    const turn = attacker.combat.nextAttackTurn;
    for (const { agent: member } of participants) member.combat.turn = turn;
    attacker.combat.nextAttackTurn += 1;
    beginAttack(attacker, target, time, createExchange(attacker, target, null), false);
    return true;
  }

  return { update, engage, release };
}
