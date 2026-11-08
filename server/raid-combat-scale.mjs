import { combatProfile, unitCombatStats } from "./combat-stats.mjs";

// Opening and midgame calibration uses modest legal DNA defenders.
// World playtests cover 25 minutes; later stages remain provisional.
export const RAID_COMBAT_STAGES = Object.freeze([
  Object.freeze({ at:300, health:.1, damage:.025 }),
  Object.freeze({ at:480, health:.2, damage:.05 }),
  Object.freeze({ at:720, health:.4, damage:.2 }),
  Object.freeze({ at:1080, health:.5, damage:.2 }),
  Object.freeze({ at:1500, health:.65, damage:.25 }),
  Object.freeze({ at:1800, health:.8, damage:.4 }),
  Object.freeze({ at:2100, health:.9, damage:.6 }),
  Object.freeze({ at:2400, health:1, damage:1 })
]);

// Version-one saves keep their original cohort, including fractional injury.
const LEGACY_RAID_COMBAT_STAGES = [
  {health:.2,damage:.1}, {health:.3,damage:.15}, {health:.5,damage:.3},
  {health:.75,damage:.6}, {health:1,damage:1}
];

const VERSION_TWO_RAID_COMBAT_STAGES = [
  {health:.2,damage:.1}, {health:.3,damage:.15}, {health:.4,damage:.2}, {health:.5,damage:.2},
  {health:.65,damage:.25}, {health:.8,damage:.4}, {health:.9,damage:.6}, {health:1,damage:1}
];

export function raidCombatStage(seconds) {
  return Math.max(0, RAID_COMBAT_STAGES.findLastIndex(stage => seconds >= stage.at));
}

export const RAID_CREATURE_STAGES = Object.freeze([
  { at:300, species:"soil-mole", name:"흙두더지", health:16, power:.75, armor:0 },
  { at:480, species:"spiny-back-beetle", name:"가시등벌레", health:26, power:.9, armor:10 },
  { at:720, species:"soil-boar", name:"흙멧돼지", health:54, power:3.1, armor:12 },
  { at:1080, species:"soil-boar", name:"흙멧돼지", health:72, power:4.65, armor:16 },
  { at:1500, species:"soil-boar", name:"흙멧돼지", health:99, power:7.75, armor:18 },
  { at:1800, species:"soil-boar", name:"흙멧돼지", health:126, power:12.4, armor:20 },
  { at:2100, species:"soil-boar", name:"흙멧돼지", health:153, power:18.6, armor:22 },
  { at:2400, species:"soil-boar", name:"흙멧돼지", health:180, power:31, armor:22 }
].map(stage => Object.freeze(stage)));

export function prepareRaidCreature(agent, departedAt) {
  if (!Number.isFinite(departedAt) || departedAt < 0) throw new Error("습격 전투 단계 시간이 올바르지 않습니다.");
  const stage = Math.max(0, RAID_CREATURE_STAGES.findLastIndex(entry => departedAt >= entry.at));
  agent.species = RAID_CREATURE_STAGES[stage].species;
  agent.raidCombatScale = { version:4, stage };
  applyRaidCombatScale(agent);
}

function applyRaidCreatureStats(agent, marker) {
  const stage = Number.isInteger(marker.stage) && RAID_CREATURE_STAGES[marker.stage];
  if (!stage || agent.species !== stage.species) throw new Error("습격 전투 단계 저장 형식이 올바르지 않습니다.");
  const base = unitCombatStats(stage.species), opening = stage.species === "soil-mole";
  const previousMaximum = Number.isFinite(agent.stats?.health) && agent.stats.health > 0 ? agent.stats.health : agent.health;
  const fraction = previousMaximum > 0 ? Math.max(0, Math.min(1, agent.health / previousMaximum)) : 0;
  const damageScale = stage.power / base.attackPower, speed = opening ? .5 : base.attackSpeed;
  const combat = { ...base.combat, health:stage.health, power:stage.power, armor:stage.armor, speed,
    meleePower:stage.power, meleeSpeed:speed, rangedPower:opening ? 0 : base.combat.rangedPower * damageScale,
    rangedSpeed:opening ? 0 : base.combat.rangedSpeed, bleedPower:base.combat.bleedPower * damageScale };
  if (opening) Object.assign(combat, { melee:true, ranged:false, position:"middle", hits:1,
    critical:0, evasion:0, parry:0, block:0, counter:0, penetration:0, reduction:0,
    stun:0, bleed:0, bleedPower:0, area:0, reflection:0, lifesteal:0, regeneration:0 });
  agent.stats = { ...agent.stats, ...base, health:stage.health, attack:stage.power, attackPower:stage.power,
    defense:stage.armor, attackSpeed:speed, combat,
    ...(opening ? { criticalChance:0, evasion:0, parry:0, block:0 } : {}) };
  agent.health = stage.health * fraction;
  agent.name = stage.name;
  agent.faction = "hostile";
  agent.combatDisposition = "aggressive";
  agent.raidCombatScale = { ...marker };
  return true;
}

export function applyRaidCombatScale(agent, departedAt) {
  if (departedAt === undefined && agent.raidCombatScale?.version === 4) return applyRaidCreatureStats(agent, agent.raidCombatScale);
  if (agent.species !== "spiny-back-beetle") return false;
  let marker = agent.raidCombatScale;
  if (departedAt !== undefined) {
    if (!Number.isFinite(departedAt) || departedAt < 0) throw new Error("습격 전투 단계 시간이 올바르지 않습니다.");
    marker = { version:3, stage:raidCombatStage(departedAt) };
  }
  if (!marker) return false;
  const stages = marker.version === 1 ? LEGACY_RAID_COMBAT_STAGES : marker.version === 2 ? VERSION_TWO_RAID_COMBAT_STAGES :
    marker.version === 3 ? RAID_COMBAT_STAGES : null;
  if (!stages || !Number.isInteger(marker.stage) || !stages[marker.stage])
    throw new Error("습격 전투 단계 저장 형식이 올바르지 않습니다.");
  const stage = stages[marker.stage], base = unitCombatStats(agent.species);
  const previousMaximum = Number.isFinite(agent.stats?.health) && agent.stats.health > 0 ? agent.stats.health : base.health;
  const fraction = Math.max(0, Math.min(1, agent.health / previousMaximum));
  // Never derive from the already-scaled saved attackPower: restore is idempotent.
  const profile = combatProfile({ species:agent.species, attributes:agent.attributes, stats:base });
  agent.stats = { ...agent.stats, ...base, health:base.health * stage.health, combatStrength:base.combatStrength,
    attackPower:profile.attackPower * stage.damage, attack:base.attack * stage.damage };
  agent.health = agent.stats.health * fraction;
  agent.raidCombatScale = { ...marker };
  return true;
}
