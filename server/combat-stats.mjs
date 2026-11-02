export const COMBAT_BASE_DAMAGE = 15;
export const COMBAT_STRENGTH_SCALE = 25;
export const COMBAT_MAX_INJURY_PENALTY = 10;
export const UNIT_MAX_HEALTH = 100;

export const ATTRIBUTE_COMBAT_STRENGTH_BONUSES = Object.freeze({
  blade: 10, piercing: 16, carapace: 8, guard: 8, regeneration: 12
});

export function attributeCombatStrengthBonus(attributes) {
  return Object.entries(ATTRIBUTE_COMBAT_STRENGTH_BONUSES).reduce((sum, [key, bonus]) =>
    sum + (attributes?.[key] > 0 ? bonus : 0), 0);
}

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

export function combatPrimary(agent) {
  const keys = ["blade", "piercing", "carapace"];
  const equipped = key => Array.isArray(agent.slots) ? agent.slots.includes(key) : agent.attributes?.[key] > 0;
  if (agent.combatPrimary === null) return null;
  if (keys.includes(agent.combatPrimary) && equipped(agent.combatPrimary)) return agent.combatPrimary;
  return keys.find(equipped) || null;
}

export function combatProfile(agent) {
  const base = unitCombatStats(agent.species || agent.tribe);
  const equipped = key => Array.isArray(agent.slots) ? agent.slots.includes(key) : agent.attributes?.[key] > 0;
  const primary = combatPrimary(agent);
  const defaultInterval = primary === "blade" ? .95 : primary === "piercing" ? 1.65 : primary === "carapace" ? 1.4 : 1.25;
  const attackSpeed = Number.isFinite(agent.stats?.attackSpeed) && agent.stats.attackSpeed > 0 ?
    Math.max(.2, Math.min(4, agent.stats.attackSpeed)) : 1 / defaultInterval;
  const attackInterval = 1 / attackSpeed;
  const timingScale = attackInterval / defaultInterval;
  const strength = Number.isFinite(agent.stats?.combatStrength) ?
    agent.stats.combatStrength - (agent.species ? 0 : attributeCombatStrengthBonus(agent.attributes)) : base.combatStrength;
  const attackPower = Number.isFinite(agent.stats?.attackPower) ? agent.stats.attackPower :
    12 + strength * .35 + (equipped("blade") ? 12 : 0);
  const reduction = equipped("carapace") ? .45 : Math.max(0, Math.min(.8, agent.stats?.damageReduction || 0));
  const defense = Number.isFinite(agent.stats?.defense) ? agent.stats.defense : 8 + strength * .4 + 100 * reduction / (1 - reduction);
  const armorPenetration = equipped("piercing") ? .5 : Math.max(0, Math.min(1, agent.stats?.armorPenetration || 0));
  return { primary, attackPower: Math.max(1, attackPower), defense: Math.max(0, defense), armorPenetration,
    attackSpeed, attackInterval, windup: (primary === "piercing" ? .65 : primary === "blade" ? .24 : .4) * timingScale,
    recovery: (primary === "blade" ? .3 : .45) * timingScale };
}

export function combatDamage(attacker, target, variation) {
  const source = combatProfile(attacker), defense = combatProfile(target);
  const multiplier = Number.isFinite(variation) ? .8 + .4 * Math.max(0, Math.min(1, variation)) : 1;
  const heavy = attacker.attack?.heavy === true;
  const penetration = Math.min(.9, source.armorPenetration + (heavy ? .3 : 0));
  const power = source.attackPower * (source.primary === "piercing" ? 1.25 : 1) * (heavy ? 1.5 : 1);
  const guard = Math.max(0, Math.min(.6, Math.max(target.stats?.guardProtection || 0, target.combat?.guardProtection || 0)));
  return Math.max(1, Math.round(power * multiplier * 100 / (100 + defense.defense * (1 - penetration)) * (1 - guard)));
}

export function migrateCombatStats(agent) {
  const profile = unitCombatStats(agent.species || agent.tribe);
  const combatStrength = profile.combatStrength + (agent.species ? 0 : attributeCombatStrengthBonus(agent.attributes));
  if (agent.stats.combatStrength === combatStrength && agent.stats.health === UNIT_MAX_HEALTH) return;
  const health = UNIT_MAX_HEALTH;
  const ratio = Math.max(0, Math.min(1, agent.health / agent.stats.health));
  agent.stats = { ...agent.stats, health, combatStrength };
  agent.health = health * ratio;
}
