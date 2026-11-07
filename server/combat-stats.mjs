import { dnaAttackStats } from "./dna-actions.mjs";
export const COMBAT_BASE_DAMAGE = 15;
export const COMBAT_STRENGTH_SCALE = 25;
export const COMBAT_MAX_INJURY_PENALTY = 10;
export const UNIT_MAX_HEALTH = 100;

export const ATTRIBUTE_COMBAT_STRENGTH_BONUSES = Object.freeze({
  blade: 10, piercing: 16, carapace: 8
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
  ["flower-tail-bird", 8, 18, 3, 4, 40, 10],
  ["dew-rabbit", 10, 22, 3, 4, 40, 8],
  ["soil-mole", 14, 10, 6, 10, 45, 12],
  ["bundle-snail", 16, 3, 2, 24, 60, 5],
  ["cotton-sheep", 12, 7, 3, 14, 50, 5],
  ["rolling-acorn", 16, 12, 4, 18, 55, 8],
  ["bubble-toad", 28, 10, 5, 12, 50, 10],
  ["snare-vine", 34, 3, 12, 14, 50, 8],
  ["spiny-back-beetle", 32, 6, 6, 22, 60, 8],
  ["soil-boar", 36, 5, 6, 18, 55, 12],
  ["vine-turtle", 28, 2, 4, 28, 65, 5],
  ["shadow-weasel", 40, 22, 12, 5, 40, 20],
  ["talon-owl", 44, 18, 14, 6, 45, 18],
  ["spring-keeper", 36, 18, 18, 10, 50, 15],
  ["lantern-keeper", 38, 16, 10, 14, 50, 15],
  ["old-garden-snail", 42, 2, 3, 30, 65, 5],
  ["walking-forest", 48, 2, 6, 28, 65, 8],
  ["white-paw", 64, 20, 16, 12, 50, 20],
  ["spiny-back-leader", 54, 10, 10, 28, 65, 12]
].map(([key, combatStrength, evasion, parry, block, blockReduction, criticalChance]) => [key, Object.freeze({
  health: UNIT_MAX_HEALTH, combatStrength, evasion: (evasion || 0) / 100, parry: (parry || 0) / 100,
  block: (block || 0) / 100, blockReduction: (blockReduction || 0) / 100,
  criticalChance: (criticalChance || 0) / 100, criticalMultiplier: 1.5
})])));

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
  const dna = agent.stats?.dna, base = unitCombatStats(agent.species || agent.tribe);
  const chance = dna ? dna.critical / 100 : Number.isFinite(agent.stats?.criticalChance) ? agent.stats.criticalChance : base.criticalChance;
  const multiplier = dna ? dna.criticalPower / 100 : Number.isFinite(agent.stats?.criticalMultiplier) ? agent.stats.criticalMultiplier : base.criticalMultiplier;
  const criticalChance = dna ? (Number.isFinite(chance) ? chance : 0) : Math.max(0, Math.min(.75, chance));
  const criticalMultiplier = dna ? (Number.isFinite(multiplier) ? multiplier : 1.5) : Math.max(1, Math.min(4, multiplier));
  if (dna) {
    const selected = dnaAttackStats(dna, agent.attack?.attackMode || (dna.melee ? "melee" : "ranged"));
    const attackInterval = selected.speed > 0 ? 1 / selected.speed : Infinity;
    return { primary: selected.power > 0 ? "blade" : null, attackPower: selected.power, defense: dna.armor,
      armorPenetration: 0, attackSpeed: selected.speed, attackInterval, windup: dna.focus,
      recovery: dna.recovery || 0, criticalChance, criticalMultiplier };
  }
  const equipped = key => Array.isArray(agent.slots) ? agent.slots.includes(key) : agent.attributes?.[key] > 0;
  const primary = combatPrimary(agent);
  const defaultInterval = primary === "blade" ? .95 : primary === "piercing" ? 1.65 : primary === "carapace" ? 1.4 : 1.25;
  const attackSpeed = Number.isFinite(agent.stats?.attackSpeed) && agent.stats.attackSpeed > 0 ?
    Math.max(.2, Math.min(4, agent.stats.attackSpeed)) : 1 / defaultInterval;
  const attackInterval = 1 / attackSpeed;
  const strength = Number.isFinite(agent.stats?.combatStrength) ?
    agent.stats.combatStrength - (agent.species ? 0 : attributeCombatStrengthBonus(agent.attributes)) : base.combatStrength;
  const attackPower = Number.isFinite(agent.stats?.attackPower) ? agent.stats.attackPower :
    12 + strength * .35 + (equipped("blade") ? 12 : 0);
  const reduction = equipped("carapace") ? .45 : Math.max(0, Math.min(.8, agent.stats?.damageReduction || 0));
  const defense = Number.isFinite(agent.stats?.defense) ? agent.stats.defense : 8 + strength * .4 + 100 * reduction / (1 - reduction);
  const armorPenetration = equipped("piercing") ? .5 : Math.max(0, Math.min(1, agent.stats?.armorPenetration || 0));
  const protection = Object.fromEntries(["evasion", "parry", "block", "blockReduction"].map(key => [key,
    Math.max(0, Math.min(1, Number.isFinite(agent.stats?.[key]) ? agent.stats[key] : agent.species ? base[key] : 0))]));
  return { primary, attackPower: Math.max(1, attackPower), defense: Math.max(0, defense), armorPenetration, ...protection, criticalChance, criticalMultiplier,
    attackSpeed, attackInterval, windup: (primary === "piercing" ? .65 : primary === "blade" ? .24 : .4),
    recovery: (primary === "blade" ? .3 : .45) };
}

