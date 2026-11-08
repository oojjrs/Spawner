import { NEUTRAL_STAT_LIMITS } from "./neutral-stat-limits.mjs";

export const NEUTRAL_STAT_FIELDS = Object.freeze(["health","power","armor","speed","movement","vision","combo","comboPower","critical","criticalPower","accuracy","penetration","comboSpeed","focus","evasion","parry","block","blockPower","counter","counterPower","tenacity","reduction","stun","stunTime","bleed","bleedPower","area","areaPower","lifesteal","reflection","regeneration","capacity","harvestSpeed"]);

export const NEUTRAL_UNIT_TIERS = Object.freeze(Object.fromEntries([
  ["flower-tail-bird",[1,1,3,1,16,14,17,14,8,8,3,14,5,16,12,15,12,1,1,7,3,1,1,1,1,5,6,2,2,4,4,9,1,19]],
  ["dew-rabbit",[2,2,2,2,13,16,13,13,7,7,2,10,2,13,11,14,11,2,2,2,2,2,2,2,2,2,2,1,1,3,1,10,2,17]],
  ["soil-mole",[6,6,6,7,8,6,1,8,10,11,8,12,11,8,10,7,10,11,11,8,8,10,10,12,9,12,11,8,8,12,7,8,9,16]],
  ["bundle-snail",[5,10,5,15,4,4,3,4,4,2,6,2,3,4,2,3,2,15,16,3,7,12,15,6,4,3,3,9,6,7,13,14,17,4]],
  ["cotton-sheep",[4,7,1,5,6,7,10,6,5,1,1,3,1,5,6,8,4,7,7,1,1,9,14,5,3,1,1,12,5,2,12,12,12,14]],
  ["rolling-acorn",[3,3,4,12,10,10,2,10,6,6,7,1,7,10,1,11,8,13,12,6,6,4,4,10,5,6,7,7,7,1,11,1,6,12]],
  ["bubble-toad",[7,8,7,6,11,9,8,11,9,10,9,7,8,11,7,12,7,8,8,11,9,8,8,17,19,7,8,18,16,15,8,11,8,9]],
  ["snare-vine",[9,11,10,11,5,1,12,5,11,14,13,13,14,6,13,5,1,10,10,12,12,11,9,9,18,15,14,17,13,19,15,18,13,5]],
  ["spiny-back-beetle",[8,9,8,14,9,8,4,9,12,12,12,9,15,9,9,9,16,14,14,18,16,14,12,11,8,14,13,11,11,11,18,2,11,8]],
  ["soil-boar",[10,14,14,13,7,11,6,7,16,16,16,8,13,7,8,6,9,12,13,13,15,15,13,18,11,13,15,13,17,13,10,5,14,6]],
  ["vine-turtle",[13,16,9,16,3,5,5,3,3,3,10,6,10,3,5,4,6,19,17,15,13,16,17,15,12,9,10,16,15,8,17,15,16,2]],
  ["shadow-weasel",[11,5,15,4,19,18,14,18,18,18,14,16,18,18,17,16,17,4,4,17,11,5,5,8,7,18,17,5,10,17,2,7,7,13]],
  ["talon-owl",[12,4,16,3,15,13,19,16,14,17,15,19,17,15,14,13,15,3,3,14,10,3,3,7,6,17,16,6,9,16,3,4,3,10]],
  ["spring-keeper",[15,12,12,8,17,15,18,17,15,13,5,17,9,17,18,18,14,5,5,9,5,6,6,3,10,10,9,4,4,6,9,13,4,18]],
  ["lantern-keeper",[14,13,11,9,14,17,15,15,13,9,4,15,4,14,16,17,13,6,6,4,4,7,7,4,13,4,4,3,3,5,5,16,5,15]],
  ["old-garden-snail",[16,18,13,18,2,2,7,2,2,4,11,4,6,2,3,1,3,17,18,5,14,17,18,13,14,8,5,14,12,9,14,17,19,3]],
  ["walking-forest",[19,19,18,19,1,3,11,1,1,5,17,5,12,1,4,2,5,18,19,10,18,19,19,19,17,11,12,19,19,10,16,19,18,1]],
  ["white-paw",[18,15,19,10,18,19,16,19,19,19,19,18,19,19,19,19,19,9,9,16,17,13,11,14,15,19,19,10,14,18,6,6,10,11]],
  ["spiny-back-leader",[17,17,17,17,12,12,9,12,17,15,18,11,16,12,15,10,18,16,15,19,19,18,16,16,16,16,18,15,18,14,19,3,15,7]]
].map(([key, values]) => [key, Object.freeze({ tier:values[0], ...Object.fromEntries(NEUTRAL_STAT_FIELDS.map((field, index) => [field, values[index + 1]])) })])));

const NEUTRAL_STAT_CURVES = Object.freeze({
  health:[null,850,2],
  power:[null,75,1.5],
  armor:[null,55,2],
  speed:[null,1.12,1],
  movement:[null,1.1,1],
  vision:[null,8,1],
  combo:[null,1,2],
  comboPower:[50,65,1],
  critical:[null,16,2],
  criticalPower:[200,250,1],
  accuracy:[null,14,2],
  penetration:[null,12,2],
  comboSpeed:[0.12,0.06,1],
  focus:[0.3,0.08,1],
  evasion:[null,18,2],
  parry:[null,12,2],
  block:[null,24,2],
  blockPower:[50,75,1],
  counter:[null,15,2],
  counterPower:[100,145,1],
  tenacity:[null,36,2],
  reduction:[null,12,2],
  stun:[null,10,2],
  stunTime:[0.35,0.56,1],
  bleed:[null,10,2],
  bleedPower:[1,4,1],
  area:[null,2,2],
  areaPower:[60,80,1],
  lifesteal:[null,5,2],
  reflection:[null,10,2],
  regeneration:[null,1.9,2],
  capacity:[null,19,1],
  harvestSpeed:[null,1.9,1]
});

export function neutralTierStat(field, tier) {
  const limits = NEUTRAL_STAT_LIMITS[field], curve = NEUTRAL_STAT_CURVES[field];
  if (!limits || !curve || !Number.isInteger(tier) || tier < 1 || tier > 19) throw new Error("Invalid neutral stat tier");
  const low = Math.min(limits.min, limits.max), high = Math.max(limits.min, limits.max);
  const clamp = value => Math.max(low, Math.min(high, value));
  const first = clamp(curve[0] ?? limits.min), last = clamp(curve[1]);
  const value = first + (last - first) * ((tier - 1) / 18) ** curve[2];
  return clamp(Math.round(value * 1000000) / 1000000);
}

export const NEUTRAL_UNIT_STATS = Object.freeze(Object.fromEntries(Object.entries(NEUTRAL_UNIT_TIERS)
  .map(([key, ranks]) => [key, Object.freeze(Object.fromEntries(NEUTRAL_STAT_FIELDS.map(field => [field, neutralTierStat(field, ranks[field])])))])));
