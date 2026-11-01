export const COMBAT_BASE_DAMAGE = 15;
export const COMBAT_STRENGTH_SCALE = 25;
export const COMBAT_MAX_INJURY_PENALTY = 10;
export const UNIT_MAX_HEALTH = 100;

export const UNIT_COMBAT_STATS = Object.freeze(Object.fromEntries([
  ["bean", 20],
  ["spore", 18],
  ["pebble", 22],
  ["spring", 19],
  ["flower-tail-bird", 8],
  ["dew-rabbit", 10],
  ["soil-mole", 14],
  ["bundle-snail", 16],
  ["cotton-sheep", 12],
  ["rolling-acorn", 16],
  ["bubble-toad", 28],
  ["snare-vine", 34],
  ["spiny-back-beetle", 32],
  ["soil-boar", 36],
  ["vine-turtle", 28],
  ["shadow-weasel", 40],
  ["talon-owl", 44],
  ["spring-keeper", 36],
  ["lantern-keeper", 38],
  ["old-garden-snail", 42],
  ["walking-forest", 48],
  ["white-paw", 64],
  ["spiny-back-leader", 54]
].map(([key, combatStrength]) => [key, Object.freeze({ health: UNIT_MAX_HEALTH, combatStrength })])));

export function unitCombatStats(key) {
  return UNIT_COMBAT_STATS[key] || UNIT_COMBAT_STATS.bean;
}

export function combatInjuryPenalty(agent) {
  const maximum = Number.isFinite(agent.stats?.health) && agent.stats.health > 0 ? agent.stats.health : UNIT_MAX_HEALTH;
  const health = Number.isFinite(agent.health) ? Math.max(0, Math.min(maximum, agent.health)) : maximum;
  return Math.round(COMBAT_MAX_INJURY_PENALTY * (maximum - health) / maximum);
}

export function combatStrength(agent) {
  const base = Number.isFinite(agent.stats?.combatStrength) ? agent.stats.combatStrength :
    unitCombatStats(agent.species || agent.tribe).combatStrength;
  return base - combatInjuryPenalty(agent);
}

export function combatDamage(attacker, target, variation) {
  const multiplier = Number.isFinite(variation) ? .8 + .4 * Math.max(0, Math.min(1, variation)) : 1;
  const penetration = Math.max(0, Math.min(1, attacker.stats?.armorPenetration || 0));
  const armor = Math.max(0, Math.min(.8, target.stats?.damageReduction || 0));
  const guard = Math.max(0, Math.min(.6, Math.max(target.stats?.guardProtection || 0, target.combat?.guardProtection || 0)));
  return Math.max(1, Math.round(COMBAT_BASE_DAMAGE * multiplier *
    Math.exp((combatStrength(attacker) + (attacker.stats?.attackBonus || 0) - combatStrength(target)) / COMBAT_STRENGTH_SCALE) *
    (1 - armor * (1 - penetration)) * (1 - guard)));
}

export function migrateCombatStats(agent) {
  const profile = unitCombatStats(agent.species || agent.tribe);
  if (agent.stats.combatStrength === profile.combatStrength && agent.stats.health === UNIT_MAX_HEALTH) return;
  const health = UNIT_MAX_HEALTH;
  const ratio = Math.max(0, Math.min(1, agent.health / agent.stats.health));
  agent.stats = { ...agent.stats, health, combatStrength: profile.combatStrength };
  agent.health = health * ratio;
}