export function combatDamage(attacker, target, variation, rules) {
  const source = combatProfile(attacker), defense = combatProfile(target);
  const multiplier = Number.isFinite(variation) ? .8 + .4 * Math.max(0, Math.min(1, variation)) : 1;
  if (attacker.stats?.dna || target.stats?.dna) {
    const dna = attacker.stats?.dna, heavy = !dna && attacker.attack?.heavy === true;
    const armor = Math.max(0, defense.defense - (dna?.penetration || 0)) * (dna ? 1 - (dna.armorPenetration || 0) : 1 - Math.min(.9, source.armorPenetration + (heavy ? .3 : 0)));
    const power = source.attackPower * (dna ? attacker.attack?.counter ? dna.counterPower / 100 : 1 :
      (source.primary === "piercing" ? 1.25 : 1) * (heavy ? 1.5 : 1));
    const reduction = (rules?.armorCap ?? 1) * armor / ((rules?.armorKnee ?? 100) + armor);
    return Math.max(0, power * multiplier * (1 - reduction) * (1 - (target.stats?.dna?.reduction || 0) / 100));
  }
  const heavy = attacker.attack?.heavy === true;
  const penetration = Math.min(.9, source.armorPenetration + (heavy ? .3 : 0));
  const power = source.attackPower * (source.primary === "piercing" ? 1.25 : 1) * (heavy ? 1.5 : 1);
  return Math.max(1, Math.round(power * multiplier * 100 / (100 + defense.defense * (1 - penetration))));
}

export function migrateCombatStats(agent) {
  if (agent.dna || agent.stats?.dna) return;
  const profile = unitCombatStats(agent.species || agent.tribe);
  const combatStrength = profile.combatStrength + (agent.species ? 0 : attributeCombatStrengthBonus(agent.attributes));
  if (agent.species) for (const key of ["evasion", "parry", "block", "blockReduction", "criticalChance", "criticalMultiplier"])
    if (!Number.isFinite(agent.stats[key])) agent.stats[key] = profile[key];
  if (agent.stats.combatStrength === combatStrength && agent.stats.health === UNIT_MAX_HEALTH) return;
  const health = UNIT_MAX_HEALTH;
  const ratio = Math.max(0, Math.min(1, agent.health / agent.stats.health));
  agent.stats = { ...agent.stats, health, combatStrength };
  agent.health = health * ratio;
}
