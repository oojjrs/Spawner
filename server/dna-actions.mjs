export const DNA_ACTION_RULES = Object.freeze({ meleeRange: 1, rangedRange: 3, projectileSpeed: 6, rangedPowerBase: 1.4 });

export function dnaAttackMode(stats, distance) {
  if (stats.melee && distance <= DNA_ACTION_RULES.meleeRange) return "melee";
  if (stats.ranged && distance <= DNA_ACTION_RULES.rangedRange) return "ranged";
  return null;
}

export function dnaProjectileDuration(distance) {
  return Math.max(0, distance) / DNA_ACTION_RULES.projectileSpeed;
}

export function dnaProjectileValid(source, target) {
  return !!source && !!target && source.health > 0 && target.health > 0 && !source.hidden && !target.hidden && !source.retreat && !target.retreat;
}

export function dnaAttackStats(stats, mode) {
  return { power: mode === "ranged" ? stats.rangedPower : stats.meleePower, speed: mode === "ranged" ? stats.rangedSpeed : stats.meleeSpeed };
}
