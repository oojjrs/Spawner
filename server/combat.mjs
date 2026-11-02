import { dnaCanMove } from "./dna-unit.mjs";
import { worldSize } from "./world-size.mjs";
import { dropCarriedResources } from "./resources.mjs";
import { militaryAgent } from "./conquest-pacing.mjs";
import { creatureSpawning } from "./creature-spawn.mjs";
import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { AGENT_ATTACK_DURATION } from "./attack.mjs";
import { BEETLE_ANIMATIONS } from "./beetle-animation.mjs";
import { CREATURE_ATTACK_TIMINGS } from "./creature-attack.mjs";
import { unitTravelSpeed, unitTerrainSpeedMultiplier } from "./attributes.mjs";
import { combatDamage, combatProfile } from "./combat-stats.mjs";
import { recordCombatExperience } from "./experience.mjs";
import { beginRetreat, combatSurvival, retreatEscapeChance } from "./survival.mjs";

export const COMBAT_DISPOSITIONS = Object.freeze({ peaceful: "평화형", passive: "비선공", aggressive: "선공" });
export const PEACEFUL_ESCAPE_CHANCE = .8;
export const PEACEFUL_ESCAPE_INTERVAL = 1.5;
export const COMBAT_ESCAPE_GRACE = 2;
export const COMBAT_RETREAT_EXCHANGES = 2;
export const COMBAT_EXCHANGE_PAUSE = 1;
export const COMBAT_TURN_ORDER_VERSION = 1;
export const COMBAT_EXCHANGE_DAMAGE_VERSION = 5;

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

export function suspendDefenseWork(agent) {
  const work = agent.utility;
  if (!agent.ownerId || !militaryAgent(agent, agent.tribe) || agent.suspendedWork || !["collect", "return"].includes(work?.action)) return;
  agent.suspendedWork = { action: work.action, target: { ...work.target }, plannedCargo: work.plannedCargo };
  agent.defenseRevision = (agent.defenseRevision || 0) + 1;
}

export function colonyDefenseTarget(agent, target, allies, structures) {
  if (!agent.ownerId || !militaryAgent(agent, agent.tribe) || combatDisposition(agent) === "peaceful" ||
      combatTeam(agent) === combatTeam(target) || target.health <= 0 || target.hidden) return false;
  if (target.combat) return target.combat.teams[1 - target.combat.side] === combatTeam(agent);
  if (target.retreat) return false;
  if (agent.utility?.action === "fight" && agent.utility.defending && agent.utility.target.id === target.id) return true;
  const targetId = target.attack?.targetId;
  return !!targetId && ((allies || []).some(ally => ally.id === targetId && ally.health > 0 && combatTeam(ally) === combatTeam(agent)) ||
    (structures || []).some(structure => structure?.id === targetId && structure.health > 0));
}

export function canPursueCombat(agent, target, time, defending) {
  if (agent === target || combatTeam(agent) === combatTeam(target) || target.health <= 0 || target.hidden ||
      creatureSpawning(agent, time) || creatureSpawning(target, time) ||
      time < (agent.escapeUntil || 0) || time < (target.escapeUntil || 0) || agent.retreat || combatDisposition(agent) === "peaceful") return false;
  if (agent.species && target.species) return false;
  if (target.combat) return target.combat.teams[1 - target.combat.side] === combatTeam(agent);
  return combatDisposition(agent) === "aggressive" || !!defending;
}

export function peacefulEscapeChance(suppression) {
  return PEACEFUL_ESCAPE_CHANCE * (1 - Math.max(0, Math.min(1, suppression || 0)));
}

