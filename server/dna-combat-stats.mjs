import { tribeDnaStats } from "./tribe-dna-stats.mjs";

export const DNA_COMBAT_RULES = Object.freeze({
  basicPower: 1,
  powerCurve: "linear", powerBase: 2, powerGain: 4, powerKnee: 2,
  rangedPowerBase: 1.4, rangedPowerGain: 1.4, rangedPowerKnee: 2,
  rangedAttackRateBase: .5, rangedHasteCap: 7, rangedHasteKnee: 70,
  healthBase: 10, healthPerPoint: 20, armorPerPoint: 10, armorCap: 1, armorKnee: 100,
  flatPenPerPoint: 5, percentPenCap: .8, percentPenKnee: 4,
  attackRateBase: .5, hasteCap: 7, hasteKnee: 70, maxActionRate: 4,
  windupBase: .3, focusPerPoint: .04, windupMinimum: .08,
  hitGapBase: .12, hitSpeedPerPoint: .01, hitGapMinimum: .06, recovery: 0,
  defensePreparation: 0, reactionCooldown: 0, counterCooldown: 0,
  followupBase: .5, comboPerPoint: .05, followupCap: 1,
  critCap: .9, critKnee: 9, critMultiplierBase: 2, critMultiplierCap: 5, critPowerKnee: 20,
  accuracyCap: .6, accuracyKnee: 20, dodgeCap: .6, dodgeKnee: 20,
  parryCap: .6, parryKnee: 15, blockCap: .9, blockKnee: 10.8,
  blockReductionBase: .5, blockReductionCap: .9, blockPowerKnee: 8,
  counterCap: 1, counterKnee: 10, counterMultiplierBase: 1, counterMultiplierCap: 2,
  counterPowerKnee: 10, counterWindup: .12,
  tenacityCap: .75, tenacityKnee: 15, stunCap: .6, stunKnee: 10,
  stunDurationBase: .35, stunDurationPerPoint: .1, stunDurationCap: 1.5, stunImmunity: 2,
  drainCap: .4, drainKnee: 10, jitter: .2
});

export function dnaCombatStats(counts, weights, inputRules, tribe) {
  const rules = inputRules || DNA_COMBAT_RULES, profile = tribeDnaStats(tribe), base = profile.base, c = counts;
  const n = Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value * (profile.growth[key] ?? 1)]));
  const capped = (count, cap, knee) => count ? Math.min(cap, cap * count / (knee || 1)) : 0;
  const powerGain = (count, gain, knee) => rules.powerCurve === "log" ?
    gain * Math.log1p(count / knee) / Math.log1p(1 / knee) : gain * count;
  const melee = !!c.blade, ranged = !!c.secretion, attack = melee || ranged, defensiveMelee = !attack;
  // A basic body can defend itself without gaining an offensive organ or its upgrades.
  const meleePower = melee ? rules.powerBase * base.meleePower * c.blade + powerGain(n.power || 0, rules.powerGain, rules.powerKnee) : defensiveMelee ? rules.basicPower : 0;
  const rangedPower = ranged ? rules.rangedPowerBase * base.rangedPower * c.secretion + powerGain(n.rangedPower || 0, rules.rangedPowerGain, rules.rangedPowerKnee) : 0;
  const meleeSpeed = melee ? Math.min(rules.maxActionRate, rules.attackRateBase * base.meleeSpeed * (1 + capped(n.speed || 0, rules.hasteCap, rules.hasteKnee))) : defensiveMelee ? Math.min(rules.maxActionRate, rules.attackRateBase) : 0;
  const rangedSpeed = ranged ? Math.min(rules.maxActionRate, rules.rangedAttackRateBase * base.rangedSpeed * (1 + capped(n.rangedSpeed || 0, rules.rangedHasteCap, rules.rangedHasteKnee))) : 0;
  return { bladeCount: c.blade || 0, secretionCount: c.secretion || 0,
    melee, ranged, defensiveMelee, meleePower, meleeSpeed, rangedPower, rangedSpeed,
    ...(rules.recovery ? { recovery: rules.recovery } : {}),
    health: rules.healthBase * base.health + rules.healthPerPoint * (n.health || 0),
    power: melee || defensiveMelee ? meleePower : rangedPower, hits: attack ? 1 + (c.combo || 0) : 1, speed: melee || defensiveMelee ? meleeSpeed : rangedSpeed,
    armor: base.armor + rules.armorPerPoint * ((n.armor || 0) + (n.carapace || 0)),
    parry: 100 * capped(n.parry || 0, rules.parryCap, rules.parryKnee),
    block: 100 * capped(n.block || 0, rules.blockCap, rules.blockKnee),
    evasion: 100 * capped((n.evasion || 0) + (n.legs || 0), rules.dodgeCap, rules.dodgeKnee),
    comboPower: attack ? 100 * Math.min(rules.followupCap, rules.followupBase + rules.comboPerPoint * (n.comboPower || 0)) : 0,
    critical: attack ? 100 * capped(n.critical || 0, rules.critCap, rules.critKnee) : 0,
    criticalPower: attack ? 100 * (rules.critMultiplierBase + capped(n.criticalPower || 0, rules.critMultiplierCap - rules.critMultiplierBase, rules.critPowerKnee)) : 0,
    accuracy: attack ? 100 * capped(n.accuracy || 0, rules.accuracyCap, rules.accuracyKnee) : 0,
    penetration: attack ? rules.flatPenPerPoint * (n.penetration || 0) : 0,
    ...(n.percentPen ? { armorPenetration: capped(n.percentPen, rules.percentPenCap, rules.percentPenKnee) } : {}),
    blockPower: 100 * Math.min(rules.blockReductionCap, rules.blockReductionBase + .05 * (c.blockPower || 0)),
    counter: (attack || c.carapace) ? 100 * capped(n.counter || 0, rules.counterCap, rules.counterKnee) : 0,
    counterPower: (attack || c.carapace) ? 100 * (rules.counterMultiplierBase + capped(n.counterPower || 0, rules.counterMultiplierCap - rules.counterMultiplierBase, rules.counterPowerKnee)) : 0,
    tenacity: 100 * capped(n.tenacity || 0, rules.tenacityCap, rules.tenacityKnee), reduction: Math.min(40, 2 * (n.reduction || 0)),
    stun: attack ? 100 * capped(n.stun || 0, rules.stunCap, rules.stunKnee) : 0,
    stunTime: attack && n.stun ? Math.min(rules.stunDurationCap, rules.stunDurationBase + rules.stunDurationPerPoint * (n.stunTime || 0)) : 0,
    bleed: attack ? Math.min(75, 5 * (n.bleed || 0)) : 0, bleedPower: attack && n.bleed ? 1 + (n.bleedPower || 0) : 0,
    area: attack ? Math.min(8, n.area || 0) : 0, areaPower: attack && n.area ? Math.min(100, 60 + 10 * (n.areaPower || 0)) : 0,
    lifesteal: attack ? 100 * capped(n.lifesteal || 0, rules.drainCap, rules.drainKnee) : 0,
    reflection: Math.min(75, 5 * (n.reflection || 0)), regeneration: .5 * (n.regeneration || 0),
    comboSpeed: attack ? Math.max(rules.hitGapMinimum, rules.hitGapBase - rules.hitSpeedPerPoint * (n.comboSpeed || 0)) : rules.hitGapBase,
    focus: attack ? Math.max(rules.windupMinimum, rules.windupBase - rules.focusPerPoint * (n.focus || 0)) : rules.windupBase };
}
