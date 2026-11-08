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

export function applyRaidCombatScale(agent, departedAt) {
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
