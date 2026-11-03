export const DNA_ACTION_RULES = Object.freeze({ meleeRange: 1, rangedRange: 3, projectileSpeed: 6, rangedPowerBase: 1.4, healRange: 2, healInterval: 2, healPower: 1 });

export function dnaAttackMode(stats, distance) {
  if (stats.melee && distance <= DNA_ACTION_RULES.meleeRange) return "melee";
  if (stats.ranged && distance <= DNA_ACTION_RULES.rangedRange) return "ranged";
  return null;
}

export function dnaProjectileDuration(distance) {
  return Math.max(0, distance) / DNA_ACTION_RULES.projectileSpeed;
}

export function dnaHealTarget(source, agents, team, distance) {
  return agents.filter(target => target !== source && target.health > 0 && !target.hidden && !target.retreat &&
    team(target) === team(source) && target.health < target.stats.health && distance(source, target) <= DNA_ACTION_RULES.healRange)
    .sort((a, b) => a.health / a.stats.health - b.health / b.stats.health || String(a.id).localeCompare(String(b.id)))[0] || null;
}

export function dnaHealAmount(target) {
  return DNA_ACTION_RULES.healPower * (1 + (target.stats.dna?.healing || target.stats.healing || 0) / 100);
}

export function dnaProjectileValid(source, target) {
  return !!source && !!target && source.health > 0 && target.health > 0 && !source.hidden && !target.hidden && !source.retreat && !target.retreat;
}

export function dnaAttackStats(stats, mode) {
  return { power: mode === "ranged" ? stats.rangedPower : stats.meleePower, speed: mode === "ranged" ? stats.rangedSpeed : stats.meleeSpeed };
}

export function dnaHealAllocations(source, agents, team, distance) {
  const stats = source.stats.dna || source.stats;
  let remaining = Number(stats.healerCount ?? stats.healer ?? 0);
  const result = [], targets = agents.filter(target => target !== source && target.health > 0 && !target.hidden && !target.retreat &&
    team(target) === team(source) && target.health < target.stats.health && distance(source, target) <= DNA_ACTION_RULES.healRange)
    .sort((a, b) => a.health / a.stats.health - b.health / b.stats.health || String(a.id).localeCompare(String(b.id)));
  for (const target of targets) {
    if (remaining <= 1e-9) break;
    const unit = dnaHealAmount(target), amount = Math.min(target.stats.health - target.health, remaining * unit);
    if (amount > 0) { result.push({ target, amount }); remaining -= amount / unit; }
  }
  return result;
}
