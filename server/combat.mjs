import { DNA_ACTION_RULES, dnaAttackMode, dnaProjectileDuration, dnaHealTarget, dnaHealAmount, dnaHealAllocations, dnaProjectileValid } from "./dna-actions.mjs";
import { creatureAttackRole, creatureAttackMode } from "./creature-attack-role.mjs";
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
import { beginRetreat, combatSurvival, retreatEscapeChance } from "./survival.mjs";
import { combatVfxToken, recordCombatVfx } from "./combat-vfx-journal.mjs";

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
      agent.birth && time < agent.birth.readyAt || target.birth && time < target.birth.readyAt ||
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
  const processed = new Map(), projectiles = new Set();
  const attackCauses = new WeakMap(), bleedCauses = new WeakMap();
  let projectileTime = -Infinity;
  function attackStats(agent) {
    if (agent.stats?.dna) return agent.stats.dna;
    const role = creatureAttackRole(agent.species);
    if (!role?.ranged) return null;
    const profile = combatProfile(agent);
    return { melee: role.melee, ranged: true, focus: profile.windup, rangedSpeed: profile.attackSpeed,
      hits: 1, comboSpeed: 0, accuracy: 0, critical: 0, lifesteal: 0, stun: 0, area: 0, bleed: 0 };
  }
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
      version: 2, cycleStartedAt: time, nextAttackAt: Math.max(time, agent.attackReady || 0), targetId: null,
      stunnedUntil: 0, stunImmuneUntil: 0, parryReadyAt: time, blockReadyAt: time, attackCount: 0,
      nextEscapeAt: time + PEACEFUL_ESCAPE_INTERVAL, completedExchanges: 0 };
    agent.renderFromX = agent.x; agent.renderFromY = agent.y;
    agent.moveDuration = 0; agent.moveBudget = 0;
    agent.attack = null; agent.attackTargetId = null;
    agent.attackReady = Math.max(time, agent.attackReady || 0);
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

  function vfx(kind, at, source, target, amount = 0, detail = {}) {
    return recordCombatVfx(environment, { kind, at, amount,
      sourceId: source?.id ?? null, targetId: target?.id ?? null,
      ...(source ? { from: { x: source.x, y: source.y } } : {}),
      ...(target ? { to: { x: target.x, y: target.y } } : {}), ...detail });
  }

  function receiveDamage(entry, damage, attacker, evidence) {
    const previousHealth = entry.agent.health;
    if (entry.game) entry.game.receiveDamage(entry.agent, damage);
    else environment.creatureSystem.receiveDamage(entry.agent, damage);
    if (entry.agent.health <= 0) { entry.agent.attack = null; entry.agent.attackTargetId = null; }
    if (evidence) {
      const amount = Math.max(0, previousHealth - entry.agent.health);
      const event = vfx(evidence.kind || "hit", evidence.at, attacker, entry.agent, amount, evidence);
      if (previousHealth > 0 && entry.agent.health <= 0)
        vfx("death", evidence.at, attacker, entry.agent, 0, { causeId: event?.id });
      return event;
    }
  }

  function emit(combat, kind, at, source, target, damage, detail = {}) {
    const sequence = (source.combat.eventSequence || 0) + 1;
    source.combat.eventSequence = sequence;
    const event = { id: combat.id + ":" + at + ":" + source.id + ":" + target.id + ":" + sequence,
      kind, at, sourceId: source.id, targetId: target.id, damage };
    source.combat.lastEvent = event;
    if (target.combat?.id === combat.id) {
      target.combat.lastEvent = event;
      if (["parry", "block", "stun"].includes(kind)) target.combat.lastReaction = event;
    }
    // Hit evidence is captured at the HP mutation; stun/counter are separate cues.
    if (["stun", "counter"].includes(kind)) vfx(kind, at, source, target, 0, detail);
  }

  function beginAttack(attacker, target, time, counter) {
    const combat = attacker.combat, mode = attacker.stats?.dna ? dnaAttackMode(attacker.stats.dna, 0) :
      creatureAttackMode(attacker, 0) || "melee";
    const profile = combatProfile({ ...attacker, attack: { attackMode: mode } });
    if (!counter) combat.attackCount++;
    if (attacker.stats?.dna && !profile.attackSpeed) { combat.nextAttackAt = Infinity; return; }
    const heavy = !counter && profile.primary === "piercing" && combat.attackCount % 3 === 0;
    const windup = counter ? (environment.combatRules?.counterWindup ?? .12) : profile.windup + (heavy ? .15 : 0);
    const timing = CREATURE_ATTACK_TIMINGS[attacker.species] || (attacker.species === "spiny-back-beetle" ? BEETLE_ANIMATIONS.attack :
      { durationMs: AGENT_ATTACK_DURATION * 1000 });
    const duration = windup + profile.recovery;
    attacker.attack = { combatId: combat.id, startedAt: time, hitAt: time + windup, endsAt: time + duration,
      speed: timing.durationMs / 1000 / duration, directionX: combat.side === 0 ? -1 : 1,
      targetId: target.id, targetKind: "agent", targetX: combat.x, targetY: combat.y,
      resolved: false, hit: false, counter, heavy, attackMode: mode };
    if (attacker.stats?.dna) { attacker.attack.hitIndex = 0; attacker.attack.heavy = false; }
    if (attacker.stats?.dna && mode === "melee" && !counter) attacker.attack.meleeContacts = [attacker.attack.hitAt];
    if (attacker.species && !attacker.stats?.dna && mode === "ranged") {
      attacker.attack.dnaRanged = true;
      attacker.attack.launchedAt = attacker.attack.hitAt;
      attacker.attack.shotLaunches = [attacker.attack.hitAt];
    }
    const causeId = combatVfxToken(environment, "attack");
    attackCauses.set(attacker.attack, causeId);
    if (!counter) vfx("attack", time, attacker, target, 0, { causeId, mode, endsAt: attacker.attack.hitAt });
    combat.cycleStartedAt = time;
    combat.nextAttackAt = time + profile.attackInterval;
    combat.targetId = target.id;
    combat.parryUntil = !counter && profile.primary === "blade" && time >= combat.parryReadyAt ? time + .2 : 0;
    attacker.attackReady = combat.nextAttackAt;
    attacker.attackStartedAt = time; attacker.animationStartedAt = time;
    attacker.attackTargetId = target.id; attacker.attackHit = false;
    attacker.mode = attacker.species === "spiny-back-beetle" ? "attack" : "fight";
    if (counter && environment.combatRules?.counterCooldown) attacker.dnaCounterReadyAt = time + environment.combatRules.counterCooldown;
    if (counter) emit(combat, "counter", time, attacker, target, 0, { causeId, mode, endsAt: attacker.attack.hitAt });
  }

  function heal(agent, amount, at, kind, detail = {}) {
    const previous = agent.health;
    if (agent.health > 0) agent.health = Math.min(agent.stats.health, agent.health + amount * (1 + (agent.stats.dna?.healing || 0) / 100));
    const restored = Math.max(0, agent.health - previous);
    if (restored > 0 && kind) vfx(kind, at, agent, agent, restored, { toId: agent.id, ...detail });
  }

  function dnaHit(attacker, target, time) {
    const attack = attacker.attack, defender = target.agent, combat = attacker.combat;
    const source = attacker.stats?.dna, shield = defender.stats?.dna;
    const random = environment.combatRandom || Math.random;
    attack.resolved = true; attacker.attackHit = true;
    if (defender.health <= 0 || defender.combat?.id !== combat.id) return;
    let damage = combatDamage(attacker, defender, (environment.damageRandom || Math.random)(), environment.combatRules);
    let reaction = null;
    if (source && attack.hitIndex > 0) damage *= source.comboPower / 100;
    if (random() * 100 < Math.max(0, (shield?.evasion || 0) - (source?.accuracy || 0))) { damage = 0; reaction = "miss"; }
    else if (!attack.counter && shield && time >= (defender.dnaReactionReadyAt || 0) && random() * 100 < shield.parry) { damage = 0; reaction = "parry"; }
    else if (!attack.counter && shield && time >= (defender.dnaReactionReadyAt || 0) && random() * 100 < shield.block) { damage *= 1 - shield.blockPower / 100; reaction = "block"; }
    else if (!shield && !attack.counter) {
      const profile = combatProfile(defender), defense = defender.combat;
      if (time < defense.parryUntil && time >= defense.parryReadyAt && profile.primary === "blade") {
        damage = 0; defense.parryReadyAt = time + 3; defense.parryUntil = 0; reaction = "parry";
      } else if (profile.primary === "carapace" && time >= defense.blockReadyAt && time >= defense.stunnedUntil) {
        damage = Math.max(1, Math.round(damage * (attack.heavy ? .55 : .2))); defense.blockReadyAt = time + 2.5; reaction = "block";
      }
    }
    if (["parry", "block"].includes(reaction) && environment.combatRules?.reactionCooldown)
      defender.dnaReactionReadyAt = time + environment.combatRules.reactionCooldown;
    const critical = !!(damage > 0 && source && random() * 100 < source.critical);
    if (critical) damage *= source.criticalPower / 100;
    attack.damage = damage; attack.hit = damage > 0;
    const previous = defender.health;
    const evidence = { kind: reaction || "hit", at: time, critical, counter: !!attack.counter,
      mode: attack.attackMode, hitIndex: attack.hitIndex || 0, causeId: attackCauses.get(attack) };
    const hitEvent = damage > 0 ? receiveDamage(target, damage, attacker, evidence) : vfx(evidence.kind, time, attacker, defender, 0, evidence);
    if (damage > 0) defender.hurtStartedAt = time;
    const dealt = Math.max(0, previous - defender.health);
    if (source && dealt > 0) heal(attacker, dealt * source.lifesteal / 100, time, "drain", {
      causeId: hitEvent?.id, fromId: defender.id, from: { x: defender.x, y: defender.y } });
    combat.completedExchanges++; defender.combat.completedExchanges++;
    emit(combat, reaction || "hit", time, attacker, defender, damage);
    if (source && damage > 0 && defender.health > 0) {
      if (random() * 100 < source.stun && time >= defender.combat.stunImmuneUntil) {
        const duration = source.stunTime * (1 - (shield?.tenacity || 0) / 100);
        defender.combat.stunnedUntil = time + duration; defender.combat.stunImmuneUntil = time + duration + (environment.combatRules?.stunImmunity ?? 2);
        defender.attack = null; defender.attackTargetId = null;
        defender.combat.nextAttackAt = Math.max(defender.combat.nextAttackAt, time + duration);
        emit(combat, "stun", time, attacker, defender, damage, { causeId: hitEvent?.id, duration, endsAt: time + duration });
      }
      if (random() * 100 < source.bleed) {
        defender.dnaBleed = { sourceId: attacker.id, power: source.bleedPower, nextAt: time + 1, endsAt: time + 3 };
        const applied = vfx("bleed-apply", time, attacker, defender, 0, { causeId: hitEvent?.id, endsAt: time + 3 });
        bleedCauses.set(defender.dnaBleed, applied?.id);
      }
    }
    if (source && damage > 0 && !attack.counter && source.area > 0) {
      const others = members(combat).filter(entry => entry.agent !== defender && entry.agent.combat.side !== combat.side).slice(0, source.area);
      for (const entry of others) receiveDamage(entry, damage * source.areaPower / 100, attacker,
        { kind: "area", at: time, causeId: hitEvent?.id, mode: attack.attackMode });
    }
    if (!source && attack.heavy && reaction !== "parry" && defender.health > 0 && time >= defender.combat.stunImmuneUntil) {
      const duration = .5 * (1 - (shield?.tenacity || 0) / 100), defense = defender.combat;
      defense.stunnedUntil = time + duration; defense.stunImmuneUntil = time + duration + (environment.combatRules?.stunImmunity ?? 2); defense.parryUntil = 0;
      defender.attack = null; defender.attackTargetId = null;
      defense.nextAttackAt = Math.max(defense.nextAttackAt, defense.stunnedUntil);
      defense.cycleStartedAt = defense.nextAttackAt;
      emit(combat, "stun", time, attacker, defender, damage, { causeId: hitEvent?.id, duration, endsAt: time + duration }); reaction = null;
    }
    if (!attack.counter && dealt > 0 && shield?.reflection > 0 && attacker.health > 0) {
      const entry = entriesAt(combat.x, combat.y).find(entry => entry.agent === attacker);
      if (entry) receiveDamage(entry, dealt * shield.reflection / 100, defender,
        { kind: "reflect", at: time, causeId: hitEvent?.id, fromId: defender.id, toId: attacker.id });
    }
    if (defender.health > 0 && attacker.health > 0 && !attack.counter && reaction && reaction !== "miss" &&
        (shield ? shield.power > 0 && time >= (defender.dnaCounterReadyAt || 0) && random() * 100 < shield.counter : true)) beginAttack(defender, attacker, time, true);
    if (source && !attack.counter && attacker.health > 0 && defender.health > 0 && ++attack.hitIndex < source.hits) {
      attack.resolved = false; attack.hitAt = time + source.comboSpeed;
      if (attack.meleeContacts) attack.meleeContacts.push(attack.hitAt);
      attack.endsAt = Math.max(attack.endsAt, attack.hitAt + combatProfile(attacker).recovery);
    }
  }

  function updateEffects(agent, time) {
    const bleed = agent.dnaBleed;
    if (bleed && agent.health > 0) {
      const entry = entries().find(entry => entry.agent === agent), source = entries().find(entry => entry.agent.id === bleed.sourceId)?.agent;
      while (entry && bleed.nextAt <= time && bleed.nextAt <= bleed.endsAt && agent.health > 0) {
        receiveDamage(entry, bleed.power, source, { kind: "bleed", at: bleed.nextAt,
          sourceId: bleed.sourceId, causeId: bleedCauses.get(bleed) }); bleed.nextAt++;
      }
      if (time >= bleed.endsAt) agent.dnaBleed = null;
    }
    const previous = agent.dnaRecoveryAt;
    agent.dnaRecoveryAt = time;
    if (agent.stats?.dna && !agent.combat && Number.isFinite(previous)) {
      const start = Math.max(previous, (agent.dnaCombatEndedAt || 0) + 5);
      if (time > start) heal(agent, agent.stats.dna.regeneration * (time - start), time, "regeneration", { startedAt: start });
    }
  }

  function resolveHit(attacker, target, time) {
    if (attacker.species && !attacker.stats?.dna && attacker.attack?.attackMode === "ranged") {
      const attack = attacker.attack, combat = attacker.combat, defense = target.agent.combat;
      attack.resolved = true; attacker.attackHit = true;
      if (target.agent.health <= 0 || defense?.id !== combat.id) return;
      const projectileId = combatVfxToken(environment, "projectile"), causeId = attackCauses.get(attack);
      vfx("shoot", time, attacker, target.agent, 0, { projectileId, causeId, mode: "ranged", hitIndex: 0,
        arrivesAt: time, from: { x: attacker.x, y: attacker.y }, to: { x: target.agent.x, y: target.agent.y } });
      const outcome = projectileHit({ source: attacker, target, attack, hitIndex: 0, vfxId: projectileId }, time) || { damage: 0, kind: "miss" };
      combat.completedExchanges++; defense.completedExchanges++;
      emit(combat, outcome.kind, time, attacker, target.agent, outcome.damage, { causeId, mode: "ranged", projectileId });
      return;
    }
    if (attacker.stats?.dna || target.agent.stats?.dna) return dnaHit(attacker, target, time);
    const attack = attacker.attack, defender = target.agent, combat = attacker.combat;
    attack.resolved = true; attacker.attackHit = true;
    if (defender.health <= 0 || defender.combat?.id !== combat.id) return;
    const defense = defender.combat, profile = combatProfile(defender);
    let damage = combatDamage(attacker, defender, (environment.damageRandom || Math.random)(), environment.combatRules);
    let reaction = null;
    if (!attack.counter && time < defense.parryUntil && time >= defense.parryReadyAt && profile.primary === "blade") {
      damage = 0; defense.parryReadyAt = time + 3; defense.parryUntil = 0; reaction = "parry";
    } else if (!attack.counter && profile.primary === "carapace" && time >= defense.blockReadyAt && time >= defense.stunnedUntil) {
      damage = Math.max(1, Math.round(damage * (attack.heavy ? .55 : .2)));
      defense.blockReadyAt = time + 2.5; reaction = "block";
    }
    attack.damage = damage; attack.hit = true;
    const evidence = { kind: reaction || "hit", at: time, counter: !!attack.counter, mode: "melee",
      critical: false, hitIndex: 0, causeId: attackCauses.get(attack) };
    const hitEvent = damage > 0 ? receiveDamage(target, damage, attacker, evidence) : vfx(evidence.kind, time, attacker, defender, 0, evidence);
    if (damage > 0) defender.hurtStartedAt = time;
    combat.completedExchanges++; defense.completedExchanges++;
    emit(combat, reaction || "hit", time, attacker, defender, damage);
    if (defender.health <= 0) return;
    if (attack.heavy && reaction !== "parry" && time >= defense.stunImmuneUntil) {
      defense.stunnedUntil = time + .5; defense.stunImmuneUntil = time + 2.5; defense.parryUntil = 0;
      defender.attack = null; defender.attackTargetId = null;
      defense.nextAttackAt = Math.max(defense.nextAttackAt, defense.stunnedUntil);
      defense.cycleStartedAt = defense.nextAttackAt;
      emit(combat, "stun", time, attacker, defender, damage,
        { causeId: hitEvent?.id, duration: .5, endsAt: time + .5 }); reaction = null;
    }
    if (reaction && attacker.health > 0) beginAttack(defender, attacker, time, true);
  }


  function nearby(agent, radius) {
    return environment.unitIndex ? environment.unitIndex.nearby(agent.x, agent.y, radius) : entries().filter(entry => distance(agent, entry.agent) <= radius);
  }

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function projectileHit(projectile, time) {
    const { source, target } = projectile, defender = target.agent;
    if (!dnaProjectileValid(source, defender)) return;
    const offense = attackStats(source), defense = defender.stats.dna, random = environment.combatRandom || Math.random;
    let damage = combatDamage({ ...source, attack: projectile.attack }, defender, (environment.damageRandom || Math.random)(), environment.combatRules);
    let reaction = null;
    if (projectile.hitIndex > 0) damage *= offense.comboPower / 100;
    if (random() * 100 < Math.max(0, (defense?.evasion || 0) - offense.accuracy)) { damage = 0; reaction = "miss"; }
    else if (time >= (defender.dnaReactionReadyAt || 0) && random() * 100 < (defense?.parry || 0)) { damage = 0; reaction = "parry"; }
    else if (time >= (defender.dnaReactionReadyAt || 0) && random() * 100 < (defense?.block || 0)) { damage *= 1 - defense.blockPower / 100; reaction = "block"; }
    else if (!defense) {
      const profile = combatProfile(defender), state = defender.combat || defender;
      if (time < (state.parryUntil || 0) && time >= (state.parryReadyAt || 0) && profile.primary === "blade") { damage = 0; state.parryReadyAt = time + 3; state.parryUntil = 0; reaction = "parry"; }
      else if (profile.primary === "carapace" && time >= (state.blockReadyAt || 0) && time >= (state.stunnedUntil || 0)) { damage = Math.max(1, Math.round(damage * .2)); state.blockReadyAt = time + 2.5; reaction = "block"; }
    }
    if (["parry", "block"].includes(reaction) && environment.combatRules?.reactionCooldown)
      defender.dnaReactionReadyAt = time + environment.combatRules.reactionCooldown;
    const critical = damage > 0 && random() * 100 < offense.critical;
    if (critical) damage *= offense.criticalPower / 100;
    const previous = defender.health;
    const evidence = { kind: reaction || "hit", at: time, mode: "ranged", critical, hitIndex: projectile.hitIndex,
      causeId: attackCauses.get(projectile.attack), projectileId: projectile.vfxId };
    const hitEvent = damage > 0 ? receiveDamage(target, damage, source, evidence) : vfx(evidence.kind, time, source, defender, 0, evidence);
    if (damage > 0) defender.hurtStartedAt = time;
    const dealt = Math.max(0, previous - defender.health);
    heal(source, dealt * offense.lifesteal / 100, time, "drain", {
      causeId: hitEvent?.id, fromId: defender.id, from: { x: defender.x, y: defender.y } });
    if (dealt > 0 && defense?.reflection > 0) receiveDamage({ agent: source, game: environment.games.get(source.ownerId) || null }, dealt * defense.reflection / 100, defender,
      { kind: "reflect", at: time, causeId: hitEvent?.id, fromId: defender.id, toId: source.id });
    if (defender.health > 0 && dealt > 0 && random() * 100 < offense.stun && time >= (defender.dnaStunImmuneUntil || defender.combat?.stunImmuneUntil || 0)) {
      const endsAt = time + offense.stunTime * (1 - (defense?.tenacity || 0) / 100);
      defender.dnaStunnedUntil = endsAt; defender.dnaStunImmuneUntil = endsAt + (environment.combatRules?.stunImmunity ?? 2);
      if (defender.combat) { defender.combat.stunnedUntil = endsAt; defender.combat.nextAttackAt = Math.max(defender.combat.nextAttackAt, endsAt); }
      defender.attack = null; defender.attackTargetId = null;
      vfx("stun", time, source, defender, 0, { causeId: hitEvent?.id, duration: endsAt - time, endsAt });
    }
    if (dealt > 0 && offense.area > 0) {
      const others = entriesAt(defender.x, defender.y).filter(entry => entry.agent !== defender && entry.agent.health > 0 && combatTeam(entry.agent) !== combatTeam(source)).slice(0, offense.area);
      for (const entry of others) receiveDamage(entry, damage * offense.areaPower / 100, source,
        { kind: "area", at: time, causeId: hitEvent?.id, mode: "ranged", projectileId: projectile.vfxId });
    }
    if (defender.health > 0 && dealt > 0 && random() * 100 < offense.bleed) {
      defender.dnaBleed = { sourceId: source.id, power: offense.bleedPower, nextAt: time + 1, endsAt: time + 3 };
      const applied = vfx("bleed-apply", time, source, defender, 0, { causeId: hitEvent?.id, endsAt: time + 3 });
      bleedCauses.set(defender.dnaBleed, applied?.id);
    }
    source.dnaActionEvent = { kind: "ranged", at: time, sourceId: source.id, targetId: defender.id, damage: dealt, x: defender.x, y: defender.y };
    defender.dnaActionEvent = source.dnaActionEvent;
    if (source.attack === projectile.attack) { source.attack.hit = dealt > 0; source.attack.resolved = true; }
    return { damage: dealt, kind: reaction || "hit" };
  }

  function updateDnaActions(agent, time) {
    if (projectileTime !== time) {
      projectileTime = time;
      for (const projectile of [...projectiles].sort((a, b) => a.arrivesAt - b.arrivesAt)) {
        if (!dnaProjectileValid(projectile.source, projectile.target.agent) ||
            projectile.source.ownerId && !environment.games.get(projectile.source.ownerId)?.agents.includes(projectile.source) ||
            projectile.target.game && !projectile.target.game.agents.includes(projectile.target.agent) ||
            !projectile.launched && projectile.source.attack !== projectile.attack) {
          vfx("projectile-cancel", time, projectile.source, projectile.target.agent, 0,
            { projectileId: projectile.vfxId, causeId: attackCauses.get(projectile.attack) });
          projectiles.delete(projectile); projectile.source.dnaProjectiles = (projectile.source.dnaProjectiles || []).filter(item => item !== projectile.visual); continue;
        }
        if (time >= projectile.launchedAt && !projectile.launched) {
          projectile.launched = true;
          vfx("shoot", projectile.launchedAt, projectile.source, projectile.target.agent, 0,
            { projectileId: projectile.vfxId, causeId: attackCauses.get(projectile.attack), mode: "ranged",
              hitIndex: projectile.hitIndex, arrivesAt: projectile.arrivesAt,
              from: { x: projectile.visual.fromX, y: projectile.visual.fromY },
              to: { x: projectile.visual.targetX, y: projectile.visual.targetY } });
        }
        if (time + 1e-8 >= projectile.arrivesAt) {
          projectileHit(projectile, projectile.arrivesAt);
          projectiles.delete(projectile); projectile.source.dnaProjectiles = (projectile.source.dnaProjectiles || []).filter(item => item !== projectile.visual);
        }
      }
    }
    const stats = attackStats(agent);
    if (!stats || !stats.healer && !stats.ranged || !settled(agent, time) || agent.retreat ||
        time < Math.max(agent.dnaStunnedUntil || 0, agent.combat?.stunnedUntil || 0)) return false;
    if (stats.healer && time >= (agent.dnaHealReady || 0)) {
      agent.dnaHealReady = time + DNA_ACTION_RULES.healInterval;
      const allocations = dnaHealAllocations(agent, nearby(agent, DNA_ACTION_RULES.healRange).map(entry => entry.agent), combatTeam, distance);
      for (const { target, amount } of allocations) {
        target.health += amount;
        const event = { kind: "heal", at: time, sourceId: agent.id, targetId: target.id, damage: -amount, x: target.x, y: target.y };
        agent.dnaHealEvent = event; target.dnaHealEvent = event;
        vfx("heal", time, agent, target, amount);
      }
    }
    if (agent.attack?.dnaRanged) {
      if (time < agent.attack.endsAt) return true;
      agent.attack = null; agent.attackTargetId = null;
    }
    if (!stats.ranged || agent.combat || agent.attack || time < (agent.attackReady || 0) || time < (agent.dnaScanReady || 0)) return false;
    agent.dnaScanReady = time + .25;
    const targets = nearby(agent, DNA_ACTION_RULES.rangedRange).filter(entry => {
      const target = entry.agent, defending = agent.utility?.action === "fight" && agent.utility.target?.id === target.id ||
        target.attack?.targetId === agent.id;
      const actor = agent.species && !agent.stats?.dna && defending && combatDisposition(agent) === "peaceful" ?
        { ...agent, combatDisposition: "passive" } : agent;
      return dnaProjectileValid(agent, target) && canPursueCombat(actor, target, time, defending) &&
        (!agent.species || agent.stats?.dna || creatureAttackMode(agent, distance(agent, target)) === "ranged") &&
        distance(agent, target) > 0 && distance(agent, target) <= DNA_ACTION_RULES.rangedRange;
    }).sort((a, b) => distance(agent, a.agent) - distance(agent, b.agent) || String(a.agent.id).localeCompare(String(b.agent.id)));
    const target = targets[0]; if (!target) return false;
    const separation = distance(agent, target.agent), windup = stats.focus, launchedAt = time + windup;
    const arrivesAt = launchedAt + dnaProjectileDuration(separation), readyAt = time + Math.max(1 / stats.rangedSpeed, windup + (stats.hits - 1) * stats.comboSpeed);
    // readyAt groups additions differently from the per-shot schedule and may
    // round one step before its final launch. Do not retire/cancel that shot;
    // keep the existing cooldown, exact launch times and recovery otherwise.
    const lastLaunchAt = launchedAt + (stats.hits - 1) * stats.comboSpeed;
    agent.attackReady = readyAt;
    agent.attack = { dnaRanged: true, attackMode: "ranged", startedAt: time, launchedAt, hitAt: arrivesAt, shotLaunches: [],
      endsAt: Math.max(lastLaunchAt, Math.min(readyAt, lastLaunchAt + .15)), speed: 1, targetId: target.agent.id, targetKind: "agent", targetX: target.agent.x, targetY: target.agent.y,
      fromX: agent.x, fromY: agent.y, directionX: Math.sign(target.agent.x - agent.x) || 1, resolved: false, hit: false };
    const causeId = combatVfxToken(environment, "attack");
    attackCauses.set(agent.attack, causeId);
    vfx("attack", time, agent, target.agent, 0, { causeId, mode: "ranged", endsAt: launchedAt });
    agent.attackTargetId = target.agent.id;
    if (agent.species && !agent.stats?.dna) {
      agent.attackStartedAt = time; agent.animationStartedAt = time; agent.attackHit = false;
      agent.facing = agent.attack.directionX;
      agent.mode = agent.species === "spiny-back-beetle" ? "attack" : "fight";
    }
    for (let hitIndex = 0; hitIndex < stats.hits; hitIndex++) {
      const shotLaunch = launchedAt + hitIndex * stats.comboSpeed, shotArrival = arrivesAt + hitIndex * stats.comboSpeed;
      // Keep the animation clock after a projectile arrives and its visual is removed.
      agent.attack.shotLaunches.push(shotLaunch);
      const visual = { launchedAt: shotLaunch, hitAt: shotArrival, fromX: agent.x, fromY: agent.y, targetX: target.agent.x, targetY: target.agent.y };
      agent.dnaProjectiles = [...(agent.dnaProjectiles || []), visual];
      projectiles.add({ source: agent, target, arrivesAt: shotArrival, launchedAt: shotLaunch, launched: false,
        attack: agent.attack, visual, hitIndex, vfxId: combatVfxToken(environment, "projectile") });
    }
    return true;
  }

  function update(agent, time) {
    const rangedBusy = updateDnaActions(agent, time);
    updateEffects(agent, time);
    if (agent.health <= 0) { agent.attack = null; return false; }
    if ((rangedBusy || time < (agent.dnaStunnedUntil || 0)) && !agent.combat) return true;
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