export function createCombat(environment) {
  const size = worldSize(environment.world);
  const processed = new Map();
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
    suspendDefenseWork(agent);
    dropCarriedResources(environment, agent);
    agent.combat = { id: combat.id, x: combat.x, y: combat.y, teams: [...combat.teams], side, joinedAt: time,
      version: 2, cycleStartedAt: time, nextAttackAt: time, targetId: null,
      stunnedUntil: 0, stunImmuneUntil: 0, parryReadyAt: time, blockReadyAt: time, attackCount: 0,
      nextEscapeAt: time + PEACEFUL_ESCAPE_INTERVAL, completedExchanges: 0 };
    agent.renderFromX = agent.x; agent.renderFromY = agent.y;
    agent.moveDuration = 0; agent.moveBudget = 0;
    agent.attack = null; agent.attackTargetId = null;
    agent.attackReady = time;
    agent.utility = null; agent.decisionPending = null;
    if (agent.foodDelivery?.receivedAt === null) agent.foodDelivery = null;
    agent.mode = "fight";
    agent.facing = side === 0 ? -1 : 1;
    environment.unitIndex?.update(agent);
  }

  function release(agent, time) {
    if (agent.stats?.dna) agent.dnaCombatEndedAt = time;
    agent.combat = null;
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
    const game = environment.games.get(agent.ownerId);
    const defending = colonyDefenseTarget(agent, target, game?.agents, [game?.nest]);
    if (!settled(agent, time) || !settled(target, time) || agent.x !== target.x || agent.y !== target.y ||
        agent.combat || !canPursueCombat(agent, target, time, defending)) return false;
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
        !environment.colonies.some(colony => environment.games.get(colony.ownerId)?.nest?.health !== 0 &&
          colony.occupiedCells.has((cell.x - colony.x) + "," + (cell.y - colony.y))) &&
        !(environment.unitIndex ? environment.unitIndex.occupied(cell.x, cell.y, agent, true) : occupied.some(entry => entry.agent.x === cell.x && entry.agent.y === cell.y ||
          time < entry.agent.moveStartedAt + entry.agent.moveDuration && entry.agent.renderFromX === cell.x && entry.agent.renderFromY === cell.y)))
      .filter(cell => dnaCanMove(agent, cell.x, cell.y, (environment.colonies || []).filter(colony => colony.ownerId === agent.ownerId)))
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

  function receiveDamage(entry, damage, attacker) {
    const previousHealth = entry.agent.health;
    if (entry.game) entry.game.receiveDamage(entry.agent, damage);
    else environment.creatureSystem.receiveDamage(entry.agent, damage);
    recordCombatExperience(attacker, entry.agent, Math.max(0, previousHealth - entry.agent.health),
      entry.agent.health <= 0 ? entries().map(entry => entry.agent) : []);
    if (entry.agent.health <= 0) { entry.agent.attack = null; entry.agent.attackTargetId = null; }
  }

  function emit(combat, kind, at, source, target, damage) {
    const sequence = (source.combat.eventSequence || 0) + 1;
    source.combat.eventSequence = sequence;
    const event = { id: combat.id + ":" + at + ":" + source.id + ":" + target.id + ":" + sequence,
      kind, at, sourceId: source.id, targetId: target.id, damage };
    source.combat.lastEvent = event;
    if (target.combat?.id === combat.id) {
      target.combat.lastEvent = event;
      if (["parry", "block", "stun"].includes(kind)) target.combat.lastReaction = event;
    }
  }

  function beginAttack(attacker, target, time, counter) {
    const profile = combatProfile(attacker), combat = attacker.combat;
    if (!counter) combat.attackCount++;
    if (attacker.stats?.dna && !profile.attackSpeed) { combat.nextAttackAt = Infinity; return; }
    const heavy = !counter && profile.primary === "piercing" && combat.attackCount % 3 === 0;
    const windup = counter ? .12 : profile.windup + (heavy ? .15 : 0);
    const timing = CREATURE_ATTACK_TIMINGS[attacker.species] || (attacker.species === "spiny-back-beetle" ? BEETLE_ANIMATIONS.attack :
      { durationMs: AGENT_ATTACK_DURATION * 1000 });
    const duration = windup + profile.recovery;
    attacker.attack = { combatId: combat.id, startedAt: time, hitAt: time + windup, endsAt: time + duration,
      speed: timing.durationMs / 1000 / duration, directionX: combat.side === 0 ? -1 : 1,
      targetId: target.id, targetKind: "agent", targetX: combat.x, targetY: combat.y,
      resolved: false, hit: false, counter, heavy };
    if (attacker.stats?.dna) { attacker.attack.hitIndex = 0; attacker.attack.heavy = false; }
    combat.cycleStartedAt = time;
    combat.nextAttackAt = time + profile.attackInterval;
    combat.targetId = target.id;
    combat.parryUntil = !counter && profile.primary === "blade" && time >= combat.parryReadyAt ? time + .2 : 0;
    attacker.attackReady = combat.nextAttackAt;
    attacker.attackStartedAt = time; attacker.animationStartedAt = time;
    attacker.attackTargetId = target.id; attacker.attackHit = false;
    attacker.mode = attacker.species === "spiny-back-beetle" ? "attack" : "fight";
    if (counter) emit(combat, "counter", time, attacker, target, 0);
  }

  function heal(agent, amount) {
    if (agent.health > 0) agent.health = Math.min(agent.stats.health, agent.health + amount * (1 + (agent.stats.dna?.healing || 0) / 100));
  }

  function dnaHit(attacker, target, time) {
    const attack = attacker.attack, defender = target.agent, combat = attacker.combat;
    const source = attacker.stats?.dna, shield = defender.stats?.dna;
    const random = environment.combatRandom || Math.random;
    attack.resolved = true; attacker.attackHit = true;
    if (defender.health <= 0 || defender.combat?.id !== combat.id) return;
    let damage = combatDamage(attacker, defender, (environment.damageRandom || Math.random)());
    let reaction = null;
    if (source && attack.hitIndex > 0) damage *= source.comboPower / 100;
    if (random() * 100 < Math.max(0, (shield?.evasion || 0) - (source?.accuracy || 0))) { damage = 0; reaction = "miss"; }
    else if (!attack.counter && shield && random() * 100 < shield.parry) { damage = 0; reaction = "parry"; }
    else if (!attack.counter && shield && random() * 100 < shield.block) { damage *= 1 - shield.blockPower / 100; reaction = "block"; }
    else if (!shield && !attack.counter) {
      const profile = combatProfile(defender), defense = defender.combat;
      if (time < defense.parryUntil && time >= defense.parryReadyAt && profile.primary === "blade") {
        damage = 0; defense.parryReadyAt = time + 3; defense.parryUntil = 0; reaction = "parry";
      } else if (profile.primary === "carapace" && time >= defense.blockReadyAt && time >= defense.stunnedUntil) {
        damage = Math.max(1, Math.round(damage * (attack.heavy ? .55 : .2))); defense.blockReadyAt = time + 2.5; reaction = "block";
      }
    }
    if (damage > 0 && source && random() * 100 < source.critical) damage *= source.criticalPower / 100;
    attack.damage = damage; attack.hit = damage > 0;
    const previous = defender.health;
    if (damage > 0) { receiveDamage(target, damage, attacker); defender.hurtStartedAt = time; }
    const dealt = Math.max(0, previous - defender.health);
    if (source && dealt > 0) heal(attacker, dealt * source.lifesteal / 100);
    combat.completedExchanges++; defender.combat.completedExchanges++;
    emit(combat, reaction || "hit", time, attacker, defender, damage);
    if (source && damage > 0 && defender.health > 0) {
      if (random() * 100 < source.stun && time >= defender.combat.stunImmuneUntil) {
        const duration = source.stunTime * (1 - (shield?.tenacity || 0) / 100);
        defender.combat.stunnedUntil = time + duration; defender.combat.stunImmuneUntil = time + duration + 2;
        defender.attack = null; defender.attackTargetId = null;
        defender.combat.nextAttackAt = Math.max(defender.combat.nextAttackAt, time + duration);
        emit(combat, "stun", time, attacker, defender, damage);
      }
      if (random() * 100 < source.bleed) defender.dnaBleed = { sourceId: attacker.id, power: source.bleedPower, nextAt: time + 1, endsAt: time + 3 };
    }
    if (source && damage > 0 && !attack.counter && source.area > 0) {
      const others = members(combat).filter(entry => entry.agent !== defender && entry.agent.combat.side !== combat.side).slice(0, source.area);
      for (const entry of others) receiveDamage(entry, damage * source.areaPower / 100, attacker);
    }
    if (!source && attack.heavy && reaction !== "parry" && defender.health > 0 && time >= defender.combat.stunImmuneUntil) {
      const duration = .5 * (1 - (shield?.tenacity || 0) / 100), defense = defender.combat;
      defense.stunnedUntil = time + duration; defense.stunImmuneUntil = time + duration + 2; defense.parryUntil = 0;
      defender.attack = null; defender.attackTargetId = null;
      defense.nextAttackAt = Math.max(defense.nextAttackAt, defense.stunnedUntil);
      defense.cycleStartedAt = defense.nextAttackAt;
      emit(combat, "stun", time, attacker, defender, damage); reaction = null;
    }
    if (!attack.counter && dealt > 0 && shield?.reflection > 0 && attacker.health > 0) {
      const entry = entriesAt(combat.x, combat.y).find(entry => entry.agent === attacker);
      if (entry) receiveDamage(entry, dealt * shield.reflection / 100, defender);
    }
    if (defender.health > 0 && attacker.health > 0 && !attack.counter && reaction && reaction !== "miss" &&
        (shield ? shield.power > 0 && random() * 100 < shield.counter : true)) beginAttack(defender, attacker, time, true);
    if (source && !attack.counter && attacker.health > 0 && defender.health > 0 && ++attack.hitIndex < source.hits) {
      attack.resolved = false; attack.hitAt = time + source.comboSpeed;
      attack.endsAt = Math.max(attack.endsAt, attack.hitAt + combatProfile(attacker).recovery);
    }
  }

  function updateEffects(agent, time) {
    const bleed = agent.dnaBleed;
    if (bleed && agent.health > 0) {
      const entry = entries().find(entry => entry.agent === agent), source = entries().find(entry => entry.agent.id === bleed.sourceId)?.agent;
      while (entry && bleed.nextAt <= time && bleed.nextAt <= bleed.endsAt && agent.health > 0) {
        receiveDamage(entry, bleed.power, source); bleed.nextAt++;
      }
      if (time >= bleed.endsAt) agent.dnaBleed = null;
    }
    const previous = agent.dnaRecoveryAt;
    agent.dnaRecoveryAt = time;
    if (agent.stats?.dna && !agent.combat && Number.isFinite(previous)) {
      const start = Math.max(previous, (agent.dnaCombatEndedAt || 0) + 5);
      if (time > start) heal(agent, agent.stats.dna.regeneration * (time - start));
    }
  }

  function resolveHit(attacker, target, time) {
    if (attacker.stats?.dna || target.agent.stats?.dna) return dnaHit(attacker, target, time);
    const attack = attacker.attack, defender = target.agent, combat = attacker.combat;
    attack.resolved = true; attacker.attackHit = true;
    if (defender.health <= 0 || defender.combat?.id !== combat.id) return;
    const defense = defender.combat, profile = combatProfile(defender);
    let damage = combatDamage(attacker, defender, (environment.damageRandom || Math.random)());
    let reaction = null;
    if (!attack.counter && time < defense.parryUntil && time >= defense.parryReadyAt && profile.primary === "blade") {
      damage = 0; defense.parryReadyAt = time + 3; defense.parryUntil = 0; reaction = "parry";
    } else if (!attack.counter && profile.primary === "carapace" && time >= defense.blockReadyAt && time >= defense.stunnedUntil) {
      damage = Math.max(1, Math.round(damage * (attack.heavy ? .55 : .2)));
      defense.blockReadyAt = time + 2.5; reaction = "block";
    }
    attack.damage = damage; attack.hit = true;
    if (damage > 0) { receiveDamage(target, damage, attacker); defender.hurtStartedAt = time; }
    combat.completedExchanges++; defense.completedExchanges++;
    emit(combat, reaction || "hit", time, attacker, defender, damage);
    if (defender.health <= 0) return;
    if (attack.heavy && reaction !== "parry" && time >= defense.stunImmuneUntil) {
      defense.stunnedUntil = time + .5; defense.stunImmuneUntil = time + 2.5; defense.parryUntil = 0;
      defender.attack = null; defender.attackTargetId = null;
      defense.nextAttackAt = Math.max(defense.nextAttackAt, defense.stunnedUntil);
      defense.cycleStartedAt = defense.nextAttackAt;
      emit(combat, "stun", time, attacker, defender, damage); reaction = null;
    }
    if (reaction && attacker.health > 0) beginAttack(defender, attacker, time, true);
  }

  function update(agent, time) {
    updateEffects(agent, time);
    if (agent.health <= 0) { agent.attack = null; return false; }
    if (!agent.combat) contact(agent, time);
    const combat = agent.combat;
    if (!combat) return false;
    if (agent.x !== combat.x || agent.y !== combat.y) { release(agent, time); return false; }
    if (processed.get(combat.id) === time) return true;
    processed.set(combat.id, time);
    let participants = members(combat).sort((a, b) => String(a.agent.id).localeCompare(String(b.agent.id)));
    for (const { agent: member } of participants) {
      if (member.combat.version !== 2) { const old = member.combat; attach(member, old, old.side, time); }
      dropCarriedResources(environment, member); member.moveBudget = 0;
      member.facing = member.combat.side === 0 ? -1 : 1;
    }
    let iterations = 0;
    while (iterations++ < 10000) {
      participants = members(combat).sort((a, b) => String(a.agent.id).localeCompare(String(b.agent.id)));
      if (new Set(participants.map(entry => entry.agent.combat.side)).size < 2) { finish(combat, time); processed.delete(combat.id); return true; }
      const events = participants.flatMap(({ agent: member }) => {
        if (member.attack) return [{ agent: member, at: member.attack.resolved ? member.attack.endsAt : member.attack.hitAt, kind: member.attack.resolved ? "end" : "hit" }];
        return [{ agent: member, at: Math.max(member.combat.nextAttackAt, member.combat.stunnedUntil), kind: "start" }];
      }).filter(event => event.at <= time + 1e-8).sort((a, b) => a.at - b.at ||
        ({ hit: 0, end: 1, start: 2 }[a.kind] - { hit: 0, end: 1, start: 2 }[b.kind]) || String(a.agent.id).localeCompare(String(b.agent.id)));
      if (!events.length) break;
      const event = events[0], member = event.agent;
      const opponents = participants.filter(entry => entry.agent.combat.side !== member.combat.side);
      if (event.kind === "hit") {
        const target = opponents.find(entry => entry.agent.id === member.attack.targetId);
        if (target) resolveHit(member, target, event.at);
        else { member.attack.resolved = true; member.attackHit = true; }
      } else if (event.kind === "end") {
        member.attack = null; member.attackTargetId = null;
        member.mode = member.species === "spiny-back-beetle" ? "idle" : "fight";
      } else {
        if (member.ownerId) {
          const allies = participants.filter(entry => entry.agent.combat.side === member.combat.side);
          const assessment = combatSurvival(member, opponents.map(entry => entry.agent), allies.map(entry => entry.agent));
          member.survivalState = assessment.state;
          if (assessment.retreat) beginRetreat(member, event.at);
          if (member.retreat && member.combat.completedExchanges >= COMBAT_RETREAT_EXCHANGES && event.at >= member.combat.nextEscapeAt &&
              escape(member, opponents, event.at, true)) continue;
        }
        const target = opponents.find(entry => entry.agent.id === member.combat.targetId) || opponents.sort((a, b) =>
          (member.species && combatDisposition(member) === "aggressive" ? Number(militaryAgent(b.agent, b.agent.tribe)) - Number(militaryAgent(a.agent, a.agent.tribe)) : 0) ||
          a.agent.combat.joinedAt - b.agent.combat.joinedAt || String(a.agent.id).localeCompare(String(b.agent.id)))[0];
        beginAttack(member, target.agent, event.at, false);
      }
    }
    for (const { agent: member } of members(combat)) {
      if (peacefulCreature(member) && time >= member.combat.nextEscapeAt) {
        const opponents = members(combat).filter(entry => entry.agent.combat.side !== member.combat.side);
        if (opponents.length) escape(member, opponents, time, false);
      }
    }
    return true;
  }

  return { update, engage, release };
}
