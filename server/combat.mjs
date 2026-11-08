import { isNestDefender } from "./nest-defender.mjs";
import { basicRecoveryRate, UNIT_RECOVERY_RULES as SHARED_UNIT_RECOVERY_RULES } from "./unit-recovery.mjs";
import { DNA_ACTION_RULES, dnaAttackMode, dnaDefensiveMelee, dnaProjectileDuration, dnaProjectileValid } from "./dna-actions.mjs";
import { creatureAttackRole } from "./creature-attack-role.mjs";
import { COMBAT_MELEE_RANGE, initializeCombatPosition, advanceCombatPositions, combatSeparation, combatPositionMode } from "./combat-position.mjs";
import { dnaCanMove, dnaCanSearch, dnaCanAttack } from "./dna-unit.mjs";
import { worldSize } from "./world-size.mjs";
import { dropCarriedResources } from "./resources.mjs";
import { militaryAgent } from "./conquest-pacing.mjs";
import { creatureSpawning } from "./creature-spawn.mjs";
import { ENCOUNTER_TYPES } from "./encounter-types.mjs";
import { AGENT_ATTACK_DURATION, AGENT_ATTACK_HIT_TIME } from "./attack.mjs";
import { BEETLE_ANIMATIONS } from "./beetle-animation.mjs";
import { CREATURE_ATTACK_TIMINGS } from "./creature-attack.mjs";
import { unitTravelSpeed, unitTerrainSpeedMultiplier } from "./attributes.mjs";
import { combatDamage, combatProfile, combatAbilityStats } from "./combat-stats.mjs";
import { beginRetreat, updateRetreat, canRetreat, combatSurvival, retreatEscapeChance } from "./survival.mjs";
import { combatVfxToken, recordCombatVfx } from "./combat-vfx-journal.mjs";

export const COMBAT_DISPOSITIONS = Object.freeze({ peaceful: "평화형", passive: "비선공", aggressive: "선공" });
export const PEACEFUL_ESCAPE_CHANCE = .8;
export const PEACEFUL_ESCAPE_INTERVAL = 1.5;
export const COMBAT_ESCAPE_GRACE = 2;
export const COMBAT_RETREAT_EXCHANGES = 2;
export const COMBAT_EXCHANGE_PAUSE = 1;
export const COMBAT_TURN_ORDER_VERSION = 1;
export const UNIT_RECOVERY_RULES = SHARED_UNIT_RECOVERY_RULES;

export function outOfCombatRecoveryRate(agent) {
  // Neutral creatures retain their individually balanced native regeneration.
  const basic = agent.ownerId ? basicRecoveryRate(agent.stats?.health) : 0;
  return basic + Math.max(0, combatAbilityStats(agent)?.regeneration || 0);
}
export const COMBAT_EXCHANGE_DAMAGE_VERSION = 5;

const species = new Map(ENCOUNTER_TYPES.map(type => [type.key, type]));

