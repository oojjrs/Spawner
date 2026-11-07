import { combatProfile } from "../server/combat-stats.mjs";

export function unitAttackCooldown(agent, time) {
  if (!agent || !(agent.health > 0) || !Number.isFinite(time)) return null;
  const dna = agent.stats?.dna;
  if (dna && !(dna.melee && dna.meleePower > 0 && dna.meleeSpeed > 0 || dna.ranged && dna.rangedPower > 0 && dna.rangedSpeed > 0)) return null;
  if (agent.stats?.canAttack === false) return null;
  const attack = agent.attack;
  if (Number.isFinite(attack?.defenseResetAt)) return 1;
  if (Number.isFinite(attack?.endsAt) && time < attack.endsAt) return 0;
  const readyAt = agent.attackReady ?? agent.combat?.nextAttackAt ?? 0;
  if (readyAt <= time) return 1;
  const buildingInterval = attack && !attack.interval && Number.isFinite(attack.endsAt) ? readyAt - attack.endsAt : null;
  const interval = attack?.interval ?? buildingInterval ?? agent.attackInterval ?? combatProfile(agent).attackInterval;
  if (!(interval > 0) || !Number.isFinite(interval) || !Number.isFinite(readyAt)) return 0;
  return Math.max(0, Math.min(1, 1 - (readyAt - time) / interval));
}

export function drawUnitAttackRing(context, agent, time, x, y, hpRadius) {
  const ratio = unitAttackCooldown(agent, time);
  if (ratio === null || !Number.isFinite(hpRadius) || hpRadius <= 0) return false;
  const healthThickness = Math.max(1, Math.min(6, hpRadius * .064));
  const thickness = Math.max(.75, Math.min(2, hpRadius * .025));
  const inset = (healthThickness + 2 + thickness) / 2 + .75;
  const radius = hpRadius - inset, depth = hpRadius * .327 - inset;
  if (radius <= 0 || depth <= 0) return false;
  context.save(); context.lineCap = "round"; context.lineWidth = thickness;
  context.strokeStyle = "#4b422d";
  context.beginPath(); context.ellipse(x, y, radius, depth, 0, 0, Math.PI * 2); context.stroke();
  if (ratio > 0) {
    context.strokeStyle = "#f5c85b";
    context.beginPath(); context.ellipse(x, y, radius, depth, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio); context.stroke();
  }
  context.restore(); return true;
}
