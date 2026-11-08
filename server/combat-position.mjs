import { dnaCanAttack } from "./dna-unit.mjs";
import { DNA_ACTION_RULES, dnaAttackMode, dnaDefensiveMelee } from "./dna-actions.mjs";
import { creatureAttackRole, creatureAttackMode } from "./creature-attack-role.mjs";
import { unitDisplaySize } from "../client/unit-size.mjs";

export function combatPositionRole(agent) {
  const role = creatureAttackRole(agent.species);
  if (role) return role.position;
  if (agent.stats?.dna?.ranged && !agent.stats.dna.melee) return "back";
  if (agent.attributes?.carapace > 0 || agent.dna?.pieces?.some(piece => piece.gene === "carapace")) return "front";
  return "middle";
}

export function combatPositionRadius(agent) {
  return Math.max(.2, unitDisplaySize(agent) * .55);
}

export function initializeCombatPosition(agent, units, time) {
  if (!agent.combat || Number.isFinite(agent.combat.position?.x) && Number.isFinite(agent.combat.position?.y)) return;
  const role = combatPositionRole(agent), side = agent.combat.side;
  const allies = units.filter(other => other === agent || other.health > 0 && (other.combat ?
    other.combat.id === agent.combat.id && other.combat.side === side : agent.ownerId ?
      other.ownerId === agent.ownerId : !other.ownerId && agent.species && other.species === agent.species));
  const same = allies.filter(other => other !== agent && combatPositionRole(other) === role && other.combat?.position);
  const slot = same.length, lane = slot ? Math.ceil(slot / 2) * (slot % 2 ? -1 : 1) : 0;
  const radius = allies.reduce((value, other) => Math.max(value, combatPositionRadius(other)), .35);
  const depth = role === "front" ? 0 : role === "back" ? 2 : 1;
  const x = (side ? 1 : -1) * (radius + .8 + (depth + Math.floor(slot / 7)) * (radius * 2 + .3) + Math.max(0, (agent.combat.initialDistance || 1) - 1) / 2);
  const y = lane * (radius * 2 + .2);
  agent.combat.position = { x, y, homeX: x, homeY: y, fromX: x, fromY: y, at: time, fromAt: time, moving: false, moveStartedAt: time, role };
}

export function combatSeparation(agent, target) {
  const source = agent.combat?.position, destination = target.combat?.position;
  if (agent.combat?.id === target.combat?.id && source && destination)
    return Math.max(0, Math.hypot(source.x - destination.x, source.y - destination.y) - combatPositionRadius(agent) - combatPositionRadius(target));
  return Math.abs(agent.x - target.x) + Math.abs(agent.y - target.y);
}

export function combatPositionMode(agent, target) {
  const distance = combatSeparation(agent, target);
  if (agent.stats?.dna) return dnaAttackMode(agent.stats.dna, distance, agent.combat?.defending || dnaCanAttack(agent));
  if (agent.species) return creatureAttackMode(agent, distance);
  return distance <= DNA_ACTION_RULES.meleeRange ? "melee" : null;
}

export function advanceCombatPositions(units, time) {
  for (const unit of units) initializeCombatPosition(unit, units, time);
  const positions = new Map(units.map(unit => [unit, { ...unit.combat.position }]));
  const next = new Map();
  for (const unit of units) {
    const position = positions.get(unit), elapsed = Math.max(0, time - position.at);
    if (!elapsed) { next.set(unit, { x: position.x, y: position.y }); continue; }
    const enemies = units.filter(other => other.combat.side !== unit.combat.side);
    const target = enemies.find(other => other.id === unit.attack?.targetId) || enemies.sort((a, b) => combatSeparation(unit, a) - combatSeparation(unit, b) || String(a.id).localeCompare(String(b.id)))[0];
    const point = target && positions.get(target);
    if (point) {
      unit.combat.targetId = target.id;
      const direction = Math.sign(point.x - position.x);
      if (direction) unit.facing = direction;
    }
    if (!point || unit.attack || time < Math.max(unit.combat.stunnedUntil || 0, unit.dnaStunnedUntil || 0)) {
      next.set(unit, { x: position.x, y: position.y }); continue;
    }
    const role = combatPositionRole(unit), capabilities = unit.stats?.dna || creatureAttackRole(unit.species);
    const separation = combatSeparation(unit, target), dx = point.x - position.x, dy = point.y - position.y;
    const length = Math.hypot(dx, dy) || 1;
    const defensiveMelee = dnaDefensiveMelee(unit.stats?.dna) && (unit.combat.defending || dnaCanAttack(unit));
    if (capabilities && !capabilities.melee && !capabilities.ranged && !defensiveMelee) { next.set(unit, { x: position.x, y: position.y }); continue; }
    const closeMelee = capabilities?.melee && separation <= DNA_ACTION_RULES.meleeRange;
    const desired = role === "back" && capabilities?.ranged && !closeMelee ? 2.3 : .75;
    const retreat = role === "back" && capabilities?.ranged && !capabilities.melee && separation < 1.8;
    const travel = Math.min(Math.abs(separation - desired), Math.max(.25, unit.stats?.dna?.movement || unit.stats?.speed || .5) * 3 * elapsed);
    const direction = retreat ? -1 : separation > desired + .05 ? 1 : 0;
    next.set(unit, { x: Math.max(-8, Math.min(8, position.x + dx / length * travel * direction)),
      y: Math.max(-8, Math.min(8, position.y + dy / length * travel * direction)) });
  }
  for (let pass = 0; pass < 8; pass++) for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = units[i], b = units[j], first = next.get(a), second = next.get(b);
    const dx = second.x - first.x, dy = second.y - first.y, gap = Math.hypot(dx, dy);
    const minimum = combatPositionRadius(a) + combatPositionRadius(b) + .08;
    if (gap >= minimum) continue;
    const push = (minimum - gap) / 2, x = gap ? dx / gap : 0, y = gap ? dy / gap : 1;
    first.x -= x * push; first.y -= y * push; second.x += x * push; second.y += y * push;
  }
  for (const unit of units) {
    const previous = positions.get(unit), point = next.get(unit);
    if (!(time > previous.at)) continue;
    const moving = Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-7;
    unit.combat.position = { ...previous, ...point, fromX: previous.x, fromY: previous.y, fromAt: previous.at, at: time,
      moving, moveStartedAt: moving && !previous.moving ? previous.at : previous.moveStartedAt };
  }
}