export function combatDisposition(agent) {
  if (isNestDefender(agent)) return "passive";
  if ((agent.dna || agent.stats?.dna) && agent.ownerId) return dnaCanAttack(agent) ? "aggressive" : "passive";
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

function canTargetCombat(agent, target, time, defending) {
  if (agent === target || combatTeam(agent) === combatTeam(target) || target.health <= 0 || target.hidden ||
      creatureSpawning(agent, time) || creatureSpawning(target, time) ||
      agent.birth && time < agent.birth.readyAt || target.birth && time < target.birth.readyAt ||
      time < (agent.escapeUntil || 0) || time < (target.escapeUntil || 0) || agent.retreat || combatDisposition(agent) === "peaceful") return false;
  if (agent.species && target.species) return false;
  if (target.combat) return target.combat.teams[1 - target.combat.side] === combatTeam(agent);
  return combatDisposition(agent) === "aggressive" || !!defending;
}

export function canPursueCombat(agent, target, time, defending) {
  return (dnaCanSearch(agent, target, time) || !!defending && isNestDefender(agent)) &&
    canTargetCombat(agent, target, time, defending);
}

export function peacefulEscapeChance(suppression) {
  return PEACEFUL_ESCAPE_CHANCE * (1 - Math.max(0, Math.min(1, suppression || 0)));
}

export function createCombat(environment) {
  const size = worldSize(environment.world);
  const processed = new Map(), projectiles = new Set();
  const attackCauses = new WeakMap(), bleedCauses = new WeakMap();

  function actionCount(expected) {
    const whole = Math.floor(expected), fraction = expected - whole;
    return whole + (fraction > 0 && (environment.combatRandom || Math.random)() < fraction ? 1 : 0);
  }

  function attackStats(agent) {
    if (combatAbilityStats(agent)) return combatAbilityStats(agent);
    const role = creatureAttackRole(agent.species);
    if (!role?.ranged) return null;
    const profile = combatProfile(agent);
    return { melee: role.melee, ranged: true, focus: profile.windup, rangedSpeed: profile.attackSpeed,
      hits: 1, comboSpeed: 0, accuracy: 0, lifesteal: 0, stun: 0, area: 0, bleed: 0 };
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
    agent.combat = { id: combat.id, x: combat.x, y: combat.y, teams: [...combat.teams], side, joinedAt: time, initialDistance: environment.combatInitialDistance || 1,
      version: 2, cycleStartedAt: time, nextAttackAt: Math.max(time, agent.attackReady || 0), targetId: null,
      stunnedUntil: 0, stunImmuneUntil: 0, parryReadyAt: time, blockReadyAt: time, attackCount: 0,
      nextEscapeAt: time + PEACEFUL_ESCAPE_INTERVAL, completedExchanges: 0 };
    initializeCombatPosition(agent, entriesAt(combat.x, combat.y).map(entry => entry.agent), time);
    agent.renderFromX = agent.x; agent.renderFromY = agent.y;
    agent.moveDuration = 0; agent.moveBudget = 0;
    agent.attack = null; agent.attackTargetId = null;
    agent.attackReady = Math.max(time, agent.attackReady || 0);
    agent.utility = null; agent.decisionPending = null;
    if (agent.foodDelivery?.receivedAt === null) agent.foodDelivery = null;
    agent.mode = "fight";
    agent.facing = side === 0 ? 1 : -1;
    environment.unitIndex?.update(agent);
  }

  function cancelProjectile(projectile, time) {
    vfx("projectile-cancel", time, projectile.source, projectile.target.agent, 0,
      { projectileId: projectile.vfxId, causeId: attackCauses.get(projectile.attack) });
    projectiles.delete(projectile);
    projectile.source.dnaProjectiles = (projectile.source.dnaProjectiles || []).filter(item => item !== projectile.visual);
  }

  function release(agent, time) {
    agent.dnaCombatEndedAt = time;
    if (agent.combat?.position) agent.combatPosition = { ...agent.combat.position, moving: false };
    agent.combat = null;
    agent.attack = null; agent.attackTargetId = null; agent.attackHit = true;
    if (agent.health <= 0) {
      for (const projectile of projectiles) if (projectile.source.health <= 0 || projectile.target.agent.health <= 0)
        cancelProjectile(projectile, time);
      return;
    }
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
    if (agent === target || combatTeam(agent) === combatTeam(target) ||
        !settled(agent, time) || !settled(target, time) || agent.x !== target.x || agent.y !== target.y ||
        agent.combat || !environment.combatSimulation && !canPursueCombat(agent, target, time, defending)) return false;
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
    if (!canRetreat(agent)) return false;
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
    if (entry.agent.health < previousHealth) entry.agent.dnaLastDamageAt = Math.max(entry.agent.dnaLastDamageAt || 0,
      Number.isFinite(evidence?.at) ? evidence.at : environment.simSeconds || 0);
    if (entry.agent.health <= 0) { entry.agent.attack = null; entry.agent.attackTargetId = null; }
    if (evidence) {
      if (["hit", "block", "area"].includes(evidence.kind)) activateDefense(entry.agent, attacker, evidence.at);
      const amount = Math.max(0, previousHealth - entry.agent.health);
      const event = vfx(evidence.kind || "hit", evidence.at, attacker, entry.agent, amount,
        { ...evidence, hurtStartedAt: entry.agent.hurtStartedAt, hurtCount: entry.agent.hurtCount });
      if (previousHealth > 0 && entry.agent.health <= 0)
        vfx("death", evidence.at, attacker, entry.agent, 0, { causeId: event?.id, diedAt: environment.simSeconds });
      return event;
    }
  }

  function activateDefense(defender, attacker, time) {
    const combat = defender.combat;
    if (!dnaDefensiveMelee(defender.stats?.dna) || defender.health <= 0 || !attacker ||
        !combat || combatTeam(defender) === combatTeam(attacker) || combat.defending) return;
    combat.defending = true;
    combat.nextAttackAt = Math.max(time, combat.waitingForAttack ? time : combat.nextAttackAt);
    delete combat.waitingForAttack;
    defender.attackReady = combat.nextAttackAt;
  }

  function emit(combat, kind, at, source, target, damage, detail = {}) {
    const sequence = (source.combat.eventSequence || 0) + 1;
    source.combat.eventSequence = sequence;
    const event = { id: combat.id + ":" + at + ":" + source.id + ":" + target.id + ":" + sequence,
      kind, at, sourceId: source.id, targetId: target.id, damage };
    source.combat.lastEvent = event;
    if (target.combat?.id === combat.id) {
      target.combat.lastEvent = event;
      if (["miss", "parry", "block", "stun"].includes(kind)) target.combat.lastReaction = event;
    }
    // Hit evidence is captured at the HP mutation; stun/counter are separate cues.
    if (["stun", "counter"].includes(kind)) vfx(kind, at, source, target, 0, detail);
  }

  function beginAttack(attacker, target, time, counter) {
    const combat = attacker.combat, mode = combatPositionMode(attacker, target);
    if (!mode) {
      const capabilities = combatAbilityStats(attacker) || creatureAttackRole(attacker.species);
      const defensiveMelee = dnaDefensiveMelee(attacker.stats?.dna) && (combat.defending || dnaCanAttack(attacker));
      if (dnaDefensiveMelee(attacker.stats?.dna) && !combat.defending && !dnaCanAttack(attacker)) combat.waitingForAttack = true;
      combat.nextAttackAt = capabilities && !capabilities.melee && !capabilities.ranged && !defensiveMelee ? Infinity : Math.max(combat.nextAttackAt, time + .05);
      return;
    }
    const profile = combatProfile({ ...attacker, attack: { attackMode: mode } });
    if (!counter) combat.attackCount++;
    if (combatAbilityStats(attacker) && !profile.attackSpeed) { combat.nextAttackAt = Infinity; return; }
    const heavy = !counter && profile.primary === "piercing" && combat.attackCount % 3 === 0;
    const timingRate = profile.timingRate || 1;
    const windup = counter ? (environment.combatRules?.counterWindup ?? .12) / timingRate : profile.windup + (heavy ? .15 : 0);
    const timing = CREATURE_ATTACK_TIMINGS[attacker.species] || (attacker.species === "spiny-back-beetle" ? BEETLE_ANIMATIONS.attack :
      { durationMs: AGENT_ATTACK_DURATION * 1000 });
    const recovery = Math.max(profile.recovery, (timing.durationMs / 1000 - (timing.hitTimeMs / 1000 || AGENT_ATTACK_HIT_TIME)) / timingRate);
    const duration = windup + recovery;
    attacker.attack = { combatId: combat.id, startedAt: time, hitAt: time + windup, endsAt: time + duration,
      speed: timing.durationMs / 1000 / duration, directionX: Math.sign(target.combat.position.x - combat.position.x) || attacker.facing || 1,
      targetId: target.id, targetKind: "agent", targetX: combat.x, targetY: combat.y,
      resolved: false, hit: false, counter, heavy, attackMode: mode, recovery, timingRate, interval: profile.attackInterval };
    if (combatAbilityStats(attacker)) {
      attacker.attack.hitIndex = 0; attacker.attack.heavy = false;
      attacker.attack.hitCount = counter ? 1 : actionCount(combatAbilityStats(attacker).hits);
    }
    if (combatAbilityStats(attacker) && mode === "melee" && !counter) attacker.attack.meleeContacts = [attacker.attack.hitAt];
    if (mode === "ranged") {
      attacker.attack.dnaRanged = true;
      attacker.attack.launchedAt = attacker.attack.hitAt;
      attacker.attack.shotLaunches = [attacker.attack.hitAt];
    }
    const causeId = combatVfxToken(environment, "attack");
    attackCauses.set(attacker.attack, causeId);
    if (!counter) vfx("attack", time, attacker, target, 0, { causeId, mode, endsAt: attacker.attack.hitAt });
    combat.cycleStartedAt = time;
    combat.nextAttackAt = attacker.attack.endsAt + profile.attackInterval;
    combat.targetId = target.id;
    combat.parryUntil = !counter && profile.primary === "blade" && time >= combat.parryReadyAt ? time + .2 : 0;
    attacker.attackReady = combat.nextAttackAt;
    attacker.attackInterval = profile.attackInterval;
    combat.position.moving = false;
    attacker.attackStartedAt = time; attacker.animationStartedAt = time;
    attacker.attackTargetId = target.id; attacker.attackHit = false;
    attacker.mode = attacker.species === "spiny-back-beetle" ? "attack" : "fight";
    if (counter && environment.combatRules?.counterCooldown) attacker.dnaCounterReadyAt = time + environment.combatRules.counterCooldown;
    if (counter) emit(combat, "counter", time, attacker, target, 0, { causeId, mode, endsAt: attacker.attack.hitAt });
  }

  function restoreHealth(agent, amount, at, kind, detail = {}) {
    const previous = agent.health;
    if (agent.health > 0) agent.health = Math.min(agent.stats.health, agent.health + amount);
    const restored = Math.max(0, agent.health - previous);
    if (restored > 0 && kind) vfx(kind, at, agent, agent, restored, { toId: agent.id, ...detail });
  }

  function resetAttackWait(agent, time) {
    if (agent.health <= 0) return;
    const attack = agent.attack, readyAt = attack ? Math.max(time, attack.endsAt) : time;
    if (attack) attack.defenseResetAt = time;
    agent.attackReady = readyAt;
    agent.dnaScanReady = time;
    if (agent.combat) agent.combat.nextAttackAt = readyAt;
  }

  function neutralDefenseReaction(defender, accuracy, time, counter, mode) {
    if (!defender.species || defender.stats?.dna) return null;
    const profile = combatProfile(defender), random = environment.combatRandom || Math.random;
    const available = time >= Math.max(defender.combat?.stunnedUntil || 0, defender.dnaStunnedUntil || 0);
    if (available && random() < Math.max(0, profile.evasion - accuracy / 100)) return { kind: "miss", multiplier: 0 };
    if (available && !counter && time >= (defender.dnaReactionReadyAt || 0)) {
      if (mode === "melee" && random() < profile.parry) return { kind: "parry", multiplier: 0 };
      if (random() < profile.block) return { kind: "block", multiplier: 1 - profile.blockReduction };
    }
    return { kind: null, multiplier: 1 };
  }

  function dnaHit(attacker, target, time) {
    const attack = attacker.attack, defender = target.agent, combat = attacker.combat, defense = defender.combat;
    const source = combatAbilityStats(attacker), shield = combatAbilityStats(defender);
    const random = environment.combatRandom || Math.random;
    attack.resolved = true; attacker.attackHit = true;
    if (defender.health <= 0 || defender.combat?.id !== combat.id) return;
    let damage = combatDamage(attacker, defender, (environment.damageRandom || Math.random)(), environment.combatRules);
    let reaction = null;
    if (source && attack.hitIndex > 0) damage *= source.comboPower / 100;
    let incomingDamage = damage;
    const neutral = neutralDefenseReaction(defender, source?.accuracy || 0, time, attack.counter, "melee");
    if (neutral) { damage *= neutral.multiplier; reaction = neutral.kind; }
    else if (random() * 100 < Math.max(0, (shield?.evasion || 0) - (source?.accuracy || 0))) { damage = 0; reaction = "miss"; }
    else if (!attack.counter && shield && time >= (defender.dnaReactionReadyAt || 0) && random() * 100 < shield.parry) { damage = 0; reaction = "parry"; }
    else if (!attack.counter && shield && time >= (defender.dnaReactionReadyAt || 0) && random() * 100 < shield.block) { damage *= 1 - combatProfile(defender).blockReduction; reaction = "block"; }
    else if (!shield && !attack.counter) {
      const profile = combatProfile(defender), defense = defender.combat;
      if (time < defense.parryUntil && time >= defense.parryReadyAt && profile.primary === "blade") {
        damage = 0; defense.parryReadyAt = time + 3; defense.parryUntil = 0; reaction = "parry";
      } else if (profile.primary === "carapace" && time >= defense.blockReadyAt && time >= defense.stunnedUntil) {
        damage *= 1 - profile.blockReduction; defense.blockReadyAt = time + 2.5; reaction = "block";
      }
    }
    if (["parry", "block"].includes(reaction) && environment.combatRules?.reactionCooldown)
      defender.dnaReactionReadyAt = time + environment.combatRules.reactionCooldown;
    const offense = combatProfile(attacker), critical = damage > 0 && random() < offense.criticalChance;
    if (critical) { damage *= offense.criticalMultiplier; incomingDamage *= offense.criticalMultiplier; }
    attack.damage = damage; attack.hit = damage > 0;
    const previous = defender.health;
    const evidence = { kind: reaction || "hit", at: time, critical, counter: !!attack.counter,
      mode: attack.attackMode, hitIndex: attack.hitIndex || 0, causeId: attackCauses.get(attack) };
    const hitEvent = damage > 0 ? receiveDamage(target, damage, attacker, evidence) : vfx(evidence.kind, time, attacker, defender, 0, evidence);
    activateDefense(defender, attacker, time);
    if (damage > 0) defender.hurtStartedAt = time;
    if (["parry", "block"].includes(reaction)) resetAttackWait(defender, time);
    const dealt = Math.max(0, previous - defender.health);
    if (source && dealt > 0) restoreHealth(attacker, dealt * source.lifesteal / 100, time, "drain", {
      causeId: hitEvent?.id, fromId: defender.id, from: { x: defender.x, y: defender.y } });
    combat.completedExchanges++; defense.completedExchanges++;
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
      const others = members(combat).filter(entry => entry.agent !== defender && entry.agent.combat.side !== combat.side).slice(0, actionCount(source.area));
      for (const entry of others) receiveDamage(entry, damage * source.areaPower / 100, attacker,
        { kind: "area", at: time, causeId: hitEvent?.id, mode: attack.attackMode });
    }
    if (!source && attack.heavy && damage > 0 && reaction !== "parry" && defender.health > 0 && time >= defender.combat.stunImmuneUntil) {
      const duration = .5 * (1 - (shield?.tenacity || 0) / 100), defense = defender.combat;
      defense.stunnedUntil = time + duration; defense.stunImmuneUntil = time + duration + (environment.combatRules?.stunImmunity ?? 2); defense.parryUntil = 0;
      defender.attack = null; defender.attackTargetId = null;
      defense.nextAttackAt = Math.max(defense.nextAttackAt, defense.stunnedUntil);
      defense.cycleStartedAt = defense.nextAttackAt;
      emit(combat, "stun", time, attacker, defender, damage, { causeId: hitEvent?.id, duration, endsAt: time + duration }); reaction = null;
    }
    if (!attack.counter && dealt > 0 && shield?.reflection > 0 && attacker.health > 0) {
      const entry = entriesAt(combat.x, combat.y).find(entry => entry.agent === attacker);
      if (entry) receiveDamage(entry, incomingDamage * shield.reflection / 100, defender,
        { kind: "reflect", at: time, causeId: hitEvent?.id, fromId: defender.id, toId: attacker.id });
    }
    if (defender.health > 0 && attacker.health > 0 && !defender.attack && !attack.counter && reaction && reaction !== "miss" &&
        (shield ? shield.power > 0 && shield.counter > 0 && time >= (defender.dnaCounterReadyAt || 0) && random() * 100 < shield.counter : !defender.species)) beginAttack(defender, attacker, time, true);
    if (source && !attack.counter && attacker.health > 0 && defender.health > 0 && ++attack.hitIndex < attack.hitCount) {
      attack.resolved = false; attack.hitAt = time + source.comboSpeed;
      if (attack.meleeContacts) attack.meleeContacts.push(attack.hitAt);
      attack.endsAt = Math.max(attack.endsAt, attack.hitAt + attack.recovery);
      combat.nextAttackAt = Number.isFinite(attack.defenseResetAt) ? Math.max(attack.endsAt, attack.defenseResetAt) :
        Math.max(combat.nextAttackAt, attack.endsAt + attack.interval);
      attacker.attackReady = combat.nextAttackAt;
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
    if (agent.attack) agent.dnaLastAttackAt = Math.max(agent.dnaLastAttackAt || 0,
      agent.attack.endsAt || agent.attack.startedAt || time);
    const previous = agent.dnaRecoveryAt;
    agent.dnaRecoveryAt = time;
    if (bleed) agent.dnaLastDamageAt = Math.max(agent.dnaLastDamageAt || 0, Math.min(time, bleed.endsAt));
    if (agent.health <= 0 || agent.combat || creatureSpawning(agent, time) || agent.birth && time < agent.birth.readyAt ||
        bleed && time <= bleed.endsAt || agent.attack && time < agent.attack.endsAt || !Number.isFinite(previous)) return;
    const start = Math.max(previous, agent.birth?.readyAt || 0,
      Math.max(agent.dnaCombatEndedAt || 0, agent.dnaLastAttackAt || 0, agent.dnaLastDamageAt || 0,
        agent.hurtStartedAt || 0) + UNIT_RECOVERY_RULES.delay);
    const rate = outOfCombatRecoveryRate(agent);
    if (time > start && rate > 0) restoreHealth(agent, rate * (time - start), time, "regeneration", { startedAt: start });
  }

  function resolveHit(attacker, target, time) {
    const active = attacker.attack;
    if (active.attackMode === "ranged") {
      active.resolved = true; attacker.attackHit = true;
      if (target.agent.health <= 0 || target.agent.combat?.id !== attacker.combat.id) return;
      const from = attacker.combat.position, to = target.agent.combat.position;
      const arrivesAt = time + Math.max(.1, dnaProjectileDuration(Math.hypot(to.x - from.x, to.y - from.y)));
      const visual = { launchedAt: time, hitAt: arrivesAt, fromX: attacker.x, fromY: attacker.y,
        targetX: target.agent.x, targetY: target.agent.y, targetId: target.agent.id,
        arenaFrom: { x: from.x, y: from.y }, arenaTo: { x: to.x, y: to.y } };
      const projectileId = combatVfxToken(environment, "projectile"), causeId = attackCauses.get(active);
      attacker.dnaProjectiles = [...(attacker.dnaProjectiles || []), visual];
      projectiles.add({ source: attacker, target, attack: active, hitIndex: active.hitIndex || 0, visual,
        arrivesAt, launchedAt: time, launched: true, vfxId: projectileId });
      vfx("shoot", time, attacker, target.agent, 0, { projectileId, causeId, mode: "ranged", hitIndex: active.hitIndex || 0,
        arrivesAt, from: { x: attacker.x, y: attacker.y }, to: { x: target.agent.x, y: target.agent.y },
        arenaFrom: visual.arenaFrom, arenaTo: visual.arenaTo });
      const stats = combatAbilityStats(attacker);
      if (stats && !active.counter && ++active.hitIndex < active.hitCount) {
        active.resolved = false; active.hitAt = time + stats.comboSpeed;
        active.shotLaunches.push(active.hitAt);
        active.endsAt = Math.max(active.endsAt, active.hitAt + active.recovery);
        attacker.combat.nextAttackAt = Number.isFinite(active.defenseResetAt) ? Math.max(active.endsAt, active.defenseResetAt) :
          Math.max(attacker.combat.nextAttackAt, active.endsAt + active.interval);
        attacker.attackReady = attacker.combat.nextAttackAt;
      }
      return;
    }
    if (combatSeparation(attacker, target.agent) > COMBAT_MELEE_RANGE + 1e-8) {
      active.resolved = true; attacker.attackHit = true;
      vfx("miss", time, attacker, target.agent, 0, { causeId: attackCauses.get(active), mode: "melee", critical: false });
      return;
    }
    if (combatAbilityStats(attacker) || combatAbilityStats(target.agent)) return dnaHit(attacker, target, time);
    const attack = attacker.attack, defender = target.agent, combat = attacker.combat;
    attack.resolved = true; attacker.attackHit = true;
    if (defender.health <= 0 || defender.combat?.id !== combat.id) return;
    const defense = defender.combat, profile = combatProfile(defender);
    let damage = combatDamage(attacker, defender, (environment.damageRandom || Math.random)(), environment.combatRules);
    let reaction = null;
    const neutral = neutralDefenseReaction(defender, 0, time, attack.counter, "melee");
    if (neutral) { damage *= neutral.multiplier; reaction = neutral.kind; }
    else if (!attack.counter && time < defense.parryUntil && time >= defense.parryReadyAt && profile.primary === "blade") {
      damage = 0; defense.parryReadyAt = time + 3; defense.parryUntil = 0; reaction = "parry";
    } else if (!attack.counter && profile.primary === "carapace" && time >= defense.blockReadyAt && time >= defense.stunnedUntil) {
      damage *= 1 - profile.blockReduction;
      defense.blockReadyAt = time + 2.5; reaction = "block";
    }
    if (["parry", "block"].includes(reaction) && environment.combatRules?.reactionCooldown)
      defender.dnaReactionReadyAt = time + environment.combatRules.reactionCooldown;
    const offense = combatProfile(attacker), critical = damage > 0 && (environment.combatRandom || Math.random)() < offense.criticalChance;
    if (critical) damage *= offense.criticalMultiplier;
    attack.damage = damage; attack.hit = damage > 0;
    const evidence = { kind: reaction || "hit", at: time, counter: !!attack.counter, mode: "melee",
      critical, hitIndex: 0, causeId: attackCauses.get(attack) };
    const hitEvent = damage > 0 ? receiveDamage(target, damage, attacker, evidence) : vfx(evidence.kind, time, attacker, defender, 0, evidence);
    if (damage > 0) defender.hurtStartedAt = time;
    if (["parry", "block"].includes(reaction)) resetAttackWait(defender, time);
    combat.completedExchanges++; defense.completedExchanges++;
    emit(combat, reaction || "hit", time, attacker, defender, damage);
    if (defender.health <= 0) return;
    if (attack.heavy && damage > 0 && reaction !== "parry" && time >= defense.stunImmuneUntil) {
      defense.stunnedUntil = time + .5; defense.stunImmuneUntil = time + 2.5; defense.parryUntil = 0;
      defender.attack = null; defender.attackTargetId = null;
      defense.nextAttackAt = Math.max(defense.nextAttackAt, defense.stunnedUntil);
      defense.cycleStartedAt = defense.nextAttackAt;
      emit(combat, "stun", time, attacker, defender, damage,
        { causeId: hitEvent?.id, duration: .5, endsAt: time + .5 }); reaction = null;
    }
    if (reaction && reaction !== "miss" && !defender.attack && !defender.species && attacker.health > 0) beginAttack(defender, attacker, time, true);
  }


  function projectileHit(projectile, time) {
    const { source, target } = projectile, defender = target.agent;
    if (!dnaProjectileValid({ ...source, retreat: null }, { ...defender, retreat: null })) return;
    const offense = attackStats(source), defense = combatAbilityStats(defender), random = environment.combatRandom || Math.random;
    let damage = combatDamage({ ...source, attack: projectile.attack }, defender, (environment.damageRandom || Math.random)(), environment.combatRules);
    let reaction = null;
    if (projectile.hitIndex > 0) damage *= offense.comboPower / 100;
    let incomingDamage = damage;
    const neutral = neutralDefenseReaction(defender, offense.accuracy, time, projectile.attack.counter, "ranged");
    if (neutral) { damage *= neutral.multiplier; reaction = neutral.kind; }
    else if (random() * 100 < Math.max(0, (defense?.evasion || 0) - offense.accuracy)) { damage = 0; reaction = "miss"; }
    else if (time >= (defender.dnaReactionReadyAt || 0) && random() * 100 < (defense?.block || 0)) { damage *= 1 - combatProfile(defender).blockReduction; reaction = "block"; }
    else if (!defense) {
      const profile = combatProfile(defender), state = defender.combat || defender;
      if (profile.primary === "carapace" && time >= (state.blockReadyAt || 0) && time >= (state.stunnedUntil || 0)) { damage *= 1 - profile.blockReduction; state.blockReadyAt = time + 2.5; reaction = "block"; }
    }
    if (["parry", "block"].includes(reaction) && environment.combatRules?.reactionCooldown)
      defender.dnaReactionReadyAt = time + environment.combatRules.reactionCooldown;
    const profile = combatProfile(source), critical = damage > 0 && random() < profile.criticalChance;
    if (critical) { damage *= profile.criticalMultiplier; incomingDamage *= profile.criticalMultiplier; }
    const previous = defender.health;
    const evidence = { kind: reaction || "hit", at: time, mode: "ranged", critical, hitIndex: projectile.hitIndex,
      causeId: attackCauses.get(projectile.attack), projectileId: projectile.vfxId };
    const hitEvent = damage > 0 ? receiveDamage(target, damage, source, evidence) : vfx(evidence.kind, time, source, defender, 0, evidence);
    activateDefense(defender, source, time);
    if (damage > 0) defender.hurtStartedAt = time;
    if (["parry", "block"].includes(reaction)) resetAttackWait(defender, time);
    const dealt = Math.max(0, previous - defender.health);
    restoreHealth(source, dealt * offense.lifesteal / 100, time, "drain", {
      causeId: hitEvent?.id, fromId: defender.id, from: { x: defender.x, y: defender.y } });
    if (dealt > 0 && defense?.reflection > 0) receiveDamage({ agent: source, game: environment.games.get(source.ownerId) || null }, incomingDamage * defense.reflection / 100, defender,
      { kind: "reflect", at: time, causeId: hitEvent?.id, fromId: defender.id, toId: source.id });
    if (defender.health > 0 && dealt > 0 && random() * 100 < offense.stun && time >= (defender.dnaStunImmuneUntil || defender.combat?.stunImmuneUntil || 0)) {
      const endsAt = time + offense.stunTime * (1 - (defense?.tenacity || 0) / 100);
      defender.dnaStunnedUntil = endsAt; defender.dnaStunImmuneUntil = endsAt + (environment.combatRules?.stunImmunity ?? 2);
      if (defender.combat) { defender.combat.stunnedUntil = endsAt; defender.combat.nextAttackAt = Math.max(defender.combat.nextAttackAt, endsAt); }
      defender.attack = null; defender.attackTargetId = null;
      vfx("stun", time, source, defender, 0, { causeId: hitEvent?.id, duration: endsAt - time, endsAt });
    }
    if (dealt > 0 && offense.area > 0) {
      const others = entriesAt(defender.x, defender.y).filter(entry => entry.agent !== defender && entry.agent.health > 0 && combatTeam(entry.agent) !== combatTeam(source)).slice(0, actionCount(offense.area));
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
    if (source.attack === projectile.attack) { source.attack.hit = dealt > 0; if (!source.attack.combatId) source.attack.resolved = true; }
    return { damage: dealt, kind: reaction || "hit" };
  }

  function updateProjectiles(time, combatId) {
      for (const projectile of [...projectiles].sort((a, b) => a.arrivesAt - b.arrivesAt)) {
        if (!projectiles.has(projectile)) continue;
        if (projectile.source.combat && projectile.source.combat.id !== combatId) continue;
        if (!(projectile.launched ? dnaProjectileValid({ ...projectile.source, retreat: null }, { ...projectile.target.agent, retreat: null }) :
            dnaProjectileValid(projectile.source, projectile.target.agent)) ||
            projectile.source.ownerId && !environment.games.get(projectile.source.ownerId)?.agents.includes(projectile.source) ||
            projectile.target.game && !projectile.target.game.agents.includes(projectile.target.agent) ||
            !projectile.launched && projectile.source.attack !== projectile.attack) {
          cancelProjectile(projectile, time);
          continue;
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
          projectiles.delete(projectile);
          projectileHit(projectile, projectile.arrivesAt);
          projectile.source.dnaProjectiles = (projectile.source.dnaProjectiles || []).filter(item => item !== projectile.visual);
        }
      }
  }

  function update(agent, time) {
    if (agent.attack) agent.dnaLastAttackAt = Math.max(agent.dnaLastAttackAt || 0,
      agent.attack.endsAt || agent.attack.startedAt || time);
    if (!canRetreat(agent)) updateRetreat(agent, time, false);
    if (!agent.combat) updateProjectiles(time);
    updateEffects(agent, time);
    if (agent.health <= 0) { agent.attack = null; return false; }
    if (time < (agent.dnaStunnedUntil || 0) && !agent.combat) return true;
    if (!agent.combat) contact(agent, time);
    const combat = agent.combat;
    if (!combat) return false;
    if (agent.x !== combat.x || agent.y !== combat.y) { release(agent, time); return false; }
    if (processed.get(combat.id) === time) return true;
    processed.set(combat.id, time);
    let participants = members(combat).sort((a, b) => String(a.agent.id).localeCompare(String(b.agent.id)));
    for (const { agent: member } of participants) {
      if (member.combat.version !== 2) { const old = member.combat; attach(member, old, old.side, time); }
      activateDefense(member, participants.find(entry => entry.agent.combat.side !== member.combat.side)?.agent, time);
      dropCarriedResources(environment, member); member.moveBudget = 0;
      initializeCombatPosition(member, participants.map(entry => entry.agent), time);
    }
    let iterations = 0;
    while (iterations++ < 10000) {
      participants = members(combat).sort((a, b) => String(a.agent.id).localeCompare(String(b.agent.id)));
      if (new Set(participants.map(entry => entry.agent.combat.side)).size < 2) { finish(combat, time); processed.delete(combat.id); return true; }
      const events = participants.flatMap(({ agent: member }) => {
        if (member.attack) {
          return [{ agent: member, at: member.attack.resolved ? member.attack.endsAt : member.attack.hitAt,
            kind: member.attack.resolved ? "end" : "hit" }];
        }
        return [{ agent: member, at: Math.max(member.combat.nextAttackAt, member.combat.stunnedUntil), kind: "start" }];
      });
      for (const projectile of projectiles) if (projectile.source.combat?.id === combat.id)
        events.push({ agent: projectile.source, at: projectile.launched ? projectile.arrivesAt : projectile.launchedAt, kind: "projectile" });
      events.push({ agent: participants[0].agent, at: Math.min(...participants.map(entry => entry.agent.combat.position.at)) + .05, kind: "move" });
      const ready = events.filter(event => event.at <= time + 1e-8).sort((a, b) => a.at - b.at ||
        ({ projectile: 0, move: 1, hit: 2, end: 3, start: 4 }[a.kind] - { projectile: 0, move: 1, hit: 2, end: 3, start: 4 }[b.kind]) || String(a.agent.id).localeCompare(String(b.agent.id)));
      if (!ready.length) break;
      const event = ready[0], member = event.agent;
      advanceCombatPositions(participants.map(entry => entry.agent), event.at);
      if (event.kind === "move" || event.kind === "projectile") { updateProjectiles(event.at, combat.id); continue; }
      const opponents = participants.filter(entry => entry.agent.combat.side !== member.combat.side);
      if (event.kind === "hit") {
        const target = opponents.find(entry => entry.agent.id === member.attack.targetId);
        if (target) resolveHit(member, target, event.at);
        else { member.attack.resolved = true; member.attackHit = true; }
      } else if (event.kind === "end") {
        member.combat.nextAttackAt = Number.isFinite(member.attack.defenseResetAt) ? Math.max(event.at, member.attack.defenseResetAt) :
          Math.max(member.combat.nextAttackAt, event.at + (member.attack.interval ?? combatProfile(member).attackInterval));
        member.attackReady = member.combat.nextAttackAt;
        member.attack = null; member.attackTargetId = null;
        member.mode = member.species === "spiny-back-beetle" ? "idle" : "fight";
      } else {
        if (member.ownerId && canRetreat(member)) {
          const allies = participants.filter(entry => entry.agent.combat.side === member.combat.side);
          const assessment = combatSurvival(member, opponents.map(entry => entry.agent), allies.map(entry => entry.agent));
          member.survivalState = assessment.state;
          if (assessment.retreat) beginRetreat(member, event.at);
          if (member.retreat && member.combat.completedExchanges >= COMBAT_RETREAT_EXCHANGES && event.at >= member.combat.nextEscapeAt &&
              escape(member, opponents, event.at, true)) continue;
        }
        const target = opponents.sort((a, b) => combatSeparation(member, a.agent) - combatSeparation(member, b.agent) ||
          (member.species && combatDisposition(member) === "aggressive" ? Number(militaryAgent(b.agent, b.agent.tribe)) - Number(militaryAgent(a.agent, a.agent.tribe)) : 0) ||
          a.agent.combat.joinedAt - b.agent.combat.joinedAt || String(a.agent.id).localeCompare(String(b.agent.id)))[0];
        beginAttack(member, target.agent, event.at, false);
      }
    }
    advanceCombatPositions(members(combat).map(entry => entry.agent), time);
    updateProjectiles(time, combat.id);
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
